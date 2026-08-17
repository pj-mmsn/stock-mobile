// src/liveEngine.js —— 实盘规则引擎（按交接文档 2026-08-13 规格重写）
// 纯函数无 DOM 依赖，可在 node 直接跑。8 命名信号 + ARB 仲裁，6 行为状态机，11 异常检测。
// 接续开发注意：文件头注释曾写"10条买卖信号"，实际为 B1~B3 + S1~S5 = 8 条 + ARB。

export const BEHAVIORS = {
  ACC:   { label: '吸筹', emoji: '🐋', color: '#58a6ff' },
  PUMP:  { label: '拉升', emoji: '🚀', color: '#f85149' },
  WASH:  { label: '洗盘', emoji: '🌊', color: '#d29922' },
  DIST:  { label: '出货', emoji: '📉', color: '#3fb950' },
  DUMP:  { label: '对倒', emoji: '🎭', color: '#bc8cff' },
  WATCH: { label: '观望', emoji: '👀', color: '#8b949e' },
}

const EV_WEIGHT = [
  { w: 0.30, cond: (f, s) => s._mainDir() !== 0, name: '主力净买/净卖' },
  { w: 0.25, cond: (f, s) => { const d = s._devAvg(f); return Math.abs(d) > 0.5; }, name: '价格穿越均价' },
  { w: 0.15, cond: (f, s) => s._speedPct(f, 5) !== 0, name: '涨速' },
  { w: 0.15, cond: (f) => f.volRatio >= 3, name: '量能异常' },
  { w: 0.20, cond: (f, s) => s.prev && ((s.prev.price > f.avgPrice) !== (f.price > f.avgPrice)) && Math.abs(s.prev.price - f.avgPrice) > 0.001, name: '关键位攻防' },
  { w: 0.10, cond: (f) => (f.time || '') >= '14:30', name: '尾盘行为' },
]

export class LiveEngine {
  constructor(code) {
    this.code = code
    this.state = 'WATCH'
    this.stateFrames = 0
    this.segments = []
    this.segStart = null
    this.prev = null
    this.mainNetHist = []
    this.priceHist = []
    this.dayHigh = null
    this.dayLow = null
    this.events = []
    this.recentAnoms = []
    this.signals = []
    this.ydayByMin = null
    this.lastFrame = null
    this._pendingWash = null
    this._dayAvgCache = null
    this._lastReason = null
    this._anomKeys = new Set()
  }

  feed(frame) {
    const f = frame || {}
    if (!f.isTrading) {
      this.lastFrame = f
      return { behavior: null, anomalies: [], signals: [] }
    }
    // 维护价格/主力历史
    if (f.price != null) {
      this.priceHist.push(f.price)
      if (this.priceHist.length > 60) this.priceHist.shift()
      this.dayHigh = this.dayHigh == null ? f.price : Math.max(this.dayHigh, f.price)
      this.dayLow = this.dayLow == null ? f.price : Math.min(this.dayLow, f.price)
    }
    if (f.mainNet != null) {
      this.mainNetHist.push(f.mainNet)
      if (this.mainNetHist.length > 120) this.mainNetHist.shift()
    }
    this.lastFrame = f

    const behavior = this._detectBehavior(f)
    const anomalies = this._detectAnomalies(f)
    const signals = this._detectSignals(f, behavior, anomalies)
    this.prev = f
    return { behavior, anomalies, signals }
  }

  // ---------- 行为状态机 ----------
  _detectBehavior(f) {
    const speed5 = this._speedPct(f, 5)
    const devAvg = this._devAvg(f)
    const rangePos = this._rangePos(f)
    const volRatio = f.volRatio || 0
    const mainDir = this._mainDir()
    const wave = this._frameWave(f)
    let cand = null, reason = ''

    if (devAvg > 5 || (this.dayHigh && f.price > this.dayHigh * 0.995)) {
      if (volRatio >= 3 && wave < 0.3 && mainDir <= 0) { cand = 'DIST'; reason = '高位放量滞涨+主力不买' }
    }
    if (!cand && volRatio >= 3 && wave < 0.3 && (f.outer != null || f.inner != null)) { cand = 'DUMP'; reason = '量暴增价不动(对倒痕迹)' }
    if (!cand && mainDir > 0 && speed5 > 0.3 && devAvg > 0) { cand = 'PUMP'; reason = '放量突破+主力净买+加速' }
    if (!cand && speed5 < -1) { cand = 'WASH'; reason = '急跌(疑似洗盘,待收回确认)' }
    if (!cand && devAvg < -1 && rangePos < 25 && mainDir >= 0 && volRatio <= 1.5) { cand = 'ACC'; reason = '低位横盘+主力温和吸筹' }
    if (!cand) { cand = 'WATCH'; reason = '无明显主力行为' }

    // WASH 特殊：_pendingWash 待确认
    if (cand === 'WASH') {
      this._pendingWash = this._pendingWash || { frames: 0 }
      this._pendingWash.frames++
      if (this._pendingWash.frames >= 3) {
        if (devAvg > -0.5) {
          this._pendingWash = null
          return this._switch(f, 'WASH', reason)
        }
        // 未收回：放弃洗盘判定
        this._pendingWash = null
        if (this.state === 'WATCH') return this._switch(f, 'WATCH', '急跌未收回,回归观望')
        return this._behaviorResult(f, this.state)
      }
      return this._behaviorResult(f, this.state)
    }
    this._pendingWash = null

    // 状态转移（防抖）
    if (cand === this.state) {
      this.stateFrames++
      return this._behaviorResult(f, this.state)
    }
    if (this.state === 'WATCH') {
      return this._switch(f, cand, reason)
    }
    this.stateFrames--
    if (this.stateFrames <= -2) {
      return this._switch(f, cand, reason)
    }
    return this._behaviorResult(f, this.state)
  }

  _switch(f, state, reason) {
    if (this.state !== state && this.segStart) {
      this.segments.push({ state: this.state, from: this.segStart, to: f.time || '', reason: this._lastReason || '' })
      if (this.segments.length > 8) this.segments.shift()
    }
    this.state = state
    this.stateFrames = 0
    this.segStart = f.time || ''
    this._lastReason = reason
    return this._behaviorResult(f, state)
  }

  _behaviorResult(f, state) {
    let conf = 50
    for (const ev of EV_WEIGHT) {
      if (ev.cond(f, this)) conf += ev.w * 100
    }
    conf = Math.min(95, conf)
    if (state === 'WATCH') conf *= 0.3
    const evidence = EV_WEIGHT.filter(ev => ev.cond(f, this)).map(ev => ev.name)
    const b = BEHAVIORS[state] || BEHAVIORS.WATCH
    return {
      state, label: b.label, emoji: b.emoji, confidence: Math.round(conf),
      evidence, reason: this._lastReason || '', segments: this.segments.slice(-8),
    }
  }

  // ---------- 异常检测（11 类，5 分钟窗口去重） ----------
  _detectAnomalies(f) {
    const out = []
    const push = (type, sev, read, act) => {
      const key = type + '|' + Math.floor(Date.now() / 300000)
      if (this._anomKeys.has(key)) return
      this._anomKeys.add(key)
      out.push({ type, sev, data: {}, read, act, time: f.time || '' })
    }
    const speed5 = this._speedPct(f, 5)
    const speed1 = this._speedPct(f, 1)
    const dayAvgSpeed = this._dayAvgSpeed(f)
    const main30 = this._mainNetDelta(30)
    const volRatio = f.volRatio || 0
    const wave = this._frameWave(f)

    const t = f.time || ''
    if (t >= '14:30' && dayAvgSpeed > 0 && speed5 > dayAvgSpeed * 5) push('tail_pump', '强', '拉尾盘做图，次日出货准备', '持有者减仓兑现')
    if (t >= '14:30' && speed5 < -2) push('tail_dump', '强', '资金出逃', '持仓减仓')
    if (f.price != null && this.dayHigh != null && f.price >= this.dayHigh - f.price * 0.001 && main30 < 0) push('top_div', '强', '拉高出货嫌疑', '逢高减')
    if (f.price != null && this.dayLow != null && f.price <= this.dayLow + f.price * 0.001 && main30 > 0) push('bot_div', '中', '底部承接', '关注企稳低吸')
    if (volRatio >= 3 && wave < 0.3) push('churn', '中', '制造成交量', '警惕不追高')
    if (this.prev && f.mainNet != null && this.prev.mainNet != null && f.amount) {
      const delta = f.mainNet - this.prev.mainNet
      if (delta > f.amount * 0.01) push('sweep', '中', '机构扫单', '强势确认')
    }
    if (f.highLimit && f.price > f.highLimit * 0.99 && f.bids && this.prev && this.prev.bids) {
      const seal = f.bids[0] ? f.bids[0][1] : 0
      const pseal = this.prev.bids[0] ? this.prev.bids[0][1] : 0
      if (pseal > 0 && Math.abs(seal - pseal) / pseal > 0.5) push('seal_change', '中', '撤单诱多/炸板预警', '盯紧封单')
    }
    if (f.profile && f.profile.avgSpeed && speed5 > f.profile.avgSpeed * 3) push('profile_anom', '中', '反常于历史', '重点盯')
    if (speed1 > 1.5) push('flash', '中', '瞬时脉冲', '等确认')
    if (speed1 < -1.5) push('flash_dump', '中', '瞬时脉冲', '等确认')
    if (f.asks && f.bids && f.asks[0] && f.bids[0] && f.price) {
      const spread = (f.asks[0][0] - f.bids[0][0]) / f.price
      if (spread > 0.005) push('spread', '中', '流动性消失', '谨慎')
    }
    this.recentAnoms = out.slice(-5)
    return out
  }

  // ---------- 买卖信号（B1~B3 + S1~S5 + ARB） ----------
  _detectSignals(f, behavior, anomalies) {
    const out = []
    const avgPrice = f.avgPrice
    const volRatio = f.volRatio || 0
    const mainDir = this._mainDir()
    const dayHigh = this.dayHigh || f.price
    const dayLow = this.dayLow || f.price

    const buy = (id, label, price, pos, trigger) => out.push({ side: 'buy', id, label, strength: '中', price, pos, trigger })
    const sell = (id, label, price, pos, trigger) => out.push({ side: 'sell', id, label, strength: '中', price, pos, trigger })
    const hold = (id, label) => out.push({ side: 'hold', id, label, strength: '中', price: f.price, pos: '0%', trigger: label })

    // B1 放量突破今日高点
    if (f.price > dayHigh && volRatio >= 1.5 && mainDir > 0) {
      buy('B1', '放量突破今日高点', f.price, '0%', '✅ 放量突破今高，主力净买')
    } else {
      const dist = dayHigh > 0 ? ((dayHigh - f.price) / dayHigh * 100).toFixed(1) : '0.0'
      buy('B1', '放量突破今日高点', dayHigh, `距${dist}%`, `⏳ 距突破 ${dist}%`)
    }
    // B2 回踩均价不破
    if (this.prev && this.prev.price > avgPrice && f.price <= avgPrice * 1.002 && mainDir >= 0) {
      buy('B2', '回踩均价不破', f.price, '0%', '✅ 回踩均价获支撑')
    } else if (avgPrice > 0) {
      const dist = ((avgPrice - f.price) / avgPrice * 100).toFixed(1)
      buy('B2', '回踩均价不破', avgPrice, `距${dist}%`, `⏳ 回踩距均价 ${dist}%`)
    }
    // B3 站上均价线（仅触发时返回）
    if (this.prev && this.prev.price <= avgPrice && f.price > avgPrice) {
      buy('B3', '站上均价线', f.price, '0%', '✅ 上穿均价线')
    }
    // S1 跌破今日低点
    if (f.price < dayLow && mainDir < 0) {
      sell('S1', '跌破今日低点', f.price, '0%', '✅ 破今日低点，主力流出')
    } else {
      const dist = dayLow > 0 ? ((f.price - dayLow) / dayLow * 100).toFixed(1) : '0.0'
      sell('S1', '跌破今日低点', dayLow, `距${dist}%`, `⏳ 距破位 ${dist}%`)
    }
    // S2 跌破预测止损（无预测时不产出）
    if (f.pred && f.pred.stop != null && f.price < f.pred.stop) {
      sell('S2', '跌破预测止损', f.pred.stop, '0%', '✅ 跌破预测止损，无条件清仓')
    }
    // S3 冲高回落破均价（仅触发时返回）
    if (this.prev && this.prev.price > avgPrice && f.price < avgPrice) {
      sell('S3', '冲高回落破均价', f.price, '0%', '✅ 冲高回落破均价')
    }
    // S4 顶背离+放量滞涨
    const hasTopDiv = anomalies.some(a => a.type === 'top_div')
    if (hasTopDiv && volRatio >= 2) {
      sell('S4', '顶背离+放量滞涨', f.price, '0%', '✅ 顶背离+放量，减仓不追高')
    }
    // S5 尾盘急拉未封板
    const hasTailPump = anomalies.some(a => a.type === 'tail_pump')
    if (hasTailPump && (!f.highLimit || f.price < f.highLimit * 0.995)) {
      sell('S5', '尾盘急拉未封板', f.price, '0%', '✅ 尾盘急拉未封板，防次日低开')
    }
    // 占位机制：B1/B2/S1/S2 每帧必返回；B3/S3 仅触发；S2/S4/S5 条件性

    // 仲裁：同帧存在 ✅ 买入与 ✅ 卖出 → 丢弃全部信号
    const hasBuy = out.some(s => s.side === 'buy' && s.trigger.startsWith('✅'))
    const hasSell = out.some(s => s.side === 'sell' && s.trigger.startsWith('✅'))
    if (hasBuy && hasSell) {
      return [{ side: 'hold', id: 'ARB', label: '买卖信号冲突', strength: '中', price: f.price, pos: '0%', trigger: '买卖信号冲突，观望等方向' }]
    }
    // 强度：volRatio≥2 且 mainDir≠0 的触发信号升为强
    for (const s of out) {
      if (s.trigger.startsWith('✅') && (volRatio >= 2 || mainDir !== 0)) s.strength = '强'
    }
    this.signals = out.slice(-6)
    return out
  }

  // ---------- 辅助指标 ----------
  _speedPct(f, minutes) {
    const hist = this.priceHist
    const n = Math.min(hist.length, minutes * 20)
    if (n < 5 || hist.length < n + 1) return 0
    const old = hist[hist.length - 1 - n]
    return old > 0 ? (f.price - old) / old * 100 : 0
  }

  _devAvg(f) {
    return f.avgPrice > 0 ? (f.price - f.avgPrice) / f.avgPrice * 100 : 0
  }

  _rangePos(f) {
    if (this.dayHigh == null || this.dayLow == null) return 50
    if (this.dayHigh === this.dayLow) return 50
    return (f.price - this.dayLow) / (this.dayHigh - this.dayLow) * 100
  }

  _frameWave(f) {
    if (!this.prev || !this.prev.price) return 100
    return Math.abs(f.price - this.prev.price) / this.prev.price * 100
  }

  _mainDir() {
    const h = this.mainNetHist
    if (h.length < 10) return 0
    const n = Math.min(30, h.length)
    const delta = h[h.length - 1] - h[h.length - 1 - n]
    if (delta > 100000) return 1
    if (delta < -100000) return -1
    return 0
  }

  _mainNetDelta(frames) {
    const h = this.mainNetHist
    const n = Math.min(frames, h.length)
    if (n < 2) return 0
    return h[h.length - 1] - h[h.length - 1 - n]
  }

  _dayAvgSpeed(f) {
    const t = f.time || ''
    const mins = this._elapsedMins(t)
    if (mins <= 0) return 0
    const hist = this.priceHist
    if (hist.length < 2) return 0
    return (f.price - hist[0]) / hist[0] * 100 / mins
  }

  _elapsedMins(t) {
    if (!t || !t.includes(':')) return 0
    const [hh, mm] = t.split(':').map(Number)
    let mins = hh * 60 + mm - 9 * 60 - 30
    if (mins > 120) mins -= 90 // 午休 11:30-13:00
    return Math.max(0, mins)
  }

  _atKeyLevel(f) {
    const avg = f.avgPrice || 0
    if (!avg) return null
    const d = (f.price - avg) / avg * 100
    if (Math.abs(d) < 0.3) return 'avg'
    if (this.dayHigh && f.price > this.dayHigh * 0.995) return 'high'
    if (this.dayLow && f.price < this.dayLow * 1.005) return 'low'
    return null
  }

  _isTail(t) {
    return (t || '') >= '14:30'
  }

  _sealEstimate(f) {
    if (!f.bids || !f.bids[0]) return 0
    return f.bids[0][1]
  }

  _fmtMoney(v) {
    if (v == null) return '-'
    const abs = Math.abs(v)
    if (abs >= 1e8) return (v / 1e8).toFixed(2) + '亿'
    if (abs >= 1e4) return (v / 1e4).toFixed(1) + '万'
    return String(Math.round(v))
  }
}

// 筹码密集区：12 等分价格桶中成交量占比 >8% 的桶，按 pct 降序
export function priceBins(trends, bins = 12) {
  if (!trends || trends.length < 30) return []
  const prices = trends.map(t => t.price).filter(p => p > 0)
  if (!prices.length) return []
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  if (hi <= lo) return []
  const step = (hi - lo) / bins
  const buckets = new Array(bins).fill(0)
  let totalVol = 0
  for (const t of trends) {
    if (t.price <= 0) continue
    const idx = Math.min(bins - 1, Math.floor((t.price - lo) / step))
    buckets[idx] += t.vol || 0
    totalVol += t.vol || 0
  }
  if (!totalVol) return []
  const out = []
  for (let i = 0; i < bins; i++) {
    const pct = buckets[i] / totalVol * 100
    if (pct > 8) out.push({ lo: lo + i * step, hi: lo + (i + 1) * step, pct: Math.round(pct * 10) / 10 })
  }
  return out.sort((a, b) => b.pct - a.pct)
}
