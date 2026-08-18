# -*- coding: utf-8 -*-
"""K线导出 → qlib CSV（klines 表: secid + data JSON + ts）"""
import sqlite3, json, os

DB = r'E:\AI项目\stock-mobile\backend\pred.db'
OUT = r'E:\AI项目\stock-mobile\backend\qlib_data\csv'
os.makedirs(OUT, exist_ok=True)

def main():
    c = sqlite3.connect(DB)
    rows = c.execute('SELECT secid, data FROM klines').fetchall()
    print(f'共 {len(rows)} 只股票')
    done = 0
    for secid, data in rows:
        try:
            bars = json.loads(data)
        except Exception:
            continue
        if not bars or len(bars) < 60:
            continue
        code = str(secid).split('.')[-1]
        fname = ('SH' if code.startswith(('6', '9')) else 'SZ') + code + '.csv'
        with open(os.path.join(OUT, fname), 'w', encoding='utf-8') as f:
            f.write('date,open,close,high,low,volume,factor\n')
            for b in bars:
                o, cl = b.get('o'), b.get('c')
                if o is None or cl is None or float(o) <= 0 or float(cl) <= 0:
                    continue
                h = b.get('h') or cl
                l = b.get('l') or cl
                v = b.get('v') or 0
                f.write(f"{b['t']},{float(o)},{float(cl)},{float(h)},{float(l)},{float(v)},1.0\n")
        done += 1
        if done % 1000 == 0:
            print(f'已导出 {done}/{len(rows)}')
    print(f'完成: {done} 只 -> {OUT}')

if __name__ == '__main__':
    main()
