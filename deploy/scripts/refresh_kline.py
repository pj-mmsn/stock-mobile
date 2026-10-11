# -*- coding: utf-8 -*-
"""K线增量更新（15:05 收盘 + 11:30 午休 + 盘中热股）：已有缓存 → 只拉当天新根 append。
降速：串行 + 0.35s 间隔（全量 5496 只 ≈ 33 分钟——5分钟窗口~850次，低于腾讯ifzq窗口阈值；并发2+0.25s(5min~2400次)曾触发501全灭）"""
import sys, os, time
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
from predict_server import _kline_incremental, DB, cache_get
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
        except Exception: pass
    codes = sorted(secids)
else:
    codes = [r[0] for r in c.execute('SELECT secid FROM klines').fetchall()]
c.close()
if seg_start or seg_end:
    codes = codes[seg_start:seg_end if seg_end else len(codes)]
print(f'[{mode}] {len(codes)} 只增量（限速串行）...', flush=True)

t0 = time.time()
done = ok = 0
def work(secid):
    # ok = 数据真更新（末根日期前进），旧缓存兜底不算成功——防假成功掩盖管道故障
    try:
        old = kline_get(secid)
        old_last = old[-1]['t'] if old else ''
        kl = _kline_incremental(secid)
        if not kl:
            return 0
        return 1 if kl[-1]['t'] > old_last else 0
    except Exception:
        return 0

with ThreadPoolExecutor(max_workers=1) as ex:
    futs = [ex.submit(work, c2) for c2 in codes]
    for f in as_completed(futs):
        done += 1
        if f.result():
            ok += 1
        if done % 500 == 0:
            print(f'  {done}/{len(codes)} elapsed={int(time.time()-t0)}s', flush=True)
        time.sleep(0.35)  # 限速（2026-08-28 串行+0.35s：5分钟窗口~850次，腾讯ifzq窗口安全阈值）

print(f'INCR_DONE mode={mode} ok={ok}/{len(codes)} elapsed={int(time.time()-t0)}s', flush=True)
