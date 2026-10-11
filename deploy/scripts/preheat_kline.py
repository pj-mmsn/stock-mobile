# -*- coding: utf-8 -*-
"""全市场 K线全量预热：quick_scan 拿列表 → 12并发拉全量(腾讯分页) → kline_set(Redis+SQLite)"""
import sys, time
sys.path.insert(0, '/opt/stock-mobile/backend')
from predict_server import quick_scan, fetch_kline, kline_set, _REDIS
from concurrent.futures import ThreadPoolExecutor, as_completed

t0 = time.time()
print('拉取全市场列表...', flush=True)
items, total = quick_scan(55)
codes = [i['secid'] for i in items if i.get('secid')]
print(f'列表: {len(codes)} 只（东财总数 {total}），耗时 {int(time.time()-t0)}s', flush=True)
print('Redis 连接:', 'OK' if _REDIS is not None else 'FAIL', flush=True)

done = ok = fail = 0
def work(secid):
    try:
        kl = fetch_kline(secid, fast=True, mem=False)  # mem=False 防内存累积
        if kl and len(kl) >= 5:
            kline_set(secid, kl)
            return len(kl)
    except Exception:
        pass
    return 0

with ThreadPoolExecutor(max_workers=12) as ex:
    futs = {ex.submit(work, c): c for c in codes}
    for f in as_completed(futs):
        n = f.result()
        done += 1
        if n: ok += 1
        else: fail += 1
        if done % 500 == 0 or done == len(codes):
            el = int(time.time() - t0)
            print(f'{done}/{len(codes)} 成功{ok} 失败{fail} 耗时{el}s', flush=True)

print(f'PREHEAT_DONE ok={ok} total={len(codes)} elapsed={int(time.time()-t0)}s', flush=True)
