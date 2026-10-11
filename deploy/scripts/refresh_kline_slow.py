# -*- coding: utf-8 -*-
"""限速 K 线增量刷新: 找出末根 < 8-27 的股票, 限速刷新 (150ms/只, 防腾讯限流)"""
import sys, time, json
sys.path.insert(0, '/opt/stock-mobile/backend')
import predict_server as ps

TARGET = '2026-08-27'  # 末根 K 线早于该日期的需要补

# 1. 收集所有 secid
c = ps.sqlite3.connect(ps.DB)
secids = [r[0] for r in c.execute('SELECT secid FROM klines').fetchall()]
c.close()
print(f'总股票: {len(secids)}', flush=True)

# 2. 找滞后的
stale = []
for i, secid in enumerate(secids):
    kl = ps.kline_get(secid)
    if kl and kl[-1]['t'] < TARGET:
        stale.append(secid)
    if i % 1000 == 0:
        print(f'扫描 {i}/{len(secids)} 滞后 {len(stale)}', flush=True)
print(f'滞后股票: {len(stale)}', flush=True)

# 3. 限速刷新 (150ms/只)
ok = 0
t0 = time.time()
for i, secid in enumerate(stale):
    try:
        kl = ps._kline_incremental(secid)
        if kl and kl[-1]['t'] >= TARGET:
            ok += 1
    except Exception:
        pass
    time.sleep(0.15)  # 限速: ~6.7只/秒, 5分钟≈2000只, 不会触发总量限流
    if (i+1) % 500 == 0:
        print(f'刷新 {i+1}/{len(stale)} ok={ok} elapsed={int(time.time()-t0)}s', flush=True)
print(f'DONE ok={ok}/{len(stale)} elapsed={int(time.time()-t0)}s', flush=True)
