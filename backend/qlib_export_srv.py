# -*- coding: utf-8 -*-
"""服务器端：klines(全量25年) → qlib CSV。data 字段兼容 [json数组] 和 gzip bytes 两种格式"""
import sqlite3, json, os, gzip, zlib

DB = '/var/lib/stock-mobile/pred.db'
OUT = '/tmp/qlib_csv'
os.makedirs(OUT, exist_ok=True)

def parse(data):
    if isinstance(data, bytes):
        try:
            data = gzip.decompress(data)
        except Exception:
            try:
                data = zlib.decompress(data)
            except Exception:
                return []
    if isinstance(data, (bytes, bytearray)):
        data = data.decode('utf-8', 'replace')
    try:
        return json.loads(data)
    except Exception:
        return []

def main():
    c = sqlite3.connect(DB)
    rows = c.execute('SELECT secid, data FROM klines').fetchall()
    done = 0
    for secid, data in rows:
        bars = parse(data)
        if not bars or len(bars) < 60:
            continue
        code = str(secid).split('.')[-1]
        fname = ('SH' if code.startswith(('6', '9')) else 'SZ') + code + '.csv'
        try:
            with open(os.path.join(OUT, fname), 'w', encoding='utf-8') as f:
                f.write('date,open,close,high,low,volume,factor\n')
                for b in bars:
                    # 兼容 dict 和 list 两种 bar 格式
                    if isinstance(b, dict):
                        t, o, cl, h, l, v = b.get('t'), b.get('o'), b.get('c'), b.get('h'), b.get('l'), b.get('v')
                    else:
                        t, o, cl, h, l, v = b[0], b[1], b[2], b[3], b[4], b[5]
                    try:
                        o, cl = float(o), float(cl)
                    except Exception:
                        continue
                    if o <= 0 or cl <= 0 or not t:
                        continue
                    h = float(h) if h and float(h) > 0 else cl
                    l = float(l) if l and float(l) > 0 else cl
                    v = float(v) if v else 0.0
                    f.write(f'{t},{o:.4f},{cl:.4f},{h:.4f},{l:.4f},{v:.0f},1.0\n')
            done += 1
        except Exception as e:
            print(f'ERR {fname}: {e}', flush=True)
            continue
        if done % 1000 == 0:
            print(f'已导出 {done}/{len(rows)}', flush=True)
    print(f'DONE {done} 只', flush=True)

if __name__ == '__main__':
    main()
