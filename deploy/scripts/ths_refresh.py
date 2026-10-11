# -*- coding: utf-8 -*-
"""同花顺 K线全量补刷：增量 append（同花顺 last.js 140根，0.3s间隔，全量 ~37 分钟）
腾讯窗口被打爆冷却期的救急源；只 append 新根，不覆盖历史"""
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
from predict_server import DB, kline_get, kline_set, _f

import fcntl
_lock_f = open('/tmp/refresh_kline.lock', 'w')
try:
    fcntl.flock(_lock_f, fcntl.LOCK_EX | fcntl.LOCK_NB)
except OSError:
    print('[ths] 另一个增量进程在跑，跳过本次', flush=True)
    sys.exit(0)

def ths_kline(secid):
    """同花顺 last.js：返回 [{t,o,h,l,c,v}] 日期正序，v=手（非688 ÷100）"""
    code = secid.split('.')[1]
    url = f'https://d.10jqka.com.cn/v6/line/hs_{code}/01/last.js'
    req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0', 'Referer': 'https://www.10jqka.com.cn/'})
    raw = urllib.request.urlopen(req, timeout=8).read().decode('utf-8', 'ignore')
    s = raw[raw.find('{'):raw.rfind('}')+1]
    d = json.loads(s)
    data = d.get('data')
    if not data:
        return []
    out = []
    is688 = code.startswith(('688', '689'))
    for part in data.split(';'):
        f = part.split(',')
        if len(f) < 6 or not f[0].isdigit():
            continue
        try:
            vol = float(f[5])
            if not is688:
                vol = vol / 100.0  # 同花顺量=股 → 对齐缓存手口径（688 腾讯本来就是股）
            out.append({'t': f'{f[0][:4]}-{f[0][4:6]}-{f[0][6:]}',
                        'o': _f(f[1]), 'h': _f(f[2]), 'l': _f(f[3]), 'c': _f(f[4]),
                        'v': vol})
        except Exception:
            continue
    return out

def work(secid):
    try:
        cached = kline_get(secid)
        if not cached or len(cached) < 5:
            return 0  # 无缓存不处理（同花顺只有140根，不能当全量）
        kl = ths_kline(secid)
        if not kl:
            return 0
        last_date = cached[-1]['t']
        new = [k for k in kl if k['t'] > last_date]
        if not new:
            return 0
        merged = cached + new
        kline_set(secid, merged)
        return 1
    except Exception:
        return 0

c = sqlite3.connect(DB)
codes = [r[0] for r in c.execute('SELECT secid FROM klines').fetchall()]
c.close()
print(f'[ths] {len(codes)} 只全量补刷（0.3s间隔）...', flush=True)

t0 = time.time()
done = ok = 0
for secid in codes:
    done += 1
    r = work(secid)
    ok += r
    if done % 500 == 0:
        print(f'  {done}/{len(codes)} ok={ok} elapsed={int(time.time()-t0)}s', flush=True)
    time.sleep(0.3)

print(f'THS_DONE ok={ok}/{len(codes)} elapsed={int(time.time()-t0)}s', flush=True)
