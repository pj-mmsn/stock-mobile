# -*- coding: utf-8 -*-
"""
麦麦少年 · K线全市场刷新脚本
========================================
把 klines 表全市场刷新到最新（复用 _kline_incremental：有缓存增量 append，无缓存全量）。
用途：① 存档回测/回放引擎需要最新K线 ② 可挂 cron 每天收盘后跑（K线保活）。

用法：python kline_refresh.py [--limit N] [--workers 8]
"""
import sys, os, time, argparse, sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import predict_server as ps

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pred.db')


def refresh_one(secid):
    try:
        kl = ps._kline_incremental(secid)
        if not kl:
            return (secid, 'FAIL', None)
        return (secid, 'OK', kl[-1].get('t'))
    except Exception as e:
        return (secid, 'ERR:' + str(e)[:60], None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--workers', type=int, default=8)
    ap.add_argument('--batch', type=int, default=100, help='并发批大小（腾讯限流安全窗口）')
    args = ap.parse_args()

    with sqlite3.connect(DB) as c:
        secids = [r[0] for r in c.execute('SELECT secid FROM klines ORDER BY secid')]
    if args.limit:
        secids = secids[:args.limit]
    print(f'[KREF] 开始刷新 {len(secids)} 只...')
    t0 = time.time()
    ok = fail = 0
    newest = {}
    for b in range(0, len(secids), args.batch):
        batch = secids[b:b + args.batch]
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futs = {ex.submit(refresh_one, s): s for s in batch}
            for f in as_completed(futs):
                s, st, last = f.result()
                if st == 'OK':
                    ok += 1
                    newest[last] = newest.get(last, 0) + 1
                else:
                    fail += 1
                    if fail <= 5:
                        print(f'[KREF] {s}: {st}')
        print(f'[KREF] {min(b+args.batch, len(secids))}/{len(secids)} 只, 成功{ok} 失败{fail}, {time.time()-t0:.0f}s')
    print(f'[KREF] 完成: 成功{ok} 失败{fail} 耗时{time.time()-t0:.0f}s')
    print('[KREF] 末根日期分布:', dict(sorted(newest.items(), reverse=True)[:5]))


if __name__ == '__main__':
    main()
