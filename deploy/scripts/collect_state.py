# -*- coding: utf-8 -*-
"""状态采集：内存/AOF/预测数量/分时TTL/自选/备份/proxy白名单/cron——供系统审查"""
import sys, os, json
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
from predict_server import _REDIS, cache_get

out = {}

# 1. 内存
with open('/proc/meminfo') as f:
    mem = {}
    for line in f:
        k, v = line.split(':')
        mem[k.strip()] = int(v.split()[0])
out['mem_total_mb'] = mem.get('MemTotal', 0) // 1024
out['mem_avail_mb'] = mem.get('MemAvailable', 0) // 1024
out['swap_total_mb'] = mem.get('SwapTotal', 0) // 1024
out['swap_free_mb'] = mem.get('SwapFree', 0) // 1024

# 2. Redis
info = _REDIS.info()
out['redis_used_mb'] = round(info['used_memory'] / 1024 / 1024)
out['redis_max_mb'] = round(info['maxmemory'] / 1024 / 1024)
out['redis_evicted'] = info['evicted_keys']
out['redis_aof_enabled'] = info.get('aof_enabled')
out['redis_aof_current_size_mb'] = round(info.get('aof_current_size', 0) / 1024 / 1024)
out['redis_rdb_last_save'] = info.get('rdb_last_save_time')

# 3. 预测数量（301 vs 379）
for ck in ('prediction_short', 'prediction_swing', 'prediction_long'):
    c = cache_get(ck) or {}
    out['pred_' + ck] = len(c.get('items') or [])

# 4. 分时缓存 TTL
for secid in ('0.300502', '1.600572'):
    out['trends_ttl_' + secid] = _REDIS.ttl('sm:trends:' + secid)

# 5. 快照
out['quotes_count'] = _REDIS.hlen('sm:quotes')

# 6. K线缓存统计
keys = _REDIS.keys('sm:kline:*')
out['kline_keys'] = len(keys)

# 7. 自选（watchlist）
try:
    wl = cache_get('watchlist') or {}
    out['watchlist_redis'] = len(wl.get('codes') or wl.get('items') or []) if isinstance(wl, dict) else '?'
except Exception as e:
    out['watchlist_redis'] = 'ERR ' + str(e)[:50]

print(json.dumps(out, ensure_ascii=False, indent=1))
