# -*- coding: utf-8 -*-
"""服务器端批量补数：涨停池历史 + 个股资金流历史 + 估值历史 → SQLite（低内存流式）
输出 /tmp/aux_data.db：zt_pool(date, code, name, ...) / fund_flow(code, data_json) / valuation(code, data_json)
"""
import urllib.request, json, sqlite3, time, sys, os

DB = '/tmp/aux_data.db'
UA = {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://data.eastmoney.com/'}

def http_get(url, ref='https://data.eastmoney.com/'):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': ref})
    return json.loads(urllib.request.urlopen(req, timeout=25).read().decode())

def main():
    c = sqlite3.connect(DB)
    c.execute('CREATE TABLE IF NOT EXISTS zt_pool (date TEXT, code TEXT, name TEXT, pct REAL, amount REAL, PRIMARY KEY(date, code))')
    c.execute('CREATE TABLE IF NOT EXISTS fund_flow (code TEXT PRIMARY KEY, data TEXT)')
    c.execute('CREATE TABLE IF NOT EXISTS valuation (code TEXT PRIMARY KEY, data TEXT)')
    c.commit()
    done = c.execute('SELECT COUNT(DISTINCT date) FROM zt_pool').fetchone()[0]
    print(f'zt_pool 已有 {done} 天', flush=True)

    # 1. 涨停池历史回补（2024-01-01 至今）
    import datetime
    d = datetime.date(2024, 1, 1)
    today = datetime.date.today()
    cnt = 0
    while d <= today:
        if d.weekday() < 5:
            ds = d.strftime('%Y%m%d')
            has = c.execute('SELECT 1 FROM zt_pool WHERE date=? LIMIT 1', (ds,)).fetchone()
            if not has:
                try:
                    url = f'https://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=500&sort=fbt:asc&date={ds}'
                    d2 = http_get(url, 'https://quote.eastmoney.com/')
                    pool = (d2.get('data') or {}).get('pool') or []
                    for p in pool:
                        c.execute('INSERT OR IGNORE INTO zt_pool VALUES (?,?,?,?,?)',
                                  (ds, p.get('c'), p.get('n'), p.get('zdp'), p.get('amount')))
                    c.commit()
                    cnt += 1
                    if cnt % 50 == 0:
                        print(f'涨停池已补 {cnt} 天（到 {ds}）', flush=True)
                except Exception as e:
                    print(f'zt ERR {ds}: {str(e)[:80]}', flush=True)
                time.sleep(0.25)
        d += datetime.timedelta(days=1)
    print(f'涨停池回补完成 {cnt} 天', flush=True)

    # 2. 个股资金流历史（全市场）
    codes = [r[0] for r in c.execute("SELECT DISTINCT secid FROM klines").fetchall()] if False else []
    # 直接从主库拿 secid 列表
    c2 = sqlite3.connect('/var/lib/stock-mobile/pred.db')
    secids = [r[0] for r in c2.execute('SELECT secid FROM klines').fetchall()]
    c2.close()
    done_f = c.execute('SELECT COUNT(*) FROM fund_flow').fetchone()[0]
    print(f'fund_flow 已有 {done_f}/{len(secids)}', flush=True)
    n = 0
    for sid in secids:
        if c.execute('SELECT 1 FROM fund_flow WHERE code=? LIMIT 1', (sid,)).fetchone():
            continue
        try:
            url = f'https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?lmt=0&klt=101&secid={sid}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65'
            d = http_get(url)
            kl = (d.get('data') or {}).get('klines') or []
            c.execute('INSERT INTO fund_flow VALUES (?,?)', (sid, json.dumps(kl)))
            n += 1
            if n % 100 == 0:
                c.commit()
                print(f'资金流已拉 {n} 只', flush=True)
        except Exception as e:
            print(f'ff ERR {sid}: {str(e)[:60]}', flush=True)
        time.sleep(0.15)
    c.commit()
    print(f'资金流完成 {n} 只', flush=True)
    print('AUX_DONE', flush=True)

if __name__ == '__main__':
    main()
