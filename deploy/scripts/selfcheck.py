#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""stock-mobile 部署自检脚本 —— 一键检查服务/Redis/预测/列表/前端版本
用法: sudo -u ubuntu /opt/stock-mobile/venv/bin/python /opt/stock-mobile/selfcheck.py
"""
import os, sys, json, re, urllib.request

def _read_env_file(path, key):
    """从 /etc/stock-mobile.env 读取（自检脚本自身也必须自举——否则连不上带密码的 Redis）"""
    try:
        with open(path, encoding='utf-8') as f:
            for ln in f:
                ln = ln.strip()
                if ln.startswith(key + '='):
                    v = ln.split('=', 1)[1].strip().strip('"').strip("'")
                    if v:
                        return v
    except Exception:
        pass
    return None


# ★ 2026-10-14 修复：原实现只读 os.environ，而 cron/手工执行时并没有 source env 文件
#   → REDIS_URL 退回无密码的默认值 → **自检一直报 `HELLO must be called ... authenticated`**，
#   Redis 相关的全部检查（含 sm:rsi 等）从未真正生效 —— 健康检查自己坏了。
REDIS_URL = (os.environ.get('REDIS_URL')
             or _read_env_file('/etc/stock-mobile.env', 'REDIS_URL')
             or 'redis://127.0.0.1:6379/0')
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

    # ===== 2026-10-14 新增：新数据资产 + **新鲜度**（防"静默陈旧"）=====
    # 体积够只证明"曾经写入过"；任务停摆时数据不会过期，必须同时看时间戳。
    import time as _t
    import datetime as _dt

    n_ind = r.hlen('sm:industry')
    check('sm:industry', n_ind >= 4000, '%d 条' % n_ind)

    lhb_raw = r.get('sm:lhb')
    if lhb_raw:
        try:
            _l = json.loads(lhb_raw)
            check('sm:lhb(龙虎榜)', len(_l.get('items') or []) > 0,
                  '%s %d 只' % (_l.get('date'), len(_l.get('items') or [])))
        except Exception:
            check('sm:lhb(龙虎榜)', False, '解析失败')
    else:
        check('sm:lhb(龙虎榜)', False, '无数据（该 tab 会空白）')

    sw_raw = r.get('sm:signal_weights')
    if sw_raw:
        try:
            _w = json.loads(sw_raw)
            _age = (_t.time() - (_w.get('fit_ts') or 0)) / 86400.0
            check('sm:signal_weights', (_w.get('days') or 0) >= 5,
                  '拟合 %s 天, %.1f 天前' % (_w.get('days'), _age))
        except Exception:
            check('sm:signal_weights', False, '解析失败')
    else:
        check('sm:signal_weights', False, '无数据（排序退化为旧 score）')

    try:
        nb = len(list(r.scan_iter('sm:breadth:*')))
        check('sm:breadth 缓存', nb >= 1, '%d 个交易日' % nb)
    except Exception:
        check('sm:breadth 缓存', False, '扫描失败')

    try:
        import gzip as _gz
        _last = None
        for _k in list(r.scan_iter('sm:kline:*', count=300))[:300]:
            _v = r.get(_k)
            if not _v:
                continue
            try:
                _txt = _gz.decompress(_v).decode('utf-8', 'ignore')
            except Exception:
                _txt = _v.decode('utf-8', 'ignore')
            try:
                _a = json.loads(_txt)
                _d0 = str(_a[-1][0])[:10] if _a else ''
                if _d0 and (_last is None or _d0 > _last):
                    _last = _d0
            except Exception:
                continue
        _today = _dt.datetime.now(_dt.timezone(_dt.timedelta(hours=8))).strftime('%Y-%m-%d')
        _lag = (_dt.date.fromisoformat(_today) - _dt.date.fromisoformat(_last)).days if _last else None
        check('K线末根日期', _lag is not None and _lag <= 4, '末根 %s（距今 %s 天）' % (_last, _lag))
    except Exception as e:
        check('K线末根日期', False, str(e)[:60])

    # 卡死的定时任务进程（与 2026-10 的 61 个僵尸进程同一类问题）
    try:
        import subprocess as _sp
        _out = _sp.run(['ps', '-eo', 'etimes,cmd'], capture_output=True, text=True).stdout
        _hung = 0
        for _ln in _out.splitlines()[1:]:
            _p = _ln.strip().split(None, 1)
            if len(_p) < 2:
                continue
            try:
                _e = int(_p[0])
            except Exception:
                continue
            # 排除常驻服务：gunicorn worker 天然长期运行（do_select 等连接是正常态），
            # 只有**批处理脚本**超时才叫卡死（2026-10 曾出现 61 个僵尸 + 1 个 rsi 卡死 5 天）
            if ('gunicorn' in _p[1]) or ('predict_server:app' in _p[1]):
                continue
            if _e > 7200 and ('/opt/stock-mobile/' in _p[1]) and ('venv/bin/python' in _p[1]):
                _hung += 1
                print('      卡死嫌疑: PID 已运行 %ss -> %s' % (_e, _p[1][:90]))
        check('无卡死任务进程', _hung == 0, '%d 个运行超 2 小时的脚本进程' % _hung)
    except Exception as e:
        check('无卡死任务进程', False, str(e)[:50])

    zt = r.get('sm:ztpool')
    zt_ok = bool(zt)
    zt_detail = ''
    if zt:
        try:
            zt_detail = '%d 只' % len(json.loads(zt).get('items', []))
        except Exception:
            zt_detail = '有数据(解析失败)'
    else:
        # ★ sm:ztpool TTL=2h 且 cron 只跑 9-15 → **夜间必然过期**，属正常；
        #   前端 /api/zt-pool 未命中会现场重建（实测 <1s）。只在交易时段判 FAIL。
        import datetime as _dtz
        _nz = _dtz.datetime.now(_dtz.timezone(_dtz.timedelta(hours=8)))
        _intz = _nz.weekday() < 5 and (9 * 60 + 15) <= (_nz.hour * 60 + _nz.minute) <= (15 * 60 + 5)
        zt_ok = not _intz
        zt_detail = '夜间已过期（正常，访问时自动重建）' if not _intz else '交易时段无数据！'
    check('涨停池', zt_ok, zt_detail)
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
