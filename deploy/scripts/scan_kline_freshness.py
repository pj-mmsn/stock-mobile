# -*- coding: utf-8 -*-
"""只读：全量扫描 Redis K线末根日期分布（不抽样）
自包含取 REDIS_URL：环境变量 → /etc/stock-mobile.env，不依赖调用方 source"""
import os
import gzip
import json
import collections

if not os.environ.get('REDIS_URL'):
    try:
        with open('/etc/stock-mobile.env', encoding='utf-8') as _f:
            for _ln in _f:
                if _ln.strip().startswith('REDIS_URL='):
                    _v = _ln.strip().split('=', 1)[1].strip().strip('"').strip("'")
                    if _v:
                        os.environ['REDIS_URL'] = _v
                    break
    except Exception:
        pass

import redis as R

r = R.Redis.from_url(os.environ["REDIS_URL"], decode_responses=False)
keys = list(r.scan_iter("sm:kline:*", count=1000))
print("sm:kline:* 总键数 =", len(keys))
last = collections.Counter()
bad = 0
for k in keys:
    raw = r.get(k)
    if not raw:
        last["<空>"] += 1
        continue
    try:
        t = gzip.decompress(raw).decode("utf-8", "ignore")
    except Exception:
        t = raw.decode("utf-8", "ignore")
    try:
        a = json.loads(t)
        last[str(a[-1][0])[:10] if a else "<空数组>"] += 1
    except Exception:
        bad += 1
        last["<解析失败>"] += 1

print("\n=== 末根日期分布 ===")
for d, n in last.most_common(15):
    print("  %-12s %5d  (%.1f%%)" % (d, n, n * 100.0 / len(keys)))
print("\n解析失败 =", bad)
