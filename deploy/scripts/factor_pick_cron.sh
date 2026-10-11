#!/bin/bash
# 19:50 因子直选 cron: 带 REDIS_URL 生成三档榜单存档(名字+涨跌幅)
set -a
source /etc/stock-mobile.env
set +a
for m in short swing long; do
  /opt/stock-mobile/venv/bin/python /var/lib/stock-mobile/scripts/factor_pick.py --mode "$m" --top 30 --save >> /var/lib/stock-mobile/logs/factor_pick_cron.log 2>&1
done
