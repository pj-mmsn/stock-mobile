# -*- coding: utf-8 -*-
"""服务器端：北向资金（市场级每日净买入 + 个股持股聚合）→ /tmp/aux_data.db
1. north_deal: RPT_MUTUAL_DEAL_HISTORY（沪股通/深股通每日净买入，市场级）
2. north_hold: RPT_MUTUAL_HOLD_DET 按 HOLD_DATE 拉取，按 code 聚合持股市值
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
    c.execute('CREATE TABLE IF NOT EXISTS north_deal (date TEXT, type TEXT, net_buy REAL, buy_amt REAL, sell_amt REAL, PRIMARY KEY(date, type))')
    c.execute('CREATE TABLE IF NOT EXISTS north_hold (date TEXT, code TEXT, name TEXT, hold_mcap REAL, ratio REAL, PRIMARY KEY(date, code))')
    c.commit()

    # 1. 市场级每日净买入（分页拉全历史）
    done_d = c.execute('SELECT COUNT(DISTINCT date) FROM north_deal').fetchone()[0]
    print(f'north_deal 已有 {done_d} 天', flush=True)
    if done_d == 0:
        page = 1
        while True:
            url = f'https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_MUTUAL_DEAL_HISTORY&columns=ALL&pageNumber={page}&pageSize=500&sortColumns=TRADE_DATE&sortTypes=1'
            try:
                d = http_get(url)
                data = (d.get('result') or {}).get('data') or []
                if not data:
                    break
                for row in data:
                    c.execute('INSERT OR IGNORE INTO north_deal VALUES (?,?,?,?,?)',
                              (row.get('TRADE_DATE', '')[:10], row.get('MUTUAL_TYPE'),
                               row.get('NET_DEAL_AMT'), row.get('BUY_AMT'), row.get('SELL_AMT')))
                c.commit()
                if page % 10 == 0:
                    print(f'north_deal 已拉 {page} 页', flush=True)
                page += 1
                time.sleep(0.4)
            except Exception as e:
                print(f'north_deal ERR p{page}: {str(e)[:60]}', flush=True)
                time.sleep(3)
        print('north_deal 完成', flush=True)

    # 2. 个股持股聚合（2021 至今按日）
    n = 0
    for ds in trade_days('2021-01-04', '2026-08-18'):
        if c.execute('SELECT 1 FROM north_hold WHERE date=? LIMIT 1', (ds,)).fetchone():
            continue
        agg = {}
        page = 1
        try:
            while True:
                url = f"https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_MUTUAL_HOLD_DET&columns=ALL&filter=(HOLD_DATE%3D%27{ds}%27)&pageNumber={page}&pageSize=5000"
                d = http_get(url)
                data = (d.get('result') or {}).get('data') or []
                pages = (d.get('result') or {}).get('pages') or 0
                for row in data:
                    code = row.get('SECURITY_CODE')
                    if not code:
                        continue
                    a = agg.setdefault(code, {'name': row.get('SECURITY_NAME_ABBR'), 'mcap': 0.0, 'ratio': row.get('HOLD_SHARES_RATIO')})
                    a['mcap'] += float(row.get('HOLD_MARKET_CAP') or 0)
                if page >= pages or not data:
                    break
                page += 1
                time.sleep(0.3)
            for code, a in agg.items():
                c.execute('INSERT OR IGNORE INTO north_hold VALUES (?,?,?,?,?)', (ds, code, a['name'], a['mcap'], a['ratio']))
            c.commit()
            n += 1
            if n % 50 == 0:
                print(f'north_hold 已补 {n} 天（到 {ds}）', flush=True)
        except Exception as e:
            print(f'north_hold ERR {ds}: {str(e)[:70]}', flush=True)
        time.sleep(0.5)
    print(f'north_hold 完成 {n} 天', flush=True)
    print('NORTH_DONE', flush=True)

if __name__ == '__main__':
    main()
