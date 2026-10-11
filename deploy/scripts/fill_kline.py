# -*- coding: utf-8 -*-
"""K线补全 v2（凌晨 2:00 cron）：独立全量列表拉取（55页×3重试）→ 缺失的拉取写 Redis+SQLite"""
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
from predict_server import fetch_kline, kline_set, DB, _REDIS, fetch
from concurrent.futures import ThreadPoolExecutor, as_completed
import sqlite3

API_BASE = 'https://push2delay.eastmoney.com/api/qt/clist/get'
FS = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23'
FIELDS = 'f12'

def fetch_all_codes():
    """55 页 × 3 重试（页级防限流漏页）"""
    codes = set()
    for p in range(1, 56):
        got = False
        for _ in range(3):
            try:
                url = f'{API_BASE}?fid=f20&po=1&pz=100&pn={p}&np=1&fltt=2&invt=2&fs={FS}&fields={FIELDS}'
                diff = fetch(url)['data'].get('diff', [])
                if diff:
                    for s in diff:
                        code = s.get('f12', '')
                        if code:
                            codes.add(('1.' if code.startswith(('6', '9')) else '0.') + code)
                    got = True
                    break
            except Exception:
                pass
            time.sleep(0.5)
        if not got:
            print(f'  页{p} 3次重试仍失败（跳过，下次凌晨再补）', flush=True)
        time.sleep(0.15)  # 慢速防限流
    return codes

c = sqlite3.connect(DB)
have = {r[0] for r in c.execute('SELECT secid FROM klines').fetchall()}
c.close()
print(f'已有 {len(have)} 只，拉全市场列表...', flush=True)
all_codes = fetch_all_codes()
need = sorted(all_codes - have)
print(f'全市场 {len(all_codes)} 只 | 待补 {len(need)} 只', flush=True)

t0 = time.time()
done = ok = 0
def work(secid):
    try:
        kl = fetch_kline(secid, fast=True, mem=False)
        if kl and len(kl) >= 5:
            kline_set(secid, kl)
            return 1
    except Exception:
        pass
    return 0

with ThreadPoolExecutor(max_workers=4) as ex:
    futs = {ex.submit(work, c2): c2 for c2 in need}
    for f in as_completed(futs):
        done += 1
        ok += f.result()
        if done % 300 == 0 or done == len(need):
            print(f'{done}/{len(need)} ok={ok} elapsed={int(time.time()-t0)}s', flush=True)

print(f'FILL_DONE ok={ok}/{len(need)} elapsed={int(time.time()-t0)}s', flush=True)
