# -*- coding: utf-8 -*-
"""qlib alpha158 + LightGBM 训练回测（Python API 直跑，不依赖 yaml CLI）"""
import os, sys, datetime
sys.path.insert(0, r'E:\AI项目\stock-mobile\backend')

PROVIDER = r'E:\AI项目\stock-mobile\backend\qlib_data\bin_full'

def main():
    import qlib
    from qlib.data import D
    from qlib.data.dataset import DatasetH, TSDatasetH
    from qlib.data.dataset.handler import DataHandlerLP
    from qlib.contrib.data.handler import Alpha158

    qlib.init(provider_uri=PROVIDER, region='cn')
    # Windows joblib 多进程会内存暴涨，强制单线程加载
    from qlib.config import C
    C.parallel_num = 1
    C.joblib_backend = 'loky'
    C.maxtasksperchild = None

    # 数据窗口
    ST, ET = '2022-01-04', '2026-07-20'
    handler = {
        'class': 'Alpha158',
        'module_path': 'qlib.contrib.data.handler',
        'kwargs': {
            'start_time': ST,
            'end_time': ET,
            'fit_start_time': ST,
            'fit_end_time': '2025-12-31',
            'instruments': 'instruments_filtered',
            'infer_processors': [
                {'class': 'RobustZScoreNorm', 'kwargs': {'fields_group': 'feature', 'clip_outlier': True}},
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
    print('dataset 构建完成:', ds.prepare('train', col_set=['feature', 'label']))
    X = ds.prepare('train', col_set=['feature', 'label'])
    print('train 样本:', X.shape)

    from qlib.contrib.model.gbdt import LGBModel
    model = LGBModel(
        loss='mse', colsample_bytree=0.8879, learning_rate=0.0421, subsample=0.8789,
        lambda_l1=205.6999, lambda_l2=580.9768, max_depth=8, num_leaves=210,
        num_threads=20, verbosity=-1,
    )
    print('开始训练...')
    model.fit(ds)

    # 预测 + IC 评估
    import numpy as np
    from qlib.utils import init_instance_by_config
    import pandas as pd
    pred = model.predict(ds, segment='valid')
    label = ds.prepare('valid', col_set='label')
    ic_all = []
    for d in label.index.get_level_values('datetime').unique():
        df = pd.concat([pred.loc[d], label.loc[d]], axis=1).dropna()
        if len(df) > 10:
            ic_all.append(df.iloc[:, 0].corr(df.iloc[:, 1]))
    ic = np.nanmean(ic_all)
    icir = np.nanmean(ic_all) / (np.nanstd(ic_all) + 1e-9)
    print(f'\n===== 验证集结果 =====')
    print(f'IC = {ic:.4f} | ICIR = {icir:.4f} | 天数 = {len(ic_all)}')

    # test 集
    pred_t = model.predict(ds, segment='test')
    label_t = ds.prepare('test', col_set='label')
    ic_t = []
    for d in label_t.index.get_level_values('datetime').unique():
        df = pd.concat([pred_t.loc[d], label_t.loc[d]], axis=1).dropna()
        if len(df) > 10:
            ic_t.append(df.iloc[:, 0].corr(df.iloc[:, 1]))
    print(f'\n===== 测试集结果 =====')
    print(f'IC = {np.nanmean(ic_t):.4f} | ICIR = {np.nanmean(ic_t)/(np.nanstd(ic_t)+1e-9):.4f} | 天数 = {len(ic_t)}')
    print('\nQLIB_DONE')

if __name__ == '__main__':
    main()
