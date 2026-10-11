# -*- coding: utf-8 -*-
"""
麦麦少年 · 实盘存档回测 v1
========================================
对 forecast_history 里每天的 morning 预测存档，用真实K线验证：
次日开盘买入 → 持有 1/3/5 日收益、目标价触达、止损触发、涨停买不进。

输出：backend/mbm_verify_report.json + 控制台人话总结
用法：python mbm_verify_archive.py [--date 2026-08-12]
"""
import sys, os, json, time, sqlite3

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import predict_server as ps

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pred.db')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mbm_verify_report.json')


def _read_klines(secid):
    try:
        with sqlite3.connect(DB) as c:
            row = c.execute('SELECT data FROM klines WHERE secid=?', (secid,)).fetchone()
        if not row:
            return None
        return ps._kline_decode(row[0])
    except Exception:
        return None


def verify_item(item, kl, date_str, mode):
    """单只：date_str 之后第一根K线为次日 → 各标签"""
    if not kl:
        return {'code': item.get('code'), 'verified': False, 'reason': 'no_kline'}
    idx = None
    for i, k in enumerate(kl):
        if k['t'] > date_str:
            idx = i
            break
    if idx is None:
        return {'code': item.get('code'), 'verified': False, 'reason': 'future'}
    if idx >= len(kl):
        return {'code': item.get('code'), 'verified': False, 'reason': 'future'}
    k1 = kl[idx]
    b0 = k1['o']
    limit = 0.20 if item.get('board') in ('创业板', '科创板') else (0.30 if item.get('board') == '北交所' else 0.10)
    open_chg = b0 / kl[idx - 1]['c'] - 1 if idx >= 1 else 0
    r = {'code': item.get('code'), 'name': item.get('name'), 'score': item.get('score'),
         'sigs': item.get('sigs'), 'verified': True, 'date': date_str, 'mode': mode,
         'entry': item.get('entry'), 'stop': item.get('stop'), 'target': item.get('target'),
         'untradable': 1 if open_chg >= limit - 0.002 else 0}
    if b0 > 0:
        r['ret1'] = round((kl[idx]['c'] / b0 - 1) * 100, 2)
        if idx + 2 < len(kl):
            r['ret3'] = round((kl[idx + 2]['c'] / b0 - 1) * 100, 2)
        if idx + 4 < len(kl):
            r['ret5'] = round((kl[idx + 4]['c'] / b0 - 1) * 100, 2)
        r['up1'] = 1 if r.get('ret1', 0) > 0 else 0
        r['up3'] = 1 if r.get('ret3', 0) > 0 else 0
    if idx + 4 < len(kl):
        hi5 = max(kl[j]['h'] for j in range(idx, idx + 5))
        lo5 = min(kl[j]['l'] for j in range(idx, idx + 5))
        if r.get('target'):
            r['hit_target_5d'] = 1 if hi5 >= r['target'] else 0
        if r.get('stop'):
            r['hit_stop_5d'] = 1 if lo5 <= r['stop'] else 0
    return r


def main():
    only_date = None
    if len(sys.argv) > 2 and sys.argv[1] == '--date':
        only_date = sys.argv[2]
    with sqlite3.connect(DB) as c:
        rows = c.execute("SELECT date, data FROM forecast_history WHERE type='morning' ORDER BY date").fetchall()

    report = {'generated': time.strftime('%Y-%m-%d %H:%M:%S'), 'days': [], 'total': {}}
    all_up1 = []; all_up3 = []; all_ret1 = []; all_ret3 = []
    by_sig = {}; by_score = {'hi': [], 'lo': []}
    untradable_total = 0

    for date_str, raw in rows:
        if only_date and date_str != only_date:
            continue
        data = json.loads(raw)
        items = data.get('items', [])
        mode = data.get('mode', '?')
        results = [verify_item(it, _read_klines(it.get('secid') or ('1.' + it['code'] if it['code'].startswith('6') else '0.' + it['code'])), date_str, mode)
                   for it in items]
        v = [r for r in results if r.get('verified')]
        day = {'date': date_str, 'mode': mode, 'total': len(items), 'verified': len(v),
               'untradable': sum(1 for r in v if r.get('untradable'))}
        if v:
            day['up1_rate'] = round(sum(r.get('up1', 0) for r in v) / len(v) * 100, 1)
            day['up3_rate'] = round(sum(r.get('up3', 0) for r in v) / len(v) * 100, 1)
            rs1 = [r['ret1'] for r in v if r.get('ret1') is not None]
            rs3 = [r['ret3'] for r in v if r.get('ret3') is not None]
            day['avg_ret1'] = round(sum(rs1) / len(rs1), 2) if rs1 else None
            day['avg_ret3'] = round(sum(rs3) / len(rs3), 2) if rs3 else None
            day['hit_target'] = round(sum(r.get('hit_target_5d', 0) for r in v) / len(v) * 100, 1)
            day['hit_stop'] = round(sum(r.get('hit_stop_5d', 0) for r in v) / len(v) * 100, 1)
            all_up1 += [r.get('up1', 0) for r in v]
            all_up3 += [r.get('up3', 0) for r in v]
            all_ret1 += rs1; all_ret3 += rs3
            untradable_total += day['untradable']
            for r in v:
                sc = r.get('score') or 0
                (by_score['hi'] if sc >= 6 else by_score['lo']).append(r)
                for s in (r.get('sigs') or []):
                    by_sig.setdefault(s, []).append(r)
        report['days'].append(day)
        print(f"[ARCH] {date_str} mode={mode} 入选{len(items)} 已验证{len(v)} 命中率(1日){day.get('up1_rate','-')}% "
              f"(3日){day.get('up3_rate','-')}% 平均收益(1日){day.get('avg_ret1','-')}% (3日){day.get('avg_ret3','-')}% "
              f"目标达{day.get('hit_target','-')}% 止损触{day.get('hit_stop','-')}% 买不进{day.get('untradable')}")

    n1 = len(all_up1); n3 = len(all_up3)
    report['total'] = {
        'verified_total': n1,
        'up1_rate': round(sum(all_up1) / n1 * 100, 1) if n1 else None,
        'up3_rate': round(sum(all_up3) / n3 * 100, 1) if n3 else None,
        'avg_ret1': round(sum(all_ret1) / len(all_ret1), 2) if all_ret1 else None,
        'avg_ret3': round(sum(all_ret3) / len(all_ret3), 2) if all_ret3 else None,
        'untradable_total': untradable_total,
    }
    for k, arr in by_score.items():
        if arr:
            n = len(arr)
            report['total'][f'score_{k}'] = {'n': n,
                'up1_rate': round(sum(r.get('up1', 0) for r in arr) / n * 100, 1),
                'up3_rate': round(sum(r.get('up3', 0) for r in arr) / n * 100, 1)}
    sig_stat = {}
    for s, arr in by_sig.items():
        n = len(arr)
        sig_stat[s] = {'n': n,
                       'up1_rate': round(sum(r.get('up1', 0) for r in arr) / n * 100, 1),
                       'up3_rate': round(sum(r.get('up3', 0) for r in arr) / n * 100, 1),
                       'avg_ret1': round(sum(r.get('ret1') or 0 for r in arr) / n, 2),
                       'avg_ret3': round(sum(r.get('ret3') or 0 for r in arr) / n, 2)}
    report['by_sig'] = sig_stat
    report['by_score'] = {k: {'n': len(v), 'up1_rate': round(sum(r.get('up1', 0) for r in v) / len(v) * 100, 1) if v else None}
                          for k, v in by_score.items()}

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    print()
    t = report['total']
    print(f"[ARCH] 汇总: 已验证 {t.get('verified_total')} 条 | 次日命中率 {t.get('up1_rate')}% | 3日命中率 {t.get('up3_rate')}% | "
          f"平均收益(1日) {t.get('avg_ret1')}% (3日) {t.get('avg_ret3')}% | 买不进 {t.get('untradable_total')}")
    if 'score_hi' in t:
        print(f"[ARCH] 高分(≥6): {t['score_hi']}")
    if 'score_lo' in t:
        print(f"[ARCH] 低分(<6): {t['score_lo']}")
    print(f"[ARCH] 报告已存: {OUT}")


if __name__ == '__main__':
    main()
