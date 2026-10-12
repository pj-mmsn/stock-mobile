# -*- coding: utf-8 -*-
"""K线增量更新（all 全量 / hot 热股池）。

降速：串行 + 0.35s 间隔（腾讯 ifzq 窗口安全阈值；并发 2+0.25s 曾触发 501 全灭）

===== 修复史（都是"数据静默不更新"同一类事故）=====

▌2026-10-12 L1a：漏导入 kline_get（停摆 6 周）
  本文件 `from predict_server import ...` 漏了 `kline_get`，而 work() 调用了它
  → 每只股票抛 NameError；又被 `except Exception: return 0` 静默吞掉
  → 表现为「正常跑满 32 分钟 + ok=0/5507」，故障完全不可见，连续 6 周无人发现。
  修复：补 import + 异常计数落盘 + 进度行打印 ok。

▌2026-10-12 L1b：all 被 hot 饿死（全市场从未真正日刷）
  all(5507只) 与 hot(预测池 1874 只，每 10 分钟触发一次，每次跑 45 分钟)
  共用同一个 flock，hot 几乎不间断持锁 → all 在 11:00/15:05 永远
  「另一个增量进程在跑，跳过本次」→ 全部 72 条日志里 all 一次都没成功跑过，
  只有 hot 覆盖的预测池是新的（实测 62.3% 停在上一交易日）。
  修复：①裁掉 hot 池（只保预测池头部）②hot 加时间预算，超时优雅退出
        ③收盘后划定 all 独占窗口，hot 主动让路。

▌2026-10-12 L2：腾讯 501 域名级封禁
  连续批量约 1500-2800 只后触发 HTTP 501，封禁 20-30 分钟。
  修复：predict_server 侧熔断 + 本文件侧「该更新却没更新」(stale_fail) 熔断。
"""
import sys, os, time, json, traceback
from datetime import datetime, timedelta, timezone

_DEF_LOG = '/opt/stock-mobile/refresh_kline_errors.log'
_err_samples = []
_err_count = 0

# ---- 可调参数 ----
HOT_PER_MODE = 350        # hot 池每档取前 N 只（3 档去重后约 900；原为全部 1874 只）
HOT_BUDGET_S = 1200       # hot 单次时间预算 20 分钟，超时优雅退出（让出锁给 all）
DAILY_WINDOW = ((15, 45), (17, 30))   # 工作日 all 独占窗口，hot 让路
_CST = timezone(timedelta(hours=8))


def _read_env_file(path, key):
    try:
        with open(path, encoding='utf-8') as _f:
            for _ln in _f:
                if _ln.strip().startswith(key + '='):
                    _v = _ln.strip().split('=', 1)[1].strip().strip('"').strip("'")
                    if _v:
                        return _v
    except Exception:
        pass
    return None


os.environ.setdefault('REDIS_URL',
                      os.environ.get('SM_REDIS_URL')
                      or _read_env_file('/etc/stock-mobile.env', 'REDIS_URL')
                      or 'redis://127.0.0.1:6379/0')
os.environ['PRED_DB'] = '/var/lib/stock-mobile/pred.db'
sys.path.insert(0, '/opt/stock-mobile/backend')

# ★ L1a：kline_get 必须导入（work() 用它比对末根日期，此前遗漏）
from predict_server import _kline_incremental, kline_get, DB, cache_get
from concurrent.futures import ThreadPoolExecutor, as_completed
import sqlite3

mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
seg_start = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 0
seg_end = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else 0


def _in_daily_window():
    """是否处于 all 独占窗口（工作日 15:45-17:30）"""
    try:
        d = datetime.now(_CST)
        if d.weekday() >= 5:
            return False
        hm = d.hour * 60 + d.minute
        return (DAILY_WINDOW[0][0] * 60 + DAILY_WINDOW[0][1]) <= hm < (DAILY_WINDOW[1][0] * 60 + DAILY_WINDOW[1][1])
    except Exception:
        return False


# ★ L1b③：hot 在 all 独占窗口内主动让路，避免把全量日刷饿死
if mode == 'hot' and _in_daily_window():
    print('[hot] 处于全量日刷窗口(15:45-17:30)，hot 让路 → 本次跳过', flush=True)
    sys.exit(0)

# 跨进程锁（all 与 hot 互斥，防双写）
import fcntl
_lock_f = open('/tmp/refresh_kline.lock', 'w')
try:
    fcntl.flock(_lock_f, fcntl.LOCK_EX | fcntl.LOCK_NB)
except OSError:
    print(f'[{mode}] 另一个增量进程在跑，跳过本次', flush=True)
    sys.exit(0)

c = sqlite3.connect(DB)
if mode == 'hot':
    # ★ L1b①：只取预测池头部（原为全部条目，三档去重后 1874 只 → 单次要跑 45 分钟）
    secids = set()
    for ck in ('prediction_short', 'prediction_swing', 'prediction_long'):
        try:
            for it in ((cache_get(ck) or {}).get('items') or [])[:HOT_PER_MODE]:
                if it.get('secid'):
                    secids.add(it['secid'])
        except Exception:
            pass
    codes = sorted(secids)
    print(f'[hot] 预测池头部每档 {HOT_PER_MODE} 只 → 去重后 {len(codes)} 只', flush=True)
else:
    codes = [r[0] for r in c.execute('SELECT secid FROM klines').fetchall()]
c.close()
if seg_start or seg_end:
    codes = codes[seg_start:seg_end if seg_end else len(codes)]
print(f'[{mode}] {len(codes)} 只增量（限速串行）...', flush=True)

t0 = time.time()
done = ok = 0
_stale_fail = 0       # 「缓存末根落后最新交易日」却没能更新的只数（真故障指标）
_recent = []          # 滚动窗口：最近 N 只里「该更新却没更新」的标记
_ABORT_WINDOW = 300   # 连续 300 只该更新却没更新 → 判定上游故障，早退
_aborted = False
_budget_hit = False
_LATEST = {'d': ''}   # 最新交易日（从成功更新的结果里学到）


def _budget_exceeded():
    """hot 单次超时（让出锁，防饿死 all）"""
    return mode == 'hot' and (time.time() - t0) > HOT_BUDGET_S


def work(secid):
    """返回 (结果, 是否本该更新)：
       结果 1=末根日期前进（真更新），0=未前进，-1=异常
       本该更新 = 更新前缓存末根 < 已知最新交易日
    L1a：异常不再静默吞掉——记录样本 + 计数，让管道故障可见。
    L1b：熔断必须区分「已最新的零」（合法，不该熔断）与「该更新却没更新的零」（故障，应熔断）。"""
    global _err_count, _stale_fail
    try:
        old = kline_get(secid)
        old_last = old[-1]['t'] if old else ''
        kl = _kline_incremental(secid)
        if not kl:
            return 0, True
        new_last = kl[-1]['t']
        if new_last > old_last:
            if new_last > _LATEST['d']:
                _LATEST['d'] = new_last
            return 1, True
        stale = bool(_LATEST['d'] and old_last and old_last < _LATEST['d'])
        if stale:
            _stale_fail += 1
        return 0, stale
    except Exception as e:
        _err_count += 1
        if len(_err_samples) < 10:
            _err_samples.append('%s: %r' % (secid, e))
            _err_samples.append(traceback.format_exc()[:600])
        return -1, True


with ThreadPoolExecutor(max_workers=1) as ex:
    futs = [ex.submit(work, c2) for c2 in codes]
    for f in as_completed(futs):
        done += 1
        r, stale = f.result()
        if r == 1:
            ok += 1
        # 只有「本该更新却没更新」才计入熔断窗口——已最新的零是合法的零
        _recent.append(1 if (stale and r != 1) else 0)
        if len(_recent) > _ABORT_WINDOW:
            _recent.pop(0)
        if (not _aborted and len(_recent) >= _ABORT_WINDOW
                and all(x == 1 for x in _recent)):
            _aborted = True
            print('  [ABORT] 连续 %d 只「该更新却没更新」（腾讯 501 且降级源也失效？）'
                  '→ 提前结束，避免空跑并延长封禁' % _ABORT_WINDOW, flush=True)
            break
        # ★ L1b②：hot 超预算 → 优雅退出，把锁让给 all
        if _budget_exceeded():
            _budget_hit = True
            print(f'  [BUDGET] hot 已达 {HOT_BUDGET_S}s 预算，提前退出（{done}/{len(codes)}）'
                  f' 让出锁给全量任务', flush=True)
            break
        if done % 200 == 0:
            print(f'  {done}/{len(codes)} elapsed={int(time.time()-t0)}s ok={ok} '
                  f'stale_fail={_stale_fail}', flush=True)
        time.sleep(0.35)  # 限速（腾讯 ifzq 窗口安全阈值）

line = 'INCR_DONE mode=%s ok=%d/%d errors=%d stale_fail=%d elapsed=%ds%s%s' % (
    mode, ok, len(codes), _err_count, _stale_fail, int(time.time() - t0),
    ' ABORTED(upstream)' if _aborted else '',
    ' BUDGET_HIT' if _budget_hit else '')
print(line, flush=True)

# 异常样本落盘（下次故障 5 秒可定位，不用再花几小时）
if _err_samples:
    try:
        with open(_DEF_LOG, 'a', encoding='utf-8') as fh:
            fh.write('\n===== %s  %s =====\n' % (time.strftime('%F %T'), line))
            fh.write('\n'.join(str(x) for x in _err_samples))
            fh.write('\n')
    except Exception:
        pass
    print('  异常样本（前 5 条）:', flush=True)
    for s in [x for x in _err_samples if not x.startswith('Traceback')][:5]:
        print('   ', s, flush=True)
