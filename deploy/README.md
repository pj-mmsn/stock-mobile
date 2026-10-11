# deploy/ —— 线上生产快照（唯一真相来源）

> 最后同步：**2026-10-12**（从服务器 `124.156.138.98` 直接拉取，非人工誊抄）
> 同步方式：见本文件末尾「同步方法」，任何人可复现

## 为什么要这个目录

2026-10-12 排查发现：本地工作区 `E:\AI项目\stock-mobile` 的代码**比线上落后约 6 周**：

| 部件 | 本地（同步前） | 线上（真实） |
|---|---|---|
| 前端 JS | `dist-pretty-v55.js` v260825-0591 | `assets/index-quant0619.js` v260828-0619 |
| Service Worker | v58 | **v118** |
| 后端 | `backend/predict_server.py` 4579 行（2026-08-18） | 4817 行（含 8-28 四个补丁） |

在这个落后副本上改任何东西，一上线就会覆盖掉线上迭代。**本目录 = 线上真实代码的只读镜像**，改代码前先看这里。

---

## 一、本目录内容

```
deploy/
├── frontend/                        线上 /var/www/stock-mobile/ 当前在用产物
│   ├── index.html                   ← 指向 index-quant0619.js
│   ├── index-quant0619.js           761,891 字节（含麦唛/量化/最后交易日缓存修复）
│   ├── index-quant0560.css          96,884 字节
│   ├── sw.js                        CACHE = 'stock-mobile-v118'
│   └── manifest.json
├── backend/                         /opt/stock-mobile/backend/
│   ├── predict_server.py            ★主服务（Flask + 预测引擎 + 麦唛打分）
│   ├── mbm_replay.py                全市场回放打分
│   ├── mbm_backfill_evening.py      盘后验证
│   ├── mbm_verify_archive.py        存档校验
│   ├── kline_refresh.py             K线保活/懒更新
│   └── stable_feats.json            麦唛稳定因子配置
├── scripts/                         /opt/stock-mobile/ 运维脚本
│   ├── run_cron.sh                  ★定时任务统一入口（2026-10-12 加超时兜底）
│   ├── backup_db.py                 ★pred.db 在线原子备份（2026-10-12 新增）
│   ├── refresh_kline.py             K线增量刷新（cron 主力）
│   ├── ths_refresh.py               同花顺批量兜底源
│   ├── sina_sparse_refresh.py       新浪零星补刷
│   ├── fill_kline.py / kline_refresh.py / refresh_kline_slow.py
│   ├── run_market_jobs.py           涨停池/龙虎榜/资金流采集
│   ├── run_refresh_quotes.py        行情快照
│   ├── run_rsi_all.py               RSI 全市场
│   └── selfcheck.py / collect_state.py / morning_rerun.py / preheat_kline.py
└── config/
    ├── crontab.txt                  线上 crontab 全文（23 条）
    ├── nginx-stock-mobile.conf      nginx 站点配置
    └── stock-mobile.env.template    环境变量名（值已打码）
```

---

## 二、服务器事实

| 项 | 值 |
|---|---|
| 主机 | `124.156.138.98`（腾讯云轻量·香港，Ubuntu） |
| SSH | `ssh -i ~/.ssh/id_ed25519 ubuntu@124.156.138.98` |
| 规格 | **2 核 / 2GB 内存 / 40GB 磁盘**（红线！见下） |
| 后端 | `/opt/stock-mobile/backend/predict_server.py` |
| venv | `/opt/stock-mobile/venv/bin/python` |
| 前端 | `/var/www/stock-mobile/`，域名 `https://mmsnpj.online`，nginx 反代 `127.0.0.1:8000` |
| 服务 | `systemctl status stock-mobile`（gunicorn -w 2 --timeout 300） |
| 主库 | `/var/lib/stock-mobile/pred.db`（2.5GB，SQLite WAL） |
| K线热存储 | **Redis** `sm:kline:{secid}`（gzip bytes，5500+ 只）—— 预测/接口均读 Redis，SQLite `klines` 表不是主数据源 |
| 环境变量 | `/etc/stock-mobile.env`：`PRED_DB` / `REDIS_URL` / `DEEPSEEK_API_KEY` / `FORECAST_KEY` |
| 备份 | `/opt/stock-mobile/backup/pred-YYYYMMDD.db`（2026-10-12 起为真实在线备份，保留 4 天） |

### 环境变量必须带（否则连到空库 /tmp/pred.db）
```bash
bash -c 'set -a; source /etc/stock-mobile.env; set +a; /opt/stock-mobile/venv/bin/python xxx.py'
```

---

## 三、2026-10-12 事故与修复记录

### 事故链（一条线）

```
① 东财 /api/qt/clist/get 在所有域名持续 502（push2delay / push2 / 分片域名全挂）
      但同域名 /api/qt/stock/get、/api/qt/ulist.np/get 正常 → 该接口被单独封禁
        ↓
② quick_scan() 依赖 clist 拉全市场 → 候选池 0 只
        ↓
③ run_morning_forecast() 空跑 → morning 存档止于 2026-09-22
   prediction_short/swing/long 缓存冻在 09-22 / 09-02 / 08-31
        ↓
④ run_evening_review() 找不到有效昨日预测 → 盘后验证止于 2026-09-23
   （且其原实现只取涨幅榜前 500 只，命中率口径本身有偏）
        ↓
⑤ 麦唛仍在跑，但基于陈旧 K 线；mbm_review 的 winrate/avg_return 全为 null
```

### 同时发现

| # | 问题 | 影响 |
|---|---|---|
| 1 | **Redis K线 85.8% 停在 2026-08-28** | 6 周无新数据。**真凶见下面 §3.1**（不是数据源、不是网络，是脚本漏了一个 import） |
| 2 | **61 个 cron 僵尸进程**（8-31 起累积） | `env_temperature` 挂死在 `pthread_join`，永不退出；进程+swap 双泄漏（清掉后 swap 8312MB→675MB） |
| 3 | **每晚备份备错文件** | crontab `cp /tmp/pred.db`（53KB 空壳），真库在 `/var/lib/stock-mobile/pred.db` → 连续一个月无有效备份 |
| 4 | gunicorn 内存泄漏 | 45 天涨到 787MB，10-09 被 OOM SIGKILL；重启后降到 296MB |
| 5 | 磁盘 85%→91% | `pred.db.bak-20260820` 2.5GB + `qlib_data_v2` 746MB + `csv_aux` 596MB |

### 已实施的修复（均先备份）

| 修复 | 文件 | 备份 |
|---|---|---|
| clist → **腾讯 gtimg 主源/兜底**（500只/请求 0.06s，实测稳定） | `backend/predict_server.py` | `.bak-clistfix-20261012-003050` |
| `run_evening_review` 改全市场取实际涨跌（K线末根→腾讯→clist 三级） | 同上 | 同上 |
| `run_cron.sh` 加 `timeout` 兜底（默认 1800s，env_temperature 300s） | `scripts/run_cron.sh` | `.bak-20261012-003144` |
| 备份改 `backup_db.py`（SQLite 在线备份 API，原子一致） | `scripts/backup_db.py` | 新增 |
| 清理 61 个僵尸进程 | — | PID 清单 `/opt/stock-mobile/backup/zombie-clean-20261012-002245/` |
| **补 `refresh_kline.py` 漏掉的 `kline_get` 导入 + 异常不再静默** | `scripts/refresh_kline.py` | `.bak-importfix-20261012-005708` |
| 磁盘清理：删 `pred.db.bak-20260820`(2.5GB 旧备份) + `qlib_data_v2`(746MB 可再生) | — | 91% → 83% |

### 3.1 K线停摆 6 周的真凶（最重要的一条）

**症状**：`refresh_kline.log` 连续 6 周 `INCR_DONE mode=all ok=0/5507`，每次都"正常跑满 32 分钟"。

**排查过程**（关键是不能只看日志，要看真相）：
1. 实测四个数据源 → 全部正常，都能返回到最新交易日
2. 独立复刻 `work()` 逻辑抽样 100 只 → **91% 成功** → 说明数据源和 `_kline_incremental` 都没问题
3. 那就只剩「脚本本身」有差异 → 给真实脚本注入调试输出跑一次 → 真相：

```
NameError: name 'kline_get' is not defined
  File "refresh_kline.py", line 62, in work
    old = kline_get(secid)
```

**根因（缺陷 #1）**：`refresh_kline.py` 的 `from predict_server import _kline_incremental, DB, cache_get`
**漏了 `kline_get`**，而 `work()` 调用了它 → 每只股票都抛 `NameError`。

**为什么隐藏了 6 周**：`work()` 的 `except Exception: return 0` 静默吞掉异常，
`ok=0` 与「今天没有新数据」**表现完全一样**，日志没有任何异常痕迹。

**修复**：①补导入 ②异常返回 -1 并计数 ③异常样本+traceback 落盘
`/opt/stock-mobile/refresh_kline_errors.log` ④进度行打印 `ok` 计数。

### 3.2 缺陷 #2：腾讯 ifzq 的 501 域名级封禁

修掉 import 后重跑，前两段成功（1192/1400、1338/1400），**第三段起又全零**。
实测发现腾讯 ifzq 对所有代码都返回 `HTTP 501`：

| 时段 | 累计请求 | 腾讯响应 | 结果 |
|---|---|---|---|
| SEG1 (0–1400) | ~1400 | 正常 | ok=1192 ✅ |
| SEG2 (1400–2800) | ~2800 | 正常 | ok=1338 ✅ |
| SEG3 (2800–4200) | ~4200 | **501 封禁** | ok=0 ❌ |
| SEG4+ | 封禁中 | 501 | ok=0 ❌ |

**结论**：腾讯 ifzq 连续批量约 1500–2800 只后触发域名级封锁，约 20–30 分钟恢复。
这也解释了 8-28 当天为何在跑到那里时停住。

**修复**：
- `_tx_quota_blocked/_tx_quota_trip`：命中 501 后暂停腾讯源 20 分钟
- `_kline_incremental` 的 `if not page: return cached` 改为**继续下沉到降级源**
  （原写法在主源被封时直接返回旧缓存，**降级源永远走不到**）
- 实测降级源可用性：同花顺 6/6、新浪 6/6、东财 0/6（东财 K 线接口已废）
- 卡在 08-28 的样本 6 只 → 全部前进到 2026-10-09

### 3.3 缺陷 #3：env 未自举 —— 线上读到旧缓存的元凶

**症状**：库里 `prediction_*` 已是 10-12 新数据，K线也补了，但线上 `/api/predict`
仍返回 `_ts=2026-09-02`，`/api/status` 的 `updated` 也停在 09-02。

**根因**：cron 用 `python -c "from predict_server import ..."` **直接 import 模块，
没有 source `/etc/stock-mobile.env`**，于是：

| 缺失变量 | 后果 |
|---|---|
| `REDIS_URL` | `_REDIS = None` → `cache_set()` 里 `if _REDIS is not None` **静默跳过 Redis 写**，只写 SQLite。而 `cache_get()` 是 **Redis 优先** → 永远读到 Redis 里的旧值 |
| `PRED_DB` | 连到 `/tmp/pred.db` 空库 → 写进去的预测**直接丢失** |

**修复**：`predict_server.py` 顶部（**必须在 `DB`/`_REDIS` 赋值之前**）加 `_bootstrap_env()`，
缺失的 `REDIS_URL/PRED_DB/DEEPSEEK_API_KEY` 直接从 `/etc/stock-mobile.env` 补齐；
并加 `_REDIS.ping()` 启动校验、`cache_set()` 写失败打印告警。

**验证**：`env -i python -c "from predict_server import _REDIS, DB"` →
`_REDIS 已连接 = True`，`DB = /var/lib/stock-mobile/pred.db` ✅

### 3.4 缺陷 #4：东财 clist 全域名 502

见 §3 开头与「已实施的修复」表 —— `quick_scan()` 的候选池单点依赖已换为腾讯 gtimg 主源。

### 3.5 关于"合法的零"与"故障的零"（本次最贵的教训）

补 K 线时，我先写了「连续 300 只零进展就熔断」——结果**误熔断**：
SEG1 那 1400 只本来就已是最新交易日，"零进展"完全正常。

于是把判据改成区分两种零：
- **合法的零**：缓存末根 == 已知最新交易日 → 无事可做
- **故障的零**：缓存末根 < 最新交易日，却没能更新 → 计入 `stale_fail` 并触发熔断

日志里现在同时输出 `ok` / `errors` / `stale_fail`，三者一起看才能判断管道是否健康。

> 📌 **教训（写进铁律）**：批量任务**必须输出"真更新计数"且该计数要被监控**。
> `ok=0` 这种"合法的零"必须能和"故障的零"区分开——做法是同时报 `errors`/`stale_fail`，
> 或在连续 N 次"该更新却没更新"时告警。只输出「任务完成」而不输出「更新了几条」的脚本，
> 就是在给下一次 6 周停摆铺路。

### 实测验证数据

| 项 | 修复前 | 修复后 |
|---|---|---|
| `quick_scan` 候选池 | **0 只** | **1985 只**（扫描 5505 只） |
| 腾讯字段口径校验 | — | `f[32]`=涨跌幅 / `f[39]`=PE / `f[43]`=PB / `f[49]`=量比 / `f[58]`=ROE，与东财 f3/f115/f23 交叉验证通过 |
| **K线末根=最新交易日(2026-10-09)** | **14%** | **94.6%**（5208/5507，其余为停牌/退市僵尸股） |
| `prediction_swing` | 2026-09-02 / 1192 只 | **2026-10-12 04:34 / 1677 只** |
| `prediction_short` | 2026-09-22 / 27 只 | **2026-10-12 04:43 / 1723 只** |
| `prediction_long` | 2026-08-31 / 2120 只 | **2026-10-12 04:55 / 1874 只** |
| 根分区可用空间 | 3.5GB（91%） | **6.6GB（83%）** |
| 服务器可用内存 | 474MB（swap 8.3GB） | **886MB（swap 0.5GB）** |
| cron 僵尸进程 | 61 个 | **0 个** |

### 3.6 K线补刷执行记录（可复现）

腾讯被 501 封禁时降级源很慢（每只 1–3s），若对 5507 只全量遍历需 ~2.3 小时。
最终采用「**只补落后的**」策略：

```
① 快扫全量分类（40s，纯 Redis 读）
   总键数 5507 → 判定最新交易日 2026-10-09（3269 只，59.4%）→ 落后待补 2238 只
② 只对 2238 只跑 _kline_incremental（走降级源）
   STALE_DONE ok=1950 noadv=288 err=0 / 2238   耗时 2441s（41 分钟）
③ 复核：末根=2026-10-09 → 5208 只（94.6%）
```

> `noadv=288` 是停牌/退市/长期无成交的僵尸股（末根日期停留在 2005/2006/2021/2022 年），
> 数据源本身就没有更新，属正常。

**结论：K线补刷这次真的生效了。**（此前 6 周每次 `ok=0`，数据一根没动。）

---

## 四、数据源现状（2026-10-12 实测）

| 源 | 端点 | 状态 | 用途 |
|---|---|---|---|
| **腾讯 gtimg** | `qt.gtimg.cn/q=` | ✅ 500只/0.06s（1000只→414） | **全市场行情主源** |
| 腾讯 ifzq | `ifzq.gtimg.cn/appstock/app/fqkline/get` | ✅ 800根/只 | **K线主源** |
| 新浪列表 | `money.finance.sina.com.cn/.../Market_Center.getHQNodeData` | ✅ 100只/页，共5572只 | 代码全集兜底 |
| 新浪K线 | — | ✅ 250根 | K线降级 |
| 同花顺 | `d.10jqka.com.cn` | ✅ 140根 | K线降级（批量可靠） |
| 东财 clist | `/api/qt/clist/get` | ❌ **全域名 502** | 已弃用 |
| 东财其他 | `/api/qt/stock/get`、`ulist.np/get` | ✅ | 指数行情 |
| 新浪快照 | `hq.sinajs.cn` | ❌ 403 | 已弃用 |

> ⚠️ 腾讯 K线有两种「假绿」：①静默冷却（HTTP200 + 旧末根 + 速度正常）②复权漂移分支漏写库。
> **数据更新一律以查库结果为准，不以 ok 计数为准。**

---

## 五、运维要点

### 前端产物直改流程（线上源码即产物，勿动本地 src/）
1. 改 `deploy/frontend/index-quantXXXX.js`（或在 `D:\hermes\上下文\quant-deploy-XXXX.js` 上改）
2. `node --check` 语法验证
3. `scp` 上传 → `sudo mv` 至 `/var/www/stock-mobile/assets/index-quant新版本.js`
4. `sudo sed -i 's/旧名/新名/' /var/www/stock-mobile/index.html`
5. **SW 版本号必须 bump**：`sudo sed -i 's/v118/v119/' /var/www/stock-mobile/sw.js`（不 bump 手机不会更新）
6. CDP 无头 Chrome 实测验证

### 长任务规范
- `nohup ... &` + 独立等待脚本判完成（`ps aux | grep XXX | wc -l == 0`，**不要用日志关键词**）
- 杀进程用**精确 PID**（禁 pkill）
- 重任务拆段跑（内存可控 + 可中止）；起任务前必须记录 PID 与中止方法
- 实测参考速率：K线串行 0.35s 间隔，1400 只 ≈ 8-16 分钟

### 数据健康自检
```bash
# K线新鲜度（末根分布，不抽样）
bash -c 'set -a; source /etc/stock-mobile.env; set +a; /opt/stock-mobile/venv/bin/python /tmp/sm_scan_klines.py'

# 预测缓存与存档时间
sqlite3 /var/lib/stock-mobile/pred.db \
  "SELECT key,datetime(updated,'unixepoch','+8 hours') FROM cache WHERE key LIKE 'prediction%';
   SELECT date,type,datetime(created,'unixepoch','+8 hours') FROM forecast_history ORDER BY date DESC LIMIT 10;"
```

---

## 六、同步方法（可复现）

```bash
# 1) 服务器打包
ssh -i ~/.ssh/id_ed25519 ubuntu@124.156.138.98 'bash /tmp/sm_collect_prod.sh'
scp -i ~/.ssh/id_ed25519 ubuntu@124.156.138.98:/tmp/sm_prod_sync.tar.gz .
# 2) 解包后按 deploy/ 结构归位（frontend / backend / scripts / config）
# 3) 更新本文件顶部的「最后同步」日期
```

> 注意：`predict_server.py` 在 2026-10-12 已打 clist 修复补丁，**本目录版本 = 线上最新**（含修复）。
> 若线上又改过，重新同步即可，不要手工编辑本目录文件后又忘记回传服务器。
