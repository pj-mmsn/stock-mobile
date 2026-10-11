# -*- coding: utf-8 -*-
"""只处理「落后于最新交易日」的 K 线 —— 先快速分类，再只补落后的。
2026-10-12 新增：腾讯 501 封禁时降级源很慢（每只 1-3s），
必须避免对已最新的股票做无用请求（否则 5500 只 × 1.5s ≈ 2.3 小时）。"""
import sys
import os
import gzip
import json
import time
import collections

sys.path.insert(0, '/opt/stock-mobile/backend')
from predict_server import _REDIS, kline_get, _kline_incremental, DB

t0 = time.time()

# ---------- 1) 快速分类 ----------
keys = list(_REDIS.scan_iter('sm:kline:*', count=1000))
rows = []
for k in keys:
    ks = k.decode() if isinstance(k, bytes) else k
    sid = ks.split('sm:kline:', 1)[-1]
    raw = _REDIS.get(k)
    if not raw:
        continue
    try:
        txt = gzip.decompress(raw).decode('utf-8', 'ignore')
    except Exception:
        txt = raw.decode('utf-8', 'ignore')
    try:
        a = json.loads(txt)
        last = str(a[-1][0])[:10] if a else ''
    except Exception:
        last = ''
    rows.append((sid, last))

# 最新交易日 = 出现最多的那个「近期」日期（取众数里最大的）
cnt = collections.Counter(d for _, d in rows if d >= '2026-09-01')
LATEST = max(cnt, key=lambda d: (cnt[d], d)) if cnt else ''
print("总键数 = %d" % len(rows))
print("判定最新交易日 = %s（%d 只，占 %.1f%%）" % (LATEST, cnt.get(LATEST, 0),
                                       cnt.get(LATEST, 0) * 100.0 / max(1, len(rows))))
print("分类耗时 %.0fs" % (time.time() - t0))

stale = [sid for sid, d in rows if not d or d < LATEST]
print("落后待补 = %d 只" % len(stale))

if not stale:
    print("无需补刷")
    sys.exit(0)

# 按 secid 排序，便于分段观察
stale.sort()

# ---------- 2) 只补落后的 ----------
ok = noadv = err = 0
t1 = time.time()
for i, sid in enumerate(stale, 1):
    try:
        old = kline_get(sid)
        old_last = old[-1]['t'] if old else ''
        kl = _kline_incremental(sid)
        new_last = kl[-1]['t'] if kl else ''
        if (new_last or '') > (old_last or ''):
            ok += 1
        else:
            noadv += 1
    except Exception as e:
        err += 1
        if err <= 5:
            print("  EXC %s: %r" % (sid, e))
    if i % 100 == 0:
        print("  %d/%d  ok=%d noadv=%d err=%d  已用 %.0fs" % (
            i, len(stale), ok, noadv, err, time.time() - t1), flush=True)
    time.sleep(0.15)   # 降级源友好间隔

print()
print("STALE_DONE ok=%d noadv=%d err=%d / %d  耗时 %.0fs" % (
    ok, noadv, err, len(stale), time.time() - t1))

# ---------- 3) 复核 ----------
rows2 = []
for k in _REDIS.scan_iter('sm:kline:*', count=1000):
    ks = k.decode() if isinstance(k, bytes) else k
    sid = ks.split('sm:kline:', 1)[-1]
    raw = _REDIS.get(k)
    if not raw:
        continue
    try:
        txt = gzip.decompress(raw).decode('utf-8', 'ignore')
    except Exception:
        txt = raw.decode('utf-8', 'ignore')
    try:
        a = json.loads(txt)
        rows2.append(str(a[-1][0])[:10] if a else '')
    except Exception:
        rows2.append('')
c2 = collections.Counter(rows2)
print()
print("=== 补刷后末根分布（前 8）===")
for d, n in c2.most_common(8):
    print("  %-12s %5d  (%.1f%%)" % (d, n, n * 100.0 / len(rows2)))
