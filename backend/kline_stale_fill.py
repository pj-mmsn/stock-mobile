# -*- coding: utf-8 -*-
"""定向补刷：只刷末根 < 2026-08-17 的停更票（分批慢速，防腾讯 5min/5000 限流）"""
import sys, os, time, sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import predict_server as ps

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pred.db')
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

BATCH = 50          # 每批并发数
SLEEP = 45          # 批间休息（秒）—— 总量窗口 5min/5000，50 只/45s ≈ 3300/5min 安全
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
