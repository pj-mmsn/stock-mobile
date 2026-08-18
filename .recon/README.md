# .recon 反推工作素材（2026-08-18）

8-17 事故后 v55 源码丢失，本目录是从 v55 构建产物（dist-pretty-v55.js）反推完整版的工作素材。**任务已完成**（正式前端 = 项目根目录 dist-pretty-v55.js），本目录仅留档，可整体打包备份后清空。

## 文件说明

| 文件 | 内容 |
|---|---|
| `dist-pretty-v55.js 展开参照` | 无此文件。源 = 项目根 dist-pretty-v55.js |
| `v55_setup.js` / `v55_setup.decoded.js` | v55 App setup 逻辑区（行 10940-12838）提取 + 中文解码 |
| `v55_render.js` / `*.decoded/beautified` | v55 App render 区（行 12839-12879）提取 + 解码美化 |
| `v55_render2.decoded.txt` | render 完整解码版（5823 行可读） |
| `v55_core_fns.js` | 反推出的纯函数引擎：Rs(指标)/zs(K线分析)/vl(PA-ICT)/Qf(估值)/n_(决策) |
| `v55_simtrade.decoded.js` | SimTrade 组件（v55 死代码，未使用，留档） |
| `block1_valuation.md` | 估值/决策/资金流完整反推文档（34.5KB） |
| `_pages/` | render 按页面拆分（股票/涨停/龙虎榜/持仓/资金/回测/预测/tabbar） |
| `_decls*.json` / `_consts*.json` | setup 声明/class 常量提取表 |
| `_tmp_*` / `_full_decoded.txt` | 中间产物，无长期价值 |

## 关键结论（反推过程的血泪教训）

1. **v55 产物就是完整代码**——dist-pretty-v55.js 是 prettier 展开的自包含 JS，直接能跑（含 Vue 运行时），根本不用翻译成 SFC。之前绕弯路翻译 SFC 才搞出恢复版半成品。
2. **v55 产物里的变量映射**：P=ref, Dt=computed, r=createElementVNode, b=createElementBlock, g=openBlock, J=Fragment, vt=renderList, E=createCommentVNode, v=toDisplayString, M=normalizeClass, K=createTextVNode, de/withDirectives+Ne=v-model
3. **API base = `We.value`**（不是恢复版的 proxyBase！v55 里 proxyBase 是死引用）
4. **中文转义是大写 hex**（\u6682 不是 \u6682），搜索要先解码
5. **App 是 `<script setup>` 编译产物**：setup 直接返回 render 闭包，新增状态 = 在 `return (d,o)=>` 前声明即可
