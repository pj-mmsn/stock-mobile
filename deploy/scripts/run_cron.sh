#!/bin/bash
# 定时任务统一入口
# 2026-10-12 修复：加 timeout 兜底。
# 事故背景：`from predict_server import env_temperature` 在某些网络路径下永久阻塞
# （实测主线程卡在 pthread_join，等待非 daemon 工作线程），导致 crontab 的
# */5 任务每 5 分钟派生一个永不退出的 python 进程，8-31 起累积 61 个（进程+swap 双泄漏）。
# 用法：run_cron.sh "<python -c 代码>" [超时秒数，默认 1800]
set -a; source /etc/stock-mobile.env; set +a
cd /opt/stock-mobile/backend

CMD="$1"
LIMIT="${2:-1800}"

timeout --signal=TERM --kill-after=30 "$LIMIT" /opt/stock-mobile/venv/bin/python -c "$CMD"
RC=$?
if [ "$RC" -eq 124 ] || [ "$RC" -eq 137 ]; then
  echo "[run_cron] TIMEOUT(limit=${LIMIT}s rc=$RC) $(date '+%F %T') cmd=${CMD:0:90}" >> /opt/stock-mobile/run_cron_timeout.log
fi
exit $RC
