# -*- coding: utf-8 -*-
"""baostock 全市场估值历史 → qlib_data/valuation.csv（逐日 PE_TTM/PB/PS/PCF/换手，2006 至今）"""
import baostock as bs
import time, os

OUT = r'E:\AI项目\stock-mobile\backend\qlib_data\valuation_bs.csv'
SYMBOLS = []
# 从 csv_full 拿股票列表
import glob
for f in glob.glob(r'E:\AI项目\stock-mobile\backend\qlib_data\csv_full\*.csv'):
    fn = os.path.basename(f)[:-4]  # SH600000
    code = fn[2:]
    prefix = 'sh.' if fn.startswith('SH') else 'sz.'
    SYMBOLS.append((prefix + code, code))

def main():
    bs.login()
    header_written = False
    n = 0
    import os as _os
    done_codes = set()
    if _os.path.exists(OUT):
        for _l in open(OUT, encoding='utf-8'):
            _p = _l.strip().split(',')
            if len(_p) > 1 and _p[0].isdigit(): done_codes.add(_p[0])
    _mode = 'a' if done_codes else 'w'
    with open(OUT, _mode, encoding='utf-8', buffering=1) as fout:
        fout.write('code,date,pe_ttm,pb,ps,pcf,turn\n')
        for sym, code in SYMBOLS:
            if code in done_codes: continue
            try:
                time.sleep(0.4)
                rs = bs.query_history_k_data_plus(
                    sym, 'date,peTTM,pbMRQ,psTTM,pcfNcfTTM,turn',
                    start_date='2006-01-01', end_date='2026-08-18',
                    frequency='d', adjustflag='3')
                rows = []
                while (rs.error_code == '0') and rs.next():
                    rows.append(rs.get_row_data())
                for r in rows:
                    fout.write(f'{code},{r[0]},{r[2]},{r[3]},{r[4]},{r[5]},{r[6]}\n')
                fout.flush()
                n += 1
                if n % 1000 == 0:
                    print(f'已拉 {n}/{len(SYMBOLS)}', flush=True)
            except Exception as e:
                print(f'ERR {sym}: {str(e)[:60]}', flush=True)
            time.sleep(0.4)
    bs.logout()
    print(f'估值完成 {n} 只 -> {OUT}', flush=True)

if __name__ == '__main__':
    main()
