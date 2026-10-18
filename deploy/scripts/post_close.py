#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""盘后流水线 post_close.py —— 让当天数据尽早可用

【为什么要有这个文件】
改造前的时间轴（实测）：
    15:00 收盘 → 15:50 K线刷新 → ⬛3h40m 空白⬛ → 19:30 预测(batch0)
              → 19:40 预测(batch1) → 19:50 预测(swing/long) → 19:55 才完成
    K 线在 15:50 就已经是新的了，但预测要等到 19:30 才用上它 —— 白等 3.7 小时。

改造后：
    15:10 启动 → 行情终值 → 市场任务 → K线全量(30~40min)
              → 新鲜度校验 → 预测(三波) → 复盘   ≈ 16:10 完成
    **当天名单从 19:55 提前到 16:10，早 3 小时 45 分**

【核心设计】
1. 依赖链：K 线不新鲜就**不跑预测**（避免用旧 K 线算出"新"名单）
2. 交易日识别：非交易日直接跳过（节假日不白跑）
3. 重试：K 线失败按 30s/120s/300s 退避重试，直到 deadline
4. 单实例：flock 防重入
5. 全量日志：每一步的开始/结束/耗时/结果都落盘，故障 5 秒可定位

【用法】
    post_close.py                 正常跑（cron 15:10 调用）
    post_close.py --skip-kline    跳过 K 线刷新（手工补跑预测）
    post_close.py --force         忽略"K线是否新鲜"的校验
    post_close.py --only forecast 只跑某一步

【cron】
    10 15 * * 1-5  python post_close.py >> post_close.log 2>&1
"""
import os
import sys
import time
import json
import fcntl
import traceback
import subprocess
from datetime import datetime, date


# ---------- 环境自举（与 run_market_jobs.py 完全一致的做法） ----------
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

VENV_PY = '/opt/stock-mobile/venv/bin/python'
KLINE_SCRIPT = '/opt/stock-mobile/refresh_kline.py'
LOG_FILE = '/opt/stock-mobile/post_close.log'
STATE_FILE = '/opt/stock-mobile/post_close_state.json'
LOCK_FILE = '/opt/stock-mobile/post_close.lock'

KLINE_DEADLINE_HHMM = '16:45'      # K 线必须在这个时间前完成，否则放弃当天预测
KLINE_TIMEOUT = 5400               # 单次 K 线刷新最多 80 分钟
FORECAST_TIMEOUT = 2400            # 单波预测最多 40 分钟
FORECAST_GAP = 3                   # 三波预测之间留 3 秒，给上游接口缓一口气

T0 = time.time()
RUN_ID = datetime.now().strftime('%Y%m%d-%H%M%S')


# ---------- 日志 ----------
def log(msg, echo=True):
    line = '[%s] %s' % (datetime.now().strftime('%H:%M:%S'), msg)
    if echo:
        print(line, flush=True)
    try:
        # 简单轮转：超过 5MB 改名
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > 5 * 1024 * 1024:
            os.rename(LOG_FILE, LOG_FILE + '.1')
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except Exception:
        pass


def elapsed():
    return int(time.time() - T0)


def save_state(**kw):
    try:
        st = {}
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, encoding='utf-8') as f:
                st = json.load(f)
        st.update(kw)
        st['run_id'] = RUN_ID
        st['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        with open(STATE_FILE, 'w', encoding='utf-8') as f:
            json.dump(st, f, ensure_ascii=False, indent=1)
    except Exception:
        pass


# ---------- 交易日历 ----------
HOLIDAY_FILE = '/opt/stock-mobile/trade_holidays.txt'


def is_holiday_today():
    """读节假日列表（每行一个 YYYY-MM-DD，# 开头为注释）。
    为什么需要：cron 是周一到周五，但春节/国庆等节假日会让整条流水线
    空跑 30~40 分钟 K 线刷新。有了这个文件，节假日 1 秒退出。
    维护：每年初把交易所公告的休市日填进去即可。
    """
    today = date.today().strftime('%Y-%m-%d')
    try:
        if not os.path.exists(HOLIDAY_FILE):
            return False, None
        with open(HOLIDAY_FILE, encoding='utf-8') as f:
            for ln in f:
                s = ln.strip()
                if not s or s.startswith('#'):
                    continue
                if s == today:
                    return True, s
    except Exception as e:
        log('读取节假日文件失败: %s' % e)
    return False, None


# ---------- 交易状态判定 ----------
def known_trade_days():
    """从 K 线抽样，返回最近若干条末根日期 -> 用于判断今天是否有交易"""
    from predict_server import _REDIS, kline_get
    seen = {}
    n = 0
    for k in _REDIS.scan_iter('sm:kline:*', count=300):
        ks = k.decode() if isinstance(k, bytes) else k
        sid = ks.split('sm:kline:', 1)[-1]
        kl = kline_get(sid)
        if not kl:
            continue
        last = str(kl[-1].get('t'))[:10]
        seen[last] = seen.get(last, 0) + 1
        n += 1
        if n >= 40:
            break
    return seen


def kline_freshness():
    """返回 (最新日期, 该日期占比, 明细)"""
    seen = known_trade_days()
    total = sum(seen.values()) or 1
    if not seen:
        return None, 0.0, {}
    newest = max(seen)
    return newest, seen[newest] / total, seen


def is_trading_day_today():
    """K 线末根是否已经是今天 —— 判断今天有没有交易"""
    today = date.today().strftime('%Y-%m-%d')
    newest, ratio, seen = kline_freshness()
    return newest == today and ratio >= 0.5, newest, ratio


def minutes_left_until(hhmm):
    now = datetime.now()
    target = now.replace(hour=int(hhmm[:2]), minute=int(hhmm[3:]), second=0, microsecond=0)
    return (target - now).total_seconds() / 60.0


# ---------- 步骤执行器 ----------
STEPS = {}


def step(name):
    def deco(fn):
        STEPS[name] = fn
        return fn
    return deco


def run_step(name, force=False):
    fn = STEPS.get(name)
    if not fn:
        log('✗ 未知步骤 %s' % name)
        return False
    log('── %s 开始 ──' % name)
    t = time.time()
    try:
        ok, note = fn()
        dur = time.time() - t
        if ok:
            log('✓ %s 完成 %ds %s' % (name, int(dur), note or ''))
        else:
            log('✗ %s 失败 %ds %s' % (name, int(dur), note or ''))
        save_state(**{name: {'ok': bool(ok), 'note': note, 'dur': round(dur, 1),
                             'at': datetime.now().strftime('%H:%M:%S')}})
        return ok
    except Exception as e:
        log('✗ %s 异常 %ds: %s' % (name, int(time.time() - t), e))
        log(traceback.format_exc(limit=6))
        save_state(**{name: {'ok': False, 'note': 'exception: %s' % e,
                             'at': datetime.now().strftime('%H:%M:%S')}})
        return False


# ---------- 各步骤 ----------
@step('quotes')
def s_quotes():
    """1. 刷新行情终值（收盘价）"""
    from predict_server import refresh_quotes
    n = refresh_quotes()
    return (n is not None and n > 0), '刷新 %s 只' % n


@step('market')
def s_market():
    """2. 市场任务：涨停池 / 资金流 / 行业 / 超额历史"""
    import predict_server as P
    ok_parts = []
    for fn_name in ('refresh_ztpool', 'refresh_fund', 'refresh_industry', 'refresh_alpha_history'):
        fn = getattr(P, fn_name, None)
        if not fn:
            ok_parts.append('%s:缺失' % fn_name)
            continue
        try:
            t = time.time()
            fn()
            ok_parts.append('%s:%.0fs' % (fn_name.replace('refresh_', ''), time.time() - t))
        except Exception as e:
            ok_parts.append('%s:失败(%s)' % (fn_name.replace('refresh_', ''), str(e)[:30]))
    # 龙虎榜数据源 18:00 后才全，这里尝试一次，失败不算致命
    try:
        P.refresh_lhb()
        ok_parts.append('lhb:ok')
    except Exception as e:
        ok_parts.append('lhb:晚点再跑')
    return True, ' '.join(ok_parts)


@step('kline')
def s_kline():
    """3. K线全量增量，失败按退避重试直到 deadline"""
    delays = [30, 120, 300]
    attempt = 0
    while True:
        attempt += 1
        left = minutes_left_until(KLINE_DEADLINE_HHMM)
        if left <= 2:
            return False, '已到 deadline %s，放弃（第 %d 次尝试）' % (KLINE_DEADLINE_HHMM, attempt)
        log('  K线刷新 第 %d 次尝试（距 deadline %.0f 分钟）' % (attempt, left))
        try:
            t = time.time()
            r = subprocess.run([VENV_PY, KLINE_SCRIPT, 'all'],
                               timeout=min(KLINE_TIMEOUT, max(300, left * 60)),
                               capture_output=True, text=True)
            tail = ''
            for ln in (r.stdout or '').splitlines()[::-1]:
                if 'INCR_DONE' in ln:
                    tail = ln.strip()
                    break
            log('  K线返回 rc=%d %s' % (r.returncode, tail))
            # 验证新鲜度
            newest, ratio, seen = kline_freshness()
            today = date.today().strftime('%Y-%m-%d')
            log('  K线新鲜度: 最新=%s 占比=%.0f%%（今天=%s）' % (newest, ratio * 100, today))
            if newest == today and ratio >= 0.7:
                return True, '第%d次成功 %s 占比%.0f%% %.0fs' % (attempt, newest, ratio * 100, time.time() - t)
            if attempt > len(delays):
                return False, '重试耗尽，最新仅到 %s（占比%.0f%%）' % (newest, ratio * 100)
            wait = delays[min(attempt - 1, len(delays) - 1)]
            wait = min(wait, max(10, (left - 3) * 60 / 2))
            log('  未达标，%d 秒后重试' % int(wait))
            time.sleep(wait)
        except subprocess.TimeoutExpired:
            log('  K线超时')
            if attempt > len(delays):
                return False, '超时且重试耗尽'
            time.sleep(30)
        except Exception as e:
            log('  K线异常: %s' % e)
            if attempt > len(delays):
                return False, '异常重试耗尽: %s' % e
            time.sleep(30)


@step('forecast')
def s_forecast():
    """预测名单（三档）

    ★ 用 batch=None（全量重跑），不用 batch=0/1：
      源码里 batch=0/1 是「并集合并」语义（只增不减），重复跑会累积残留记录；
      batch=None 会先 DELETE 当天该模式旧记录再两批连跑，是幂等的干净重建。
      本地服务器没有 SCF 900s 超时限制，不需要拆批。
    """
    from predict_server import run_morning_forecast, get_user_mode
    um = get_user_mode()
    modes = [um]
    for m in ('swing', 'long'):
        if m not in modes:
            modes.append(m)
    done = []
    for m in modes:
        t = time.time()
        try:
            run_morning_forecast(strip_last=False, mode=m)   # batch=None → 干净重建
            done.append('%s:%.0fs' % (m, time.time() - t))
            log('  预测 %s 完成 %.0fs' % (m, time.time() - t))
        except Exception as e:
            done.append('%s:失败(%s)' % (m, str(e)[:30]))
            log('  预测 %s 失败: %s' % (m, e))
        time.sleep(FORECAST_GAP)
    ok = sum(1 for d in done if '失败' not in d)
    return ok >= len(modes), ' '.join(done)


@step('review')
def s_review():
    """6. 盘后复盘 + 超额"""
    from predict_server import run_evening_review
    run_evening_review()
    return True, 'ok'


@step('mbm')
def s_mbm():
    """7. 麦唛 Q1-Q5"""
    from predict_server import run_mbm_all
    run_mbm_all()
    return True, 'ok'


# ---------- 主流程 ----------
ORDER = ['quotes', 'kline', 'market', 'forecast']


def main():
    args = sys.argv[1:]
    skip_kline = '--skip-kline' in args
    if_needed = '--if-needed' in args
    force = '--force' in args
    only = None
    if '--only' in args:
        i = args.index('--only')
        only = args[i + 1] if i + 1 < len(args) else None

    # 单实例锁
    lock_fh = open(LOCK_FILE, 'w')
    try:
        fcntl.flock(lock_fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        log('另一个 post_close 正在运行，跳过本次')
        return 0

    # --if-needed：今天已经成功跑过就直接退出（19:30 兜底任务用，避免重复计算）
    if if_needed:
        try:
            with open(STATE_FILE, encoding='utf-8') as f:
                st = json.load(f)
            fc = (st.get('forecast') or {})
            same_day = str(st.get('started', ''))[:10] == date.today().strftime('%Y-%m-%d')
            if same_day and fc.get('ok'):
                log('今天已成功跑过（%s 预测 %s），--if-needed 跳过' % (st.get('run_id'), fc.get('at')))
                return 0
        except Exception:
            pass

    log('=' * 70)
    log('盘后流水线启动 run=%s python=%s' % (RUN_ID, sys.version.split()[0]))
    save_state(status='running', started=datetime.now().strftime('%Y-%m-%d %H:%M:%S'))

    # 节假日直接退出（避免白跑 30~40 分钟 K 线）
    # 注意：--only / --force 手工调用时不拦截，方便补跑与测试
    if only is None and not force:
        hol, _ = is_holiday_today()
        if hol:
            log('今天是节假日（见 %s），跳过整条流水线' % HOLIDAY_FILE)
            save_state(status='holiday')
            return 0

        # 周末直接退出（cron 已限定 1-5，双保险）
        if date.today().weekday() >= 5:
            log('今天是周末，跳过')
            save_state(status='weekend')
            return 0

    # 交易日识别：先刷行情，再看 K 线末根
    if only is None and not skip_kline:
        ok = run_step('quotes')
        if not ok:
            log('⚠ 行情刷新失败，继续（不影响后续 K 线判断）')
        trading, newest, ratio = is_trading_day_today()
        if not trading:
            # 再给一次机会：可能是 K 线还没刷到今天的
            log('K线末根=%s 占比=%.0f%% → 暂判非交易日，先刷 K 线再定' % (newest, ratio * 100))
        else:
            log('确认今天是交易日（K线末根 %s 占比 %.0f%%）' % (newest, ratio * 100))

    # 执行顺序
    seq = [s for s in ORDER if s != 'quotes']
    if skip_kline:
        seq = [s for s in seq if s != 'kline']
    if only:
        seq = [only] if only in ORDER else []

    for name in seq:
        if name in ('forecast', 'review', 'mbm') and not force and 'kline' in ORDER:
            newest, ratio, _ = kline_freshness()
            today = date.today().strftime('%Y-%m-%d')
            if newest != today:
                log('✗ 跳过 %s：K线末根=%s 不是今天（今天=%s）。如需强制请加 --force' % (name, newest, today))
                save_state(status='aborted_stale_kline', kline_newest=newest)
                return 2
        run_step(name)

    total = elapsed()
    log('盘后流水线结束 用时 %ds' % total)
    save_state(status='done', total_s=total)
    log('=' * 70)
    return 0


if __name__ == '__main__':
    sys.exit(main())
