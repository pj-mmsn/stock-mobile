# -*- coding: utf-8 -*-
"""因子扩展 v1 向量化版：numpy 向量算 RS + 涨停标记（速度快 30 倍）"""
import os, glob
import numpy as np

CSV_DIR = r'E:\AI项目\stock-mobile\backend\qlib_data\csv_full'
IDX_DIR = r'E:\AI项目\stock-mobile\backend\qlib_data\csv_idx'
OUT_DIR = r'E:\AI项目\stock-mobile\backend\qlib_data\csv_v2'
os.makedirs(OUT_DIR, exist_ok=True)

def load_idx_series(name, start='2018-01-01'):
    dates, closes = [], []
    with open(os.path.join(IDX_DIR, name + '.csv'), encoding='utf-8') as f:
        next(f)
        for line in f:
            p = line.strip().split(',')
            if len(p) >= 3 and p[0] >= start and float(p[2]) > 0:
                dates.append(p[0]); closes.append(float(p[2]))
    return np.array(dates), np.array(closes)

def limit_pct(inst):
    if inst.startswith(('SH688', 'SZ300', 'SZ301')): return 0.20
    if inst.startswith(('SZ8', 'SH4', 'SH9')): return 0.30
    return 0.10

# 指数序列（2018 起，训练窗口 2022 起所以覆盖足够）
id300 = load_idx_series('SH000300'); id500 = load_idx_series('SH000905'); idcyb = load_idx_series('SZ399006')
print('指数加载: 300=', len(id300[0]), '500=', len(id500[0]), 'cyb=', len(idcyb[0]))

def rs_cols(dates, closes, idx_dates, idx_closes):
    """返回 rs5, rs20 两列（个股 n 日涨幅 - 指数 n 日涨幅），向量化"""
    # 指数日收益率（n 日前收盘）
    def idx_ret_n(n):
        # 构建 date->close dict，然后逐日查 n 日前
        dmap = {d: c for d, c in zip(idx_dates, idx_closes)}
        out = np.full(len(dates), np.nan)
        for i, d in enumerate(dates):
            # 找指数里 <= d 的最近 n 天前
            pos = np.searchsorted(idx_dates, d)
            if pos <= n: continue
            base = idx_closes[pos - 1 - n]
            cur = idx_closes[pos - 1]
            if base > 0:
                out[i] = cur / base - 1
        return out
    own5 = np.full(len(closes), np.nan); own20 = np.full(len(closes), np.nan)
    own5[5:] = closes[5:] / closes[:-5] - 1
    own20[20:] = closes[20:] / closes[:-20] - 1
    i5 = idx_ret_n(5); i20 = idx_ret_n(20)
    return own5 - i5, own20 - i20

def main():
    files = glob.glob(os.path.join(CSV_DIR, '*.csv'))
    n = 0
    for fp in files:
        inst = os.path.basename(fp)[:-4]
        dates, o, c, h, l, v = [], [], [], [], [], []
        with open(fp, encoding='utf-8') as f:
            f.readline()
            for line in f:
                p = line.strip().split(',')
                if len(p) < 6 or p[0] < '2018-01-01':
                    continue
                dates.append(p[0]); o.append(p[1]); c.append(float(p[2])); h.append(p[3]); l.append(p[4]); v.append(p[5])
        if len(c) < 300:
            continue
        c = np.array(c)
        lim = limit_pct(inst)
        # 涨停标记
        zt = np.zeros(len(c), dtype=int)
        prev = np.concatenate([[0], c[:-1]])
        lim_price = np.round(prev * (1 + lim), 2)
        zt = (np.abs(c - lim_price) < 0.005).astype(int)
        # 连板
        streak = np.zeros(len(c), dtype=int)
        cur = 0
        for i in range(len(zt)):
            cur = cur + 1 if zt[i] else 0
            streak[i] = cur
        # RS
        rs300_5, rs300_20 = rs_cols(dates, c, id300[0], id300[1])
        rs500_5, rs500_20 = rs_cols(dates, c, id500[0], id500[1])
        rscyb_5, rscyb_20 = rs_cols(dates, c, idcyb[0], idcyb[1])
        def fmt(x):
            return '' if x != x else f'{x:.6f}'
        with open(os.path.join(OUT_DIR, inst + '.csv'), 'w', newline='', encoding='utf-8') as fout:
            fout.write('date,open,close,high,low,volume,factor,zt_flag,lb_streak,rs300_5,rs300_20,rs500_5,rs500_20,rscyb_5,rscyb_20\n')
            for i in range(len(c)):
                fout.write(f"{dates[i]},{o[i]},{c[i]:.4f},{h[i]},{l[i]},{v[i]},1.0,{zt[i]},{streak[i]},{fmt(rs300_5[i])},{fmt(rs300_20[i])},{fmt(rs500_5[i])},{fmt(rs500_20[i])},{fmt(rscyb_5[i])},{fmt(rscyb_20[i])}\n")
        n += 1
        if n % 1000 == 0:
            print(f'已处理 {n}/{len(files)}', flush=True)
    print(f'完成 {n} 只 -> {OUT_DIR}', flush=True)

if __name__ == '__main__':
    main()
