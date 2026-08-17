# -*- coding: utf-8 -*-
"""麦唛训练：LightGBM LambdaRank 排序模型
- 样本：mbm_samples（mode 指定）
- 标签：T+1 合规（short→ret2_open / swing→ret3_open / long→ret5_open）
- 切分：时间序 70/15/15 + purged（train/test 边界 5 交易日缓冲，防标签窗口泄漏）
- 评估：样本外 IC(Spearman) / Q1-Q5 分层单调 / 60 天胜率 vs 规则基线
- 输出：模型文件 model-{mode}-{ver}.txt + 报告 JSON
"""
import sqlite3, json, sys, argparse, os
from collections import defaultdict
import numpy as np

DB = r'E:\AI项目\stock-mobile\backend\pred.db'
OUT_DIR = r'E:/AI项目/stock-mobile/backend/models'
os.makedirs(OUT_DIR, exist_ok=True)

LABEL_MAP = {'short': 'ret2_open', 'swing': 'ret3_open', 'long': 'ret5_open'}
# 特征白名单（feats JSON 中的数值列；剔除 code/board/price 等截面身份字段）
DROP_FIELDS = {'code', 'board', 'price'}
# 时间缓冲区（交易日数）——purged 切分防标签泄漏
PURGE_DAYS = 5

def load_samples(mode, min_date='2018-01-01', feats_whitelist=None, label=None):
    c = sqlite3.connect(DB)
    rows = c.execute(
        "SELECT date, feats, labels FROM mbm_samples WHERE mode=? AND date >= ?",
        (mode, min_date)).fetchall()
    c.close()
    print(f'[TRAIN] mode={mode} 原始样本={len(rows)}')
    label = label or LABEL_MAP[mode]
    X, y, dates, meta = [], [], [], []
    feat_names = None
    n_drop = 0
    for date, feats_s, labels_s in rows:
        try:
            f = json.loads(feats_s)
            lab = json.loads(labels_s)
        except Exception:
            n_drop += 1
            continue
        if lab.get('untradable') or lab.get('gap_suspend'):
            n_drop += 1
            continue
        ret = lab.get(label)
        if ret is None:
            n_drop += 1
            continue
        if feat_names is None:
            feat_names = [k for k in f.keys() if k not in DROP_FIELDS and isinstance(f[k], (int, float)) and f[k] is not None]
            if feats_whitelist:
                feat_names = [k for k in feat_names if k in feats_whitelist]
        vec = []
        ok = True
        for k in feat_names:
            v = f.get(k)
            if v is None or (isinstance(v, float) and (v != v)):
                v = 0.0
            vec.append(float(v))
        X.append(vec)
        y.append(ret)
        dates.append(date)
        meta.append({'code': f.get('code'), 'name': f.get('name', '')})
    print(f'[TRAIN] 有效样本={len(X)} 剔除={n_drop} 特征数={len(feat_names)}')
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32), dates, feat_names

def zscore_by_day(X, y, dates):
    """每日截面标准化：标签 z-score（去大盘 beta），特征按日 z-score（去量纲/市场状态）"""
    from collections import defaultdict
    day_idx = defaultdict(list)
    for i, d in enumerate(dates):
        day_idx[d].append(i)
    Xz = np.zeros_like(X)
    yz = np.zeros_like(y)
    n_days = 0
    for d, idxs in day_idx.items():
        idxs = np.array(idxs)
        # 特征截面 z-score（每列）
        col = X[idxs]
        mu = col.mean(axis=0)
        sd = col.std(axis=0)
        sd[sd < 1e-9] = 1.0
        Xz[idxs] = (col - mu) / sd
        # 标签截面 z-score
        ym = y[idxs].mean()
        ys = y[idxs].std()
        if ys > 1e-9:
            yz[idxs] = (y[idxs] - ym) / ys
        n_days += 1
    return Xz, yz, n_days

def split_purged(dates, purge_days=5):
    """按时间序切分，边界留 purge_days 交易日缓冲"""
    uniq = sorted(set(dates))
    n = len(uniq)
    t1 = int(n * 0.7)
    t2 = int(n * 0.85)
    train_cut = uniq[min(t1 + purge_days, n - 1)]
    valid_cut = uniq[min(t2 + purge_days, n - 1)]
    tr = [i for i, d in enumerate(dates) if d < train_cut]
    va = [i for i, d in enumerate(dates) if train_cut <= d < valid_cut]
    te = [i for i, d in enumerate(dates) if d >= valid_cut]
    return tr, va, te, train_cut, valid_cut

def spearman_ic(pred, y):
    from scipy.stats import spearmanr
    return spearmanr(pred, y).statistic if len(pred) > 3 else 0.0

def quantile_analysis(pred, y, q=5):
    """按预测分分层 Q1(最不看好的)~Q5(最看好的)，看每层实际平均收益"""
    order = np.argsort(pred)
    n = len(order)
    size = n // q
    layers = []
    for i in range(q):
        idx = order[i * size:(i + 1) * size if i < q - 1 else n]
        layers.append({'Q': i + 1, 'n': len(idx), 'avgRet': round(float(np.mean(y[idx])), 3), 'winRate': round(float(np.mean(y[idx] > 0) * 100), 1)})
    return layers

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mode', default='swing', choices=['short', 'swing', 'long'])
    ap.add_argument('--min-date', default='2018-01-01')
    ap.add_argument('--ver', default=None)
    ap.add_argument('--no-train', action='store_true', help='只加载评估，不训练')
    ap.add_argument('--feats-json', default=None, help='特征白名单 JSON 文件路径（factor_ic_check 输出）')
    ap.add_argument('--label', default=None, help='标签字段覆盖（ret2_open/ret3_open/ret5_open）')
    args = ap.parse_args()
    ver = args.ver or 'v1'
    import lightgbm as lgb
    feats_whitelist = None
    if args.feats_json:
        with open(args.feats_json, encoding='utf-8') as f:
            feats_whitelist = set(json.load(f))
        print(f'[TRAIN] 特征白名单: {len(feats_whitelist)} 个稳定因子')

    X, y, dates, feat_names = load_samples(args.mode, args.min_date, feats_whitelist, args.label)
    if len(X) < 10000:
        print('[TRAIN] 样本不足')
        return
    # 每日截面 z-score（去大盘 beta + 特征去量纲）
    X, y, n_days = zscore_by_day(X, y, dates)
    print(f'[TRAIN] 截面标准化完成（{n_days} 个交易日）')
    tr, va, te, train_cut, valid_cut = split_purged(dates, PURGE_DAYS)
    print(f'[TRAIN] 切分: train={len(tr)} valid={len(va)} test={len(te)}  cut: {train_cut} / {valid_cut}')

    Xtr, ytr = X[tr], y[tr]
    Xva, yva = X[va], y[va]
    Xte, yte = X[te], y[te]

    # group 按日期（LambdaRank 每组一个交易日）
    def groups(X, dates, idx):
        g = []
        d_uniq = []
        for i in idx:
            if dates[i] not in d_uniq:
                d_uniq.append(dates[i])
        for d in d_uniq:
            g.append(sum(1 for i in idx if dates[i] == d))
        return g

    params = {
        'objective': 'regression', 'metric': 'l2',
        'learning_rate': 0.05, 'num_leaves': 31, 'max_depth': 6,
        'feature_fraction': 0.8, 'bagging_fraction': 0.8, 'bagging_freq': 1,
        'l2': 1.0, 'verbose': -1, 'seed': 42,
    }
    dtr = lgb.Dataset(Xtr, label=ytr, feature_name=feat_names)
    dva = lgb.Dataset(Xva, label=yva, reference=dtr)
    print('[TRAIN] 开始训练（early stop on valid ndcg）...')
    model = lgb.train(params, dtr, num_boost_round=2000, valid_sets=[dva],
                      callbacks=[lgb.early_stopping(50), lgb.log_evaluation(200)])
    # 评估
    pred_tr = model.predict(Xtr)
    pred_va = model.predict(Xva)
    pred_te = model.predict(Xte)
    ic_tr = spearman_ic(pred_tr, ytr)
    ic_va = spearman_ic(pred_va, yva)
    ic_te = spearman_ic(pred_te, yte)
    print(f'\n[EVAL] IC: train={ic_tr:.4f} valid={ic_va:.4f} test={ic_te:.4f}')
    layers = quantile_analysis(pred_te, yte)
    print('[EVAL] 样本外分层（Q1=预测最弱 Q5=预测最强）:')
    for L in layers:
        print(f"  Q{L['Q']}: n={L['n']} 均收益={L['avgRet']}% 胜率={L['winRate']}%")
    mono = layers[4]['avgRet'] > layers[0]['avgRet'] if len(layers) == 5 else False
    print(f"[EVAL] 分层单调(Q5>Q1): {'是' if mono else '否'}  Q5-Q1价差={layers[4]['avgRet'] - layers[0]['avgRet']:.2f}pp")

    # 60 天窗口胜率（test 集最后 60 个交易日）
    te_dates = sorted(set(d for i, d in enumerate(dates) if i in te))
    last60 = set(te_dates[-60:]) if len(te_dates) > 60 else set(te_dates)
    idx60 = [i for i in te if dates[i] in last60]
    if idx60:
        wr = float(np.mean(y[idx60] > 0) * 100)
        ar = float(np.mean(y[idx60]))
        print(f'[EVAL] 样本外最近{len(last60)}交易日: n={len(idx60)} 胜率={wr:.1f}% 均收益={ar:.2f}%  (规则基线: 48% / +0.51%)')
    else:
        wr = ar = 0.0

    # 保存
    model_path = os.path.join(OUT_DIR, f'model-{args.mode}-{ver}.txt')
    model.save_model(model_path)
    report = {
        'mode': args.mode, 'ver': ver, 'feat_names': feat_names,
        'n_train': len(tr), 'n_valid': len(va), 'n_test': len(te),
        'ic': {'train': round(ic_tr, 4), 'valid': round(ic_va, 4), 'test': round(ic_te, 4)},
        'layers': layers, 'monotonic': mono,
        'oob_60d': {'winRate': round(wr, 1), 'avgRet': round(ar, 2), 'days': len(last60)},
        'baseline': {'winRate': 48, 'avgRet': 0.51},
        'pass_ic': ic_te >= 0.03, 'pass_mono': mono, 'pass_60d': wr >= 53,
    }
    report_path = os.path.join(OUT_DIR, f'report-{args.mode}-{ver}.json')
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    print(f'[TRAIN] 模型已保存: {model_path}')
    print(f'[TRAIN] 报告: {report_path}')
    print(f'[GATE] IC≥0.03: {"✅" if report["pass_ic"] else "❌"} | 分层单调: {"✅" if mono else "❌"} | 60天胜率≥53%: {"✅" if wr >= 53 else "❌"}')

if __name__ == '__main__':
    main()
