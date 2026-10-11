# -*- coding: utf-8 -*-
"""服务器版：qlib 胜率回测（TopK 选股 + 20日持有）
对 test 段每天预测，选 top50，统计持有 20 日的胜率/平均收益，与麦唛口径对比
"""
import os, sys
sys.path.insert(0, '/tmp')
os.environ.setdefault('MLFLOW_ALLOW_FILE_STORE', 'true')
import numpy as np
import pandas as pd

PROVIDER = '/tmp/qlib_data_v2/bin'

class Alpha158Ext:
    EXTRA_FEATURES = [
        ("$zt_flag", "zt_flag"), ("$lb_streak", "lb_streak"),
        ("Mean($zt_flag, 5)", "zt_freq5"), ("Mean($zt_flag, 20)", "zt_freq20"),
        ("Sum($zt_flag, 10)", "zt_sum10"), ("Max($lb_streak, 20)", "lb_max20"),
        ("Ref($lb_streak, 1)", "lb_prev"),
        ("$rs300_5", "rs300_5"), ("$rs300_20", "rs300_20"),
        ("$rs500_5", "rs500_5"), ("$rs500_20", "rs500_20"),
        ("$rscyb_5", "rscyb_5"), ("$rscyb_20", "rscyb_20"),
        ("Mean($rs300_5, 5)", "rs300_5_m5"), ("Mean($rs300_20, 10)", "rs300_20_m10"),
        ("Std($rs300_5, 20)", "rs300_5_std20"),
        ("Max($rs300_5, 20)", "rs300_5_max20"), ("Min($rs300_5, 20)", "rs300_5_min20"),
    ]

def main():
    import qlib
    from qlib.contrib.data.handler import Alpha158
    from qlib.data.dataset import DatasetH
    from qlib.data import D
    from qlib.config import C

    qlib.init(provider_uri=PROVIDER, region='cn')
    C.parallel_num = 1
    C.joblib_backend = 'loky'
    C.maxtasksperchild = None

    class A158E(Alpha158):
        def get_feature_config(self):
            exprs, names = super().get_feature_config()
            return list(exprs) + [e for e, _ in Alpha158Ext.EXTRA_FEATURES], \
                   list(names) + [n for _, n in Alpha158Ext.EXTRA_FEATURES]

    ST, ET = '2022-01-04', '2026-07-20'
    handler = {
        'class': A158E,
        'kwargs': {
            'start_time': ST, 'end_time': ET,
            'fit_start_time': ST, 'fit_end_time': '2025-12-31',
            'instruments': 'instruments_filtered',
            'infer_processors': [
                {'class': 'Fillna', 'kwargs': {'fields_group': 'feature'}},
            ],
            'learn_processors': [
                {'class': 'DropnaLabel'},
                {'class': 'CSRankNorm', 'kwargs': {'fields_group': 'label'}},
            ],
            'label': ['Ref($close, -20) / Ref($close, -1) - 1'],
        },
    }
    ds = DatasetH(handler=handler, step_len=5, segments={
        'train': [ST, '2025-12-31'],
        'valid': ['2026-01-01', '2026-04-30'],
        'test': ['2026-05-01', '2026-07-20'],
    })

    from qlib.contrib.model.gbdt import LGBModel
    model = LGBModel(
        loss='mse', colsample_bytree=0.8879, learning_rate=0.0421, subsample=0.8789,
        lambda_l1=205.6999, lambda_l2=580.9768, max_depth=8, num_leaves=210,
        num_threads=2, verbosity=-1,
    )
    model.fit(ds)
    print('训练完成，开始胜率回测', flush=True)

    # 对 test 段每日预测，top50，算 20 日真实收益
    pred = model.predict(ds, segment='test')
    close = D.features(D.instruments('instruments_filtered'), ['$close'],
                       start_time='2026-04-15', end_time='2026-08-15', freq='day')['$close'].unstack()
    print('收盘价矩阵:', close.shape, flush=True)

    dates = sorted(pred.index.get_level_values('datetime').unique())
    rows = []
    for d in dates:
        p = pred.loc[d].sort_values(ascending=False).head(50)
        for inst, score in p.items():
            # 入场价 = d 日收盘（下一日开盘近似），出场 = 20 交易日后收盘
            try:
                entry = close.loc[d, inst]
            except KeyError:
                continue
            future = close.index[close.index > d]
            if len(future) < 20:
                continue
            exit_d = future[19]
            try:
                exit_px = close.loc[exit_d, inst]
            except KeyError:
                continue
            if entry and exit_px and entry > 0:
                ret = exit_px / entry - 1
                rows.append({'date': d, 'inst': inst, 'score': score, 'ret': ret})

    df = pd.DataFrame(rows)
    if len(df) == 0:
        print('NO_ROWS', flush=True)
        return
    total = len(df)
    wins = (df['ret'] > 0).sum()
    avg_ret = df['ret'].mean()
    med_ret = df['ret'].median()
    print(f'===== 胜率回测结果（test 段，top50/日，20日持有）=====')
    print(f'样本数: {total} | 胜率: {wins/total*100:.1f}% | 平均收益: {avg_ret*100:.2f}% | 中位收益: {med_ret*100:.2f}%', flush=True)
    # 分档
    q_hi = df[df['score'] >= df['score'].quantile(0.5)]
    print(f'前50%高分: 胜率 {(q_hi["ret"]>0).mean()*100:.1f}% | 平均 {q_hi["ret"].mean()*100:.2f}% (n={len(q_hi)})', flush=True)
    # 按日胜率分布
    daily_win = df.groupby('date')['ret'].apply(lambda x: (x > 0).mean())
    print(f'日均胜率: 均值 {daily_win.mean()*100:.1f}% | 最差 {daily_win.min()*100:.1f}% | 最好 {daily_win.max()*100:.1f}%', flush=True)
    print('WINRATE_DONE', flush=True)

if __name__ == '__main__':
    main()
