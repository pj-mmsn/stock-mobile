#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""stock-mobile 部署自检脚本 —— 一键检查服务/Redis/预测/列表/前端版本
用法: sudo -u ubuntu /opt/stock-mobile/venv/bin/python /opt/stock-mobile/selfcheck.py
"""
import os, sys, json, re, urllib.request

REDIS_URL = os.environ.get('REDIS_URL') or 'redis://127.0.0.1:6379/0'
API = 'http://127.0.0.1:8000'

def check(name, ok, detail=''):
    mark = 'OK ' if ok else 'FAIL'
    print(f'[{mark}] {name}' + (f' - {detail}' if detail else ''))

def http_get(path):
    try:
        with urllib.request.urlopen(API + path, timeout=10) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except Exception as e:
        return 0, str(e)

# 1. Redis 存活
try:
    import redis
    r = redis.Redis.from_url(REDIS_URL)
    pong = r.ping()
    check('Redis 存活', pong)
    n_quotes = r.hlen('sm:quotes')
    n_fund = r.hlen('sm:fund')
    n_rsi = r.hlen('sm:rsi')
    ttl_quotes = r.ttl('sm:quotes')
    check('sm:quotes', n_quotes >= 5000, '%d 条, TTL %ss' % (n_quotes, ttl_quotes))
    check('sm:fund', n_fund >= 5000, '%d 条' % n_fund)
    check('sm:rsi', n_rsi > 2000, '%d 条' % n_rsi)
    zt = r.get('sm:ztpool')
    if zt:
        try:
            zt_n = len(json.loads(zt).get('items', []))
            check('涨停池', True, '%d 只' % zt_n)
        except Exception:
            check('涨停池', True, '有数据(解析失败)')
    else:
        check('涨停池', False, '无数据')
except Exception as e:
    check('Redis 存活', False, str(e))

# 2. 后端 API
st, body = http_get('/api/ping')
check('后端 /api/ping', st == 200, body[:50] if st != 200 else 'OK')

st, body = http_get('/api/list?pn=1&pz=1')
if st == 200:
    try:
        total = json.loads(body).get('total', 0)
        check('/api/list', total >= 5000, 'total=%d' % total)
    except Exception:
        check('/api/list', False, '解析失败')
else:
    check('/api/list', False, body[:80])

st, body = http_get('/api/predict?mode=swing')
if st == 200:
    try:
        n = len(json.loads(body).get('items', []))
        check('预测(swing)', n > 500, '%d 只' % n)
    except Exception:
        check('预测(swing)', False, '解析失败')
else:
    check('预测(swing)', False, body[:80])

# 3. 前端版本
try:
    with open('/var/www/stock-mobile/index.html') as f:
        html = f.read()
    m = re.search(r'src="\./assets/', html)
    check('前端相对路径(应无匹配)', m is None, '有相对路径=需执行 sed 修复' if m else 'OK')
    m2 = re.search(r'index-[A-Za-z0-9_-]+\.js', html)
    check('前端 JS 入口', m2 is not None, m2.group(0) if m2 else '未找到')
except Exception as e:
    check('前端文件', False, str(e))

print('')
print('自检完成')
