# -*- coding: utf-8 -*-
"""基线统计：现有规则策略近 N 个交易日的命中率（用 mbm_samples 样本）
口径：与模型评估一致——T+1 合规标签（short→ret2_open / swing→ret3_open / long→ret5_open）
入选规则：score_k >= 阈值（默认 3，与实盘预测入选口径对齐：score>0 全列但高分更有意义）
输出：整体胜率 / 平均收益 / 每日胜率序列（60 天 walk-forward 对照用）"""
import sqlite3, json, sys, argparse
from collections import defaultdict

DB = r'E:\AI项目\stock-mobile\backend\pred.db'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mode', default='swing', choices=['short', 'swing', 'long'])
    ap.add_argument('--days', type=int, default=60, help='取最近 N 个交易日')
    ap.add_argument('--min-score', type=float, default=3.0, help='规则入选分数阈值')
    ap.add_argument('--label', default=None, help='标签字段（默认按 mode 映射）')
    args = ap.parse_args()

    label = args.label or {'short': 'ret2_open', 'swing': 'ret3_open', 'long': 'ret5_open'}[args.mode]

    c = sqlite3.connect(DB)
    rows = c.execute(
        "SELECT date, code, feats, labels FROM mbm_samples WHERE mode=? AND date >= '2026-01-01'",
        (args.mode,)).fetchall()
    c.close()
    print(f'[BASE] mode={args.mode} label={label} min_score={args.min_score} 样本区间样本数={len(rows)}')

    # 按日聚合（只统计有标签的样本）
    daily = defaultdict(lambda: {'n': 0, 'win': 0, 'ret': 0.0})
    all_n = all_win = 0
    all_ret = 0.0
    for date, code, feats_s, labels_s in rows:
        try:
            f = json.loads(feats_s)
            lab = json.loads(labels_s)
        except Exception:
            continue
        if lab.get('untradable'):
            continue
        if lab.get('gap_suspend'):
            continue
        ret = lab.get(label)
        if ret is None:
            continue
        score = f.get('score_k', 0) or 0
        if score < args.min_score:
            continue
        daily[date]['n'] += 1
        daily[date]['win'] += 1 if ret > 0 else 0
        daily[date]['ret'] += ret
        all_n += 1
        all_win += 1 if ret > 0 else 0
        all_ret += ret

    # 取最近 N 个交易日（按日期倒序）
    dates = sorted(daily.keys(), reverse=True)[:args.days]
    if not dates:
        print('[BASE] 无样本！')
        return
    total_n = total_win = 0
    total_ret = 0.0
    print(f'\n[BASE] 最近 {len(dates)} 个交易日逐日明细：')
    print(f'{"日期":<12}{"信号数":>6}{"胜率":>8}{"均收益":>9}')
    daily_seq = []
    for d in sorted(dates):
        dd = daily[d]
        wr = round(dd['win'] / dd['n'] * 100) if dd['n'] else 0
        ar = round(dd['ret'] / dd['n'], 2) if dd['n'] else 0
        daily_seq.append({'date': d, 'signals': dd['n'], 'winRate': wr, 'avgRet': ar})
        print(f'{d:<12}{dd["n"]:>6}{wr:>7}%{ar:>9}%')
        total_n += dd['n']; total_win += dd['win']; total_ret += dd['ret']

    wr_all = round(total_win / total_n * 100) if total_n else 0
    ar_all = round(total_ret / total_n, 2) if total_n else 0
    print(f'\n[BASE] 汇总（最近{len(dates)}个交易日，score>={args.min_score}）：')
    print(f'  信号总数: {total_n}')
    print(f'  胜率: {wr_all}%  ({total_win}/{total_n})')
    print(f'  平均收益: {ar_all}%')
    print(f'  每日序列: {json.dumps(daily_seq, ensure_ascii=False)}')

if __name__ == '__main__':
    main()
