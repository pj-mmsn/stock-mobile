# -*- coding: utf-8 -*-
"""ICIR 加权因子模型（滚动自适应）——鲁棒性优先的 Alpha 组合
原理：每个因子用滚动 60 日截面 IC 均值/标准差（ICIR）定权重，
当日分数 = Σ ICIR_i × z_i（截面 z-score 特征），滚动逐日评估。
优势：对 regime 变化自适应（权重每月滚动重估），透明可解释（非黑盒）。
评估：逐日 IC（与 ret3 实际收益）、整体 IC/IR、最近 60 日 IC、分层。
"""
import sqlite3, json, sys, argparse
from collections import defaultdict
import numpy as np

DB = r'E:\AI项目\stock-mobile\backend\pred.db'
STABLE = set(json.load(open(r'E:\AI项目\stock-mobile\backend\stable_feats.json', encoding='utf-8')))
DROP = {'code', 'board', 'price'}

def load(min_date='2023-01-01', label='ret3_open'):
    c = sqlite3.connect(DB)
    rows = c.execute(
        "SELECT date, feats, labels FROM mbm_samples WHERE mode='swing' AND date >= ?",
        (min_date,)).fetchall()
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

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--min-date', default='2024-01-01', help='评估起始（权重滚动窗口之前）')
    ap.add_argument('--roll', type=int, default=60, help='权重滚动窗口（交易日）')
    ap.add_argument('--label', default='ret3_open', help='标签字段 ret2_open/ret3_open/ret5_open')
    args = ap.parse_args()
    days, feat_names = load(args.min_date, args.label)
    dates = sorted(days.keys())
    print(f'[ICIR] 因子={len(feat_names)} 交易日={len(dates)} 区间 {dates[0]} ~ {dates[-1]}')

    daily_ic = []
    daily_score = {}
    for t, d in enumerate(dates):
        if t < args.roll:
            continue
        # 权重窗口：前 roll 个交易日
        win = dates[t - args.roll:t]
        w = np.zeros(len(feat_names))
        ics = np.zeros(len(feat_names))
        for j in range(len(feat_names)):
            col, y = [], []
            for dd in win:
                for vec, ret in days[dd]:
                    col.append(vec[j]); y.append(ret)
            col = np.array(col); y = np.array(y)
            if len(col) < 50 or col.std() < 1e-9 or y.std() < 1e-9:
                continue
            # 截面标准化 + Spearman IC
            from scipy.stats import spearmanr
            ic = spearmanr(col, y).statistic
            ics[j] = ic
        # ICIR = mean/std（滚动窗口内）
        for j in range(len(feat_names)):
            col_series = []
            for dd in win:
                colj = [vec[j] for vec, _ in days[dd]]
                yj = [ret for _, ret in days[dd]]
                if len(colj) < 20 or np.std(colj) < 1e-9 or np.std(yj) < 1e-9:
                    continue
                from scipy.stats import spearmanr
                col_series.append(spearmanr(colj, yj).statistic)
            if len(col_series) >= 20:
                mu, sd = np.mean(col_series), np.std(col_series)
                w[j] = mu / sd if sd > 1e-9 else 0.0
        # 当日打分 + 当日 IC
        col_all = np.array([vec for vec, _ in days[d]])
        ret_all = np.array([ret for _, ret in days[d]])
        z = (col_all - col_all.mean(0)) / (col_all.std(0) + 1e-9)
        score = z @ w
        from scipy.stats import spearmanr
        ic = spearmanr(score, ret_all).statistic if len(score) > 10 else 0.0
        daily_ic.append((d, ic))
        daily_score[d] = score

    ics = np.array([x[1] for x in daily_ic])
    n = len(ics)
    mean_ic = float(np.mean(ics))
    ir = float(mean_ic / np.std(ics)) if np.std(ics) > 1e-9 else 0.0
    pos = float(np.mean(ics > 0))
    # 最近 60 交易日
    last60 = ics[-60:] if n >= 60 else ics
    print(f'\n[ICIR] 整体: IC均值={mean_ic:.4f} IR={ir:.3f} 正IC占比={pos:.0%} 评估日={n}')
    print(f'[ICIR] 最近{len(last60)}日: IC均值={np.mean(last60):.4f}')
    # 按季度看稳定性
    q = 40
    for i in range(0, n, q):
        seg = ics[i:min(i + q, n)]
        end = daily_ic[min(i + q - 1, n - 1)][0]
        print(f'  {daily_ic[i][0]} ~ {end}: IC={np.mean(seg):+.4f} ({len(seg)}日)')
    # 分层（最近 60 日）
    last_dates = [x[0] for x in daily_ic][-60:]
    if len(last_dates) >= 40:
        scores, rets = [], []
        for d in last_dates:
            for vec, ret in days[d]:
                pass
        # 用 daily_score 汇总
        all_s, all_r = [], []
        for d in last_dates:
            s = daily_score[d]
            r = np.array([ret for _, ret in days[d]])
            all_s.extend(s.tolist()); all_r.extend(r.tolist())
        all_s = np.array(all_s); all_r = np.array(all_r)
        order = np.argsort(all_s)
        size = len(order) // 5
        print(f'\n[ICIR] 最近{len(last_dates)}日分层（按分数 Q1弱~Q5强）:')
        for i in range(5):
            idx = order[i * size:(i + 1) * size if i < 4 else len(order)]
            print(f'  Q{i+1}: n={len(idx)} 均收益={np.mean(all_r[idx]):+.2f}% 胜率={np.mean(all_r[idx] > 0) * 100:.1f}%')

if __name__ == '__main__':
    main()
