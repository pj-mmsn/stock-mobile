# 手机看盘（stock-mobile）项目说明

> 最后更新：2026-08-18。本文档 = 项目唯一真相来源，与项目状态不一致时以本文档为准。

## 一、项目是什么

A 股手机看盘 PWA（Vue 3 + 腾讯行情 + 自建后端预测引擎）。线上地址：**https://mmsnpj.online**（腾讯云香港 Lighthouse，nginx + gunicorn）。

核心能力：
- 实时行情/K线/分时/涨停池/龙虎榜/持仓管理
- 三档模式预测（⚡超短/📈波段/🏦长线），每日 19:30 全市场扫描 + 盘后验证
- 实盘规则引擎（liveEngine：行为识别/异常雷达/买卖时机）
- 策略回测（策略对比/自定义因子/CSV导出）
- 🧠 麦唛 ICIR 因子模型（24 因子滚动 45 日加权，每日 20:05 打分 + 20:20 验证）

## 二、版本线（重要！）

| 名称 | 文件 | 状态 |
|---|---|---|
| **正式前端（当前线上）** | `dist-pretty-v55.js`（751KB，可读展开版）+ `dist-v55-backup/assets/index-Cb_LVycD.css` + mbm 样式 | ✅ v260818-2242 已上线，含麦唛专区 |
| v55 完整版构建产物 | `dist-v55-backup/`（index-Cugb3Eav.js 541KB + CSS + SW v55） | 备份（8-15 原始版本，无麦唛） |
| 恢复版源码（legacy） | `src/`（App.vue 118KB 恢复版，构建 361KB 简易版） | ⚠️ 弃用。8-17 事故后反推的半成品，功能不全，勿再基于它开发 |
| v55 源码 | 无 | ❌ 8-17 事故丢失，只有构建产物。`dist-pretty-v55.js` 是从产物 prettier 展开的可维护形态 |

**规则：新功能一律在 `dist-pretty-v55.js` 上改**（它是 prettier 展开的可读 JS，直接编辑+浏览器实测）。不要用 src/ 的恢复版开发，不要重新反推。

## 三、目录结构

```
stock-mobile/
├── dist-pretty-v55.js      ← 正式前端（编辑这个！750KB 可读 JS，自包含）
├── dist-v55-backup/        ← v55 原始构建产物备份（回退用，勿动）
├── src/                    ← legacy 恢复版（弃用，仅留档）
├── backend/                ← Python 后端（predict_server.py 主服务，详见 backend/README.md）
├── public/                 ← PWA 静态资源（sw.js/manifest/icons）
├── .recon/                 ← 8-18 反推工作素材（v55 产物拆分/解码，留档）
├── AGENTS.md               ← 部署铁律（改动前必读）
└── PROJECT.md              ← 本文档
```

## 四、部署方式（改完前端必走）

1. 改 `dist-pretty-v55.js`（版本号常量 `"v26XXXX-XXXX"` 同步 bump）
2. 本地起静态服务器 + 无头浏览器实测（截图给用户确认）
3. 用户确认后：
   - 新 JS 上传 `/var/www/stock-mobile/assets/index-*.js`（增量，旧文件保留）
   - `index.html` 指向新 JS；`sw.js` 的 CACHE 名 bump（v63→v64...）
   - 线上再实测一轮
4. 回退：改 index.html 指回旧 JS（旧 assets 永远不删）

## 五、后端与数据

- 主库（服务器）：`/var/lib/stock-mobile/pred.db`（systemd env PRED_DB）
- 本地 `backend/pred.db`（2GB）= 训练/回放测试库，勿提交 git（.gitignore 已覆盖）
- 服务器 cron：19:30 morning 预测批0/19:40 批1/19:45 盘后总结/20:05 麦唛打分/20:20 麦唛验证
- Redis = 数据库（永不过期，只覆盖更新）：sm:quotes 快照、sm:rsi 等

## 六、备份位置

| 内容 | 位置 |
|---|---|
| 8-18 四重备份 | `D:\hermes\backup\stock-mobile-完整版-20260818\`（含 dist-v55-backup + 当时源码） |
| pred.db 每日备份 | 服务器 `/opt/stock-mobile/backup/pred-YYYYMMDD.db`（4 天滚动） |
| git 仓库 | github.com/pj-mmsn/stock-mobile（main 分支；push 需 `-c http.proxy= -c https.proxy=`） |

## 七、铁律（8-17 事故教训，完整版见 AGENTS.md）

- 禁裸 rm -rf；cd 后必 pwd；命令链用 && 不用 ;
- 线上旧 assets 永远保留（增量添加，禁删）
- 部署 = build/实测通过 → 推送 git → 才上服务器
- 部署后必无头浏览器实测 + 版本三重确认
- 改动前 git status 查未提交改动；用户本机可能直接改代码，先备份
