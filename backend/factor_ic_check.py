# -*- coding: utf-8 -*-
"""单因子 IC 预检：每个特征在 train/valid/test 三段的 IC + 符号稳定性
目的：找出样本外仍有效的因子，剔除符号漂移的（train 正 test 负 = 不稳定）"""
import sqlite3, json, sys
import numpy as np
from collections import defaultdict

DB = r'E:\AI项目\stock-mobile\backend\pred.db'

def load():
    c = sqlite3.connect(DB)
    rows = c.execute(
        "SELECT date, feats, labels FROM mbm_samples WHERE mode='swing' AND date >= '2023-01-01'").fetchall()
    c.close()
    X, y, dates = [], [], []
    feat_names = None
    for date, feats_s, labels_s in rows:
        try:
            f = json.loads(feats_s)
            lab = json.loads(labels_s)
        except Exception:
            continue
        if lab.get('untradable') or lab.get('gap_suspend'):
            continue
        ret = lab.get('ret3_open')
        if ret is None:
            continue
        if feat_names is None:
            feat_names = [k for k in f.keys()
                          if k not in ('code', 'board', 'price')
                          and isinstance(f[k], (int, float)) and f[k] is not None]
        vec = []
        for k in feat_names:
            v = f.get(k)
            if v is None or v != v:
                v = 0.0
            vec.append(float(v))
        X.append(vec)
        y.append(ret)
        dates.append(date)
    return np.array(X), np.array(y), dates, feat_names

def zscore(X, y, dates):
    day_idx = defaultdict(list)
    for i, d in enumerate(dates):
        day_idx[d].append(i)
    Xz = np.zeros_like(X)
    yz = np.zeros_like(y)
    for d, idxs in day_idx.items():
        idxs = np.array(idxs)
        col = X[idxs]
        mu, sd = col.mean(0), col.std(0)
        sd[sd < 1e-9] = 1.0
        Xz[idxs] = (col - mu) / sd
        ym, ys = y[idxs].mean(), y[idxs].std()
        if ys > 1e-9:
            yz[idxs] = (y[idxs] - ym) / ys
    return Xz, yz

def spearman(a, b):
    from scipy.stats import spearmanr
    return spearmanr(a, b).statistic

def main():
    X, y, dates, feat_names = load()
    Xz, yz = zscore(X, y, dates)
    uniq = sorted(set(dates))
    n = len(uniq)
    t1 = uniq[int(n * 0.7)], uniq[int(n * 0.85)]
    cut1, cut2 = t1
    seg = {'train': [], 'valid': [], 'test': []}
    for i, d in enumerate(dates):
        if d < cut1:
            seg['train'].append(i)
        elif d < cut2:
            seg['valid'].append(i)
        else:
            seg['test'].append(i)
    print(f'{"特征":<20}{"trainIC":>8}{"validIC":>8}{"testIC":>8}  判定')
    stable, unstable = [], []
    for j, name in enumerate(feat_names):
        ics = {}
        for s in ('train', 'valid', 'test'):
            idx = seg[s]
            ics[s] = spearman(Xz[idx, j], yz[idx]) if len(idx) > 10 else 0.0
        # 稳定性：valid 与 test 同号且 |test|>0.01
        if ics['valid'] * ics['test'] > 0 and abs(ics['test']) > 0.01:
            verdict = '✅稳定'
            stable.append((name, ics))
        elif abs(ics['test']) <= 0.01:
            verdict = '➖无效'
            stable.append((name, ics))
        else:
            verdict = '❌漂移'
            unstable.append((name, ics))
        print(f'{name:<20}{ics["train"]:>8.3f}{ics["valid"]:>8.3f}{ics["test"]:>8.3f}  {verdict}')
    print(f'\n稳定/有效 {len(stable)} 个, 漂移 {len(unstable)} 个')
    # 输出稳定因子清单（给训练脚本用）
    ok = [n for n, _ in stable if n not in [x[0] for x in unstable]]
    print(f'保留因子: {json.dumps(ok)}')

if __name__ == '__main__':
    main()
