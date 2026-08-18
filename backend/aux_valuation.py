# -*- coding: utf-8 -*-
"""服务器端批量补数 v2：估值历史（按日全市场）+ 龙虎榜历史（按日）→ /tmp/aux_data.db
资金流历史走 push2his（IP 冷却后单独重试）
"""
import urllib.request, json, sqlite3, time, datetime

DB = '/tmp/aux_data.db'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0'

def http_get(url):
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer': 'https://data.eastmoney.com/'})
            return json.loads(urllib.request.urlopen(req, timeout=25).read().decode())
        except Exception as e:
            if i == 2:
                raise
            time.sleep(3)

def trade_days(start, end):
    d = datetime.date.fromisoformat(start)
    e = datetime.date.fromisoformat(end)
    while d <= e:
        if d.weekday() < 5:
            yield d.isoformat()
        d += datetime.timedelta(days=1)

def main():
    c = sqlite3.connect(DB)
    c.execute('CREATE TABLE IF NOT EXISTS valuation_daily (date TEXT, code TEXT, pe_ttm REAL, pe_lar REAL, pb REAL, peg REAL, mcap REAL, shares REAL, PRIMARY KEY(date, code))')
    c.execute('CREATE TABLE IF NOT EXISTS lhb_daily (date TEXT, code TEXT, name TEXT, reason TEXT, PRIMARY KEY(date, code))')
    c.commit()

    done_v = c.execute('SELECT COUNT(DISTINCT date) FROM valuation_daily').fetchone()[0]
    print(f'估值已有 {done_v} 天', flush=True)

    # 1. 估值：2023-01 至今按日
    n = 0
    for ds in trade_days('2023-01-03', '2026-08-18'):
        if c.execute('SELECT 1 FROM valuation_daily WHERE date=? LIMIT 1', (ds,)).fetchone():
            continue
        try:
            url = f"https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_VALUEANALYSIS_DET&columns=ALL&filter=(TRADE_DATE%3D%27{ds}%27)&pageNumber=1&pageSize=5000"
            d = http_get(url)
            data = (d.get('result') or {}).get('data') or []
            pages = (d.get('result') or {}).get('pages') or 1
            if pages > 1:
                for p in range(2, pages + 1):
                    d2 = http_get(url.replace('pageNumber=1', f'pageNumber={p}'))
                    data += (d2.get('result') or {}).get('data') or []
                    time.sleep(0.3)
            for row in data:
                c.execute('INSERT OR IGNORE INTO valuation_daily VALUES (?,?,?,?,?,?,?,?)',
                          (ds, row.get('SECURITY_CODE'), row.get('PE_TTM'), row.get('PE_LAR'),
                           row.get('PB_MRQ'), row.get('PEG_CAR'), row.get('TOTAL_MARKET_CAP'), row.get('TOTAL_SHARES')))
            c.commit()
            n += 1
            if n % 50 == 0:
                print(f'估值已补 {n} 天（到 {ds}）', flush=True)
        except Exception as e:
            print(f'val ERR {ds}: {str(e)[:70]}', flush=True)
        time.sleep(0.8)
    print(f'估值完成 {n} 天', flush=True)
    print('AUX2_DONE', flush=True)

if __name__ == '__main__':
    main()
