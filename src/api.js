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

export const getRealtime = async (mode = 'swing') =>
  _json('/api/realtime?mode=' + mode, { signal: AbortSignal.timeout(20000), cache: 'no-store' }).catch(() => null)

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
  const d = await _json('/api/llm', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params), signal: AbortSignal.timeout(120000),
  })
  return d
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

export { today, isTrading }
export default { getQuotes, getKlines, getTrends, getZtPool, getZbPool, getZtHistory, saveZtHistory, getLhb, getList, getRsi, getPredict, getRealtime, getHistory, getLiveFrame, getMarketTemp, llmAnalyze, getHoldings, saveHoldings, getWatchlist, saveWatchlist, getSettings, saveSettings, getBacktest, searchStock, getRealtimeQuote, getPing, computeCycle, industryStat, advanceRate, boardOf, cached, fmtMoney, today, isTrading }
