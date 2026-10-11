# -*- coding: utf-8 -*-
"""服务器版：csv_v2 → bin_v2 + 池文件生成"""
import sys, os, glob
sys.path.insert(0, '/tmp')

# 1. dump
from dump_bin import DumpDataAll

d = DumpDataAll(
    data_path='/tmp/qlib_csv_v2',
    qlib_dir='/tmp/qlib_data_v2/bin',
    include_fields='open,close,high,low,volume,factor,zt_flag,lb_streak,rs300_5,rs300_20,rs500_5,rs500_20,rscyb_5,rscyb_20',
    freq='day',
    max_workers=4,
)
d.dump()
print('DUMP_SRV_DONE', flush=True)

# 2. 池文件（收盘>8 元 + 600 根以上）
out = []
first_dates = {}
for fp in glob.glob('/tmp/qlib_csv_v2/*.csv'):
    inst = os.path.basename(fp)[:-4]
    closes = []
    with open(fp, encoding='utf-8') as f:
        f.readline()
        for line in f:
            p = line.strip().split(',')
            if len(p) > 2:
                try: closes.append(float(p[2]))
                except: pass
    if len(closes) >= 600 and closes[-1] > 8.0:
        out.append(inst)
    with open(fp, encoding='utf-8') as f:
        f.readline()
        line = f.readline()
        first_dates[inst] = line.strip().split(',')[0] if line else '2018-01-01'

dst = '/tmp/qlib_data_v2/bin/instruments/instruments_filtered.txt'
with open(dst, 'w') as f:
    for inst in sorted(out):
        f.write(f'{inst}\t{first_dates.get(inst, "2018-01-01")}\t2099-01-01\n')
print(f'POOL_DONE {len(out)} 只', flush=True)
