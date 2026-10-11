# -*- coding: utf-8 -*-
"""dump csv_v2 → bin_v2（含 8 个扩展因子列）"""
import sys
sys.path.insert(0, r'E:\AI项目\stock-mobile\backend')
from dump_bin import DumpDataAll

if __name__ == '__main__':
    d = DumpDataAll(
        data_path=r'E:\AI项目\stock-mobile\backend\qlib_data\csv_v2',
        qlib_dir=r'E:\AI项目\stock-mobile\backend\qlib_data\bin_v2',
        include_fields='open,close,high,low,volume,factor,zt_flag,lb_streak,rs300_5,rs300_20,rs500_5,rs500_20,rscyb_5,rscyb_20',
        freq='day',
        max_workers=8,
    )
    d.dump()
    print('DUMP_V2_DONE')
