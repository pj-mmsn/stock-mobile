# -*- coding: utf-8 -*-
"""定向补刷：只刷末根 < 2026-08-17 的停更票（分批慢速，防腾讯 5min/5000 限流）"""
import sys, os, time, sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed

# ⚠️ 必须最先设置：predict_server 的 DB 会被 git-bash /tmp 映射劫持（写错库）
_BASE = os.path.dirname(os.path.abspath(__file__))
os.environ['PRED_DB'] = os.path.join(_BASE, 'pred.db')

sys.path.insert(0, _BASE)
import predict_server as ps

DB = os.path.join(_BASE, 'pred.db')
CUTOFF = '2026-08-17'

with sqlite3.connect(DB) as c:
    rows = c.execute('SELECT secid, data FROM klines').fetchall()

stale = []
for secid, data in rows:
    try:
        kl = ps._kline_decode(data)
        if kl and kl[-1].get('t', '') < CUTOFF:
            stale.append(secid)
    except Exception:
        stale.append(secid)

print(f'[STALE] 停更票 {len(stale)} 只（末根 < {CUTOFF}）')
if not stale:
    print('[STALE] 无需补刷')
    sys.exit(0)

BATCH = 25          # 每批并发数（保守——50 曾触发 5min/5000 总量限流）
SLEEP = 60          # 批间休息（秒）—— 25 只/60s ≈ 1250/5min，安全线内
ok = fail = 0
t0 = time.time()
for b in range(0, len(stale), BATCH):
    batch = stale[b:b + BATCH]
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(ps._kline_incremental, s): s for s in batch}
        for f in as_completed(futs):
            secid = futs[f]
            try:
                kl = f.result()
                if kl:
                    ps.kline_set(secid, kl)  # 写回 SQLite + Redis
                    ok += 1
                else:
                    fail += 1
            except Exception as e:
                fail += 1
                print(f'  {secid}: {str(e)[:50]}')
    done = min(b + BATCH, len(stale))
    print(f'[STALE] {done}/{len(stale)} 成功{ok} 失败{fail} {time.time()-t0:.0f}s', flush=True)
    if b + BATCH < len(stale):
        time.sleep(SLEEP)

print(f'[STALE] 完成: 成功{ok} 失败{fail} 耗时{(time.time()-t0)/60:.1f}min')
