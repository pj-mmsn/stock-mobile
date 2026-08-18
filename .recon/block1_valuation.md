# block1：估值面板 + 主力资金(含5日vs今日) + 一眼看懂 + 决策面板 —— v55 反推恢复片段

> 来源：`dist-pretty-v55.js`（render 偏移 17437 决策面板 / 18953 估值 / 21358 主力资金 / 21900 5日vs今日 / 22745 一眼看懂）+ `.recon/v55_setup.js`（setup 逻辑区）
> 样式：全部沿用 `src/style.css` 已有 class（`sec dp` / `dp-*` / `val-card` / `vg-*` / `flow-card` / `fc-*` / `fl-label` / `sig sig-warn` / `dp-r` 等，已逐一验证存在），**无需改 css**。
> 本文件给出：①v55 页面结构 & 变量映射 ②5 个功能块的完整 Vue 模板 ③对应 script setup 逻辑（含 Qf 估值引擎、n_ 决策引擎全量代码）④api.js 追加函数（精确 URL）⑤合并到 App.vue 的挂载清单。

---

## 0. v55 页面结构（detail 页从上到下）

```
<div class="detail">
  <div class="hdr detail-hdr">…报价头…</div>
  <div class="q-zone">…报价卡（已有恢复版）…</div>
  <section class="sec st-detail">…策略打分（已有简化版）…</section>
  <section v-if="nt" class="sec dp">        ← 决策面板（本文件块1）
  <div v-if="ht" class="val-card">           ← 估值面板（本文件块2）
  <div v-if="C" class="flow-card">           ← 主力资金（本文件块3）
      ├ .fc-head / .fc-net-big / .fc-legend
      ├ <div v-if="R…" class="fc-hist">     ← 5日vs今日（本文件块4，嵌套在 flow-card 内）
      └ <div v-if="vh.length" class="fc-signals">  ← 一眼看懂（本文件块5，嵌套在 flow-card 内）
  <KChart …/> …K线组件…
</div>
```

**注意**：fc-hist 与 fc-signals 在 v55 中是 `flow-card` 的**子节点**（不是平级独立卡片），恢复时保持嵌套。

## 1. v55 变量 → 恢复版命名映射

| v55 | 恢复版建议命名 | 说明 |
|---|---|---|
| `a` | `cur`（已有） | 选中股票 |
| `c` | `quote`（已有 ref({})） | 实时行情（pe/pb/mktcap/change_pct 来自这里） |
| `ht` | `valuation`（已有 ref(null)） | 估值结果（Qf 引擎输出） |
| `S` | `klineAna`（已有） | K线技术分析（score/verdict/chg_20d/signals） |
| `y` | `paict`（已有） | 价格行为分析（structure/signals/supports/resistances/orderBlocks/liquidityText） |
| `D` | `multiFlow`（已有 ref(null)） | 多周期资金流 ulist（today/d5/d10/d20） |
| `N` | `holderTrend`（已有 ref([])） | 股东户数趋势 [{date,num,change}] |
| `nt` | `decision`（新增 computed） | 决策面板数据（stage/stageLabel/stageIcon/confidence/advice/action/risks/reasons） |
| `C` | `fundFlow`（新增 ref(null)） | 今日主力资金（main/small/medium/large/super_large） |
| `O` | `intradayFlow`（新增 ref([])） | 盘中主力时序 [{time,main,…}]（一眼看懂用） |
| `R` | `fiveDayFlow`（新增 ref(null)） | 5日vs今日 {today, fiveDay} |
| `qo` | `listStage`（新增 computed） | 列表筛选口径阶段（dp-listtag 用） |
| `V`/`W` | `LIFE_STAGES` / `STAGE_KEYS` | 生命周期阶段数组/键序 |
| `A`/`X` | `stageNodeCls` / `arrowActive` | dp-node / dp-arrow 动态 class |
| `Um/Jm/Xm/Gm/Qm/Ym/Zm/tg` | `valScoreCls/peText/peCls/pbText/pbCls/roeText/roeCls/capType`（恢复版已有同名 peText 等） | 估值子文案/颜色 |
| `sg/ng/vh` | `flowRows/netCls/flowSignals` | 资金图例行 / 净额呼吸 class / 一眼看懂信号 |
| `Tt/qt/Xt` | `w5d/wToday/histInsight` | 5日/今日 条形宽度 / 对比洞察文案 |
| `ae` | `fmtMoney`（已有，逻辑与 ae 完全一致） | 亿/万格式化 |
| `Lt` | `fmtNum`（已有） | 保留 2 位小数 |
| `Qe` | `fmtPct`（已有） | 带符号百分比 |
| `Pt` | `ptCls`（新增，若冲突可内联） | `d>0?'up':d<0?'down':''` |
| `Qf` | `computeValuation(quote)` | 估值引擎（纯函数，模块级） |
| `n_` | `computeDecision({valuation,klineAna,paict,multiFlow,holderTrend})` | 决策引擎（纯函数，模块级） |
| `Lr/fm` | `stageIcon` / `stageLabel` | 阶段图标/名称映射 |
| `Gy/Zy/s_/Yy/i_` | `getFundFlow/getFiveDayFlow/getMultiFlow/getIntradayFlow/getHolderTrend` | 资金流 API（见 §7） |
| `hh()` | 可省略（仅同步自选列表价格） | 估值刷新后的附带动作 |

---

## 2. 块1：决策面板（v55: `sec dp`，render 偏移 17437）

### 2.1 Vue 模板（放 detail 页，策略打分之后）

```html
<!-- ============ 决策面板 ============ -->
<section v-if="decision" class="sec dp">
  <div class="sec-title">📋 决策面板 <span class="sec-sub">生命周期路径 · 当前阶段点亮</span></div>
  <div class="dp-path">
    <template v-for="(h, q) in LIFE_STAGES" :key="h.key">
      <div class="dp-node" :class="['dp-node', stageNodeCls(h.key), { on: decision.stage === h.key }]">
        <div class="dp-dot" :class="['dp-dot', 'dp-' + h.key]">{{ h.icon }}</div>
        <span class="dp-node-label">{{ h.label }}</span>
      </div>
      <div v-if="q < LIFE_STAGES.length - 1" class="dp-arrow" :class="{ active: arrowActive(q) }">➤</div>
    </template>
  </div>
  <div v-if="decision.stage === 'range'" class="dp-range-badge">⚪ 震荡期 · 方向未明，未进入主路径，等突破信号</div>
  <div class="dp-top">
    <span class="dp-action">{{ decision.action }}</span>
    <span class="dp-conf">信心指数 <b>{{ decision.confidence }}</b>/10</span>
  </div>
  <div class="dp-advice">{{ decision.advice }}</div>
  <div v-if="listStage && listStage !== decision.stage" class="dp-listtag">
    列表筛选口径：{{ stageIcon(listStage) }} {{ stageLabel(listStage) }}（资金+涨幅近似）· 与完整判定不同，以本面板为准
  </div>
  <div v-if="decision.risks.length" class="dp-risks">
    <div v-for="(h, q) in decision.risks" :key="q" class="sig sig-warn">⚠️ {{ h }}</div>
  </div>
  <div v-if="decision.reasons.length" class="dp-reasons">
    <span v-for="(h, q) in decision.reasons" :key="q" class="dp-r">{{ h }}</span>
  </div>
</section>
```

### 2.2 script setup 逻辑

```js
// —— 生命周期阶段（v55: W / V）——
const STAGE_KEYS = ['absorb', 'pump', 'distribute', 'fall']          // v55 W（顺序=箭头判定顺序）
const LIFE_STAGES = [                                                 // v55 V
  { key: 'absorb', icon: '🐂', label: '吸筹期' },
  { key: 'pump', icon: '🚀', label: '拉升期' },
  { key: 'distribute', icon: '🔴', label: '派发期' },
  { key: 'fall', icon: '🔻', label: '下跌期' },
]
// —— 阶段图标/名称（v55 Lr / fm，dp-listtag 用）——
const stageIcon = (d) => ({ absorb: '🐂', pump: '🚀', distribute: '🔴', fall: '🔻', range: '⚪' }[d] || '')
const stageLabel = (d) => ({ absorb: '吸筹期', pump: '拉升期', distribute: '派发期', fall: '下跌期', range: '震荡期' }[d] || d)
// —— dp-node 动态 class（v55 A）：已走过的阶段置 done ——
function stageNodeCls(d) {
  const o = STAGE_KEYS.indexOf(decision.value?.stage)
  return { ['dp-' + d]: true, done: o > STAGE_KEYS.indexOf(d) && o !== -1 }
}
// —— dp-arrow 激活（v55 X）：当前阶段之前的箭头点亮 ——
function arrowActive(d) {
  const o = STAGE_KEYS.indexOf(decision.value?.stage)
  return o > d && o !== -1
}
// —— 列表筛选口径（v55 qo）：资金+涨幅的粗判阶段，与完整决策不一致时展示提示条 ——
const listStage = computed(() => {
  const d = multiFlow.value, o = klineAna.value?.chg_20d
  return d?.d20 == null || o == null ? null
    : d.d20 > 0 ? (o > 3 ? 'pump' : 'absorb')
    : (o > 5 ? 'distribute' : o < -3 ? 'fall' : 'range')
})
// —— 决策面板（v55 nt = computed(n_(…))）——
const decision = computed(() => computeDecision({
  valuation: valuation.value, klineAna: klineAna.value, paict: paict.value,
  multiFlow: multiFlow.value, holderTrend: holderTrend.value,
}))
```

### 2.3 决策引擎（v55 `n_`，模块级纯函数，完整还原）

```js
// ===== computeDecision（v55 n_）=====
// 入参: { valuation, klineAna, paict, multiFlow, holderTrend }
// 返回: { stage, stageLabel, stageIcon, confidence, advice, action, risks, reasons } 或 null
function computeDecision(s) {
  const { valuation, klineAna, paict, multiFlow, holderTrend } = s || {}
  if (!multiFlow && !paict && !klineAna) return null
  let a = 0                                    // 信心分（负=偏空，正=偏多）
  const reasons = []
  const u = multiFlow
  // ★ v55 原结构：该 if 整体要求 paict 存在（条件用逗号表达式收尾为 paict）
  if ((u?.d20 != null && (
    u.d20 > 0 ? (a += 2, reasons.push('20日主力净流入')) : u.d20 < 0 && (a -= 2, reasons.push('20日主力净流出')),
    u.today > 0 && u.d20 < 0 && (a -= 1, reasons.push('当日反弹但中期在撤')),
    u.today < 0 && u.d20 > 0 && (a += 1, reasons.push('当日回调但中期在进'))
  ), paict)) {
    paict.structure === 'up' ? (a += 2, reasons.push('上升结构'))
      : paict.structure === 'down' ? (a -= 2, reasons.push('下降结构'))
      : reasons.push('震荡结构')
    for (const ct of paict.signals || []) ct.dir === 'bullish' ? a += 0.5 : ct.dir === 'bearish' && (a -= 0.5)
    paict.liquidityText && (a -= 0.5)
  }
  // K线打分与估值打分（v55 中为无条件副作用；holderTrend 段要求 ≥2 期）
  if (klineAna?.score != null && klineAna.verdict !== '数据不足') a += (klineAna.score - 5) / 5 * 2
  if (valuation?.score != null && valuation.verdict !== '暂无估值') a += (valuation.score - 1.5) / 1.5
  if ((holderTrend?.length ?? 0) >= 2) {
    const chg = holderTrend[0].change
    chg < -3 ? (a += 1, reasons.push('筹码集中')) : chg > 3 && (a -= 1, reasons.push('筹码分散'))
  }
  // —— 阶段判定 ——
  const isUp = paict?.structure === 'up'
  const isDown = paict?.structure === 'down'
  const d20In = u?.d20 > 0
  const d20Out = u?.d20 != null && u?.d20 < 0
  const holderDisperse = (holderTrend?.length ?? 0) >= 2 && holderTrend[0].change > 3
  const holderConcentrate = (holderTrend?.length ?? 0) >= 2 && holderTrend[0].change < -3
  const chg20d = klineAna?.chg_20d
  let stage = 'range', stageIcon_ = '⚪'
  if (isUp && d20In) { stage = 'pump'; stageIcon_ = '🚀' }
  else if (isDown && d20Out) { stage = 'fall'; stageIcon_ = '🔻' }
  else if (d20Out && (holderDisperse || (chg20d != null && chg20d > 10))) { stage = 'distribute'; stageIcon_ = '🔴' }
  else if (d20In && (holderConcentrate || (!isUp && !isDown && chg20d != null && chg20d < 15))) { stage = 'absorb'; stageIcon_ = '🐂' }
  const stageLabel_ = { pump: '拉升期', absorb: '吸筹期', distribute: '派发期', fall: '下跌期', range: '震荡期' }[stage]
  const action = { pump: '持有/加仓', absorb: '分批买入', distribute: '减仓/回避', fall: '观望', range: '等待突破' }[stage]
  // —— 支撑/阻力位（paict 结构）——
  const support = paict?.supports?.[0]
  const resist = paict?.resistances?.[0]
  const keySupport = paict?.orderBlocks?.[0]?.price || support
  const sTxt = support != null ? support.toFixed(2) : '前低'
  const rTxt = resist != null ? resist.toFixed(2) : '前高'
  const kTxt = keySupport != null ? keySupport.toFixed(2) : '关键支撑'
  const advice = {
    pump: `趋势拉升中，持有为主；回踩 ${kTxt} 可加仓，跌破 ${sTxt} 止损`,
    absorb: `主力低位吸筹，可分批建仓（回踩 ${kTxt} 分批买）；跌破 ${sTxt} 止损，耐心等拉升`,
    distribute: `高位筹码松动，减仓/不追高；反弹到 ${rTxt} 分批卖`,
    fall: `下降结构+资金撤离，观望不买；持有者反弹到 ${rTxt} 减仓`,
    range: `方向未明，等突破 ${rTxt} 再看；回踩 ${sTxt} 企稳可轻仓试`,
  }[stage]
  // —— 风险提示 ——
  const risks = []
  if (u?.today > 0 && u?.d20 < 0) risks.push('当日流入是反弹陷阱，中期资金仍在撤')
  if (holderDisperse) risks.push('股东户数大增=筹码分散，警惕派发')
  if (paict != null && paict.liquidityText) risks.push(paict.liquidityText)
  if (klineAna?.signals != null && klineAna.signals.some((ct) => /顶|见顶/.test(ct))) risks.push('技术面出现见顶信号')
  // —— 信心指数 1~10 ——
  const confidence = Math.max(1, Math.min(10, Math.round((a + 6) / 12 * 9 + 1)))
  return { stage, stageLabel: stageLabel_, stageIcon: stageIcon_, confidence, advice, action, risks: risks.slice(0, 2), reasons: reasons.slice(0, 4) }
}
```

---

## 3. 块2：估值面板（v55: `val-card`，render 偏移 18953）

### 3.1 Vue 模板

```html
<!-- ============ 估值面板 ============ -->
<div v-if="valuation" class="val-card">
  <div class="val-grid">
    <div class="vg-cell vg-score" :class="valScoreCls">
      <span class="vg-score-badge">{{ valuation.verdict }}</span>
      <span class="vg-score-num">{{ valuation.score }}<em>/6</em></span>
      <span class="vg-score-bar"><i v-for="h in 6" :key="h" :class="{ on: h <= valuation.score }"></i></span>
    </div>
    <div class="vg-cell">
      <span class="vg-title">PE 市盈率</span>
      <span class="vg-val">{{ valuation.pe != null ? valuation.pe.toFixed(1) : '--' }}</span>
      <span class="vg-sub" :class="peCls">{{ peText }}</span>
    </div>
    <div class="vg-cell">
      <span class="vg-title">PB 市净率</span>
      <span class="vg-val">{{ valuation.pb != null ? valuation.pb.toFixed(2) : '--' }}</span>
      <span class="vg-sub" :class="pbCls">{{ pbText }}</span>
    </div>
    <div class="vg-cell">
      <span class="vg-title">ROE 净资产收益率</span>
      <span class="vg-val">{{ valuation.roe != null ? valuation.roe + '%' : '--' }}<em v-if="valuation.roe_est" class="fb-note">≈估算</em></span>
      <span class="vg-sub" :class="roeCls">{{ roeText }}</span>
    </div>
    <div class="vg-cell">
      <span class="vg-title">总市值</span>
      <span class="vg-val">{{ fmtNum(quote.mktcap) }}亿</span>
      <span class="vg-sub">{{ capType }}</span>
    </div>
    <div class="vg-cell">
      <span class="vg-title">今日涨跌</span>
      <span class="vg-val" :class="ptCls(quote.change_pct)">{{ fmtPct(quote.change_pct) }}</span>
      <span class="vg-sub">{{ quote.change_pct > 0 ? '红盘' : quote.change_pct < 0 ? '绿盘' : '平盘' }}</span>
    </div>
  </div>
  <div v-if="valuation.points && valuation.points.length" class="val-points">
    <div v-for="(h, q) in valuation.points" :key="q" class="vp">{{ h }}</div>
  </div>
  <div class="val-summary">{{ valuation.summary }}</div>
  <div class="il-exp" style="margin-top: 6px">PE 越低越便宜 · PB&lt;1 破净 · ROE&gt;15% 优秀（{{ IND_EXPLAIN.ROE }}）</div>
</div>
```

> 说明：v55 的 `Lt(c.value.mktcap)` 即恢复版 `fmtNum`（`d==null?'--':Number(d).toFixed(2)`）；`Qe` 即 `fmtPct`；`Pt` 新增 `ptCls`。估值卡片无 sec-title（v55 如此）。footer 中 `si(Q).ROE` 实为常量配置 `IND_EXPLAIN.ROE`（v55 的 Qy 对象，见 §6.4）。

### 3.2 script setup 逻辑

```js
// —— 估值子项文案/颜色（v55 Um/Jm/Xm/Gm/Qm/Ym/Zm/tg；恢复版已有 peText/peCls/pbText/pbCls/roeText/roeCls，需补充以下 2 个 + valScoreCls）——
const valScoreCls = computed(() => {                       // v55 Um
  const d = valuation.value?.verdict
  return d === '优质标的' || d === '值得关注' ? 'val-good'
    : d === '亏损' || d === '需谨慎' || d === '基本面弱' ? 'val-bad'
    : 'val-mid'
})
const capType = computed(() => {                           // v55 tg
  const m = quote.value?.mktcap
  return m == null ? '--' : m > 1e3 ? '大盘股' : m >= 100 ? '中盘股' : '小盘股'
})
// 恢复版已有（与 v55 逐字一致，合并时保留即可）：
//   peText(v55 Jm) peCls(v55 Xm) pbText(v55 Gm) pbCls(v55 Qm) roeText(v55 Ym) roeCls(v55 Zm)
// ===== 估值引擎调用（v55: ht.value = Qf(c.value)；在 loadDetail 拿到 quote 后执行）=====
valuation.value = computeValuation(quote.value)
```

### 3.3 估值引擎（v55 `Qf`，模块级纯函数，完整还原）

```js
// ===== computeValuation（v55 Qf）=====
// 入参: quote（需含 pe / pb / mktcap）
// 返回: { verdict, score(0~6), roe(估算或null), pe, pb, roe_est, summary, points, pe_pos? }
function computeValuation(s) {
  const { pe, pb } = s || {}
  const roe = pe != null && pb != null && pe !== 0 ? +(pb / pe * 100).toFixed(1) : null   // ROE≈PB/PE
  // —— 亏损股 ——
  if (pe != null && pe < 0) {
    const pbTxt = pb < 1 ? '破净' : pb < 3 ? '正常' : '偏高'
    let score = 0
    if (pb > 0 && pb < 1) score += 1
    if (s.mktcap > 1e3) score += 1
    if (roe != null && roe > -10) score += 1
    return {
      verdict: '亏损', score, roe: roe ?? null, pe, pb, roe_est: true,
      summary: `公司当前亏损（PE为负，ROE≈${roe}%），PB=${pb.toFixed(2)}（${pbTxt}）。${pb < 1 ? '股价已跌破净资产，有一定资产支撑，但需警惕亏损扩大' : '估值需结合扭亏进度判断'}。亏损股核心看扭亏拐点与现金流，建议观望为主，谨慎抄底。`,
      points: [`⚠️ 当前亏损，ROE≈${roe}%`, pb < 1 ? '⚠️ PB<1，股价跌破净资产' : `PB=${pb.toFixed(2)}（${pbTxt}）`, '📌 关注季度报扭亏拐点'],
    }
  }
  // —— 无 PE（指数/ETF）——
  if (pe == null) {
    const pbTxt = pb != null ? (pb < 1 ? '破净' : pb < 3 ? '正常' : '偏高') : null
    let score = 0
    if (pb != null && pb < 1) score += 1
    if (s.mktcap > 1e3) score += 1
    return {
      verdict: '暂无估值', score, roe, pe, pb, roe_est: false,
      summary: `该品种无 PE 数据（指数/ETF 不适用），PB=${pb != null ? pb.toFixed(2) + '（' + pbTxt + '）' : '--'}。可用价格分位或同类对比判断贵贱。`,
      points: [],
    }
  }
  // —— 正常打分 ——
  let pePos
  pe < 10 ? pePos = '极低（<10）' : pe < 15 ? pePos = '较低（10-15）' : pe < 25 ? pePos = '中等（15-25）' : pe < 40 ? pePos = '偏高（25-40）' : pePos = '极高（>40）'
  let score = 0
  if (pe > 0 && pe < 25) score += 2; else if (pe < 40) score += 1
  if (pb > 0 && pb < 3) score += 2; else if (pb < 6) score += 1
  if (roe > 15) score += 2; else if (roe > 5) score += 1
  if (s.mktcap > 1e3) score += 1
  const verdict = score >= 5 ? '优质标的' : score >= 3 ? '值得关注' : '需谨慎'
  const points = []
  if (pe < 15) points.push('✅ PE偏低，估值有安全边际'); else if (pe > 40) points.push('⚠️ PE偏高，注意回调风险')
  if (roe > 15) points.push('✅ ROE优秀，赚钱能力强')
  if (pb < 1) points.push('⚠️ PB<1，股价跌破净资产')
  if (points.length === 0) points.push('估值处于合理区间')
  return {
    verdict, score, roe, pe, pb, roe_est: roe != null, pe_pos: pePos,
    summary: `PE=${pe.toFixed(1)}（${pePos}），PB=${pb.toFixed(2)}，ROE≈${roe}%。综合评分 ${score}/6「${verdict}」`,
    points,
  }
}
```

---

## 4. 块3：主力资金（v55: `flow-card`，render 偏移 21358）

### 4.1 Vue 模板

```html
<!-- ============ 主力资金（含 5日vs今日 + 一眼看懂）============ -->
<div v-if="fundFlow" class="flow-card">
  <div class="fc-head">
    <span class="fl-label">💰 主力资金</span>
    <span class="fc-dir" :class="ptCls(fundFlow.main)">{{ fundFlow.main >= 0 ? '净流入' : '净流出' }}</span>
  </div>
  <div class="fc-net-big" :class="netCls">{{ fmtMoney(fundFlow.main) }}</div>
  <div class="fc-legend">
    <div v-for="h in flowRows" :key="h.name" class="fc-row">
      <span class="fc-dot" :class="h.cls"></span>
      <span class="fc-name">{{ h.name }}</span>
      <div class="fc-bar"><div class="fc-fill" :class="h.cls" :style="{ width: h.width }"></div></div>
      <span class="fc-val" :class="ptCls(h.value)">{{ fmtMoney(h.value) }}</span>
    </div>
  </div>
  <!-- ============ 5日 vs 今日（块4，flow-card 子节点）============ -->
  <div v-if="fiveDayFlow && fiveDayFlow.today != null && fiveDayFlow.fiveDay != null" class="fc-hist">
    <div class="fc-hist-title">📅 5日 vs 今日 主力</div>
    <div class="fc-hist-row">
      <span class="fc-hr-label">近5日</span>
      <div class="fc-bar"><div class="fc-fill" :class="fiveDayFlow.fiveDay >= 0 ? 'in' : 'out'" :style="{ width: w5d }"></div></div>
      <span class="fc-val" :class="ptCls(fiveDayFlow.fiveDay)">{{ fmtMoney(fiveDayFlow.fiveDay) }}</span>
    </div>
    <div class="fc-hist-row">
      <span class="fc-hr-label">今日</span>
      <div class="fc-bar"><div class="fc-fill" :class="fiveDayFlow.today >= 0 ? 'in' : 'out'" :style="{ width: wToday }"></div></div>
      <span class="fc-val" :class="ptCls(fiveDayFlow.today)">{{ fmtMoney(fiveDayFlow.today) }}</span>
    </div>
    <div v-if="histInsight" class="fc-hist-insight">{{ histInsight }}</div>
  </div>
  <!-- ============ 一眼看懂（块5，flow-card 子节点）============ -->
  <div v-if="flowSignals.length" class="fc-signals">
    <div class="fc-signals-title">🧠 一眼看懂</div>
    <div v-for="(h, q) in flowSignals" :key="q" class="fc-signal">{{ h }}</div>
  </div>
</div>
```

### 4.2 script setup 逻辑

```js
// —— 资金流状态（v55 C / O / R）——
const fundFlow = ref(null)        // 今日主力资金 { main, small, medium, large, super_large }
const intradayFlow = ref([])      // 盘中主力时序 [{time, main, small, medium, large, super}]（一眼看懂午盘判断用）
const fiveDayFlow = ref(null)     // 5日vs今日 { today, fiveDay }

// —— 颜色辅助（v55 Pt）——
const ptCls = (d) => d > 0 ? 'up' : d < 0 ? 'down' : ''

// —— 图例行（v55 sg）——
const flowRows = computed(() => {
  const d = fundFlow.value
  if (!d) return []
  const arr = [
    { name: '超大单', value: d.super_large ?? 0 },
    { name: '大单', value: d.large ?? 0 },
    { name: '散户', value: (d.small ?? 0) + (d.medium ?? 0) },
  ]
  const mx = Math.max(1, ...arr.map(k => Math.abs(k.value)))
  return arr.map(k => ({
    name: k.name, value: k.value,
    cls: k.value >= 0 ? 'in' : 'out',
    width: Math.max(10, Math.round(Math.abs(k.value) / mx * 100)) + '%',
  }))
})
// —— 净额呼吸动画 class（v55 ng）——
const netCls = computed(() => {
  const d = fundFlow.value?.main
  return d == null ? '' : d >= 0 ? 'pulse-in' : 'pulse-out'
})
```

---

## 5. 块4：5日 vs 今日（v55: `fc-hist`）+ 块5：一眼看懂（v55: `fc-signals`）

模板见 §4.1 内嵌部分（v55 中二者是 flow-card 的子节点）。script 逻辑：

```js
// —— 5日/今日 条形宽度（v55 Tt/qt）：以两者较大绝对值为基准，最小 15% ——
const w5d = computed(() => {
  const d = fiveDayFlow.value
  if (!d || d.today == null || d.fiveDay == null) return '0%'
  const o = Math.max(Math.abs(d.today), Math.abs(d.fiveDay), 1)
  return Math.max(15, Math.round(Math.abs(d.fiveDay) / o * 100)) + '%'
})
const wToday = computed(() => {
  const d = fiveDayFlow.value
  if (!d || d.today == null || d.fiveDay == null) return '0%'
  const o = Math.max(Math.abs(d.today), Math.abs(d.fiveDay), 1)
  return Math.max(15, Math.round(Math.abs(d.today) / o * 100)) + '%'
})
// —— 洞察文案（v55 Xt）——
const histInsight = computed(() => {
  const d = fiveDayFlow.value
  if (!d || d.today == null || d.fiveDay == null) return ''
  if (d.fiveDay < 0 && d.today > 0) return '前几天主力在撤、今天转买——刚出现转折，观察是否持续'
  if (d.fiveDay > 0 && d.today < 0) return '前几天在买、今天在撤——小心资金撤退'
  if (d.fiveDay > 0 && d.today > 0) return '5天整体净流入，资金持续进场'
  if (d.fiveDay < 0 && d.today < 0) return '5天整体净流出，资金持续撤离'
  return ''
})
// —— 一眼看懂（v55 vh，最多 3 条）——
const flowSignals = computed(() => {
  const d = fundFlow.value
  if (!d) return []
  const o = []
  const main = d.main ?? 0, sup = d.super_large ?? 0, lg = d.large ?? 0
  const small = (d.small ?? 0) + (d.medium ?? 0)
  const up = (quote.value?.change_pct ?? 0) > 0
  // 主力 vs 股价
  if (main > 0 && up) o.push('主力净买 + 股价上涨，方向一致')
  else if (main > 0 && !up) o.push('主力在买但股价不涨，警惕托底')
  else if (main < 0 && up) o.push('主力在卖但股价在涨，散户抬轿，别追高')
  else if (main < 0 && !up) o.push('主力流出 + 股价下跌，资金在撤')
  // 超大单 vs 大单分歧（均过亿才提示）
  if (Math.abs(sup) > 1e8 && Math.abs(lg) > 1e8) {
    if (sup < 0 && lg > 0) o.push('超大单在撤、大单在接——大资金有分歧，警惕边拉边撤')
    else if (sup > 0 && lg < 0) o.push('超大单进场、大单在跑——顶级资金吸筹')
  }
  // 散户 vs 主力（散户变动超 5000 万才提示）
  if (Math.abs(small) > 5e7) {
    if (small < 0 && main > 0) o.push('散户在卖、主力在买——筹码向主力集中')
    else if (small > 0 && main < 0) o.push('散户在接盘、主力在卖——别当接盘侠')
  }
  // 盘中主力时序（v55 O.value，>60 根才做午盘判断）
  const Z = intradayFlow.value
  if (Z && Z.length > 60) {
    const arr = Z.map(rt => rt.main)
    const mid = arr[Math.floor(arr.length * 0.5)]
    const last = arr[arr.length - 1]
    if (last > mid && mid < arr[0]) o.push('早盘先流出、午后买回——买盘集中在下午')
    else if (last < mid && mid > arr[0]) o.push('早盘流入、午后转出——卖盘集中在下午')
  }
  return o.slice(0, 3)
})
```

---

## 6. 共享常量 / 辅助

### 6.1 涨跌色（v55 Pt）—— `ptCls`（见 §4.2）
### 6.2 金额格式化（v55 ae）—— 恢复版已有 `fmtMoney`，逻辑逐字一致：
```js
// 已有：const fmtMoney = (v) => { if (v == null || isNaN(v)) return '--'; const a = Math.abs(v); return a >= 1e8 ? (v/1e8).toFixed(2)+'亿' : a >= 1e4 ? (v/1e4).toFixed(1)+'万' : v.toFixed(0) }
```
### 6.3 保留两位（v55 Lt）—— 已有 `fmtNum`；百分比（v55 Qe）—— 已有 `fmtPct`
### 6.4 指标解释常量（v55 Qy 对象，`si(Q).ROE` 即其 ROE 字段；估值 footer 用到）：
```js
const IND_EXPLAIN = {
  ROE: 'ROE=净资产收益率：公司用股东的钱一年赚百分之几。>15% 优秀（巴菲特标准），<5% 赚钱能力弱',
  PE: 'PE=市盈率：按现在的赚钱速度，几年能回本。越低越便宜，但不同行业标准不同（银行10倍正常，科技股40倍也不贵）',
  PB: 'PB=市净率：股价是公司净资产的几倍。PB<1 叫"破净"（比家底还便宜），一般越低越安全',
  // 其余键（MA/MACD/RSI/KDJ/BOLL/量比/市值/换手…）见 dist-pretty-v55.js Qy，按需补充
}
```

---

## 7. api.js 追加函数（精确还原 v55 端点，可整体粘贴到 src/api.js 末尾）

```js
// ===== 资金流 =====（v55 Gy：今日主力资金，klt=1 分时资金最后一根）
export async function getFundFlow(secid) {
  try {
    const d = await _json(`https://push2delay.eastmoney.com/api/qt/stock/fflow/kline/get?lmt=0&klt=1&secid=${secid}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56`)
    const e = d?.data?.klines || []
    if (!e.length) return null
    const i = e[e.length - 1].split(',')
    return { main: +i[1], small: +i[2], medium: +i[3], large: +i[4], super_large: +i[5] }
  } catch { return null }
}
// ===== 盘中主力时序 =====（v55 Yy：jsonp 全量分时资金，一眼看懂午盘判断用）
export async function getIntradayFlow(secid) {
  try {
    const url = `https://push2delay.eastmoney.com/api/qt/stock/fflow/kline/get?secid=${secid}&lmt=0&klt=1&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56`
    const json = await new Promise((resolve, reject) => {
      const cb = 'mfs' + Math.random().toString(36).slice(2, 8)
      window[cb] = (p) => { delete window[cb]; resolve(JSON.stringify(p)) }
      const s = document.createElement('script')
      s.src = url + `&cb=${cb}`
      s.onerror = () => { delete window[cb]; reject(new Error('jsonp fail')) }
      document.head.appendChild(s)
      setTimeout(() => { delete window[cb]; reject(new Error('timeout')) }, 8000)
    })
    const n = JSON.parse(json)
    return (n?.data?.klines || []).map(a => {
      const c = a.split(',')
      return { time: c[0].slice(11, 16), main: +c[1], small: +c[2], medium: +c[3], large: +c[4], super: +c[5] }
    })
  } catch { return [] }
}
// ===== 5日 vs 今日主力 =====（v55 Zy：ulist f62=今日主力净额, f267=5日主力净额）
export async function getFiveDayFlow(secid) {
  try {
    const d = await _json(`https://push2delay.eastmoney.com/api/qt/ulist.np/get?secids=${secid}&fltt=2&invt=2&fields=f12,f62,f267`)
    const l = Object.values(d?.data?.diff || {})[0]
    return l ? { today: typeof l.f62 === 'number' ? l.f62 : null, fiveDay: typeof l.f267 === 'number' ? l.f267 : null } : null
  } catch { return null }
}
// ===== 多周期资金流 =====（v55 s_：today/d5/d10/d20，决策引擎 + listStage 用）
export async function getMultiFlow(secid) {
  try {
    const d = await _json(`https://push2delay.eastmoney.com/api/qt/ulist.np/get?secids=${secid}&fltt=2&invt=2&fields=f12,f62,f267,f164,f174`)
    const l = Object.values(d?.data?.diff || {})[0]
    return l ? {
      today: typeof l.f62 === 'number' ? l.f62 : null,
      d5: typeof l.f267 === 'number' ? l.f267 : null,
      d10: typeof l.f164 === 'number' ? l.f164 : null,
      d20: typeof l.f174 === 'number' ? l.f174 : null,
    } : null
  } catch { return null }
}
// ===== 股东户数趋势 =====（v55 i_：决策引擎筹码集中/分散判定）
export async function getHolderTrend(secid) {
  try {
    const code = String(secid).split('.')[1]
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_HOLDERNUM_DET&columns=ALL&filter=${encodeURIComponent(`(SECURITY_CODE="${code}")`)}&pageSize=5&sortColumns=END_DATE&sortTypes=-1&source=WEB&client=WEB`
    const d = await _json(url)   // 注意：该接口返回 callback 包裹，v55 用 He(url, 'callback') 解析；若 _json 失败可改 fetch + 文本解析
    const list = d?.result?.data || []
    return list.map((a, i) => {
      const u = a.HOLDER_NUM
      const next = i < list.length - 1 ? list[i + 1].HOLDER_NUM : null
      const chg = a.HOLDER_NUM_CHANGE_RATE != null ? a.HOLDER_NUM_CHANGE_RATE : (next && u ? (u - next) / next * 100 : 0)
      return { date: String(a.END_DATE || '').slice(0, 7), num: u, change: +chg.toFixed(1) }
    })
  } catch { return [] }
}
```

---

## 8. 合并到 App.vue 的挂载清单

1. **新增 ref**（script 状态区，紧挨现有 `multiFlow`/`holderTrend`/`valuation`）：
   `fundFlow = ref(null)`、`intradayFlow = ref([])`、`fiveDayFlow = ref(null)`、`decision = computed(...)`、`listStage = computed(...)`、`flowRows/netCls/w5d/wToday/histInsight/flowSignals/valScoreCls/capType` 等 computed、`ptCls` 函数、`STAGE_KEYS/LIFE_STAGES/stageIcon/stageLabel/stageNodeCls/arrowActive`、`IND_EXPLAIN`。
2. **模块级纯函数**（可放 `<script setup>` 外或同文件顶部）：`computeValuation`（§3.3）、`computeDecision`（§2.3）。
3. **api.js**：粘贴 §7 五个函数（getHolderTrend 若跨域 jsonp 解析有问题，可复用现有 `He` 的 callback 处理方式）。
4. **loadDetail() 内挂载**（v55 Pr() 对应逻辑，放在 `quote.value = d.quote` 之后、`await loadPeriod(101, seq)` 之前或之后均可）：
```js
if (d.quote) { quote.value = d.quote; valuation.value = computeValuation(d.quote) }   // 估值（v55: ht=Qf(c)）
// 资金流（v55 Pr：C/R/D/O/N 五路并行，各自 try/catch 互不影响）
const secid2 = cur.value.secid
api.getFundFlow(secid2).then(v => { if (seq === loadSeq) fundFlow.value = v }).catch(() => {})
api.getFiveDayFlow(secid2).then(v => { if (seq === loadSeq) fiveDayFlow.value = v }).catch(() => {})
api.getIntradayFlow(secid2).then(v => { if (seq === loadSeq) intradayFlow.value = v }).catch(() => {})
api.getMultiFlow(secid2).then(v => { if (seq === loadSeq) multiFlow.value = v }).catch(() => {})
api.getHolderTrend(secid2).then(v => { if (seq === loadSeq) holderTrend.value = v }).catch(() => {})
```
   （v55 中 valuation 还会在实时推送 `_m()`/`Pr` 拿到新 quote 时重算：`ht.value = Qf(_.quote)`；恢复版若有轮询刷新 quote 的位置，同样补一行 `valuation.value = computeValuation(q)`。）
5. **模板挂载**：
   - 方案A（贴近 v55）：在 detail 页 `q-zone` 报价区之后按顺序插入 决策面板(§2.1) → 估值面板(§3.1) → 主力资金(§4.1 含 5日vs今日+一眼看懂)，删掉简化版 `detailTab==='value'` / `'flow'` 两个 tab 分支（或保留 tab 切换时用 v-show）。
   - 方案B（保留 tab 结构）：把 §3.1 模板替换进 `value` tab，§4.1 替换进 `flow` tab，决策面板插在 `strategy` tab 或 kline 下方。
6. **删除/保留**：恢复版已有 `valCls/peText/peCls/pbText/pbCls/roeText/roeCls/capText/flowBars/flowNotes` 与 v55 逻辑一致，可直接复用（valCls≡valScoreCls、capText≡capType、flowBars 少 `dots` 字段无妨）；`fmtMoney`≡v55 `ae`、`fmtPct`≡`Qe`、`fmtNum`≡`Lt`。
7. **验证**：`npm run build` 后检查：估值卡片 6 格 + 6 圆点；主力资金三条图例条与净额呼吸动画；5日vs今日双条与洞察文案；决策面板阶段点亮、箭头、信心指数、建议、风险、理由；列表筛选口径提示条仅在 listStage≠decision.stage 时出现。

---

## 9. 关键坑（反推时确认的细节）

- fc-hist / fc-signals 是 **flow-card 的子节点**，不是独立卡片（见 §0 结构树）。
- 决策引擎 `n_` 中资金分/结构分整体要求 `paict` 存在（v55 用逗号表达式 `if ((d20!=null && (…)), paict)`），K线分与估值分是无条件副作用（v55 `if (A && (a+=…), B && (a+=…), C)`）。
- dp-arrow 用**索引** q 判定（`q < V.length-1`），X(q) 也按索引；dp-node 的 `done` 由阶段索引比较得出。
- `fc-fill` 宽度：5日/今日 以两者较大绝对值为基准、最小 15%；图例以三行最大绝对值为基准、最小 10%。
- 估值 footer 的 `si(Q).ROE` = `IND_EXPLAIN.ROE`（Qy 常量），模板里写成 `{{ IND_EXPLAIN.ROE }}`。
- ROE 为 `PB/PE×100` 的**估算值**（`roe_est` 标记，展示 `≈估算`）；亏损股 ROE 可为负。
- 一眼看懂仅取前 3 条；超大单/大单分歧需双方绝对值均 >1e8，散户变动需 >5e7 才提示；盘中判断需 intradayFlow 长度 >60。
- v55 决策面板数据 `nt` 的 `stageIcon/stageLabel` 字段实际未被模板使用（模板用 `V` 数组渲染），保留即可。
