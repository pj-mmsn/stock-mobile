# -*- coding: utf-8 -*-
"""
麦麦少年策略 · 回放引擎 v1
========================================
目标：用服务器 klines 表（腾讯源日K，~250 根/票）沿时间轴回放，
为每个交易日 × 每只股票生成【特征快照 + 真实结果标签】，写入 mbm_samples 表，
作为麦麦少年模型（LightGBM 排序）的训练集。

关键纪律（与实盘预测 100% 对齐）：
1. 特征计算只复用 predict_server.compute_kline_signals 的纯函数，strip_last=False
   （第 i 天是完整日K，与 19:30 预测"含当天收盘数据预测明天"语义一致）
2. 特征只用 K 线可推导的量——sig_value(估值)/sig_theme(实时主线) 历史不可得，不进特征
3. 标签只用未来 K 线（i+1 之后），绝不回头看
4. 涨停买不进 / 停牌缺口 → 样本标记或剔除（可交易性标签）

用法：
  python mbm_replay.py --limit 50          # 先跑 50 只验证
  python mbm_replay.py                     # 全量
  python mbm_replay.py --stride 2 --mode swing
"""
import sys, os, json, time, argparse, sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import predict_server as ps  # 复用 compute_kline_signals / calc_trade_params / MODE_CFG

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pred.db')


def init_mbm_table():
    with sqlite3.connect(DB) as c:
        c.execute('''CREATE TABLE IF NOT EXISTS mbm_samples (
            date TEXT, code TEXT, mode TEXT,
            feats TEXT, labels TEXT,
            PRIMARY KEY (date, code, mode))''')
        c.execute('''CREATE TABLE IF NOT EXISTS mbm_meta (
            key TEXT PRIMARY KEY, value TEXT)''')


def board_of(secid):
    code = secid.split('.')[1]
    if code.startswith('688') or code.startswith('689'):
        return 'kc'
    if code.startswith(('300', '301')):
        return 'cyb'
    if code.startswith(('8', '43', '92')):
        return 'bj'
    return 'main'


def limit_pct(board):
    return {'kc': 0.20, 'cyb': 0.20, 'bj': 0.30}.get(board, 0.10)


def lbc_approx(kl, i):
    n = 0
    j = i
    while j >= 1:
        chg = kl[j]['c'] / kl[j - 1]['c'] - 1
        if chg >= 0.098:
            n += 1
            j -= 1
        else:
            break
    return n


def compute_features(secid, kl, i, mode):
    """第 i 天收盘后的特征快照（纯 K 线推导）"""
    kl_slice = kl[:i + 1]
    sigs = ps.compute_kline_signals(kl_slice, strip_last=False, mode=mode)
    if not sigs:
        return None
    levels = sigs.get('levels') or {}
    c0 = kl[i]['c']
    code = secid.split('.')[1]
    board = board_of(secid)
    cfg = ps.MODE_CFG.get(mode, ps.MODE_CFG[ps.DEFAULT_MODE])

    chg_1d = (c0 / kl[i - 1]['c'] - 1) * 100 if i >= 1 else 0.0
    avg5v = sum(kl[j]['v'] for j in range(max(0, i - 5), i)) / min(5, i) if i > 0 else 1.0
    vr = (kl[i]['v'] / avg5v) if avg5v > 0 else 1.0

    sig_leader_approx = (kl[i - 1]['c'] / kl[i - 2]['c'] - 1 >= 0.098) if i >= 2 else False
    w_leader = cfg['w_leader']
    base = sum(1 for k in ['sig_trend', 'sig_vcp', 'sig_maBull', 'sig_lowBuy',
                           'sig_kdj', 'sig_breakH'] if sigs.get(k))
    score_k = base + (w_leader if sig_leader_approx else 0)

    f = {
        'code': code, 'board': board,
        'price': round(c0, 2),
        'chg_1d': round(chg_1d, 2),
        'chg_5d': round((c0 / kl[max(0, i - 5)]['c'] - 1) * 100, 2) if i >= 5 else None,
        'chg_20d': round((c0 / kl[max(0, i - 20)]['c'] - 1) * 100, 2) if i >= 20 else None,
        'vr': round(vr, 2),
        'lbc': lbc_approx(kl, i),
        'streak': sigs.get('streak', 0) or 0,
        'score_k': score_k,
        'sig_trend': 1 if sigs.get('sig_trend') else 0,
        'sig_vcp': 1 if sigs.get('sig_vcp') else 0,
        'sig_maBull': 1 if sigs.get('sig_maBull') else 0,
        'sig_wyckoff': 1 if sigs.get('sig_wyckoff') else 0,
        'sig_fib': 1 if sigs.get('sig_fib') else 0,
        'sig_bollSq': 1 if sigs.get('sig_bollSq') else 0,
        'sig_kdj': 1 if sigs.get('sig_kdj') else 0,
        'sig_volDry': 1 if sigs.get('sig_volDry') else 0,
        'sig_breakH': 1 if sigs.get('sig_breakH') else 0,
        'sig_maTight': 1 if sigs.get('sig_maTight') else 0,
        'sig_lowBuy': 1 if sigs.get('sig_lowBuy') else 0,
        'sig_leader_approx': 1 if sig_leader_approx else 0,
        'bias_ma10': round(c0 / levels['ma10'] - 1, 4) * 100 if levels.get('ma10') else None,
        'bias_ma20': round(c0 / levels['ma20'] - 1, 4) * 100 if levels.get('ma20') else None,
        'bias_ma60': round(c0 / levels['ma60'] - 1, 4) * 100 if levels.get('ma60') else None,
        'pos_h20l20': round((c0 - levels['l20']) / (levels['h20'] - levels['l20']), 3) if levels.get('h20') and levels['h20'] > levels['l20'] else None,
        'pos_fib': round((c0 - levels['fib618']) / (levels['fib382'] - levels['fib618']), 3) if levels.get('fib382') and levels.get('fib618') and levels['fib382'] > levels['fib618'] else None,
        'rsi14': levels.get('rsi'),
        'rsi6': levels.get('rsi6'),
        'atr_pct': round(levels['atr14'] / c0 * 100, 2) if levels.get('atr14') and c0 else None,
    }
    return f


def compute_labels(kl, i, f, mode):
    """未来真实结果标签（只用 i+1 之后的K线）"""
    limit = limit_pct(f['board'])
    out = {'untradable': 0, 'gap_suspend': 0}

    if i + 1 < len(kl):
        try:
            from datetime import datetime
            d0 = datetime.strptime(kl[i]['t'], '%Y-%m-%d')
            d1 = datetime.strptime(kl[i + 1]['t'], '%Y-%m-%d')
            if (d1 - d0).days > 4:
                out['gap_suspend'] = 1
                return out
        except Exception:
            pass

    if i + 1 >= len(kl):
        return out

    b0 = kl[i + 1]['o']
    open_chg = b0 / kl[i]['c'] - 1
    if open_chg >= limit - 0.002:
        out['untradable'] = 1

    if b0 > 0:
        out['ret1_open'] = round((kl[i + 1]['c'] / b0 - 1) * 100, 2)
        if i + 3 < len(kl):
            out['ret3_open'] = round((kl[i + 3]['c'] / b0 - 1) * 100, 2)
        if i + 5 < len(kl):
            out['ret5_open'] = round((kl[i + 5]['c'] / b0 - 1) * 100, 2)
        out['up1'] = 1 if out['ret1_open'] > 0 else 0
        out['up3'] = 1 if out.get('ret3_open', 0) > 0 else 0
    return out


def _read_klines(secid):
    """直读 SQLite（不走 kline_get——它有 TTL 新鲜度逻辑，历史回放不需要）"""
    try:
        with sqlite3.connect(DB) as c:
            row = c.execute('SELECT data FROM klines WHERE secid=?', (secid,)).fetchone()
        if not row:
            return None
        return ps._kline_decode(row[0])
    except Exception:
        return None


def replay_one(secid, kl, mode, stride):
    rows = []
    n = len(kl) if kl else 0
    if n < 35:
        return rows
    for i in range(29, n - 5, stride):
        try:
            f = compute_features(secid, kl, i, mode)
            if not f:
                continue
            lab = compute_labels(kl, i, f, mode)
            if lab.get('gap_suspend'):
                continue
            if lab.get('untradable'):
                lab['up1'] = 0
                lab['up3'] = 0
                lab['ret1_open'] = None
            rows.append((kl[i]['t'], f['code'], mode,
                         json.dumps(f, ensure_ascii=False),
                         json.dumps(lab, ensure_ascii=False)))
        except Exception as e:
            print(f'[REPLAY] {secid} i={i} 异常: {str(e)[:100]}')
            continue
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0, help='只处理前 N 只（验证用）')
    ap.add_argument('--stride', type=int, default=2)
    ap.add_argument('--mode', default='swing', choices=['short', 'swing', 'long'])
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--force', action='store_true', help='忽略已存在样本强制重算')
    args = ap.parse_args()

    init_mbm_table()
    with sqlite3.connect(DB) as c:
        secids = [r[0] for r in c.execute('SELECT secid FROM klines ORDER BY secid')]
    if args.limit:
        secids = secids[:args.limit]
    print(f'[MBM] 回放开始: {len(secids)} 只票, mode={args.mode}, stride={args.stride}')

    done = set()
    if not args.force:
        with sqlite3.connect(DB) as c:
            done = set(r[0] for r in c.execute(
                "SELECT DISTINCT code FROM mbm_samples WHERE mode=?", (args.mode,)))
    todo = [s for s in secids if s.split('.')[1] not in done]
    print(f'[MBM] 已存在 {len(done)} 只，本次计算 {len(todo)} 只')

    t0 = time.time()
    total_rows = 0
    with sqlite3.connect(DB, timeout=60) as c:
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futures = {ex.submit(replay_one, s, _read_klines(s), args.mode, args.stride): s for s in todo}
            for k, f in enumerate(as_completed(futures)):
                rows = f.result()
                if rows:
                    c.executemany('INSERT OR REPLACE INTO mbm_samples VALUES (?,?,?,?,?)', rows)
                    total_rows += len(rows)
                if (k + 1) % 200 == 0:
                    c.commit()
                if (k + 1) % 200 == 0 or k + 1 == len(todo):
                    el = time.time() - t0
                    rate = total_rows / el if el > 0 else 0
                    print(f'[MBM] {k+1}/{len(todo)} 只, 累计 {total_rows} 样本, {el:.0f}s, {rate:.0f} 样本/s')
    c2 = sqlite3.connect(DB)
    n = c2.execute('SELECT COUNT(*) FROM mbm_samples').fetchone()[0]
    c2.close()
    print(f'[MBM] 完成: 本次 {total_rows} 样本，库内总计 {n} 样本，耗时 {time.time()-t0:.0f}s')


if __name__ == '__main__':
    main()
