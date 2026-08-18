// src/api.js —— 全部后端接口封装 + 直连兜底（按 v55 dist 反编译重建 2026-08-18）
// 前端只调后端；K线/涨停池有直连兜底；预测/列表走 IDB 缓存（key = 名称_日期）

export const kc = { API: 'api', TX: 'tencent', EM: 'eastmoney', SINA: 'sina', DELAY: 'delay' }

const _json = async (url, opt = {}) => {
  const res = await fetch(url, opt)
  if (!res.ok) throw new Error(url + ' ' + res.status)
  return res.json()
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const isTrading = () => {
  const d = new Date()
  if (d.getDay() === 0 || d.getDay() === 6) return false
  const m = d.getHours() * 60 + d.getMinutes()
  return m >= 9 * 60 + 15 && m <= 15 * 60 + 5
}

// ============ IDB 缓存层（collections store：key → {data, ts}） ============
let _db = null
const openDB = () => new Promise((resolve, reject) => {
  if (_db) return resolve(_db)
  const req = indexedDB.open('stock-mobile', 3)
  req.onupgradeneeded = (e) => {
    const db = e.target.result
    try { db.objectStoreNames.contains('klines') && db.deleteObjectStore('klines') } catch {}
    db.objectStoreNames.contains('stocks') || db.createObjectStore('stocks', { keyPath: 'secid' })
    db.objectStoreNames.contains('collections') || db.createObjectStore('collections', { keyPath: 'key' })
  }
  req.onsuccess = () => { _db = req.result; resolve(_db) }
  req.onerror = () => reject(req.error)
})
const idbGet = async (key) => {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const r = db.transaction('collections', 'readonly').objectStore('collections').get(key)
      r.onsuccess = () => resolve(r.result ? { data: r.result.data, ts: r.result.ts } : null)
      r.onerror = () => resolve(null)
    })
  } catch { return null }
}
const idbSet = async (key, data) => {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const r = db.transaction('collections', 'readwrite').objectStore('collections').put({ key, data, ts: Date.now() })
      r.oncomplete = () => resolve()
      r.onerror = () => resolve()
    })
  } catch {}
}

// 通用缓存封装：内存 Map + IDB 双级，key = name_日期；force=true 跳过缓存
const _mem = new Map()
const _inflight = new Set()
export async function cached(name, fetcher, force = false) {
  const key = name + '_' + today()
  if (!force) {
    const m = _mem.get(key)
    if (m) { refreshAsync(name, fetcher); return m.data }
    try {
      const c = await idbGet(key)
      if (c != null) { _mem.set(key, c); refreshAsync(name, fetcher); return c.data }
    } catch {}
  }
  let data = null
  try { data = typeof fetcher === 'function' ? await fetcher() : await fetcher } catch { data = null }
  if (data != null) {
    _mem.set(key, { data, ts: Date.now() })
    idbSet(key, data).catch(() => {})
  } else {
    const m = _mem.get(key)
    if (m) return m.data
  }
  return data
}
function refreshAsync(name, fetcher) {
  const key = name + '_' + today()
  if (_inflight.has(key)) return
  _inflight.add(key)
  ;(async () => {
    try {
      const data = typeof fetcher === 'function' ? await fetcher() : await fetcher
      if (data != null) { _mem.set(key, { data, ts: Date.now() }); idbSet(key, data).catch(() => {}) }
    } catch {}
    finally { _inflight.delete(key) }
  })()
}

// ============ 基础接口 ============
export const getPing = () => _json('/api/ping')

// 实时行情（批量）
export async function getQuotes(codes) {
  if (!codes || !codes.length) return []
  const t = Array.isArray(codes) ? codes.join(',') : codes
  try {
    const d = await _json('/api/quotes?codes=' + t, { signal: AbortSignal.timeout(6000), cache: 'no-store' })
    return Array.isArray(d) ? d : (d.items || d.quotes || [])
  } catch { return [] }
}

// 单只实时行情（多源降级：后端 → 腾讯 → 东财延迟）
export async function getRealtimeQuote(code) {
  const secid = code.includes('.') ? code : (code.startsWith('6') ? '1.' + code : '0.' + code)
  try {
    const list = await getQuotes([secid])
    if (list && list[0] && list[0].price != null) return { ...list[0], src: kc.API }
  } catch {}
  try {
    // 腾讯直连兜底
    const r = await fetch(`https://qt.gtimg.cn/q=${secid.startsWith('1.') ? 'sh' : 'sz'}${secid.split('.')[1]}`, { signal: AbortSignal.timeout(6000) })
    const txt = await r.text()
    const m = txt.match(/="([^"]+)"/)
    if (m) {
      const f = m[1].split('~')
      return { src: kc.TX, code: secid, name: f[1], price: +f[3], chgPct: +f[32], open: +f[5], high: +f[33], low: +f[34], preClose: +f[4], volume: +f[6], amount: +f[37], turnover: +f[38], pe: +f[39], marketCap: +f[44], floatCap: +f[45] }
    }
  } catch {}
  try {
    const d = await _json(`/api/proxy?url=` + encodeURIComponent(`https://push2delay.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f57,f58,f169,f170,f46,f44,f51,f52,f60,f116,f117,f162,f167,f168`), { signal: AbortSignal.timeout(15000) })
    const q = d && d.data
    if (q) return { src: kc.DELAY, code: secid, name: q.f58, price: q.f43 / 100, chgPct: q.f170 / 100, open: q.f46 / 100, high: q.f44 / 100, low: q.f45 / 100, preClose: q.f60 / 100, volume: q.f47, amount: q.f48, turnover: q.f168 / 100, pe: q.f162 / 100, pb: q.f167 / 100, marketCap: q.f116, floatCap: q.f117 }
  } catch {}
  throw new Error('实时行情获取失败: ' + secid)
}

// ============ K线 ============
// 后端 /api/klines（优先）→ 腾讯 qfq 直连兜底（分页拼接）
export async function getKlines(secid, klt = 101, start = '') {
  try {
    const c = new AbortController()
    const timer = setTimeout(() => c.abort(), 8000)
    const r = await fetch(`/api/klines?secid=${secid}&klt=${klt}&start=${encodeURIComponent(start)}`, { signal: c.signal })
    clearTimeout(timer)
    if (r.ok) {
      const d = await r.json()
      const k = (d && d.klines) || []
      if (k.length && k[0] && k[0].time) return k
    }
  } catch {}
  try {
    const [mkt, code] = secid.split('.')
    const prefix = mkt === '1' ? 'sh' : 'sz'
    const unit = klt === 102 ? 'week' : klt === 103 ? 'month' : 'day'
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${prefix}${code},${unit},${start},,800,qfq`
    const d = await _json(url, { signal: AbortSignal.timeout(6000) })
    const node = d && d.data && (d.data[prefix + code] || {})
    const arr = node['qfq' + unit] || node[unit] || []
    return arr.filter((x) => !start || x[0] >= start).map((x) => ({ time: x[0], open: +x[1], close: +x[2], high: +x[3], low: +x[4], volume: +x[5] }))
  } catch { return [] }
}

// 分时
export const getTrends = (secid) => _json(`/api/trends?secid=${secid}`, { signal: AbortSignal.timeout(8000) })

// ============ 涨停池/炸板池/历史 ============
const EM_UT = '7eea3edcaed734bea9cbfc24409ed989'
const ymd = () => {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export async function getZtPool(force = false) {
  return cached('ztpool', async () => {
    try {
      const d = await _json('/api/zt-pool', { signal: AbortSignal.timeout(8000), cache: 'no-store' })
      if (d && Array.isArray(d.items) && d.items.length) return d
    } catch {}
    // 东财直连兜底
    try {
      const r = await fetch(`https://push2ex.eastmoney.com/getTopicZTPool?ut=${EM_UT}&dpt=wz.ztzt&Pageindex=0&pagesize=400&sort=fbt%3Aasc&date=${ymd()}`)
      if (!r.ok) return null
      const n = await r.json()
      const pool = (n && n.data && n.data.pool) || []
      return {
        date: n.data && n.data.qdate,
        total: (n.data && n.data.tc) || pool.length,
        items: pool.map((a) => ({
          code: a.c, name: a.n, price: a.p, change_pct: a.zdp, limitCount: a.lbc || 1,
          seal: a.fund || 0, firstTime: a.fbt, breakCount: a.zbc || 0, industry: a.hybk || '',
          ltsz: a.ltsz ? +(a.ltsz / 1e8).toFixed(1) : null,
          sealRatio: a.fund && a.ltsz ? +(a.fund / a.ltsz * 100).toFixed(1) : null,
        })),
      }
    } catch { return null }
  }, force)
}

export async function getZbPool(force = false) {
  return cached('zbpool', async () => {
    try {
      const d = await _json('/api/zb-pool', { signal: AbortSignal.timeout(8000), cache: 'no-store' })
      if (d && Array.isArray(d.items) && d.items.length) return d
    } catch {}
    try {
      const r = await fetch(`https://push2ex.eastmoney.com/getTopicZBPool?ut=${EM_UT}&dpt=wz.ztzt&Pageindex=0&pagesize=200&sort=zbc%3Adesc&date=${ymd()}`)
      if (!r.ok) return null
      const n = await r.json()
      const pool = (n && n.data && n.data.pool) || []
      return { total: pool.length, items: pool.map((x) => ({ code: x.c, name: x.n, price: x.p, change_pct: x.zdp, breakCount: x.zbc || 0 })) }
    } catch { return null }
  }, force)
}

const LS_ZT_HIST = 'sm_zt_history'
export async function saveZtHistory(d) {
  if (!d || !d.date) return
  try {
    const slim = { date: d.date, items: d.items.map((x) => ({ code: x.code, limitCount: x.limitCount })) }
    const arr = JSON.parse(localStorage.getItem(LS_ZT_HIST) || '[]').filter((x) => x.date !== slim.date)
    arr.push(slim)
    while (arr.length > 30) arr.shift()
    localStorage.setItem(LS_ZT_HIST, JSON.stringify(arr))
    fetch('/api/zt-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(slim) }).catch(() => {})
  } catch {}
}
export async function getZtHistory() {
  try {
    const d = await _json('/api/zt-history', { signal: AbortSignal.timeout(6000), cache: 'no-store' })
    if (Array.isArray(d) && d.length) return d
  } catch {}
  try { return JSON.parse(localStorage.getItem(LS_ZT_HIST) || '[]') } catch { return [] }
}

// 情绪周期：连板梯队/炸板率 → 周期判定
export function computeCycle(zt, zb) {
  if (!zt || !zt.items) return null
  const total = zt.total || 0
  const maxLb = zt.items.reduce((m, x) => Math.max(m, x.limitCount), 0)
  const zbTotal = (zb && zb.total) || 0
  const breakRate = total + zbTotal > 0 ? Math.round(zbTotal / (total + zbTotal) * 100) : 0
  const tiers = { five: 0, four: 0, three: 0, two: 0, one: 0 }
  zt.items.forEach((x) => {
    if (x.limitCount >= 5) tiers.five++
    else if (x.limitCount === 4) tiers.four++
    else if (x.limitCount === 3) tiers.three++
    else if (x.limitCount === 2) tiers.two++
    else tiers.one++
  })
  let cycle = 'flat', label = '观望期', icon = '⚪'
  if (breakRate > 40) { cycle = 'cooling'; label = '退潮期'; icon = '📉' }
  else if (total >= 100 && maxLb >= 5) { cycle = 'high'; label = '高潮期'; icon = '🔥' }
  else if (total >= 60 || maxLb >= 4) { cycle = 'hot'; label = '发酵期'; icon = '🚀' }
  else if (total >= 30) { cycle = 'warm'; label = '启动期'; icon = '🌱' }
  else { cycle = 'cold'; label = '冰点期'; icon = '🥶' }
  const advice = {
    cold: '冰点期：涨停 <30 家，情绪差，别打板，空仓等转暖',
    warm: '启动期：情绪回暖，可轻仓试首板，跟当日最强题材',
    hot: '发酵期：连板接力活跃，可打板跟龙头，破板就走',
    high: '高潮期：情绪亢奋随时退潮，快进快出，尾盘不追高',
    cooling: '退潮期：炸板率 >40%，管住手，别接飞刀',
    flat: '数据不足，观望',
  }[cycle]
  return { cycle, label, icon, total, maxLb, breakRate, advice, tiers }
}

// 行业分布
export function industryStat(zt) {
  if (!zt || !zt.items) return []
  const m = {}
  zt.items.forEach((x) => {
    const ind = x.industry || '其他'
    if (!m[ind]) m[ind] = { count: 0, topName: x.name, topCode: x.code, topPct: x.change_pct }
    m[ind].count++
  })
  return Object.entries(m).map(([industry, v]) => ({ industry, ...v })).sort((a, b) => b.count - a.count)
}

// 连板晋级率：昨日 1/2/3/4 板 → 今日晋级比例
export function advanceRate(cur, hist) {
  if (!cur || !hist || !hist.length) return null
  const prev = hist[hist.length - 1]
  if (!prev || prev.date === cur.date) return null
  const pools = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() }
  prev.items.forEach((x) => {
    if (x.limitCount >= 1 && x.limitCount <= 4) pools[x.limitCount].add(x.code)
  })
  const curMap = {}
  cur.items.forEach((x) => { curMap[x.code] = x.limitCount })
  const names = { 1: '1→2', 2: '2→3', 3: '3→4', 4: '4→5+' }
  const out = []
  for (const k of [1, 2, 3, 4]) {
    if (!pools[k].size) continue
    let n = 0
    pools[k].forEach((code) => { if (curMap[code] && curMap[code] > k) n++ })
    out.push({ from: names[k], rate: Math.round(n / pools[k].size * 100), fromN: pools[k].size, toN: n })
  }
  return out.length ? out : null
}

// ============ 板块判定 ============
export function boardOf(code, name = '') {
  const c = String(code || '')
  const n = String(name || '')
  if (/ST|退/.test(n)) return { board: 'ST', limit: 5, need: 'ST风险警示，涨跌幅仅5%' }
  if (/^(688|689)/.test(c)) return { board: '科创板', limit: 20, need: '需开通权限（50万资产+2年经验）' }
  if (/^(300|301)/.test(c)) return { board: '创业板', limit: 20, need: '需开通权限（10万资产+2年经验）' }
  if (/^(8|43|92)/.test(c)) return { board: '北交所', limit: 30, need: '需开通权限（50万+2年经验）' }
  return { board: '主板', limit: 10, need: null }
}

// ============ 列表/筛选 ============
export async function getList(params = {}, force = false) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v) })
  return cached('list_' + q.toString(), () =>
    _json('/api/list?' + q.toString(), { signal: AbortSignal.timeout(8000), cache: 'no-store' }), force)
}

// RSI 批量查询
export async function getRsi(codes) {
  const t = Array.isArray(codes) ? codes.filter(Boolean).join(',') : codes
  if (!t) return {}
  try {
    const d = await _json('/api/rsi?codes=' + t, { signal: AbortSignal.timeout(4000) })
    return d || {}
  } catch { return {} }
}

// ============ 预测/实时机会 ============
export const getPredict = async (mode = 'swing', force = false) =>
  cached('predict_' + mode, async () => {
    const d = await _json('/api/predict?mode=' + mode, { signal: AbortSignal.timeout(15000), cache: 'no-store' })
    return d && d.items && d.items.length ? d : null
  }, force)

export const getRealtime = async (mode = 'swing', force = false) =>
  _json('/api/realtime?mode=' + mode + (force ? '&force=1' : ''), { signal: AbortSignal.timeout(20000), cache: 'no-store' }).catch(() => null)

// 预测历史（盘前/盘后存档）
export const getHistory = async (force = false) =>
  cached('history', async () => {
    const d = await _json('/api/forecast/history', { signal: AbortSignal.timeout(10000), cache: 'no-store' })
    return (d && d.records) || []
  }, force)

// ============ 实盘帧 ============
export const getLiveFrame = async (code) => {
  const d = await _json(`/api/live-frame?code=${encodeURIComponent(code)}`, { signal: AbortSignal.timeout(12000) })
  return d
}

// ============ 龙虎榜/市场温度 ============
export const getLhb = async () => _json('/api/lhb', { signal: AbortSignal.timeout(8000), cache: 'no-store' }).catch(() => null)
export const getMarketTemp = async () => _json('/api/market-temp', { signal: AbortSignal.timeout(8000), cache: 'no-store' }).catch(() => null)

// ============ 自选/持仓/设置 ============
export const getWatchlist = async () => _json('/api/watchlist', { signal: AbortSignal.timeout(6000) }).catch(() => [])
export const saveWatchlist = async (list) =>
  fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ list }) }).catch(() => {})
export const getHoldings = async () => _json('/api/holdings', { signal: AbortSignal.timeout(6000) }).catch(() => [])
export const saveHoldings = async (list) =>
  fetch('/api/holdings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ list }) }).catch(() => {})
export const getSettings = async () => _json('/api/settings', { signal: AbortSignal.timeout(6000) }).catch(() => ({}))
export const saveSettings = async (s) =>
  fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }).catch(() => {})

// ============ AI 分析 ============
export async function llmAnalyze(params) {
  const body = { ...params }
  return _json('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  }).catch(() => null)
}

// ========== 补齐函数（v55 完整版还原） ==========

export const getQuote = (secid) => _json(`/api/quotes?codes=${secid}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
  .then(d => {
    const code = String(secid).split('.')[1]
    return (d && d[code]) || null
  }).catch(() => null)

export const getDetail = async (secid) => {
  const [q, k, t] = await Promise.all([
    getQuote(secid).catch(() => null),
    getKlines(secid, 101).catch(() => []),
    getTrends(secid).catch(() => []),
  ])
  let indicators = {}, klineAna = null, paict = null
  if (k && k.length > 10) {
    indicators = computeIndicators(k)
    klineAna = computeKlineAna(k, indicators)
    paict = computePaict(k)
  }
  return { quote: q, klines: k, trends: t, indicators, klineAna, paict }
}

export const getMarketStats = async () => _json('/api/market-temp', { signal: AbortSignal.timeout(8000), cache: 'no-store' })
  .then(d => ({ up: d?.up ?? 0, down: d?.down ?? 0 })).catch(() => ({ up: 0, down: 0 }))

export const getIndices = async () => {
  try {
    const d = await _json('/api/quotes?codes=1.000001,0.399001,100.HSI', { signal: AbortSignal.timeout(8000), cache: 'no-store' })
    const out = { sh: 0, sz: 0, hk: 0 }
    if (d) {
      if (d['000001']?.chg != null) out.sh = d['000001'].chg
      if (d['399001']?.chg != null) out.sz = d['399001'].chg
      if (d['HSI']?.chg != null) out.hk = d['HSI'].chg
    }
    return out
  } catch { return { sh: 0, sz: 0, hk: 0 } }
}

export const getSectors = async () => _json('/api/proxy?url=' + encodeURIComponent('https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=30&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f12,f14,f104,f105,f128,f140'), { signal: AbortSignal.timeout(8000) })
  .then(d => (d?.data?.diff || []).map(x => ({ name: x.f14, count: x.f104, flow: x.f62, code: x.f12 }))).catch(() => [])

export const getConcepts = async () => _json('/api/proxy?url=' + encodeURIComponent('https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=30&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:3&fields=f2,f3,f12,f14,f104,f105,f128,f140'), { signal: AbortSignal.timeout(8000) })
  .then(d => (d?.data?.diff || []).map(x => ({ name: x.f14, count: x.f104, flow: x.f62, code: x.f12 }))).catch(() => [])

export const getFundSectors = getSectors
export const getFundConcepts = getConcepts

export const rsiScan = (range, limit = 200) => _json(`/api/rsi-scan?range=${range}&limit=${limit}`, { signal: AbortSignal.timeout(15000), cache: 'no-store' })
  .then(d => ({ items: d?.items || [], total: d?.total || 0 })).catch(() => ({ items: [], total: 0 }))

export const getSectorStocks = async (code) => {
  if (!code) return []
  const url = encodeURIComponent(`https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=1&np=1&fltt=2&invt=2&fid=f3&fs=b:${code}&fields=f2,f3,f12,f14`)
  const d = await _json('/api/proxy?url=' + url, { signal: AbortSignal.timeout(10000) }).catch(() => null)
  return (d?.data?.diff || []).map(x => ({
    code: String(x.f12), name: x.f14, price: x.f2, change_pct: x.f3,
    secid: (String(x.f12).startsWith('6') || String(x.f12).startsWith('9') ? '1.' : '0.') + x.f12,
  }))
}

// ========== 指标计算（K线可推导，与后端同口径） ==========

function ma(arr, n) {
  const out = []
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
    if (i >= n) sum -= arr[i - n]
    out.push(i >= n - 1 ? sum / n : null)
  }
  return out
}

function ema(arr, n) {
  const out = []
  let prev = null
  const k = 2 / (n + 1)
  for (let i = 0; i < arr.length; i++) {
    prev = prev == null ? arr[i] : arr[i] * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

// ============ 回测 ============
export const getBacktest = async (params) =>
  _json('/api/backtest?' + new URLSearchParams(params).toString(), { signal: AbortSignal.timeout(120000), cache: 'no-store' }).catch(() => null)

// ============ 搜索 ============
export async function searchStock(q, count = 12) {
  try {
    const d = await _json(`https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(q)}&type=14&count=${count}`)
    return (((d && d.QuotationCodeTable) || {}).Data || []).map((x) => {
      const cls = x.Classify || ''
      let type = 'stock'
      if (cls.includes('Index') || (x.SecurityTypeName || '').includes('指数')) type = 'index'
      else if (cls.includes('Fund') || (x.SecurityTypeName || '').includes('ETF') || (x.SecurityTypeName || '').includes('基金')) type = 'etf'
      return { code: x.Code, name: x.Name, secid: x.QuoteID || `${x.MktNum}.${x.Code}`, type, market: x.MktNum }
    })
  } catch { return [] }
}

// ============ 工具 ============
export const fmtMoney = (v) => {
  if (v == null) return '-'
  const a = Math.abs(v)
  if (a >= 1e8) return (v / 1e8).toFixed(2) + '亿'
  if (a >= 1e4) return (v / 1e4).toFixed(1) + '万'
  return String(Math.round(v))
}


// ===== v55 完整版指标/K线分析/PA-ICT（Rs/zs/vl 解码还原 2026-08-18）=====
// ===== v55 Rs 完整版 =====
export function computeIndicators(s, t = "swing") {
  const e = { short: [6, 13, 5], swing: [12, 26, 9], long: [26, 52, 9] }[t] || [12, 26, 9], i = { short: 10, swing: 20, long: 20 }[t] || 20, n = s.map((W) => W.close), l = s.map((W) => W.high), a = s.map((W) => W.low), c = s.map((W) => W.volume), u = s.length, f = {};
  for (const W of [5, 10, 20, 60, 120, 250]) {
    const V = new Array(u).fill(null);
    let A = 0;
    for (let X = 0; X < u; X++) A += n[X], X >= W && (A -= n[X - W]), X >= W - 1 && (V[X] = +(A / W).toFixed(2));
    f[W] = V;
  }
  function p(W, V) {
    const A = 2 / (V + 1), X = [];
    let yt = W[0];
    for (let Tt = 0; Tt < W.length; Tt++) yt = Tt === 0 ? W[0] : W[Tt] * A + yt * (1 - A), X.push(yt);
    return X;
  }
  const m = p(n, e[0]), y = p(n, e[1]), w = n.map((W, V) => m[V] - y[V]), S = p(w, e[2]), C = w.map((W, V) => (W - S[V]) * 2), O = { dif: w, dea: S, bar: C };
  function R(W) {
    const V = [null];
    let A = 0, X = 0;
    for (let yt = 1; yt < u; yt++) {
      const Tt = n[yt] - n[yt - 1];
      yt <= W ? (A += Math.max(Tt, 0), X += Math.max(-Tt, 0), yt === W ? (A /= W, X /= W, V.push(+(100 - 100 / (1 + (X === 0 ? 100 : A / X))).toFixed(2))) : V.push(null)) : (A = (A * (W - 1) + Math.max(Tt, 0)) / W, X = (X * (W - 1) + Math.max(-Tt, 0)) / W, V.push(+(100 - 100 / (1 + (X === 0 ? 100 : A / X))).toFixed(2)));
    }
    return V;
  }
  const D = R(14), N = R(6), $ = { k: [], d: [], j: [] };
  let I = 50, U = 50;
  for (let W = 0; W < u; W++) {
    const V = Math.max(0, W - 8);
    let A = -1 / 0, X = 1 / 0;
    for (let Tt = V; Tt <= W; Tt++) A = Math.max(A, l[Tt]), X = Math.min(X, a[Tt]);
    const yt = A === X ? 50 : (n[W] - X) / (A - X) * 100;
    I = 2 / 3 * I + 1 / 3 * yt, U = 2 / 3 * U + 1 / 3 * I, $.k.push(+I.toFixed(2)), $.d.push(+U.toFixed(2)), $.j.push(+(3 * I - 2 * U).toFixed(2));
  }
  const tt = { mid: [], upper: [], lower: [] };
  for (let W = 0; W < u; W++) {
    if (W < i - 1) {
      tt.mid.push(null), tt.upper.push(null), tt.lower.push(null);
      continue;
    }
    let V = 0;
    for (let Tt = 0; Tt < i; Tt++) V += n[W - Tt];
    const A = V / i;
    let X = 0;
    for (let Tt = 0; Tt < i; Tt++) X += (n[W - Tt] - A) ** 2;
    const yt = Math.sqrt(X / i);
    tt.mid.push(+A.toFixed(2)), tt.upper.push(+(A + 2 * yt).toFixed(2)), tt.lower.push(+(A - 2 * yt).toFixed(2));
  }
  const dt = [], nt = [];
  for (let W = 0; W < u; W++) {
    if (W < 4) {
      dt.push(null), nt.push(null);
      continue;
    }
    let V = 0;
    for (let X = 0; X < 5; X++) V += c[W - X];
    const A = V / 5;
    dt.push(+A.toFixed(0)), nt.push(+(c[W] / A).toFixed(2));
  }
  return { ma: f, macd: O, rsi: { 14: D, 6: N }, kdj: $, boll: tt, volMa5: dt, volRatio: nt };
}

// ===== v55 zs 完整版 =====
export function computeKlineAna(s, t, e = "swing") {
  if (s.length < 20) return { verdict: "数据不足", score: 0, summary: "数据不足20个交易日" };
  const i = s.map((Ut) => Ut.close), n = i[i.length - 1], l = (n / i[i.length - 6] - 1) * 100, a = (n / i[i.length - 21] - 1) * 100, c = (Ut) => {
    for (let fe = Ut.length - 1; fe >= 0; fe--) if (Ut[fe] != null) return Ut[fe];
    return null;
  }, u = c(t.ma[5]), f = c(t.ma[10]), p = c(t.ma[20]), m = c(t.ma[60]), y = t.ma && t.ma[250] ? c(t.ma[250]) : null, w = c(t.macd.dif), S = c(t.macd.dea), C = t.macd.bar, O = c(C);
  let R = null;
  for (let Ut = C.length - 2; Ut >= 0; Ut--) if (C[Ut] != null) {
    R = C[Ut];
    break;
  }
  const D = c(t.rsi[14]), N = c(t.rsi[6]), $ = c(t.kdj.k), I = c(t.kdj.d), U = c(t.kdj.j), tt = c(t.boll.upper), dt = c(t.boll.mid), nt = c(t.boll.lower), W = c(t.volRatio), V = { short: [N, 80], swing: [D, 75], long: [D, 70] }[e] || [D, 75], A = { short: [N, 20], swing: [D, 25], long: [D, 30] }[e] || [D, 25], X = { short: 110, swing: 100, long: 100 }[e] || 100, yt = { short: 20, swing: 15, long: 15 }[e] || 15, Tt = V[0], qt = V[1], Xt = A[1];
  let ht;
  u > f && f > p && (m == null || p > m) ? ht = "多头排列" : u < f && f < p && (m == null || p < m) ? ht = "空头排列" : ht = "均线交织";
  let ct = 0;
  const Bt = [];
  n > p ? (ct += 2, Bt.push("价格站上MA20，中期趋势偏多")) : (ct -= 2, Bt.push("价格跌破MA20，中期趋势偏空")), ht === "多头排列" ? (ct += 2, Bt.push("均线多头排列，上涨结构完整")) : ht === "空头排列" && (ct -= 2, Bt.push("均线空头排列，下跌结构压制")), w != null && S != null && (w > S && O > 0 ? (ct += 1, Bt.push("MACD金叉运行中，多方动能占优")) : w < S && O < 0 && (ct -= 1, Bt.push("MACD死叉运行中，空方动能占优")), R != null && O > R && O > 0 ? (ct += 1, Bt.push("MACD红柱放大，上涨动能增强")) : R != null && O < R && O < 0 ? (ct -= 1, Bt.push("MACD绿柱放大，下跌动能增强")) : R != null && O > R && O < 0 && (ct += 1, Bt.push("MACD绿柱缩短，下跌动能减弱"))), Tt != null && (Tt > qt ? (ct -= 1, Bt.push(`RSI=${Tt}进入超买区，短线回调风险`)) : Tt < Xt ? (ct += 1, Bt.push(`RSI=${Tt}进入超卖区，短线反弹机会`)) : Tt > 50 && (ct += 0, Bt.push(`RSI=${Tt}，多方略占优势`))), $ != null && I != null && ($ > I && U < 80 ? (ct += 1, Bt.push("KDJ金叉向上，短线动能良好")) : $ < I && (ct -= 1, Bt.push("KDJ死叉向下，短线偏弱")), U > X ? (ct -= 1, Bt.push(`KDJ的J值>${X}，短线严重超买`)) : U < 0 && (ct += 1, Bt.push("KDJ的J值<0，短线严重超卖"))), tt != null && nt != null && (n > tt ? (ct -= 1, Bt.push("价格突破布林上轨，短线过热")) : n < nt && (ct += 1, Bt.push("价格跌破布林下轨，短线超跌"))), W != null && (W > 1.5 && l > 0 ? (ct += 1, Bt.push(`近5日放量上涨（量比${W}），资金介入明显`)) : W > 1.5 && l < 0 ? (ct -= 1, Bt.push(`近5日放量下跌（量比${W}），资金出逃警惕`)) : W < 0.6 && Bt.push(`缩量运行（量比${W}），观望情绪浓`)), l > yt ? (ct -= 1, Bt.push(`近5日涨幅${l.toFixed(1)}%过大，追高风险`)) : l < -15 && (ct += 1, Bt.push(`近5日跌幅${l.toFixed(1)}%过大，超跌反弹可能`)), ct = Math.max(-10, Math.min(10, ct));
  let ue, he;
  ct >= 6 ? (ue = "强势看多", he = "bull") : ct >= 3 ? (ue = "偏多", he = "bull") : ct >= -2 ? (ue = "震荡观望", he = "mid") : ct >= -5 ? (ue = "偏空", he = "bear") : (ue = "弱势看空", he = "bear");
  const Se = s.slice(-60), Ie = Math.min(...Se.map((Ut) => Ut.low)), Ke = Math.max(...Se.map((Ut) => Ut.high)), ye = `综合评分${ct}/10，${ue}。近5日${l >= 0 ? "涨" : "跌"}${Math.abs(l).toFixed(1)}%，近20日${a >= 0 ? "涨" : "跌"}${Math.abs(a).toFixed(1)}%；${ht}${y != null ? `，年线MA250=${y}` : ""}；关键支撑${Ie.toFixed(2)}、压力${Ke.toFixed(2)}。`;
  return { verdict: ue, tone: he, score: ct, chg_5d: +l.toFixed(2), chg_20d: +a.toFixed(2), ma_status: ht, ma250: y, rsi: D, kdj_j: U, vol_ratio: W, boll_pos: tt != null ? n < dt ? "下轨" : n > dt ? "上轨" : "中轨" : null, support: +Ie.toFixed(2), resistance: +Ke.toFixed(2), signals: Bt, summary: ye };
}

// ===== v55 vl 完整版 =====
export function computePaict(s) {
  if (!s || s.length < 40) return null;
  const t = s.length, e = s.map((V) => V.high), i = s.map((V) => V.low), l = s.map((V) => V.close)[t - 1], a = [], c = [];
  for (let V = 3; V < t - 3; V++) {
    let A = true, X = true;
    for (let yt = V - 3; yt <= V + 3; yt++) yt !== V && (e[yt] >= e[V] && (A = false), i[yt] <= i[V] && (X = false));
    A && a.push({ idx: V, price: e[V] }), X && c.push({ idx: V, price: i[V] });
  }
  const u = a.slice(-2), f = c.slice(-2);
  let p = "range", m = "震荡结构：高低点互有高低，方向未明";
  if (u.length >= 2 && f.length >= 2) {
    const V = u[1].price > u[0].price, A = f[1].price > f[0].price;
    V && A ? (p = "up", m = "上升结构：高点低点持续抬升，多头占优") : !V && !A && (p = "down", m = "下降结构：高点低点持续走低，空头占优");
  }
  const y = a.filter((V) => V.idx >= t - 250), w = c.filter((V) => V.idx >= t - 250), S = [...new Set(w.map((V) => V.price).filter((V) => V < l && (l - V) / l < 0.25))].sort((V, A) => A - V).slice(0, 2), C = [...new Set(y.map((V) => V.price).filter((V) => V > l && (V - l) / l < 0.25))].sort((V, A) => V - A).slice(0, 2), O = s.slice(-60), R = Math.max(...O.map((V) => V.high)), D = Math.min(...O.map((V) => V.low)), N = R > l && (R - l) / l < 0.03, $ = D < l && (l - D) / l < 0.03;
  let I = "";
  N && $ ? I = `上方 ${R.toFixed(2)} 与下方 ${D.toFixed(2)} 都有止损池，注意双向假突破` : N ? I = `上方 ${R.toFixed(2)} 有止损池（前高），突破谨防假突破` : $ && (I = `下方 ${D.toFixed(2)} 有止损池（前低），跌破谨防假跌破`);
  const U = [], tt = s.slice(-20);
  for (let V = 1; V < tt.length; V++) {
    const A = tt[V], X = tt[V - 1], yt = Math.abs(A.close - A.open), Tt = A.high - Math.max(A.open, A.close), qt = Math.min(A.open, A.close) - A.low;
    if (yt > 0 && qt >= 2 * yt && Tt <= yt) {
      const Xt = p === "down";
      U.push({ type: "hammer", dir: Xt ? "bullish" : "bearish", text: Xt ? "锤子线（长下影）：下跌后见底信号，下方有承接" : "上吊线（长下影）：上涨后出现，警惕见顶" });
    }
    yt > 0 && Tt >= 2 * yt && qt <= yt && U.push({ type: "shooting_star", dir: "bearish", text: "射击之星（长上影）：上方抛压重，见顶信号" }), A.close > A.open && X.close < X.open && A.close >= X.open && A.open <= X.close && U.push({ type: "engulfing", dir: "bullish", text: "看涨吞没：阳线吞掉前阴线，多头反攻" }), A.close < A.open && X.close > X.open && A.close <= X.open && A.open >= X.close && U.push({ type: "engulfing", dir: "bearish", text: "看跌吞没：阴线吞掉前阳线，空头压制" }), A.high <= X.high && A.low >= X.low && yt > 0 && U.push({ type: "inside", dir: "neutral", text: "内包线：波动收窄，酝酿方向选择" });
  }
  const dt = s.slice(-40), nt = [];
  for (let V = 2; V < dt.length; V++) {
    const A = dt[V], X = dt[V - 1], yt = dt[V - 2];
    A.close > A.open && X.close < X.open && yt.close < yt.open && nt.push({ price: A.low, dir: "bullish", text: `看涨订单块 ${A.low.toFixed(2)}：下跌后机构建仓区，回踩是关注位` }), A.close < A.open && X.close > X.open && yt.close > yt.open && nt.push({ price: A.high, dir: "bearish", text: `看跌订单块 ${A.high.toFixed(2)}：上涨后机构出货区，反弹是压力` });
  }
  const W = [];
  for (let V = 2; V < dt.length; V++) {
    const A = dt[V], X = dt[V - 2];
    A.low > X.high && W.push({ price: (A.low + X.high) / 2, dir: "bullish", text: `看涨缺口（FVG）${X.high.toFixed(2)}~${A.low.toFixed(2)}，价格倾向回补` }), A.high < X.low && W.push({ price: (A.high + X.low) / 2, dir: "bearish", text: `看跌缺口（FVG）${A.high.toFixed(2)}~${X.low.toFixed(2)}，反弹有压力` });
  }
  return { structure: p, structureText: m, supports: S.slice(0, 2), resistances: C.slice(0, 2), liquidityText: I, signals: U.slice(-4), orderBlocks: nt.slice(-3), fvgs: W.slice(-2), levels: [...S.slice(0, 2).map((V) => ({ price: V, type: "support" })), ...C.slice(0, 2).map((V) => ({ price: V, type: "resistance" }))] };
}

export { today, isTrading }

// ===== 资金流（v55 反推恢复：详情页估值/资金/决策面板数据源）=====
// 今日主力资金（klt=1 分时资金最后一根）
export async function getFundFlow(secid) {
  try {
    const d = await _json(`https://push2delay.eastmoney.com/api/qt/stock/fflow/kline/get?lmt=0&klt=1&secid=${secid}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56`)
    const e = d?.data?.klines || []
    if (!e.length) return null
    const i = e[e.length - 1].split(',')
    return { main: +i[1], small: +i[2], medium: +i[3], large: +i[4], super_large: +i[5] }
  } catch { return null }
}
// 盘中主力时序（一眼看懂午盘判断用）
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
// 5日 vs 今日主力（f62=今日主力净额, f267=5日主力净额）
export async function getFiveDayFlow(secid) {
  try {
    const d = await _json(`https://push2delay.eastmoney.com/api/qt/ulist.np/get?secids=${secid}&fltt=2&invt=2&fields=f12,f62,f267`)
    const l = Object.values(d?.data?.diff || {})[0]
    return l ? { today: typeof l.f62 === 'number' ? l.f62 : null, fiveDay: typeof l.f267 === 'number' ? l.f267 : null } : null
  } catch { return null }
}
// 多周期资金流（today/d5/d10/d20，决策引擎 + listStage 用）
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
// 股东户数趋势（决策引擎筹码集中/分散判定）
export async function getHolderTrend(secid) {
  try {
    const code = String(secid).split('.')[1]
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_HOLDERNUM_DET&columns=ALL&filter=${encodeURIComponent(`(SECURITY_CODE="${code}")`)}&pageSize=5&sortColumns=END_DATE&sortTypes=-1&source=WEB&client=WEB`
    const d = await _json(url)
    const list = d?.result?.data || []
    return list.map((a, i) => {
      const u = a.HOLDER_NUM
      const next = i < list.length - 1 ? list[i + 1].HOLDER_NUM : null
      const chg = a.HOLDER_NUM_CHANGE_RATE != null ? a.HOLDER_NUM_CHANGE_RATE : (next && u ? (u - next) / next * 100 : 0)
      return { date: String(a.END_DATE || '').slice(0, 7), num: u, change: +chg.toFixed(1) }
    })
  } catch { return [] }
}

export default { getQuotes, getKlines, getTrends, getZtPool, getZbPool, getZtHistory, saveZtHistory, getLhb, getList, getRsi, getPredict, getRealtime, getHistory, getLiveFrame, getMarketTemp, llmAnalyze, getHoldings, saveHoldings, getWatchlist, saveWatchlist, getSettings, saveSettings, getBacktest, searchStock, getRealtimeQuote, getPing, computeCycle, industryStat, advanceRate, boardOf, cached, fmtMoney, today, isTrading, getFundFlow, getIntradayFlow, getFiveDayFlow, getMultiFlow, getHolderTrend }
