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

## 八、2026-10-12 修复摘要（详见 `deploy/README.md`）

事故：东财 `clist` 接口全域名 502 → 预测候选池 0 只 → 明日预测/盘后验证停摆约 3 周；
K 线 85.8% 停在 8-28；61 个 cron 僵尸进程；每晚备份备错文件（一个月无有效备份）；gunicorn 内存泄漏被 OOM。

已修：clist → 腾讯 gtimg 主源/兜底（候选池 0→1985）；盘后验证改全市场取实际涨跌；
`run_cron.sh` 加超时兜底；备份改 SQLite 在线原子备份；清理 61 个僵尸进程；重启 gunicorn 释放内存。
