# -*- coding: utf-8 -*-
"""涨停池历史重补（快速，~3分钟）+ 资金流重试测试"""
import urllib.request, json, sqlite3, time, datetime

DB = '/tmp/aux_data.db'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0'

def http_get(url, ref):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer': ref})
    return json.loads(urllib.request.urlopen(req, timeout=25).read().decode())

c = sqlite3.connect(DB)
c.execute('CREATE TABLE IF NOT EXISTS zt_pool (date TEXT, code TEXT, name TEXT, pct REAL, amount REAL, PRIMARY KEY(date, code))')
c.commit()

d = datetime.date(2024, 1, 1)
today = datetime.date.today()
cnt = 0
while d <= today:
    if d.weekday() < 5:
        ds = d.strftime('%Y%m%d')
        if not c.execute('SELECT 1 FROM zt_pool WHERE date=? LIMIT 1', (ds,)).fetchone():
            try:
                url = f'https://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=500&sort=fbt:asc&date={ds}'
                d2 = http_get(url, 'https://quote.eastmoney.com/')
                pool = (d2.get('data') or {}).get('pool') or []
                for p in pool:
                    c.execute('INSERT OR IGNORE INTO zt_pool VALUES (?,?,?,?,?)',
                              (ds, p.get('c'), p.get('n'), p.get('zdp'), p.get('amount')))
                cnt += 1
            except Exception as e:
                print(f'ERR {ds}: {str(e)[:60]}', flush=True)
            time.sleep(0.2)
    d += datetime.timedelta(days=1)
    if cnt and cnt % 100 == 0:
        c.commit()
        print(f'涨停池已补 {cnt} 天（到 {ds}）', flush=True)
c.commit()
print(f'涨停池重补完成 {cnt} 天, 总 {c.execute("SELECT COUNT(DISTINCT date) FROM zt_pool").fetchone()[0]} 天', flush=True)

# 资金流重试测试
try:
    url = 'https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?lmt=0&klt=101&secid=1.600519&fields1=f1,f2,f3,f7&fields2=f51,f52'
    d3 = http_get(url, 'https://data.eastmoney.com/')
    kl = (d3.get('data') or {}).get('klines') or []
    print(f'资金流重试: {"OK " + str(len(kl)) + " 行" if kl else "空/仍被封"}', flush=True)
except Exception as e:
    print(f'资金流重试 ERR: {str(e)[:80]}', flush=True)
print('ZT_REDO_DONE', flush=True)
