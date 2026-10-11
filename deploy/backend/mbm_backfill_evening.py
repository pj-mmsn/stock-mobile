# -*- coding: utf-8 -*-
"""
麦麦少年 · 补算历史盘后验证
========================================
对 forecast_history 里每天的 morning 预测，用真实K线算"次日开盘买入收益"，
按 evening 存档格式（items+actual_chg / winrate / avg_return / 高低分对比）写入
forecast_history(type='evening') —— 历史 tab 的命中率色块数据源。

用法：python mbm_backfill_evening.py [--date 2026-08-13]
"""
import sys, os, json, time, sqlite3

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import predict_server as ps
from mbm_verify_archive import _read_klines, verify_item

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pred.db')


def market_env_note(date_str):
    """当日市场环境近似：从 klines 统计全市场涨跌分布（该日有K线的票）"""
    try:
        with sqlite3.connect(DB) as c:
            rows = c.execute('SELECT data FROM klines LIMIT 400').fetchall()
        chgs = []
        for (raw,) in rows:
            kl = ps._kline_decode(raw)
            for i, k in enumerate(kl):
                if k['t'] == date_str and i >= 1 and kl[i - 1]['c'] > 0:
                    chgs.append(k['c'] / kl[i - 1]['c'] - 1)
                    break
        if not chgs:
            return ''
        up = sum(1 for x in chgs if x > 0) / len(chgs) * 100
        avg = sum(chgs) / len(chgs) * 100
        tag = '普涨' if up >= 60 else ('普跌' if up <= 40 else '分化')
        return f'当日市场：{tag}（{len(chgs)}只样本上涨占比{round(up,1)}%，平均{round(avg,2)}%）'
    except Exception:
        return ''


def backfill(only_date=None):
    with sqlite3.connect(DB) as c:
        rows = c.execute("SELECT date, data FROM forecast_history WHERE type='morning' ORDER BY date").fetchall()
    done = 0
    for date_str, raw in rows:
        if only_date and date_str != only_date:
            continue
        with sqlite3.connect(DB) as c:
            has = c.execute("SELECT 1 FROM forecast_history WHERE date=? AND type='evening'", (date_str,)).fetchone()
        if has:
            print(f'[BF] {date_str} evening 已存在，跳过')
            continue
        data = json.loads(raw)
        items = data.get('items', [])
        if not items:
            continue
        results = []
        for it in items:
            secid = it.get('secid') or ('1.' + it['code'] if str(it['code']).startswith('6') else '0.' + str(it['code']))
            r = verify_item(it, _read_klines(secid), date_str, data.get('mode', 'swing'))
            if r.get('verified'):
                results.append(r)
        if not results:
            print(f'[BF] {date_str} 无K线可验证（数据未刷新？）')
            continue
        total = len(results)
        up = sum(1 for r in results if (r.get('ret1') or 0) > 0)
        winrate = round(up / total * 100, 1)
        avg = round(sum(r.get('ret1') or 0 for r in results) / total, 2)
        hi = [r for r in results if (r.get('score') or 0) >= 6]
        lo = [r for r in results if (r.get('score') or 0) < 6]
        hi_wr = round(sum(1 for r in hi if (r.get('ret1') or 0) > 0) / len(hi) * 100, 1) if hi else None
        lo_wr = round(sum(1 for r in lo if (r.get('ret1') or 0) > 0) / len(lo) * 100, 1) if lo else None
        note = market_env_note(date_str)
        summary = (f'盘后验证：入选 {total} 只，次日红盘 {up} 只，命中率 {winrate}%（开盘买入口径）'
                   + (f'，高分(≥6分){hi_wr}% vs 低分{lo_wr}%' if hi_wr is not None and lo_wr is not None else '')
                   + ('。' + note if note else ''))
        reviewed = [{**r, 'actual_chg': r.get('ret1')} for r in results]
        ev = {'items': reviewed, 'winrate': winrate, 'avg_return': avg,
              'up_count': up, 'total': total, 'hi_winrate': hi_wr, 'lo_winrate': lo_wr,
              'summary': summary, 'created': time.strftime('%Y-%m-%dT%H:%M:%S')}
        ps.forecast_save(date_str, 'evening', ev)
        done += 1
        print(f'[BF] {date_str} 补算完成: 命中率{winrate}% 平均{avg}% 验证{total}只 | {note}')
    print(f'[BF] 全部完成，补算 {done} 天')


if __name__ == '__main__':
    only = None
    if len(sys.argv) > 2 and sys.argv[1] == '--date':
        only = sys.argv[2]
    backfill(only)
