# -*- coding: utf-8 -*-
"""全市场 RSI 索引：quick_scan 列表 → 算 rsi6/rsi14 → Redis hash sm:rsi（含名称/价格——rsi-scan 纯 Redis 秒回）"""
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
from predict_server import _kline_rsi, quick_scan, _REDIS
import json

t0 = time.time()
items, total = quick_scan(55, mode='swing')
mapping = {}
none = 0
for it in items:
    secid = it.get('secid')
    if not secid:
        continue
    code = secid.split('.')[-1]
    r6, r14 = _kline_rsi(secid)
    if r14 is None:
        none += 1
        continue
    mapping[code] = {
        'rsi6': r6, 'rsi14': r14,
        'name': it.get('name'),
        'price': it.get('price'),
        'change_pct': it.get('change_pct'),
        'board': (it.get('board') or {}).get('board'),
    }
if _REDIS is not None and mapping:
    _REDIS.delete('sm:rsi')
    _REDIS.hset('sm:rsi', mapping={k: json.dumps(v, ensure_ascii=False) for k, v in mapping.items()})
    print(f'[RSI INDEX] {len(mapping)} 只入索引（含名称/价格） | 无RSI {none} | 耗时 {time.time()-t0:.0f}s', flush=True)
