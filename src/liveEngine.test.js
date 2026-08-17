// src/liveEngine.test.js —— 实盘引擎冒烟单测（node --test）
import test from 'node:test'
import assert from 'node:assert/strict'
import { LiveEngine, BEHAVIORS, priceBins } from './liveEngine.js'

function makeFrame(i, price, extra = {}) {
  return {
    time: `${String(9 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
    isTrading: true,
    price,
    avgPrice: extra.avgPrice || price * 0.99,
    preClose: 10,
    open: 10,
    high: Math.max(price, extra.high || 10),
    low: Math.min(price, extra.low || 9.9),
    volRatio: extra.volRatio || 1.5,
    turnover: extra.turnover || 3,
    outer: extra.outer || 150,
    inner: extra.inner || 120,
    mainNet: (extra.mainNet ?? 100000) + i * 1000,
    amount: 1e6 + i * 1e4,
    highLimit: 11,
    lowLimit: 9,
    bids: [[price - 0.01, 5000]],
    asks: [[price + 0.01, 3000]],
    ...extra,
  }
}

test('引擎默认态 WATCH，无信号无异常', () => {
  const e = new LiveEngine('000001')
  const r = e.feed(makeFrame(0, 10.0))
  assert.equal(r.behavior.state, 'WATCH')
  assert.ok(Array.isArray(r.signals))
  assert.ok(Array.isArray(r.anomalies))
})

test('30 帧后信号占位出现（B1/B2/S1）', () => {
  const e = new LiveEngine('000001')
  let r = null
  let price = 10.0
  for (let i = 0; i < 35; i++) {
    price += 0.01
    r = e.feed(makeFrame(i, price))
  }
  const ids = r.signals.map(s => s.id)
  assert.ok(ids.includes('B1'), `B1 应在: ${ids.join(',')}`)
  assert.ok(ids.includes('B2'), `B2 应在: ${ids.join(',')}`)
  assert.ok(ids.includes('S1'), `S1 应在: ${ids.join(',')}`)
})

test('快速拉升触发异常检测或行为切换（非异常崩溃）', () => {
  const e = new LiveEngine('000001')
  let r = null
  let price = 10.0
  for (let i = 0; i < 60; i++) {
    price += 0.05
    r = e.feed(makeFrame(i, price, { volRatio: 3, turnover: 8 }))
  }
  assert.ok(r)
  assert.ok(r.behavior.state)
  assert.ok(Array.isArray(r.anomalies))
  assert.ok(Array.isArray(r.signals))
})

test('priceBins 少于 30 帧返回空', () => {
  const e = new LiveEngine('000001')
  for (let i = 0; i < 10; i++) e.feed(makeFrame(i, 10.0 + i * 0.01))
  assert.equal(priceBins(e.priceHist || []).length, 0)
})

test('BEHAVIORS 常量完整（6 种行为）', () => {
  const keys = Object.keys(BEHAVIORS || {})
  assert.ok(keys.length >= 6, `应有 6+ 行为，实际 ${keys.length}`)
})
