<template>
  <div class="app">
    <!-- ========== 顶部 ========== -->
    <div v-if="view === 'home'" class="home">
      <div class="hdr">
        <span class="logo">📈 看盘</span>
        <span class="ver-tag">{{ ver }}</span>
      </div>
      <!-- 搜索 -->
      <div class="search-box">
        <input v-model="kw" placeholder="搜索代码/名称" @input="onSearch" @keyup.enter="goFirst" />
        <div v-if="results.length" class="search-results">
          <div v-for="r in results" :key="r.secid" class="sr-item" @click="openStock(r)">
            <span class="sr-name">{{ r.name }}</span><span class="sr-code">{{ r.code }}</span><span class="sr-type">{{ r.type }}</span>
          </div>
        </div>
      </div>
      <!-- 指数条 -->
      <div v-if="indices.sh" class="market-strip">
        <div class="ms-item"><span class="ms-name">沪</span><span :class="['ms-num', indices.sh.chg >= 0 ? 'up' : 'down']">{{ fmtPct(indices.sh.chg) }}</span></div>
        <div class="ms-item"><span class="ms-name">深</span><span :class="['ms-num', indices.sz.chg >= 0 ? 'up' : 'down']">{{ fmtPct(indices.sz.chg) }}</span></div>
        <div class="ms-item"><span class="ms-name">恒</span><span :class="['ms-num', indices.hk.chg >= 0 ? 'up' : 'down']">{{ fmtPct(indices.hk.chg) }}</span></div>
      </div>
      <!-- 分类 tab -->
      <div class="cat-tabs">
        <span v-for="t in cats" :key="t.key" :class="['ct', { on: st === t.key }]" @click="switchCat(t.key)">{{ t.label }}</span>
      </div>
      <!-- 列表 -->
      <div v-if="st === 'zt'" class="zt-page">
        <div v-if="cycle" class="zt-senti">
          <div class="zs-top"><span class="zs-icon">{{ cycle.icon }}</span><span class="zs-advice">{{ cycle.advice }}</span></div>
          <div class="zs-nums">
            <div class="zs-cell"><b>{{ cycle.total }}</b><span>涨停</span></div>
            <div class="zs-cell"><b>{{ cycle.maxLb }}</b><span>最高板</span></div>
            <div class="zs-cell"><b>{{ cycle.breakRate }}%</b><span>炸板率</span></div>
          </div>
          <div class="zs-tiers">
            <span v-for="(v, k) in cycle.tiers" :key="k" class="zt-tier">{{ k }}板:{{ v }}</span>
          </div>
        </div>
        <div class="zt-list">
          <div v-for="it in ztItems" :key="it.code" class="zt-item" @click="openStock({ secid: (it.code.startsWith('6') ? '1.' : '0.') + it.code, name: it.name, code: it.code })">
            <div class="zt-main">
              <div class="zt-name">{{ it.name }} <b class="zt-lb">{{ it.limitCount }}板</b></div>
              <div class="zt-sub">{{ it.industry }} · {{ it.firstTime }} · 封单{{ fmtMoney(it.seal) }}</div>
            </div>
            <div class="zt-price up">{{ it.price.toFixed(2) }}</div>
          </div>
        </div>
      </div>
      <div v-else-if="st === 'lhb'" class="lhb-page">
        <div class="sec-title">龙虎榜</div>
        <div v-if="lhb && lhb.items" class="lhb-list">
          <div v-for="it in lhb.items" :key="it.code" class="lhb-item" @click="openStock({ secid: (it.code.startsWith('6') ? '1.' : '0.') + it.code, name: it.name, code: it.code })">
            <div class="lhb-main"><span class="lhb-name">{{ it.name }}</span><span class="lhb-sub">{{ it.reason || '' }}</span></div>
            <span class="lhb-net" :class="(it.net || 0) >= 0 ? 'up' : 'down'">{{ fmtMoney(it.net) }}</span>
          </div>
        </div>
        <div v-else class="empty">暂无数据</div>
      </div>
      <div v-else-if="st === 'hold'" class="hold-page">
        <div class="sec-title">持仓监控</div>
        <div v-for="h in holds" :key="h.code" class="hold-item" @click="openStock({ secid: (h.code.startsWith('6') ? '1.' : '0.') + h.code, name: h.name, code: h.code })">
          <div class="hi-name">{{ h.name }} <span class="hi-code">{{ h.code }}</span></div>
          <div class="hi-info">{{ h.cost ? '成本' + h.cost : '' }} · 今日{{ h.chg != null ? fmtPct(h.chg) : '-' }}</div>
        </div>
        <div class="hold-actions"><button @click="showHoldForm = !showHoldForm">+ 添加持仓</button></div>
        <div v-if="showHoldForm" class="trade-form">
          <input v-model="holdForm.code" placeholder="代码" /><input v-model="holdForm.name" placeholder="名称" /><input v-model="holdForm.cost" placeholder="成本价" />
          <button @click="addHold">保存</button>
        </div>
      </div>
      <div v-else class="list-page">
        <div v-if="loading" class="list-loading">⏳ 加载中...</div>
        <div v-for="it in listItems" :key="it.secid || it.code" class="row-item" @click="openStock(it)">
          <div class="row-main">
            <div class="row-name">{{ it.name }} <span v-if="boardTag(it)" class="row-board">{{ boardTag(it).board }}</span></div>
            <div class="row-code">{{ (it.secid || it.code || '').split('.')[1] || it.code }}</div>
            <div v-if="it.price != null" class="row-price"><span :class="it.chg >= 0 ? 'up' : 'down'">{{ it.price.toFixed(2) }} {{ fmtPct(it.chg) }}</span></div>
          </div>
          <div class="row-metrics">
            <span v-if="it.score != null" class="rs-score" :class="scoreCls(it.score)">{{ it.score }}</span>
            <span v-if="it.main_flow != null" class="row-flow" :class="it.main_flow >= 0 ? 'up' : 'down'">{{ fmtMoney(it.main_flow) }}</span>
          </div>
        </div>
        <div v-if="!loading && !listItems.length" class="empty">暂无数据</div>
      </div>
    </div>

    <!-- ========== 今日重点 ========== -->
    <div v-else-if="view === 'overview'" class="overview-page">
      <div class="hdr"><span class="logo">🎯 今日重点</span><span class="ver-tag">{{ ver }}</span></div>
      <div class="pl-tools">
        <div class="pl-filters">
          <span v-for="m in modes" :key="m.key" :class="['chip', { on: mode === m.key }]" @click="setMode(m.key)">{{ m.label }}</span>
        </div>
      </div>
      <div v-if="!overview" class="empty">⏳ 加载中...</div>
      <div v-else>
        <div v-for="it in overview" :key="it.code" class="oti" @click="openStock({ secid: it.secid, name: it.name, code: it.code })">
          <div class="oti-left">
            <div class="oti-name">{{ it.name }} <span class="oti-code">{{ it.code }}</span></div>
            <div class="oti-sigs">
              <span v-for="(s, i) in (it.signals || []).slice(0, 4)" :key="i" class="ot-sig">{{ s }}</span>
            </div>
          </div>
          <div class="oti-right">
            <div v-if="it.score != null" class="oti-score" :class="scoreCls(it.score)">{{ it.score }}</div>
            <div v-if="it.price != null" class="oti-price" :class="it.chg >= 0 ? 'up' : 'down'">{{ it.price.toFixed(2) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 预测+历史 ========== -->
    <div v-else-if="view === 'predict'" class="bt-page">
      <div class="hdr"><span class="logo">🔮 预测</span><span class="ver-tag">{{ ver }}</span></div>
      <div class="pred-tabbar">
        <span v-for="t in predTabs" :key="t.key" :class="['pt', { on: predTab === t.key }]" @click="predTab = t.key; loadPredict()">{{ t.label }}</span>
      </div>
      <div v-if="predTab === 'history'" class="pl-hist">
        <div class="plh-title">📜 历史预测存档</div>
        <div v-if="!histLoading" class="plh-stats">
          <div class="phs-card"><b>{{ histStats.total }}</b><span>存档</span></div>
          <div class="phs-card"><b>{{ histStats.morning }}</b><span>盘前</span></div>
          <div class="phs-card"><b>{{ histStats.evening }}</b><span>盘后</span></div>
          <div class="phs-card"><b>{{ histStats.hitRate }}%</b><span>命中率</span></div>
        </div>
        <div class="plh-list">
          <div v-for="g in histGroups" :key="g.date" class="plh-group" @click="toggleHistDay(g.date)">
            <div class="plh-date">{{ g.date }} <span class="plh-cnt">{{ g.count }} 只</span></div>
            <div class="plh-sum">{{ g.summary }}</div>
            <div v-if="histDay === g.date" class="plh-detail">
              <div v-for="it in g.items" :key="it.code" class="plh-item">
                <span class="ph-name">{{ it.name }}</span>
                <span class="ph-sigs">{{ (it.sig_labels || []).join(' ') }}</span>
                <span class="ph-chg" :class="(it.ret || 0) >= 0 ? 'up' : 'down'">{{ it.ret != null ? fmtPct(it.ret) : '-' }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!histGroups.length" class="plh-empty">暂无历史存档</div>
      </div>
      <div v-else class="pred-list">
        <div v-if="!predLoading" class="pred-info">
          <div class="pi-title">策略说明</div>
          <div class="pi-desc">{{ predDesc }}</div>
        </div>
        <div v-for="it in predItems" :key="it.code" class="plr" @click="openStock({ secid: it.secid, name: it.name, code: it.code })">
          <div class="plr-name">{{ it.name }} <span class="plr-score" :class="scoreCls(it.score)">{{ it.score }}</span></div>
          <div class="plr-signals">
            <span v-for="(s, i) in (it.sig_labels || []).slice(0, 5)" :key="i" class="plr-sig">{{ s }}</span>
          </div>
          <div v-if="it.entry" class="plr-trade">进 {{ it.entry }} / 止 {{ it.stop }} / 标 {{ it.target }}</div>
        </div>
        <div v-if="!predLoading && !predItems.length" class="pl-empty">暂无预测（19:30 后生成）</div>
      </div>
    </div>

    <!-- ========== 实盘 ========== -->
    <div v-else-if="view === 'live'" class="live-page">
      <div class="hdr">
        <span class="logo">⚡ 实盘</span>
        <span v-if="cur" class="live-name">{{ cur.name }} {{ cur.code }}</span>
        <span class="ver-tag">{{ ver }}</span>
      </div>
      <div v-if="!cur" class="empty">从列表/搜索进入个股后可用实盘</div>
      <template v-else>
        <div class="live-head">
          <div class="lh-row1">
            <span class="live-price" :class="liveQuote.chg >= 0 ? 'up' : 'down'">{{ liveQuote.price != null ? liveQuote.price.toFixed(2) : '-' }}</span>
            <span class="live-dot" :class="{ on: liveOn }"></span>
            <span class="live-src">{{ liveSrc }}</span>
          </div>
          <div class="lh-row2">
            <span :class="['lh-chg', liveQuote.chg >= 0 ? 'up' : 'down']">{{ fmtPct(liveQuote.chg) }}</span>
            <span>高 {{ liveQuote.high != null ? liveQuote.high.toFixed(2) : '-' }}</span>
            <span>低 {{ liveQuote.low != null ? liveQuote.low.toFixed(2) : '-' }}</span>
            <span>额 {{ fmtMoney(liveQuote.amount) }}</span>
          </div>
        </div>
        <div class="live-panel">
          <div class="lp-block">
            <div class="lp-name">🧠 行为识别</div>
            <div v-if="liveBehavior" class="beh-main">
              <span class="beh-emoji">{{ liveBehavior.emoji }}</span>
              <span class="beh-label" :style="{ color: liveBehavior.color }">{{ liveBehavior.label }}</span>
              <span class="beh-conf">{{ liveBehavior.confidence }}%</span>
            </div>
            <div v-else class="lp-sig-none">等待数据...</div>
          </div>
          <div class="lp-block">
            <div class="lp-name">📡 买卖信号</div>
            <div class="lp-sig-list">
              <div v-for="(s, i) in liveSignals" :key="i" class="lp-sig" :class="'sig-' + s.side">
                <span class="lp-sig-id">{{ s.id }}</span>
                <span class="lp-sig-label">{{ s.label }}</span>
                <span class="lp-sig-trigger">{{ s.trigger }}</span>
              </div>
              <div v-if="!liveSignals.length" class="lp-sig-none">暂无信号</div>
            </div>
          </div>
          <div class="lp-block">
            <div class="lp-name">⚠️ 异常监测</div>
            <div class="live-anom">
              <div v-for="(a, i) in liveAnoms" :key="i" class="anom-item">
                <span class="anom-type">{{ a.type }}</span>
                <span class="anom-read">{{ a.read }}</span>
                <span class="anom-act" :class="a.sev === '强' ? 'ai-a-sell' : ''">{{ a.act }}</span>
              </div>
              <div v-if="!liveAnoms.length" class="lp-sig-none">暂无异常</div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ========== 详情页 ========== -->
    <div v-else-if="view === 'detail' && cur" class="detail">
      <div class="hdr detail-hdr">
        <span class="back" @click="view = 'home'">←</span>
        <span class="d-title">{{ cur.name }}</span>
        <span class="d-code">{{ cur.code }}</span>
        <span class="ver-tag">{{ ver }}</span>
      </div>
      <div class="d-tabs">
        <span v-for="t in detailTabs" :key="t.key" :class="['dt', { on: detailTab === t.key }]" @click="switchDetailTab(t.key)">{{ t.label }}</span>
      </div>
      <!-- 报价 -->
      <div class="q-zone">
        <div class="q-price" :class="q.chg >= 0 ? 'up' : 'down'">{{ q.price != null ? q.price.toFixed(2) : '-' }}</div>
        <div class="q-row">
          <span :class="q.chg >= 0 ? 'up' : 'down'">{{ fmtPct(q.chg) }}</span>
          <span>开 {{ q.open != null ? q.open.toFixed(2) : '-' }}</span>
          <span>高 {{ q.high != null ? q.high.toFixed(2) : '-' }}</span>
          <span>低 {{ q.low != null ? q.low.toFixed(2) : '-' }}</span>
          <span>量 {{ fmtMoney(q.volume) }}</span>
          <span>额 {{ fmtMoney(q.amount) }}</span>
        </div>
      </div>
      <!-- K线 -->
      <div class="kchart-sec">
        <div class="ktabs">
          <span v-for="t in kTabs" :key="t.v" :class="['kt', { on: timeframe === t.v }]" @click="setTF(t.v)">{{ t.label }}</span>
        </div>
        <canvas ref="kcv" class="kcanvas" @click="onKClick"></canvas>
      </div>
      <!-- 实盘区块 -->
      <div v-if="detailTab === 'live'" class="live-panel">
        <div class="lp-block">
          <div class="lp-name">🧠 行为</div>
          <div v-if="liveBehavior" class="beh-main"><span class="beh-emoji">{{ liveBehavior.emoji }}</span><span class="beh-label" :style="{ color: liveBehavior.color }">{{ liveBehavior.label }}</span><span class="beh-conf">{{ liveBehavior.confidence }}%</span></div>
          <div v-else class="lp-sig-none">等待数据</div>
        </div>
        <div class="lp-block">
          <div class="lp-name">📡 信号</div>
          <div class="lp-sig-list">
            <div v-for="(s, i) in liveSignals" :key="i" class="lp-sig" :class="'sig-' + s.side"><span class="lp-sig-id">{{ s.id }}</span><span class="lp-sig-label">{{ s.label }}</span><span class="lp-sig-trigger">{{ s.trigger }}</span></div>
          </div>
        </div>
      </div>
      <!-- 分时区 -->
      <div v-else-if="detailTab === 'trend'" class="trend-sec">
        <canvas ref="tcv" class="kcanvas"></canvas>
      </div>
      <!-- AI 分析 -->
      <div v-else-if="detailTab === 'ai'" class="llm-sec">
        <button :disabled="llmLoading" @click="runLLM" class="llm-btn">{{ llmLoading ? '分析中...' : '🤖 AI 分析' }}</button>
        <div v-if="llmOut" class="llm-text" style="white-space: pre-wrap">{{ llmOut }}</div>
      </div>
      <!-- 策略详情 -->
      <div v-else class="st-detail">
        <div class="std-items">
          <div v-for="(v, k) in strategy" :key="k" class="stdi">
            <span class="stdi-label">{{ k }}</span>
            <span class="stdi-val">{{ v }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 底部导航 ========== -->
    <div class="cmp-bar">
      <button v-for="v in navs" :key="v.key" :class="['nav-btn', { on: view === v.key }]" @click="goNav(v.key)" :disabled="v.key === 'live' && !cur">{{ v.icon }}<span>{{ v.label }}</span></button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as api from './api.js'
import { LiveEngine } from './liveEngine.js'

const ver = 'v260818-0001'
const view = ref('home')
const navs = [
  { key: 'home', label: '首页', icon: '🏠' },
  { key: 'overview', label: '重点', icon: '🎯' },
  { key: 'predict', label: '预测', icon: '🔮' },
  { key: 'live', label: '实盘', icon: '⚡' },
]
const cats = [
  { key: 'all', label: '全部' }, { key: 'zt', label: '涨停' }, { key: 'lhb', label: '龙虎榜' },
  { key: 'hold', label: '持仓' }, { key: 'fav', label: '自选' },
]
const st = ref('all')
const kw = ref('')
const results = ref([])
const listItems = ref([])
const loading = ref(false)
const page = ref(1)
const indices = ref({})
const cur = ref(null)
const q = ref({})
const strategy = ref({})
const cycle = ref(null)
const ztItems = ref([])
const lhb = ref(null)
const holds = ref([])
const showHoldForm = ref(false)
const holdForm = ref({})

// 今日重点
const mode = ref('swing')
const modes = [
  { key: 'swing', label: '⚡超短' }, { key: 'short', label: '📈波段' }, { key: 'long', label: '🏦长线' },
]
const overview = ref(null)

// 预测
const predTab = ref('list')
const predTabs = [
  { key: 'list', label: '明日预测' }, { key: 'history', label: '📜 历史' },
]
const predItems = ref([])
const predLoading = ref(false)
const predDesc = ref('')
const histGroups = ref([])
const histDay = ref(null)
const histStats = ref({})
const histLoading = ref(false)

// 详情
const detailTab = ref('kline')
const detailTabs = [
  { key: 'kline', label: 'K线' }, { key: 'trend', label: '分时' }, { key: 'live', label: '实盘' }, { key: 'ai', label: 'AI' },
]
const timeframe = ref(101)
const kTabs = [
  { label: '日K', v: 101 }, { label: '周K', v: 102 }, { label: '月K', v: 103 }, { label: '分时', v: 0 },
]
const kcv = ref(null)
const tcv = ref(null)
const klines = ref([])
const trends = ref([])
const llmOut = ref('')
const llmLoading = ref(false)

// 实盘
const liveEngine = ref(null)
const liveBehavior = ref(null)
const liveSignals = ref([])
const liveAnoms = ref([])
const liveQuote = ref({})
const liveOn = ref(false)
const liveSrc = ref('-')
let liveTimer = null

// ========== 通用 ==========
const fmtPct = (v) => (v == null ? '-' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%')
const fmtMoney = api.fmtMoney
const scoreCls = (s) => (s >= 70 ? 'hi' : s >= 55 ? 'mid' : 'lo')
const boardTag = (it) => {
  const b = api.boardOf(it.code || (it.secid || '').split('.')[1], it.name)
  return b.board !== '主板' ? b : null
}

// ========== 首页 ==========
async function onSearch() {
  const k = kw.value.trim()
  if (!k) { results.value = []; return }
  results.value = (await api.searchStock(k)).slice(0, 8)
}
function goFirst() {
  if (results.value.length) openStock(results.value[0])
}

function switchCat(k) {
  st.value = k
  if (k === 'zt') loadZt()
  else if (k === 'lhb') loadLhb()
  else if (k === 'hold') loadHolds()
  else loadList(1)
}

async function loadList(p) {
  loading.value = true
  try {
    const d = await api.getList({ page: p, page_size: 50 })
    listItems.value = p === 1 ? (d.items || []) : [...listItems.value, ...(d.items || [])]
    page.value = p
  } catch { listItems.value = [] }
  loading.value = false
}

async function loadZt() {
  const d = await api.getZtPool()
  ztItems.value = (d && d.items) || []
  const zb = await api.getZbPool()
  cycle.value = api.computeCycle(d, zb)
}

async function loadLhb() {
  lhb.value = await api.getLhb()
}

async function loadHolds() {
  holds.value = await api.getHoldings()
}

function addHold() {
  holds.value.push({ code: holdForm.value.code, name: holdForm.value.name, cost: +holdForm.value.cost })
  api.saveHoldings(holds.value)
  showHoldForm.value = false
  holdForm.value = {}
}

async function loadIndices() {
  try {
    const d = await fetch('/api/market-temp').then(r => r.json())
    if (d && d.indices) indices.value = d.indices
  } catch {}
}

// ========== 今日重点 ==========
async function setMode(m) {
  mode.value = m
  await loadOverview()
}

async function loadOverview() {
  overview.value = null
  const d = await api.getRealtime(mode.value)
  overview.value = (d && d.items) || []
}

// ========== 预测 ==========
async function loadPredict() {
  if (predTab.value === 'history') { loadHistory(); return }
  predLoading.value = true
  const d = await api.getPredict(mode.value, false)
  predItems.value = (d && d.items) || []
  predDesc.value = (d && d.desc) || '基于截至昨日收盘的全市场扫描，龙头信号+K线质量评分。'
  predLoading.value = false
}

async function loadHistory() {
  histLoading.value = true
  const records = await api.getHistory()
  // 按日期分组
  const groups = {}
  records.forEach((r) => {
    const date = (r.date || '').slice(0, 10)
    if (!groups[date]) groups[date] = []
    groups[date].push(r)
  })
  histGroups.value = Object.entries(groups).sort((a, b) => b[0] < a[0] ? -1 : 1).map(([date, items]) => ({
    date, items, count: items.length,
    summary: `盘前 ${items.filter(x => x.type === 'morning').length} · 盘后 ${items.filter(x => x.type === 'evening').length}`,
  }))
  const hits = records.filter(r => r.hit != null)
  histStats.value = {
    total: records.length,
    morning: records.filter(r => r.type === 'morning').length,
    evening: records.filter(r => r.type === 'evening').length,
    hitRate: hits.length ? Math.round(hits.filter(r => r.hit).length / hits.length * 100) : 0,
  }
  histLoading.value = false
}

function toggleHistDay(d) {
  histDay.value = histDay.value === d ? null : d
}

// ========== 详情 ==========
function openStock(it) {
  if (!it || !it.secid && !it.code) return
  cur.value = { ...it, secid: it.secid || (it.code.startsWith('6') ? '1.' + it.code : '0.' + it.code) }
  view.value = 'detail'
  detailTab.value = 'kline'
  loadDetail()
}

async function loadDetail() {
  const secid = cur.value.secid
  q.value = await api.getRealtimeQuote(secid).catch(() => ({}))
  klines.value = await api.getKlines(secid, timeframe.value)
  trends.value = await api.getTrends(secid).catch(() => [])
  strategy.value = {}
  drawK()
  drawT()
}

function switchDetailTab(t) {
  detailTab.value = t
  if (t === 'live') startLive()
  else stopLive()
}

function setTF(v) {
  timeframe.value = v
  if (v === 0) { klines.value = trends.value.map(x => ({ time: x.time, open: x.price, close: x.price, high: x.price, low: x.price, volume: x.vol })); drawK(); return }
  loadDetail()
}

function onKClick() {}

// 简化 K 线 canvas
function drawK() {
  const c = kcv.value
  if (!c || !klines.value.length) return
  const ctx = c.getContext('2d')
  const W = c.width = c.clientWidth * (window.devicePixelRatio || 1)
  const H = c.height = 300 * (window.devicePixelRatio || 1)
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1)
  const w = c.clientWidth, h = 300
  ctx.clearRect(0, 0, w, h)
  const ks = klines.value.slice(-120)
  let lo = Math.min(...ks.map(k => k.low)), hi = Math.max(...ks.map(k => k.high))
  const pad = (hi - lo) * 0.05 || 1
  lo -= pad; hi += pad
  const bw = w / ks.length
  ks.forEach((k, i) => {
    const x = i * bw + bw / 2
    const y = (v) => h - (v - lo) / (hi - lo) * h
    const up = k.close >= k.open
    ctx.strokeStyle = ctx.fillStyle = up ? '#f85149' : '#3fb950'
    ctx.beginPath(); ctx.moveTo(x, y(k.high)); ctx.lineTo(x, y(k.low)); ctx.stroke()
    const bh = Math.max(1, Math.abs(y(k.open) - y(k.close)))
    ctx.fillRect(x - bw * 0.3, y(Math.max(k.open, k.close)), bw * 0.6, bh)
  })
}

// 简化分时 canvas
function drawT() {
  const c = tcv.value
  if (!c || !trends.value.length) return
  const ctx = c.getContext('2d')
  const W = c.width = c.clientWidth * (window.devicePixelRatio || 1)
  const H = c.height = 200 * (window.devicePixelRatio || 1)
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1)
  const w = c.clientWidth, h = 200
  ctx.clearRect(0, 0, w, h)
  const ts = trends.value
  let lo = Math.min(...ts.map(t => t.price)), hi = Math.max(...ts.map(t => t.price))
  const pad = (hi - lo) * 0.05 || 1
  lo -= pad; hi += pad
  ctx.strokeStyle = '#58a6ff'
  ctx.beginPath()
  ts.forEach((t, i) => {
    const x = i / (ts.length - 1) * w
    const y = h - (t.price - lo) / (hi - lo) * h
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()
}

// ========== 实盘 ==========
function startLive() {
  stopLive()
  liveEngine.value = new LiveEngine(cur.value.secid)
  liveTick()
  liveTimer = setInterval(liveTick, 3000)
}

function stopLive() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null }
}

async function liveTick() {
  if (!cur.value) return
  try {
    const f = await api.getLiveFrame(cur.value.secid)
    liveQuote.value = f.quote || {}
    liveOn.value = !!(f.quote && f.quote.price != null)
    liveSrc.value = '后端'
    if (f.frame) {
      const r = liveEngine.value.feed(f.frame)
      liveBehavior.value = r.behavior
      liveSignals.value = r.signals
      liveAnoms.value = r.anomalies
    }
  } catch {
    liveSrc.value = '失败'
  }
}

// ========== AI 分析 ==========
async function runLLM() {
  if (!cur.value) return
  llmLoading.value = true
  llmOut.value = ''
  try {
    const d = await api.llmAnalyze({ secid: cur.value.secid, code: cur.value.code, name: cur.value.name, question: '分析这只股票' })
    llmOut.value = d.text || d.summary || JSON.stringify(d)
  } catch (e) {
    llmOut.value = '分析失败: ' + e.message
  }
  llmLoading.value = false
}

// ========== 导航 ==========
function goNav(k) {
  view.value = k
  if (k === 'home') { loadList(1); loadIndices() }
  if (k === 'overview') loadOverview()
  if (k === 'predict') loadPredict()
  if (k === 'live') startLive()
  if (k !== 'live') stopLive()
}

// ========== 轮询 ==========
let pollTimer = null
function startPoll() {
  pollTimer = setInterval(() => {
    if (view.value === 'home' && st.value === 'all' && listItems.value.length) {
      const codes = listItems.value.slice(0, 50).map(x => x.secid || x.code).filter(Boolean).join(',')
      if (codes) api.getQuotes(codes).then(quotes => {
        const map = {}
        quotes.forEach(x => { map[String(x.code || x.secid || '').split('.')[1]] = x })
        listItems.value.forEach(x => {
          const m = map[String(x.code || x.secid || '').split('.')[1]]
          if (m && m.price != null) { x.price = m.price; x.chg = m.chg }
        })
      }).catch(() => {})
    }
    if (view.value === 'detail' && cur.value && detailTab.value === 'live') liveTick()
    if (view.value === 'detail' && cur.value && timeframe.value === 0 && (new Date().getHours() >= 9 && new Date().getHours() <= 15)) {
      // 盘中刷新分时
    }
  }, 10000)
}

onMounted(() => {
  loadList(1)
  loadIndices()
  loadPredict()
  startPoll()
})

onUnmounted(() => {
  stopLive()
  if (pollTimer) clearInterval(pollTimer)
})
</script>
