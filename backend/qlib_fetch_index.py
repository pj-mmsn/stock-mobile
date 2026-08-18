# -*- coding: utf-8 -*-
"""拉大盘指数全量历史K线 → qlib CSV（腾讯源，指数代码少不受限流影响）"""
import urllib.request, json, os, time

INDEXES = {
    'SH000001': 'sh000001',  # 上证指数
    'SZ399001': 'sz399001',  # 深证成指
    'SZ399006': 'sz399006',  # 创业板指
    'SH000300': 'sh000300',  # 沪深300
    'SH000905': 'sh000905',  # 中证500
    'SH000016': 'sh000016',  # 上证50
    'SH000688': 'sh000688',  # 科创50
    'SZ399303': 'sz399303',  # 国证2000
}
OUT = r'E:\AI项目\stock-mobile\backend\qlib_data\csv_idx'
os.makedirs(OUT, exist_ok=True)

def fetch(code, n=8000):
    url = f'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={code},day,,,{n},qfq'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://gu.qq.com/'})
    data = json.loads(urllib.request.urlopen(req, timeout=20).read().decode())
    d = data['data'][code]
    bars = d.get('day') or d.get('qfqday') or []
    return bars if isinstance(bars, list) else []

def main():
    for name, code in INDEXES.items():
        try:
            bars = fetch(code)
            if not bars:
                print(f'{name}: 空'); continue
            with open(os.path.join(OUT, name + '.csv'), 'w') as f:
                f.write('date,open,close,high,low,volume,factor\n')
                for b in bars:
                    d, o, c, h, l, v = b[0], float(b[1]), float(b[2]), float(b[3]), float(b[4]), float(b[5])
                    if o <= 0 or c <= 0: continue
                    f.write(f'{d},{o},{c},{h},{l},{v:.0f},1.0\n')
            print(f'{name}: {len(bars)} 根, 首 {bars[0][0]}, 末 {bars[-1][0]}')
            time.sleep(0.5)
        except Exception as e:
            print(f'{name}: ERR {e}')
    print('IDX_DONE')

if __name__ == '__main__':
    main()
