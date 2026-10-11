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
sys.path.insert(0, '/opt/stock-mobile/backend')
from predict_server import run_morning_forecast, get_user_mode
run_morning_forecast(strip_last=False, mode=get_user_mode())
print('[MORNING RERUN] done', flush=True)
