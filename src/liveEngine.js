// src/liveEngine.js —— 实盘规则引擎（dist v55 原版还原 2026-08-18）
// 原版 class Kc 反编译：6 行为状态机（ACC/PUMP/WASH/DIST/DUMP/WATCH）+ 11 异常检测 + B1/B2/B3/S1/S2 信号 + ARB 仲裁

export const BEHAVIORS = {
  ACC: { label: '吸筹', emoji: '🐋', color: '#58a6ff' },
  PUMP: { label: '拉升', emoji: '🚀', color: '#f85149' },
  WASH: { label: '洗盘', emoji: '🌊', color: '#d29922' },
  DIST: { label: '出货', emoji: '📉', color: '#3fb950' },
  DUMP: { label: '对倒', emoji: '🎭', color: '#bc8cff' },
  WATCH: { label: '观望', emoji: '👀', color: '#8b949e' },
}

// 证据权重（行为置信度计算）
const EV = { main: 0.3, priceVol: 0.25, keyLevel: 0.2, speed: 0.15, tail: 0.1 }

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
    this.recentAnoms = {}
    this.signals = []
    this.ydayByMin = null
    this.lastFrame = null
    this._pendingWash = null
    this._lastReason = ''
    this._dayAvgCache = null
  }

  feed(t) {
    const e = { behavior: null, anomalies: [], signals: [] }
    if (!t || !t.isTrading) return e
    this.lastFrame = t
    this.priceHist.push(t.price)
    if (this.priceHist.length > 60) this.priceHist.shift()
    if (t.mainNet != null) {
      this.mainNetHist.push(t.mainNet)
      if (this.mainNetHist.length > 120) this.mainNetHist.shift()
    }
    e.behavior = this._detectBehavior(t)
    e.anomalies = this._detectAnomalies(t)
    e.signals = this._detectSignals(t, e.behavior, e.anomalies)
    if (this.dayHigh == null || t.price > this.dayHigh) this.dayHigh = t.price
    if (this.dayLow == null || t.price < this.dayLow) this.dayLow = t.price
    this.prev = t
    return e
  }

  _detectBehavior(t) {
    const p = this.prev
    const sp5 = this._speedPct(t, 5)
    const vsAvg = t.price > 0 ? (t.price - t.avgPrice) / t.avgPrice * 100 : 0
    const posInRange = t.high > t.low ? (t.price - t.low) / (t.high - t.low) * 100 : 50
    const mainDir = this._mainDir()
    const bigVol = t.volRatio >= 3
    const tickChg = p ? Math.abs(t.price - p.price) / p.price * 100 : 0
    let cand = null, reason = ''
    const highStall = vsAvg > 5 || (this.dayHigh && t.price > this.dayHigh * 0.995)
    const lowWeak = vsAvg < -1 && posInRange < 25
    if (highStall && bigVol && tickChg < 0.3 && mainDir <= 0) {
      cand = 'DIST'; reason = '高位放量滞涨+主力不买'
    } else if (bigVol && tickChg < 0.3 && t.outer && t.inner) {
      cand = 'DUMP'; reason = '量暴增价不动(对倒痕迹)'
    } else if (mainDir > 0 && sp5 > 0.3 && vsAvg > 0) {
      cand = 'PUMP'; reason = '放量突破+主力净买+加速'
    } else if (sp5 < -1) {
      cand = 'WASH'; reason = '急跌(疑似洗盘,待收回确认)'
    } else if (lowWeak && mainDir >= 0 && t.volRatio <= 1.5) {
      cand = 'ACC'; reason = '低位横盘+主力温和吸筹'
    } else {
      cand = 'WATCH'; reason = '无明显主力行为'
    }
    let st = this.state
    if (cand === this.state) {
      this.stateFrames++
    } else if (cand === 'WASH') {
      // WASH 需 3 帧确认（防止误判急跌）
      this._pendingWash = this._pendingWash || { frames: 0 }
      this._pendingWash.frames++
      if (this._pendingWash.frames >= 3 && vsAvg > -0.5) {
        st = 'WASH'
        this._pendingWash = null
        this._switch(t, 'WASH', '急跌后收回确认')
      }
    } else {
      this.stateFrames = this.stateFrames || 0
      if (this.stateFrames <= -2 || this.state === 'WATCH') {
        st = cand
        this.stateFrames = 0
        this._switch(t, cand, reason)
      } else {
        this.stateFrames--
        st = this.state
      }
    }
    // 证据与置信度
    const evs = []
    if (mainDir !== 0) evs.push(['主力' + (mainDir > 0 ? '净买' : '净卖'), EV.main])
    if (Math.abs(vsAvg) > 0.5) evs.push(['价格' + (vsAvg > 0 ? '上穿' : '下穿') + '均价', EV.priceVol])
    if (sp5 !== 0) evs.push(['涨速 ' + sp5.toFixed(2) + '%', EV.speed])
    if (bigVol) evs.push(['量能异常', EV.priceVol * 0.6])
    if (this._atKeyLevel(t)) evs.push(['关键位攻防', EV.keyLevel])
    if (this._isTail(t.time)) evs.push(['尾盘行为', EV.tail])
    const conf = Math.min(95, Math.max(50, 50 + evs.reduce((s, x) => s + x[1] * 100, 0) * (st === 'WATCH' ? 0.3 : 1)))
    return {
      state: st,
      label: BEHAVIORS[st].label,
      emoji: BEHAVIORS[st].emoji,
      confidence: Math.round(conf),
      evidence: evs.map(x => x[0]),
      reason,
      segments: this.segments.slice(-8),
    }
  }

  _switch(t, st, reason) {
    if (this.segStart) {
      this.segments.push({ state: this.state, from: this.segStart, to: t.time, reason: this._lastReason || '' })
    }
    this.segStart = t.time
    this._lastReason = reason
  }

  _speedPct(t, n) {
    const i = Math.min(this.priceHist.length, n * 20)
    if (i < 5) return 0
    const base = this.priceHist[this.priceHist.length - i]
    return base > 0 ? (t.price - base) / base * 100 : 0
  }

  _mainDir() {
    if (this.mainNetHist.length < 10) return null
    const t = this.mainNetHist.slice(-30)
    if (t.length < 10) return null
    const d = t[t.length - 1] - t[0]
    return d > 1e5 ? 1 : d < -1e5 ? -1 : 0
  }

  _atKeyLevel(t) {
    if (!this.prev) return false
    return (this.prev.price <= t.avgPrice && t.price > t.avgPrice) || (this.prev.price >= t.avgPrice && t.price < t.avgPrice)
  }

  _isTail(t) { return t >= '14:30' }

  _detectAnomalies(t) {
    const out = []
    const fire = (type, sev, data, read, act) => {
      const key = type + '_' + Math.floor(Date.now() / 3e5)
      if (!this.recentAnoms[key]) {
        this.recentAnoms[key] = 1
        out.push({ type, sev, data, read, act, time: t.time })
      }
    }
    const sp1 = this._speedPct(t, 1)
    const sp5 = this._speedPct(t, 5)
    const dayAvg = this._dayAvgSpeed(t)
    const net30 = this._mainNetDelta(30)
    const tickChg = this.prev ? Math.abs(t.price - this.prev.price) / t.price * 100 : 0
    if (this._isTail(t.time) && dayAvg > 0 && sp5 > dayAvg * 5) fire('tail_pump', '强', `5分钟拉升 +${sp5.toFixed(2)}%（全天均速${dayAvg.toFixed(2)}%的${(sp5 / dayAvg).toFixed(0)}倍）`, '拉尾盘做图——大概率次日出货准备', '持有者减仓兑现，不追')
    if (this._isTail(t.time) && sp5 < -2) fire('tail_dump', '强', `尾盘急砸 ${sp5.toFixed(2)}%`, '尾盘砸盘=资金出逃恐慌盘', '持仓减仓，明日观察')
    if (this.dayHigh && t.price >= this.dayHigh - t.price * 1e-3 && net30 < 0) fire('top_div', '强', `价格新高 ${t.price} 但主力30分钟净流出 ${this._fmtMoney(-net30)}`, '拉高出货嫌疑——边拉边卖', '追高风险极大，逢高减')
    if (this.dayLow && t.price <= this.dayLow + t.price * 1e-3 && net30 > 0) fire('bot_div', '中', `价格新低但主力30分钟净流入 ${this._fmtMoney(net30)}`, '底部资金承接，可能是吸筹', '关注企稳低吸')
    if (t.volRatio >= 3 && tickChg < 0.3) fire('churn', '中', `量比 ${t.volRatio} 但价格波动仅 ${tickChg.toFixed(2)}%`, '对倒维持活跃度——制造成交量吸引跟风', '警惕，不追高')
    if (this.prev && t.mainNet != null && this.prev.mainNet != null) {
      const f = t.mainNet - this.prev.mainNet
      if (f > (t.amount || 0) * 0.01) fire('sweep', '中', `单帧主力净流入 ${this._fmtMoney(f)}（占成交额${(f / (t.amount || 1) * 100).toFixed(1)}%）`, '机构扫单，真金白银', '强势确认，可关注')
    }
    if (t.highLimit && t.price > t.highLimit * 0.99) {
      const seal = this._sealEstimate(t)
      if (this.prev && this._sealEstimate(this.prev) > 0) {
        const chg = Math.abs(seal - this._sealEstimate(this.prev)) / this._sealEstimate(this.prev)
        if (chg > 0.5) fire('seal_change', '中', `封单变化 ${(chg * 100).toFixed(0)}%`, '撤单诱多/炸板预警', '持仓注意风险')
      }
    }
    if (t.profile && t.profile.avgSpeed > 0 && sp5 > t.profile.avgSpeed * 3) fire('profile_anom', '中', `5分钟涨速 ${sp5.toFixed(2)}% 是该股画像均值${t.profile.avgSpeed.toFixed(2)}%的${(sp5 / t.profile.avgSpeed).toFixed(1)}倍`, '异常于该股历史行为——主力有动作', '重点盯')
    if (sp1 > 1.5) fire('flash', '中', `1分钟涨速 +${sp1.toFixed(2)}%`, '瞬时脉冲', '等确认，勿追')
    if (sp1 < -1.5) fire('flash_dump', '中', `1分钟跌速 ${sp1.toFixed(2)}%`, '瞬时跳水', '警惕，勿接')
    if (t.bids && t.asks && t.bids[0] && t.asks[0]) {
      const spread = (t.asks[0][0] - t.bids[0][0]) / t.price * 100
      if (spread > 0.5) fire('spread', '中', `买卖一价差 ${spread.toFixed(2)}%`, '流动性瞬间消失', '谨慎操作')
    }
    return out
  }

  _dayAvgSpeed(t) {
    const d = t.price > 0 && t.preClose > 0 ? (t.price - t.preClose) / t.preClose * 100 : 0
    const mins = this._elapsedMins(t.time)
    return mins <= 10 ? 0.02 : Math.abs(d) / mins
  }

  _elapsedMins(t) {
    const [h, m] = t.split(':').map(Number)
    let n = h * 60 + m - 570
    if (n > 120) n -= 90
    return Math.max(n, 1)
  }

  _mainNetDelta(n) {
    if (this.mainNetHist.length < 2) return 0
    const t = this.mainNetHist.slice(-n)
    return t[t.length - 1] - t[0]
  }

  _sealEstimate(t) {
    if (!t.asks || !t.bids) return 0
    return t.bids[0] ? t.bids[0][1] : 0
  }

  _fmtMoney(v) {
    if (v == null) return '0'
    const a = Math.abs(v)
    return a >= 1e8 ? (v / 1e8).toFixed(2) + '亿' : a >= 1e4 ? (v / 1e4).toFixed(0) + '万' : v.toFixed(0)
  }

  _detectSignals(t, behavior, anomalies) {
    const out = []
    const p = this.prev
    const anomTypes = new Set(anomalies.map(x => x.type))
    // B1 放量突破今日高点
    if (this.dayHigh && t.price > this.dayHigh && t.volRatio >= 1.5 && this._mainDir() > 0) {
      out.push({ side: 'buy', id: 'B1', label: '放量突破今日高点', strength: '强', price: t.price, pos: '可3成仓跟进，回踩不破持有', trigger: `现价 ${t.price} 放量站上 ${this.dayHigh.toFixed(2)}` })
    } else if (this.dayHigh) {
      out.push({ side: 'buy', id: 'B1', label: '放量突破今日高点', strength: '强', price: this.dayHigh, pos: '可3成仓跟进', trigger: `⏳ 未触发 · 差 ${((this.dayHigh - t.price) / t.price * 100).toFixed(1)}%` })
    }
    // B2 回踩均价不破
    const md = this._mainDir()
    if (p && p.price > t.avgPrice && t.price <= t.avgPrice * 1.002 && md != null && md >= 0) {
      out.push({ side: 'buy', id: 'B2', label: '回踩均价不破', strength: '中', price: t.avgPrice, pos: '可2成仓低吸', trigger: `✅ 当前价格 ${t.price} 回踩均价 ${t.avgPrice.toFixed(2)} 企稳` })
    } else if (t.avgPrice) {
      out.push({ side: 'buy', id: 'B2', label: '回踩均价/筹码区不破', strength: '中', price: t.avgPrice, pos: '可2成仓低吸', trigger: `⏳ 现价 ${t.price} · 均价 ${t.avgPrice.toFixed(2)}（${(t.price > t.avgPrice ? '+' : '') + ((t.price - t.avgPrice) / t.avgPrice * 100).toFixed(2)}%）` })
    }
    // B3 站上均价线
    if (p && p.price <= t.avgPrice && t.price > t.avgPrice) {
      out.push({ side: 'buy', id: 'B3', label: '站上均价线', strength: '中', price: t.price, pos: '可1-2成试探', trigger: `✅ 刚突破均价 ${t.avgPrice.toFixed(2)}，确认中` })
    }
    // S1 跌破今日低点
    if (this.dayLow && t.price < this.dayLow && this._mainDir() < 0) {
      out.push({ side: 'sell', id: 'S1', label: '跌破今日低点', strength: '强', price: t.price, pos: '短线减半仓', trigger: `✅ 跌破 ${this.dayLow.toFixed(2)}，分时转弱` })
    } else if (this.dayLow) {
      out.push({ side: 'sell', id: 'S1', label: '跌破今日低点', strength: '强', price: this.dayLow, pos: '短线减半仓', trigger: `⏳ 未触发 · 距 ${((t.price - this.dayLow) / t.price * 100).toFixed(1)}%` })
    }
    // S2 跌破预测止损
    if (t.pred && t.pred.stop) {
      if (t.price < t.pred.stop) {
        out.push({ side: 'sell', id: 'S2', label: '跌破预测止损', strength: '强', price: t.price, pos: '无条件清仓，不赌', trigger: `✅ 跌破 ${t.pred.stop}，离场` })
      } else {
        out.push({ side: 'sell', id: 'S2', label: '跌破预测止损', strength: '强', price: t.pred.stop, pos: '无条件清仓', trigger: `⏳ 未触发 · 止损 ${t.pred.stop} · 距 ${((t.price - t.pred.stop) / t.price * 100).toFixed(1)}%` })
      }
    }
    // ARB 仲裁：买卖信号冲突
    const hasBuy = out.some(x => x.side === 'buy' && x.trigger.startsWith('✅'))
    const hasSell = out.some(x => x.side === 'sell' && x.trigger.startsWith('✅'))
    if (hasBuy && hasSell) {
      return [{ side: 'hold', id: 'ARB', label: '买卖信号冲突', strength: '中', price: t.price, pos: '矛盾信号，观望等方向', trigger: '⚠️ 买入与卖出信号同时触发，建议观望' }]
    }
    return out
  }
}

export function priceBins(trends, bins = 12) {
  if (!trends || trends.length < 30) return []
  const lo = Math.min(...trends.map(t => t.low != null ? t.low : t.price))
  const hi = Math.max(...trends.map(t => t.high != null ? t.high : t.price))
  if (!(hi > lo)) return []
  const step = (hi - lo) / bins
  const out = []
  for (let i = 0; i < bins; i++) {
    const from = lo + step * i
    const to = from + step
    const vol = trends.reduce((s, t) => s + ((t.price >= from && t.price < to) ? (t.volume || 0) : 0), 0)
    out.push({ lo: from, hi: to, vol })
  }
  return out
}
