# -*- coding: utf-8 -*-
"""新浪零星补刷：hot池（预测池）优先，1s间隔不触发批量限制，增量append 8-28
用法: python sina_sparse_refresh.py [start] [end]   # 默认全量；可传区间
"""
import sys, os, time, json, sqlite3, urllib.request
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
from predict_server import DB, kline_get, kline_set, cache_get, _f

import fcntl
_lock_f = open('/tmp/refresh_kline.lock', 'w')
try:
    fcntl.flock(_lock_f, fcntl.LOCK_EX | fcntl.LOCK_NB)
except OSError:
    print('[sina] 另一个增量进程在跑，跳过本次', flush=True)
    sys.exit(0)

def sina_kline(secid):
    """新浪日K：250根，增量 append 用（只取新根，禁止覆盖全量）"""
    market, code = secid.split('.')
    prefix = 'sh' if market == '1' else 'sz'
    url = f'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol={prefix}{code}&scale=240&ma=no&datalen=250'
    req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0', 'Referer': 'https://finance.sina.com.cn/'})
    d = json.loads(urllib.request.urlopen(req, timeout=8).read())
    if not d or len(d) < 5:
        return []
    out = []
    is688 = code.startswith(('688', '689'))
    for r in d:
        try:
            vol = _f(r['volume'])
            if not is688:
                vol = vol / 100.0  # 新浪量=股 → 对齐手口径（688 腾讯本来就是股）
            out.append({'t': r['day'], 'o': _f(r['open']), 'c': _f(r['close']),
                        'h': _f(r['high']), 'l': _f(r['low']), 'v': vol})
        except Exception:
            continue
    return out

def work(secid):
    try:
        cached = kline_get(secid)
        if not cached or len(cached) < 5:
            return 0
        kl = sina_kline(secid)
        if not kl:
            return 0
        last_date = cached[-1]['t']
        new_roots = [k for k in kl if k['t'] > last_date]
        if not new_roots:
            return 0
        merged = cached + new_roots
        kline_set(secid, merged)
        return 1
    except Exception:
        return 0

# hot 池 = prediction 三档合并去重
secids = set()
for ck in ('prediction_short', 'prediction_swing', 'prediction_long'):
    try:
        for it in ((cache_get(ck) or {}).get('items') or []):
            if it.get('secid'):
                secids.add(it['secid'])
    except Exception:
        pass
if not secids:
    c = sqlite3.connect(DB)
    secids = set(r[0] for r in c.execute('SELECT secid FROM klines').fetchall())
    c.close()
codes = sorted(secids)

# 区间参数
seg_start = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 0
seg_end = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 0
if seg_start or seg_end:
    codes = codes[seg_start:seg_end if seg_end else len(codes)]

print(f'[sina] {len(codes)} 只零星补刷（1s间隔）...', flush=True)
t0 = time.time()
done = ok = 0
for secid in codes:
    done += 1
    ok += work(secid)
    if done % 300 == 0:
        print(f'  {done}/{len(codes)} ok={ok} elapsed={int(time.time()-t0)}s', flush=True)
    time.sleep(1.0)
print(f'SINA_DONE ok={ok}/{len(codes)} elapsed={int(time.time()-t0)}s', flush=True)
