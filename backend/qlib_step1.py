# -*- coding: utf-8 -*-
"""qlib 完整流程：CSV → bin → alpha158 训练 → 回测评估"""
import os
os.environ.setdefault('QIB_DATA_DIR', r'E:\AI项目\stock-mobile\backend\qlib_data')

def main():
    from qlib.data import D
    from qlib.data.inst_processor import PITInstProcessor
    from qlib.config import REG_CN

    # 1. dump_bin
    from scripts.dump_bin import DumpDataAll
    provider_uri = r'E:\AI项目\stock-mobile\backend\qlib_data'
    DumpDataAll(csv_path=provider_uri + r'\csv', qlib_dir=provider_uri + r'\bin', include_fields=['open', 'close', 'high', 'low', 'volume', 'factor']).dump()
    print('bin 完成')

if __name__ == '__main__':
    main()
