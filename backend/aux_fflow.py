# -*- coding: utf-8 -*-
"""服务器端：个股资金流历史抓取（限速 1s + 真实UA + 失败重试 + 断点续抓）"""
import urllib.request, json, sqlite3, time, random, os

DB = '/tmp/aux_data.db'
UA_LIST = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
]

def http_get(url, ref):
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': random.choice(UA_LIST),
                'Referer': ref,
                'Accept': 'application/json, text/plain, */*',
            })
            return json.loads(urllib.request.urlopen(req, timeout=25).read().decode())
        except Exception as e:
            if i == 2:
                raise
            time.sleep(2 + i * 3)

def main():
    c = sqlite3.connect(DB)
    c.execute('CREATE TABLE IF NOT EXISTS fund_flow (code TEXT PRIMARY KEY, data TEXT)')
    c.commit()
    c2 = sqlite3.connect('/var/lib/stock-mobile/pred.db')
    secids = [r[0] for r in c2.execute('SELECT secid FROM klines').fetchall()]
    c2.close()
    done = set(r[0] for r in c.execute('SELECT code FROM fund_flow').fetchall())
    todo = [s for s in secids if s not in done]
    print(f'待抓: {len(todo)} / {len(secids)}', flush=True)
    n = 0
    for sid in todo:
        try:
            url = f'https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?lmt=0&klt=101&secid={sid}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65'
            d = http_get(url, 'https://data.eastmoney.com/zjlx/detail.html')
            kl = (d.get('data') or {}).get('klines') or []
            if kl:
                c.execute('INSERT OR REPLACE INTO fund_flow VALUES (?,?)', (sid, json.dumps(kl)))
                n += 1
                if n % 100 == 0:
                    c.commit()
                    print(f'已拉 {n} 只', flush=True)
        except Exception as e:
            print(f'ERR {sid}: {str(e)[:60]}', flush=True)
        time.sleep(1.0 + random.random() * 0.5)
    c.commit()
    print(f'FFLOW_DONE 新增 {n}', flush=True)

if __name__ == '__main__':
    main()
