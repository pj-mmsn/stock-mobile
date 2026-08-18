# -*- coding: utf-8 -*-
"""指数全量历史 → qlib CSV（新浪源，akshare）"""
import os
os.environ.setdefault('HTTP_PROXY', 'http://127.0.0.1:7890')
os.environ.setdefault('HTTPS_PROXY', 'http://127.0.0.1:7890')
import akshare as ak
import time

INDEXES = {
    'SH000001': 'sh000001', 'SZ399001': 'sz399001', 'SZ399006': 'sz399006',
    'SH000300': 'sh000300', 'SH000905': 'sh000905', 'SH000016': 'sh000016',
    'SH000688': 'sh000688', 'SZ399303': 'sz399303',
}
OUT = r'E:\AI项目\stock-mobile\backend\qlib_data\csv_idx'
os.makedirs(OUT, exist_ok=True)

for name, sym in INDEXES.items():
    try:
        df = ak.stock_zh_index_daily(symbol=sym)
        with open(os.path.join(OUT, name + '.csv'), 'w') as f:
            f.write('date,open,close,high,low,volume,factor\n')
            for _, r in df.iterrows():
                f.write(f"{r['date']},{r['open']},{r['close']},{r['high']},{r['low']},{r['volume']},1.0\n")
        print(f'{name}: {len(df)} 根 | {df.iloc[0].date} ~ {df.iloc[-1].date}')
        time.sleep(1)
    except Exception as e:
        print(f'{name}: ERR {str(e)[:100]}')
print('IDX_DONE')
