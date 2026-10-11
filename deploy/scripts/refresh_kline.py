# -*- coding: utf-8 -*-
"""K线增量更新（15:05 收盘 + 11:30 午休 + 盘中热股）：已有缓存 → 只拉当天新根 append。

降速：串行 + 0.35s 间隔（全量 5496 只 ≈ 33 分钟——5分钟窗口~850次，低于腾讯 ifzq 窗口阈值；
并发2+0.25s(5min~2400次) 曾触发 501 全灭）

⚠️ 2026-10-12 修复事故（停摆 6 周，数据一根没更新）：
  1) 本文件 `from predict_server import ...` 漏了 `kline_get`，而 work() 里调用了它
     → 每只股票都抛 NameError；
  2) work() 的 `except Exception: return 0` 把异常静默吞掉 → 表现为
     「正常跑满 32 分钟 + ok=0/5507」，故障完全不可见，连续 6 周无人发现。
  修复：补 import + 记录并打印异常样本与失败计数 + 结果落错误日志。
"""
import sys, os, time, json, traceback

_DEF_LOG = '/opt/stock-mobile/refresh_kline_errors.log'
_err_samples = []
_err_count = 0


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

# ★ 2026-10-12：kline_get 必须导入（work() 用它比对末根日期，此前遗漏）
from predict_server import _kline_incremental, kline_get, DB, cache_get
from concurrent.futures import ThreadPoolExecutor, as_completed
import sqlite3

mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
seg_start = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 0
seg_end = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else 0

# 跨进程锁（审计 P1：11:30 全量 vs 热股 */10 撞车会双写——flock 串行化）
import fcntl
_lock_f = open('/tmp/refresh_kline.lock', 'w')
try:
    fcntl.flock(_lock_f, fcntl.LOCK_EX | fcntl.LOCK_NB)
except OSError:
    print(f'[{mode}] 另一个增量进程在跑，跳过本次', flush=True)
    sys.exit(0)

c = sqlite3.connect(DB)
if mode == 'hot':
    secids = set()
    for ck in ('prediction_short', 'prediction_swing', 'prediction_long'):
        try:
            for it in ((cache_get(ck) or {}).get('items') or []):
                if it.get('secid'): secids.add(it['secid'])
        except Exception:
            pass
    codes = sorted(secids)
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
_LATEST = {'d': ''}   # 最新交易日（从成功更新的结果里学到）


def work(secid):
    """返回 (结果, 是否本该更新)：
       结果 1=末根日期前进（真更新），0=未前进，-1=异常
       本该更新 = 更新前缓存末根 < 已知最新交易日
    2026-10-12：异常不再静默吞掉——记录样本 + 计数，让管道故障可见。
    2026-10-12 二修：熔断必须区分「已最新的零」（合法，不该熔断）
                     与「该更新却没更新的零」（故障，应熔断）。"""
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
        if done % 500 == 0:
            print(f'  {done}/{len(codes)} elapsed={int(time.time()-t0)}s ok={ok} '
                  f'stale_fail={_stale_fail}', flush=True)
        time.sleep(0.35)  # 限速（2026-08-28 串行+0.35s：5分钟窗口~850次，腾讯ifzq窗口安全阈值）

line = 'INCR_DONE mode=%s ok=%d/%d errors=%d stale_fail=%d elapsed=%ds%s' % (
    mode, ok, len(codes), _err_count, _stale_fail, int(time.time() - t0),
    ' ABORTED(upstream)' if _aborted else '')
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
