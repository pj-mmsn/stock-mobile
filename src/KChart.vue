<template>
  <div :class="['kchart', { fs: fullscreen }]">
    <!-- 全屏顶栏 -->
    <div v-if="fullscreen" class="kchart-fsbar">
      <span class="fs-title">{{ fsTitle }}</span>
      <span class="fs-tip">📱 请横置手机看大图</span>
      <button class="fs-close" @click="toggleFs">✕</button>
    </div>
    <!-- 周期 tab -->
    <div class="ktabs">
      <button v-for="t in ktabs" :key="t.klt" :class="{ active: klt === t.klt }" @click="setKlt(t.klt)">{{ t.label }}</button>
      <button class="fs-btn" :title="fullscreen ? '退出全屏' : '全屏'" @click="toggleFs">{{ fullscreen ? '🗗' : '⛶' }}</button>
    </div>
    <!-- 主图 -->
    <div class="kchart-main" ref="mainRef">
      <div v-if="klt !== dataKlt" class="kc-loading">⏳ {{ klt === 0 ? '分时' : '周期' }}数据加载中...</div>
    </div>
    <button v-if="klt !== 0 && showLatest" class="kchart-latest" @click="goLatest" title="回到最新">最新</button>
    <!-- 缩放 -->
    <div v-if="klt !== 0" class="kzoom">
      <button @click="zoom(1.4)" title="放大">🔍+</button>
      <button @click="zoom(1 / 1.4)" title="缩小">🔍-</button>
      <button @click="goLatest" title="复位">复原</button>
    </div>
    <!-- 副图切换 -->
    <div v-if="klt !== 0" class="ksub-tabs">
      <button v-for="s in subtabs" :key="s.key" :class="{ on: sub === s.key }" @click="setSub(s.key)">{{ s.label }}</button>
    </div>
    <!-- 副图 -->
    <div class="kchart-sub" ref="subRef"></div>
    <!-- OHLC -->
    <div v-if="klt !== 0" class="kohlc">
      <span class="kohlc-time">{{ ohlc.time || '' }}</span>
      <span>开 {{ fmt(ohlc.open) }}</span>
      <span>高 <b style="color:#f85149">{{ fmt(ohlc.high) }}</b></span>
      <span>低 <b style="color:#3fb950">{{ fmt(ohlc.low) }}</b></span>
      <span>收 <b style="color:#f85149">{{ fmt(ohlc.close) }}</b></span>
      <span style="margin-left:auto">量 {{ fmtVol(ohlc.vol) }}</span>
      <span :style="{ color: ohlc.pct >= 0 ? '#f85149' : '#3fb950' }">{{ fmtPct(ohlc.pct) }}</span>
    </div>
    <!-- 图例 -->
    <div class="klegend">
      <span style="color:#f0c929">MA{{ maList.join('/') }}</span>
      <span style="color:#58a6ff">BOLL</span>
      <span style="color:#8b949e;margin-left:auto">最新 {{ lastClose }}</span>
    </div>
    <div v-if="klt !== 0" class="klegend">
      <span v-if="sub === 'macd'" style="color:#e040fb">MACD</span>
      <span v-if="sub === 'kdj'" style="color:#f0c929">KDJ</span>
      <span v-if="sub === 'rsi'" style="color:#e040fb">RSI14</span>
    </div>
    <!-- 行为段 -->
    <div v-if="behSegs && behSegs.length" class="beh-bar" :title="behSegs.map(s => s.state + ' ' + s.from + '-' + s.to).join('\n')">
      <span v-for="(s, i) in behSegs" :key="i" class="beh-seg" :style="{ background: behColor(s.state), width: (100 / behSegs.length) + '%' }"></span>
    </div>
  </div>
</template>

<script setup>
// KChart.vue —— 原版还原（dist 反编译 2026-08-18），lightweight-charts 主图+副图
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { createChart, ColorType } from 'lightweight-charts'

const props = defineProps({
  klines: Array, indicators: Object, trends: Array, fsTitle: String,
  paict: Object, holdPrice: Number, supportLines: Array,
  timeframe: Number, dataKlt: Number, ydayTrends: Array,
  predLines: Object, behSegs: Array, limits: Object,
  mode: { type: String, default: 'swing' },
})
const emit = defineEmits(['timeframe'])

const MA_CFG = { short: [5, 10, 20], swing: [5, 10, 20, 60], long: [20, 60, 120, 250] }
const maList = computed(() => MA_CFG[props.mode] || [5, 10, 20, 60])
const ktabs = [
  { klt: 0, label: '分时' }, { klt: 101, label: '日K' }, { klt: 102, label: '周K' }, { klt: 103, label: '月K' },
]
const MA_COLORS = { 5: '#f0c929', 10: '#ff8c00', 20: '#e040fb', 60: '#58a6ff' }

const klt = ref(props.timeframe ?? 101)
const mainRef = ref(null)
const subRef = ref(null)
const fullscreen = ref(false)
const ohlc = ref({ time: '', open: 0, high: 0, low: 0, close: 0, vol: 0, pct: 0 })
const showLatest = ref(false)
const sub = ref('macd')
const subtabs = [
  { key: 'macd', label: 'MACD' }, { key: 'kdj', label: 'KDJ' }, { key: 'rsi', label: 'RSI' },
]

let main = null, subChart = null, candleSeries = null, volSeries = null
let maSeries = {}, bollSeries = { upper: null, mid: null, lower: null }
let subSeries = { dif: null, dea: null, bar: null, k: null, d: null, j: null, r14: null, r6: null }
let priceSeries = null, avgSeries = null, volAreaSeries = null, ydaySeries = null
let latestLine = null, resizeObs = null
let lastKlen = 0, lastKlt = null, lastMode = null, lastSig = ''
let timeIndex = new Map()

const fmt = (v) => (v == null || isNaN(v) ? '--' : (+v).toFixed(2))
const fmtVol = (v) => (v == null || isNaN(v) ? '--' : v >= 1e8 ? (v / 1e8).toFixed(2) + '亿手' : (v / 1e4).toFixed(0) + '万手')
const fmtPct = (v) => (v == null || isNaN(v) ? '--' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%')

const lastClose = computed(() => {
  const ks = props.klines
  if (!ks || !ks.length) return '--'
  const last = ks[ks.length - 1]
  return last ? last.close.toFixed(2) : '--'
})

const behColor = (s) => ({ ACC: '#58a6ff', PUMP: '#f85149', WASH: '#d29922', DIST: '#3fb950', DUMP: '#bc8cff', WATCH: '#21262d' }[s] || '#21262d')
const behEmoji = (s) => ({ ACC: '🐋', PUMP: '🚀', WASH: '🌊', DIST: '📉', DUMP: '🎭' }[s] || '')

function sigKey() {
  const lv = (props.paict && props.paict.levels || []).map(x => x.type + ':' + x.price).join(',')
  const sl = (props.supportLines || []).map(x => x.price + ':' + (x.label || '') + ':' + (x.color || '')).join(',')
  return lv + '|' + (props.holdPrice || 0) + '|' + sl
}

function maLast(n) {
  const arr = props.indicators && props.indicators.ma ? props.indicators.ma[n] : null
  if (!arr || !arr.length) return '--'
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i].toFixed(2)
  return '--'
}
function bollLast() {
  const arr = props.indicators && props.indicators.boll ? props.indicators.boll.upper : null
  if (!arr || !arr.length) return '--'
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i].toFixed(2)
  return '--'
}
const trendLast = computed(() => props.trends && props.trends.length && props.trends[props.trends.length - 1].price != null ? props.trends[props.trends.length - 1].price.toFixed(2) : '--')
const trendAvg = computed(() => {
  const t = props.trends && props.trends[props.trends.length - 1]
  return t ? (t.avg != null ? t.avg.toFixed(2) : t.price != null ? t.price.toFixed(2) : '--') : '--'
})

// 分时 vs 昨收涨跌
const vsYday = computed(() => {
  const z = props.trends, j = props.klines
  if (!(z && z.length) || !(j && j.length)) return { text: '--', color: '#8b949e' }
  const p = z[z.length - 1].price
  if (p == null || isNaN(p)) return { text: '--', color: '#8b949e' }
  const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
  const lastK = j[j.length - 1]
  const base = lastK.time === today && j.length > 1 ? j[j.length - 2].close : lastK.close
  if (!base) return { text: '--', color: '#8b949e' }
  const pct = (p - base) / base * 100
  return { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`, color: pct >= 0 ? '#f85149' : '#3fb950' }
})

watch(() => props.timeframe, (v) => {
  if (v != null && v !== klt.value) { klt.value = v; nextTick(() => render()) }
})

function setKlt(v) {
  klt.value = v
  emit('timeframe', v)
  nextTick(() => render())
}

function toggleFs() {
  fullscreen.value = !fullscreen.value
  try {
    if (fullscreen.value && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {})
  } catch {}
  nextTick(() => resizeCharts())
}

function zoom(f) {
  if (!main) return
  if (klt.value === 0) { main.timeScale().setVisibleLogicalRange({ from: 0, to: 245 }); return }
  const ts = main.timeScale()
  const range = ts.getVisibleLogicalRange()
  const mid = range ? (range.from + range.to) / 2 : null
  const bs = ts.options().barSpacing || 3.5
  const nbs = Math.min(40, Math.max(0.5, bs * f))
  ts.applyOptions({ barSpacing: nbs })
  if (subChart) subChart.timeScale().applyOptions({ barSpacing: nbs })
  if (mid != null && range) {
    const half = (range.to - range.from) / f
    ts.setVisibleLogicalRange({ from: mid - half / 2, to: mid + half / 2 })
    if (subChart) subChart.timeScale().setVisibleLogicalRange({ from: mid - half / 2, to: mid + half / 2 })
  }
}

function goLatest() {
  if (!main || !props.klines.length) return
  const n = props.klines.length
  main.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 5 })
  showLatest.value = false
}

function initCharts() {
  if (!mainRef.value) return
  const bg = '#0d1117', fg = '#8b949e', grid = '#1c2128'
  const pad = (v) => String(v).padStart(2, '0')
  const fmtTime = (t) => {
    if (t == null) return ''
    if (typeof t === 'string') return klt.value === 0 ? t.slice(2) : t.slice(5)
    if (typeof t === 'object') return klt.value === 0 ? `${String(t.year).slice(2)}-${pad(t.month)}-${pad(t.day)}` : `${t.month}-${pad(t.day)}`
    if (typeof t === 'number' && t < 1e4 && props.trends && props.trends.length) {
      const tr = props.trends[t]
      return tr ? tr.time : ''
    }
    const d = new Date(t * 1000 + 8 * 3600 * 1000)
    return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  }
  const tsOpts = { borderColor: '#30363d', timeVisible: true, rightOffset: 8, barSpacing: 1, minBarSpacing: 0.1, tickMarkFormatter: fmtTime }
  main = createChart(mainRef.value, {
    layout: { background: { type: ColorType.Solid, color: bg }, textColor: fg, attributionLogo: false },
    grid: { vertLines: { color: grid }, horzLines: { color: grid } },
    crosshair: { mode: 1 },
    rightPriceScale: { borderColor: '#30363d', scaleMargins: { top: 0.05, bottom: 0.25 } },
    timeScale: tsOpts, localization: { timeFormatter: fmtTime },
    width: mainRef.value.clientWidth, height: mainRef.value.clientHeight,
  })
  if (subRef.value) {
    subChart = createChart(subRef.value, {
      layout: { background: { type: ColorType.Solid, color: bg }, textColor: fg },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#30363d', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: tsOpts, localization: { timeFormatter: fmtTime },
      width: mainRef.value.clientWidth, height: subRef.value.clientHeight,
    })
  }
  // 联动
  let syncing = false
  main.timeScale().subscribeVisibleLogicalRangeChange((r) => {
    if (syncing || !subChart || !r) return
    syncing = true; subChart.timeScale().setVisibleLogicalRange(r); syncing = false
  })
  if (subChart) subChart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
    if (syncing || !main || !r) return
    syncing = true; main.timeScale().setVisibleLogicalRange(r); syncing = false
  })
  main.priceScale('right').applyOptions({ minimumWidth: 70 })
  if (subChart) subChart.priceScale('right').applyOptions({ minimumWidth: 70 })
  main.subscribeCrosshairMove((p) => {
    if (!candleSeries || !p.time || !candleSeries.seriesType) return
    const sd = p.seriesData.get(candleSeries)
    if (!sd) return
    const idx = timeIndex.get(p.time)
    const prev = idx != null && idx > 0 ? props.klines[idx - 1] : null
    const pct = prev ? (sd.close - prev.close) / prev.close * 100 : 0
    ohlc.value = { time: p.time, open: sd.open, high: sd.high, low: sd.low, close: sd.close, vol: sd.volume, pct: +pct.toFixed(2) }
  })
  main.timeScale().subscribeVisibleLogicalRangeChange((r) => {
    if (!r || !candleSeries || !props.klines.length) return
    showLatest.value = r.to < props.klines.length - 10
  })
}

function clearMain() {
  const all = []
  if (candleSeries) all.push(candleSeries)
  if (volSeries) all.push(volSeries)
  for (const k of maList.value) if (maSeries[k]) all.push(maSeries[k])
  for (const k of ['upper', 'mid', 'lower']) if (bollSeries[k]) all.push(bollSeries[k])
  if (priceSeries) all.push(priceSeries)
  if (avgSeries) all.push(avgSeries)
  if (volAreaSeries) all.push(volAreaSeries)
  all.forEach(s => { try { main.removeSeries(s) } catch {} })
  candleSeries = null; volSeries = null; maSeries = {}; bollSeries = { upper: null, mid: null, lower: null }
  priceSeries = null; avgSeries = null; volAreaSeries = null; latestLine = null
  lastKlen = 0; timeIndex = new Map()
}

function clearSub() {
  const all = []
  if (subSeries.dif) all.push(subSeries.dif); if (subSeries.dea) all.push(subSeries.dea); if (subSeries.bar) all.push(subSeries.bar)
  if (subSeries.k) all.push(subSeries.k); if (subSeries.d) all.push(subSeries.d); if (subSeries.j) all.push(subSeries.j)
  if (subSeries.r14) all.push(subSeries.r14); if (subSeries.r6) all.push(subSeries.r6)
  all.forEach(s => { try { subChart.removeSeries(s) } catch {} })
  subSeries = { dif: null, dea: null, bar: null, k: null, d: null, j: null, r14: null, r6: null }
}

// 分时渲染
function renderTrends() {
  clearMain(); clearSub()
  const z = props.trends
  if (!main || !(z && z.length)) return
  priceSeries = main.addAreaSeries({ lineColor: '#f0c929', topColor: 'rgba(240,201,41,0.25)', bottomColor: 'rgba(240,201,41,0.02)', lineWidth: 2, priceLineVisible: false })
  avgSeries = main.addLineSeries({ color: '#58a6ff', lineWidth: 1, priceLineVisible: false })
  volAreaSeries = main.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' })
  volAreaSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
  priceSeries.setData(z.map((t, i) => ({ time: i, value: t.price })))
  avgSeries.setData(z.map((t, i) => t.avg != null ? { time: i, value: t.avg } : null).filter(Boolean))
  volAreaSeries.setData(z.map((t, i) => ({ time: i, value: t.volume, color: t.price >= t.avg ? '#f8514933' : '#3fb95033' })))
  if (props.ydayTrends && props.ydayTrends.length) {
    const map = new Map(z.map((t, i) => [t.time, i]))
    ydaySeries = main.addLineSeries({ color: '#484f58', lineWidth: 1, priceLineVisible: false, lineStyle: 2 })
    ydaySeries.setData(props.ydayTrends.map(t => {
      const idx = map.get(t.time)
      return idx != null ? { time: idx, value: t.price } : null
    }).filter(Boolean))
  }
  addPredLines()
  try { main.timeScale().applyOptions({ barSpacing: 1 }); if (subChart) subChart.timeScale().applyOptions({ barSpacing: 1 }) } catch {}
  main.timeScale().setVisibleLogicalRange({ from: 0, to: 245 })
  ;[100, 400, 1200].forEach(ms => setTimeout(() => { try { main && main.timeScale().setVisibleLogicalRange({ from: 0, to: 245 }) } catch {} }, ms))
}

function addPredLines() {
  const p = props.predLines || {}
  const mk = (price, color, title) => {
    if (price == null || price <= 0) return
    if (priceSeries) priceSeries.createPriceLine({ price, color, lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title })
    if (candleSeries) candleSeries.createPriceLine({ price, color, lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title })
  }
  if (p.entry) mk(p.entry, '#a371f7', '预测入场')
  if (p.stop) mk(p.stop, '#d29922', '止损')
  if (p.target) mk(p.target, '#ff7b72', '目标')
  if (props.holdPrice) mk(props.holdPrice, '#39c5cf', '成本')
  const lim = props.limits || {}
  if (lim.high) mk(lim.high, '#f8514966', '涨停')
  if (lim.low) mk(lim.low, '#3fb95066', '跌停')
}

// K线渲染
function renderKlines() {
  if (!main || !props.klines.length) return
  const z = props.klines, j = props.indicators || {}
  const n = z.length, mode = props.mode || 'swing'
  const multiYear = String(z[0]?.time || '').slice(0, 4) !== String(z[n - 1]?.time || '').slice(0, 4)
  // 增量更新判断
  const same = (a, b) => a && b && a.time === b.time && a.open === b.open && a.high === b.high && a.low === b.low && a.close === b.close && a.volume === b.volume
  const tailSame = (skip) => {
    for (let i = skip; i < 5; i++) {
      const idx = lastKlen - 1 - i
      if (idx < 0) return false
      if (!same(norm(z[idx]), lastTail[4 - i])) return false
    }
    return true
  }
  if (candleSeries && lastKlt === klt.value && lastMode === mode && n >= lastKlen && lastSig === sigKey()) {
    if (n > lastKlen && tailSame(0)) { appendKlines(z, j, lastKlen); return }
    if (n === lastKlen && tailSame(1)) { appendKlines(z, j, n - 1); return }
  }
  const ts = main.timeScale()
  let range = null, bs = 3.5, base = 0
  const keepView = lastKlt === klt.value && lastMode === mode && lastKlen > 0
  if (keepView) { range = ts.getVisibleLogicalRange(); bs = ts.options().barSpacing || 3.5; base = lastKlen }
  clearMain(); clearSub()
  candleSeries = main.addCandlestickSeries({ upColor: '#f85149', downColor: '#3fb950', borderUpColor: '#f85149', borderDownColor: '#3fb950', wickUpColor: '#f85149', wickDownColor: '#3fb950' })
  volSeries = main.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' })
  volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
  for (const k of maList.value) maSeries[k] = main.addLineSeries({ color: MA_COLORS[k], lineWidth: 1, priceLineVisible: false })
  bollSeries.upper = main.addLineSeries({ color: '#58a6ff', lineWidth: 1, priceLineVisible: false, lineStyle: 2 })
  bollSeries.mid = main.addLineSeries({ color: '#8b949e', lineWidth: 1, priceLineVisible: false, lineStyle: 2 })
  bollSeries.lower = main.addLineSeries({ color: '#58a6ff', lineWidth: 1, priceLineVisible: false, lineStyle: 2 })
  renderSub(z, j)
  timeIndex = new Map(z.map((k, i) => [k.time, i]))
  candleSeries.setData(z.map(k => ({ time: k.time, open: k.open, high: k.high, low: k.low, close: k.close })))
  const last = z[z.length - 1]
  if (last) {
    const pct = z.length > 1 ? (last.close - z[z.length - 2].close) / z[z.length - 2].close * 100 : 0
    latestLine = candleSeries.createPriceLine({ price: last.close, color: pct >= 0 ? '#f85149' : '#3fb950', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: '最新' })
    ohlc.value = { time: last.time, open: last.open, high: last.high, low: last.low, close: last.close, vol: last.volume, pct: +pct.toFixed(2) }
  }
  // 支撑/阻力/持仓
  const pc = props.paict
  if (pc && pc.levels && pc.levels.length) pc.levels.forEach(lv => {
    candleSeries.createPriceLine({ price: lv.price, color: lv.type === 'support' ? '#3fb950' : '#f85149', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: lv.type === 'support' ? '支撑' : '阻力' })
  })
  if (props.holdPrice && props.holdPrice > 0) candleSeries.createPriceLine({ price: props.holdPrice, color: '#f0c929', lineWidth: 2, lineStyle: 1, axisLabelVisible: true, title: '持仓' })
  if (props.supportLines && props.supportLines.length) props.supportLines.forEach(sl => {
    candleSeries.createPriceLine({ price: sl.price, color: sl.color || '#58a6ff', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: sl.label })
  })
  addPredLines()
  volSeries.setData(z.map(k => ({ time: k.time, value: k.volume, color: k.close >= k.open ? '#f8514933' : '#3fb95033' })))
  for (const k of maList.value) {
    const arr = (j.ma && j.ma[k]) || []
    maSeries[k].setData(z.map((kk, i) => arr[i] != null ? { time: kk.time, value: arr[i] } : null).filter(Boolean))
  }
  const bollAt = (key) => ((j.boll && j.boll[key]) || []).map((v, i) => v != null ? { time: z[i].time, value: v } : null).filter(Boolean)
  bollSeries.upper.setData(bollAt('upper')); bollSeries.mid.setData(bollAt('mid')); bollSeries.lower.setData(bollAt('lower'))
  if (range && keepView) {
    const diff = n - base
    try {
      ts.applyOptions({ barSpacing: bs }); if (subChart) subChart.timeScale().applyOptions({ barSpacing: bs })
      ts.setVisibleLogicalRange({ from: Math.max(-2, range.from + diff), to: range.to + diff })
    } catch { fitView(n) }
  } else fitView(n)
  lastKlen = n; lastKlt = klt.value; lastMode = mode; lastTail = z.slice(-5).map(norm); lastSig = sigKey()
}

let lastTail = []

function norm(k) { return k ? { time: k.time, open: k.open, high: k.high, low: k.low, close: k.close, volume: k.volume } : null }

function appendKlines(z, j, from) {
  const last = z[z.length - 1]
  for (let i = from; i < z.length; i++) {
    const k = z[i]
    candleSeries.update({ time: k.time, open: k.open, high: k.high, low: k.low, close: k.close })
    volSeries.update({ time: k.time, value: k.volume, color: k.close >= k.open ? '#f8514933' : '#3fb95033' })
    timeIndex.set(k.time, i)
    for (const m of maList.value) {
      const v = j.ma && j.ma[m] ? j.ma[m][i] : null
      maSeries[m].update(v != null ? { time: k.time, value: v } : { time: k.time })
    }
    const bv = (key) => j.boll && j.boll[key] ? j.boll[key][i] : null
    bollSeries.upper.update(bv('upper') != null ? { time: k.time, value: bv('upper') } : { time: k.time })
    bollSeries.mid.update(bv('mid') != null ? { time: k.time, value: bv('mid') } : { time: k.time })
    bollSeries.lower.update(bv('lower') != null ? { time: k.time, value: bv('lower') } : { time: k.time })
    if (sub === 'kdj') {
      subSeries.k.update({ time: k.time, value: (j.kdj && j.kdj.k ? j.kdj.k[i] : 0) ?? 0 })
      subSeries.d.update({ time: k.time, value: (j.kdj && j.kdj.d ? j.kdj.d[i] : 0) ?? 0 })
      subSeries.j.update({ time: k.time, value: (j.kdj && j.kdj.j ? j.kdj.j[i] : 0) ?? 0 })
    } else if (sub === 'rsi') {
      const r14 = j.rsi && j.rsi[14] ? j.rsi[14][i] : null, r6 = j.rsi && j.rsi[6] ? j.rsi[6][i] : null
      subSeries.r14.update(r14 != null ? { time: k.time, value: r14 } : { time: k.time })
      subSeries.r6.update(r6 != null ? { time: k.time, value: r6 } : { time: k.time })
    } else {
      const dif = j.macd && j.macd.dif ? j.macd.dif[i] : null
      const dea = j.macd && j.macd.dea ? j.macd.dea[i] : null
      const bar = j.macd && j.macd.bar ? j.macd.bar[i] : null
      subSeries.dif.update({ time: k.time, value: dif ?? 0 })
      subSeries.dea.update({ time: k.time, value: dea ?? 0 })
      subSeries.bar.update({ time: k.time, value: bar ?? 0, color: (bar || 0) >= 0 ? '#f8514966' : '#3fb95066' })
    }
  }
  if (latestLine) { try { candleSeries.removePriceLine(latestLine) } catch {} }
  const pct = z.length > 1 ? (last.close - z[z.length - 2].close) / z[z.length - 2].close * 100 : 0
  latestLine = candleSeries.createPriceLine({ price: last.close, color: pct >= 0 ? '#f85149' : '#3fb950', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: '最新' })
  ohlc.value = { time: last.time, open: last.open, high: last.high, low: last.low, close: last.close, vol: last.volume, pct: +pct.toFixed(2) }
  lastKlen = z.length; lastTail = z.slice(-5).map(norm)
}

function renderSub(z, j) {
  if (!subChart) return
  const toData = (arr) => z.map((k, i) => arr[i] != null ? { time: k.time, value: arr[i] } : { time: k.time, value: 0 })
  const toData2 = (arr) => z.map((k, i) => arr[i] != null ? { time: k.time, value: arr[i] } : null).filter(Boolean)
  if (sub.value === 'kdj') {
    subSeries.k = subChart.addLineSeries({ color: '#f0c929', lineWidth: 1, priceLineVisible: false })
    subSeries.d = subChart.addLineSeries({ color: '#58a6ff', lineWidth: 1, priceLineVisible: false })
    subSeries.j = subChart.addLineSeries({ color: '#e040fb', lineWidth: 1, priceLineVisible: false })
    subSeries.k.setData(toData((j.kdj && j.kdj.k) || []))
    subSeries.d.setData(toData((j.kdj && j.kdj.d) || []))
    subSeries.j.setData(toData((j.kdj && j.kdj.j) || []))
  } else if (sub.value === 'rsi') {
    subSeries.r14 = subChart.addLineSeries({ color: '#e040fb', lineWidth: 1, priceLineVisible: false })
    subSeries.r6 = subChart.addLineSeries({ color: '#f0c929', lineWidth: 1, priceLineVisible: false })
    subSeries.r14.setData(toData2((j.rsi && j.rsi[14]) || []))
    subSeries.r6.setData(toData2((j.rsi && j.rsi[6]) || []))
  } else {
    subSeries.dif = subChart.addLineSeries({ color: '#e040fb', lineWidth: 1, priceLineVisible: false })
    subSeries.dea = subChart.addLineSeries({ color: '#f0c929', lineWidth: 1, priceLineVisible: false })
    subSeries.bar = subChart.addHistogramSeries({ priceLineVisible: false })
    const dif = (j.macd && j.macd.dif) || [], dea = (j.macd && j.macd.dea) || [], bar = (j.macd && j.macd.bar) || []
    subSeries.dif.setData(toData(dif)); subSeries.dea.setData(toData(dea))
    subSeries.bar.setData(toData(bar).map(x => ({ ...x, color: x.value >= 0 ? '#f8514966' : '#3fb95066' })))
  }
}

function setSub(v) {
  if (sub.value === v || klt.value === 0) return
  sub.value = v
  nextTick(() => { if (subChart && props.klines.length) { clearSub(); renderSub(props.klines, props.indicators || {}) } })
}

function fitView(n) {
  try {
    main.timeScale().applyOptions({ barSpacing: 3.5 })
    if (subChart) subChart.timeScale().applyOptions({ barSpacing: 3.5 })
  } catch {}
  main.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 5 })
  setTimeout(() => { try { main && main.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 5 }) } catch {} }, 100)
}

function render() {
  if (!main) return
  if (klt.value === 0) {
    if (props.dataKlt === 0 && props.trends && props.trends.length) renderTrends()
    else { clearMain(); clearSub() }
  } else {
    if (props.dataKlt === klt.value && props.klines && props.klines.length) renderKlines()
    else { clearMain(); clearSub() }
  }
}

watch(() => props.dataKlt, () => nextTick(render))
watch(() => props.klines, () => nextTick(render), { deep: true })
watch(() => props.trends, () => nextTick(render), { deep: true })
watch(() => props.paict, () => nextTick(render), { deep: true })

function resizeCharts() {
  if (main && mainRef.value) {
    const r = mainRef.value.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) main.resize(r.width, r.height)
  }
  if (subChart && subRef.value) {
    const r = subRef.value.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) subChart.resize(r.width, r.height)
  }
}

onMounted(() => {
  nextTick(() => { initCharts(); render() })
  window.addEventListener('resize', resizeCharts)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(() => {
      resizeCharts()
      const w = mainRef.value ? mainRef.value.clientWidth : 0
      if (w > 0) nextTick(render)
    })
    if (mainRef.value) resizeObs.observe(mainRef.value)
    if (subRef.value) resizeObs.observe(subRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCharts)
  if (resizeObs) { resizeObs.disconnect(); resizeObs = null }
  if (main) { main.remove(); main = null }
  if (subChart) { subChart.remove(); subChart = null }
})
</script>
