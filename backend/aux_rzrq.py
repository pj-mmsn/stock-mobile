# -*- coding: utf-8 -*-
"""服务器端：融资融券历史（2020 至今按日全市场）+ 北向资金报告名重试 → /tmp/aux_data.db"""
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
    c.execute('CREATE TABLE IF NOT EXISTS rzrq_daily (date TEXT, code TEXT, name TEXT, rzye REAL, rqyl REAL, rzrqye REAL, rzmre REAL, rzyezb REAL, rzmre3d REAL, rzmre5d REAL, rzmre10d REAL, rzche REAL, PRIMARY KEY(date, code))')
    c.commit()
    done = c.execute('SELECT COUNT(DISTINCT date) FROM rzrq_daily').fetchone()[0]
    print(f'rzrq 已有 {done} 天', flush=True)

    n = 0
    for ds in trade_days('2020-01-02', '2026-08-18'):
        if c.execute('SELECT 1 FROM rzrq_daily WHERE date=? LIMIT 1', (ds,)).fetchone():
            continue
        try:
            url = f"https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPTA_WEB_RZRQ_GGMX&columns=ALL&filter=(DATE%3D%27{ds}%27)&pageNumber=1&pageSize=5000"
            d = http_get(url)
            data = (d.get('result') or {}).get('data') or []
            for row in data:
                c.execute('INSERT OR IGNORE INTO rzrq_daily VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
                          (ds, row.get('SCODE'), row.get('SECNAME'), row.get('RZYE'), row.get('RQYL'),
                           row.get('RZRQYE'), row.get('RZMRE'), row.get('RZYEZB'),
                           row.get('RZMRE3D'), row.get('RZMRE5D'), row.get('RZMRE10D'), row.get('RZCHE')))
            c.commit()
            n += 1
            if n % 50 == 0:
                print(f'rzrq 已补 {n} 天（到 {ds}）', flush=True)
        except Exception as e:
            print(f'rzrq ERR {ds}: {str(e)[:70]}', flush=True)
        time.sleep(0.5)
    print(f'rzrq 完成 {n} 天', flush=True)
    print('RZRQ_DONE', flush=True)

if __name__ == '__main__':
    main()
