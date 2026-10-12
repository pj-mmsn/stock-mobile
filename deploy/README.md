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
│   ├── refresh_kline.py             ★K线增量刷新（cron 主力；含补导/熔断/异常计数）
│   ├── fill_stale.py                ★只补落后的（腾讯限流时的高效补刷，2026-10-12 新增）
│   ├── scan_kline_freshness.py      ★K线新鲜度全量扫描（不抽样，判"合法零/故障零"）
│   ├── verify_reviews_e2e.py        ★两个盘后验证函数的端到端验证（副本库+伪装日期）
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

### 3.1 K线停摆 6 周的真凶（漏导入 `kline_get`）

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

### 3.2 腾讯 ifzq 的 501 域名级封禁

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

### 3.3 env 未自举 —— 线上读到旧缓存的元凶

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

### 3.4 东财 clist 全域名 502

见「事故链」与「已实施的修复」表 —— `quick_scan()` 的候选池单点依赖已换为腾讯 gtimg 主源。

### 3.5 `all` 被 `hot` 饿死 —— 全市场 K 线**从未真正日刷**

这是第三个「数据静默不更新」缺陷，而且**修完前两个才暴露出来**。

**怎么发现的**：修完 L1a/L2 后，10-12 当晚复查 K 线覆盖率，发现仍有 **61.9% 停在上一交易日(10-09)**，
只有 32.7% 拿到今日 bar。而 `refresh_kline.log` 里**全部 72 条 `INCR_DONE` 都是旧格式**
（没有 `stale_fail` 字段）→ 说明这个日志当天**一次新代码都没跑到**。

**根因：两个任务互相饿死**

| 任务 | 池子 | 触发 | 单次耗时 | 结果 |
|---|---|---|---|---|
| `hot` | 三档预测池去重 **1874 只** | 每 10 分钟 | **46 分钟**（`elapsed=2778s`） | 几乎不间断持有 flock |
| `all` | 全市场 **5507 只** | 11:00 / 15:05 | — | **永远「另一个增量进程在跑，跳过本次」直接退出** |

`hot` 耗时（46 分钟）远大于触发间隔（10 分钟）→ flock 被连续持有 → `all` 被永久饿死。
**全市场 K 线从未被日刷过**，只有预测池那一小块是新的。

顺带发现 `hot` 自身也不健康：`ok=29/1874 stale_fail=111` —— 腾讯 501 反复触发、
降级源（同花顺/新浪）慢到 1.4s/只，一小时根本刷不完 1874 只。

**修复（三处）**

1. **裁掉 hot 池**：每档只取预测池头部 350 只 → 去重后 **1874 → 515 只**，
   单次耗时从 46 分钟降到约 3-4 分钟，不再长时间霸占锁
2. **hot 加时间预算**：单次上限 1200s，超时打印 `BUDGET_HIT` 并优雅退出、让出锁
3. **hot 让路窗口**：工作日 **15:45-17:30** 为 `all` 独占窗口，`hot` 主动跳过；
   crontab 同步把全量刷从 15:05 移到 **15:50**（收盘后、热股窗口之外）

**验证**

```
hot 让路逻辑 7 个边界用例（15:44 / 15:45 / 16:30 / 17:29 / 17:30 / 盘中 / 周末）→ 全部通过 ✅
all  实跑：[all] 20 只增量 → INCR_DONE mode=all ok=0/20 errors=0 stale_fail=0
hot  实跑：[hot] 预测池头部每档 350 只 → 去重后 515 只 → INCR_DONE ok=3/15
```

> 📌 **教训**：多个定时任务共用一个锁时，**必须保证每个任务单次耗时 << 触发间隔**，
> 否则耗时长的那个会把其他任务全部饿死。而"被跳过"的日志（`跳过本次`）
> 是一种**极易被忽略的失败**——它看起来像正常保护，实际是任务从未执行。
> **判断依据不能是"日志里有没有报错"，而是"任务有没有真的跑完一次"。**

### 3.6 补刷脚本的「最新交易日」基准判定错误

修完 L1b 后用 `fill_stale.py` 补全市场，输出却是：

```
判定最新交易日 = 2026-10-09（3407 只，占 61.9%）
落后待补 = 299 只          ← 实际有约 3700 只停在 10-09
  100/299  ok=2 noadv=98   ← 处理了却几乎不前进
```

**根因**：脚本用「**众数**」判定最新交易日：

```python
LATEST = max(cnt, key=lambda d: (cnt[d], d))   # 取出现次数最多的日期
```

当晚 `hot` 只刷新了预测池（1802 只），其余 3399 只仍是 10-09 ——
于是 **10-09 成了众数**，脚本把 10-09 当成"最新交易日"，
判定几乎所有股票"已最新" → 只补了 299 只。

**修复**：改用「**观测到的最大日期**」，并加合理性上限（不得晚于今天）：

```python
_today = datetime.now(_CST).strftime('%Y-%m-%d')
_recent = [d for d in cnt if d <= _today]
LATEST = max(_recent) if _recent else ''
```

修复后：`判定最新交易日 = 2026-10-12（1812 只，占 32.9%）`，`落后待补 = 3696 只` ✅

> 📌 **教训（第三次同类）**：L1a（漏导入）、L1b（锁饿死）、L3（基准错）表面症状
> 都是"数据没更新"，而根因都在**判定逻辑自身**：判"是否更新成功"的函数写错了、
> 判"该不该跳过"的锁写错了、判"什么算最新"的基准写错了。
> **结论：监控/判定代码的优先级应与业务代码等同 —— 它错了，再好的业务代码也会被静默掩盖。**

### 3.7 关于"合法的零"与"故障的零"（本次最贵的教训）
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

### 3.7.1 修复后实测数据

| 项 | 修复前 | 修复后 |
|---|---|---|
| `quick_scan` 候选池 | **0 只** | **1985 只**（扫描 5505 只） |
| 腾讯字段口径校验 | — | `f[32]`=涨跌幅 / `f[39]`=PE / `f[43]`=PB / `f[49]`=量比 / `f[58]`=ROE，与东财 f3/f115/f23 交叉验证通过 |
| **K线末根=最新交易日(2026-10-09)** | **14%** | **94.6%**（5208/5507，其余为停牌/退市僵尸股） |
| `prediction_swing` | 2026-09-02 / 1192 只 | **2026-10-12 04:34 / 1677 只** |
| `prediction_short` | 2026-09-22 / 27 只 | **2026-10-12 04:43 / 1723 只** |
| `prediction_long` | 2026-08-31 / 2120 只 | **2026-10-12 04:55 / 1874 只** |
| 根分区可用空间 | 3.5GB（91%） | **8.6GB（78%）** |
| 服务器可用内存 | 474MB（swap 8.3GB） | **970MB（swap 0.4GB）** |
| cron 僵尸进程 | 61 个 | **0 个** |
| 每晚数据库备份 | 53KB 空壳（等于没有） | **535MB 压缩快照 + 7 天滚动** |

### 3.8 备份改压缩存储（磁盘长线解法）

第一版修复把备份改成 SQLite 在线备份，写入**未压缩**的 2.5GB 副本 —— 保持 4 天就要 10GB，
在一个 40GB 的盘上不可持续（实测一度把分区顶到 90%）。

库内大量是 JSON 文本，**gzip 压缩率极高**：

```
原始 2529.2 MB  →  压缩 535.0 MB（21%）  耗时 76s
解压校验：PRAGMA quick_check = ok，forecast_history=191，klines=5507  ✅
```

改为压缩存储后，保留窗口从 4 天延长到 **7 天**，占用反而从 ~10GB 降到 **~3.7GB**。
crontab 同步改为 `backup_db.py 7`。

> 顺带清掉了我诊断时留在 `/tmp` 的 2.5GB 库副本 —— 磁盘从 90% 回到 78%。
> **教训：诊断用的库副本用完必须立刻删，2.5GB × 几次就把 40GB 盘顶满了。**


### 3.9 K线补刷执行记录（可复现）

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

### 3.10 盘后验证停摆 3 周：多个缺陷叠加

`forecast_history` 的 `evening` 与 `mbm_review` 都停在 2026-09-23。这是**两个不同的缺陷**：

**缺陷 A：`run_evening_review` 取数对象错位（主因）**

```python
# 原实现（错）
yesterday = (today - timedelta(days=1)).strftime('%Y-%m-%d')
morning, _ = forecast_load(yesterday, 'morning')
```

morning 存档是以**当天日期**为键存的（`date_str = now_cst()`，19:30 生成 →
`forecast_save(date_str, 'morning', ...)`）。取 `today - 1` 就**永远错开一天**，
19:45 的定时任务每次都落到空处，只打印「无有效昨日预测可对照」后 `return`。

**缺陷 B：回退候选来源是个不存在的仓库**

原回退只从 `_gh_repo_list('forecast')` 取候选，而 `github.com/pj-mmsn/stock-mobile-data`
**返回 404（不存在）** → 候选里只剩当天一个日期 → 非当日运行时必然找不到对象。
改为优先直接查库：`SELECT date FROM forecast_history WHERE type='morning'`。

**缺陷 C：`mbm_evening_review` 的 T+1 校验被陈旧 K 线拖死**

它要求「预测日当天起至少 2 根 K 线」才能算 T+1 收益。K 线 6 周停在 8-28 →
任何预测日都凑不出 2 根 → 永远「无可验证标的」。**K 线补齐后自动恢复**（已验证出数）。

**端到端验证方式（不碰生产库，见 `scripts/verify_reviews_e2e.py`）**：

```python
# 1) SQLite 在线备份 API 把生产库复制到 /tmp
src = sqlite3.connect('file:/var/lib/stock-mobile/pred.db?mode=ro', uri=True)
dst = sqlite3.connect('/tmp/pred_review_test.db')
with dst: src.backup(dst)
# 2) 让模块用副本库
os.environ['PRED_DB'] = '/tmp/pred_review_test.db'
import predict_server as ps
# 3) 伪装"今天"，真实调用函数
ps.now_cst = lambda: datetime(2026, 9, 24, 20, 25, tzinfo=...)
ps.run_evening_review(); ps.mbm_evening_review()
# 4) 复核生产库未被触碰
```

结果：

| 函数 | 修复前 | 修复后 |
|---|---|---|
| `run_evening_review()` | 无有效预测可对照（静默 return） | `2026-09-22 盘后总结: 命中率77.8% 平均2.58%`（27/27，副本库+伪装日期） |
| `mbm_evening_review()` | 输出空 / winrate 全 null | `2026-09-23 验证: 命中率24% 平均-1.37% (n=98)`（副本库） |

### 3.10.1 最终确认：当晚正常 cron 自动跑通（最强证据）

```
2026-10-12 19:45  run_evening_review  → evening
                 2026-10-12  命中率 31.9%  平均 -0.66%  覆盖 1901 只
2026-10-12 20:20  mbm_evening_review  → mbm_review
                 2026-10-09  命中率 72%    平均 +1.84%  覆盖 36 只
```

两个函数都在**自然调度下自行恢复**，无需人工补跑。`forecast_history` 的
`evening` 从 09-23 推进到 10-12，`mbm_review` 从 09-23 推进到 10-09（T+1 口径下最近可验证日）。

> ⚠️ **旧存档严重失真**：修复前 evening 的**全部 15 条**历史记录（2026-08-21 ~ 09-18）
> **清一色「命中率 100.0%」**（平均涨幅 3.78%~8.05%）。这是「只取涨幅榜前 500 只」
> 口径的必然产物 —— 榜单外标的一律查不到 → 不计入 → 分母只剩涨得好的。
> 修复后第一条真实记录是 **31.9%**。**看到持续 100% 的验证结果，要先怀疑口径，而不是庆祝模型准。**

> ⚠️ **操作纪律**：盘后总结必须在**当日收盘后**运行。本人在 10-12 凌晨 05:01 手跑过一次，
> 当时当日尚未开盘，代码取到的"当日实际涨跌"其实是上一交易日行情 → 算出 77.7% 的**假验证**。
> 该记录随后被 19:45 的正常 cron 覆盖，生产库最终无污染。
> **教训：验证类任务要同时校验"数据日期 == 目标日期"，不能只看函数返回了非空结果。**


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

---

## 七、2026-10-13 有效性优化（建立"可测量"闭环）

### 为什么要做

修完"数据静默不更新"后发现一个更根本的问题：**没有度量就无法优化**。
盘后验证只记绝对涨跌、没有基准 —— "命中率 31.9%" 到底好不好，无从判断。

### 关键结论（一句话）

> **主预测确实有正超额，但绝对收益取决于市场环境。**
> 10-12：策略均值 −0.66% vs 全市场均值 −1.31% → **超额 +0.65%（命中率超额 +7.9pt）**；
> 模拟账户 30 天：策略 −0.81% vs 基准 −1.91% → **超额 +1.1%**，但盈亏比 0.62 < 1（执行层仍亏）。
> 所以它的价值在**相对选择**，不在**择时** —— 环境差时必须靠仓位控制，而不是满仓硬扛。

### 新增内容

| 项 | 说明 |
|---|---|
| `market_breadth(day, basis)` | 全市场宽度基准（`cc`=收盘/昨收，`oc`=收盘/今开，与麦唛口径对齐）。从 Redis K 线算，与预测同源 |
| `bench` / `alpha` / `quantiles` | 写进 evening 与 mbm_review 存档 |
| `/api/alpha-curve` | 累计超额曲线（纯 DB 读，0.04s） |
| `refresh_alpha_history()` | 预计算并写回，避免接口现场跑 36 秒的全市场扫描。cron 每日 20:40 |
| `signal_backtest()` | **无偏**信号回测（完整候选池 + K 线后续收益） |
| `rank_score` | 按实测有效性加权的排序分，`w=clamp(1+effect·n/(n+300), 0.1, 3.0)`；无数据时权重全为 1，**与原 score 等价** |
| `industry` | 全市场行业（`sm:industry`，5640 只），与涨停池 `hybk` 同口径 |
| `tiers` | 预测分档：`top` 20 / `watch` 200 / 全量备查 |
| `/api/paper-trade` | 按 `entry`/`stop`/`target` 模拟执行，含止损开关对比与基准 |
| `/api/position-advice` | 建议仓位 |
| `/api/report` | **有效性看板**（自包含 HTML，不碰主前端包） |
| `morning_{mode}` | 分模式存档（原来三档互相覆盖，无法分模式评估） |

### 踩过的坑（按教训价值排序）

1. **旧 evening 记录有严重选择偏差**：实际涨跌只从「涨幅榜前 500」取，榜单外候选被丢弃 →
   留下的全是上涨股 → `winrate` 恒 100%。实测覆盖率仅 **6%**（84/1466）。
   直接拿它拟合权重 = 把"只涨的样本"当普遍规律。
   更危险的是它会让累计超额显示 **+121%**、并让仓位建议说出"策略很强 → 加仓"。
   → 修法：用 `coverage`（已核对/候选池）识别，< 50% 判定有偏，**排除出累计与仓位计算**。
2. **"请求成功"不等于"拿到数据"**：东财 datacenter 限流时返回 `success=false / "返回数据为空"`
   但**不抛异常** → 5508 次请求"命中 0 只、异常 0 只"，看起来像"这些股票都没行业"。
   → 修法：批量拉取（4 次请求 / 16977 行 / 17 秒），并显式检查 `success` 与空结果。
3. **同一份文件、同一类错误犯了两次**：`refresh_kline.py` 先后漏导入 `kline_get`、`cache_set`，
   两次都是 `except` 静默吞掉 → 表现为"永远不前进"。
   → 规则：凡本文件用到的 `predict_server` 符号，必须全部在 import 里列出，并做静态核对。
4. **耗时接口必须先想清楚在哪儿算**：`market_breadth` 一次 36 秒，
   放进 API 循环 20 天 = 十几分钟 → 必然超时。改为预计算写回、接口只读 DB。
5. **推翻自己的猜测要靠实验**：我一度判断"止损太紧导致 66% 被打掉，应该放宽"，
   做了止损开关对比后结论相反 —— 止损开 −0.81% vs 关 −1.77%，**止损是保护**。
6. **`Response` 没导入**：新页面会在运行时 500（语法检查查不出来）。
   → 规则：新增 Flask 返回值类型时，先确认 import 齐了。

### 行业数据源选型（实测记录）

| 方案 | 覆盖 | 耗时 | 结论 |
|---|---|---|---|
| 新浪 49 行业节点 | 全市场 50% / 涨停池 46% | 61 请求 / 36 秒 | ✗ 覆盖低且比东财粗一档（"传媒娱乐" vs "出版"/"影视院线"）|
| 东财按股票查 | —— | 5508 请求 | ✗ 被限流，间歇返回空且不报错 |
| 东财按板块 BOARD_CODE 反查 | 0 | —— | ✗ 该报表不支持 |
| **东财 `filter=(BOARD_TYPE="行业")` 全量分页** | **5640 只** | **4 请求 / 17 秒** | ✓ 取 `BOARD_LEVEL=2`，与涨停池 `hybk` 覆盖 46/46、同名 44/46 |

### 新增定时任务

```
05 08 * * 1-5   run_market_jobs.py industry     # 行业映射（4 请求 / 17 秒）
50 19 * * 1-5   run_morning_forecast swing+long # 三档补刷（限时 2400s）
40 20 * * 1-5   run_market_jobs.py alpha        # 超额历史补齐
```

### 看板

**https://mmsnpj.online/api/report** —— 建议仓位 / 累计超额曲线 / 信号有效性 / 模拟账户 / 数据健康。
独立页面，**不改主前端包**（主包 md5 `91c2ce15f1e6c7652e2bd00d9731cd78` 保持不变）。

