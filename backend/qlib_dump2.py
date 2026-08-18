# -*- coding: utf-8 -*-
"""直接用 Python API 跑 dump_bin（绕过 fire CLI）"""
import sys
sys.path.insert(0, r'E:\AI项目\stock-mobile\backend')

from dump_bin import DumpDataAll

if __name__ == '__main__':
    d = DumpDataAll(
        data_path=r'E:\AI项目\stock-mobile\backend\qlib_data\csv',
        qlib_dir=r'E:\AI项目\stock-mobile\backend\qlib_data\bin',
        include_fields='open,close,high,low,volume,factor',
        freq='day',
        max_workers=8,
    )
    d.dump()
    print('DUMP_DONE')
