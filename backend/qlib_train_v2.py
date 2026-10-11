# -*- coding: utf-8 -*-
"""qlib v2 训练：Alpha158Ext（158 + 8 扩展因子 + 涨停衍生）+ LightGBM
扩展因子：zt_flag 涨停标记 / lb_streak 连板 / RS 相对强度（沪深300/中证500/创业板 × 5/20日）
"""
import os, sys
sys.path.insert(0, r'E:\AI项目\stock-mobile\backend')
import numpy as np
import pandas as pd

PROVIDER = r'E:\AI项目\stock-mobile\backend\qlib_data\bin_v2'

class Alpha158Ext:
    """扩展因子表达式（追加到 Alpha158 的 158 个之后）"""
    EXTRA_FEATURES = [
        # 涨停情绪（个股级）—— (表达式, 名字)
        ("$zt_flag", "zt_flag"),
        ("$lb_streak", "lb_streak"),
        ("Mean($zt_flag, 5)", "zt_freq5"),
        ("Mean($zt_flag, 20)", "zt_freq20"),
        ("Sum($zt_flag, 10)", "zt_sum10"),
        ("Max($lb_streak, 20)", "lb_max20"),
        ("Ref($lb_streak, 1)", "lb_prev"),
        # 相对强度（去大盘 beta）
        ("$rs300_5", "rs300_5"),
        ("$rs300_20", "rs300_20"),
        ("$rs500_5", "rs500_5"),
        ("$rs500_20", "rs500_20"),
        ("$rscyb_5", "rscyb_5"),
        ("$rscyb_20", "rscyb_20"),
        ("Mean($rs300_5, 5)", "rs300_5_m5"),
        ("Mean($rs300_20, 10)", "rs300_20_m10"),
        ("Std($rs300_5, 20)", "rs300_5_std20"),
        ("Max($rs300_5, 20)", "rs300_5_max20"),
        ("Min($rs300_5, 20)", "rs300_5_min20"),
    ]

def main():
    import qlib
    from qlib.contrib.data.handler import Alpha158
    from qlib.data.dataset import DatasetH
    from qlib.config import C

    qlib.init(provider_uri=PROVIDER, region='cn')
    C.parallel_num = 1
    C.joblib_backend = 'loky'
    C.maxtasksperchild = None

    class A158E(Alpha158):
        def get_feature_config(self):
            exprs, names = super().get_feature_config()
            extra_exprs = [e for e, _ in Alpha158Ext.EXTRA_FEATURES]
            extra_names = [n for _, n in Alpha158Ext.EXTRA_FEATURES]
            return list(exprs) + extra_exprs, list(names) + extra_names

    ST, ET = '2022-01-04', '2026-07-20'
    handler = {
        'class': A158E,
        'kwargs': {
            'start_time': ST, 'end_time': ET,
            'fit_start_time': ST, 'fit_end_time': '2025-12-31',
            'instruments': 'instruments_filtered',
            'infer_processors': [
                # GBDT 树模型尺度无关，去掉 RobustZScoreNorm 省 4GB 内存且不影响效果
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
        num_threads=20, verbosity=-1,
    )
    print('开始训练（Alpha158 + 17 扩展因子）...', flush=True)
    model.fit(ds)

    def ic_eval(seg):
        pred = model.predict(ds, segment=seg)
        label = ds.prepare(seg, col_set='label')
        ics = []
        for d in label.index.get_level_values('datetime').unique():
            df = pd.concat([pred.loc[d], label.loc[d]], axis=1).dropna()
            if len(df) > 10:
                ics.append(df.iloc[:, 0].corr(df.iloc[:, 1]))
        ics = np.array(ics)
        return np.nanmean(ics), np.nanmean(ics) / (np.nanstd(ics) + 1e-9), len(ics)

    for seg in ['valid', 'test']:
        ic, icir, n = ic_eval(seg)
        print(f'\n===== {seg} =====')
        print(f'IC = {ic:.4f} | ICIR = {icir:.4f} | 天数 = {n}')
    print('\nQLIB_V2_DONE')

if __name__ == '__main__':
    main()
