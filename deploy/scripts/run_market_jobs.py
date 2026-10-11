# -*- coding: utf-8 -*-
import sys, os
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
from predict_server import refresh_ztpool, refresh_fund, refresh_lhb
mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
if mode in ('ztpool', 'all'):
    refresh_ztpool()
if mode in ('fund', 'all'):
    refresh_fund()
if mode in ('lhb', 'all'):
    refresh_lhb()
print('[MARKET JOBS]', mode, 'done', flush=True)
