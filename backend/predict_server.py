"""
股票预测后端 v5 — 入场止损仓位 + 市场温度 + 关注优先
"""
import json, time, sqlite3, threading, os, urllib.request, gzip
import numpy as np
from datetime import datetime, timezone, timedelta

_CST = timezone(timedelta(hours=8))  # 北京时间（Render 服务器是 UTC，必须显式转）
def now_cst():
    """当前北京时间（所有用户可见时间/日期判断都用它）"""
    return datetime.now(_CST)
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
# SCF 环境（腾讯云函数）无持久磁盘 → 用 /tmp（数据源国内快，即拉即用）；Render 用本地
# 服务器部署：PRED_DB 环境变量指定持久路径（/var/lib/stock-mobile/pred.db）
DB = os.environ.get('PRED_DB') or ('/tmp/pred.db' if os.path.exists('/tmp') else os.path.join(os.path.dirname(__file__), 'pred.db'))
# SCF 环境检测：os.path.exists('/tmp') 在 SCF 上不可靠（曾返回 False → 线程分支被冻结）
# 用 SCF 平台注入的环境变量（SCF_RUNTIME / TENCENTCLOUD_RUNENV），双保险
IS_SCF = (os.environ.get('SCF_RUNTIME') is not None
          or os.environ.get('TENCENTCLOUD_RUNENV') == 'SCF'
          or os.path.exists('/var/user') or os.path.exists('/var/lang'))

# Redis 缓存层（服务器部署时 REDIS_URL 存在 → prediction/realtime 等小缓存走 Redis，秒读写）
try:
    import redis as _redis_mod
    _REDIS = _redis_mod.Redis.from_url(os.environ['REDIS_URL']) if os.environ.get('REDIS_URL') else None
except Exception:
    _REDIS = None

# ========== DB ==========
def init_db():
    with sqlite3.connect(DB) as c:
        c.execute('PRAGMA journal_mode=WAL')
        c.execute('CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, data TEXT, updated REAL)')
        c.execute('CREATE TABLE IF NOT EXISTS klines (secid TEXT PRIMARY KEY, data TEXT)')
        try: c.execute('ALTER TABLE klines ADD COLUMN ts REAL')  # 旧表无 ts 列，加列兼容（已有则忽略）
        except Exception: pass
        c.execute('CREATE TABLE IF NOT EXISTS watchlist (code TEXT PRIMARY KEY)')
        c.execute('''CREATE TABLE IF NOT EXISTS forecast_history (
            date TEXT, type TEXT, created REAL, data TEXT,
            PRIMARY KEY (date, type))''')
        c.execute('''CREATE TABLE IF NOT EXISTS profile_feats (
            date TEXT, code TEXT, data TEXT, PRIMARY KEY (date, code))''')
        c.execute('''CREATE TABLE IF NOT EXISTS scan_batch (
            date TEXT, mode TEXT, batch INTEGER, status TEXT,
            PRIMARY KEY (date, mode, batch))''')
_CACHE_TTL = {'prediction_': 86400, 'market_temp': 21600, 'sh_history': 21600,
              'holdings': 21600, 'prediction_quick': 3600, 'env_prev': 604800,
              'user_mode': 7776000, 'morning_qr_': 7200, 'evening_done_': 86400}
# SCF 无盘多实例：需要跨实例共享的缓存键前缀（写 COS，实例回收后可回源）
_COS_KEYS = ('prediction_', 'user_mode', 'morning_qr_', 'evening_done_', 'holdings')

def cache_get(key):
    # Redis 优先（服务器部署）：小缓存秒读；无 Redis 回落 SQLite
    if _REDIS is not None:
        try:
            raw = _REDIS.get('sm:' + key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    with sqlite3.connect(DB) as c:
        row = c.execute('SELECT data, updated FROM cache WHERE key=?', (key,)).fetchone()
    if row:
        ttl = next((v for k, v in _CACHE_TTL.items() if key.startswith(k)), 21600)
        if time.time() - row[1] <= ttl:
            try: return json.loads(row[0])
            except Exception: pass
    # SCF 无盘多实例：本实例 SQLite 无 → 回源 COS（用户数据/预测缓存跨实例共享）
    if IS_SCF and key.startswith(_COS_KEYS):
        try:
            raw = _cos_get(f'cache/{key}.json')
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    return None
def cache_set(key, data):
    js = json.dumps(data, ensure_ascii=False)
    # Redis 优先（服务器部署）；SQLite 始终写（降级/存档双保险）
    if _REDIS is not None:
        try:
            ttl = next((v for k, v in _CACHE_TTL.items() if key.startswith(k)), 21600)
            _REDIS.setex('sm:' + key, ttl, js)
        except Exception:
            pass
    with sqlite3.connect(DB) as c:
        c.execute('REPLACE INTO cache VALUES (?,?,?)', (key, js, time.time()))
    # SCF 无盘多实例：同步写 COS（实例回收/切换后其他实例可回源）
    if IS_SCF and key.startswith(_COS_KEYS):
        try:
            _cos_put(f'cache/{key}.json', js)
        except Exception:
            pass
def kline_get(secid, ttl=86400):
    # Redis 热缓存优先（服务器部署：K线全量存 Redis 持久化 + SQLite 双保险）
    if _REDIS is not None:
        try:
            raw = _REDIS.get('sm:kline:' + secid)
            if raw:
                return _kline_decode(raw)
        except Exception:
            pass
    with sqlite3.connect(DB) as c:
        row = c.execute('SELECT data, ts FROM klines WHERE secid=?', (secid,)).fetchone()
    if not row: return None
    ts = row[1] or 0  # 旧数据行 ts 为 NULL → 视为过期重拉
    if time.time() - ts > ttl: return None
    try:
        data = _kline_decode(row[0])
        # 回填 Redis 热缓存（TTL 与 SQLite 一致，防 Redis 冷）
        if _REDIS is not None:
            try:
                _REDIS.setex('sm:kline:' + secid, ttl, _kline_encode(data))
            except Exception:
                pass
        return data
    except Exception: return None

def _kline_encode(kl):
    """紧凑格式 + gzip 压缩：[{t,o,c,h,l,v}] → [[t,o,c,h,l,v],...] → gzip bytes（全市场全量 ~140MB 进 Redis）。
    ⚠️ 字段取值必须显式 None 判断（不能用 `or`——0 是合法价格/成交量，`0.0 or x` 会吞成 None）"""
    def _v(k, short, long, dflt):
        x = k.get(short)
        if x is None:
            x = k.get(long)
        return dflt if x is None else x
    text = json.dumps([[_v(k, 't', 'time', ''), _v(k, 'o', 'open', 0.0),
                        _v(k, 'c', 'close', 0.0), _v(k, 'h', 'high', 0.0),
                        _v(k, 'l', 'low', 0.0), _v(k, 'v', 'volume', 0)] for k in kl], ensure_ascii=False)
    return gzip.compress(text.encode('utf-8'), 6)

def _kline_decode(raw):
    # 兼容：gzip bytes（\x1f\x8b 开头）→ 解压；旧版纯 JSON 文本 → 直接解析
    try:
        if isinstance(raw, (bytes, bytearray)) and raw[:2] == b'\x1f\x8b':
            raw = gzip.decompress(raw).decode('utf-8')
        elif isinstance(raw, str) and raw.startswith('\x1f\x8b'):
            raw = gzip.decompress(raw.encode('latin1')).decode('utf-8')
    except Exception:
        pass
    d = json.loads(raw)
    # 兼容旧对象格式
    if d and isinstance(d[0], dict):
        return d
    return [{'t': p[0], 'o': p[1], 'c': p[2], 'h': p[3], 'l': p[4], 'v': p[5]} for p in d]

def kline_set(secid, data):
    enc = _kline_encode(data)
    with sqlite3.connect(DB) as c:
        c.execute('REPLACE INTO klines VALUES (?,?,?)', (secid, enc, time.time()))
    # 同步写 Redis（AOF 持久化；12h TTL——热数据常驻）
    if _REDIS is not None:
        try:
            _REDIS.setex('sm:kline:' + secid, 86400, enc)
        except Exception:
            pass

# ========== 网络 ==========
def fetch(url, retries=3, timeout=30):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/'})
            # 独立 opener：urllib 默认共享连接池在 ThreadPoolExecutor 并发下响应会串包
            # （表现：新浪 name 全同名错位、东财返回重复页）——每请求独立连接池
            opener = urllib.request.build_opener()
            return json.loads(opener.open(req, timeout=timeout).read())
        except Exception as e:
            if i < retries - 1: time.sleep(2)
            else: raise e

API_BASE = 'https://push2delay.eastmoney.com/api/qt/clist/get'
FS = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23'
FIELDS = 'f2,f3,f6,f8,f10,f12,f14,f20,f23,f24,f37,f62,f115,f100'  # f2价 f3涨跌 f6成交额 f8换手 f10量比 f20总市值 f24 60日涨跌 f37ROE f62主力净流入 f115PE f100行业(与涨停池hybk同名)
KLINE_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'

# ========== 板块 ==========
def board_of(code, name):
    if 'ST' in (name or ''): return 'ST'
    if code.startswith(('688','689')): return '科创板'
    if code.startswith(('300','301')): return '创业板'
    if code.startswith(('8','43','92')): return '北交所'
    return '主板'


def _zt_pool_em(date_str):
    """涨停池：akshare 优先（本地），SCF/失败时降级东财 push2ex。
    返回统一 dict 列表 [{'代码','名称','连板数','封板资金','首次封板时间','hybk'(行业)}] 或 None（无 pandas 依赖，SCF 可跑）"""
    if AK_OK:
        try:
            zt = ak.stock_zt_pool_em(date=date_str)
            if zt is not None and len(zt) > 0:
                return [{'代码': str(r['代码']), '名称': str(r.get('名称', '')),
                         '连板数': int(r.get('连板数', 0) or 0), '封板资金': float(r.get('封板资金', 0) or 0),
                         '首次封板时间': str(r.get('首次封板时间', '')),
                         'hybk': str(r.get('所属行业', '') or '')} for _, r in zt.iterrows()]
        except Exception:
            pass
    # 降级：东财 push2ex 涨停池（前端同款接口，国内节点快）
    try:
        ut = '7eea3edcaed734bea9cbfc24409ed989'
        d = fetch(f'https://push2ex.eastmoney.com/getTopicZTPool?ut={ut}&dpt=wz.ztzt&Pageindex=0&pagesize=400&sort=fbt%3Aasc&date={date_str}')
        pool = (d or {}).get('data') or {}
        rows = pool.get('pool') or []
        if rows:
            return [{'代码': str(r.get('c', '')), '名称': r.get('n', ''),
                     '连板数': int(r.get('lbc', 0) or 0), '封板资金': float(r.get('fund', 0) or 0),
                     '首次封板时间': r.get('fbt', ''), 'hybk': r.get('hybk', '') or ''} for r in rows]
    except Exception:
        pass
    return None

# ========== D4 题材层：主线题材识别（涨停池按行业聚合，门槛制） ==========
_theme_cache = {'ts': 0, 'industries': set(), 'detail': []}
_theme_lock = threading.Lock()

def _theme_mainline(force=False):
    """今日主线题材：涨停池按行业聚合，涨停家数≥3 的行业 = 主线（门槛制，不拍脑袋）。
    缓存 30 分钟；返回 (主线行业set, 行业明细list)。SCF 上 push2ex 有 hybk 字段，命名与 clist f127 一致"""
    if not force and time.time() - _theme_cache['ts'] < 1800:
        return _theme_cache['industries'], _theme_cache['detail']
    with _theme_lock:
        if not force and time.time() - _theme_cache['ts'] < 1800:
            return _theme_cache['industries'], _theme_cache['detail']
        industries, detail = set(), []
        try:
            from collections import Counter
            cnt = Counter()
            pool = _zt_pool_em(now_cst().strftime('%Y%m%d'))
            for r in (pool or []):
                ind = (r.get('hybk') or '').strip()
                if ind: cnt[ind] += 1
            detail = [{'name': k, 'count': v} for k, v in cnt.most_common(12)]
            industries = {k for k, v in cnt.items() if v >= 3}   # 门槛制：≥3家涨停才算主线
            _theme_cache['ts'] = time.time()
            _theme_cache['industries'] = industries
            _theme_cache['detail'] = detail
            print(f'[THEME] 主线题材: {sorted(industries)} ({len(industries)}个)')
        except Exception as e:
            print(f'[THEME ERROR] {e}')
        return industries, detail

# ========== 周期模式配置（三档：超短/波段/长线） ==========
DEFAULT_MODE = 'swing'
MODE_CFG = {
    # ⚡ 超短/打板：持仓1-3天，重涨停/突破/量能，轻价值
    'short': {
        'trend': {'chg': 5, 'ma': 10},            # 5日动量 + 站上MA10
        'break': {'win': 10, 'vr': 1.5},          # 突破10日高 + 量比>1.5
        'ma_bull': (5, 10, 20),                   # 短线不等60日结构
        'vcp': {'win': 5, 'shrink': 0.80, 'vr': 1.3},
        'wyckoff': None,                          # 超短无吸筹逻辑
        'fib': {'win': 10, 'vr': 0.9},
        'boll': {'period': 10, 'sq': 0.60},
        'kdj': {'j_max': 80},                     # 低位金叉更可靠
        'volDry': {'win': 10, 'lo': -10, 'hi': 5, 'ratio': 0.5, 'chg_win': 5},
        'tight': {'gap': 2.5, 'vr': 1.3, 'mas': (5, 10, 20)},
        'w_value': 0, 'w_leader': 2, 'w_theme': 2,  # 龙头+题材核心，价值不参与
        'macd': (6, 13, 5),
    },
    # 📈 波段：持仓2-8周，趋势+资金+形态均衡
    'swing': {
        'trend': {'chg': 20, 'ma': 20},
        'break': {'win': 20, 'vr': 1.3},
        'ma_bull': (5, 10, 20, 60),
        'vcp': {'win': 10, 'shrink': 0.85, 'vr': 1.1},
        'wyckoff': {'vr': 0.85, 'rsi': (30, 60), 'chg': 20},
        'fib': {'win': 20, 'vr': 0.9},
        'boll': {'period': 20, 'sq': 0.65},
        'kdj': {'j_max': 100},
        'volDry': {'win': 20, 'lo': -20, 'hi': 8, 'ratio': 0.5, 'chg_win': 20},
        'tight': {'gap': 3, 'vr': 1.1, 'mas': (5, 10, 20)},
        'w_value': 1, 'w_leader': 2, 'w_theme': 2,
        'macd': (12, 26, 9),
    },
    # 🏦 长线/价值：持仓6个月+，重价值/趋势/长结构
    'long': {
        'trend': {'chg': 60, 'ma': 60},
        'break': {'win': 60, 'vr': 1.2},
        'ma_bull': (20, 60, 120),
        'vcp': {'win': 20, 'shrink': 0.85, 'vr': 1.1},
        'wyckoff': {'vr': 0.8, 'rsi': (25, 50), 'chg': 20},
        'fib': {'win': 60, 'vr': 0.9},
        'boll': {'period': 20, 'sq': 0.70},
        'kdj': {'j_max': 60},                     # 高位金叉不追
        'volDry': {'win': 20, 'lo': -30, 'hi': 15, 'ratio': 0.4, 'chg_win': 60},
        'tight': {'gap': 5, 'vr': 1.1, 'mas': (10, 20, 60)},
        'w_value': 2, 'w_leader': 1, 'w_theme': 1,  # 价值核心，题材轻参与
        'macd': (26, 52, 9),
    },
}
# 实时机会阈值（按模式）
RT_CFG = {
    'short': {'pump': 3, 'vr': 2.5, 'turn': 8, 'flow': 2e7, 'super': 4e7},
    'swing': {'pump': 4, 'vr': 3, 'turn': 6, 'flow': 5e7, 'super': 8e7},
    'long':  {'pump': 6, 'vr': 2, 'turn': 3, 'flow': 1e8, 'super': 1.5e8},
}


# ========== 入场/止损/目标/仓位 ==========
def calc_trade_params(item, levels=None, mode=DEFAULT_MODE, env_coef=1.0):
    """根据信号+真实技术位自动算入场位/止损位/目标位/仓位（技术位随模式）
    D1 五项：①目标位（突破/回踩/均线分型+盈亏比保底1:2）②ATR14动态止损（最低3%）
    ③单笔风险2%本金预算仓位（封顶35%）④入场按模式分（short打板追/swing龙头回踩/long不追高）
    ⑤环境系数联动（env_coef 由 env_temperature 提供，默认1.0）"""
    score = item.get('score', 0)
    sigs = item
    price = item.get('price') or 0
    try: price = float(price)
    except: price = 0
    levels = levels or {}
    
    if price <= 0:
        return {'entry': None, 'entry_label': '--', 'stop': None, 'stop_pct': None,
                'target': None, 'target2': None, 'position': 5}
    
    ma20 = levels.get('ma20'); ma60 = levels.get('ma60')
    h20 = levels.get('h20'); l20 = levels.get('l20')
    fib382 = levels.get('fib382'); fib618 = levels.get('fib618')
    atr14 = levels.get('atr14')
    # 超短模式：回踩参考 MA10（更贴近短线节奏）
    ref_ma = levels.get('ma10') or ma20
    ref_ma_label = 'MA10' if levels.get('ma10') else 'MA20'
    
    # 【P1-8】质量门槛：ST/亏损(pe<0)/低价(<1.5元)股禁止打板追，降级博弈
    try:
        _name = (item.get('name') or '')
        _pe = item.get('pe')
        _low_quality = ('ST' in _name) or (_pe is not None and _pe < 0) or price < 1.5
    except: _low_quality = False

    # ①入场位（真实技术位优先；按模式区分追高策略）
    if mode == 'long':
        # 长线不追高：龙头/突破都不追，用均线买/现价分批
        if sigs.get('sig_maBull') and ref_ma and ref_ma > price * 0.97:
            entry = round(ref_ma, 2)
            entry_label = f'回踩{ref_ma_label}'
        elif ma20 and ma20 <= price * 1.05:
            entry = round(min(price, ma20 * 1.02), 2)
            entry_label = '均线买分批'
        else:
            entry = round(price, 2)
            entry_label = '现价分批'
    elif sigs.get('sig_leader') and score >= 3 and not _low_quality:
        if mode == 'short':
            entry = round(price * 1.005, 2)  # 涨停次日开盘追
            entry_label = '打板追'
        else:
            # swing 龙头：回踩买——但回踩空间封顶（用户核心诉求："明日预测=明天能买的股票"，
            # 回踩 18% 明天到不了 = 预测无法执行。short 3% / swing 5% 封顶，超过按封顶位买）
            _max_pb = 0.03 if mode == 'short' else 0.05
            entry = round(ref_ma, 2) if ref_ma else round(price, 2)
            _pb = (price - entry) / price if price and entry else 0
            if _pb > _max_pb:
                entry = round(price * (1 - _max_pb), 2)
                entry_label = f'回踩{int(_max_pb*100)}%买'
            else:
                entry_label = f'龙头回踩 {ref_ma_label} '
    elif sigs.get('sig_leader') and score >= 3 and _low_quality:
        entry = round(price * 1.002, 2)  # 亏损/低价龙头：不追高，成本价附近博弈
        entry_label = '博弈'
    elif sigs.get('sig_breakH') and h20:
        entry = round(h20 * 1.01, 2)     # 20日高点+1%确认突破
        entry_label = '突破追'
    elif sigs.get('sig_maBull') and ref_ma and ref_ma > price * 0.97:
        # 均线回踩同样封顶（回踩超过 5%/3% → 按封顶位买——保证可执行）
        _max_pb = 0.03 if mode == 'short' else 0.05
        entry = round(ref_ma, 2)
        _pb = (price - entry) / price if price and entry else 0
        if _pb > _max_pb:
            entry = round(price * (1 - _max_pb), 2)
            entry_label = f'回踩{int(_max_pb*100)}%买'
        else:
            entry_label = f'回踩{ref_ma_label}'
    elif sigs.get('sig_wyckoff') and fib618:
        entry = round(max(fib618, l20 or 0), 2)  # 斐波61.8%支撑
        entry_label = '斐波吸'
    elif sigs.get('sig_fib') and fib382:
        entry = round(min(fib382, price * 1.01), 2)  # 斐波38.2%位；若现价已跌穿则用现价附近
        entry_label = '斐波买' if fib382 <= price * 1.01 else '现价买'
    elif sigs.get('sig_trend') and ma20:
        entry = round(min(price, ma20 * 1.02), 2)  # 现价或MA20上2%
        entry_label = '均线买'
    else:
        entry = round(price, 2)
        entry_label = '现价'
    
    # ②止损位（真实支撑优先）
    if sigs.get('sig_leader'):
        stop = round(entry * 0.95, 2)
    elif sigs.get('sig_breakH') and h20:
        stop = round(h20 * 0.97, 2)      # 突破位下方3%
    elif sigs.get('sig_maBull') and ma60:
        stop = round(min(ma60, entry * 0.96), 2)  # MA60 或 -4%
    elif fib618:
        stop = round(entry * 0.95, 2)
    else:
        stop = round(entry * 0.95, 2)
    
    if stop >= entry: stop = round(entry * 0.95, 2)
    # 通用保险：入场位高于现价3%以上 → 降级为现价买入（价格已偏离目标位，不追高挂单）
    if price > 0 and entry > price * 1.03:
        entry = round(price, 2)
        entry_label = '现价'
    if stop >= entry: stop = round(entry * 0.95, 2)
    # ATR14 动态止损：stop = max(entry-2*ATR, entry*0.97)（最低3%止损），收紧过宽的支撑止损
    if atr14 and atr14 > 0:
        atr_stop = round(max(entry - 2 * atr14, entry * 0.97), 2)
        if atr_stop < entry and atr_stop > stop:
            stop = atr_stop
    if stop >= entry: stop = round(entry * 0.97, 2)
    
    # ①目标位（突破/回踩低吸/均线分型；盈亏比不足1:2时保底抬高）
    target = None; target2 = None
    if (sigs.get('sig_breakH') or sigs.get('sig_leader')) and h20:
        ext = (h20 - l20) if l20 else h20 * 0.1
        target = round(max(h20 + ext * 0.5, entry * 1.05), 2)   # 第一档：高点上方+半个波段扩展（保底5%）
        target2 = round(max(h20 + ext, entry * 1.10), 2)        # 第二档：高点上方+一个波段扩展（保底10%）
        if target2 <= target: target2 = round(target * 1.03, 2)
    elif (sigs.get('sig_maBull') or sigs.get('sig_fib') or sigs.get('sig_wyckoff')
          or sigs.get('sig_lowBuy')) and h20:
        target = round(h20, 2)                 # 回踩/低吸：目标=20日高点
    elif sigs.get('sig_trend') and atr14:
        target = round(entry + 2 * atr14, 2)   # 均线类：入场+2倍ATR
    else:
        target = round(entry * 1.05, 2)        # 通用：5%止盈
    # 盈亏比<1:2 → 目标保底抬到 entry+2*(entry-stop)
    if target is not None and entry > 0 and stop < entry:
        rr = (target - entry) / (entry - stop)
        if rr < 2:
            target = round(max(target, entry + 2 * (entry - stop)), 2)
    
    # ③仓位（单笔风险2%本金预算：pos = 0.02 / 风险比例；封顶35%）
    risk_pct = abs(stop - entry) / entry if entry > 0 else 0.05
    pos = (0.02 / risk_pct) if risk_pct > 0 else 0.05
    pos = min(pos, 0.35)
    if sigs.get('sig_leader') and not _low_quality: pos = min(pos * 1.5, 0.35)
    if _low_quality: pos = min(pos, 0.1)  # 质量差：仓位封顶 10%
    # ⑤环境联动：最终 position = pos * env_coef（env_temperature 提供；高潮放大/冰点收缩）
    try:
        pos = min(pos * float(env_coef or 1.0), 0.35)
    except Exception:
        pos = min(pos, 0.35)
    if _low_quality: pos = min(pos, 0.1)  # 环境放大后仍守质量封顶
    
    return {
        'entry': entry, 'entry_label': entry_label,
        'stop': stop, 'stop_pct': round((stop - entry) / entry * 100, 1),
        'target': target, 'target2': target2,
        'position': round(pos * 100),  # 百分比
    }

# ========== 市场温度 ==========
# akshare 模块级加载一次（避免每5分钟重复import）
try:
    import akshare as ak
    AK_OK = True
except Exception:
    AK_OK = False

_leader_cache = {'codes': set(), 'ts': 0}  # 涨停池缓存（防结果漂移）

def fetch_market_temp():
    """5指标采集→市场状态判定（北向盘中已停发，改为5指标）"""
    scores = {}
    details = {}
    
    # 1. 指数趋势（上证价格 f43 + 本地MA20）
    try:
        r = fetch('https://push2delay.eastmoney.com/api/qt/stock/get?secid=1.000001&fields=f43,f48')
        d0 = r['data']
        price = float(d0.get('f43', 0) or 0) / 100
        # 本地维护上证历史收盘
        hist = cache_get('sh_history') or []
        hist.append(price)
        hist = hist[-60:]
        cache_set('sh_history', hist)
        if len(hist) >= 21:
            ma20 = sum(hist[-21:-1]) / 20
            scores['trend'] = 1 if price > ma20 else -1 if price < ma20 * 0.95 else 0
            details['trend'] = f'上证{price:.0f}/MA20 {ma20:.0f}'
        else:
            scores['trend'] = 0; details['trend'] = f'上证{price:.0f}（历史不足21天）'
    except Exception as e: scores['trend'] = 0; details['trend'] = f'获取失败({e})'
    
    # 2. 涨跌比（沪深京涨跌家数）
    try:
        r = fetch('https://push2delay.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001,0.399006&fields=f104,f105,f106')
        up = down = 0
        for d in r['data']['diff']:
            up += d.get('f104', 0) or 0
            down += d.get('f105', 0) or 0
        ratio = up / max(up + down, 1) * 100
        scores['breadth'] = 1 if ratio > 60 else -1 if ratio < 30 else 0
        details['breadth'] = f'涨{up}/跌{down}={ratio:.0f}%'
    except: scores['breadth'] = 0; details['breadth'] = '获取失败'
    
    # 3. 涨停数(akshare)
    try:
        zt = _zt_pool_em(now_cst().strftime('%Y%m%d'))
        count = len(zt) if zt is not None else 0
        scores['zt'] = 1 if count > 50 else -1 if count < 20 else 0
        details['zt'] = f'涨停{count}只'
    except: scores['zt'] = 0; details['zt'] = '获取失败'
    
    # 4. 成交额（上证 f48 单位元）
    try:
        r = fetch('https://push2delay.eastmoney.com/api/qt/stock/get?secid=1.000001&fields=f48')
        amt = float(r['data'].get('f48', 0) or 0) / 1e8
        scores['volume'] = 1 if amt > 8000 else -1 if amt < 5000 else 0
        details['volume'] = f'上证成交{amt:.0f}亿'
    except: scores['volume'] = 0; details['volume'] = '获取失败'
    
    # 5. 连板高度(akshare)
    try:
        zt = _zt_pool_em(now_cst().strftime('%Y%m%d'))
        max_lb = max((r.get('连板数', 0) or 0 for r in zt), default=0) if (zt is not None and len(zt) > 0) else 0
        scores['height'] = 1 if max_lb > 5 else -1 if max_lb < 2 else 0
        details['height'] = f'最高{max_lb}连板'
    except: scores['height'] = 0; details['height'] = '获取失败'
    
    total = sum(scores.values())
    prev = cache_get('market_temp')
    
    # 状态判定（5指标阈值）
    if total >= 3: state = 'bull'; label = '🐂 牛市'; recommend = 'hot'
    elif total >= 1: state = 'up'; label = '📈 偏多'; recommend = 'trend'
    elif total >= -1: state = 'range'; label = '➡️ 震荡'; recommend = 'setup'
    elif total >= -3: state = 'bear'; label = '🐻 偏空'; recommend = 'value'
    else: state = 'crash'; label = '📉 恐慌'; recommend = 'dip'
    
    # 仓位建议
    pos_map = {'bull': 80, 'up': 60, 'range': 35, 'bear': 20, 'crash': 5}
    position = pos_map[state]
    
    # 趋势方向
    direction = '→'
    if prev:
        prev_total = prev.get('total', 0)
        if prev['state'] == state:
            direction = '→'
        elif total > prev_total:
            direction = '↗'
        else:
            direction = '↘'
    
    return {
        'state': state, 'label': label, 'recommend': recommend,
        'direction': direction, 'position': position,
        'scores': scores, 'details': details, 'total': total,
        'updated': now_cst().isoformat(),
    }

# ========== 市场环境温度（D3：涨停家数/连板高度/炸板率/上证5日趋势 → 相位+仓位系数） ==========
_ENV_MEMO = {'ts': 0, 'data': None}  # env 60秒内存缓存（/api/env 与预测批次共用）

def _index_5d_trend():
    """上证指数近5日涨跌%（腾讯→新浪→东财多源降级；全部失败返回 None）"""
    closes = None
    # 腾讯日K（index 与个股同源，sh000001）
    try:
        req = urllib.request.Request(
            'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh000001,day,,,10,qfq',
            headers={'UA': 'Mozilla/5.0', 'Referer': 'https://gu.qq.com/'})
        d = json.loads(urllib.request.urlopen(req, timeout=6).read())
        node = d['data']['sh000001']
        lines = node.get('qfqday') or node.get('day') or []
        if lines:
            closes = [_f(p[2]) for p in lines]
    except Exception:
        closes = None
    # 新浪日K
    if not closes:
        try:
            req = urllib.request.Request(
                'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=sh000001&scale=240&ma=no&datalen=10',
                headers={'UA': 'Mozilla/5.0', 'Referer': 'https://finance.sina.com.cn/'})
            d = json.loads(urllib.request.urlopen(req, timeout=6).read())
            if d:
                closes = [_f(r['close']) for r in d]
        except Exception:
            closes = None
    # 东财 push2his（兜底）
    if not closes:
        try:
            url = (f'{KLINE_URL}?secid=1.000001'
                   f'&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&end=20500101&lmt=10')
            d = fetch(url, retries=1, timeout=10)
            rows = (d.get('data') or {}).get('klines') or []
            closes = [float(r.split(',')[2]) for r in rows if len(r.split(',')) >= 3]
        except Exception:
            closes = None
    if not closes or len(closes) < 2: return None
    last5 = closes[-5:]
    return round((last5[-1] / last5[0] - 1) * 100, 2)

def _zb_pool_em(date_str):
    """炸板池：东财 push2ex getTopicZBPool（涨停池同族接口，无公开文档）；
    失败/404 返回 None → env_temperature 标注炸板率暂缺"""
    try:
        ut = '7eea3edcaed734bea9cbfc24409ed989'
        d = fetch(f'https://push2ex.eastmoney.com/getTopicZBPool?ut={ut}&dpt=wz.ztzt&Pageindex=0&pagesize=400&sort=fbt%3Aasc&date={date_str}',
                  retries=1, timeout=10)
        pool = (d or {}).get('data') or {}
        return pool.get('pool') or []
    except Exception:
        return None

def env_temperature():
    """市场环境温度（60秒缓存）：
    相位规则：涨停<30冰点coef0.7 / 30-60修复0.8 / 60-100发酵1.0 / >100高潮1.2；
    炸板率>40% 或 连板高度较上次骤降(≥3板) → 退潮 coef0.5"""
    now = time.time()
    if _ENV_MEMO['data'] is not None and now - _ENV_MEMO['ts'] < 60:
        return _ENV_MEMO['data']
    date_str = now_cst().strftime('%Y%m%d')
    zt_count = 0; max_lbc = 0; zb_rate = None; trend_5d = None; zb_note = None
    # 涨停家数 + 连板高度（涨停池一源两用）
    zt = _zt_pool_em(date_str)
    if zt is not None:
        zt_count = len(zt)
        max_lbc = max((int(r.get('连板数', 0) or 0) for r in zt), default=0)
    # 炸板率 = 炸板数 / (涨停数+炸板数)
    zb = _zb_pool_em(date_str)
    if zb is not None:
        total_hits = zt_count + len(zb)
        if total_hits > 0:
            zb_rate = round(len(zb) / total_hits * 100, 1)
    else:
        zb_note = '炸板池接口未返回（暂缺）'
    # 上证5日趋势
    trend_5d = _index_5d_trend()
    # 连板高度骤降：对比上次缓存（跨天且降≥3板视为退潮）
    lbc_drop = False
    prev = cache_get('env_prev')
    if prev and str(prev.get('date')) != date_str and prev.get('max_lbc') is not None:
        try:
            if (float(prev['max_lbc']) - max_lbc) >= 3:
                lbc_drop = True
        except Exception:
            pass
    # 相位判定
    if zt_count < 30: phase, coef = '冰点', 0.7
    elif zt_count < 60: phase, coef = '修复', 0.8
    elif zt_count < 100: phase, coef = '发酵', 1.0
    else: phase, coef = '高潮', 1.2
    if (zb_rate is not None and zb_rate > 40) or lbc_drop:
        phase, coef = '退潮', 0.5
    data = {'phase': phase, 'zt_count': zt_count, 'zb_rate': zb_rate,
            'max_lbc': max_lbc, 'coef': coef, 'trend_5d': trend_5d,
            'zb_note': zb_note, 'lbc_drop': lbc_drop,
            'updated': now_cst().isoformat()}
    cache_set('env_prev', {'date': date_str, 'max_lbc': max_lbc})
    _ENV_MEMO['ts'] = now
    _ENV_MEMO['data'] = data
    return data

# ========== 快扫 ==========
def quick_scan(pages=55, mode=DEFAULT_MODE):
    """15线程并行拉全市场，做5信号初筛（D2 资金量价层：量比/换手率参与打分，主力净流入只存展示）"""
    stocks = []
    def fetch_page(p):
        # 重试 3 次（clist 限流漏页 → 静默丢失，补上）
        for _ in range(3):
            try:
                url = f'{API_BASE}?fid=f20&po=1&pz=100&pn={p}&np=1&fltt=2&invt=2&fs={FS}&fields={FIELDS}'
                d = fetch(url)['data'].get('diff', [])
                if d: return d
            except Exception:
                pass
            time.sleep(0.5)
        return []
    
    with ThreadPoolExecutor(max_workers=15) as ex:
        futures = {ex.submit(fetch_page, p): p for p in range(1, pages + 1)}
        for f in as_completed(futures): stocks.extend(f.result())
    
    # 拉昨日涨停池（龙头信号数据源，缓存30分钟防漂移）
    leader_codes = _leader_cache.get('codes', set())
    if time.time() - _leader_cache.get('ts', 0) > 1800:
        try:
            from datetime import timedelta
            d = (now_cst() - timedelta(days=1)).strftime('%Y%m%d')
            zt = _zt_pool_em(d)
            if zt is not None and len(zt) > 0:
                leader_codes = set(str(r.get('代码', '')) for r in zt)
                _leader_cache['codes'] = leader_codes
                # 连板数缓存（龙头信号显示"N板"用）
                _leader_cache['lbc'] = {str(r.get('代码', '')): int(r.get('连板数', 0) or 0) for r in zt}
                _leader_cache['ts'] = time.time()
        except: pass
    
    items = []
    for s in stocks:
        code = s.get('f12', ''); name = s.get('f14', '')
        # 【P0-1 修复】f20 是总市值（曾误当 20 日涨幅）——真实趋势用 f24(60日涨跌)
        try: chg60 = float(s.get('f24', 0) or 0)
        except: chg60 = 0
        try: mcap = float(s.get('f20', 0) or 0)
        except: mcap = 0
        try: amt = float(s.get('f6', 0) or 0)
        except: amt = 0
        try: chg_today = float(s.get('f3', 0) or 0)
        except: chg_today = 0
        try: pe = float(s.get('f115')) if s.get('f115') and s.get('f115') != '-' else None
        except: pe = None
        try: roe = float(s.get('f37')) if s.get('f37') and s.get('f37') != '-' else None
        except: roe = None
        # 【D2】资金量价三字段：换手率/量比/主力净流入额（f62 只存展示，不做判断）
        try: turnover = float(s.get('f8', 0) or 0)
        except: turnover = 0
        try: vol_ratio = float(s.get('f10', 0) or 0)
        except: vol_ratio = 0
        try: main_flow = float(s.get('f62', 0) or 0)
        except: main_flow = 0

        # 质量门槛：ST 不进预测池；流动性门槛：成交额 ≥ 3000万
        if 'ST' in (name or '') or amt < 3e7: continue

        sig_trend = chg60 > 5
        sig_breakH = chg_today > 5
        sig_value = pe is not None and pe > 0 and pe < 25 and roe is not None and roe > 15
        sig_maBull = chg60 > 10
        sig_wyckoff = -30 < chg60 < 0 and chg_today > -2
        sig_leader = code in leader_codes
        # 【D4】题材层：属于今日主线行业（涨停池≥3家聚合）→ 初筛加分，保证主线票进深扫
        # f100=行业板块名（push2delay clist 唯一有效行业字段；f127 在延迟接口是垃圾值）
        _ml, _ = _theme_mainline()
        sig_theme = bool(s.get('f100') and s.get('f100') in _ml)
        qs = sum(1 for x in [sig_trend, sig_breakH, sig_value, sig_maBull, sig_wyckoff] if x)
        if sig_leader: qs += 2
        if sig_theme: qs += 2
        # 【D2】量比维度：≥1.5 且当日涨 → +1；≥1.5 且当日跌 → -1（放量下跌=出货嫌疑）
        if vol_ratio >= 1.5:
            if chg_today > 0: qs += 1
            elif chg_today < 0: qs -= 1
        # 【D2】换手率区间降权：1-15% 之外 -1（short 最严 3-10%）
        if turnover > 0:
            t_lo, t_hi = (3, 10) if mode == 'short' else (1, 15)
            if turnover < t_lo or turnover > t_hi: qs -= 1
        # 低价股降权（<1.5元，仙股风险）
        try:
            if float(s.get('f2') or 0) < 1.5: qs -= 1
        except: pass

        if qs > 0:
            items.append({
                'code': code, 'name': name, 'price': s.get('f2'), 'change_pct': s.get('f3'),
                'pe': pe, 'roe': roe, 'chg20': chg60, 'mcap': mcap, 'amount': amt,
                'turnover': turnover, 'volRatio': vol_ratio, 'main_flow': main_flow,   # D2 资金量价字段落库（预测/机会展示与候选筛选用）
                'secid': ('1.' if code.startswith('6') else '0.') + code,
                'board': {'board': board_of(code, name)},
                'industry': s.get('f100', '') or '',
                'quick_score': qs,
                'sig_trend': sig_trend, 'sig_breakH': sig_breakH, 'sig_value': sig_value,
                'sig_maBull': sig_maBull, 'sig_wyckoff': sig_wyckoff,
                'sig_vcp': False, 'sig_bollSq': False, 'sig_kdj': False,
                'sig_fib': False, 'sig_volDry': False, 'sig_leader': sig_leader,
                'sig_theme': sig_theme,
                'lbc': (_leader_cache.get('lbc', {}).get(code, 0) if sig_leader else 0),
            })
    # 同分按当日涨幅排序（小市值强势股也能进深扫）
    items.sort(key=lambda x: (x['quick_score'], x.get('change_pct') or 0), reverse=True)
    return items, len(stocks)

# ========== 深度K线分析 ==========
KLINE_MEM = {}  # 进程内K线缓存（跨扫描轮复用，防结果漂移）
KLINE_MEM_MAX = 500  # LRU 上限（2 worker × 500 只 × ~1MB ≈ 1GB 峰值——审计 P0：无上限会 OOM）
KLINE_FRESH_TS = {}  # secid → 上次盘中强制刷新时刻（10 分钟新鲜度——当日 bar 不冻结）

def _mem_put(secid, kl):
    """KLINE_MEM 写入（LRU：超上限踢最旧）"""
    if len(KLINE_MEM) >= KLINE_MEM_MAX:
        try:
            KLINE_MEM.pop(next(iter(KLINE_MEM)))
        except Exception:
            pass
    KLINE_MEM[secid] = kl

def _kline_incremental(secid):
    """增量更新（当天）：已有全量缓存 → 拉最近800根 → 取新日期根 → append → 写回。
    比 force_fresh 全量分页省 10 倍请求（历史数据不重拉）"""
    cached = kline_get(secid)
    if not cached or len(cached) < 5:
        # 无缓存 → 全量拉
        return _kline_tx(secid)
    try:
        code = secid.split('.')[1]
        prefix = 'sh' if code.startswith(('6','9')) else 'sz'
        url = f'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={prefix}{code},day,,,800,qfq'
        req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0', 'Referer': 'https://gu.qq.com/'})
        data = json.loads(urllib.request.urlopen(req, timeout=6).read())
        node = data['data'][f'{prefix}{code}']
        page = node.get('qfqday') or node.get('day') or []
        if not page: return cached
        fresh = [{'t': p[0], 'o': _f(p[1]), 'c': _f(p[2]), 'h': _f(p[3]), 'l': _f(p[4]), 'v': _f(p[5])} for p in page]
        last_date = cached[-1]['t']
        new = [k for k in fresh if k['t'] > last_date]
        if not new:
            return cached  # 无新数据（当天已是最新）
        merged = cached + new
        # 复权漂移检测：新旧重叠区价格偏差 > 1% → 全量重建（复权因子变化）
        old_map = {k['t']: k['c'] for k in cached[-3:]}
        drift = False
        for k in fresh:
            if k['t'] in old_map and old_map[k['t']] > 0:
                if abs(k['c'] / old_map[k['t']] - 1) > 0.01:
                    drift = True
                    break
        if drift:
            return _kline_tx(secid)  # 复权漂移 → 全量重拉
        kline_set(secid, merged)
        return merged
    except Exception:
        return cached  # 拉取失败保持旧缓存

def _f(v):
    """容错转 float：空串/None/非数字 → 0.0（数据源缺口不拖垮单票拉取）"""
    try:
        return float(v)
    except Exception:
        return 0.0

def _kline_tx(secid):
    """腾讯日K源（全量：800根/页分页拼接——param={code},{period},{start},{end},{count},{fqt}；次新股 >5 根即可）"""
    code = secid.split('.')[1]
    prefix = 'sh' if code.startswith(('6','9')) else 'sz'
    lines_all = []
    # 第一页：最新 800 根（不指定日期=实时，含当天）
    url = f'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={prefix}{code},day,,,800,qfq'
    req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0', 'Referer': 'https://gu.qq.com/'})
    data = json.loads(urllib.request.urlopen(req, timeout=6).read())
    node = data['data'][f'{prefix}{code}']
    page = node.get('qfqday') or node.get('day') or []
    if not page: return None
    lines_all.extend(page)
    # 历史分页：往前翻到上市首日（最多 12 页 ≈ 9600 根，覆盖全量历史）
    oldest = page[0][0]
    guard = 0
    while oldest and guard < 12:
        guard += 1
        try:
            urlN = f'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={prefix}{code},day,1900-01-01,{oldest},800,qfq'
            reqN = urllib.request.Request(urlN, headers={'UA': 'Mozilla/5.0', 'Referer': 'https://gu.qq.com/'})
            dataN = json.loads(urllib.request.urlopen(reqN, timeout=6).read())
            nodeN = dataN['data'][f'{prefix}{code}']
            pageN = nodeN.get('qfqday') or nodeN.get('day') or []
            if not pageN: break
            lines_all.extend(pageN)
            new_oldest = pageN[0][0]
            if not new_oldest or new_oldest >= oldest: break  # 已到尽头/分页不再前进
            oldest = new_oldest
        except Exception:
            break
    # 去重（分页边界可能重叠）
    seen, uniq = set(), []
    for p in lines_all:
        if p[0] not in seen:
            seen.add(p[0]); uniq.append(p)
    if len(uniq) < 5: return None   # 次新股放宽：5 根以上即可（原 25 根误杀 688825 等次新）
    uniq.sort(key=lambda p: p[0])   # 分页从新到旧拼接 → 按日期正序（否则 K线倒序渲染）
    return [{'t': p[0], 'o': _f(p[1]), 'c': _f(p[2]), 'h': _f(p[3]), 'l': _f(p[4]), 'v': _f(p[5])} for p in uniq]

def _kline_em(secid):
    """东财日K源（SCF 国内 IP 稳定；腾讯被限流时的降级）"""
    market, code = secid.split('.')
    url = (f'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid={market}.{code}'
           f'&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&end=20500101&lmt=250')
    req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/'})
    d = json.loads(urllib.request.urlopen(req, timeout=6).read())
    lines = (d.get('data') or {}).get('klines') or []
    if len(lines) < 25: return None
    kl = []
    for p in lines:
        q = p.split(',')
        kl.append({'t': q[0], 'o': _f(q[1]), 'c': _f(q[2]), 'h': _f(q[3]), 'l': _f(q[4]), 'v': _f(q[5])})
    return kl

def _kline_sina(secid):
    """新浪日K源（最后兜底）"""
    market, code = secid.split('.')
    prefix = 'sh' if market == '1' else 'sz'
    url = f'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol={prefix}{code}&scale=240&ma=no&datalen=250'
    req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0', 'Referer': 'https://finance.sina.com.cn/'})
    d = json.loads(urllib.request.urlopen(req, timeout=6).read())
    if not d or len(d) < 25: return None
    return [{'t': r['day'], 'o': _f(r['open']), 'c': _f(r['close']), 'h': _f(r['high']), 'l': _f(r['low']), 'v': _f(r['volume'])} for r in d]

def fetch_kline(secid, fast=False, mem=True, force_fresh=False):
    # 内存缓存（仅前端路径 mem=True；预测路径 mem=False 防 OOM：4300只×250根≈267MB>256MB）
    # force_fresh=True（/api/klines 增量/盘中新鲜度校验）：跳过 KLINE_MEM + SQLite 缓存现场拉取，
    # 拉取失败时回退旧缓存兜底；默认 False，预测路径行为完全不变
    if not force_fresh and mem and secid in KLINE_MEM: return KLINE_MEM[secid]
    if not force_fresh:
        cached = kline_get(secid)
        if cached:
            if mem: _mem_put(secid, cached)
            return cached
    if fast:
        # 前端路径：腾讯单源，6s 内返回（不能拖慢展示；失败由前端缓存/降级兜底）
        try:
            kl = _kline_tx(secid)
            if kl:
                kline_set(secid, kl)
                if mem: _mem_put(secid, kl)
            elif force_fresh:
                # 现场拉取失败 → 回退旧缓存兜底（增量/盘中请求不能因网络抖动丢数据）
                if mem and secid in KLINE_MEM: return KLINE_MEM[secid]
                return kline_get(secid)
            return kl
        except Exception:
            if force_fresh:
                if mem and secid in KLINE_MEM: return KLINE_MEM[secid]
                return kline_get(secid)
            return None
    # 预测路径：多源降级 腾讯 → 东财 → 新浪（SCF 出口 IP 被腾讯高频限流时自动切换）
    kl = None
    for src in (_kline_tx, _kline_em, _kline_sina):
        try:
            kl = src(secid)
            if kl: break
        except Exception:
            continue
    if not kl: return None
    kline_set(secid, kl)
    if mem: _mem_put(secid, kl)
    return kl

def _clean_kline(kl):
    """K线数据清洗：None/NaN/0价 → 前一根值（首根 → 0）。
    0 价 = 老复权数据异常（A股无 0 元股票），前值填充后所有除法天然安全；
    成交量 0 合法（停牌日）保留"""
    out = []
    prev = {}
    for k in kl or []:
        nk = dict(k)
        for f in ('o', 'c', 'h', 'l'):
            v = nk.get(f)
            if v is None or v == 0 or (isinstance(v, float) and v != v):
                nk[f] = prev.get(f, 0.0)
            if nk[f]:
                prev[f] = nk[f]  # prev 只存非 0 值（连续 0 价段不链式传播）
        v = nk.get('v')
        if v is None or (isinstance(v, float) and v != v):
            nk['v'] = prev.get('v', 0)
        prev['v'] = nk.get('v')
        out.append(nk)
    return out

def _rsi_series(closes, period):
    """RSI 序列：Wilder 平滑（返回最近值；数据不足返回 None）——与 compute_kline_signals 同公式"""
    n = len(closes)
    if n < period + 1:
        return None
    gn = [max(closes[i] - closes[i - 1], 0) for i in range(1, n)]
    ls = [max(closes[i - 1] - closes[i], 0) for i in range(1, n)]
    ag = sum(gn[:period]) / period
    al = sum(ls[:period]) / period
    r = 50.0
    for i in range(period, n - 1):
        ag = (ag * (period - 1) + gn[i]) / period
        al = (al * (period - 1) + ls[i]) / period
        r = 100 - 100 / (1 + ag / max(al, 0.001))
    return round(r, 1)

def _kline_rsi(secid):
    """按 secid 取 K线算 rsi6/rsi14（Redis 命中 ~0.1ms；失败返回 None,None）——供实时机会/全市场索引/筛选"""
    try:
        kl = kline_get(secid)
        if not kl or len(kl) < 15:
            return None, None
        closes = [float(k.get('c') or 0) for k in kl if k.get('c') is not None]
        if len(closes) < 15:
            return None, None
        return _rsi_series(closes, 6), _rsi_series(closes, 14)
    except Exception:
        return None, None

def compute_kline_signals(kl, strip_last=True, mode=DEFAULT_MODE):
    cfg = MODE_CFG.get(mode, MODE_CFG[DEFAULT_MODE])
    if not kl or len(kl) < 25: return {}
    kl = _clean_kline(kl)  # 防御：老数据缺口 None → 前值（正常数据不触发）
    if len(kl) < 25: return {}
    # 剥掉最后一根（盘中未完成K线）；收盘后(>15:00)不剥——今天已是完整日K，预测明天必须包含今天
    if strip_last:
        kl = kl[:-1] if len(kl) > 25 else kl
    if len(kl) < 25: return {}
    n = len(kl)
    c = [k['c'] for k in kl]; h = [k['h'] for k in kl]; l = [k['l'] for k in kl]; v = [k['v'] for k in kl]
    
    def sma(arr, p):
        if len(arr) < p: return [None]*p
        return [None]*(p-1) + [sum(arr[i-p+1:i+1])/p for i in range(p-1, len(arr))]
    def last(arr):
        for x in reversed(arr): 
            if x is not None: return x
        return 0
    
    ma5 = sma(c, 5); ma10 = sma(c, 10); ma20 = sma(c, 20); ma60 = sma(c, 60); ma120 = sma(c, 120)
    m5 = last(ma5); m10 = last(ma10); m20v = last(ma20); m60 = last(ma60); m120 = last(ma120)
    avg_v5 = sum(v[-6:-1])/5 if n >= 6 else v[-1]
    vr = v[-1]/avg_v5 if avg_v5 > 0 else 1
    # 动量窗口按模式（5/20/60日）
    t_cfg = cfg['trend']; t_win = t_cfg['chg']; t_ma = t_cfg['ma']
    chg_t = (c[-1]/c[-min(t_win+1,n)]-1)*100 if n >= t_win+1 else 0
    chg5 = (c[-1]/c[-min(6,n)]-1)*100 if n >= 6 else 0
    
    # RSI（wyckoff 用 rsi 区间：14 日标准）
    gn = [max(c[i]-c[i-1],0) for i in range(1,n)]
    ls = [max(c[i-1]-c[i],0) for i in range(1,n)]
    ag = sum(gn[:14])/14; al = sum(ls[:14])/14
    r14 = 50
    for i in range(14, n):
        ag = (ag*13+gn[i-1])/14; al = (al*13+ls[i-1])/14
        r14 = 100 - 100/(1+ag/max(al,0.001))
    
    # MACD（快慢周期按模式：6/13/5 · 12/26/9 · 26/52/9）
    macd_p = cfg.get('macd', (12, 26, 9))
    e1 = c[:]; e2 = c[:]
    k1 = 2/(macd_p[0]+1); k2 = 2/(macd_p[1]+1)
    for i in range(1, n):
        e1[i] = c[i]*k1 + e1[i-1]*(1-k1)
        e2[i] = c[i]*k2 + e2[i-1]*(1-k2)
    dif = last([a-b for a,b in zip(e1,e2)])
    
    # BB（周期按模式）
    b_p = cfg['boll']['period']
    bm = sma(c, b_p); bu = []; bl = []
    for i in range(n):
        if bm[i] is None: bu.append(None); bl.append(None); continue
        sd = (sum((c[j]-bm[i])**2 for j in range(max(0,i-b_p+1),i+1))/min(i+1,b_p))**0.5
        bu.append(bm[i]+2*sd); bl.append(bm[i]-2*sd)
    bw_now = (last(bu)-last(bm))*2 if last(bu) and last(bm) else 0
    bw_avg = sum((bu[i]-bm[i])*2 for i in range(max(0,n-b_p),n) if bu[i] and bm[i])/b_p if n>=b_p else bw_now
    
    # KDJ 标准9日递推（保存昨日K/D用于金叉判断）
    k_prev, d_prev = 50.0, 50.0
    k_yday, d_yday = 50.0, 50.0
    k_val = d_val = 50.0
    for i in range(8, n):
        k_yday, d_yday = k_prev, d_prev
        hh = max(h[i-8:i+1]); ll = min(l[i-8:i+1])
        rsv_i = (c[i]-ll)/(hh-ll)*100 if hh != ll else 50
        k_val = 2/3*k_prev + 1/3*rsv_i
        d_val = 2/3*d_prev + 1/3*k_val
        k_prev, d_prev = k_val, d_val
    j_val = 3*k_val - 2*d_val
    
    # Fib（回撤窗口按模式：10/20/60日）
    f_win = cfg['fib']['win']
    hw = max(h[-f_win:]); lw = min(l[-f_win:])
    f382 = hw - (hw-lw)*0.382; f618 = hw - (hw-lw)*0.618
    in_fib = c[-1] >= f618 and c[-1] <= f382
    
    # VCP 振幅收缩（窗口/收缩比按模式）
    v_win = cfg['vcp']['win']; half = max(1, v_win//2)
    amp = [(h[i]-l[i])/c[i]*100 for i in range(-v_win,0)]
    amp_shrink = len(amp)>=v_win and sum(amp[half:])/half < sum(amp[:half])/half*cfg['vcp']['shrink']
    
    # Vol quality（10日涨跌量对比，通用）
    uv = sum(v[i] for i in range(-10,0) if c[i]>c[i-1])
    dv = sum(v[i] for i in range(-10,0) if c[i]<c[i-1])
    vq = uv > dv*1.3 if dv > 0 else True
    avg_v20 = sum(v[-20:])/20 if n>=20 else v[-1]
    
    # 多头排列（均线组按模式）+ 趋势参考均线
    mb = cfg['ma_bull']
    ma_map = {5: m5, 10: m10, 20: m20v, 60: m60, 120: m120}
    ma_bull_full = all(ma_map.get(mb[i], 0) and ma_map.get(mb[i+1], 0) and ma_map[mb[i]] > ma_map[mb[i+1]] for i in range(len(mb)-1)) if len(mb) >= 2 else False
    t_mav = ma_map.get(t_ma, m20v)
    # 均线粘合（间距/量比/均线组按模式）
    tg = cfg['tight']; tg_mas = tg['mas']
    tg_vals = [ma_map.get(p) for p in tg_mas]
    ma_gap = max(tg_vals)/min(tg_vals)*100 - 100 if all(tg_vals) else 99
    ma_tight = all(tg_vals) and ma_gap < tg['gap']
    
    # 地量（均量窗口按模式，涨幅窗口独立按模式：短5/波20/长60）
    vd = cfg['volDry']
    avg_vw = sum(v[-vd['win']:])/vd['win'] if n >= vd['win'] else v[-1]
    chg_vw = vd.get('chg_win', vd['win'])
    chg_vd = (c[-1]/c[-min(chg_vw+1,n)]-1)*100 if n >= chg_vw+1 else 0
    
    # 突破（窗口按模式）——【P1-7】hbk 不含当日（昨日 20 日高，防"当日新高=自动满足"）
    bk = cfg['break']
    hbk = max(h[-(bk['win']+1):-1]) if n >= bk['win']+1 else max(h[-bk['win']:])
    
    # 吸筹（超短模式关闭）
    wy = cfg['wyckoff']
    wyckoff_on = False
    if wy is not None:
        chg_wy = (c[-1]/c[-min(wy['chg']+1,n)]-1)*100 if n >= wy['chg']+1 else 0
        wyckoff_on = vr < wy['vr'] and wy['rsi'][0] < r14 < wy['rsi'][1] and chg_wy < wy['chg'] and abs(chg_wy) < wy['chg']
    
    # KDJ 金叉 + J 上限过滤（低位金叉更可靠）
    kdj_jmax = cfg['kdj']['j_max']
    
    # 【D5】收敛类5信号合并 → sig_lowBuy（低吸形态任一命中即 True；原5字段保留供前端兼容过渡）
    _sig_fib = in_fib and vr > cfg['fib']['vr'] and r14 < 50
    _sig_bollSq = bw_avg > 0 and bw_now < bw_avg * cfg['boll']['sq'] and bm[-1] and abs(c[-1]-bm[-1])/bm[-1]*100 < 2
    _sig_volDry = v[-1] < avg_vw * cfg['volDry']['ratio'] and vd['lo'] < chg_vd < vd['hi']
    _sig_maTight = ma_tight and vr > tg['vr']
    _sig_wyckoff = wyckoff_on
    sig_lowBuy = _sig_fib or _sig_bollSq or _sig_volDry or _sig_maTight or _sig_wyckoff
    # ATR14（供交易参数动态止损/均线目标位使用）
    trs = [max(h[i]-l[i], abs(h[i]-c[i-1]), abs(l[i]-c[i-1])) for i in range(1, n)]
    atr14 = sum(trs[-14:])/14 if len(trs) >= 14 else (sum(trs)/len(trs) if trs else 0)
    
    return {
        'sig_trend': chg_t>0 and chg5>0 and c[-1]>t_mav and m5>t_mav and chg_t<60 and m60 and c[-1]>m60 and r14<75,
        'sig_vcp': amp_shrink and vr>cfg['vcp']['vr'],
        'sig_maBull': ma_bull_full and dif>0,
        'sig_wyckoff': _sig_wyckoff,
        'sig_fib': _sig_fib,
        'sig_bollSq': _sig_bollSq,
        'sig_kdj': k_yday<d_yday and k_val>d_val and j_val<kdj_jmax,
        'sig_volDry': _sig_volDry,
        'sig_breakH': c[-1]>=hbk*0.995 and vr>bk['vr'],
        'sig_maTight': _sig_maTight,
        'sig_lowBuy': sig_lowBuy,
        # 真实技术位（供入场/止损计算）
        'levels': {
            'ma10': round(m10, 2) if m10 else None,
            'ma20': round(m20v, 2) if m20v else None,
            'ma60': round(m60, 2) if m60 else None,
            'h20': round(max(h[-20:]), 2), 'l20': round(min(l[-20:]), 2),
            'fib382': round(f382, 2), 'fib618': round(f618, 2),
            'rsi': round(r14, 1),
            'rsi6': _rsi_series(c, 6) if n >= 7 else None,
            'chg': round(chg_t, 1),
            'atr14': round(atr14, 2),
        },
    }

def signal_winrate(kl, sig_keys, lookback=60, horizon=5, mode=DEFAULT_MODE):
    """回测信号组合：过去lookback日内每次触发后horizon日收益，返回胜率"""
    if not kl or len(kl) < lookback + horizon + 2: return None
    wins = 0; total = 0
    # 从后往前滑动（最后一根是当前，留出验证空间）
    for i in range(len(kl) - horizon - 2, lookback, -5):
        window = kl[:i]
        if len(window) < 30: break
        sigs = compute_kline_signals(window, strip_last=False, mode=mode)
        if not sigs: continue
        if all(sigs.get(k) for k in sig_keys if k in sigs):
            total += 1
            entry = window[-1]['c']
            exit_p = kl[i + horizon - 1]['c'] if i + horizon - 1 < len(kl) else kl[-1]['c']
            if exit_p > entry: wins += 1
    if total < 3: return None
    return round(wins / total * 100)

def signal_streak(kl, mode=DEFAULT_MODE):
    """连续触发天数：用剥1/2/3根的历史K线各算一次信号"""
    if not kl or len(kl) < 28: return 1
    base = compute_kline_signals(kl, strip_last=False, mode=mode)
    if not base: return 1
    streak = 1
    for cut in (1, 2, 3):
        prev = compute_kline_signals(kl[:-cut] if len(kl) > cut + 25 else None, strip_last=False, mode=mode)
        if not prev: break
        # 至少一个核心信号连续
        core = ['sig_trend','sig_breakH','sig_maBull','sig_vcp','sig_wyckoff','sig_bollSq','sig_kdj','sig_volDry','sig_fib','sig_maTight']
        cur_on = {k for k in core if base.get(k)}
        prev_on = {k for k in core if prev.get(k)}
        if cur_on and cur_on & prev_on: streak += 1
        else: break
    return streak

def deep_analyze(candidates, top_n=200, strip_last=True, mode=DEFAULT_MODE, env_coef=1.0):
    cfg = MODE_CFG.get(mode, MODE_CFG[DEFAULT_MODE])
    targets = candidates[:top_n]
    results = []
    now_str = now_cst().strftime('%H:%M')
    def analyze_one(item):
        kl = fetch_kline(item['secid'], mem=False)
        if not kl:
            # 瞬时风控重试：间隔 0.8s 重拉（最多 3 次）
            for _ in range(2):
                time.sleep(0.8)
                kl = fetch_kline(item['secid'], mem=False)
                if kl: break
        if not kl: 
            it = dict(item); it['scanned_at'] = now_str; it['trade'] = calc_trade_params(it, mode=mode, env_coef=env_coef)
            it['streak'] = 1; it['winrate'] = None
            return it
        sigs = compute_kline_signals(kl, strip_last, mode)
        merged = {**item, **sigs}
        merged['sig_value'] = item.get('sig_value', False)
        # 模式权重：价值/龙头/题材按模式加权，其余信号各1分
        # 【D5】收敛类5信号合并为 sig_lowBuy 只计1次（原5项不再单独计分）
        w_value = cfg['w_value']; w_leader = cfg['w_leader']; w_theme = cfg['w_theme']
        score = sum(1 for k in ['sig_trend','sig_vcp','sig_maBull','sig_lowBuy',
            'sig_kdj','sig_breakH'] if merged.get(k))
        if merged.get('sig_value'): score += w_value
        # 【D4】题材层：属于今日主线行业（涨停池≥3家聚合）→ 按模式加权
        if merged.get('sig_theme') is None:
            _ml, _ = _theme_mainline()
            merged['sig_theme'] = bool((item.get('industry') or '') in _ml)
        if merged.get('sig_theme'): score += w_theme
        # 【P1-5】leader 当日强度校验：昨日涨停但今日已大跌(≤-3%)不给权重（涨停次日大阴=资金出逃）
        if merged.get('sig_leader'):
            chg_now = 0
            try: chg_now = float(item.get('change_pct') or 0)
            except: pass
            if chg_now > -3:
                score += w_leader
            else:
                merged['sig_leader'] = False
                merged['leader_rejected'] = '涨停次日跌 ' + str(round(chg_now, 1)) + '%，当日强度不足'
        merged['score'] = score
        merged['max_score'] = 6 + w_value + w_leader + w_theme  # 满分（供前端显示）
        merged['mode'] = mode
        merged['scanned_at'] = now_str
        # 连续触发天数（保留）；信号组合历史胜率已移除（2026-08-14 用户拍板：胜率遍历全历史 O(n²) 拖垮预测 5-7 小时，且参考价值低）
        merged['streak'] = signal_streak(kl, mode)
        merged['winrate'] = None
        levels = sigs.get('levels', {})
        merged['levels'] = levels
        merged['trade'] = calc_trade_params(merged, levels, mode, env_coef)
        return merged
    
    with ThreadPoolExecutor(max_workers=4) as ex:  # 降频防限流（SCF 共享出口 IP）
        futures = [ex.submit(analyze_one, item) for item in targets]
        for f in as_completed(futures):
            try:
                results.append(f.result())
            except Exception as e:
                print(f'[DEEP] 单票分析异常（已隔离）: {e}')  # 一只崩不拖垮整批
    results.sort(key=lambda x: x.get('score', 0), reverse=True)
    return results

# ========== 主扫描 ==========
def full_scan(mode=DEFAULT_MODE):
    cfg = MODE_CFG.get(mode, MODE_CFG[DEFAULT_MODE])
    ck = f'prediction_{mode}'
    max_score = 6 + cfg['w_value'] + cfg['w_leader'] + cfg['w_theme']
    t0 = time.time()
    items, total = quick_scan(55, mode=mode)
    # 环境系数联动（D1-⑤/D3）
    try:
        env = env_temperature()
        env_coef = env.get('coef', 1.0) if env else 1.0
    except Exception:
        env_coef = 1.0
    # 先缓存快扫
    qr = sorted(items, key=lambda x: x.get('quick_score',0), reverse=True)
    now_str = now_cst().strftime('%H:%M')
    for it in qr:
        it['score'] = it.get('quick_score',0)
        it['scanned_at'] = now_str
        it['trade'] = calc_trade_params(it, mode=mode, env_coef=env_coef)
    cache_set(ck, {'items': qr[:500], 'total': total, 'stage': 'quick', 'maxScore': max_score, 'updated': now_cst().isoformat(), 'mode': mode})
    
    # 深度：两路覆盖
    # 路A 追强候选：实时信号分高的前300
    realtime_cands = [i for i in qr if i.get('quick_score',0) >= 2][:300]
    # 路B 形态候选：横盘/下跌区间按换手率补200只（VCP/吸筹/地量/布林形态来源）
    shape_cands = []
    have = {i['code'] for i in realtime_cands}
    for i in qr:
        if len(shape_cands) >= 200: break
        if i['code'] in have: continue
        if i.get('quick_score',0) < 2:
            shape_cands.append(i)
    # 若路B不足，从低分补充
    for i in qr:
        if len(shape_cands) >= 200: break
        if i['code'] in have: continue
        shape_cands.append(i)
    
    deep = deep_analyze(realtime_cands + shape_cands, 500, mode=mode, env_coef=env_coef)
    deep = [i for i in deep if i.get('score', 0) >= 2]  # 1分弱信号不入池
    deep.sort(key=lambda x: x.get('score',0), reverse=True)
    # RSI 顶层字段（供前端 RSI 筛选——levels 兜底已在，顶层统一）
    for _d in deep:
        _lv = _d.get('levels') or {}
        _d['rsi6'] = _lv.get('rsi6')
        _d['rsi14'] = _lv.get('rsi')
    cache_set(ck, {'items': deep[:500], 'total': total, 'stage': 'deep', 'maxScore': max_score, 'updated': now_cst().isoformat(), 'mode': mode})
    return deep

# ========== 实时机会引擎 ==========
RT_FIELDS = 'f2,f3,f8,f10,f12,f14,f62,f66,f72,f115,f20'
def trading_status():
    """当前是否交易时段 + 最近数据日期"""
    from datetime import timedelta
    now = now_cst()
    is_weekday = now.weekday() < 5
    in_hours = (now.hour == 9 and now.minute >= 15) or (10 <= now.hour < 15) or (now.hour == 15 and now.minute <= 5)
    trading = is_weekday and in_hours
    # 最近数据日期：周末回退周五；工作日盘前(9:15前)用昨天；盘中用今天；盘后用今天
    d = now
    if not trading:
        if now.hour < 15 and is_weekday:
            d = now - timedelta(days=1)
        while d.weekday() >= 5:
            d -= timedelta(days=1)
    return trading, d.strftime('%m-%d')
def realtime_scan(mode=DEFAULT_MODE):
    """拉全市场实时行情→当日策略打分（盘中60秒刷新）"""
    stocks = []
    def fetch_page(p):
        try:
            url = f'{API_BASE}?fid=f3&po=1&pz=100&pn={p}&np=1&fltt=2&invt=2&fs={FS}&fields={RT_FIELDS}'
            return fetch(url)['data'].get('diff', [])
        except: return []
    
    with ThreadPoolExecutor(max_workers=15) as ex:
        futures = {ex.submit(fetch_page, p): p for p in range(1, 56)}
        for f in as_completed(futures): stocks.extend(f.result())
    
    items = []
    for s in stocks:
        code = s.get('f12', ''); name = s.get('f14', '')
        try: chg = float(s.get('f3', 0) or 0)
        except: chg = 0
        try: turnover = float(s.get('f8', 0) or 0)
        except: turnover = 0
        try: vr = float(s.get('f10', 0) or 0)  # 量比
        except: vr = 0
        try: main_flow = float(s.get('f62', 0) or 0)  # 主力净流入(元)
        except: main_flow = 0
        try: super_flow = float(s.get('f66', 0) or 0)
        except: super_flow = 0
        price = s.get('f2')
        board = board_of(code, name)
        
        sigs = {}
        rt = RT_CFG.get(mode, RT_CFG[DEFAULT_MODE])
        # 1. 冲击涨停/涨停（涨幅≥9.5% 或 ≥19.5% 创业/科创）
        limit_pct = 19.5 if board in ('创业板','科创板') else 9.5
        sigs['sig_zt'] = chg >= limit_pct
        # 2. 大幅拉升（涨幅 X%~涨停前，X 按模式：超短3/波段4/长线6）
        sigs['sig_pump'] = rt['pump'] <= chg < limit_pct
        # 3. 量比异动（按模式：超短2.5/波段3/长线2）
        sigs['sig_vr'] = vr >= rt['vr']
        # 4. 换手激增（按模式：超短8/波段6/长线3）
        sigs['sig_turn'] = turnover >= rt['turn']
        # 5. 主力大幅净流入（按模式：超短2000万/波段3000万/长线1亿）
        sigs['sig_flow'] = main_flow > rt['flow']
        # 6. 超大单扫货（按模式：超短4000万/波段5000万/长线1.5亿）
        sigs['sig_super'] = super_flow > rt['super']
        # 7. 低开高走信号（涨幅>0 且 量比>2）
        sigs['sig_reverse'] = 0 < chg < 4 and vr >= 2
        # 8. 放量下跌（跌幅>3% 且 量比>2——出货警惕）
        sigs['sig_dump'] = chg <= -3 and vr >= 2
        
        score = sum(1 for k, v in sigs.items() if v and k != 'sig_dump')
        if sigs['sig_zt']: score += 1  # 涨停权重高
        
        if score > 0:
            # RSI（K线 Redis 命中——供前端 RSI 筛选；失败 None 不影响列表）
            _secid = ('1.' if code.startswith('6') else '0.') + code
            _r6, _r14 = _kline_rsi(_secid)
            items.append({
                'code': code, 'name': name, 'price': price, 'change_pct': chg,
                'turnover': turnover, 'vr': vr,
                'main_flow': main_flow, 'super_flow': super_flow,
                'secid': _secid,
                'board': {'board': board},
                'score': score,
                'rsi6': _r6, 'rsi14': _r14,
                **sigs,
            })
    
    items.sort(key=lambda x: (x['sig_zt'] * 100 + x['score']), reverse=True)
    trading, data_date = trading_status()
    return {'items': items[:300], 'total': len(items), 'updated': now_cst().isoformat(),
            'is_trading': trading, 'data_date': data_date}

_RT_SCANNING = {}  # mode -> bool：后台扫描线程状态（防并发重复扫描）
_INSTANCE_ID = f'{os.getpid()}-{int(time.time())}'  # 实例标识（排查多实例状态不共享）

@app.route('/api/debug_tx')
def api_debug_tx():
    """服务器进程内直接拉腾讯快照，定位生产快照为空的原因"""
    try:
        codes = _code_list()
        rows = _tx_snapshot()
        return jsonify({'codes': len(codes), 'rows': len(rows),
                        'uniq': len({(r.get('name') or '') for r in rows[:300]}),
                        'sample': [(r.get('name'), r.get('code')) for r in rows[:3]]})
    except Exception as e:
        return jsonify({'error': str(e)[:200]})

@app.route('/api/debug_snap')
def api_debug_snap():
    """在服务器进程内直接拉新浪快照，验证并发拉取是否错位"""
    try:
        rows = _sina_snapshot()
        names = {(r.get('name') or '') for r in rows[:300]}
        return jsonify({'rows': len(rows), 'uniq300': len(names),
                        'sample': [(r.get('name'), r.get('code')) for r in rows[:3]]})
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/api/debug_state')
def api_debug_state():
    """扫描状态调试（排查实时机会卡住）"""
    return jsonify({
        'inst': _INSTANCE_ID,
        'scanning': _RT_SCANNING,
        'snap_src': _SNAP_CACHE.get('src'),
        'snap_rows': len(_SNAP_CACHE.get('data') or []),
        'snap_ts_age': round(time.time() - _SNAP_CACHE['ts'], 1) if _SNAP_CACHE.get('ts') else None,
        'snap_uniq': len({(r.get('name') or '').strip() for r in (_SNAP_CACHE.get('data') or [])[:300]}),
        'snap_top_names': [((r.get('name') or '')[:20], r.get('code')) for r in (_SNAP_CACHE.get('data') or [])[:3]],
        'full_items': len(_RT2_STATE.get('full_items') or []),
        'full_uniq': len({(i.get('name') or '') for i in (_RT2_STATE.get('full_items') or [])[:100]}),
        'full_names': [(i.get('name'), i.get('code')) for i in (_RT2_STATE.get('full_items') or [])[:3]],
        'hot_items': len(_RT2_STATE.get('hot_items') or []),
        'full_ts_age': round(time.time() - _RT2_STATE.get('full_ts', 0), 1) if _RT2_STATE.get('full_ts') else None,
        'pending': len(_RT2_STATE.get('pending') or {}),
        'confirmed': len(_RT2_STATE.get('confirmed') or {}),
        'threads': threading.active_count(),
    })

def _rt_cache_valid(data):
    """SQLite 缓存校验：items 全同名（风控垃圾数据）视为无效缓存"""
    items = (data or {}).get('items') or []
    if not items: return True  # 空结果合法（无信号）
    names = {(i.get('name') or '') for i in items[:50]}
    return len(names) >= 5

def _merge_rt_quotes(items):
    """实时机会显示口径统一：量比/换手/价格/涨跌 用共享行情层（腾讯实时）覆盖——
    机会列表扫描时用东财 clist（f10 量比/f8 换手）做筛选信号，但展示必须与详情/实盘同源同数
    （用户抓过"同一量比两个数"；筛选用入选时点口径，展示用当前口径，两者本来就允许不同）"""
    if not items or _REDIS is None:
        return items
    try:
        vals = _REDIS.hmget('sm:quotes', *[str(i.get('code') or '') for i in items])
        for it, v in zip(items, vals):
            if not v:
                continue
            q = json.loads(v)
            if q.get('vol_ratio') is not None:
                it['vr'] = q['vol_ratio']
            if q.get('turnover') is not None:
                it['turnover'] = q['turnover']
            if q.get('price') is not None:
                it['price'] = q['price']
            if q.get('chg') is not None:
                it['change_pct'] = q['chg']
    except Exception:
        pass
    return items

@app.route('/api/realtime')
def api_realtime():
    """实时机会：缓存优先(60s) + 后台扫描线程——请求立即返回，扫描在后台跑完更新缓存
    （全市场扫描 30-90s 超过 Render 请求超时限制，必须异步）"""
    mode = request.args.get('mode', DEFAULT_MODE)
    if mode not in MODE_CFG: mode = DEFAULT_MODE
    force = request.args.get('force') == '1'
    cached = cache_get(f'realtime_{mode}')
    cached_ts = cache_get(f'realtime_{mode}_ts') or 0
    # 1) 新鲜且有效的缓存（60 秒内）直接返回——前端秒拿
    #    （扫描一轮约60-90s > 原60s缓存 → 数据刚出来又触发新扫描，永远"扫描中"；60s 折中：盘中热股引擎 60-90s 一轮）
    if cached and not force and time.time() - cached_ts < 60 and _rt_cache_valid(cached):
        cached = {**cached, 'items': _merge_rt_quotes(list(cached.get('items') or []))}  # 展示口径统一（量比/换手/价格与详情同源）
        return jsonify({**cached, 'from_cache': True, 'scanning': False, 'mode': mode, 'inst': _INSTANCE_ID})
    # 1.5) SCF 环境：无后台线程（实例冻结会杀死线程）→ 同步扫描（国内节点 55 页并发 ~2s）
    if IS_SCF:
        try:
            data = scan_opportunities(mode, force=True)
            # 结果校验：信号全同名（快照错位）→ 清快照缓存重扫一次；仍污染 → 返回空（不给垃圾数据）
            uniq = len({(i.get('name') or '').strip() for i in ((data or {}).get('items') or [])[:50]})
            if (data or {}).get('items') and uniq < 50:
                print('[RT] SCF结果可疑，清缓存重扫')
                _SNAP_CACHE['data'] = None; _SNAP_CACHE['ts'] = 0
                data = scan_opportunities(mode, force=True)
                uniq = len({(i.get('name') or '').strip() for i in ((data or {}).get('items') or [])[:50]})
                if uniq < 50:
                    data = {**(data or {}), 'items': [], 'total': 0, 'error': '数据源异常已拦截（稍后重试）'}
            return jsonify({**(data or {}), 'from_cache': False, 'scanning': False, 'mode': mode})
        except Exception as e:
            if cached: return jsonify({**cached, 'from_cache': True, 'scanning': False, 'mode': mode, 'error': str(e)[:100]})
            return jsonify({'items': [], 'total': 0, 'error': str(e)[:200], 'mode': mode}), 500
    # 2) 已有后台扫描在跑（任意 mode）→ 不重复触发（快照/锁共享，并发抢锁会拖慢到3-4分钟）
    if any(_RT_SCANNING.values()) and not force:
        if cached and _rt_cache_valid(cached):
            cached = {**cached, 'items': _merge_rt_quotes(list(cached.get('items') or []))}
            return jsonify({**cached, 'from_cache': True, 'scanning': True, 'mode': mode})
        return jsonify({'items': [], 'total': 0, 'scanning': True, 'mode': mode})
    # 3) 启动后台扫描线程（不阻塞请求）
    _RT_SCANNING[mode] = True
    def _worker():
        try:
            data = scan_opportunities(mode, force=True)
            # 结果校验：信号全同名（快照被污染）→ 清快照缓存重扫（最多2次，防无限循环拖死服务）
            for _ in range(2):
                uniq = len({(i.get('name') or '') for i in ((data or {}).get('items') or [])[:50]})
                if not (data or {}).get('items') or uniq >= 5:
                    break
                print(f'[RT] 结果可疑({uniq}唯一名)，清快照缓存重扫')
                _SNAP_CACHE['data'] = None; _SNAP_CACHE['ts'] = 0
                time.sleep(3)
                data = scan_opportunities(mode, force=True)
            if not (data or {}).get('items'):
                # 首帧未确认（2帧确认机制）：等12s连扫第二帧，一次完成确认
                time.sleep(12)
                try:
                    data = scan_opportunities(mode, force=True)
                except Exception as e:
                    print('realtime 2nd frame err:', e)
            cache_set(f'realtime_{mode}', data)
            cache_set(f'realtime_{mode}_ts', time.time())
        except Exception as e:
            print('realtime scan err:', e)
        finally:
            _RT_SCANNING[mode] = False
    threading.Thread(target=_worker, daemon=True).start()
    # worker 完成一次扫描后内存 _RT2_STATE 就有数据 → 直接返回（SQLite 缓存写失败也不影响）
    st_items = _RT2_STATE.get('full_items') or _RT2_STATE.get('hot_items')
    if st_items and _rt_cache_valid({'items': st_items}):
        return jsonify({
            'items': st_items[:300], 'total': len(st_items),
            'zt_new': (_RT2_STATE.get('full_zt') or [])[:50],
            'new_items': [], 'hot_ts': _RT2_STATE.get('hot_ts'), 'full_ts': _RT2_STATE.get('full_ts'),
            'is_trading': True, 'data_date': _RT2_STATE.get('data_date') or now_cst().strftime('%m-%d'),
            'updated': now_cst().isoformat(),
            'from_cache': True, 'scanning': True, 'mode': mode,
        })
    if cached and _rt_cache_valid(cached):
        return jsonify({**cached, 'from_cache': True, 'scanning': True, 'mode': mode})
    return jsonify({'items': [], 'total': 0, 'scanning': True, 'mode': mode})

# ========== 实时机会引擎 v2（分层扫描 + 可参与过滤 + 2帧确认 + 增量） ==========
# 快照归一化字段：code/name/price/change_pct/turnover/vol_ratio/speed/chg5/main_net/main_net_pct/
#   super_net/big_net/mid_net/small_net/mcap/fcap/high/low/open/pre_close/limit_up/limit_down/amount/volume

def _num(v):
    """容错转 float：'-'/None/NaN → None"""
    try:
        if v is None or v == '-' or v == '': return None
        f = float(v)
        return f if f == f else None  # NaN 判空
    except Exception:
        return None

def _secid(code):
    return ('1.' if code.startswith('6') else '0.') + code

def limit_pct_of(code, name):
    """涨跌幅限制%：ST=5，创业/科创(30/688/689开头)=20，北交所(8/4/92开头)=30，否则10"""
    if 'ST' in (name or '').upper(): return 5.0
    if code.startswith(('30', '688', '689')): return 20.0
    if code.startswith(('8', '4', '92')): return 30.0
    return 10.0

def dist_limit_of(row):
    """距涨停%：优先真实涨停价；(涨停价-现价)/涨停价；无涨停价时用 涨跌幅限制-涨幅 估算"""
    price = row.get('price'); lu = row.get('limit_up')
    if price and lu and price > 0:
        return round((lu - price) / lu * 100, 2)
    if price is None or row.get('pre_close') is None: return None
    lp = limit_pct_of(row.get('code', ''), row.get('name', ''))
    chg = row.get('change_pct') or 0
    return round((lp - chg) / (1 + lp / 100), 2)

def participate_of(dist):
    """可参与度：>3%可参与 / 1-3%快封板 / <1%已涨停"""
    if dist is None: return '未知'
    if dist < 1: return '已涨停'
    if dist <= 3: return '快封板'
    return '可参与'

# ---- 快照：akshare 优先，push2delay clist 兜底 ----
RT2_FIELDS = 'f2,f3,f5,f6,f8,f10,f11,f12,f14,f15,f16,f17,f18,f20,f21,f22,f51,f52,f62,f63,f64,f66,f68,f70'
_SNAP_CACHE = {'data': None, 'ts': 0, 'src': None}
_SNAP_LOCK = threading.Lock()

def _norm_clist(s):
    """push2delay clist 行 → 归一化快照行"""
    def f(k):
        v = s.get(k)
        try:
            if v == '-' or v is None: return None
            x = float(v)
            return x if x == x else None
        except Exception:
            return None
    return {
        'code': str(s.get('f12', '')).zfill(6), 'name': s.get('f14', ''),
        'price': f('f2'), 'change_pct': f('f3'), 'volume': f('f5'), 'amount': f('f6'),
        'turnover': f('f8'), 'vol_ratio': f('f10'), 'chg5': f('f11'),
        'high': f('f15'), 'low': f('f16'), 'open': f('f17'), 'pre_close': f('f18'),
        'mcap': f('f20'), 'fcap': f('f21'), 'speed': f('f22'),
        'limit_up': f('f51'), 'limit_down': f('f52'),
        'main_net': f('f62'), 'main_net_pct': f('f63'),
        'super_net': f('f64'), 'big_net': f('f66'),
        'mid_net': f('f68'), 'small_net': f('f70'),
    }

def _clist_snapshot():
    """降级源：push2delay clist 55页分页（现网可用）"""
    stocks = []
    def fetch_page(p):
        try:
            url = f'{API_BASE}?fid=f3&po=1&pz=100&pn={p}&np=1&fltt=2&invt=2&fs={FS}&fields={RT2_FIELDS}'
            d = fetch(url, timeout=10)['data'].get('diff', [])
            time.sleep(0.3)  # 降速防东财风控（高并发55页会返回重复页→全同名垃圾数据）
            return d
        except Exception:
            return []
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(fetch_page, p): p for p in range(1, 56)}
        for f in as_completed(futures): stocks.extend(f.result())
    rows = []
    for s in stocks:
        code = str(s.get('f12', '')).zfill(6)
        if not code or code == '000000': continue
        rows.append(_norm_clist(s))
    return rows

def _ak_spot():
    """akshare 双接口合并：全市场快照 + 今日资金流排名（资金流/涨停价本版spot不含）"""
    df = ak.stock_zh_a_spot_em()
    flow = {}
    try:
        fdf = ak.stock_individual_fund_flow_rank(indicator='今日')
        for _, r in fdf.iterrows():
            c = str(r.get('代码', '')).zfill(6)
            if c: flow[c] = r
    except Exception:
        pass
    rows = []
    for _, r in df.iterrows():
        code = str(r.get('代码', '')).zfill(6)
        name = str(r.get('名称', ''))
        if not code: continue
        pre_close = _num(r.get('昨收'))
        limit_up = _num(r.get('涨停价'))
        if limit_up is None and pre_close:
            # 涨停价缺失时按涨跌幅限制估算
            limit_up = round(pre_close * (1 + limit_pct_of(code, name) / 100), 2)
        fr = flow.get(code)
        rows.append({
            'code': code, 'name': name,
            'price': _num(r.get('最新价')), 'change_pct': _num(r.get('涨跌幅')),
            'volume': _num(r.get('成交量')), 'amount': _num(r.get('成交额')),
            'turnover': _num(r.get('换手率')), 'vol_ratio': _num(r.get('量比')),
            'chg5': _num(r.get('5分钟涨跌')), 'speed': _num(r.get('涨速')),
            'high': _num(r.get('最高')), 'low': _num(r.get('最低')),
            'open': _num(r.get('今开')), 'pre_close': pre_close,
            'mcap': _num(r.get('总市值')), 'fcap': _num(r.get('流通市值')),
            'limit_up': limit_up, 'limit_down': _num(r.get('跌停价')),
            'main_net': _num(fr.get('今日主力净流入-净额')) if fr is not None else None,
            'main_net_pct': _num(fr.get('今日主力净流入-净占比')) if fr is not None else None,
            'super_net': _num(fr.get('今日超大单净流入-净额')) if fr is not None else None,
            'big_net': _num(fr.get('今日大单净流入-净额')) if fr is not None else None,
            'mid_net': _num(fr.get('今日中单净流入-净额')) if fr is not None else None,
            'small_net': _num(fr.get('今日小单净流入-净额')) if fr is not None else None,
        })
    return rows

_CODE_CACHE = {'codes': None, 'ts': 0}  # 全市场代码表缓存（24h，腾讯批量行情用）

def _code_list():
    """全市场 code 列表：新浪优先，失败用东财 clist；24h 缓存（不依赖每次拉取成功）"""
    if _CODE_CACHE['codes'] and time.time() - _CODE_CACHE['ts'] < 86400:
        return _CODE_CACHE['codes']
    codes = []
    try:
        codes = [r['code'] for r in _sina_snapshot() if r.get('code')]
    except Exception:
        pass
    if len(codes) < 3000:
        try:
            codes = [r['code'] for r in _clist_snapshot() if r.get('code')]
        except Exception:
            pass
    if len(codes) >= 3000:
        _CODE_CACHE['codes'] = codes; _CODE_CACHE['ts'] = time.time()
    return codes

def _tx_snapshot():
    """腾讯批量行情快照（海外服务器可用源）：code列表 → qt.gtimg.cn 批量拉行情
    字段：名称/价格/涨跌/换手/量比/成交额/市值（腾讯对海外 IP 友好，不风控）
    无主力资金字段 → sig_flow/sig_super 自动不命中"""
    codes = _code_list()
    if not codes:
        return []
    out = []
    for i in range(0, len(codes), 50):
        batch = codes[i:i + 50]
        q = ','.join(('sh' if c.startswith(('6', '9')) else 'sz') + c for c in batch)
        try:
            url = f'https://qt.gtimg.cn/q={q}'
            req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0', 'Referer': 'https://gu.qq.com/'})
            def _parse(raw):
                parsed = []
                for line in raw.strip().split(';'):
                    if '~' not in line: continue
                    f = line.split('~')
                    if len(f) < 46 or not f[2]: continue
                    parsed.append({
                        'code': f[2].zfill(6), 'name': (f[1] or '').strip(),
                        'price': _num(f[3]), 'change_pct': _num(f[32]),
                        'volume': _num(f[36]), 'amount': (_num(f[37]) or 0) * 10000,
                        'turnover': _num(f[38]), 'vol_ratio': _num(f[43]),
                        'high': _num(f[33]), 'low': _num(f[34]), 'open': _num(f[5]),
                        'pre_close': _num(f[4]),
                        'mcap': (_num(f[44]) or 0) * 1e8, 'fcap': (_num(f[45]) or 0) * 1e8,
                        'main_net': None, 'chg5': None, 'speed': None,
                        'limit_up': None, 'limit_down': None,
                    })
                return parsed
            opener = urllib.request.build_opener()  # 独立连接池（并发串包已踩坑）
            parsed = _parse(opener.open(req, timeout=10).read().decode('gbk', errors='ignore'))
            # 批校验：该批 name 唯一数过少（<批的60%）= 限流错位响应 → 等1s重拉一次
            if len(parsed) >= 10 and len({p['name'] for p in parsed}) < len(parsed) * 0.6:
                print(f'[TX] 批{i}疑似错位({len(parsed)}行/{len({p["name"] for p in parsed})}唯一名)，重拉')
                time.sleep(1)
                opener2 = urllib.request.build_opener()
                parsed = _parse(opener2.open(req, timeout=10).read().decode('gbk', errors='ignore'))
            out.extend(parsed)
            time.sleep(0.2)  # 限速防触发批量限流
        except Exception:
            continue
    return out

def _sina_snapshot():
    """全市场快照（生产可用源）：新浪行情列表分页，50页×100只，串行拉取
    （并发拉取生产上间歇错位——部分页 name 全同污染信号；串行+失败重试最稳）
    字段：名称/价格/涨跌幅/换手/成交额/市值（无 量比/主力资金 → 相关信号自动不命中）"""
    rows = []
    for p in range(1, 51):
        for attempt in range(2):  # 每页失败重试1次
            try:
                url = (f'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/'
                       f'Market_Center.getHQNodeData?page={p}&num=100&sort=changepercent&asc=0'
                       f'&node=hs_a&symbol=&_s_r_a=init')
                req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0', 'Referer': 'https://finance.sina.com.cn/'})
                opener = urllib.request.build_opener()  # 独立连接池（并发下共享连接池会响应串包→name错位）
                d = json.loads(opener.open(req, timeout=10).read())
                out = []
                for x in (d or []):
                    code = str(x.get('code', '')).zfill(6)
                    if not code or code == '000000': continue
                    out.append({
                        'code': code, 'name': x.get('name', ''),
                        'price': _num(x.get('trade')), 'change_pct': _num(x.get('changepercent')),
                        'amount': _num(x.get('amount')), 'turnover': _num(x.get('turnoverratio')),
                        'high': _num(x.get('high')), 'low': _num(x.get('low')), 'open': _num(x.get('open')),
                        'pre_close': _num(x.get('settlement')),
                        'mcap': _num(x.get('mktcap')), 'fcap': _num(x.get('nmc')),
                        'vol_ratio': None, 'main_net': None, 'chg5': None, 'speed': None,
                        'limit_up': None, 'limit_down': None,
                    })
                rows.extend(out)
                break
            except Exception:
                if attempt == 1:
                    pass  # 失败2次跳过该页（结果校验会兜底）
    # 按 code 去重（分页偶尔返回重复页→全同名垃圾快照）
    seen, dedup = set(), []
    for r in rows:
        if r['code'] in seen: continue
        seen.add(r['code']); dedup.append(r)
    # 污染过滤：Render IP 下新浪间歇返回错位页（该页 name 全同，出现100次）
    # 正常 A 股名称唯一 → 同一 name 出现超过3次的行是污染数据，剔除
    from collections import Counter
    name_cnt = Counter(r['name'] for r in dedup)
    clean = [r for r in dedup if name_cnt[r['name']] <= 3]
    if clean and len(clean) < len(dedup) * 0.7:
        print(f'[SNAPSHOT] 新浪污染过滤: {len(dedup)}→{len(clean)} 行')
    return clean or dedup

def ak_spot_snapshot():
    """全市场实时快照：akshare 优先，失败降级 push2delay clist 分页；进程内缓存60秒"""
    now = time.time()
    if _SNAP_CACHE['data'] is not None and now - _SNAP_CACHE['ts'] < 60:
        # 缓存命中也要校验（垃圾快照曾进缓存→60s内一直用→信号全同名）
        _uniq = len({(r.get('name') or '') for r in _SNAP_CACHE['data'][:200]})
        if _uniq >= 100:
            return _SNAP_CACHE['data']
        print(f'[SNAPSHOT] 缓存快照异常({_uniq}唯一名)，重新获取')
    with _SNAP_LOCK:
        if _SNAP_CACHE['data'] is not None and time.time() - _SNAP_CACHE['ts'] < 60:
            _uniq = len({(r.get('name') or '') for r in _SNAP_CACHE['data'][:200]})
            if _uniq >= 100:
                return _SNAP_CACHE['data']
            print(f'[SNAPSHOT] 锁内缓存快照异常({_uniq}唯一名)，重新获取')
        rows = None; src = None
        if AK_OK:
            # akshare 在海外(如 Render)访问国内数据源可能长时间挂起 → 线程超时 15s 强制降级
            _ak_result = {}
            def _ak_runner():
                try: _ak_result['rows'] = _ak_spot()
                except Exception as e: _ak_result['err'] = e
            _t = threading.Thread(target=_ak_runner, daemon=True)
            _t.start(); _t.join(15)
            if _t.is_alive():
                print('[SNAPSHOT] akshare超时(15s)，降级push2delay')
            elif 'err' in _ak_result:
                print(f'[SNAPSHOT] akshare失败，降级push2delay: {_ak_result["err"]}')
            else:
                rows = _ak_result.get('rows'); src = 'akshare'
        if not rows:
            try:
                rows = _tx_snapshot()
                src = 'tencent'
            except Exception as e:
                print(f'[SNAPSHOT] 腾讯快照失败: {e}')
                rows = None
        if not rows:
            try:
                rows = _sina_snapshot()
                src = 'sina'
            except Exception as e:
                print(f'[SNAPSHOT] 新浪快照失败: {e}')
                rows = None
        if not rows:
            try:
                rows = _clist_snapshot()
                src = 'push2delay'
            except Exception as e:
                print(f'[SNAPSHOT] push2delay也失败: {e}')
                rows = None
        # 快照数据校验（akshare 海外错位垃圾 / clist 被风控返回重复页 / 腾讯部分批次错位
        # 都会出现 name 全同/部分同名）：行数 < 1000 或唯一名称 < 100 → 丢弃；
        # 同一 name 出现 >3 次的行视为错位污染，剔除（正常 A 股名称唯一）
        if rows:
            uniq_names = len({(r.get('name') or '').strip() for r in rows})
            if len(rows) < 1000 or uniq_names < 100:
                print(f'[SNAPSHOT] 快照异常({len(rows)}行/{uniq_names}唯一名)丢弃，下次重取')
                rows = None
            else:
                # 错位过滤：正常A股名称唯一，任何重复 name（含空格/编码变体）都是污染行
                from collections import Counter as _Cnt
                _nc = _Cnt((r.get('name') or '').strip() for r in rows)
                _clean = [r for r in rows if _nc[(r.get('name') or '').strip()] <= 1]
                if _clean and len(_clean) < len(rows):
                    print(f'[SNAPSHOT] 错位过滤: {len(rows)}→{len(_clean)} 行')
                rows = _clean or rows
        if rows:
            _SNAP_CACHE['data'] = rows; _SNAP_CACHE['ts'] = time.time(); _SNAP_CACHE['src'] = src
            return rows
        # 双源都失败：返回旧快照（降级服务）——但旧快照也要校验（污染快照不能继续用）
        if _SNAP_CACHE['data']:
            _old = _SNAP_CACHE['data']
            _uniq = len({(r.get('name') or '') for r in _old[:300]})
            if _uniq >= 50:
                return _old
            print('[SNAPSHOT] 旧快照也异常，返回空')
        return None

# ---- 新股判定（上市<60日）：akshare新股列表 + K线长度兜底 ----
_NEW_LIST_CACHE = {'codes': None, 'ts': 0}
_NEW_KLINE_MEMO = {'date': '', 'map': {}}

def _new_stock_codes():
    """akshare 新股一览（日频缓存）"""
    if _NEW_LIST_CACHE['codes'] is not None and time.time() - _NEW_LIST_CACHE['ts'] < 43200:
        return _NEW_LIST_CACHE['codes']
    codes = set()
    if AK_OK:
        # akshare 海外挂起保护（同快照模式）：10s 超时降级为"无新股列表"（K线长度兜底）
        _r = {}
        def _runner():
            try: _r['df'] = ak.stock_zh_a_new()
            except Exception as e: _r['err'] = e
        _t = threading.Thread(target=_runner, daemon=True)
        _t.start(); _t.join(10)
        if _t.is_alive():
            print('[NEWLIST] akshare新股列表超时(10s)，降级K线长度判定')
        elif 'err' not in _r:
            try:
                for _, r in _r['df'].iterrows():
                    c = str(r.get('代码') or r.get('证券代码') or '')
                    if c: codes.add(c.zfill(6))
            except Exception:
                pass
    _NEW_LIST_CACHE['codes'] = codes
    _NEW_LIST_CACHE['ts'] = time.time()
    return codes

def _is_new_stock_kline(code, secid):
    """K线<60根视为新股（腾讯K线日级，已缓存）"""
    kl = KLINE_MEM.get(secid)
    if kl is None: kl = kline_get(secid)
    if kl is None: kl = fetch_kline(secid, fast=True)
    if kl is None: return False  # 拉不到不算新股（不误杀）
    r = len(kl) < 60
    _NEW_KLINE_MEMO['map'][code] = r
    return r

def _check_new_batch(codes):
    """批量新股检查：akshare列表即时判，其余K线长度（线程池，单轮最多60个网络检查）"""
    if not codes: return set()
    today = now_cst().strftime('%Y-%m-%d')
    if _NEW_KLINE_MEMO['date'] != today:
        _NEW_KLINE_MEMO['date'] = today
        _NEW_KLINE_MEMO['map'] = {}
    aks = _new_stock_codes()
    todo = [c for c in codes if c not in aks and c not in _NEW_KLINE_MEMO['map']][:20]
    if todo:
        def one(code):
            _is_new_stock_kline(code, _secid(code))
        with ThreadPoolExecutor(max_workers=4) as ex:  # 降频防限流（SCF 共享出口 IP）
            list(ex.map(one, todo))
    m = _NEW_KLINE_MEMO['map']
    return {c for c in codes if c in aks or m.get(c)}

# ---- 8信号（与旧引擎同阈值体系，涨停阈值按真实涨跌幅限制） ----
def _rt_sigs_new(row, mode=DEFAULT_MODE):
    rt = RT_CFG.get(mode, RT_CFG[DEFAULT_MODE])
    lp = limit_pct_of(row.get('code', ''), row.get('name', ''))
    chg = row.get('change_pct') or 0
    vr = row.get('vol_ratio') or 0
    turnover = row.get('turnover') or 0
    main_flow = row.get('main_net') or 0
    super_flow = row.get('super_net') or 0
    return {
        'sig_zt': chg >= lp - 0.5,                                   # 已封板
        'sig_pump': rt['pump'] <= chg < lp,                          # 大幅拉升
        'sig_vr': vr >= rt['vr'],                                    # 量比异动
        'sig_turn': turnover >= rt['turn'],                          # 换手激增
        'sig_flow': main_flow > rt['flow'],                          # 主力净流入
        'sig_super': super_flow > rt['super'],                       # 超大单扫货
        'sig_reverse': 0 < chg < 4 and vr >= 2,                      # 低开高走反包
        'sig_dump': chg <= -3 and vr >= 2,                           # 放量出货（负向不计分）
    }

# ---- 2帧确认 + 机会状态机 ----
_RT2_STATE = {
    'pending': {},      # code -> {sig: {'snap': 首帧快照ts, 'ts': 首帧时间}}
    'confirmed': {},    # code -> {sig: 最近确认时间}
    'discovered': {},   # code -> {'at': 首次发现epoch}
    'hot_items': [], 'hot_zt': [], 'hot_ts': 0,
    'full_items': [], 'full_zt': [], 'full_ts': 0,
}
_RT2_LOCK = threading.Lock()

def _confirm_signals(code, hit_sigs, now, snap_ts):
    """2帧确认：同一信号需在 2 个不同快照连续命中才报（同快照内的热区重复帧不计数）"""
    pend = _RT2_STATE['pending'].setdefault(code, {})
    conf = _RT2_STATE['confirmed'].setdefault(code, {})
    for sig in list(pend):
        if sig not in hit_sigs or now - pend[sig]['ts'] > 150:
            del pend[sig]
    for sig in list(conf):
        if sig not in hit_sigs:
            del conf[sig]
    ok = False
    for sig in hit_sigs:
        if sig in conf:
            conf[sig] = now
            ok = True
        elif sig in pend and now - pend[sig]['ts'] > 10:
            # 2帧确认：10秒前的信号再次命中 → 确认（不依赖快照时间戳——
            # 快照有60s缓存导致 snap_ts 相同，原判断永远无法确认 → items 永远为空）
            conf[sig] = now
            pend.pop(sig, None)
            ok = True
        else:
            pend[sig] = {'snap': snap_ts, 'ts': now}
    if not conf:
        _RT2_STATE['confirmed'].pop(code, None)
        if not _RT2_STATE['pending'].get(code):  # 仅当无挂起信号时才清理（第一帧的pending需保留）
            _RT2_STATE['pending'].pop(code, None)
    return ok

def _hot_snapshot(snap):
    """热区：按涨速/涨幅排序前800只"""
    return sorted(snap, key=lambda r: (
        (r.get('speed') if r.get('speed') is not None else -99),
        (r.get('change_pct') if r.get('change_pct') is not None else -99),
    ), reverse=True)[:800]

def _process_snapshot(snap, mode, now, snap_ts):
    """对快照算信号→过滤（ST/新股/换手/成交额）→2帧确认→组装 items/zt_new"""
    st = _RT2_STATE
    zt_new = []
    cands = []      # (code, row, sigs, score, dist)
    zt_codes = []
    for row in snap:
        code = row.get('code', '')
        name = (row.get('name') or '').strip()
        if not code or not name: continue
        if 'ST' in name.upper(): continue
        sigs = _rt_sigs_new(row, mode)
        chg = row.get('change_pct') or 0
        dist = dist_limit_of(row)
        is_zt = (dist is not None and dist < 1) or (dist is None and sigs.get('sig_zt'))
        if is_zt:
            # 已涨停 → 涨停池（不进 items）
            if (row.get('amount') or 0) >= 5e7:
                zt_codes.append(code)
                zt_new.append({
                    'code': code, 'name': name, 'change_pct': chg, 'price': row.get('price'),
                    'seal_amount': round(row.get('main_net') or 0),   # 封单额代理：主力净流入
                    'secid': _secid(code), 'board': board_of(code, name),
                })
            continue
        score = sum(1 for k, v in sigs.items() if v and k != 'sig_dump')
        if sigs.get('sig_zt'): score += 1
        if score <= 0: continue
        if (row.get('turnover') or 0) < 1: continue      # 换手<1% 过滤
        if (row.get('amount') or 0) < 5e7: continue      # 成交额<5000万 过滤
        cands.append((code, row, sigs, score, dist))
    # 新股检查（akshare新股列表 + K线<60日兜底）
    new_set = _check_new_batch([c for c, _, _, _, _ in cands] + zt_codes)
    cands = [x for x in cands if x[0] not in new_set]
    if zt_codes:
        zt_new = [z for z in zt_new if z['code'] not in new_set]
    # 2帧确认 + 组装
    items = []
    sig_names = ('sig_zt', 'sig_pump', 'sig_vr', 'sig_turn', 'sig_flow',
                 'sig_super', 'sig_reverse', 'sig_dump')
    for code, row, sigs, score, dist in cands:
        hit = {k for k, v in sigs.items() if v}
        if not _confirm_signals(code, hit, now, snap_ts):
            continue
        name = (row.get('name') or '').strip()  # 每行自己的名称（勿用循环残留变量——曾致全信号同名）
        chg = row.get('change_pct') or 0
        disc = st['discovered'].get(code)
        if disc is None:
            disc = {'at': now}
            st['discovered'][code] = disc
            is_new = True
        else:
            is_new = False
        vr = row.get('vol_ratio') or 0
        main_flow = row.get('main_net') or 0
        super_flow = row.get('super_net') or 0
        board = board_of(code, name)
        items.append({
            'code': code, 'name': name,
            'price': row.get('price'), 'change_pct': chg,
            'turnover': row.get('turnover'), 'vol_ratio': vr,
            'main_net': main_flow, 'dist_limit': dist,
            'participate': participate_of(dist),
            'discovered_at': datetime.fromtimestamp(disc['at'], tz=_CST).strftime('%H:%M'),
            'duration': int((now - disc['at']) / 60),
            'is_new': is_new, 'score': score,
            'signals': [k for k in sig_names if sigs.get(k)],
            # 兼容旧字段（前端实时tab依赖）
            'secid': _secid(code), 'board': {'board': board},
            'vr': vr, 'main_flow': main_flow, 'super_flow': super_flow,
            **sigs,
        })
    items.sort(key=lambda x: (-x.get('score', 0), x.get('dist_limit') or 99))
    zt_new.sort(key=lambda z: z.get('seal_amount', 0), reverse=True)
    if len(st['discovered']) > 3000:  # 防内存膨胀：清最早500
        for c in sorted(st['discovered'], key=lambda c: st['discovered'][c]['at'])[:500]:
            st['discovered'].pop(c, None)
    return items, zt_new[:100]

def _rt_response(items, zt, now, data_date, trading=True, from_cache=True, error=None):
    resp = {
        'items': items, 'zt_new': zt,
        'new_items': [i for i in items if i.get('is_new')][:20],
        'hot_ts': _RT2_STATE['hot_ts'], 'full_ts': _RT2_STATE['full_ts'],
        'is_trading': trading, 'data_date': data_date,
        'updated': now_cst().isoformat(),
        'from_cache': from_cache, 'total': len(items),
    }
    if error: resp['error'] = error
    return resp

# ---- 交易日历 ----
_TRADE_CAL = {'dates': None, 'ts': 0}

def trade_calendar():
    """akshare 交易日历（sina源，缓存12小时）；失败返回 None（降级为仅周末判断）"""
    if AK_OK and (_TRADE_CAL['dates'] is None or time.time() - _TRADE_CAL['ts'] > 43200):
        # akshare 海外挂起保护：10s 超时降级（否则每次扫描都卡死在这里）
        _r = {}
        def _runner():
            try: _r['df'] = ak.tool_trade_date_hist_sina()
            except Exception as e: _r['err'] = e
        _t = threading.Thread(target=_runner, daemon=True)
        _t.start(); _t.join(10)
        if _t.is_alive():
            print('[CAL] akshare日历超时(10s)，降级仅周末判断')
        elif 'err' not in _r:
            try:
                _TRADE_CAL['dates'] = set(str(x).replace('-', '')[:8] for x in _r['df']['trade_date'].tolist())
                _TRADE_CAL['ts'] = time.time()
            except Exception:
                pass
    return _TRADE_CAL['dates']

def is_trade_day(dt):
    """是否交易日：周末直接否；akshare日历可用时进一步排除节假日"""
    if dt.weekday() >= 5: return False
    cal = trade_calendar()
    if cal is None: return True
    return dt.strftime('%Y%m%d') in cal

def trading_status_calendar():
    """交易日历增强的交易状态：节假日不扫描"""
    trading, data_date = trading_status()
    if trading:
        cal = trade_calendar()
        if cal is not None and now_cst().strftime('%Y%m%d') not in cal:
            trading = False
    return trading, data_date

def scan_opportunities(mode=DEFAULT_MODE, force=False):
    """分层实时机会扫描：
    - 快照：akshare 优先 / push2delay 兜底（进程内60秒缓存）
    - 热区（top800 按涨速/涨幅）15秒缓存 hot_ts；全市场 60秒缓存 full_ts
    - 信号2帧确认（2个不同快照连续命中）、可参与过滤、增量 new_items、涨停池 zt_new
    """
    with _RT2_LOCK:
        now = time.time()
        trading, data_date = trading_status_calendar()
        st = _RT2_STATE
        if not trading:
            # 非交易时段：不扫描，返回缓存（如有）并标记 is_trading=False
            items = st['full_items'] or st['hot_items']
            zt = st['full_zt'] or st['hot_zt']
            return _rt_response(items, zt, now, data_date, trading=False, from_cache=bool(items))
        snap = ak_spot_snapshot()
        if not snap:
            items = st['full_items'] or st['hot_items']
            zt = st['full_zt'] or st['hot_zt']
            return _rt_response(items, zt, now, data_date, trading=True, from_cache=True, error='行情快照获取失败')
        snap_ts = _SNAP_CACHE['ts']
        recomputed = False
        if force or now - st['full_ts'] >= 60:
            items, zt = _process_snapshot(snap, mode, now, snap_ts)
            st['full_items'], st['full_zt'], st['full_ts'] = items, zt, now
            recomputed = True
        if force or now - st['hot_ts'] >= 15:
            hot_items, hot_zt = _process_snapshot(_hot_snapshot(snap), mode, now, snap_ts)
            st['hot_items'], st['hot_zt'], st['hot_ts'] = hot_items, hot_zt, now
            recomputed = True
        if now - st['full_ts'] < 60:
            items, zt = st['full_items'], st['full_zt']
        else:
            items, zt = st['hot_items'], st['full_zt'] or st['hot_zt']
        return _rt_response(items, zt, now, data_date, trading=True, from_cache=not recomputed)

# ========== 个股画像（腾讯分时 → 日特征 → SQLite 20日滚动） ==========
def _ensure_profile_table():
    with sqlite3.connect(DB) as c:
        c.execute('CREATE TABLE IF NOT EXISTS profile_feats (date TEXT, code TEXT, data TEXT, PRIMARY KEY (date, code))')

def fetch_minute_tencent(code):
    """腾讯当日分时：返回 (date 'YYYYMMDD', [(hhmm, price, vol), ...])"""
    prefix = 'sh' if code.startswith(('6', '9')) else 'sz'
    url = f'https://web.ifzq.gtimg.cn/appstock/app/minute/query?code={prefix}{code}'
    req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0', 'Referer': 'https://gu.qq.com/'})
    d = json.loads(urllib.request.urlopen(req, timeout=8).read())
    node = d['data'][f'{prefix}{code}']['data']
    date = str(node.get('date', ''))
    raw = node.get('data', [])
    lines = raw if isinstance(raw, list) else str(raw).replace(';', '\n').split('\n')
    pts = []
    for ln in lines:
        ln = ln.strip()
        if not ln: continue
        parts = ln.split()
        if len(parts) < 3: continue
        t = parts[0]
        if t == 'time' or not t.isdigit(): continue
        try:
            pts.append((t, float(parts[1]), float(parts[2])))
        except Exception:
            continue
    return date, pts

def extract_profile_feats(code, date_str, pts):
    """从当日分时提取 ~20 个数值特征（只存特征，不存原始分时）"""
    if not pts or len(pts) < 60: return None
    def mt(s): return int(s[:2]) * 60 + int(s[2:4])
    times = [mt(t) for t, _, _ in pts]
    prices = [p for _, p, _ in pts]
    vols = [v for _, _, v in pts]
    if not prices or prices[0] <= 0: return None
    open_p = prices[0]; close_p = prices[-1]
    def pct(a, b): return (a / b - 1) * 100 if b else 0.0
    # 日K辅助：昨收（算全天涨跌幅）+ 前5日均量（算量能比），只用缓存不新拉网络
    prev_close = None; avg5v = None; chg_day = pct(close_p, open_p)
    try:
        secid = _secid(code)
        kl = KLINE_MEM.get(secid)
        if kl is None: kl = kline_get(secid)
        if kl:
            ds = date_str.replace('-', '')
            prev_days = [k for k in kl if (k.get('t') or '').replace('-', '') < ds]
            if prev_days:
                prev_close = prev_days[-1]['c']
                v5 = [k['v'] for k in prev_days[-5:]]
                if len(v5) >= 3: avg5v = sum(v5) / len(v5)
                chg_day = pct(close_p, prev_close)
    except Exception:
        pass
    # 开盘30分钟（10:00 前最后一条）
    open30 = open_p
    for t, p in zip(times, prices):
        if t >= 600: open30 = p; break
    open30_chg = pct(open30, open_p)
    # 午前/午后线性回归斜率（%/min）
    def slope(lo, hi):
        sub = [(t, p) for t, p in zip(times, prices) if lo <= t <= hi]
        if len(sub) < 20: return 0.0
        n = len(sub); xs = [x for x, _ in sub]; ys = [y for _, y in sub]
        mx = sum(xs) / n; my = sum(ys) / n
        cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
        var = sum((x - mx) ** 2 for x in xs)
        if var == 0 or my == 0: return 0.0
        return (cov / var) / my * 100
    pre_slope = slope(570, 690)      # 9:30-11:30
    post_slope = slope(780, 900)     # 13:00-15:00
    # 尾盘30分钟（14:30-15:00）
    tail = [(t, p) for t, p in zip(times, prices) if t >= 870]
    if len(tail) >= 2:
        tail30_speed = pct(tail[-1][1], tail[0][1])
        tail_max = max(pct(p2, p1) for (_, p1), (_, p2) in zip(tail, tail[1:]))
    else:
        tail30_speed = 0.0; tail_max = 0.0
    # 单分钟涨速（pts 元素为 (hhmm, price, vol) 三元组）
    speeds = [pct(p2, p1) for (_, p1, _v1), (_, p2, _v2) in zip(pts, pts[1:]) if p1]
    avg_speed = sum(speeds) / len(speeds) if speeds else 0.0
    max_speed = max(speeds) if speeds else 0.0
    today_vol = sum(vols)
    up_minutes = sum(1 for (_, p1, _v1), (_, p2, _v2) in zip(pts, pts[1:]) if p2 > p1)
    down_minutes = sum(1 for (_, p1, _v1), (_, p2, _v2) in zip(pts, pts[1:]) if p2 < p1)
    hi_i = prices.index(max(prices)); lo_i = prices.index(min(prices))
    def hhmm(t): return f'{t // 60:02d}:{t % 60:02d}'
    return {
        'chg_day': round(chg_day, 2),
        'open30_chg': round(open30_chg, 2),
        'pre_slope': round(pre_slope, 4),
        'post_slope': round(post_slope, 4),
        'tail30_speed': round(tail30_speed, 2),
        'tail30_max': round(tail_max, 2),
        'avg_speed': round(avg_speed, 4),
        'max_speed': round(max_speed, 2),
        'vol_ratio': round(today_vol / avg5v, 2) if avg5v else None,
        'tail_pull': 1 if (tail30_speed > 1.5 or tail_max > 0.4) else 0,   # 尾盘急拉
        'open_pull': 1 if open30_chg > 2 else 0,                            # 开盘拉升
        'morning_up': 1 if pre_slope > 0.05 else 0,                         # 午前走强
        'afternoon_up': 1 if post_slope > 0.05 else 0,                      # 午后走强
        'high_time': hhmm(times[hi_i]), 'low_time': hhmm(times[lo_i]),
        'up_minutes': up_minutes, 'down_minutes': down_minutes,
        'flat_minutes': max(0, len(speeds) - up_minutes - down_minutes),
        'range': round((max(prices) - min(prices)) / open_p * 100, 2),
        'avg_vol_min': round(today_vol / len(pts), 0),
        'vol_sum': round(today_vol, 0),
    }

def collect_profiles(limit=200):
    """每日19:30：对 深扫+关注+持仓（上限200只）拉当日分时→提取特征→入库（20日滚动删除）"""
    try:
        today = now_cst().strftime('%Y-%m-%d')
        if not is_trade_day(now_cst()):
            print(f'[PROFILE] {today} 非交易日，跳过')
            return 0
        _ensure_profile_table()
        codes = []
        seen = set()
        try:
            with sqlite3.connect(DB) as c:
                for (code,) in c.execute('SELECT code FROM watchlist'):
                    code = str(code).strip()
                    if code and code not in seen: seen.add(code); codes.append(code)
        except Exception: pass
        try:
            for h in (cache_get('holdings') or []):
                code = str(h.get('code', '')).strip()
                if code and code not in seen: seen.add(code); codes.append(code)
        except Exception: pass
        # 深扫股票：各模式预测 top150 补足
        for m in ('swing', get_user_mode()):
            d = cache_get(f'prediction_{m}') or {}
            for it in d.get('items', [])[:150]:
                code = str(it.get('code', '')).strip()
                if code and code not in seen: seen.add(code); codes.append(code)
        codes = codes[:limit]
        if not codes: return 0
        have = set()
        with sqlite3.connect(DB) as c:
            for (d_, code) in c.execute('SELECT date, code FROM profile_feats WHERE date=?', (today,)):
                have.add(code)
        todo = [c for c in codes if c not in have]
        if not todo: return 0
        today_c = today.replace('-', '')
        def work(code):
            try:
                date2, pts = fetch_minute_tencent(code)
                if not pts or date2 != today_c: return None   # 分时日期非当日（停牌等）跳过
                feats = extract_profile_feats(code, today, pts)
                if not feats: return None
                return (code, feats)
            except Exception:
                return None
        results = []
        with ThreadPoolExecutor(max_workers=4) as ex:  # 降频防限流（SCF 共享出口 IP）
            for r in ex.map(work, todo):
                if r: results.append(r)
        if results:
            with sqlite3.connect(DB) as c:
                c.executemany('REPLACE INTO profile_feats (date, code, data) VALUES (?,?,?)',
                              [(today, code, json.dumps(f, ensure_ascii=False)) for code, f in results])
        with sqlite3.connect(DB) as c:
            c.execute("DELETE FROM profile_feats WHERE date < date(?, '-20 days')", (today,))
        print(f'[PROFILE] {today} 已存 {len(results)}/{len(todo)} 只特征')
        return len(results)
    except Exception as e:
        print(f'[PROFILE ERROR] {e}')
        return 0

@app.route('/api/profile')
def api_profile():
    """个股画像：近20日分时特征聚合（拉升时段分布/尾盘习惯/量能性格/异常次数）"""
    code = str(request.args.get('code', '')).strip()
    if not code:
        return jsonify({'ok': False, 'error': '缺少 code 参数'})
    try:
        _ensure_profile_table()
        with sqlite3.connect(DB) as c:
            rows = c.execute('SELECT date, data FROM profile_feats WHERE code=? ORDER BY date DESC LIMIT 20', (code,)).fetchall()
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)})
    if not rows:
        return jsonify({'ok': False, 'code': code, 'error': '暂无画像数据（每日19:30后生成）'})
    days = [{'date': d, **(json.loads(raw) or {})} for d, raw in rows]
    days.reverse()
    n = len(days)
    def rate(cond):
        return round(sum(1 for d_ in days if cond(d_)) / n * 100)
    summary = {
        'lift_periods': {
            '开盘拉升_9_30_10_00': rate(lambda d: d.get('open_pull', 0)),
            '午前走强_9_30_11_30': rate(lambda d: d.get('morning_up', 0)),
            '午后走强_13_00_15_00': rate(lambda d: d.get('afternoon_up', 0)),
            '尾盘急拉_14_30_15_00': rate(lambda d: d.get('tail_pull', 0)),
        },
        'tail_habit': {
            '尾盘急拉天数': sum(1 for d in days if d.get('tail_pull')),
            '尾盘30min平均涨速_pct': round(sum(d.get('tail30_speed', 0) for d in days) / n, 2),
            '尾盘30min最大涨速_pct': round(max(d.get('tail30_max', 0) for d in days), 2),
            '平均尾盘急拉幅度_pct': round(sum(d.get('tail30_speed', 0) for d in days if d.get('tail_pull')) / max(sum(1 for d in days if d.get('tail_pull')), 1), 2),
        },
        'volume_style': {
            '量比均值': round(sum(d.get('vol_ratio') or 0 for d in days) / n, 2),
            '量比最大': round(max(d.get('vol_ratio') or 0 for d in days), 2),
            '放量日占比_pct': rate(lambda d: (d.get('vol_ratio') or 0) > 1.5),
            '缩量日占比_pct': rate(lambda d: (d.get('vol_ratio') or 0) < 0.7),
        },
        'anomaly': {
            '急速脉冲_单分钟_2pct': sum(1 for d in days if (d.get('max_speed') or 0) > 2),
            '剧烈波动_振幅8pct': sum(1 for d in days if (d.get('range') or 0) > 8),
            '单边上涨日_上涨分钟占比70pct': sum(1 for d in days if (d.get('up_minutes') or 0) > 0 and d.get('up_minutes') / max(d.get('up_minutes') + d.get('down_minutes', 0), 1) > 0.7),
            '早盘拉升后回落_开盘30min_2pct且收跌': sum(1 for d in days if d.get('open_pull') and (d.get('chg_day') or 0) < 0),
        },
    }
    return jsonify({'ok': True, 'code': code, 'days': n, 'summary': summary, 'recent': days[-5:]})

# ========== 持仓云端同步 ==========
@app.route('/api/holdings', methods=['GET'])
def api_holdings_get():
    with sqlite3.connect(DB) as c:
        row = c.execute('SELECT data, updated FROM cache WHERE key=?', ('holdings',)).fetchone()
    if row:
        return jsonify({'ok': True, 'items': json.loads(row[0]), 'updated': row[1]})
    return jsonify({'ok': True, 'items': [], 'updated': None})

@app.route('/api/holdings', methods=['POST'])
def api_holdings_set():
    data = request.get_json() or {}
    items = data.get('items', [])
    # 只存必要字段，避免坏数据
    safe = []
    for h in items:
        if not h.get('secid'): continue
        safe.append({
            'secid': str(h['secid']), 'code': str(h.get('code','')),
            'name': str(h.get('name','')), 'shares': float(h.get('shares',0) or 0),
            'cost': float(h.get('cost',0) or 0),
        })
    cache_set('holdings', safe)
    return jsonify({'ok': True, 'count': len(safe)})

# ========== 盘前预测/盘后总结 ==========
def forecast_sync_github(date_str, ftype, data):
    """把记录同步到私有GitHub仓库（持久化，Render磁盘会清）"""
    token = os.environ.get('GITHUB_TOKEN', '')
    repo = os.environ.get('GITHUB_REPO', 'pj-mmsn/stock-mobile-data')
    global GH_REPO
    GH_REPO = repo
    if not token: return  # 未配置环境变量则跳过
    try:
        path = f'forecast/{date_str}-{ftype}.json'
        content = json.dumps(data, ensure_ascii=False, indent=1)
        # 获取已有文件 sha（覆盖用）
        sha = None
        try:
            req = urllib.request.Request(f'https://api.github.com/repos/{repo}/contents/{path}',
                                         headers={'Authorization': f'token {token}', 'User-Agent': 'stock-mobile'})
            resp = urllib.request.urlopen(req, timeout=10)
            sha = json.loads(resp.read()).get('sha')
        except Exception: pass
        body = {'message': f'{date_str} {ftype} 存档', 'content': __import__('base64').b64encode(content.encode()).decode()}
        if sha: body['sha'] = sha
        req = urllib.request.Request(f'https://api.github.com/repos/{repo}/contents/{path}',
                                     data=json.dumps(body).encode(),
                                     headers={'Authorization': f'token {token}', 'User-Agent': 'stock-mobile', 'Content-Type': 'application/json'},
                                     method='PUT')
        urllib.request.urlopen(req, timeout=15)
        print(f"[GITHUB] {date_str}-{ftype} 已同步")
    except Exception as e:
        print(f"[GITHUB SYNC ERROR] {e}")

def forecast_save(date_str, ftype, data):
    with sqlite3.connect(DB) as c:
        c.execute('REPLACE INTO forecast_history VALUES (?,?,?,?)',
                  (date_str, ftype, time.time(), json.dumps(data, ensure_ascii=False)))
    # 持久化：COS 为主（SCF 同云稳定），GitHub 为备份（SCF 出口 IP 调 GitHub 不可靠）
    _cos_put(f'forecast/{date_str}-{ftype}.json', json.dumps(data, ensure_ascii=False))
    forecast_sync_github(date_str, ftype, data)

GH_REPO = 'pj-mmsn/stock-mobile-data'

_GH_LIST_CACHE = {}  # path -> (ts, data)

def _gh_repo_list(path):
    """GitHub 私有仓列目录（SCF 无持久盘的存档回源；结果缓存 300s 防限流）"""
    now = time.time()
    if path in _GH_LIST_CACHE and now - _GH_LIST_CACHE[path][0] < 300:
        return _GH_LIST_CACHE[path][1]
    token = os.environ.get('GITHUB_TOKEN', '')
    if not token: return None
    try:
        req = urllib.request.Request(f'https://api.github.com/repos/{GH_REPO}/contents/{path}',
                                     headers={'Authorization': f'token {token}', 'User-Agent': 'stock-mobile'})
        data = json.loads(urllib.request.urlopen(req, timeout=10).read())
        if isinstance(data, list):
            _GH_LIST_CACHE[path] = (now, data)
            return data
        return None
    except Exception as e:
        print(f'[GH LIST ERROR] {path}: {str(e)[:120]}')
        return None

def _gh_load(date_str, ftype):
    """从 GitHub 私有仓拉存档文件"""
    token = os.environ.get('GITHUB_TOKEN', '')
    if not token: return None
    try:
        req = urllib.request.Request(f'https://api.github.com/repos/{GH_REPO}/contents/forecast/{date_str}-{ftype}.json',
                                     headers={'Authorization': f'token {token}', 'User-Agent': 'stock-mobile'})
        raw = json.loads(urllib.request.urlopen(req, timeout=10).read())
        content = base64.b64decode(raw.get('content', '')).decode('utf-8')
        return json.loads(content)
    except Exception:
        return None

def _latest_morning():
    """最近一次 morning 存档（预测文件名为生成日，跨天后仍可用：昨晚预测=今天用）"""
    today = now_cst().strftime('%Y-%m-%d')
    m, _ = forecast_load(today, 'morning')
    if m and m.get('items'):
        return m
    # 服务器版兜底：本地 SQLite 直接取最新一条 morning（不依赖 COS/GH 凭证；
    # 周末/节假日无新预测时，周五预测在周六日仍可见，否则回源失败就返回"扫描中"）
    try:
        with sqlite3.connect(DB) as c:
            _row = c.execute(
                "SELECT date FROM forecast_history WHERE type='morning' "
                "ORDER BY created DESC LIMIT 1").fetchone()
        if _row and _row[0] != today:
            m, _ = forecast_load(_row[0], 'morning')
            if m and m.get('items'):
                return m
    except Exception:
        pass
    # 今天的没有 → 列目录取最新一条 morning（COS 主，GitHub 备；按日期倒序=最新优先）
    cos_names = sorted([n for n in _cos_list('forecast/') if n.rsplit('/', 1)[-1].endswith('-morning.json')], reverse=True)
    for name in cos_names:
        bn = name.rsplit('/', 1)[-1]
        if len(bn) >= 19:
            m, _ = forecast_load(bn[:10], 'morning')
            if m and m.get('items'):
                return m
    gh_files = _gh_repo_list('forecast')
    if gh_files:
        names = sorted([f.get('name', '') for f in gh_files if f.get('name', '').endswith('-morning.json')], reverse=True)
        for n in names[:3]:
            m, _ = forecast_load(n[:10], 'morning')
            if m and m.get('items'):
                return m
    return None

def forecast_load(date_str, ftype):
    """读存档：本地 SQLite 优先，无则 GitHub 回源（SCF 实例回收后数据仍在）"""
    try:
        with sqlite3.connect(DB) as c:
            row = c.execute('SELECT data, created FROM forecast_history WHERE date=? AND type=?',
                            (date_str, ftype)).fetchone()
        if row: return (json.loads(row[0]), row[1])
    except Exception: pass
    cos = _cos_get(f'forecast/{date_str}-{ftype}.json')
    if cos:
        try: return (json.loads(cos), time.time())
        except Exception: pass
    gh = _gh_load(date_str, ftype)
    return (gh, time.time()) if gh else (None, None)

def get_user_mode():
    """读取用户当前周期模式（前端切换时上报；SCF 走 COS 跨实例持久化，防实例回收丢失）"""
    try:
        v = cache_get('user_mode')
        if v in MODE_CFG: return v
    except Exception: pass
    return DEFAULT_MODE

def _scan_batch_set(date_str, mode, batch, status):
    """断点扫描状态表（scan_batch）；SCF 两批定时各写各的，跨实例以 COS morning 存档为准"""
    try:
        with sqlite3.connect(DB) as c:
            # 兼容旧库：表不存在时自建（init_db 未跑或老部署库）
            c.execute('''CREATE TABLE IF NOT EXISTS scan_batch (
                date TEXT, mode TEXT, batch INTEGER, status TEXT,
                PRIMARY KEY (date, mode, batch))''')
            c.execute('INSERT OR REPLACE INTO scan_batch VALUES (?,?,?,?)',
                      (date_str, mode, batch, status))
    except Exception as e:
        print(f'[SCAN_BATCH SET ERROR] {e}')

def _scan_batch_get(date_str, mode, batch):
    try:
        with sqlite3.connect(DB) as c:
            row = c.execute('SELECT status FROM scan_batch WHERE date=? AND mode=? AND batch=?',
                            (date_str, mode, batch)).fetchone()
        return row[0] if row else None
    except Exception:
        return None

def _morning_done(date_str):
    """两批完成状态（以 COS/GitHub 存档为准，跨实例可靠）"""
    try:
        m, _ = forecast_load(date_str, 'morning')
        return set((m or {}).get('batches_done') or [])
    except Exception:
        return set()

def _resolve_batch(event, cmd):
    """解析定时触发批次：显式 batch > Message 正则 > 触发档期（20-39分→批0、40-59/0-5分→批1）"""
    _b = event.get('batch')
    if _b is not None:
        try: return int(_b)
        except Exception: pass
    import re as _re
    _mb = _re.match(r'forecast[_\-]?b(?:atch)?\s*([01])', cmd)
    if _mb: return int(_mb.group(1))
    _min = now_cst().minute
    if 20 <= _min <= 39: return 0
    if _min >= 40 or _min <= 5: return 1
    return None

def _merge_morning_items(date_str, batch, new_items):
    """断点增量合并：已有 morning 存档 items 与本批结果按 code 合并（本批覆盖旧值）；
    created 保留首条（19:30批），保证 _valid_morning 的时段校验不被批1的存档时间破坏"""
    prev, _ = forecast_load(date_str, 'morning')
    created = now_cst().isoformat()
    have = {}
    batches_done = []
    if prev and prev.get('items'):
        have = {str(i.get('code')): i for i in prev['items']}
        batches_done = list(prev.get('batches_done') or [])
        if prev.get('created'):
            created = prev['created']
    for i in new_items:
        have[str(i.get('code'))] = i
    if batch not in batches_done:
        batches_done.append(batch)
    merged = sorted(have.values(), key=lambda x: x.get('score', 0), reverse=True)
    return merged, sorted(batches_done), created

def _run_forecast_batch(cands, total, date_str, mode, strip_last, batch):
    """单批深扫 + 断点增量存档（本批结果与已有 morning 存档合并后 save/cache，防 900s 强杀丢数据）"""
    _scan_batch_set(date_str, mode, batch, 'running')
    # 环境系数（D1-⑤）：批次开始前取一次，贯穿本批全部深扫的仓位计算
    env = env_temperature()
    env_coef = env.get('coef', 1.0) if env else 1.0
    deep = deep_analyze(cands, len(cands), strip_last=strip_last, mode=mode, env_coef=env_coef)
    deep = [i for i in deep if i.get('score',0) >= 2]  # 1分弱信号不入池（全市场1分1928只=刷屏，收紧）
    deep.sort(key=lambda x: x.get('score',0), reverse=True)
    top = []
    for i in deep:
        top.append({
            'code': i.get('code'), 'name': i.get('name'), 'score': i.get('score',0),
            'price': i.get('price'), 'change_pct': i.get('change_pct'),
            'secid': i.get('secid'), 'board': (i.get('board') or {}).get('board'),
            'sigs': [k for k in ['sig_trend','sig_breakH','sig_vcp','sig_maBull','sig_wyckoff',
                'sig_value','sig_fib','sig_bollSq','sig_kdj','sig_volDry','sig_leader',
                'sig_maTight','sig_lowBuy','sig_theme'] if i.get(k)],
            'lbc': i.get('lbc', 0),
            'industry': i.get('industry', ''),
            'entry': (i.get('trade') or {}).get('entry'),
            'stop': (i.get('trade') or {}).get('stop'),
            'target': (i.get('trade') or {}).get('target'),
            'target2': (i.get('trade') or {}).get('target2'),
            'winrate': i.get('winrate'),
            'streak': i.get('streak'),
            'levels': i.get('levels'),
            'rsi6': (i.get('levels') or {}).get('rsi6'),
            'rsi14': (i.get('levels') or {}).get('rsi'),
        })
    merged_items, batches_done, created = _merge_morning_items(date_str, batch, top)
    mode_name = {'short': '超短', 'swing': '波段', 'long': '长线'}.get(mode, mode)
    forecast_save(date_str, 'morning', {'items': merged_items, 'total_scanned': total,
        'created': created, 'mode': mode, 'batch': batch, 'batches_done': batches_done,
        'env': env,
        'summary': f'明日预测 {len(merged_items)} 只（{mode_name}模式 · 满分信号扫描 {total} 只，含当日收盘数据 · 批次{batches_done}）'})
    # 回写 prediction_* 缓存（每批完成即前端可见增量；批1完成后为全量）
    cfg = MODE_CFG.get(mode, MODE_CFG[DEFAULT_MODE])
    # 【D4】主线题材明细随预测下发（前端展示"今日主线"）
    _ml, _theme_detail = _theme_mainline()
    cache_set('prediction_' + mode, {'items': merged_items, 'total': total,
                                     'stage': 'deep' if batch == 1 else 'batch0',
                                     'maxScore': 6 + cfg['w_value'] + cfg['w_leader'] + cfg['w_theme'],
                                     'themes': _theme_detail,
                                     'updated': now_cst().isoformat(), 'mode': mode, '_ts': time.time(),
                                     'env': env})
    _scan_batch_set(date_str, mode, batch, 'done')
    print(f"[MORNING] {date_str} 明日预测 batch={batch} 完成: 本批{len(top)}只 累计{len(merged_items)}只 (mode={mode})")

def run_morning_forecast(strip_last=False, mode=None, batch=None):
    """明日预测：晚间19:30/晨间06:30跑（按用户当前模式）。收盘后不剥最后一根（含当天完整数据预测明天）。
    防 SCF 900s 超时：按 quick_score 拆两批（批0=前55%高分、批1=剩余45%），每批增量存档。
    batch=None 两批连跑（本地 scanner_loop/手动触发，全量不截断）；
    batch=0/1 单批（SCF 定时触发器分两次调 main_handler，批1跨实例时从 COS 回源合并；
    quick 候选列表批0完成后存 COS，批1直接复用免重拉全市场）。"""
    if mode is None: mode = get_user_mode()
    try:
        date_str = now_cst().strftime('%Y-%m-%d')
        qr_key = f'morning_qr_{date_str}_v2'  # v2: industry 用 f100（旧 v1 键 f127 垃圾值弃用）
        qr = None
        total = 0
        if batch is not None:
            # 跨批复用：批0 已存的候选列表（含 quick_score），免重拉全市场
            _c = cache_get(qr_key)
            if _c and isinstance(_c.get('qr'), list) and _c['qr']:
                qr, total = _c['qr'], _c.get('total', 0)
                print(f'[MORNING] 复用 quick 候选 {len(qr)} 只 (batch={batch})')
        if not qr:
            items, total = quick_scan(55, mode=mode)
            qr = sorted(items, key=lambda x: x.get('quick_score', 0), reverse=True)
            try:
                cache_set(qr_key, {'qr': qr, 'total': total})  # 批0存COS，批1跨实例免重拉
            except Exception as e:
                print(f'[MORNING] qr cache error {e}')
        n0 = int(len(qr) * 0.55)
        slices = {0: qr[:n0], 1: qr[n0:]}
        to_run = [0, 1]
        if batch is not None:
            try: batch = int(batch)
            except Exception: batch = -1
            if batch in (0, 1):
                to_run = [batch]
        for b in to_run:
            if slices.get(b):
                _run_forecast_batch(slices[b], total, date_str, mode, strip_last, b)
    except Exception as e:
        print(f"[MORNING ERROR] {e}")

def _valid_morning(data):
    """晨间预测只在 6:00-7:00 或 19:00-20:00 生成才有效（盘中手动触发的是脏数据）"""
    created = (data or {}).get('created', '')
    try:
        hh = int(created[11:13])
    except Exception:
        return False
    return hh in (6, 19)

def run_evening_review():
    """盘后总结（22:00）：对照当日实际行情→命中率/平均收益→存档"""
    try:
        today = now_cst().strftime('%Y-%m-%d')
        # 验证对象 = 昨晚19:30生成的"今日预测"（SCF 无盘 → GitHub 回源；本地 cron 存档已同步）
        import datetime as _dt_e
        yesterday = (_dt_e.date.fromisoformat(today) - _dt_e.timedelta(days=1)).strftime('%Y-%m-%d')
        morning, _ = forecast_load(yesterday, 'morning')
        if morning and not _valid_morning(morning):
            print(f"[EVENING] 昨日晨间记录创建时间异常，忽略")
            morning = None
        if not morning:
            # 回退：取最近一条早于今天的 morning
            gh_files = _gh_repo_list('forecast')
            cands = []
            if gh_files:
                for f in gh_files:
                    n = f.get('name', '')
                    if n.endswith('-morning.json') and len(n) >= 19:
                        cands.append(n[:10])
            cands = [d for d in cands if d < today]
            cands.sort(reverse=True)
            for d in cands[:5]:
                morning, _ = forecast_load(d, 'morning')
                if morning and _valid_morning(morning):
                    yesterday = d; break
                morning = None
            if not morning:
                print("[EVENING] 无有效昨日预测可对照"); return
        items = morning.get('items', [])
        if not items: return
        
        # 拉这些股票当日实际涨跌（收盘后数据）
        codes = [i['code'] for i in items]
        actual = {}
        for pn in range(1, 6):
            try:
                url = f'{API_BASE}?fid=f3&po=1&pz=100&pn={pn}&np=1&fltt=2&invt=2&fs={FS}&fields=f3,f12'
                for s in fetch(url)['data'].get('diff', []):
                    c = str(s.get('f12',''))
                    if c in codes and c not in actual:
                        try: actual[c] = float(s.get('f3', 0) or 0)
                        except: actual[c] = 0
            except: pass
            if len(actual) >= len(codes): break
        
        # 统计
        reviewed = []
        up = 0; total = 0
        for i in items:
            code = i.get('code')
            chg = actual.get(code)
            if chg is None: continue
            total += 1
            if chg > 0: up += 1
            reviewed.append({**i, 'actual_chg': chg})
        winrate = round(up / total * 100, 1) if total else 0
        avg = round(sum(r['actual_chg'] for r in reviewed) / total, 2) if total else 0
        
        # 高分 vs 低分命中率（验证信号有效性）
        hi = [r for r in reviewed if r.get('score',0) >= 6]
        lo = [r for r in reviewed if r.get('score',0) < 6]
        hi_wr = round(sum(1 for r in hi if r['actual_chg']>0) / len(hi) * 100, 1) if hi else None
        lo_wr = round(sum(1 for r in lo if r['actual_chg']>0) / len(lo) * 100, 1) if lo else None
        
        summary = (f'盘后总结：入选 {total} 只，上涨 {up} 只，命中率 {winrate}%，平均涨幅 {avg}%。'
                   + (f'高分股(≥6分)命中率 {hi_wr}%' if hi_wr is not None else '')
                   + (f'，低分股(<6分) {lo_wr}%' if lo_wr is not None else '')
                   + ('。高分显著优于低分，信号有效。' if (hi_wr is not None and lo_wr is not None and hi_wr - lo_wr >= 10) else ''))
        
        result = {'items': reviewed, 'winrate': winrate, 'avg_return': avg,
                  'up_count': up, 'total': total, 'hi_winrate': hi_wr, 'lo_winrate': lo_wr,
                  'summary': summary, 'created': now_cst().isoformat()}
        forecast_save(today, 'evening', result)
        print(f"[EVENING] {today} 盘后总结: 命中率{winrate}% 平均{avg}%")
    except Exception as e:
        print(f"[EVENING ERROR] {e}")

# ========== MBM 麦唛 ICIR 模型集成 ==========
_MBM_STABLE = None
_MBM_WEIGHTS_CACHE = {}

def _mbm_stable_feats():
    global _MBM_STABLE
    if _MBM_STABLE is None:
        try:
            import json as _json_mod
            with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stable_feats.json'), encoding='utf-8') as f:
                _MBM_STABLE = set(_json_mod.load(f))
        except Exception:
            _MBM_STABLE = set()
    return _MBM_STABLE

def mbm_score_market(mode='swing'):
    """ICIR 打分全市场：返回 {'items': 全量排序, 'q4': 入选, 'q1': 回避, 'weights': 因子权重}"""
    from collections import defaultdict as _dd
    from scipy.stats import spearmanr
    label = {'short': 'ret2_open', 'swing': 'ret3_open', 'long': 'ret5_open'}.get(mode, 'ret3_open')
    stable = _mbm_stable_feats()
    # 训练期样本 → 滚动 ICIR 权重
    c = sqlite3.connect(DB)
    rows = c.execute(
        "SELECT date, feats, labels FROM mbm_samples WHERE mode=? AND date >= '2024-01-01'",
        (mode,)).fetchall()
    days = _dd(list)
    feat_names = None
    for date, feats_s, labels_s in rows:
        try:
            f = json.loads(feats_s); lab = json.loads(labels_s)
        except Exception:
            continue
        if lab.get('untradable') or lab.get('gap_suspend'):
            continue
        ret = lab.get(label)
        if ret is None:
            continue
        if feat_names is None:
            feat_names = [k for k in f.keys() if k not in ('code', 'board', 'price') and k in stable
                          and isinstance(f[k], (int, float)) and f[k] is not None]
        vec = []
        for k in feat_names:
            v = f.get(k)
            if v is None or v != v:
                v = 0.0
            vec.append(float(v))
        days[date].append((vec, ret))
    dates = sorted(days.keys())[-45:]
    w = np.zeros(len(feat_names))
    for j in range(len(feat_names)):
        ics = []
        for d in dates:
            col = [vec[j] for vec, _ in days[d]]
            y = [r for _, r in days[d]]
            if len(col) < 20 or np.std(col) < 1e-9 or np.std(y) < 1e-9:
                continue
            ics.append(spearmanr(col, y).statistic)
        if len(ics) >= 20:
            mu, sd = np.mean(ics), np.std(ics)
            w[j] = mu / sd if sd > 1e-9 else 0.0
    # 全市场打分（截至昨收）
    import mbm_replay as _mr
    items = []
    for secid, data in c.execute('SELECT secid, data FROM klines'):
        try:
            kl = _kline_decode(data)
            if not kl or len(kl) < 60:
                continue
            f = _mr.compute_features(secid, kl, len(kl) - 1, mode)
            if not f:
                continue
            vec = []
            for k in feat_names:
                v = f.get(k)
                if v is None or v != v:
                    v = 0.0
                vec.append(float(v))
            items.append({'secid': secid, 'code': secid.split('.')[1], 'vec': vec})
        except Exception:
            continue
    c.close()
    if not items:
        return {'error': '无 K 线数据'}
    X = np.array([x['vec'] for x in items], dtype=np.float32)
    mu, sd = X.mean(0), X.std(0)
    sd[sd < 1e-9] = 1.0
    Z = (X - mu) / sd
    scores = Z @ w
    order = np.argsort(scores)
    n = len(scores)
    pct = np.empty(n)
    for rank, idx in enumerate(order):
        pct[idx] = rank / n * 100
    out = []
    for i, it in enumerate(items):
        out.append({'secid': it['secid'], 'code': it['code'],
                    'score': round(float(scores[i]), 4), 'pct': round(float(pct[i]), 1),
                    'q': 1 + int(min(pct[i], 99.9) // 20)})
    out.sort(key=lambda x: -x['score'])
    return {'items': out, 'total': n,
            'q4': [x for x in out if x['q'] == 4][:50],
            'q1': [x for x in out if x['q'] == 1][:20],
            'weights': {f: round(float(w[i]), 4) for i, f in enumerate(feat_names)},
            'updated': now_cst().isoformat(), 'label': label}

def run_mbm_forecast(mode=None):
    """麦唛 ICIR 预测存档（19:30 与规则预测并行；type='mbm_'+mode）"""
    if mode is None:
        mode = get_user_mode()
    r = mbm_score_market(mode)
    if r.get('error'):
        print(f"[MBM] {mode} 打分失败: {r['error']}")
        return
    date_str = now_cst().strftime('%Y-%m-%d')
    forecast_save(date_str, 'mbm_' + mode, r)
    print(f"[MBM] {date_str} {mode} 预测存档: {r['total']} 只 Q4={len(r['q4'])}")

def mbm_evening_review():
    """盘后验证麦唛预测（Q4 名单次日/第2日收益 → 命中率）"""
    mode = get_user_mode()
    label = {'short': 'ret2_open', 'swing': 'ret3_open', 'long': 'ret5_open'}.get(mode, 'ret3_open')
    today = now_cst().strftime('%Y-%m-%d')
    # 找最近一条 mbm 预测（昨天或更早）
    c = sqlite3.connect(DB)
    row = c.execute(
        "SELECT date, data FROM forecast_history WHERE type=? AND date < ? ORDER BY date DESC LIMIT 1",
        ('mbm_' + mode, today)).fetchone()
    if not row:
        print('[MBM-EVENING] 无历史预测可验证')
        c.close()
        return
    pred_date, data_s = row
    try:
        pred = json.loads(data_s)
    except Exception:
        c.close()
        return
    q4 = pred.get('q4', [])
    if not q4:
        c.close()
        return
    klines = {}
    for secid, raw in c.execute('SELECT secid, data FROM klines'):
        try:
            klines[secid] = _kline_decode(raw)
        except Exception:
            pass
    c.close()
    # 验证：预测日后第 2 个交易日收盘（T+1 合规）
    hits = 0
    rets = []
    total = 0
    for p in q4:
        kl = klines.get(p['secid'])
        if not kl or len(kl) < 2:
            continue
        idxs = [i for i, k in enumerate(kl) if k['t'] >= pred_date]
        if len(idxs) < 2:
            continue
        i0 = idxs[0]
        i1 = idxs[1] if len(idxs) > 1 else i0
        b0 = kl[i0]['o']
        if b0 <= 0 or (kl[i0]['o'] / kl[max(0, i0 - 1)]['c'] - 1) >= 0.098:
            continue  # 涨停买不进
        ret = (kl[i1]['c'] / b0 - 1) * 100
        rets.append(ret)
        if ret > 0:
            hits += 1
        total += 1
    if not total:
        print('[MBM-EVENING] 无可验证标的')
        return
    winrate = round(hits / total * 100)
    avg = round(sum(rets) / total, 2)
    review = {'winrate': winrate, 'avg_return': avg, 'total': total, 'up': hits,
              'reviewed': pred_date, 'created': now_cst().isoformat(),
              'summary': f"麦唛({mode}) Q4名单 {total} 只：命中率 {winrate}%（≥53% 达标：{'✅' if winrate >= 53 else '❌'}），平均收益 {avg}%"}
    # 更新原预测存档 + 存 evening_mbm
    c = sqlite3.connect(DB)
    try:
        pred['review'] = review
        c.execute('REPLACE INTO forecast_history VALUES (?,?,?,?)',
                  (pred_date, 'mbm_' + mode, time.time(), json.dumps(pred, ensure_ascii=False)))
        c.execute('REPLACE INTO forecast_history VALUES (?,?,?,?)',
                  (pred_date, 'mbm_review', time.time(), json.dumps(review, ensure_ascii=False)))
        c.commit()
    finally:
        c.close()
    print(f"[MBM-EVENING] {pred_date} 验证: 命中率{winrate}% 平均{avg}% (n={total})")

@app.route('/api/mbm-predict')
def api_mbm_predict():
    """麦唛预测（GET）：最新存档优先，无则触发打分（21s）"""
    mode = request.args.get('mode') or get_user_mode()
    date_str = now_cst().strftime('%Y-%m-%d')
    c = sqlite3.connect(DB)
    row = c.execute("SELECT data FROM forecast_history WHERE type=? AND date=?",
                    ('mbm_' + mode, date_str)).fetchone()
    c.close()
    if row:
        d = json.loads(row[0])
        return jsonify({'ok': True, 'cached': True, 'mode': mode, **d})
    try:
        r = mbm_score_market(mode)
        if r.get('error'):
            return jsonify({'ok': False, 'error': r['error']}), 500
        forecast_save(date_str, 'mbm_' + mode, r)
        return jsonify({'ok': True, 'cached': False, 'mode': mode, **r})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)[:200]}), 500

@app.route('/api/mbm-review', methods=['POST'])
def api_mbm_review():
    """手动触发麦唛盘后验证（密钥）"""
    body = request.get_json() or {}
    if body.get('key') != os.environ.get('FORECAST_KEY', 'stock-mobile-2026'):
        return jsonify({'error': 'forbidden'}), 403
    try:
        mbm_evening_review()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)[:200]}), 500

@app.route('/api/forecast/run', methods=['POST'])
def api_forecast_run():
    """手动触发盘前预测或盘后总结（type=morning|evening；带密钥；SCF 同步执行——线程会被冻结）"""
    body = request.get_json() or {}
    if body.get('key') != os.environ.get('FORECAST_KEY', 'stock-mobile-2026'):
        return jsonify({'error': 'forbidden'}), 403
    ftype = body.get('type', 'morning')
    # 盘中禁止（盘中跑=脏数据：剥最后一根逻辑会错）
    hh = now_cst().hour
    if 9 <= hh < 16:
        return jsonify({'error': '盘中禁止手动预测（脏数据风险）'}), 400
    try:
        if ftype == 'evening': run_evening_review()
        else: run_morning_forecast()
        return jsonify({'ok': True, 'message': f'{ftype} 完成'})
    except Exception as e:
        return jsonify({'error': str(e)[:200]}), 500

@app.route('/api/forecast/history')
def api_forecast_history():
    """盘前/盘后历史记录列表（本地 + GitHub 私有仓合并，SCF 无磁盘也能全量）"""
    seen = set()
    # COS 目录（主存储，SCF 同云稳定）
    gh_rows = []
    for name in _cos_list('forecast/'):
        bn = name.rsplit('/', 1)[-1]
        if not bn.endswith('.json') or bn == 'manifest.json' or len(bn) < 19: continue
        try:
            date_str = bn[:10]          # YYYY-MM-DD
            ftype = bn[11:-5]           # morning/evening
            gh_rows.append((date_str, ftype, bn))
        except Exception: continue
    if not gh_rows:
        # COS 未配置/失败 → GitHub 兜底
        gh_files = _gh_repo_list('forecast')
        if gh_files:
            for f in gh_files:
                name = f.get('name', '')
                if not name.endswith('.json') or name == 'manifest.json' or len(name) < 19: continue
                try:
                    date_str = name[:10]
                    ftype = name[11:-5]
                    gh_rows.append((date_str, ftype, f.get('name', '')))
                except Exception: continue
    with sqlite3.connect(DB) as c:
        rows = c.execute('SELECT date, type, created FROM forecast_history ORDER BY date DESC, created ASC LIMIT 90').fetchall()
    result = []
    # 合并 GitHub 存档（去重：本地优先）
    merged = list(rows)
    for (gdate, gtype, gname) in gh_rows:
        if (gdate, gtype) not in seen and (gdate, gtype) not in [(r[0], r[1]) for r in rows]:
            merged.append((gdate, gtype, gname))
    merged.sort(key=lambda r: r[0], reverse=True)
    for date_str, ftype, created in merged[:90]:
        if (date_str, ftype) in seen: continue
        seen.add((date_str, ftype))
        entry = {'date': date_str, 'type': ftype}
        data, _ = forecast_load(date_str, ftype)
        if data:
            entry['mode'] = data.get('mode', '')
            if ftype == 'morning':
                entry['summary'] = data.get('summary', '')
                entry['count'] = len(data.get('items', []))
            else:
                entry['summary'] = data.get('summary', '')
                entry['winrate'] = data.get('winrate')
                entry['avg_return'] = data.get('avg_return')
        result.append(entry)
    return jsonify({'ok': True, 'records': result})

@app.route('/api/forecast/detail')
def api_forecast_detail():
    """单日盘前或盘后详情"""
    date_str = request.args.get('date', '')
    ftype = request.args.get('type', 'morning')
    data, created = forecast_load(date_str, ftype)
    if data is None:
        return jsonify({'ok': False, 'error': '无记录'})
    return jsonify({'ok': True, 'date': date_str, 'type': ftype, 'data': data, 'created': created})

# ========== 关注列表（SCF 无盘多实例：SQLite + COS 旁路，跨设备/跨实例同步） ==========
@app.route('/api/watchlist', methods=['GET'])
def api_watchlist():
    with sqlite3.connect(DB) as c:
        rows = c.execute('SELECT code FROM watchlist').fetchall()
    if rows:
        return jsonify([r[0] for r in rows])
    # 本实例无 → 回源 COS（其他设备/实例同步的）
    try:
        raw = _cos_get('watchlist.json')
        if raw:
            codes = json.loads(raw)
            if isinstance(codes, list):
                with sqlite3.connect(DB) as c:
                    for code in codes:
                        c.execute('INSERT OR IGNORE INTO watchlist VALUES (?)', (code,))
                return jsonify(codes)
    except Exception:
        pass
    return jsonify([])

@app.route('/api/watchlist', methods=['POST'])
def api_watchlist_add():
    data = request.get_json()
    codes = data.get('codes', [])
    with sqlite3.connect(DB) as c:
        for code in codes:
            c.execute('INSERT OR IGNORE INTO watchlist VALUES (?)', (code,))
    # 同步到 COS（跨实例/跨设备）
    try:
        rows = c.execute('SELECT code FROM watchlist').fetchall()
        _cos_put('watchlist.json', json.dumps([r[0] for r in rows]))
    except Exception:
        pass
    return jsonify({'ok': True})

# ========== API ==========
@app.route('/api/backtest', methods=['POST'])
def api_backtest():
    """龙头战法回测：返回历史涨停池候选，前端用K线验证"""
    data = request.get_json() or {}
    strategy_key = data.get('strategy', 'canslim')
    days = min(int(data.get('days', 30) or 30), 30)
    
    if strategy_key != 'leader':
        return jsonify({'total': 0, 'winRate': 0, 'avgReturn': 0, 'plRatio': '--', 'daily': []})
    
    try:
        from datetime import timedelta
        end_date = now_cst() - timedelta(days=1)
        all_candidates = {}
        for d in range(days):
            back_date = end_date - timedelta(days=d)
            back_str = back_date.strftime('%Y%m%d')
            try:
                zt_df = _zt_pool_em(back_str)
            except: continue
            if zt_df is None or len(zt_df) == 0: continue
            for r in zt_df:
                code = str(r.get('代码', ''))
                lb = int(float(r.get('连板数', 1) or 1))
                seal = float(r.get('封板资金', 0) or 0)
                name = str(r.get('名称', ''))
                if lb <= 3 and seal > 1e8:
                    if code not in all_candidates:
                        all_candidates[code] = {'code': code, 'name': name, 'days': {}}
                    all_candidates[code]['days'][back_str] = {'lb': lb, 'seal': seal}
        candidates = list(all_candidates.values())
        safe = [{'code': str(c['code']), 'name': str(c['name']),
                 'days': {str(dt): {'lb': int(v['lb']), 'seal': float(v['seal'])} for dt, v in c['days'].items()}}
                for c in candidates]
        return jsonify({'leaderCandidates': safe, 'stockCount': len(safe),
                        'total': 0, 'winRate': 0, 'avgReturn': 0, 'daily': []})
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/api/debug/kline')
def api_debug_kline():
    """诊断：测单只股票K线拉取（腾讯源）"""
    secid = request.args.get('secid', '0.000001')
    try:
        code = secid.split('.')[1]
        prefix = 'sh' if code.startswith(('6','9')) else 'sz'
        url = f'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={prefix}{code},day,,,30,qfq'
        req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0', 'Referer': 'https://gu.qq.com/'})
        data = json.loads(urllib.request.urlopen(req, timeout=8).read())
        node = data['data'][f'{prefix}{code}']
        lines = node.get('qfqday') or node.get('day') or []
        return jsonify({'ok': True, 'secid': secid, 'count': len(lines), 'last': lines[-1] if lines else None})
    except Exception as e:
        return jsonify({'ok': False, 'secid': secid, 'error': str(e)})

def _flat_items(items):
    """trade 对象展开到顶层（entry/stop/target/position 等）——前端读扁平字段，兼容 morning 存档与 full_scan 两种来源"""
    out = []
    for i in (items or []):
        t = i.get('trade') or {}
        out.append({**i, **t})
    return out

def _merge_quotes(items):
    """预测列表实时化：用共享行情层（sm:quotes，腾讯实时，盘中每分钟刷新）覆盖行情字段。
    预测元数据（ID/score/sigs/参考位）不动——用户原则：行情共享一处，元数据单独存"""
    if not items or _REDIS is None:
        return items
    try:
        vals = _REDIS.hmget('sm:quotes', *[str(i.get('code') or '') for i in items])
        for it, v in zip(items, vals):
            if not v:
                continue
            q = json.loads(v)
            it['price'] = q.get('price')
            it['change_pct'] = q.get('chg')
            it['turnover'] = q.get('turnover')
            it['volRatio'] = q.get('vol_ratio')
            it['high'] = q.get('high')
            it['low'] = q.get('low')
            it['open'] = q.get('open')
            it['pre_close'] = q.get('pre_close')
            it['pe'] = q.get('pe') if q.get('pe') is not None else it.get('pe')
    except Exception:
        pass
    return items

@app.route('/api/predict')
def api_predict():
    # 主结果：deep（60分钟稳定）；deep未完成时用quick过渡
    # 缓存按模式隔离，避免模式间串数据
    mode = request.args.get('mode', DEFAULT_MODE)
    if mode not in MODE_CFG: mode = DEFAULT_MODE
    refresh = request.args.get('refresh') == '1'  # 强制跳过旧缓存回源（部署/手动刷新用）
    if not refresh:
        data = cache_get(f'prediction_{mode}')
        if data:
            return jsonify({**data, 'items': _merge_quotes(_flat_items(data.get('items'))),
                            'themes': data.get('themes') or _theme_mainline()[1],
                            'from_cache': True, 'mode': mode, 'env': env_temperature()})
        data = cache_get('prediction_quick')
        if data:
            return jsonify({**data, 'items': _merge_quotes(_flat_items(data.get('items'))),
                            'from_cache': True, 'stage': 'quick', 'mode': mode, 'env': env_temperature()})
    # 实例回收后缓存空 → 从 COS 最近预测回源（预测不随实例消失；跨天后取最近一次）
    try:
        m = _latest_morning()
        if m and m.get('items') and m.get('created'):
            _cfg_p = MODE_CFG.get(mode, MODE_CFG[DEFAULT_MODE])
            resp_data = {'items': _merge_quotes(_flat_items(m['items'])), 'total': m.get('total_scanned', 0), 'stage': 'deep',
                         'maxScore': 6 + _cfg_p['w_value'] + _cfg_p['w_leader'] + _cfg_p['w_theme'],
                         'themes': _theme_mainline()[1],
                         'updated': m.get('created', ''), 'mode': mode, 'created': m.get('created', ''),
                         'env': env_temperature()}
            cache_set(f'prediction_{mode}', {**resp_data, '_ts': time.time()})
            return jsonify({**resp_data, 'from_cache': True})
    except Exception as e:
        print(f'[PREDICT COS BACKFILL ERROR] {e}')
    # SCF 无后台线程：预测缓存由 19:30 定时触发器生成；冷启动后暂无数据时提示
    if IS_SCF:
        return jsonify({'items': [], 'total': 0, 'stage': 'waiting', 'mode': mode,
                        'message': '预测数据生成中（每日 19:30 自动生成，稍后刷新）', 'from_cache': False,
                        'env': env_temperature()})
    return jsonify({'items': [], 'total': 0, 'message': '扫描中...', 'mode': mode, 'env': env_temperature()})

_LLM_HITS = {}  # IP → 请求时间戳（每小时限流，防公网滥用烧 key）

@app.route('/api/llm', methods=['POST'])
def api_llm():
    """LLM 代理：DeepSeek key 从环境变量读（DEEPSEEK_API_KEY），前端不暴露 key。
    鉴权：①X-LLM-Key == LLM_GATE_KEY 直接放行（备用）②Origin/Referer 本站 + IP 每小时 30 次限流"""
    try:
        # 反代后 remote_addr 恒为 127.0.0.1（所有用户共享限流额度）→ 用 nginx 透传的真实 IP（XFF 最后一段=nginx append）
        ip = request.headers.get('X-Forwarded-For', '').split(',')[-1].strip() or request.remote_addr or ''
        gate = os.environ.get('LLM_GATE_KEY', '')
        hdr_key = request.headers.get('X-LLM-Key', '')
        if not (gate and hdr_key == gate):
            # 非网关 key：必须来自本站页面 + IP 限流（空 Origin 拒绝——浏览器 fetch 必带 Origin，防 curl 无脑刷）
            origin = request.headers.get('Origin', '') or request.headers.get('Referer', '')
            ok_origin = origin.startswith(('http://124.156.138.98', 'http://localhost', 'http://127.0.0.1',
                                           'https://kpzs.icu', 'https://mmsnpj.online', 'http://mmsnpj.online',
                                           'https://www.mmsnpj.online'))
            if not ok_origin:
                return jsonify({'error': 'forbidden'}), 403
            now_t = time.time()
            q = _LLM_HITS.setdefault(ip, [])
            q[:] = [t for t in q if now_t - t < 3600]
            if len(q) >= 30:
                return jsonify({'error': 'rate limited'}), 429
            q.append(now_t)
        body = request.get_json() or {}
        messages = body.get('messages') or []
        if not messages:
            return jsonify({'error': 'empty messages'}), 400
        # 消息大小限制（防滥用超大请求）
        total_chars = sum(len(str(m.get('content') or '')) for m in messages)
        if total_chars > 30000:
            return jsonify({'error': 'messages too large'}), 413
        key = os.environ.get('DEEPSEEK_API_KEY') or ''
        if not key:
            return jsonify({'error': 'server key not configured'}), 503
        payload = {
            'model': body.get('model', 'deepseek-chat'),
            'messages': messages,
            'max_tokens': int(body.get('max_tokens', 1200)),
            'temperature': float(body.get('temperature', 0.6)),
            'stream': False,
        }
        req = urllib.request.Request(
            'https://api.deepseek.com/chat/completions',
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key})
        resp = urllib.request.urlopen(req, timeout=150)
        d = json.loads(resp.read().decode('utf-8'))
        content = (d.get('choices') or [{}])[0].get('message', {}).get('content', '')
        return jsonify({'content': content})
    except Exception as e:
        print(f'[LLM PROXY ERROR] {e}')
        return jsonify({'error': str(e)[:200]}), 502

@app.route('/api/refresh', methods=['POST'])
def api_refresh():
    """手动触发刷新：后台线程跑完自动更新缓存（Origin 校验——防公网滥用触发全量扫描，审计 P1）"""
    origin = request.headers.get('Origin', '') or request.headers.get('Referer', '')
    if origin and not origin.startswith(('http://124.156.138.98', 'http://localhost', 'http://127.0.0.1', 'https://kpzs.icu')):
        return jsonify({'error': 'forbidden'}), 403
    mode = (request.get_json() or {}).get('mode', DEFAULT_MODE)
    if mode not in MODE_CFG: mode = DEFAULT_MODE
    if IS_SCF:
        # SCF 无后台线程（实例冻结会杀线程）→ 同步执行 full_scan（深扫约 1-4 分钟，函数超时 900s 够）
        try:
            full_scan(mode)
            return jsonify({'ok': True, 'message': f'扫描完成（{mode}）', 'mode': mode, 'synced': True})
        except Exception as e:
            print(f'[SCF REFRESH ERROR] {e}')
            return jsonify({'ok': False, 'error': str(e)[:100], 'mode': mode}), 500
    def worker():
        try:
            full_scan(mode)
        except Exception as e:
            print(f"[MANUAL REFRESH ERROR] {e}")
    threading.Thread(target=worker, daemon=True).start()
    return jsonify({'ok': True, 'message': f'扫描已启动（{mode}），约2-4分钟后自动更新', 'mode': mode})

@app.route('/api/market-temp')
def api_market_temp():
    data = cache_get('market_temp')
    if data: return jsonify({**data, 'from_cache': True})
    # 缓存空时同步计算（SCF 无后台线程；Render 有线程兜底，仅冷启动初期触发）
    try:
        mt = fetch_market_temp()
        if mt and mt.get('total') is not None:
            cache_set('market_temp', mt)
            return jsonify({**mt, 'from_cache': False})
    except Exception as e:
        print(f'[TEMP SYNC] {e}')
    return jsonify({'state': 'unknown', 'label': '加载中...', 'total': 0})

@app.route('/api/env')
def api_env():
    """市场环境温度（前端实盘面板用：涨停家数/连板高度/炸板率/相位/仓位系数），60秒缓存"""
    return jsonify(env_temperature())

@app.route('/api/status')
def api_status():
    pred = cache_get('prediction_swing')
    mt = cache_get('market_temp')
    return jsonify({
        'online': True,
        'pred_stage': pred.get('stage','') if pred else '',
        'pred_items': len(pred.get('items',[])) if pred else 0,
        'pred_total': pred.get('total',0) if pred else 0,
        'market_state': mt.get('label','') if mt else '',
        'updated': pred.get('updated') if pred else None,
        'server_time': now_cst().isoformat(),
    })

# ========== K线专用端点（后端缓存，全用户共享；首次跨洋拉取后秒开） ==========
def _norm_kline(daily):
    """fetch_kline 短键(t/o/c/h/l/v) → 长键(time/open/high/low/close/volume) 标准化"""
    out = []
    for k in daily or []:
        out.append({
            'time': k.get('t') or k.get('time') or '',
            'open': k.get('o') if k.get('o') is not None else k.get('open'),
            'high': k.get('h') if k.get('h') is not None else k.get('high'),
            'low': k.get('l') if k.get('l') is not None else k.get('low'),
            'close': k.get('c') if k.get('c') is not None else k.get('close'),
            'volume': k.get('v') if k.get('v') is not None else k.get('volume'),
        })
    return out

def _agg_klines(daily, klt):
    """日K → 周K(102)/月K(103) 聚合（OHLCV；time 取区间最后一天）"""
    daily = _norm_kline(daily)
    if klt == 101 or not daily:
        return daily
    import datetime as _dt
    out = []
    cur = None
    for k in daily:
        ts = k.get('time') or ''
        if klt == 103:
            d = ts[:7]  # 月分组 YYYY-MM
        else:
            try:
                y, w, _ = _dt.date.fromisoformat(ts[:10]).isocalendar()
                d = f'{y}-W{w:02d}'
            except Exception:
                d = ts[:10]
        if cur and cur['_g'] == d:
            cur['high'] = max(cur['high'], k['high'])
            cur['low'] = min(cur['low'], k['low'])
            cur['close'] = k['close']
            cur['volume'] += k.get('volume', 0) or 0
        else:
            if cur: out.append({kk: cur[kk] for kk in ('time', 'open', 'high', 'low', 'close', 'volume')})
            cur = {'_g': d, 'time': ts, 'open': k['open'], 'high': k['high'],
                   'low': k['low'], 'close': k['close'], 'volume': k.get('volume', 0) or 0}
    if cur: out.append({kk: cur[kk] for kk in ('time', 'open', 'high', 'low', 'close', 'volume')})
    return out

@app.route('/api/trends')
def api_trends():
    """分时数据：服务器拉腾讯分钟（Redis 缓存——盘中15分钟刷新；前端只读后端）"""
    secid = request.args.get('secid', '')
    if not secid or '.' not in secid:
        return jsonify({'error': 'secid required'}), 400
    # Redis 缓存优先（校验日期：跨天旧数据（如昨天/上午的缓存）不返回，强制重拉当天分时）
    try:
        _in_trading = now_cst().weekday() < 5 and 9 * 60 + 15 <= now_cst().hour * 60 + now_cst().minute <= 15 * 60 + 5
        if _REDIS is not None:
            raw = _REDIS.get('sm:trends:' + secid)
            if raw:
                try:
                    _d = json.loads(raw).get('date', '')
                    # 最近交易日（跳过周末；节假日按腾讯返回为准——不匹配则重拉）
                    _rd = now_cst().date()
                    while _rd.weekday() >= 5:
                        _rd -= datetime.timedelta(days=1)
                    if _d == _rd.strftime('%Y%m%d'):
                        return app.response_class(raw, content_type='application/json')
                except Exception:
                    pass
    except Exception:
        pass
    code = secid.split('.')[1]
    pre = 'sh' if secid.startswith('1.') else 'sz'
    try:
        url = f'https://web.ifzq.gtimg.cn/appstock/app/minute/query?code={pre}{code}'
        req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0', 'Referer': 'https://gu.qq.com/'})
        d = json.loads(urllib.request.urlopen(req, timeout=8).read())
        node = d['data'][f'{pre}{code}']['data']
        raw = node.get('data', [])
        lines = raw if isinstance(raw, list) else str(raw).replace(';', '\n').split('\n')
        pts, cum_amt, cum_vol = [], 0.0, 0.0
        for ln in lines:
            parts = ln.split()
            if len(parts) < 3 or parts[0] == 'time' or not parts[0].isdigit():
                continue
            t, price, vol = parts[0], float(parts[1]), float(parts[2])
            amt = float(parts[3]) if len(parts) > 3 else 0.0
            cum_amt += amt; cum_vol += vol
            # 腾讯 vol 单位是"手"（1手=100股），金额是元 → 均价 = 累计金额/(累计量×100)
            avg = round(cum_amt / (cum_vol * 100), 2) if cum_vol else price
            pts.append({'time': t[:2] + ':' + t[2:], 'price': price, 'avg': avg, 'volume': vol})
        body = json.dumps({'code': secid, 'trends': pts, 'date': str(node.get('date', ''))}, ensure_ascii=False)
        if _REDIS is not None and pts:
            # 盘中 30s TTL（分时线分钟级数据，30s 最多丢半根；最后一笔价格由 3s 行情通道合成）
            ttl = 30 if _in_trading else 43200
            _REDIS.setex('sm:trends:' + secid, ttl, body)
        return app.response_class(body, content_type='application/json')
    except Exception as e:
        print(f'[TRENDS ERR] {e}')
        # 拉取失败：有缓存（哪怕跨天旧数据）兜底返回，不白屏——比 500 好；前端保持最后一段问题由此修复
        try:
            if _REDIS is not None:
                old = _REDIS.get('sm:trends:' + secid)
                if old:
                    return app.response_class(old, content_type='application/json')
        except Exception:
            pass
        return jsonify({'error': str(e)[:150]}), 502

@app.route('/api/klines')
def api_klines():
    secid = request.args.get('secid', '')
    klt = int(request.args.get('klt', 101) or 101)
    start = request.args.get('start', '').strip()  # 增量：只返回 >= start 的K线（前端缓存覆盖更新用）
    if klt not in (101, 102, 103): klt = 101
    if not secid or '.' not in secid:
        return jsonify({'error': 'secid required'}), 400
    try:
        # K线缓存新鲜度强制刷新（2026-08-13）：保证前端缓存与后端缓存一致
        # ① 增量请求（带 start）→ 永远绕过缓存现场拉取最新，今天这根必须补上；
        # ② 不带 start 且盘中（9:15-15:05 非周末）→ 缓存末根 < 今天 或 距上次强制刷新 >10 分钟 → 现场拉取；
        #    （>10 分钟强制刷新 = 修"当日 bar 冻结"：盘中缓存命中时当天K线永远停在第一次请求的值）
        # ③ 非盘中 / 缓存新鲜 → 正常走缓存（不拖慢展示）。
        force_fresh = bool(start)
        if not start:
            _now = now_cst()
            if _now.weekday() < 5 and 9*60+15 <= _now.hour*60 + _now.minute <= 15*60+5:
                _cached = KLINE_MEM.get(secid) or kline_get(secid)
                _last = (_cached[-1].get('t') or _cached[-1].get('time') or '') if _cached else ''
                _stale_date = _last < _now.strftime('%Y-%m-%d')
                _stale_fresh = time.time() - KLINE_FRESH_TS.get(secid, 0) > 600
                if _stale_date or _stale_fresh:
                    force_fresh = True
                    KLINE_FRESH_TS[secid] = time.time()
        kl = fetch_kline(secid, fast=True, force_fresh=force_fresh)  # 日K：前端路径 fast 单源（不拖慢展示）
        if not kl or len(kl) < 5:
            return jsonify({'error': 'kline unavailable'}), 502
        kl = _agg_klines(kl, klt)  # 周/月聚合必须在全量日线上做，start 过滤放聚合后
        if start:
            kl = [k for k in kl if (k.get('time') or '') >= start]
        return jsonify({'code': secid, 'klt': klt, 'klines': kl,
                        'from_cache': secid in KLINE_MEM, 'updated': time.strftime('%H:%M:%S')})
    except Exception as e:
        return jsonify({'error': str(e)[:200]}), 500

# ========== 实盘页聚合帧端点（3秒服务端缓存；报价+分时+资金流+盘口一次返回） ==========
_LIVE_CACHE = {}  # code -> {ts, data}
def _tx_quote(secid):
    """腾讯 qt 实时报价（海外 CDN 快）"""
    market, code = secid.split('.')
    pre = 'sh' if market == '1' else 'sz'
    try:
        req = urllib.request.Request(f'https://qt.gtimg.cn/q={pre}{code}', headers={'UA': 'Mozilla/5.0'})
        raw = urllib.request.urlopen(req, timeout=10).read().decode('gbk', 'ignore')
        import re as _re
        m = _re.search(r'="([^"]*)"', raw)
        if not m: return None
        f = m.group(1).split('~')
        if len(f) < 50: return None
        return {
            'price': float(f[3] or 0), 'preClose': float(f[4] or 0), 'open': float(f[5] or 0),
            'volume': float(f[6] or 0), 'outer': float(f[7] or 0), 'inner': float(f[8] or 0),
            'high': float(f[33] or 0), 'low': float(f[34] or 0),
            'highLimit': float(f[47] or 0), 'lowLimit': float(f[48] or 0),
            'volRatio': float(f[49] or 0), 'avgPrice': float(f[50] or 0),
            'turnover': float(f[38] or 0), 'chgPct': float(f[32] or 0),
            'bids': [[float(f[9+i*2] or 0), float(f[10+i*2] or 0)] for i in range(5)],
            'asks': [[float(f[19+i*2] or 0), float(f[20+i*2] or 0)] for i in range(5)],
            'src': 'qt',
        }
    except Exception:
        return None

def _em_trends(secid):
    """东财分时（push2delay 海外可用）"""
    try:
        req = urllib.request.Request(f'https://push2delay.eastmoney.com/api/qt/stock/trends2/get?secid={secid}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ndays=2&iscr=0', headers={'UA': 'Mozilla/5.0'})
        d = json.loads(urllib.request.urlopen(req, timeout=10).read())
        rows = (d.get('data') or {}).get('trends') or []
        out = []
        for r in rows:
            p = r.split(',')
            try:
                ts = int(datetime.strptime(p[0], '%Y-%m-%d %H:%M').replace(tzinfo=timezone(timedelta(hours=8))).timestamp())
            except Exception:
                continue
            out.append({'time': p[0][11:16], 'ts': ts, 'price': _f(p[1]), 'avg': _f(p[2]), 'volume': _f(p[3])})
        return out
    except Exception:
        return []

def _em_fund(secid):
    try:
        req = urllib.request.Request(f'https://push2delay.eastmoney.com/api/qt/stock/get?secid={secid}&fields=f62,f66,f184', headers={'UA': 'Mozilla/5.0'})
        d = json.loads(urllib.request.urlopen(req, timeout=8).read())
        data = d.get('data') or {}
        return {'mainNet': data.get('f62'), 'superNet': data.get('f66'), 'mainPct': data.get('f184')}
    except Exception:
        return {}

@app.route('/api/live-frame')
def api_live_frame():
    secid = request.args.get('code', '')
    if not secid or '.' not in secid:
        return jsonify({'error': 'code required'}), 400
    now = time.time()
    c = _LIVE_CACHE.get(secid)
    if c and now - c['ts'] < 5:
        return jsonify({**c['data'], 'from_cache': True})
    # 三个上游请求并行（串行 5s+ → 并行 ~1.5s）
    with ThreadPoolExecutor(max_workers=3) as ex:
        fq = ex.submit(_tx_quote, secid)
        ft = ex.submit(_em_trends, secid)
        ff = ex.submit(_em_fund, secid)
        q = fq.result(timeout=15)
        trends = ft.result(timeout=15)
        fund = ff.result(timeout=15) or {}
    # 无效主力值过滤（非交易时段 f62 常返回 1/0）
    mn = fund.get('mainNet')
    if mn is not None and abs(mn) < 10000: mn = None
    fund['mainNet'] = mn
    data = {
        'quote': q, 'trends': (trends or [])[-250:], 'fund': fund,
        'ts': int(now), 'updated': time.strftime('%H:%M:%S'), 'from_cache': False,
    }
    _LIVE_CACHE[secid] = {'ts': now, 'data': data}
    return jsonify(data)

@app.route('/api/ping')
def api_ping():
    return jsonify({'ok': True})

# 前端数据直连被拦截时的兜底代理（仅允许行情域名，防止被滥用）
@app.route('/api/proxy')
def api_proxy():
    url = request.args.get('url', '')
    # 白名单必须精确匹配 hostname（审计 P1：startswith 可被 qt.gtimg.cn.evil.com 绕过）
    allowed_hosts = ('push2delay.eastmoney.com', 'push2his.eastmoney.com',
                     'push2.eastmoney.com', 'web.ifzq.gtimg.cn',
                     'money.finance.sina.com.cn', 'hq.sinajs.cn',
                     'datacenter-web.eastmoney.com', 'proxy.finance.qq.com',
                     'qt.gtimg.cn')
    try:
        from urllib.parse import urlparse
        host = (urlparse(url).netloc or '').lower()
        # 去掉端口（如 qt.gtimg.cn:443）
        if ':' in host: host = host.split(':')[0]
        if host not in allowed_hosts:
            return jsonify({'error': 'url not allowed'}), 400
    except Exception:
        return jsonify({'error': 'url not allowed'}), 400
    last_err = None
    for _attempt in range(2):  # 东财偶发 502：重试一次再报错，避免前端误报"服务器连接失败"
        try:
            req = urllib.request.Request(url, headers={
                'Referer': 'https://finance.sina.com.cn',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            })
            with urllib.request.urlopen(req, timeout=12) as r:
                data = r.read()
                ctype = r.headers.get('Content-Type', 'application/json')
            return app.response_class(data, content_type=ctype)
        except Exception as e:
            last_err = e
            time.sleep(0.6)
    return jsonify({'error': str(last_err)}), 502

# ========== 全市场实时快照（Redis 定时刷新——前端只读后端） ==========
_QR_LIST_CACHE = {'ts': 0.0, 'items': []}

def _qr_list():
    """全市场代码列表（30 分钟缓存）。优先 sm:fund 的 key（5500 只——每 30 分钟刷新，比 quick_scan 55 页更全更稳）；
    其次 Redis sm:qr_list → 内存 → quick_scan 现场拉。供 refresh_quotes 等全市场任务用"""
    if _REDIS is not None:
        try:
            keys = _REDIS.hkeys('sm:fund')
            if keys and len(keys) > 1000:
                out = []
                for k in keys:
                    k = k.decode() if isinstance(k, bytes) else str(k)
                    out.append({'secid': (('1.' if k[0] in '69' else '0.') + k)})
                return out
        except Exception:
            pass
    try:
        if _REDIS is not None:
            _raw = _REDIS.get('sm:qr_list')
            if _raw:
                _c = json.loads(_raw)
                if isinstance(_c, dict) and time.time() - _c.get('ts', 0) < 1800 and isinstance(_c.get('items'), list) and _c['items']:
                    return _c['items']
    except Exception:
        pass
    if time.time() - _QR_LIST_CACHE['ts'] < 1800 and _QR_LIST_CACHE['items']:
        return _QR_LIST_CACHE['items']
    items, _ = quick_scan(55, mode=DEFAULT_MODE)
    _QR_LIST_CACHE['items'] = items
    _QR_LIST_CACHE['ts'] = time.time()
    try:
        if _REDIS is not None and items:
            _REDIS.setex('sm:qr_list', 1800, json.dumps({'ts': time.time(), 'items': items}, ensure_ascii=False))
    except Exception:
        pass
    return items

def refresh_quotes():
    """全市场实时快照 → Redis hash sm:quotes（盘中每2分钟 cron；腾讯 qt 批量 80/次，并发 8 ≈ 3-4s）"""
    try:
        import re as _re
        items = _qr_list()  # 全市场代码列表（30 分钟缓存——不现场拉 55 页）
        secids = [it['secid'] for it in items if it.get('secid')]
        if len(secids) < 100:
            print(f'[QUOTES] 代码列表不足({len(secids)})，快照未更新')  # 告警不静默
            return 0
        mapping = {}
        code2secid = {}
        for s in secids:
            try:
                code2secid[s.split('.')[1]] = s
            except Exception:
                pass

        def tx_code(secid):
            try:
                mkt, code = secid.split('.')
                return ('sh' if mkt == '1' else 'sz') + code
            except Exception:
                return None

        def fetch_batch(batch):
            res = {}
            q = ','.join(batch)
            url = f'https://qt.gtimg.cn/q={q}'
            try:
                req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0'})
                raw = urllib.request.urlopen(req, timeout=8).read().decode('gbk', 'ignore')
                for m in _re.finditer(r'v_(\w+)="([^"]*)"', raw):
                    p = m.group(2).split('~')
                    if len(p) < 40:
                        continue
                    code = m.group(1)[2:]
                    try:
                        res[code] = {
                            'name': p[1], 'price': float(p[3] or 0), 'chg': float(p[32] or 0),
                            'volume': float(p[36] or 0), 'amount': float(p[37] or 0) * 10000,
                            'turnover': float(p[38] or 0), 'vol_ratio': float(p[49] or 0),
                            'mcap': float(p[45] or 0) * 100000000, 'pe': float(p[39]) if p[39] else None,
                            'high': float(p[33] or 0), 'low': float(p[34] or 0), 'open': float(p[5] or 0),
                            'pre_close': float(p[4] or 0),
                            'secid': code2secid.get(code) or (('1.' if code[0] in '69' else '0.') + code),
                            'ts': time.time(),
                        }
                    except Exception:
                        continue
            except Exception:
                pass
            return res

        batches = []
        for i in range(0, len(secids), 80):
            b = [tx_code(c) for c in secids[i:i + 80]]
            b = [c for c in b if c]
            if b:
                batches.append(b)
        with ThreadPoolExecutor(max_workers=8) as ex:
            for r in ex.map(fetch_batch, batches):
                mapping.update(r)
        if _REDIS is not None and mapping:
            # TTL 智能：盘中 900s（价格在变要勤刷）；非交易时段 24h（价格不变——快照常驻秒读）
            try:
                _now = now_cst()
                _in_trading = _now.weekday() < 5 and ((_now.hour == 9 and _now.minute >= 15) or (10 <= _now.hour < 15) or (_now.hour == 15 and _now.minute <= 5))
                _ttl = 900 if _in_trading else 86400
            except Exception:
                _ttl = 900
            pipe = _REDIS.pipeline()
            pipe.delete('sm:quotes')
            pipe.hset('sm:quotes', mapping={k: json.dumps(v, ensure_ascii=False) for k, v in mapping.items()})
            pipe.expire('sm:quotes', _ttl)
            pipe.execute()
        return len(mapping)
    except Exception as e:
        print(f'[QUOTES REFRESH ERR] {e}')
        return 0

FUND_FIELDS = 'f2,f3,f6,f8,f9,f10,f12,f13,f14,f20,f23,f24,f37,f62,f109,f114,f115,f160,f164,f174'

def refresh_fund():
    """基本面/主力索引 → Redis hash sm:fund（东财 clist 全字段——盘中每 30 分钟 cron）。
    补 sm:quotes（腾讯）缺的字段：ROE/主力10日/主力20日/阶段涨幅/PE(f114)——列表 join 用"""
    try:
        mapping = {}
        def fetch_page(p):
            for _ in range(3):
                try:
                    url = f'{API_BASE}?fid=f20&po=1&pz=100&pn={p}&np=1&fltt=2&invt=2&fs={FS}&fields={FUND_FIELDS}'
                    return fetch(url)['data'].get('diff', [])
                except Exception:
                    pass
                time.sleep(0.5)
            return []
        with ThreadPoolExecutor(max_workers=15) as ex:
            futures = {ex.submit(fetch_page, p): p for p in range(1, 56)}
            stocks = []
            for f in as_completed(futures):
                stocks.extend(f.result())
        for s in stocks:
            code = s.get('f12', '')
            if not code:
                continue
            try:
                pe = s.get('f114')
                if not (isinstance(pe, (int, float)) and pe > 0):
                    pe = s.get('f9')
                if not (isinstance(pe, (int, float)) and pe > 0):
                    pe = s.get('f115')
                roe = s.get('f37')
                mapping[code] = {
                    'roe': float(roe) if isinstance(roe, (int, float)) else None,
                    'pe': float(pe) if isinstance(pe, (int, float)) else None,
                    'pb': s.get('f23'),
                    'main_flow': s.get('f62'),
                    'main_flow10': s.get('f164'),
                    'main_flow20': s.get('f174'),
                    'chg_5d': s.get('f109'),
                    'chg_10d': s.get('f160'),
                    'chg_60d': s.get('f24'),
                    'amount': s.get('f6'),
                    'turnover': s.get('f8'),
                    'vol_ratio': s.get('f10'),
                    'mcap': s.get('f20'),
                }
            except Exception:
                continue
        if _REDIS is not None and mapping:
            _REDIS.delete('sm:fund')
            _REDIS.hset('sm:fund', mapping={k: json.dumps(v, ensure_ascii=False) for k, v in mapping.items()})
        return len(mapping)
    except Exception as e:
        print(f'[FUND REFRESH ERR] {e}')
        return 0

def refresh_ztpool():
    """涨停池/炸板池 → Redis（盘中每 5 分钟 cron；失败保留旧缓存+告警——不静默不空列表）"""
    today = now_cst().strftime('%Y%m%d')
    ut = '7eea3edcaed734bea9cbfc24409ed989'
    # 涨停池（东财 push2ex——字段与前端 _fetchZTPool 完全一致）
    try:
        d = fetch(f'https://push2ex.eastmoney.com/getTopicZTPool?ut={ut}&dpt=wz.ztzt&Pageindex=0&pagesize=400&sort=fbt%3Aasc&date={today}')
        pool = ((d or {}).get('data') or {}).get('pool') or []
        if pool:
            items = [{
                'code': str(r.get('c', '')), 'name': r.get('n', ''), 'price': r.get('p'),
                'change_pct': r.get('zdp'), 'limitCount': int(r.get('lbc', 0) or 0) or 1,
                'seal': r.get('fund', 0) or 0, 'firstTime': r.get('fbt', ''),
                'breakCount': int(r.get('zbc', 0) or 0), 'industry': r.get('hybk', '') or '',
                'ltsz': r.get('ltsz'),
                'sealRatio': (round(r['fund'] / r['ltsz'] * 100, 1) if r.get('fund') and r.get('ltsz') else None),
            } for r in pool]
            _REDIS.set('sm:ztpool', json.dumps({'items': items, 'total': len(items),
                                                'updated': now_cst().isoformat(), 'date': today}, ensure_ascii=False), ex=7200)
        else:
            print('[ZTPOOL] 涨停池为空（非交易时段或接口异常——保留旧缓存）')
    except Exception as e:
        print(f'[ZTPOOL ERR] {e}')
    # 炸板池
    try:
        d = fetch(f'https://push2ex.eastmoney.com/getTopicZBPool?ut={ut}&dpt=wz.ztzt&Pageindex=0&pagesize=200&sort=zbc%3Adesc&date={today}')
        pool = ((d or {}).get('data') or {}).get('pool') or []
        if pool:
            items = [{'code': str(r.get('c', '')), 'name': r.get('n', ''), 'price': r.get('p'),
                      'change_pct': r.get('zdp'), 'breakCount': int(r.get('zbc', 0) or 0)} for r in pool]
            _REDIS.set('sm:zbpool', json.dumps({'items': items, 'total': len(items),
                                                'updated': now_cst().isoformat(), 'date': today}, ensure_ascii=False), ex=7200)
    except Exception as e:
        print(f'[ZBPOOL ERR] {e}')
    return 0

def refresh_lhb():
    """龙虎榜 → sm:lhb（15:10 + 20:30 cron——当天榜单固定；字段与前端 getLHB 一致）"""
    try:
        url = f'{API_BASE}?pn=1&pz=200&po=1&np=1&fltt=2&invt=2&fid=f184&fs={FS}&fields=f2,f3,f12,f13,f14,f184,f66,f69,f72'
        d = fetch(url)
        rows = ((d or {}).get('data') or {}).get('diff') or []
        items = [{
            'code': r.get('f12'), 'name': r.get('f14'), 'price': r.get('f2'),
            'change_pct': r.get('f3'), 'secid': f"{r.get('f13')}.{r.get('f12')}",
            'netBuy': r.get('f184'), 'buyAmt': r.get('f66') or 0, 'sellAmt': r.get('f69') or 0,
            'jgBuy': r.get('f72') or 0,
        } for r in rows if r.get('f184') is not None and r.get('f184') != 0]
        if items:
            _REDIS.set('sm:lhb', json.dumps({'items': items, 'total': len(items),
                                             'updated': now_cst().isoformat()}, ensure_ascii=False), ex=86400)
        return len(items)
    except Exception as e:
        print(f'[LHB REFRESH ERR] {e}')
        return 0

@app.route('/api/lhb')
def api_lhb():
    """龙虎榜（Redis 读——15:10/20:30 自动刷新；未命中现场补一次）"""
    data = None
    if _REDIS is not None:
        try:
            raw = _REDIS.get('sm:lhb')
            if raw:
                data = json.loads(raw)
        except Exception:
            pass
    if not data or not data.get('items'):
        refresh_lhb()
        if _REDIS is not None:
            try:
                raw = _REDIS.get('sm:lhb')
                if raw:
                    data = json.loads(raw)
            except Exception:
                pass
    return jsonify(data or {'items': [], 'total': 0})

@app.route('/api/zt-pool')
def api_zt_pool():
    """涨停池（Redis 读——盘中每 5 分钟自动刷新；未命中现场补一次）"""
    data = None
    if _REDIS is not None:
        try:
            raw = _REDIS.get('sm:ztpool')
            if raw:
                data = json.loads(raw)
        except Exception:
            pass
    if not data or not data.get('items'):
        refresh_ztpool()
        if _REDIS is not None:
            try:
                raw = _REDIS.get('sm:ztpool')
                if raw:
                    data = json.loads(raw)
            except Exception:
                pass
    return jsonify(data or {'items': [], 'total': 0})

@app.route('/api/zb-pool')
def api_zb_pool():
    """炸板池（Redis 读——同上）"""
    data = None
    if _REDIS is not None:
        try:
            raw = _REDIS.get('sm:zbpool')
            if raw:
                data = json.loads(raw)
        except Exception:
            pass
    if not data or not data.get('items'):
        refresh_ztpool()
        if _REDIS is not None:
            try:
                raw = _REDIS.get('sm:zbpool')
                if raw:
                    data = json.loads(raw)
            except Exception:
                pass
    return jsonify(data or {'items': [], 'total': 0})

_LIST_VIEW_CACHE = {'ts': 0.0, 'rows': []}

def _f(v):
    """数值字段安全转换（东财 clist 部分字段返回字符串——'x' 与数值比较会崩）"""
    try:
        return float(v)
    except Exception:
        return None

def _stage_of_row(row):
    f20 = row.get('main_flow20')
    f10d = row.get('chg_10d')
    if f20 is None or f10d is None:
        return None
    if f20 > 0:
        if f10d > 3:
            return 'pump'
        return 'absorb'
    if f10d > 5:
        return 'distribute'
    if f10d < -3:
        return 'fall'
    return 'range'

def _list_rows():
    """sm:quotes + sm:fund + sm:rsi join → 全量列表（视图缓存 2 分钟——分页/排序/筛选在缓存上做）"""
    if time.time() - _LIST_VIEW_CACHE['ts'] < 120 and _LIST_VIEW_CACHE['rows']:
        return _LIST_VIEW_CACHE['rows']
    rows = []
    if _REDIS is not None:
        try:
            q = _REDIS.hgetall('sm:quotes')
            f = _REDIS.hgetall('sm:fund')
            r = _REDIS.hgetall('sm:rsi')
        except Exception:
            q = f = r = {}
        qmap, fmap, rmap = {}, {}, {}
        for src, dst in ((q, qmap), (f, fmap), (r, rmap)):
            for k, v in src.items():
                k = k.decode() if isinstance(k, bytes) else str(k)
                try:
                    dst[k] = json.loads(v)
                except Exception:
                    pass
        for code, qv in qmap.items():
            fv = fmap.get(code) or {}
            rv = rmap.get(code) or {}
            row = {
                'code': code, 'name': qv.get('name'), 'price': _f(qv.get('price')),
                'change_pct': _f(qv.get('chg')), 'amount': _f(qv.get('amount')),
                'turnover': _f(qv.get('turnover')), 'vol_ratio': _f(qv.get('vol_ratio')),
                'mcap': (_f(qv.get('mcap')) / 1e8) if _f(qv.get('mcap')) is not None else None,
                'pe': _f(qv.get('pe')),
                'roe': _f(fv.get('roe')), 'pb': _f(fv.get('pb')),
                'main_flow': _f(fv.get('main_flow')), 'main_flow10': _f(fv.get('main_flow10')),
                'main_flow20': _f(fv.get('main_flow20')),
                'chg_5d': _f(fv.get('chg_5d')), 'chg_10d': _f(fv.get('chg_10d')),
                'rsi6': _f(rv.get('rsi6')), 'rsi14': _f(rv.get('rsi14')),
                'secid': qv.get('secid'),
            }
            row['stage'] = _stage_of_row(row)
            rows.append(row)
    _LIST_VIEW_CACHE['rows'] = rows
    _LIST_VIEW_CACHE['ts'] = time.time()
    return rows

def _match_metric(row, metric, cond):
    v = {'pe': row.get('pe'), 'pb': row.get('pb'), 'roe': row.get('roe'),
         'mktcap': row.get('mcap'), 'turnover': row.get('turnover'),
         'flow': row.get('main_flow'), 'flow10': row.get('main_flow10'),
         'flow20': row.get('main_flow20'), 'stage': row.get('stage')}.get(metric)
    if metric == 'stage':
        return v == cond.split('=')[1]
    if v is None:
        return False
    try:
        num = float(v)
    except Exception:
        return False
    return {
        'pe<20': num < 20, 'pe20-50': 20 <= num <= 50, 'pe>50': num > 50, 'pe<0': num < 0,
        'pb<1': num < 1, 'pb1-3': 1 <= num <= 3, 'pb>3': num > 3,
        'roe>15': num > 15, 'roe5-15': 5 <= num <= 15, 'roe<5': num < 5,
        'mktcap>1000': num > 1000, 'mktcap100-1000': 100 <= num <= 1000, 'mktcap<100': num < 100,
        'turnover>10': num > 10, 'turnover3-10': 3 <= num <= 10, 'turnover<3': num < 3,
        'flow>0': num > 0, 'flow<0': num < 0, 'flow>5e7': num > 5e7,
        'flow10>0': num > 0, 'flow10<0': num < 0,
        'flow20>0': num > 0, 'flow20<0': num < 0,
    }.get(cond, True)

def _score_stock(row):
    s = 0
    mf = row.get('main_flow')
    if mf is not None:
        s += min(30, max(0, mf / 2e7 * 30))
    roe = row.get('roe')
    if roe is not None:
        s += min(20, max(0, roe / 20 * 20))
    pe = row.get('pe')
    if pe is not None:
        s += 20 if 0 < pe <= 25 else (10 if pe <= 50 else 0)
    t = row.get('turnover')
    if t is not None:
        s += min(10, max(0, t / 5 * 10))
    c = row.get('chg_10d')
    if c is not None:
        s += min(10, max(0, c / 10 * 10))
    m = row.get('mcap')
    if m is not None:
        s += 10 if m >= 200 else (5 if m >= 50 else 0)
    return s

def _board_match(row, board_fs):
    b = board_of(str(row.get('code') or ''), row.get('name') or '')
    if 't:80' in board_fs:
        return b == '创业板'
    if 't:23' in board_fs:
        return b == '科创板'
    if 's:2048' in board_fs:
        return b == '北交所'
    if 't:6' in board_fs or 't:2' in board_fs:
        return b == '主板'
    return True

@app.route('/api/list')
def api_list():
    """全市场列表（Redis join——前端只读；参数与前端 getListByType 完全兼容）"""
    pn = max(1, int(request.args.get('pn', 1) or 1))
    pz = min(200, int(request.args.get('pz', 50) or 50))
    sort = request.args.get('sort', 'f6')
    filt = request.args.get('filter', '')
    board_fs = request.args.get('boardFs', '')
    conds = {}
    try:
        mc = request.args.get('metricConds', '')
        if mc:
            conds = json.loads(mc)
    except Exception:
        pass
    rows = _list_rows()
    if board_fs:
        rows = [r for r in rows if _board_match(r, board_fs)]
    if filt == 'f3>0':
        rows = [r for r in rows if (r.get('change_pct') or 0) > 0]
    elif filt == 'f3<0':
        rows = [r for r in rows if (r.get('change_pct') or 0) < 0]
    if conds:
        rows = [r for r in rows if all(_match_metric(r, k, v) for k, v in conds.items())]
    skey = {'f6': 'amount', 'f3': 'change_pct', 'f2': 'price', 'f8': 'turnover',
            'f10': 'vol_ratio', 'f20': 'mcap', 'f37': 'roe', 'f62': 'main_flow',
            'f164': 'main_flow10', 'f174': 'main_flow20', 'f114': 'pe',
            'f109': 'chg_5d', 'f160': 'chg_10d'}.get(sort, 'amount')
    if sort == 'score':
        rows.sort(key=lambda x: _score_stock(x), reverse=True)
    else:
        rows.sort(key=lambda x: (x.get(skey) if x.get(skey) is not None else -1), reverse=True)
    total = len(rows)
    page = rows[(pn - 1) * pz: pn * pz]
    return jsonify({'total': total, 'items': page})

@app.route('/api/rsi-scan')
def api_rsi_scan():
    """全市场 RSI 筛选（纯 Redis：sm:rsi 索引遍历过滤——零外部请求秒回）：
    range=os 超卖(rsi14<30) / ob 超买(rsi6>80) / mid 中位(30-60)"""
    rng = request.args.get('range', 'os')
    limit = int(request.args.get('limit', 200) or 200)
    out = []
    if _REDIS is not None:
        try:
            raw = _REDIS.hgetall('sm:rsi')
            for code_b, v in raw.items():
                code = code_b.decode() if isinstance(code_b, bytes) else str(code_b)
                try:
                    r = json.loads(v)
                except Exception:
                    continue
                r14, r6 = r.get('rsi14'), r.get('rsi6')
                hit = (rng == 'os' and r14 is not None and r14 < 30) or \
                      (rng == 'ob' and r6 is not None and r6 > 80) or \
                      (rng == 'mid' and r14 is not None and 30 <= r14 <= 60)
                if hit:
                    out.append({
                        'code': code, 'name': r.get('name'),
                        'secid': (('1.' if code[0] in '69' else '0.') + code),
                        'price': r.get('price'), 'change_pct': r.get('change_pct'),
                        'rsi6': r6, 'rsi14': r14,
                        'board': r.get('board'),
                    })
                    if len(out) >= limit:
                        break
        except Exception as e:
            print(f'[RSI-SCAN ERR] {e}')
    return jsonify({'total': len(out), 'items': out, 'range': rng})

@app.route('/api/rsi')
def api_rsi():
    """批量 RSI（Redis K线命中现场算——~0.1ms/只；供股票列表筛选 join）"""
    codes = request.args.get('codes', '')
    out = {}
    for c in codes.split(',')[:120]:
        c = c.strip()
        if not c:
            continue
        if '.' in c:
            secid = c
        else:
            secid = ('1.' if c[0] in '69' else '0.') + c
        r6, r14 = _kline_rsi(secid)
        if r6 is not None or r14 is not None:
            out[c.split('.')[0]] = {'rsi6': r6, 'rsi14': r14}
    return jsonify(out)

@app.route('/api/quotes')
def api_quotes():
    """批量实时快照（Redis 优先——盘中定时刷新；未命中现场腾讯拉兜底）
    入参 codes 兼容三种格式：secid(1.600519) / 腾讯(sh600519) / 纯代码(600519)；返回带 secid"""
    codes = request.args.get('codes', '')
    if not codes: return jsonify({'error': 'codes required'}), 400
    cl = [c for c in codes.split(',') if c]
    out = {}
    miss = []
    def to_pure(c):
        if '.' in c: return c.split('.')[1]
        if c[:2] in ('sh', 'sz'): return c[2:]
        return c
    keys = [to_pure(c) for c in cl]
    _now_ts = time.time()
    if _REDIS is not None:
        vals = _REDIS.hmget('sm:quotes', *keys)
        for c, k, v in zip(cl, keys, vals):
            if v:
                d = json.loads(v)
                if 'secid' not in d:
                    d['secid'] = (('1.' if k[0] in '69' else '0.') + k)
                # 单票按需刷新：少量票（≤10）且快照 >3s 旧 → 现场拉腾讯更新（价格 3 秒级；列表批量不触发）
                if len(cl) <= 10 and (_now_ts - (d.get('ts') or 0)) > 3:
                    miss.append(('sh' if k[0] in '69' else 'sz') + k)
                    continue
                out[k] = d
            else:
                miss.append(('sh' if k[0] in '69' else 'sz') + k)  # 兜底用腾讯格式（sh/sz 前缀）
    else:
        miss = [('sh' if to_pure(c)[0] in '69' else 'sz') + to_pure(c) for c in cl]
    if miss:
        try:
            import re as _re
            for i in range(0, len(miss), 80):
                batch = miss[i:i + 80]
                q = ','.join(batch)
                url = f'https://qt.gtimg.cn/q={q}'
                req = urllib.request.Request(url, headers={'UA': 'Mozilla/5.0'})
                raw = urllib.request.urlopen(req, timeout=8).read().decode('gbk', 'ignore')
                for m in _re.finditer(r'v_(\w+)="([^"]*)"', raw):
                    p = m.group(2).split('~')
                    if len(p) < 40: continue
                    code = m.group(1)[2:]
                    try:
                        out[code] = {
                            'name': p[1], 'price': float(p[3] or 0), 'chg': float(p[32] or 0),
                            'volume': float(p[36] or 0), 'amount': float(p[37] or 0) * 10000,
                            'turnover': float(p[38] or 0), 'vol_ratio': float(p[49] or 0),
                            'mcap': float(p[45] or 0) * 100000000, 'pe': float(p[39]) if p[39] else None,
                            'high': float(p[33] or 0), 'low': float(p[34] or 0), 'open': float(p[5] or 0),
                            'pre_close': float(p[4] or 0),
                            'secid': (('1.' if code[0] in '69' else '0.') + code),
                            'ts': time.time(),
                        }
                    except Exception:
                        continue
            # 现场拉到的写回共享层（单票按需刷新的落库——共享层始终最新）
            if _REDIS is not None and out:
                try:
                    pipe = _REDIS.pipeline()
                    for k, v in out.items():
                        pipe.hset('sm:quotes', k, json.dumps(v, ensure_ascii=False))
                    pipe.execute()
                    # ⚠️ 不能重置整个 hash 的 TTL（曾 expire 900 把 24h 快照压成 15min，
                    #    用户看票间隙 >15min 无请求 → 整个 sm:quotes 过期清空，列表全空）
                    #    仅当 hash 不存在（新建）时设置默认 TTL：盘中 900 / 非盘 24h
                    try:
                        _ttl = _REDIS.ttl('sm:quotes')
                        if _ttl < 0:
                            _now = now_cst()
                            _in_trading = _now.weekday() < 5 and ((_now.hour == 9 and _now.minute >= 15) or (10 <= _now.hour < 15) or (_now.hour == 15 and _now.minute <= 5))
                            _REDIS.expire('sm:quotes', 900 if _in_trading else 86400)
                    except Exception:
                        pass
                except Exception:
                    pass
        except Exception:
            pass
    return jsonify(out)

@app.route('/api/refresh-quotes', methods=['POST'])
def api_refresh_quotes():
    n = refresh_quotes()
    return jsonify({'ok': True, 'count': n})

@app.route('/api/zt-history', methods=['GET', 'POST'])
def api_zt_history():
    """涨停晋级历史存档（服务器 SQLite 为主——替代前端 localStorage 3天即丢；每天盘后前端上报当天数据）"""
    if request.method == 'POST':
        body = request.get_json() or {}
        date = body.get('date', '')
        items = body.get('items') or []
        if not date or not isinstance(items, list):
            return jsonify({'error': 'bad request'}), 400
        try:
            with sqlite3.connect(DB, timeout=15) as c:
                c.execute('CREATE TABLE IF NOT EXISTS zt_history (date TEXT PRIMARY KEY, data TEXT)')
                c.execute('REPLACE INTO zt_history VALUES (?,?)', (date, json.dumps(items, ensure_ascii=False)))
            return jsonify({'ok': True, 'date': date, 'count': len(items)})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    try:
        with sqlite3.connect(DB, timeout=15) as c:
            c.execute('CREATE TABLE IF NOT EXISTS zt_history (date TEXT PRIMARY KEY, data TEXT)')
            rows = c.execute('SELECT date, data FROM zt_history ORDER BY date DESC LIMIT 30').fetchall()
        return jsonify([{'date': d, 'items': json.loads(data)} for d, data in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings', methods=['GET', 'POST'])
def api_settings():
    """周期模式同步：前端切换模式时上报，定时任务按用户当前模式生成预测+留档+验证"""
    if request.method == 'POST':
        body = request.get_json() or {}
        m = body.get('mode', DEFAULT_MODE)
        if m not in MODE_CFG: m = DEFAULT_MODE
        try:
            cache_set('user_mode', m)  # SCF 同步写 COS，跨实例持久化
        except Exception as e:
            print(f'[SETTINGS] {e}')
        return jsonify({'ok': True, 'mode': m})
    mode = DEFAULT_MODE
    try:
        v = cache_get('user_mode')
        if v in MODE_CFG: mode = v
    except Exception: pass
    return jsonify({'ok': True, 'mode': mode})

# ========== 定时任务 ==========
def scanner_loop():
    """双节奏扫描：quick实时每10分钟(备用)，deep K线每60分钟(主结果,保证稳定)
    每日时间线：
      19:30 盘后总结（对照今天实际）+ 明日预测（含今天收盘数据）—— 主任务
      06:30 晨间兜底：重新生成明日预测（昨晚失败或数据变化时）
    """
    time.sleep(5)
    last_deep = 0
    last_forecast = ''  # 已执行晚间任务日期
    last_morning_extra = ''
    while True:
        try:
            now_dt = now_cst()
            today = now_dt.strftime('%Y-%m-%d')
            
            # 19:30 主任务：盘后总结 + 明日预测（当日数据已齐）+ 麦唛 ICIR 预测
            if now_dt.hour == 19 and now_dt.minute >= 30 and last_forecast != today:
                last_forecast = today
                threading.Thread(target=run_evening_review, daemon=True).start()
                threading.Thread(target=lambda: run_morning_forecast(strip_last=False, mode=get_user_mode()), daemon=True).start()
                threading.Thread(target=lambda: run_mbm_forecast(mode=get_user_mode()), daemon=True).start()
                threading.Thread(target=collect_profiles, daemon=True).start()  # 画像：当日分时特征入库
            # 06:30 晨间兜底：重新生成明日预测 + 麦唛预测
            if now_dt.hour == 6 and now_dt.minute >= 30 and last_morning_extra != today:
                last_morning_extra = today
                threading.Thread(target=lambda: run_morning_forecast(strip_last=False, mode=get_user_mode()), daemon=True).start()
                threading.Thread(target=lambda: run_mbm_forecast(mode=get_user_mode()), daemon=True).start()

            # quick 快扫（实时数据，只作过渡/备用）
            items, total = quick_scan(55, mode=get_user_mode())
            qr = sorted(items, key=lambda x: x.get('quick_score',0), reverse=True)
            now_str = now_cst().strftime('%H:%M')
            um_now = get_user_mode()
            um_now_cfg = MODE_CFG.get(um_now, MODE_CFG[DEFAULT_MODE])
            quick_max = 6 + um_now_cfg['w_value'] + um_now_cfg['w_leader'] + um_now_cfg['w_theme']
            for it in qr:
                it['score'] = it.get('quick_score',0)
                it['scanned_at'] = now_str
                it['trade'] = calc_trade_params(it)
            cache_set('prediction_quick', {'items': qr[:500], 'total': total, 'stage': 'quick', 'maxScore': quick_max, 'updated': now_cst().isoformat()})
            
            # deep 每60分钟重算一次，作为主结果（K线信号日内稳定，按用户当前模式）
            now = time.time()
            if now - last_deep >= 3600:
                last_deep = now
                um = get_user_mode()
                um_cfg = MODE_CFG[um]
                um_max = 6 + um_cfg['w_value'] + um_cfg['w_leader'] + um_cfg['w_theme']
                # 环境系数联动（D1-⑤/D3）
                try:
                    env = env_temperature()
                    env_coef = env.get('coef', 1.0) if env else 1.0
                except Exception:
                    env_coef = 1.0
                # 盘中(<15:00)剥最后一根防未完成K线；收盘后(>=15:00)不剥——含今天数据预测明天
                strip_last = now_dt.hour < 15
                realtime_cands = [i for i in qr if i.get('quick_score',0) >= 2][:300]
                shape_cands = []
                have = {i['code'] for i in realtime_cands}
                for i in qr:
                    if len(shape_cands) >= 200: break
                    if i['code'] in have: continue
                    if i.get('quick_score',0) < 2: shape_cands.append(i)
                for i in qr:
                    if len(shape_cands) >= 200: break
                    if i['code'] in have: continue
                    shape_cands.append(i)
                deep = deep_analyze(realtime_cands + shape_cands, 500, strip_last=strip_last, mode=um, env_coef=env_coef)
                deep = [i for i in deep if i.get('score', 0) > 0]
                deep.sort(key=lambda x: x.get('score',0), reverse=True)
                cache_set(f'prediction_{um}', {'items': deep[:500], 'total': total, 'stage': 'deep', 'maxScore': um_max, 'updated': now_cst().isoformat(), 'mode': um})
        except Exception as e:
            print(f"[SCAN ERROR] {e}")
        time.sleep(600)

def market_temp_loop():
    time.sleep(3)
    while True:
        try:
            mt = fetch_market_temp()
            cache_set('market_temp', mt)
            print(f"[{now_cst().strftime('%H:%M:%S')}] Market: {mt['label']} score={mt['total']}")
        except Exception as e: print(f"[TEMP ERROR] {e}")
        time.sleep(300)



# ========== 腾讯云 SCF 入口（API 网关触发器 + 定时触发器） ==========


# ========== COS 持久化层（SCF 无盘 → COS 存档；同云内网直连稳定，GitHub 降级为备份） ==========
import hmac, hashlib as _hl
_COS_BUCKET = 'stock-mobile-front-1467248364'
_COS_REGION = 'ap-guangzhou'

def _cos_auth(method, key_path, params='', hdrs=''):
    sid = os.environ.get('TENCENT_SECRET_ID', '')
    skey = os.environ.get('TENCENT_SECRET_KEY', '')
    if not sid or not skey: return None
    now = int(time.time())
    key_time = f'{now-120};{now+600}'
    sign_key = hmac.new(skey.encode(), key_time.encode(), _hl.sha1).hexdigest()
    http_str = f'{method.lower()}\n/{key_path}\n{params}\n{hdrs}\n'
    sha = _hl.sha1(http_str.encode()).hexdigest()
    sts = f'sha1\n{key_time}\n{sha}\n'
    sig = hmac.new(sign_key.encode(), sts.encode(), _hl.sha1).hexdigest()
    # 有 query 参数时必须声明 q-url-param-list（COS 签名规范），否则 403
    plist = ''
    if params:
        plist = ';'.join(sorted(p.split('=')[0] for p in params.split('&') if '=' in p))
    return (f'q-sign-algorithm=sha1&q-ak={sid}&q-sign-time={key_time}&q-key-time={key_time}'
            f'&q-header-list=&q-url-param-list={plist}&q-signature={sig}')

def _cos_put(key, content):
    """PUT 对象到 COS（返回 True/False）"""
    auth = _cos_auth('PUT', key)
    if not auth: return False
    try:
        req = urllib.request.Request(
            f'https://{_COS_BUCKET}.cos.{_COS_REGION}.myqcloud.com/{key}',
            data=content.encode('utf-8') if isinstance(content, str) else content,
            headers={'Authorization': auth, 'Content-Type': 'application/json'}, method='PUT')
        urllib.request.urlopen(req, timeout=15)
        return True
    except Exception as e:
        print(f'[COS PUT ERROR] {key}: {str(e)[:120]}')
        return False

def _cos_get(key):
    """GET 对象内容（不存在/失败返回 None）"""
    auth = _cos_auth('GET', key)
    if not auth: return None
    try:
        req = urllib.request.Request(f'https://{_COS_BUCKET}.cos.{_COS_REGION}.myqcloud.com/{key}',
                                     headers={'Authorization': auth})
        return urllib.request.urlopen(req, timeout=15).read().decode('utf-8')
    except Exception:
        return None

def _cos_list(prefix):
    """列出 COS 对象（返回 key 列表；query 参数须编码后签名+请求一致）"""
    q = 'prefix=' + urllib.parse.quote(prefix, safe='')
    auth = _cos_auth('GET', '', q)
    if not auth: return []
    try:
        req = urllib.request.Request(f'https://{_COS_BUCKET}.cos.{_COS_REGION}.myqcloud.com/?{q}',
                                     headers={'Authorization': auth})
        xml = urllib.request.urlopen(req, timeout=15).read().decode('utf-8')
        import re as _re
        return _re.findall(r'<Key>([^<]+)</Key>', xml)
    except Exception as e:
        print(f'[COS LIST ERROR] {prefix}: {str(e)[:120]}')
        return []

# ========== 前端静态托管（函数 URL 免备案；web/ 目录打包进函数） ==========
_STATIC_DIR = os.path.join(os.path.dirname(__file__), 'web')
_CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
    '.jpg': 'image/jpeg', '.gif': 'image/gif',
}
def _serve_static(path):
    """返回 (status, headers, body) 或 None——处理前端页面请求"""
    p = path
    if p.startswith('/stock-mobile'): p = p[len('/stock-mobile'):]
    if p in ('', '/'): p = '/index.html'
    # 防目录穿越
    rel = p.lstrip('/')
    if '..' in rel: return None
    full = os.path.join(_STATIC_DIR, rel)
    if not os.path.isfile(full): return None
    ext = os.path.splitext(full)[1].lower()
    ctype = _CONTENT_TYPES.get(ext, 'application/octet-stream')
    with open(full, 'rb') as f:
        body = f.read()
    return (200, {'Content-Type': ctype, 'Cache-Control': 'no-cache' if rel == 'index.html' else 'public, max-age=600'}, body)

def main_handler(event, context):
    """SCF 统一入口：
    - API 网关触发（httpMethod/path/queryString/body）→ 路由到 Flask
    - 定时触发器（Type=Timer）→ 按 event 指令跑预测/画像/存档
    """
    import base64 as _b64
    # 定时触发器
    if isinstance(event, dict) and event.get('Type') == 'Timer':
        cmd = (event.get('Message') or '').strip() or 'forecast'
        # stock-morning-timer（9:25 盘前）：SDK 无法配置 Message → 按触发时刻识别
        # （9:20-9:30 窗口专属；19:30 定时器小时=19 不冲突）
        _now_t = now_cst()
        if cmd == 'forecast' and _now_t.hour == 9 and 20 <= _now_t.minute <= 30:
            cmd = 'morning_quick'
        try:
            init_db()
            if cmd == 'forecast' or cmd.startswith('forecast'):
                # 分批断点扫描：显式 batch/Message 优先，否则按触发档期（19:30→批0、19:40→批1）；
                # 每次触发最多跑一批（防 900s 超时）：目标批已 done 则补缺失批，全 done 跳过（幂等，防重复触发）
                _date = now_cst().strftime('%Y-%m-%d')
                _b = _resolve_batch(event, cmd)
                _done = _morning_done(_date)
                _force = event.get('force') in (1, '1', True)
                if _force:
                    # 运维强制重跑（Invoke 传 force=1+batch）：跳过幂等，必须带 batch 防两批连跑超时
                    _todo = [_b] if _b is not None else []
                    print(f'[TIMER] FORCE batch={_todo}')
                elif _b is None:
                    _todo = [b for b in (0, 1) if b not in _done]      # 手动/兜底：补齐缺失批
                elif _b in _done:
                    _todo = [b for b in (0, 1) if b not in _done]      # 目标批已完成：补缺失批
                elif _b == 1 and 0 not in _done:
                    _todo = [0]                                        # 19:40档但批0没跑(19:30失败)：先补批0(高分优先)
                else:
                    _todo = [_b]
            elif cmd == 'morning_quick':
                # 盘前 9:25（集合竞价后）快扫刷新：竞价数据影响信号 → 重跑当前模式全量扫描
                # （deep 覆盖昨晚结果；约 2 分钟，开盘前完成）
                try:
                    _mode = event.get('mode') or DEFAULT_MODE
                    if _mode not in MODE_CFG: _mode = DEFAULT_MODE
                    print(f'[TIMER] morning_quick start mode={_mode}')
                    full_scan(_mode)
                    print(f'[TIMER] morning_quick done')
                except Exception as _e:
                    print(f'[TIMER] morning_quick ERROR {_e}')
                _todo = []
                return {'statusCode': 200, 'body': '{"ok":true,"cmd":"morning_quick"}'}
            if cmd == 'forecast' or cmd.startswith('forecast'):
                if not _todo:
                    print(f'[TIMER] {_date} 两批均已完成，本次跳过')
                for _bt in _todo:
                    print(f'[TIMER] forecast batch={_bt}')
                    run_morning_forecast(strip_last=False, mode=get_user_mode(), batch=_bt)
                # 写 prediction_* 缓存（前端 /api/predict 读取；Render 由 scanner_loop 写，SCF 无线程需手动补）
                _m, _ = forecast_load(_date, 'morning')
                if _m:
                    _um = get_user_mode()
                    _um_cfg = MODE_CFG.get(_um, MODE_CFG[DEFAULT_MODE])
                    cache_set(f'prediction_{_um}', {
                        'items': _m.get('items', []), 'total': _m.get('total_scanned', 0),
                        'stage': 'deep' if set(_m.get('batches_done') or []) >= {0, 1} else 'batch0',
                        'themes': _theme_mainline()[1],
                        'maxScore': 6 + _um_cfg['w_value'] + _um_cfg['w_leader'] + _um_cfg['w_theme'],
                        'updated': now_cst().isoformat(),
                        'mode': _um, 'created': _m.get('created'), 'env': _m.get('env')})
                # 画像/盘后总结只在两批齐全后跑一次（当日幂等，防重复触发重复跑）
                if set(_morning_done(_date)) >= {0, 1} and not cache_get(f'evening_done_{_date}'):
                    collect_profiles()
                    run_evening_review()
                    try: cache_set(f'evening_done_{_date}', 1)
                    except Exception: pass
                return {'statusCode': 200, 'body': '{"ok":true,"cmd":"forecast"}'}
            elif cmd == 'profile':
                collect_profiles()
                return {'statusCode': 200, 'body': '{"ok":true,"cmd":"profile"}'}
            elif cmd == 'archive':
                run_evening_review()
                return {'statusCode': 200, 'body': '{"ok":true,"cmd":"archive"}'}
        except Exception as e:
            return {'statusCode': 500, 'body': '{"ok":false,"error":"%s"}' % str(e)[:200]}
    # API 网关触发
    method = (event.get('httpMethod') or 'GET').upper()
    path = event.get('path') or '/'
    headers = {k: str(v) for k, v in (event.get('headers') or {}).items()}
    # 静态文件（前端页面）直接返回，不经过 Flask
    if method == 'GET':
        try:
            st = _serve_static(path)
            if st:
                code, hdrs, body = st
                if isinstance(body, str): body = body.encode('utf-8')
                hdrs['Content-Disposition'] = 'inline'
                return {'statusCode': code, 'headers': hdrs, 'isBase64Encoded': False,
                        'body': body.decode('utf-8', 'ignore')}
        except Exception:
            pass
    qs = event.get('queryString') or event.get('queryStringParameters') or {}
    qs_str = '&'.join(f'{k}={v}' for k, v in qs.items())
    body = event.get('body') or ''
    if event.get('isBase64Encoded'):
        try: body = _b64.b64decode(body)
        except Exception: pass
    try:
        init_db()
        url = path + ('?' + qs_str if qs_str else '')
        with app.test_client() as c:
            resp = c.open(url, method=method, data=body if body else None,
                          headers={k: v for k, v in headers.items() if k.lower() not in ('content-length', 'host', 'connection')})
        out_headers = {}
        for k, v in resp.headers.items():
            if k.lower() not in ('content-length', 'transfer-encoding'):
                out_headers[k] = v
        out_headers['Content-Disposition'] = 'inline'
        return {
            'statusCode': resp.status_code,
            'headers': out_headers,
            'isBase64Encoded': False,
            'body': resp.get_data(as_text=True),
        }
    except Exception as e:
        return {'statusCode': 500, 'headers': {'Content-Type': 'application/json'}, 'body': '{"ok":false,"error":"%s"}' % str(e)[:300]}

# gunicorn 导入入口：模块加载即建表（SCF main_handler 里也调 init_db；幂等）
init_db()

if __name__ == '__main__':
    init_db()
    if not IS_SCF:
        threading.Thread(target=scanner_loop, daemon=True).start()
        threading.Thread(target=market_temp_loop, daemon=True).start()
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8000)))


