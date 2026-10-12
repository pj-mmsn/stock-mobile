# 手机看盘（stock-mobile）项目说明

> 最后更新：**2026-10-12**。本文档 = 项目唯一真相来源，与项目状态不一致时以本文档为准。
> ⚠️ 上一版（2026-08-18）描述的「正式前端 = dist-pretty-v55.js / SW v63」**已严重过期**，切勿再按旧版理解。

## 一、项目是什么

A 股手机看盘 PWA（Vue 3 + 腾讯/东财/同花顺多源行情 + 自建 Flask 预测引擎 + DeepSeek AI）。
线上地址：**https://mmsnpj.online**（腾讯云香港 Lighthouse，nginx + gunicorn）。

核心能力：
- 实时行情 / K线 / 分时 / 涨停池 / 炸板池 / 龙虎榜 / 资金流 / 持仓管理
- 三档模式预测（⚡超短 / 📈波段 / 🏦长线），每日 19:30/19:40 全市场扫描 + 19:45 盘后验证
- 实盘规则引擎（liveEngine：行为识别 / 异常雷达 / 买卖时机）
- 策略回测（策略对比 / 自定义因子 / CSV 导出）
- 🧠 麦唛少年 ICIR 因子模型（24 因子滚动 45 日 IC 加权，每日 20:05 打分 + 20:20 验证）
- 🤖 AI 分析（DeepSeek）：个股「AI 分析视角」/ 实盘 AI / 问问 AI / 持仓分析，走 `/api/llm` 后端代理

## 二、⭐ 版本线（2026-10-12 实测，与线上一致）

| 名称 | 文件 | 状态 |
|---|---|---|
| **正式前端（当前线上）** | `deploy/frontend/index-quant0619.js`（761,891 字节，ver-tag **v260828-0619**）+ `index-quant0560.css` | ✅ 线上运行中 |
| **Service Worker** | `deploy/frontend/sw.js` → `CACHE = 'stock-mobile-v118'` | ✅ 线上 v118 |
| **后端主服务（当前线上）** | `deploy/backend/predict_server.py`（5027 行，含 2026-10-12 clist 修复） | ✅ 线上运行中 |
| dist-pretty-v55.js | 仓库根目录（v260825-0591，762KB） | ⚠️ **落后线上 3 天**，仅留档参考 |
| dist-v55-backup/ | v55 原始构建产物（8-15，无麦唛） | 备份（回退用，勿动） |
| src/（legacy） | App.vue 118KB 恢复版 | ❌ 弃用（8-17 事故后反推的半成品，功能不全） |
| v55 源码 | 无 | ❌ 8-17 事故丢失，只有构建产物 |

**规则：改前端先看 `deploy/frontend/`（线上真实产物）**，不要在 `dist-pretty-v55.js` 上开发——它比线上旧 3 天。
**规则：改后端先看 `deploy/backend/predict_server.py`**——本地 `backend/predict_server.py` 比线上旧 6 周。

## 三、目录结构

```
stock-mobile/
├── deploy/                 ★线上生产快照（唯一真相来源，2026-10-12 起）
│   ├── frontend/           线上 /var/www/stock-mobile/ 当前在用产物
│   ├── backend/            /opt/stock-mobile/backend/ 生产代码
│   ├── scripts/            /opt/stock-mobile/ 运维脚本
│   ├── config/             crontab / nginx / env 变量名
│   └── README.md           服务器事实 + 事故记录 + 运维流程 + 数据源现状
├── backend/predict_server.py   本地旧版（比线上旧 6 周，勿直接部署）
├── dist-pretty-v55.js     旧版前端（比线上旧 3 天，仅留档）
├── dist-v55-backup/       v55 原始产物备份（回退用，勿动）
├── src/                   legacy 恢复版（弃用，仅留档）
├── public/                PWA 静态资源
├── .recon/                8-18 反推工作素材（留档）
├── AGENTS.md              部署铁律（改动前必读）
└── PROJECT.md             本文档
```

## 四、部署方式（改完前端必走）

1. 改 `deploy/frontend/index-quantXXXX.js`（版本号常量 `vYYMMDD-NNNN` 同步 bump）
2. `node --check` 语法验证
3. 本地起静态服务器 + 无头浏览器实测（截图给用户确认）
4. 用户确认后：
   - 新 JS 上传 `/var/www/stock-mobile/assets/index-quant新名.js`（**增量添加，旧文件永远保留**）
   - `sudo sed -i 's/旧名/新名/' index.html`
   - `sw.js` 的 CACHE 名 bump（v118→v119...）——**不 bump 手机不会更新**
   - 线上 CDP 无头 Chrome 再实测一轮
5. 回退：改 index.html 指回旧 JS（旧 assets 永远不删）

## 五、后端与数据

- 主库（服务器）：`/var/lib/stock-mobile/pred.db`（2.5GB，systemd env `PRED_DB`）
- **K 线主数据源 = Redis** `sm:kline:{secid}`（gzip bytes），SQLite `klines` 表**不是**主数据源
- `aux.db`（1.1GB）：麦唛打分的换手率分母（`valuation_daily.shares`），**不能删**
- 本地 `backend/pred.db`（2GB）= 训练/回放测试库，不入 git
- 服务器 cron：19:30 晨间预测批0 / 19:40 批1 / 19:45 盘后总结 / 20:05 麦唛打分 / 20:20 麦唛验证 / 3:30 备份
- 环境变量必须带：`bash -c 'set -a; source /etc/stock-mobile.env; set +a; /opt/stock-mobile/venv/bin/python xxx.py'`

## 六、备份位置

| 内容 | 位置 |
|---|---|
| db 每日备份 | 服务器 `/opt/stock-mobile/backup/pred-YYYYMMDD.db`（保留 4 天，**2026-10-12 起才真实有效**） |
| 8-18 四重备份 | `D:\hermes\backup\stock-mobile-完整版-20260818\` |
| 代码修改前备份 | 服务器同目录 `.bak-<用途>-<日期>` 约定 |
| git 仓库 | github.com/pj-mmsn/stock-mobile（默认分支 `gh-pages`；push 需 `-c http.proxy= -c https.proxy=`） |
| 交接文档 | `D:\hermes\上下文\STOCK_MOBILE_HANDOFF_<日期>.md` |

## 七、铁律（8-17 事故教训，完整版见 AGENTS.md）

- 禁裸 `rm -rf`；`cd` 后必 `pwd`；命令链用 `&&` 不用 `;`
- 线上旧 assets 永远保留（增量添加，禁删）
- 部署 = build/实测通过 → 推送 git → 才上服务器
- 部署后必无头浏览器实测 + 版本三重确认（页面 ver-tag / 服务器 JS 哈希 / SW 版本）
- 改动前 `git status` 查未提交改动；用户本机可能直接改代码，先备份
- 服务器 2核2G 红线：重任务拆段、限速、可中止
- **数据更新一律以查库结果为准**（腾讯 K 线有「静默冷却」假绿：HTTP200 + 旧末根 + 速度正常）

## 八、2026-10-12 修复摘要（完整版见 `deploy/README.md`）

### 处置结论
线上曾发生一次**复合故障**，表现是「明日预测与盘后验证停摆约 3 周、K线 6 周无更新」。
查明为**四个独立缺陷叠加**，逐个修掉，现已全部恢复。

### 四个缺陷（按重要性）

| # | 缺陷 | 后果 | 为什么难发现 |
|---|---|---|---|
| 1 | `refresh_kline.py` 漏导入 `kline_get` | 每只股票抛 NameError → K线补刷空转 6 周 | `work()` 的 `except: return 0` 吞掉异常，`ok=0` 与"今天没新数据"长得一模一样 |
| 2 | 腾讯 ifzq 连续批量后 **HTTP 501** 域名级封禁 | 补刷跑到第 3 段开始全灭 | 只当普通异常跳过，无熔断、无告警 |
| 3 | `predict_server.py` **env 未自举** | `python -c` 起的 cron 拿不到 `REDIS_URL`/`PRED_DB` → Redis 写被静默跳过、预测写进 `/tmp` 空库 | cache_get 是 Redis 优先，于是线上永远读到旧缓存，磁盘里其实是新数据 |
| 4 | 东财 `/api/qt/clist/get` **全域名 502** | 预测候选池 0 只 → 明日预测/盘后验证断流 | 单点依赖，无备用数据源 |

### 已实施修复

| 修复 | 位置 |
|---|---|
| 补 `kline_get` 导入 + 异常计数落盘 + 进度打印 ok | `deploy/scripts/refresh_kline.py` |
| 配额熔断（连续 300 只零进展即早退，不再空跑 32 分钟） | 同上 |
| clist → 腾讯 gtimg 主源/兜底（候选池 0 → 1985 只） | `deploy/backend/predict_server.py` |
| 盘后验证改全市场取实际涨跌（K线末根→腾讯→clist 三级） | 同上 |
| 腾讯 501 熔断 + 降级链（同花顺/新浪） | 同上 |
| **env 自举**（缺失即读 `/etc/stock-mobile.env`）+ `_REDIS.ping()` 启动校验 | 同上 |
| Redis 写失败不再静默（打印告警） | 同上 |
| `run_cron.sh` 加 `timeout` 兜底 | `deploy/scripts/run_cron.sh` |
| 备份改 SQLite 在线原子备份（原先备的是 53KB 空壳） | `deploy/scripts/backup_db.py` |

### 修复后实测

| 项 | 修复前 | 修复后 |
|---|---|---|
| `prediction_swing` | 2026-09-02 / 1192 只 | **2026-10-12 04:34 / 1677 只** |
| `prediction_short` | 2026-09-22 / 27 只 | **2026-10-12 04:43 / 1723 只** |
| `prediction_long` | 2026-08-31 / 2120 只 | **2026-10-12 04:55 / 1874 只** |
| 预测候选池（total） | 5500（含大量无 K 线股） | **5505（K 线全覆盖后）** |
| `forecast_history` morning | 2026-09-22 | **2026-10-12 04:55** |
| **K线末根=最新交易日** | **14%**（85.8% 停在 8-28） | **94.6%**（5208/5507；其余为停牌/退市僵尸股） |
| 服务器可用内存 | 474MB（swap 8.3GB） | **970MB（swap 0.4GB）** |
| 根分区可用 | 3.5GB（91%） | **8.6GB（78%）** |
| cron 僵尸进程 | 61 个 | **0 个** |
| 每晚数据库备份 | 53KB 空壳（等于没有） | **535MB 压缩快照 + 7 天滚动**（解压校验 `quick_check=ok`） |
| 盘后验证命中率口径 | 只取涨幅榜前 500 只 → **恒报 100%** | 全市场取实际涨跌（10-12 真实 cron 跑出 **31.9%**，1901/1901 覆盖） |
| `forecast_history` evening | 2026-09-23（静默无输出 3 周） | **2026-10-12 19:45 自动恢复** ✅ |
| `forecast_history` mbm_review | 2026-09-23（winrate 全 null） | **2026-10-09 记录 20:20 自动恢复**（命中率 72%，36 只）✅ |

### 盘后验证（`run_evening_review` / `mbm_evening_review`）根因与修复

这两个函数是**两个独立缺陷**，不是同一个问题：

**缺陷 A：`run_evening_review` 取数对象错位（停摆 3 周的主因）**
原实现取 `yesterday = today - 1` 的 morning 存档，但 morning 存档是以**当天日期**为键存的
（`date_str = now_cst()`，19:30 生成 → `forecast_save(date_str, 'morning', ...)`）。
两者错开一天 → 19:45 的定时任务**永远找不到对象**，只打印「无有效昨日预测可对照」后 return。
正确语义：19:30 生成「明日预测」，19:45 用当日数据核对当日入选股表现 → 验证对象是**今天的**存档。

**缺陷 B：回退候选来源错误**
原回退只从 `_gh_repo_list('forecast')` 取候选，而该 GitHub 仓库**返回 404 不存在**
→ 候选里只有当天一个日期 → 非当日运行时必然找不到对象。改为优先直接查库。

**缺陷 C：`mbm_evening_review` 的 T+1 校验被陈旧 K 线拖死**
它要求「预测日当天起至少 2 根 K 线」才能算收益。K 线 6 周停在 8-28 →
任何预测日都凑不出 2 根 → 永远「无可验证标的」。K 线补齐后自动恢复。

**端到端验证方式（不碰生产库）**：用 SQLite 在线备份 API 把生产库复制到 `/tmp`，
让 `PRED_DB` 指向副本，再把 `now_cst()` 伪装为历史日期，**真实调用**两个函数：

| 函数 | 结果 |
|---|---|
| `run_evening_review()` | `2026-09-22 盘后总结: 命中率77.8% 平均2.58%`（覆盖 27/27） |
| `mbm_evening_review()` | `2026-09-23 验证: 命中率24% 平均-1.37% (n=98)` |
| 生产库复核 | evening / mbm_review 最新仍为 09-23，**未被触碰** ✅ |

**最终确认（2026-10-12 当晚正常 cron 自动跑通）**：

```
19:45  run_evening_review  → evening     2026-10-12  命中率 31.9%  平均 -0.66%  1901 只
20:20  mbm_evening_review  → mbm_review  2026-10-09  命中率 72%    平均 +1.84%  36 只
```

两个函数均已在**自然调度下自动恢复**，无需人工干预。

**旧存档严重失真**：修复前 evening 的全部 15 条历史记录（2026-08-21 ~ 09-18）
**清一色 `100.0%`** —— 这是「只取涨幅榜前 500 只」口径的必然产物
（榜单外标的一律查不到 → 不计入 → 分母只剩涨得好的）。
修复后第一条真实记录是 **31.9%**，口径终于正常。
**看到持续 100% 的验证结果，要先怀疑口径，而不是庆祝模型准。**

### 一条操作纪律（我这次踩的坑）

盘后总结（`run_evening_review`）**必须在当日收盘后运行**。我在凌晨 05:01 手跑过一次，
当时当日尚未开盘，代码拿到的"当日实际涨跌"其实是上一交易日的行情，
算出的 77.7% 是**假验证**（该记录随后已被 19:45 的正常 cron 覆盖，生产库最终无污染）。
**教训：验证类任务要同时校验"数据日期"是否等于"目标日期"，
不能只看函数是否返回了非空结果。**

### 新增铁律（本次教训）

1. **批量任务必须输出"真更新计数"且该计数要被监控**。`ok=0` 这种"合法的零"必须能与
   "故障的零"区分——同时报 `errors` 计数，或连续 N 次零进展即告警/熔断。
2. **`except Exception: return 0/pass` 是故障的温床**。吞异常必须至少落一条日志。
3. **缓存双写（Redis + SQLite）必须能发现不一致**。写入失败要告警，不能静默。
4. **`python -c "from xxx import ..."` 起的定时任务不会带 shell 环境变量**，
   模块必须自行自举 env，不能假定调用方 source 过。
5. **任何外部数据源都要有备用**，且备用路径要定期实测（不能只在主源挂了才发现备用也挂）。

