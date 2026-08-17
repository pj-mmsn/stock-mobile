# -*- coding: utf-8 -*-
"""ICIR 打分器（生产用）：对全市场打分，输出排序 + 分位
- 权重：滚动 ROLL 日因子 ICIR（从 mbm_samples 训练期样本计算）
- 打分：当日截面 z-score × 权重 → 分数
- 输出：Q4 入选名单（60-80 分位）+ Q1 回避名单（<20 分位）+ 全市场排序
对接：19:30 预测任务（predict_server）——在规则预测之外并行跑麦唛打分
"""
import sqlite3, json, sys, os, time
from collections import defaultdict
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import predict_server as ps
import mbm_replay as mr

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pred.db')
STABLE = set(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stable_feats.json'), encoding='utf-8')))
DROP = {'code', 'board', 'price'}
ROLL = 45
LABEL_MAP = {'short': 'ret2_open', 'swing': 'ret3_open', 'long': 'ret5_open'}


def load_train(mode, label, min_date='2023-01-01'):
    """训练期样本：每日截面（特征 + 标签）"""
    c = sqlite3.connect(DB)
    rows = c.execute(
        "SELECT date, feats, labels FROM mbm_samples WHERE mode=? AND date >= ?",
        (mode, min_date)).fetchall()
    c.close()
    days = defaultdict(list)
    feat_names = None
    for date, feats_s, labels_s in rows:
        try:
            f = json.loads(feats_s)
            lab = json.loads(labels_s)
        except Exception:
            continue
        if lab.get('untradable') or lab.get('gap_suspend'):
            continue
        ret = lab.get(label)
        if ret is None:
            continue
        if feat_names is None:
            feat_names = [k for k in f.keys()
                          if k not in DROP and k in STABLE
                          and isinstance(f[k], (int, float)) and f[k] is not None]
        vec = []
        for k in feat_names:
            v = f.get(k)
            if v is None or v != v:
                v = 0.0
            vec.append(float(v))
        days[date].append((vec, ret))
    return days, feat_names


def compute_weights(days, feat_names, roll=ROLL, min_obs=20):
    """滚动窗口 ICIR 权重（最近 roll 个交易日）"""
    from scipy.stats import spearmanr
    dates = sorted(days.keys())[-roll:]
    w = np.zeros(len(feat_names))
    for j in range(len(feat_names)):
        ics = []
        for d in dates:
            col = [vec[j] for vec, _ in days[d]]
            y = [ret for _, ret in days[d]]
            if len(col) < min_obs or np.std(col) < 1e-9 or np.std(y) < 1e-9:
                continue
            ics.append(spearmanr(col, y).statistic)
        if len(ics) >= min_obs:
            mu, sd = np.mean(ics), np.std(ics)
            w[j] = mu / sd if sd > 1e-9 else 0.0
    return w


def score_market(mode='swing', target_date=None):
    """对全市场打分"""
    label = LABEL_MAP.get(mode, 'ret3_open')
    days, feat_names = load_train(mode, label)
    w = compute_weights(days, feat_names, ROLL)
    print(f'[ICIR] mode={mode} 因子={len(feat_names)} 权重非零={int(np.sum(np.abs(w) > 1e-9))}')

    # 全市场特征（最新 K 线，去掉最后一根=今日盘中，用截至昨日）
    secids = [r[0] for r in sqlite3.connect(DB).execute('SELECT secid FROM klines')]
    X, metas = [], []
    for secid in secids:
        try:
            kl = ps._kline_decode(sqlite3.connect(DB).execute(
                'SELECT data FROM klines WHERE secid=?', (secid,)).fetchone()[0])
            if not kl or len(kl) < 60:
                continue
            i = len(kl) - 1  # 用最新一根（截至昨收/最新收盘）
            f = mr.compute_features(secid, kl, i, mode)
            if not f:
                continue
            vec = []
            ok = True
            for k in feat_names:
                v = f.get(k)
                if v is None or v != v:
                    v = 0.0
                vec.append(float(v))
            X.append(vec)
            metas.append({'secid': secid, 'code': secid.split('.')[1], 'name': f.get('name', '')})
        except Exception:
            continue
    X = np.array(X, dtype=np.float32)
    # 截面 z-score
    mu, sd = X.mean(0), X.std(0)
    sd[sd < 1e-9] = 1.0
    Z = (X - mu) / sd
    scores = Z @ w
    # 分位
    order = np.argsort(scores)
    n = len(scores)
    pct = np.empty(n)
    for rank, idx in enumerate(order):
        pct[idx] = rank / n * 100
    items = [{'code': m['code'], 'secid': m['secid'], 'score': round(float(scores[i]), 4),
              'pct': round(float(pct[i]), 1), 'q': 1 + int(min(pct[i], 99.9) // 20)}
             for i, m in enumerate(metas)]
    items.sort(key=lambda x: -x['score'])
    q4 = [x for x in items if x['q'] == 4]
    q1 = [x for x in items if x['q'] == 1]
    print(f'[ICIR] 全市场 {n} 只 打分完成 | Q4入选 {len(q4)} 只 | Q1回避 {len(q1)} 只')
    return {'mode': mode, 'label': label, 'weights': {f: round(float(w[i]), 4) for i, f in enumerate(feat_names)},
            'top10': items[:10], 'q4': q4[:50], 'q1': q1[:20]}


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--mode', default='swing', choices=['short', 'swing', 'long'])
    ap.add_argument('--out', default=None)
    args = ap.parse_args()
    t0 = time.time()
    r = score_market(args.mode)
    print(f'[ICIR] 耗时 {time.time()-t0:.1f}s')
    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f:
            json.dump(r, f, ensure_ascii=False, indent=1)
        print(f'[ICIR] 已保存 {args.out}')
