# backend 目录说明

## 正式服务

| 文件 | 作用 |
|---|---|
| `predict_server.py` | **主服务**（gunicorn 8000 端口）。全部 API 路由 + 预测引擎 + 麦唛打分。改这里最频繁，改前备份 `.bak-日期` |

## 定时任务（服务器 crontab 调用）

| 文件 | 调度 | 作用 |
|---|---|---|
| `refresh_kline.py` | 11:00/15:05 全量 + 盘中每10分钟 hot | K线刷新（腾讯源，注意 5min/5000 限流） |
| `kline_refresh.py` | 保活 | 懒更新补漏 |
| `kline_stale_fill.py` | 手动 | 缺K线补刷（BATCH≤25+批间60s） |
| `run_refresh_quotes.py` | 15:10/19:35 | 行情快照（写 Redis sm:quotes） |
| `run_market_jobs.py` | 盘中 | 涨停池/龙虎榜/资金流采集 |

## 麦唛模型（训练/回放/验证）

| 文件 | 作用 |
|---|---|
| `icir_model.py` / `icir_scorer.py` | ICIR 因子模型核心（24 因子滚动 45 日 IC 加权） |
| `train_mbm.py` | 训练入口 |
| `mbm_replay.py` | 全市场回放打分（mbm_samples 142 万行） |
| `mbm_backfill_evening.py` / `mbm_verify_archive.py` | 盘后验证/存档校验 |
| `baseline_stat.py` / `factor_ic_check.py` | 基线统计/因子 IC 检查 |
| `stable_feats.json` | 稳定因子配置 |
| `models/` | 模型权重/参数 |

## 数据

- `pred.db`（2GB）：本地训练/回放库，**不入 git**（.gitignore 已覆盖）
- 正式库在服务器 `/var/lib/stock-mobile/pred.db`（PRED_DB 环境变量）
- `pred.db-wal/-shm`：SQLite WAL 文件，勿手动删

## 注意

- cron 脚本必须设 `os.environ['PRED_DB']='/var/lib/stock-mobile/pred.db'`（否则写 /tmp 废库）
- 腾讯 K线域名总量风控：5min 5000+ 请求触发 HTTP 501，约 1h 恢复
- 数值字段取值禁用 `or` 兜底（`0.0 or x` 会吞合法 0），用显式 None 判断
