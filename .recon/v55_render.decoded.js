}
)
128
)
)
Mi.value.portfolioAdvice ? (g(
)
b("div"
i6
v(Mi.value.portfolioAdvice
)
1
)
)
: E(""
true
)
]
)
)
: E(""
true
)
xe.value.length ? (g(
)
b("div"
n6
[o[230] || (o[230] = r("div"
{ class: "ha-title" }
"📊 持仓明细"
-1
)
)
r("div"
l6
[r("span"
null
  [o[227] || (o[227] = K("总市值 "
-1
)
)
r("b"
  { class: M(Pt(bn.value.totalPnl
  )
)
}
  v(ae(bn.value.totalVal
  )
)
3
)
]
)
r("span"
null
  [o[228] || (o[228] = K("总成本 "
-1
)
)
r("b"
null
  v(ae(bn.value.totalCost
  )
)
1
)
]
)
r("span"
null
  [o[229] || (o[229] = K("总盈亏 "
-1
)
)
r("b"
  { class: M(Pt(bn.value.totalPnl
  )
)
}
  v((bn.value.totalPnl > 0 ? "+" : ""
  )
  + bn.value.totalPnl.toFixed(1
  )
)
+ "%"
3
)
]
)
]
)
(g(true
)
b(J
null
vt(bn.value.items
(h
)
  => (g(
  )
    b("div"
    { class: "ha-item"
    key: h.code }
      [r("div"
      o6
        [r("span"
        null
        v(h.name || h.code
        )
      1
      )
        r("span"
          { class: M(["hai-pct"
          Pt(h.pnl
          )
        ]
        )
        }
          v((h.pnl > 0 ? "+" : ""
          )
          + h.pnl.toFixed(1
          )
        )
        + "%"
      3
      )
    ]
    )
      r("div"
      a6
        [r("div"
          { class: M(["hai-fill"
        h.pnl >= 0 ? "up" : "down"]
        )
          style: Pe({ width: Math.abs(h.pnl
          )
        / 20 * 100 + "%" }
        )
        }
        null
      6
      )
    ]
    )
      r("div"
      r6
        [r("span"
        null
          "成本 " + v(Lt(h.cost
          )
        )
        + " \xB7 " + v(h.shares
        )
        + "股"
      1
      )
        r("span"
        null
          "占比 " + v(h.weight.toFixed(1
          )
        )
        + "%"
      1
      )
    ]
    )
  ]
  )
)
)
128
)
)
]
)
)
: E(""
true
)
Array.isArray(Ei.value
)
&& Ei.value.length ? (g(
)
b("div"
c6
[r("div"
u6
[o[231] || (o[231] = K("📝 交易日志 "
-1
)
)
r("button"
{ class: "aa-btn"
style: { float: "right"
"font-size": "12px" }
onClick: o[98] || (o[98] = (h
)
=> da.value = !da.value
)
}
v(da.value ? "收起" : "+记一笔"
)
1
)
]
)
da.value ? (g(
)
b("div"
h6
  [de(r("input"
  { class: "hm-input"
    "onUpdate:modelValue": o[99] || (o[99] = (h
    )
  => hs.stock = h
  )
  placeholder: "股票名称"
  style: { width: "100px" } }
  null
512
)
[[Ne
hs.stock]]
)
  de(r("select"
  { class: "aa-sel"
    "onUpdate:modelValue": o[100] || (o[100] = (h
    )
  => hs.type = h
  )
  }
      [...o[232] || (o[232] = [r("option"
      { value: "buy" }
      "买入"
    -1
    )
      r("option"
      { value: "sell" }
      "卖出"
    -1
    )
  ]
  )
  ]
512
)
[[fl
hs.type]]
)
  de(r("input"
  { class: "hm-input"
    "onUpdate:modelValue": o[101] || (o[101] = (h
    )
  => hs.price = h
  )
  placeholder: "价格"
  type: "number"
  step: "0.01"
  style: { width: "70px" } }
  null
512
)
[[Ne
hs.price
void 0
{ number: true }]]
)
  de(r("input"
  { class: "hm-input"
    "onUpdate:modelValue": o[102] || (o[102] = (h
    )
  => hs.shares = h
  )
  placeholder: "股数"
  type: "number"
  style: { width: "60px" } }
  null
512
)
[[Ne
hs.shares
void 0
{ number: true }]]
)
  de(r("input"
  { class: "hm-input"
    "onUpdate:modelValue": o[103] || (o[103] = (h
    )
  => hs.note = h
  )
  placeholder: "备注(可选)"
  style: { flex: "1" } }
  null
512
)
[[Ne
hs.note]]
)
r("button"
{ class: "aa-btn"
onClick: Cg }
"保存"
)
]
)
)
: E(""
true
)
(g(true
)
b(J
null
  vt(Sg.value.slice(0
20
)
(h
)
  => (g(
  )
    b("div"
    { class: "trade-item"
    key: h.id }
      [r("span"
      d6
      v(h.date
      )
    1
    )
      r("span"
      { class: M(h.type === "buy" ? "up" : "down"
      )
      }
      v(h.type === "buy" ? "买" : "卖"
      )
    3
    )
      r("span"
      null
      v(h.stock
      )
    1
    )
      r("span"
      null
        v(Lt(h.price
        )
      )
      + " \xD7 " + v(h.shares
      )
      + "股"
    1
    )
      h.note ? (g(
      )
        b("span"
        f6
        v(h.note
        )
      1
      )
    )
      : E(""
    true
    )
      r("button"
      { class: "al-del"
      onClick: (q
      )
      => Mg(h.id
      )
      }
      "\xD7"
      8
    v6
    )
  ]
  )
)
)
128
)
)
]
)
)
: E(""
true
)
Vl.value ? (g(
)
b("div"
{ key: 6
class: "hold-modal"
onClick: js(_h
["self"]
)
}
[r("div"
p6
[r("div"
m6
v(us.value ? "添加持仓" : "搜索股票"
)
1
)
us.value ? E(""
true
)
: de((g(
)
  b("input"
  { key: 0
  class: "hm-input"
    "onUpdate:modelValue": o[104] || (o[104] = (h
    )
  => Bl.value = h
  )
  placeholder: "输入代码或名称"
  onInput: dg }
  null
544
)
)
[[Ne
Bl.value]]
)
!us.value && gn.value.length ? (g(
)
b("div"
g6
  [(g(true
  )
    b(J
    null
      vt(gn.value
      (h
      )
        => (g(
        )
          b("div"
          { class: "hmr-item"
          key: h.secid
          onClick: (q
          )
          => fg(h
          )
          }
            [r("span"
            null
            v(h.name
            )
          1
          )
            r("span"
            y6
            v(h.code
            )
          1
          )
          ]
          8
        b6
        )
      )
    )
  128
  )
)
]
)
)
: E(""
true
)
us.value ? (g(
)
b("div"
_6
  [r("div"
  w6
      [o[233] || (o[233] = r("span"
      null
      "股票"
    -1
    )
  )
    r("b"
    null
    v(us.value.name
    )
    + " " + v(us.value.code
    )
  1
  )
]
)
  r("div"
  k6
      [o[234] || (o[234] = r("span"
      null
      "股数"
    -1
    )
  )
      de(r("input"
      { class: "hm-input"
        "onUpdate:modelValue": o[105] || (o[105] = (h
        )
      => we.shares = h
      )
      type: "number"
      placeholder: "如 1000" }
      null
    512
    )
    [[Ne
    we.shares
    void 0
  { number: true }]]
  )
]
)
  r("div"
  S6
      [o[235] || (o[235] = r("span"
      null
      "成本价"
    -1
    )
  )
      de(r("input"
      { class: "hm-input"
        "onUpdate:modelValue": o[106] || (o[106] = (h
        )
      => we.cost = h
      )
      type: "number"
      step: "0.01"
      placeholder: "如 4.50" }
      null
    512
    )
    [[Ne
    we.cost
    void 0
  { number: true }]]
  )
]
)
  r("button"
  { class: "ha-btn ha-add"
  style: { width: "100%"
  "margin-top": "8px" }
  onClick: vg
  disabled: !we.shares || !we.cost }
  "确认添加"
  8
x6
)
  r("button"
  { class: "ha-btn"
  style: { width: "100%"
  "margin-top": "4px"
  background: "rgba(48,54,61,0.3)"
  color: "#8b949e" }
  onClick: _h }
"取消"
)
]
)
)
: E(""
true
)
]
)
]
)
)
: E(""
true
)
r("div"
C6
[o[236] || (o[236] = r("span"
null
"💰 可用现金"
-1
)
)
de(r("input"
{ class: "hm-input"
style: { width: "120px"
"text-align": "right" }
"onUpdate:modelValue": o[107] || (o[107] = (h
)
=> Yi.value = h
)
type: "number"
placeholder: "0"
onChange: yh }
null
544
)
[[Ne
Yi.value
void 0
{ number: true }]]
)
o[237] || (o[237] = r("span"
null
"元"
-1
)
)
]
)
]
)
)
: E(""
true
)
Xi.value ? (g(
)
b("div"
M6
[r("span"
null
"已选 " + v(ui.value.length
)
+ "/5 只"
1
)
r("button"
{ onClick: dm
disabled: ui.value.length < 2 }
"⚔️ 开始对比"
8
$6
)
]
)
)
: E(""
true
)
st.value !== "zt" && st.value !== "hold" && st.value !== "strategy" && st.value !== "overview" && st.value !== "predict" ? (g(
)
b("div"
{ key: 17
class: "list"
ref_key: "listRef"
ref: $t
onScroll: im }
[(g(true
)
b(J
null
vt(te.value
(h
)
=> (g(
)
b("div"
{ class: "row"
key: h.secid
onClick: (q
)
=> Xn(h
)
}
  [r("div"
  E6
    [r("span"
    { class: "row-star"
      onClick: js((q
      )
      => Xr(h
      )
    ["stop"]
    )
    }
      v(Qt(h
      )
    ? "★" : "☆"
    )
    9
  R6
  )
    Xi.value ? (g(
    )
      b("span"
      z6
        v(ui.value.includes(h.secid
        )
      ? "☑" : "☐"
      )
    1
    )
  )
    : E(""
  true
  )
    r("span"
    L6
    v(h.name
    )
  1
  )
  Gt(h
  )
    ? (g(
    )
      b("span"
      { key: 1
        class: M(["row-board"
        "bd-" + Gt(h
        )
      .board]
      )
      }
        v(Gt(h
        )
      .board
      )
    3
    )
  )
    : E(""
  true
  )
    r("span"
    D6
    v(h.code
    )
  1
  )
    jt.value[h.code] ? (g(
    )
      b("span"
      { key: 2
      class: "row-pred"
          onClick: o[108] || (o[108] = js((q
          )
          => Ti("predict"
          )
        ["stop"]
        )
      )
      title: "预测得分 " + jt.value[h.code].score }
          v(Ue(jt.value[h.code]
        "sig_leader"
        )
      ? "👑" : "🔮"
      )
      + v(jt.value[h.code].score
      )
      + "分"
      9
    P6
    )
  )
    : E(""
  true
  )
    um.value && h.stage ? (g(
    )
      b("span"
      { key: 3
        class: M(["row-stage"
      "st-" + h.stage]
      )
      }
        v(Lr(h.stage
        )
      )
    3
    )
  )
    : E(""
  true
  )
    Ss.value === "score" ? (g(
    )
      b("span"
      { key: 4
        class: M(["row-score"
        Os(h
        )
      ]
      )
      }
        v(rs(h
        )
      )
    3
    )
  )
    : E(""
  true
  )
    r("span"
      { class: M(["row-price"
      Pt(h.change_pct
      )
    ]
    )
    }
      v(Lt(h.price
      )
    )
  3
  )
    r("span"
      { class: M(["row-pct"
      Pt(h.change_pct
      )
    ]
    )
    }
      v(Qe(h.change_pct
      )
    )
  3
  )
    at.value === "fav" ? (g(
    )
      b("span"
      { key: 5
      class: "row-hold"
        onClick: js((q
        )
        => Nm(h
        )
      ["stop"]
      )
      title: "加持仓" }
      "💼"
      8
    O6
    )
  )
    : E(""
  true
  )
    h.todayWarn ? (g(
    )
      b("span"
      A6
      v(h.todayWarn
      )
    1
    )
  )
    : E(""
  true
  )
]
)
  Ge.value.length ? (g(
  )
    b("div"
    N6
      [(g(true
      )
        b(J
        null
          vt(Ge.value
            (q
          Ms
          )
            => (g(
            )
              b("span"
              { class: "row-metric"
              key: q.key }
              v(q.label
              )
                  + " " + v(sm(h
                q.key
                )
              )
            1
            )
          )
        )
      128
      )
    )
  ]
  )
)
  : E(""
true
)
  h.scoreItems ? (g(
  )
    b("div"
    I6
      [r("span"
      F6
      "🎯 " + v(h.techScore
      )
      + "/" + v(h.scoreMax || "--"
      )
    1
    )
      (g(true
      )
        b(J
        null
            vt(h.scoreItems.slice(0
          4
          )
          (q
          )
            => (g(
            )
              b("span"
                { class: M(["rs-item"
                { ok: q.ok
              fail: !q.ok }]
              )
              key: q.label }
              v(q.ok ? "✅" : "⬜"
              )
              + v(q.label
              )
            3
            )
          )
        )
      128
      )
    )
  ]
  )
)
  : E(""
true
)
]
8
T6
)
)
)
128
)
)
z.value ? (g(
)
b("div"
V6
[o[238] || (o[238] = r("span"
{ class: "ld-spinner" }
null
-1
)
)
K(v(j.value
)
1
)
]
)
)
: te.value.length ? at.value === "all" && ot.value ? (g(
)
b("div"
j6
"— 已加载全部 " + v(ee.value
)
+ " 条 —"
1
)
)
: E(""
true
)
: (g(
)
b("div"
B6
[Fs.value ? (g(
)
b(J
{ key: 0 }
[K("RSI 筛选无结果：" + v(Fs.value === "os" ? "RSI<30 超卖票在当前行情较少（普涨日动量偏高）" : Fs.value === "ob" ? "RSI6>80 超买强势票" : "RSI 30-60 中位票"
)
+ "——可切换其他档"
1
)
]
64
)
)
: (g(
)
b(J
{ key: 1 }
[K(v(at.value === "fav" ? "该分类还没有关注，点列表行 ☆ 添加" : "暂无数据"
)
1
)
]
64
)
)
]
)
)
]
544
)
)
: E(""
true
)
]
)
)
: n.value === "compare" ? (g(
)
b("div"
W6
[r("header"
H6
[r("button"
{ class: "back-btn"
onClick: Xu }
"←"
)
r("div"
K6
[o[239] || (o[239] = K("⚔️ 对比 "
-1
)
)
r("span"
q6
v(Ko.value.length
)
+ " 只"
1
)
]
)
o[240] || (o[240] = r("button"
{ class: "star-btn"
style: { opacity: "0" } }
"★"
-1
)
)
]
)
r("div"
U6
[(g(true
)
b(J
null
vt(Ko.value
(h
)
=> (g(
)
b("div"
{ class: "cmp-card"
key: h.secid
onClick: (q
)
=> Si(h
)
}
[r("div"
X6
  [r("span"
  G6
  v(h.name
  )
1
)
  r("span"
  Q6
  v(h.code
  )
1
)
  r("span"
    { class: M(["cmp-stage"
  "st-" + h.stage]
  )
  }
    v(Lr(h.stage
    )
  )
3
)
  r("span"
    { class: M(["cmp-price"
    Pt(h.change_pct
    )
  ]
  )
  }
    v(Lt(h.price
    )
  )
    + " " + v(Qe(h.change_pct
    )
  )
3
)
]
)
r("div"
Y6
  [r("div"
  Z6
      [o[241] || (o[241] = r("span"
      null
      "PE"
    -1
    )
  )
    r("b"
    null
      v(h.pe != null ? h.pe.toFixed(1
      )
    : "--"
    )
  1
  )
]
)
  r("div"
  t4
      [o[242] || (o[242] = r("span"
      null
      "PB"
    -1
    )
  )
    r("b"
    null
      v(h.pb != null ? h.pb.toFixed(2
      )
    : "--"
    )
  1
  )
]
)
  r("div"
  e4
      [o[243] || (o[243] = r("span"
      null
      "ROE"
    -1
    )
  )
    r("b"
    { class: M(h.roe != null && h.roe > 15 ? "up" : ""
    )
    }
    v(h.roe != null ? h.roe + "%" : "--"
    )
  3
  )
]
)
  r("div"
  s4
      [o[244] || (o[244] = r("span"
      null
      "市值"
    -1
    )
  )
    r("b"
    null
    v(h.mktcap != null ? h.mktcap + "亿" : "--"
    )
  1
  )
]
)
  r("div"
  i4
      [o[245] || (o[245] = r("span"
      null
      "当日主力"
    -1
    )
  )
    r("b"
      { class: M(Pt(h.flow
      )
    )
    }
      v(h.flow != null ? ae(h.flow
      )
    : "--"
    )
  3
  )
]
)
  r("div"
  n4
      [o[246] || (o[246] = r("span"
      null
      "20日主力"
    -1
    )
  )
    r("b"
      { class: M(Pt(h.flow20
      )
    )
    }
      v(h.flow20 != null ? ae(h.flow20
      )
    : "--"
    )
  3
  )
]
)
]
)
]
8
J6
)
)
)
128
)
)
]
)
]
)
)
: n.value === "detail" ? (g(
)
b("div"
l4
[r("header"
o4
[r("button"
{ class: "back-btn"
onClick: lh }
"←"
)
r("div"
a4
[K(v((ce = a.value
)
== null ? void 0 : ce.name
)
+ " "
1
)
r("span"
r4
v((ns = a.value
)
== null ? void 0 : ns.code
)
1
)
]
)
r("button"
{ class: "star-btn"
style: { "font-size": "13px" }
onClick: o[109] || (o[109] = (h
)
=> pg(
)
)
title: "加持仓" }
"💼"
)
r("button"
{ class: M(["star-btn"
{ on: Qt(a.value
)
}]
)
onClick: o[110] || (o[110] = (h
)
=> Xr(
)
)
}
v(Qt(a.value
)
? "★" : "☆"
)
3
)
]
)
r("div"
c4
[r("button"
{ class: M({ on: l.value === "overview" }
)
onClick: o[111] || (o[111] = (h
)
=> Rm(
)
)
}
"📋 概览"
2
)
r("button"
{ class: M(["live-tab-btn"
{ on: l.value === "live" }]
)
onClick: Em }
[o[247] || (o[247] = K("📡 实盘 "
-1
)
)
vn.value ? (g(
)
b("span"
u4
)
)
: E(""
true
)
]
2
)
r("button"
{ class: M({ on: l.value === "tech" }
)
onClick: o[112] || (o[112] = (h
)
=> l.value = "tech"
)
}
"📊 技术"
2
)
r("button"
{ class: M({ on: l.value === "ai" }
)
onClick: o[113] || (o[113] = (h
)
=> l.value = "ai"
)
}
"🤖 AI"
2
)
]
)
de(r("div"
null
[!c.value && !Se.value ? (g(
)
b("div"
h4
[...o[248] || (o[248] = [r("div"
{ class: "sk-row" }
[r("div"
{ class: "sk-line w40" }
)
r("div"
{ class: "sk-line w20" }
)
]
-1
)
r("div"
{ class: "sk-block h120" }
null
-1
)
r("div"
{ class: "sk-row" }
[r("div"
{ class: "sk-line w60" }
)
r("div"
{ class: "sk-line w30" }
)
r("div"
{ class: "sk-line w50" }
)
]
-1
)
r("div"
{ class: "sk-block h180" }
null
-1
)
r("div"
{ class: "sk-row" }
[r("div"
{ class: "sk-line w80" }
)
]
-1
)
r("div"
{ class: "sk-block h60" }
null
-1
)
]
)
]
)
)
: E(""
true
)
Se.value ? (g(
)
b("div"
d4
"⚠️ " + v(Se.value
)
1
)
)
: E(""
true
)
c.value ? (g(
)
b("div"
{ key: 2
class: M(["quote-card"
Pt(c.value.change_pct
)
]
)
}
[dt.value ? (g(
)
b("div"
f4
"🔥 涨停 \xB7 " + v(dt.value.limitCount
)
+ "板 \xB7 封单 " + v(ae(dt.value.seal
)
)
+ " \xB7 " + v(qr(dt.value.firstTime
)
)
+ " 封板"
1
)
)
: E(""
true
)
r("div"
v4
v(Lt(c.value.price
)
)
1
)
r("div"
p4
[r("span"
{ class: M(["q-chg"
Pt(c.value.change_pct
)
]
)
}
v(vm(c.value.change
)
)
3
)
r("span"
{ class: M(["q-pct"
Pt(c.value.change_pct
)
]
)
}
v(Qe(c.value.change_pct
)
)
3
)
c.value._src !== "shared" ? (g(
)
b("span"
m4
"盘中数据约延迟15分钟"
)
)
: (g(
)
b("span"
g4
"实时"
)
)
]
)
r("div"
b4
[r("span"
null
"开 " + v(Lt(c.value.open
)
)
1
)
r("span"
null
"高 " + v(Lt(c.value.high
)
)
1
)
r("span"
null
"低 " + v(Lt(c.value.low
)
)
1
)
r("span"
null
"昨收 " + v(Lt(c.value.prev_close
)
)
1
)
r("span"
null
"量 " + v(pm(c.value.volume
)
)
1
)
r("span"
null
"换手 " + v(c.value.turnover != null ? c.value.turnover + "%" : "--"
)
1
)
]
)
U.value ? (g(
)
b("div"
y4
  [o[249] || (o[249] = K(" 🏷 所属行业："
-1
)
)
r("b"
null
v(U.value.industry
)
1
)
r("span"
  { class: M(Pt(U.value.indChg
  )
)
}
  "行业今日 " + v(Qe(U.value.indChg
  )
)
3
)
]
)
)
: E(""
true
)
tt.value ? (g(
)
b("div"
_4
[r("span"
  { class: M(["bd-tag"
"bd-" + tt.value.board]
)
}
v(tt.value.board
)
3
)
r("span"
null
"涨跌幅限制 \xB1" + v(tt.value.limit
)
+ "%"
1
)
tt.value.need ? (g(
)
  b("em"
  w4
  v(tt.value.need
  )
1
)
)
: E(""
true
)
]
)
)
: E(""
true
)
dt.value ? (g(
)
b("div"
k4
[r("span"
  { class: M(["zt-lb"
  rh(dt.value.limitCount
  )
]
)
}
v(dt.value.limitCount
)
+ "板"
3
)
  K(" 封单 " + v(ae(dt.value.seal
  )
)
1
)
dt.value.sealRatio != null ? (g(
)
  b("span"
  S4
  "（占流通 " + v(dt.value.sealRatio
  )
  + "%）"
1
)
)
: E(""
true
)
  K(" \xB7 " + v(qr(dt.value.firstTime
  )
)
+ " 封板" + v(dt.value.breakCount ? " \xB7 炸板" + dt.value.breakCount + "次" : ""
)
1
)
]
)
)
: E(""
true
)
]
2
)
)
: E(""
true
)
(Mn = a.value
)
!= null && Mn.scoreItems ? (g(
)
b("section"
x4
[o[255] || (o[255] = r("div"
{ class: "sec-title" }
[K("🎯 策略打分详情 \xB7 "
)
r("span"
{ class: "sec-sub" }
"基于截至昨日收盘数据"
)
]
-1
)
)
r("div"
C4
[(g(true
)
b(J
null
  vt(a.value.scoreItems
  (h
  )
    => (g(
    )
      b("div"
        { class: M(["std-item"
        { ok: h.ok
      fail: !h.ok }]
      )
      key: h.label }
        [r("span"
        M4
        v(h.ok ? "✅" : h.score > 0 ? "⬜" : "❌"
        )
      1
      )
        r("span"
        $4
        v(h.label
        )
      1
      )
        r("span"
        T4
        v(h.val
        )
      1
      )
        r("span"
        E4
        v(h.score
        )
        + "/" + v(h.max
        )
      1
      )
      ]
    2
    )
  )
)
128
)
)
]
)
a.value.todayBar || c.value ? (g(
)
b("div"
R4
  [o[254] || (o[254] = r("div"
  { class: "stdt-title" }
  "📊 今日盘中"
-1
)
)
r("div"
z4
  [r("span"
  null
      [o[250] || (o[250] = K("现价 "
    -1
    )
  )
    r("b"
        { class: M(Pt((Ql = c.value
        )
      == null ? void 0 : Ql.change_pct
      )
    )
    }
        v(Lt((Vh = c.value
        )
      == null ? void 0 : Vh.price
      )
    )
  3
  )
]
)
  r("span"
  null
      [o[251] || (o[251] = K("涨幅 "
    -1
    )
  )
    r("b"
        { class: M(Pt((Bh = c.value
        )
      == null ? void 0 : Bh.change_pct
      )
    )
    }
        v(Qe((jh = c.value
        )
      == null ? void 0 : jh.change_pct
      )
    )
  3
  )
]
)
  r("span"
  null
      [o[252] || (o[252] = K("换手 "
    -1
    )
  )
    r("b"
    null
        v(((Wh = c.value
        )
      == null ? void 0 : Wh.turnover
      )
    != null ? c.value.turnover + "%" : "--"
    )
  1
  )
]
)
  r("span"
  null
      [o[253] || (o[253] = K("量比 "
    -1
    )
  )
    r("b"
    null
      v(ph(
      )
    )
  1
  )
]
)
]
)
]
)
)
: E(""
true
)
a.value.techScore >= 7 ? (g(
)
b("div"
L4
"🟢 高分通过——各项条件匹配良好，可结合K线和资金面进一步确认后入场"
)
)
: a.value.techScore >= 5 ? (g(
)
b("div"
D4
"🟡 部分通过——核心条件满足，但个别维度有瑕疵，关注未通过项的风险"
)
)
: (g(
)
b("div"
P4
"🔴 低分——多数条件不满足，不建议按此策略操作"
)
)
]
)
)
: E(""
true
)
u.value.length && u.value.length < 40 ? (g(
)
b("div"
O4
" 🆕 上市时间短（仅 " + v(u.value.length
)
+ " 根K线）——历史数据少，结构/趋势分析暂不适用，重点关注基本面 "
1
)
)
: E(""
true
)
nt.value ? (g(
)
b("section"
A4
[o[258] || (o[258] = r("div"
{ class: "sec-title" }
[K("📋 决策面板 "
)
r("span"
{ class: "sec-sub" }
"生命周期路径 \xB7 当前阶段点亮"
)
]
-1
)
)
r("div"
N4
[(g(
)
b(J
null
  vt(V
    (h
  q
  )
    => (g(
    )
      b(J
      { key: h.key }
        [r("div"
          { class: M(["dp-node"
          [A(h.key
          )
        { on: nt.value.stage === h.key }]]
        )
        }
          [r("div"
            { class: M(["dp-dot"
          "dp-" + h.key]
          )
          }
          v(h.icon
          )
        3
        )
          r("span"
          I4
          v(h.label
          )
        1
        )
        ]
      2
      )
        q < V.length - 1 ? (g(
        )
          b("div"
          { key: 0
            class: M(["dp-arrow"
            { active: X(q
            )
          }]
          )
          }
          "➤"
        2
        )
      )
        : E(""
      true
      )
      ]
    64
    )
  )
)
64
)
)
]
)
nt.value.stage === "range" ? (g(
)
b("div"
F4
"⚪ 震荡期 \xB7 方向未明，未进入主路径，等突破信号"
)
)
: E(""
true
)
r("div"
V4
[r("span"
B4
v(nt.value.action
)
1
)
r("span"
j4
  [o[256] || (o[256] = K("信心指数 "
-1
)
)
r("b"
null
v(nt.value.confidence
)
1
)
  o[257] || (o[257] = K("/10"
-1
)
)
]
)
]
)
r("div"
W4
v(nt.value.advice
)
1
)
qo.value && qo.value !== nt.value.stage ? (g(
)
b("div"
H4
" 列表筛选口径：" + v(Lr(qo.value
)
)
+ " " + v(fm(qo.value
)
)
+ "（资金+涨幅近似）\xB7 与完整判定不同，以本面板为准 "
1
)
)
: E(""
true
)
nt.value.risks.length ? (g(
)
b("div"
K4
[(g(true
)
  b(J
  null
    vt(nt.value.risks
      (h
    q
    )
      => (g(
      )
        b("div"
        { class: "sig sig-warn"
        key: q }
        "⚠️ " + v(h
        )
      1
      )
    )
  )
128
)
)
]
)
)
: E(""
true
)
nt.value.reasons.length ? (g(
)
b("div"
q4
[(g(true
)
  b(J
  null
    vt(nt.value.reasons
      (h
    q
    )
      => (g(
      )
        b("span"
        { class: "dp-r"
        key: q }
        v(h
        )
      1
      )
    )
  )
128
)
)
]
)
)
: E(""
true
)
]
)
)
: E(""
true
)
ht.value ? (g(
)
b("div"
U4
[r("div"
J4
[r("div"
{ class: M(["vg-cell vg-score"
Um.value]
)
}
[r("span"
X4
v(ht.value.verdict
)
1
)
r("span"
G4
  [K(v(ht.value.score
  )
1
)
    o[259] || (o[259] = r("em"
    null
    "/6"
  -1
  )
)
]
)
r("span"
Q4
  [(g(
  )
    b(J
    null
      vt(6
      (h
      )
        => r("i"
        { key: h
        class: M({ on: h <= ht.value.score }
        )
        }
        null
      2
      )
    )
  64
  )
)
]
)
]
2
)
r("div"
Y4
  [o[260] || (o[260] = r("span"
  { class: "vg-title" }
  "PE 市盈率"
-1
)
)
r("span"
Z4
  v(ht.value.pe != null ? ht.value.pe.toFixed(1
  )
: "--"
)
1
)
r("span"
  { class: M(["vg-sub"
Xm.value]
)
}
v(Jm.value
)
3
)
]
)
r("div"
tT
  [o[261] || (o[261] = r("span"
  { class: "vg-title" }
  "PB 市净率"
-1
)
)
r("span"
eT
  v(ht.value.pb != null ? ht.value.pb.toFixed(2
  )
: "--"
)
1
)
r("span"
  { class: M(["vg-sub"
Qm.value]
)
}
v(Gm.value
)
3
)
]
)
r("div"
sT
  [o[262] || (o[262] = r("span"
  { class: "vg-title" }
  "ROE 净资产收益率"
-1
)
)
r("span"
iT
  [K(v(ht.value.roe != null ? ht.value.roe + "%" : "--"
  )
1
)
  ht.value.roe_est ? (g(
  )
    b("em"
    nT
  "≈估算"
  )
)
  : E(""
true
)
]
)
r("span"
  { class: M(["vg-sub"
Zm.value]
)
}
v(Ym.value
)
3
)
]
)
r("div"
lT
  [o[263] || (o[263] = r("span"
  { class: "vg-title" }
  "总市值"
-1
)
)
r("span"
oT
    v(Lt((Hh = c.value
    )
  == null ? void 0 : Hh.mktcap
  )
)
+ "亿"
1
)
r("span"
aT
v(tg.value
)
1
)
]
)
r("div"
rT
  [o[264] || (o[264] = r("span"
  { class: "vg-title" }
  "今日涨跌"
-1
)
)
r("span"
  { class: M(["vg-val"
    Pt((Kh = c.value
    )
  == null ? void 0 : Kh.change_pct
  )
]
)
}
    v(Qe((qh = c.value
    )
  == null ? void 0 : qh.change_pct
  )
)
3
)
r("span"
cT
    v(((Uh = c.value
    )
  == null ? void 0 : Uh.change_pct
  )
    > 0 ? "红盘" : ((Jh = c.value
    )
  == null ? void 0 : Jh.change_pct
  )
< 0 ? "绿盘" : "平盘"
)
1
)
]
)
]
)
ht.value.points && ht.value.points.length ? (g(
)
b("div"
uT
[(g(true
)
  b(J
  null
    vt(ht.value.points
      (h
    q
    )
      => (g(
      )
        b("div"
        { class: "vp"
        key: q }
        v(h
        )
      1
      )
    )
  )
128
)
)
]
)
)
: E(""
true
)
r("div"
hT
v(ht.value.summary
)
1
)
r("div"
dT
"PE 越低越便宜 \xB7 PB<1 破净 \xB7 ROE>15% 优秀（" + v(si(Q
)
.ROE
)
+ "）"
1
)
]
)
)
: E(""
true
)
C.value ? (g(
)
b("div"
fT
[r("div"
vT
[o[265] || (o[265] = r("span"
{ class: "fl-label" }
"💰 主力资金"
-1
)
)
r("span"
{ class: M(["fc-dir"
Pt(C.value.main
)
]
)
}
v(C.value.main >= 0 ? "净流入" : "净流出"
)
3
)
]
)
r("div"
{ class: M(["fc-net-big"
ng.value]
)
}
v(ae(C.value.main
)
)
3
)
r("div"
pT
[(g(true
)
b(J
null
  vt(sg.value
  (h
  )
    => (g(
    )
      b("div"
      { class: "fc-row"
      key: h.name }
        [r("span"
          { class: M(["fc-dot"
        h.cls]
        )
        }
        null
      2
      )
        r("span"
        mT
        v(h.name
        )
      1
      )
        r("div"
        gT
          [r("div"
            { class: M(["fc-fill"
          h.cls]
          )
          style: Pe({ width: h.width }
          )
          }
          null
        6
        )
      ]
      )
        r("span"
          { class: M(["fc-val"
          Pt(h.value
          )
        ]
        )
        }
          v(ae(h.value
          )
        )
      3
      )
    ]
    )
  )
)
128
)
)
]
)
R.value && R.value.today != null && R.value.fiveDay != null ? (g(
)
b("div"
bT
  [o[268] || (o[268] = r("div"
  { class: "fc-hist-title" }
  "📅 5日 vs 今日 主力"
-1
)
)
r("div"
yT
    [o[266] || (o[266] = r("span"
    { class: "fc-hr-label" }
    "近5日"
  -1
  )
)
  r("div"
  _T
    [r("div"
      { class: M(["fc-fill"
    R.value.fiveDay >= 0 ? "in" : "out"]
    )
    style: Pe({ width: Tt.value }
    )
    }
    null
  6
  )
]
)
  r("span"
    { class: M(["fc-val"
    Pt(R.value.fiveDay
    )
  ]
  )
  }
    v(ae(R.value.fiveDay
    )
  )
3
)
]
)
r("div"
wT
    [o[267] || (o[267] = r("span"
    { class: "fc-hr-label" }
    "今日"
  -1
  )
)
  r("div"
  kT
    [r("div"
      { class: M(["fc-fill"
    R.value.today >= 0 ? "in" : "out"]
    )
    style: Pe({ width: qt.value }
    )
    }
    null
  6
  )
]
)
  r("span"
    { class: M(["fc-val"
    Pt(R.value.today
    )
  ]
  )
  }
    v(ae(R.value.today
    )
  )
3
)
]
)
Xt.value ? (g(
)
  b("div"
  ST
  v(Xt.value
  )
1
)
)
: E(""
true
)
]
)
)
: E(""
true
)
vh.value.length ? (g(
)
b("div"
xT
  [o[269] || (o[269] = r("div"
  { class: "fc-signals-title" }
  "🧠 一眼看懂"
-1
)
)
(g(true
)
  b(J
  null
    vt(vh.value
      (h
    q
    )
      => (g(
      )
        b("div"
        { class: "fc-signal"
        key: q }
        v(h
        )
      1
      )
    )
  )
128
)
)
]
)
)
: E(""
true
)
]
)
)
: E(""
true
)
Dr.value && u.value.length ? (g(
)
b("div"
CT
"📊 全量K线后台补齐中（已显示最近800根）…"
)
)
: !u.value.length && !Se.value ? (g(
)
b("div"
MT
"📊 K线加载中…"
)
)
: E(""
true
)
(g(
)
su(sp
{ key: ((Xh = a.value
)
== null ? void 0 : Xh.secid
)
|| "k"
klines: u.value
indicators: w.value
trends: m.value
paict: y.value
"fs-title": (((Gh = a.value
)
== null ? void 0 : Gh.name
)
|| ""
)
+ " " + (((Qh = a.value
)
== null ? void 0 : Qh.code
)
|| ""
)
onTimeframe: Go
timeframe: f.value
"hold-price": Qr.value
"support-lines": kh.value
mode: ne.value
"data-klt": p.value }
null
8
["klines"
"indicators"
"trends"
"paict"
"fs-title"
"timeframe"
"hold-price"
"support-lines"
"mode"
"data-klt"]
)
)
]
512
)
[[vc
l.value === "overview"]]
)
l.value === "live" ? (g(
)
b("div"
$T
[r("div"
TT
[r("div"
ET
[r("span"
{ class: M(["lh-price"
Pt((Yh = re.value
)
== null ? void 0 : Yh.chgPct
)
]
)
}
v(Lt((Zh = re.value
)
== null ? void 0 : Zh.price
)
)
3
)
r("span"
{ class: M(["lh-chg"
Pt((td = re.value
)
== null ? void 0 : td.chgPct
)
]
)
}
v(((ed = re.value
)
== null ? void 0 : ed.chgPct
)
> 0 ? "+" : ""
)
+ v(Lt((sd = re.value
)
== null ? void 0 : sd.chgPct
2
)
)
+ "%"
3
)
r("span"
{ class: M(["lh-status"
{ off: !vn.value }]
)
}
[vn.value ? (g(
)
b("span"
RT
)
)
: E(""
true
)
K(v(vn.value ? "实时 \xB7 " + Uo.value + "秒" : "已收盘 \xB7 最后数据"
)
+ " "
1
)
Or.value ? (g(
)
b("em"
zT
"\xB7 " + v(Or.value
)
1
)
)
: E(""
true
)
]
2
)
]
)
re.value ? (g(
)
b("div"
LT
[r("span"
null
  [o[270] || (o[270] = K("今开 "
-1
)
)
r("b"
null
  v(Lt(re.value.open
  )
)
1
)
]
)
r("span"
null
  [o[271] || (o[271] = K("最高 "
-1
)
)
r("b"
DT
  v(Lt(re.value.high
  )
)
1
)
]
)
r("span"
null
  [o[272] || (o[272] = K("最低 "
-1
)
)
r("b"
PT
  v(Lt(re.value.low
  )
)
1
)
]
)
r("span"
null
  [o[273] || (o[273] = K("昨收 "
-1
)
)
r("b"
null
  v(Lt(re.value.preClose
  )
)
1
)
]
)
r("span"
null
  [o[274] || (o[274] = K("量比 "
-1
)
)
r("b"
null
    v(Lt(re.value.volRatio
  2
  )
)
1
)
]
)
r("span"
null
  [o[275] || (o[275] = K("换手 "
-1
)
)
r("b"
null
    v(Lt(re.value.turnover
  2
  )
)
+ "%"
1
)
]
)
r("span"
null
  [o[276] || (o[276] = K("主力净 "
-1
)
)
r("b"
    { class: M(Pt((id = re.value
    )
  == null ? void 0 : id.mainNet
  )
)
}
    v(mm((nd = re.value
    )
  == null ? void 0 : nd.mainNet
  )
)
3
)
Fr.value ? (g(
)
  b("em"
  { key: 0
  class: M(Fr.value === "↑" ? "up" : "down"
  )
  style: { "font-style": "normal" } }
  v(Fr.value
  )
3
)
)
: E(""
true
)
]
)
]
)
)
: E(""
true
)
]
)
r("div"
OT
[o[299] || (o[299] = r("div"
{ class: "lp-title" }
[K("📊 分析指标面板 "
)
r("span"
{ class: "lp-sub" }
"盘中实时 \xB7 与预测同口径"
)
]
-1
)
)
r("div"
AT
[o[281] || (o[281] = r("div"
{ class: "lp-name" }
"🌡 环境温度"
-1
)
)
r("div"
NT
[r("div"
IT
  [o[277] || (o[277] = r("span"
  null
  "涨停"
-1
)
)
r("b"
FT
    v(((ld = Ae.value
    )
  == null ? void 0 : ld.total
  )
?? "--"
)
1
)
]
)
r("div"
VT
  [o[278] || (o[278] = r("span"
  null
  "炸板率"
-1
)
)
r("b"
null
v(Ae.value ? Ae.value.breakRate + "%" : "--"
)
1
)
]
)
r("div"
BT
  [o[279] || (o[279] = r("span"
  null
  "连板高度"
-1
)
)
r("b"
null
v(Ae.value ? Ae.value.maxLb + "板" : "--"
)
1
)
]
)
r("div"
jT
  [o[280] || (o[280] = r("span"
  null
  "大盘方向"
-1
)
)
r("b"
{ class: M(km.value ? "up" : "down"
)
}
v(Sm.value
)
3
)
]
)
]
)
]
)
r("div"
WT
[o[287] || (o[287] = r("div"
{ class: "lp-name" }
"💰 资金真实"
-1
)
)
r("div"
HT
[r("div"
KT
  [o[282] || (o[282] = r("span"
  null
  "量比"
-1
)
)
r("b"
null
    v(Lt((od = re.value
    )
    == null ? void 0 : od.volRatio
  2
  )
)
1
)
]
)
r("div"
qT
  [o[283] || (o[283] = r("span"
  null
  "换手"
-1
)
)
r("b"
null
    v(Lt((ad = re.value
    )
    == null ? void 0 : ad.turnover
  2
  )
)
+ "%"
1
)
]
)
r("div"
UT
  [o[284] || (o[284] = r("span"
  null
  "放量方向"
-1
)
)
r("b"
{ class: M(Yu.value.cls
)
}
v(Yu.value.txt
)
3
)
]
)
r("div"
JT
  [o[285] || (o[285] = r("span"
  null
  "筹码集中"
-1
)
)
r("b"
{ class: M(Zu.value.cls
)
}
v(Zu.value.txt
)
3
)
]
)
r("div"
XT
  [o[286] || (o[286] = r("span"
  null
  "龙虎榜"
-1
)
)
r("b"
{ class: M(th.value ? "up" : ""
)
}
v(th.value ? "🔥 近5日上榜" : "未上榜"
)
3
)
]
)
]
)
]
)
r("div"
GT
[o[292] || (o[292] = r("div"
{ class: "lp-name" }
"🎨 题材"
-1
)
)
r("div"
QT
[r("div"
YT
  [o[288] || (o[288] = r("span"
  null
  "所属板块"
-1
)
)
r("b"
null
    v(((rd = U.value
    )
  == null ? void 0 : rd.industry
  )
|| "--"
)
1
)
]
)
r("div"
ZT
  [o[289] || (o[289] = r("span"
  null
  "板块涨跌"
-1
)
)
r("b"
    { class: M(Pt((cd = U.value
    )
  == null ? void 0 : cd.indChg
  )
)
}
    v(((ud = U.value
    )
  == null ? void 0 : ud.indChg
  )
    != null ? Lt(U.value.indChg
  2
  )
+ "%" : "--"
)
3
)
]
)
r("div"
tE
  [o[290] || (o[290] = r("span"
  null
  "板块地位"
-1
)
)
r("b"
null
v(xm.value
)
1
)
]
)
r("div"
eE
  [o[291] || (o[291] = r("span"
  null
  "主线标记"
-1
)
)
r("b"
{ class: M(eh.value.cls
)
}
v(eh.value.txt
)
3
)
]
)
]
)
]
)
r("div"
sE
[r("div"
iE
[o[293] || (o[293] = K("🔧 技术信号 "
-1
)
)
S.value ? (g(
)
b("em"
nE
v(S.value.verdict
)
+ " " + v(S.value.score
)
+ "/10"
1
)
)
: E(""
true
)
]
)
sh.value.length ? (g(
)
b("div"
lE
[(g(true
)
  b(J
  null
    vt(sh.value
      (h
    q
    )
      => (g(
      )
        b("div"
        { class: "lp-sig"
        key: q }
        "• " + v(h
        )
      1
      )
    )
  )
128
)
)
]
)
)
: (g(
)
b("div"
oE
"暂无实时信号（数据不足或未命中）"
)
)
Ir.value.length ? (g(
)
b("div"
aE
[r("div"
rE
"🎯 预测信号灯 \xB7 命中 " + v(Ir.value.length
)
+ " 项"
1
)
(g(true
)
  b(J
  null
    vt(Ir.value
    (h
    )
      => (g(
      )
        b("div"
        { class: "lp-sig"
        key: h.key }
          [K(v(h.name
          )
          + " "
        1
        )
          r("span"
          cE
            v(zh(h
            )
          )
        1
        )
      ]
      )
    )
  )
128
)
)
]
)
)
: E(""
true
)
]
)
r("div"
uE
[r("div"
hE
[o[294] || (o[294] = K("🎯 交易参数 "
-1
)
)
Re.value ? E(""
true
)
: (g(
)
b("em"
dE
"无预测"
)
)
]
)
r("div"
fE
[r("div"
vE
  [o[295] || (o[295] = r("span"
  null
  "入场"
-1
)
)
r("b"
pE
        [K(v(Lt((dd = (hd = Re.value
        )
      == null ? void 0 : hd.trade
      )
    == null ? void 0 : dd.entry
    )
  )
1
)
  (vd = (fd = Re.value
  )
== null ? void 0 : fd.trade
)
  != null && vd.entry_label ? (g(
  )
    b("i"
    mE
    v(Re.value.trade.entry_label
    )
  1
  )
)
  : E(""
true
)
]
)
]
)
r("div"
gE
  [o[296] || (o[296] = r("span"
  null
  "止损"
-1
)
)
r("b"
bE
      v(Lt((md = (pd = Re.value
      )
    == null ? void 0 : pd.trade
    )
  == null ? void 0 : md.stop
  )
)
1
)
]
)
r("div"
yE
  [o[297] || (o[297] = r("span"
  null
  "目标"
-1
)
)
r("b"
_E
      v(Lt((bd = (gd = Re.value
      )
    == null ? void 0 : gd.trade
    )
  == null ? void 0 : bd.target
  )
)
1
)
]
)
r("div"
wE
  [o[298] || (o[298] = r("span"
  null
  "仓位"
-1
)
)
r("b"
null
      v(Cm((_d = (yd = Re.value
      )
    == null ? void 0 : yd.trade
    )
  == null ? void 0 : _d.position
  )
)
1
)
]
)
]
)
]
)
]
)
Re.value ? (g(
)
b("div"
kE
[o[302] || (o[302] = r("div"
{ class: "fc-title" }
[K("🎯 昨晚预测 vs 今日实盘 "
)
r("em"
{ class: "sec-sub" }
"自动对照"
)
]
-1
)
)
r("div"
SE
[r("div"
xE
[r("div"
CE
    "预测入场 " + v(Lt((wd = Re.value.trade
    )
  == null ? void 0 : wd.entry
  )
)
1
)
r("div"
  { class: M(["fc-price"
    Pt((kd = re.value
    )
  == null ? void 0 : kd.chgPct
  )
]
)
}
    v(Lt((Sd = re.value
    )
  == null ? void 0 : Sd.price
  )
)
3
)
r("div"
  { class: M(["fc-status"
    ((xd = re.value
    )
  == null ? void 0 : xd.price
  )
    >= ((Cd = Re.value.trade
    )
  == null ? void 0 : Cd.entry
  )
? "st-hit" : "st-wait"]
)
}
    v(((Md = re.value
    )
  == null ? void 0 : Md.price
  )
    >= (($d = Re.value.trade
    )
  == null ? void 0 : $d.entry
  )
? "已入场 ✓" : "未到价 ⏳"
)
3
)
]
)
r("div"
ME
[r("div"
$E
    "止损 " + v(Lt((Td = Re.value.trade
    )
  == null ? void 0 : Td.stop
  )
)
1
)
  o[300] || (o[300] = r("div"
  { class: "fc-price" }
  "—"
-1
)
)
r("div"
  { class: M(["fc-status"
    ((Ed = re.value
    )
  == null ? void 0 : Ed.price
  )
    <= ((Rd = Re.value.trade
    )
  == null ? void 0 : Rd.stop
  )
? "st-hit" : "st-safe"]
)
}
    v(((zd = re.value
    )
  == null ? void 0 : zd.price
  )
    <= ((Ld = Re.value.trade
    )
  == null ? void 0 : Ld.stop
  )
? "已触发 ⚠️" : "未触发 ✓"
)
3
)
]
)
r("div"
TE
[r("div"
EE
    "目标 " + v(Lt((Dd = Re.value.trade
    )
  == null ? void 0 : Dd.target
  )
)
1
)
  o[301] || (o[301] = r("div"
  { class: "fc-price" }
  "—"
-1
)
)
r("div"
RE
  v((Pd = Re.value.trade
  )
    != null && Pd.target && ((Od = re.value
    )
  == null ? void 0 : Od.price
  )
    < Re.value.trade.target ? "差 " + ((Re.value.trade.target - re.value.price
    )
  / re.value.price * 100
  )
  .toFixed(1
  )
+ "% ⏳" : "✓ 已达成"
)
1
)
]
)
]
)
]
)
)
: E(""
true
)
xs.value ? (g(
)
b("div"
zE
[r("div"
LE
[r("span"
{ class: "radar-badge"
style: Pe({ background: xs.value.color + "22"
color: xs.value.color
border: "1px solid " + xs.value.color + "66" }
)
}
v(xs.value.emoji
)
+ " " + v(xs.value.label
)
5
)
r("span"
DE
  [o[303] || (o[303] = K("主力意图 "
-1
)
)
r("b"
null
v(xs.value.confidence
)
+ "%"
1
)
  o[304] || (o[304] = r("br"
  null
  null
-1
)
)
  o[305] || (o[305] = K("基于近 30 分钟行为"
-1
)
)
]
)
]
)
xs.value.reason ? (g(
)
b("div"
PE
v(xs.value.reason
)
1
)
)
: E(""
true
)
(Ad = xs.value.evidence
)
!= null && Ad.length ? (g(
)
b("div"
OE
[(g(true
)
  b(J
  null
    vt(xs.value.evidence
      (h
    q
    )
      => (g(
      )
        b("div"
        { class: "re-item"
        key: q }
            [o[306] || (o[306] = r("i"
            null
            "◆"
          -1
          )
        )
          K(v(h
          )
        1
        )
      ]
      )
    )
  )
128
)
)
]
)
)
: E(""
true
)
]
)
)
: E(""
true
)
Gn.value.length ? (g(
)
b("div"
AE
[r("div"
NE
[o[307] || (o[307] = r("span"
{ class: "anom-title" }
"🚨 异常操作雷达"
-1
)
)
r("span"
IE
v(Gn.value.length
)
+ " 个"
1
)
]
)
(g(true
)
b(J
null
vt(Gn.value
  (h
q
)
  => (g(
  )
    b("div"
      { class: M(["anom-item"
    h.sev === "强" ? "anom-red" : "anom-yellow"]
    )
    key: q }
      [r("div"
      FE
        [r("span"
          { class: M(["ai-sev"
        h.sev === "强" ? "ai-s-red" : "ai-s-yellow"]
        )
        }
        v(h.sev
        )
      3
      )
        r("span"
        VE
          v(Tm(h.type
          )
        )
      1
      )
        r("span"
        BE
        v(h.time
        )
      1
      )
    ]
    )
      r("div"
      jE
      v(h.data
      )
    1
    )
      r("div"
      WE
      "解读：" + v(h.read
      )
    1
    )
      r("span"
      HE
      v(h.act
      )
    1
    )
    ]
  2
  )
)
)
128
)
)
]
)
)
: E(""
true
)
Qn.value.length ? (g(
)
b("div"
KE
[o[308] || (o[308] = r("div"
{ class: "sec-title" }
[K("⚡ 买卖时机 "
)
r("span"
{ class: "tag" }
"规则引擎"
)
]
-1
)
)
(g(true
)
b(J
null
  vt(Qn.value.filter((h
  )
=> h.side === "buy"
)
(h
)
  => (g(
  )
    b("div"
    { class: "tm-buy"
    key: h.id }
      [r("div"
      qE
        [r("span"
        UE
        "🟢 " + v(h.label
        )
      1
      )
        r("span"
          { class: M(["tm-strength"
        h.strength === "强" ? "ts-strong" : "ts-mid"]
        )
        }
        v(h.strength
        )
      3
      )
        r("span"
        JE
          v(Lt(h.price
          )
        )
      1
      )
    ]
    )
      r("div"
      XE
      v(h.pos
      )
    1
    )
      r("div"
      GE
      v(h.trigger
      )
    1
    )
  ]
  )
)
)
128
)
)
(g(true
)
b(J
null
  vt(Qn.value.filter((h
  )
=> h.side === "sell"
)
(h
)
  => (g(
  )
    b("div"
    { class: "tm-sell"
    key: h.id }
      [r("div"
      QE
        [r("span"
        YE
        "🔴 " + v(h.label
        )
      1
      )
        r("span"
          { class: M(["tm-strength"
        h.strength === "强" ? "ts-strong" : "ts-mid"]
        )
        }
        v(h.strength
        )
      3
      )
        r("span"
        ZE
          v(Lt(h.price
          )
        )
      1
      )
    ]
    )
      r("div"
      tR
      v(h.pos
      )
    1
    )
      r("div"
      eR
      v(h.trigger
      )
    1
    )
  ]
  )
)
)
128
)
)
(g(true
)
b(J
null
  vt(Qn.value.filter((h
  )
=> h.side === "hold"
)
(h
)
  => (g(
  )
    b("div"
    { class: "tm-hold"
    key: h.id }
      [r("div"
      sR
        [r("span"
        iR
        "⚠️ " + v(h.label
        )
      1
      )
        r("span"
        nR
        v(h.pos
        )
      1
      )
    ]
    )
  ]
  )
)
)
128
)
)
]
)
)
: E(""
true
)
r("div"
lR
[_s(sp
{ klines: u.value
indicators: w.value
trends: Jo.value || m.value
paict: y.value
"fs-title": (((Nd = a.value
)
== null ? void 0 : Nd.name
)
|| ""
)
+ " " + (((Id = a.value
)
== null ? void 0 : Id.code
)
|| ""
)
onTimeframe: Go
timeframe: f.value
"hold-price": Qr.value
"support-lines": kh.value
mode: ne.value
"data-klt": p.value
"yday-trends": Xo.value
"pred-lines": (Fd = Re.value
)
== null ? void 0 : Fd.trade
"beh-segs": Ar.value
limits: Nr.value }
null
8
["klines"
"indicators"
"trends"
"paict"
"fs-title"
"timeframe"
"hold-price"
"support-lines"
"mode"
"data-klt"
"yday-trends"
"pred-lines"
"beh-segs"
"limits"]
)
]
)
r("div"
oR
[o[309] || (o[309] = r("div"
{ class: "sec-title"
style: { "margin-bottom": "8px" } }
[K("🤖 AI 实盘解读 "
)
r("span"
{ class: "tag"
style: { color: "#7c5cff"
background: "rgba(124,92,255,.12)" } }
"DeepSeek"
)
]
-1
)
)
r("button"
{ class: "ai-btn"
onClick: Pm
disabled: pn.value }
v(pn.value ? "分析中..." : "⚡ 生成当前盘面解读"
)
9
aR
)
Gi.value ? (g(
)
b("div"
rR
v(Gi.value
)
1
)
)
: E(""
true
)
]
)
]
)
)
: E(""
true
)
de(r("div"
null
[r("section"
cR
[r("div"
uR
[o[310] || (o[310] = K("📊 技术指标 "
-1
)
)
r("button"
{ class: "mini-btn"
style: { "margin-left": "auto" }
onClick: o[114] || (o[114] = (h
)
=> pt.value = true
)
}
"💡 指标怎么看"
)
]
)
w.value.ma ? (g(
)
b("div"
hR
[r("div"
dR
  [o[311] || (o[311] = r("div"
  { class: "il" }
  "MA5/10/20"
-1
)
)
r("div"
fR
  [r("span"
  vR
      v(Ns((Vd = w.value.ma
      )
    == null ? void 0 : Vd[5]
    )
  )
1
)
  r("span"
  pR
      v(Ns((Bd = w.value.ma
      )
    == null ? void 0 : Bd[10]
    )
  )
1
)
  r("span"
  mR
      v(Ns((jd = w.value.ma
      )
    == null ? void 0 : jd[20]
    )
  )
1
)
]
)
r("div"
gR
  v(si(Q
  )
.MA
)
1
)
]
)
r("div"
bR
  [o[312] || (o[312] = r("div"
  { class: "il" }
  "MACD"
-1
)
)
r("div"
yR
    " DIF " + v(Ns((Wd = w.value.macd
    )
    == null ? void 0 : Wd.dif
  3
  )
)
    + " DEA " + v(Ns((Hd = w.value.macd
    )
    == null ? void 0 : Hd.dea
  3
  )
)
1
)
r("div"
_R
  v(si(Q
  )
.MACD
)
1
)
]
)
r("div"
wR
  [o[313] || (o[313] = r("div"
  { class: "il" }
  "RSI14"
-1
)
)
r("div"
  { class: M(["iv"
gm.value]
)
}
    v(Ns((Kd = w.value.rsi
    )
    == null ? void 0 : Kd[14]
  1
  )
)
3
)
r("div"
kR
  v(si(Q
  )
.RSI
)
1
)
]
)
r("div"
SR
  [o[314] || (o[314] = r("div"
  { class: "il" }
  "KDJ"
-1
)
)
r("div"
xR
    "K " + v(Ns((qd = w.value.kdj
    )
  == null ? void 0 : qd.k
  )
)
    + " D " + v(Ns((Ud = w.value.kdj
    )
  == null ? void 0 : Ud.d
  )
)
    + " J " + v(Ns((Jd = w.value.kdj
    )
  == null ? void 0 : Jd.j
  )
)
1
)
r("div"
CR
  v(si(Q
  )
.KDJ
)
1
)
]
)
r("div"
MR
  [o[316] || (o[316] = r("div"
  { class: "il" }
  "BOLL(20,2)"
-1
)
)
r("div"
$R
      [K(" 上 " + v(Ns((Xd = w.value.boll
      )
    == null ? void 0 : Xd.upper
    )
  )
1
)
    o[315] || (o[315] = r("br"
    null
    null
  -1
  )
)
      K(" 中 " + v(Ns((Gd = w.value.boll
      )
    == null ? void 0 : Gd.mid
    )
  )
      + " 下 " + v(Ns((Qd = w.value.boll
      )
    == null ? void 0 : Qd.lower
    )
  )
1
)
]
)
r("div"
TR
  v(si(Q
  )
.BOLL
)
1
)
]
)
r("div"
ER
  [o[318] || (o[318] = r("div"
  { class: "il" }
  "量能"
-1
)
)
r("div"
RR
    [o[317] || (o[317] = K(" 量比 "
  -1
  )
)
  r("b"
  { class: M(lg.value
  )
  }
    v(ph(
    )
  )
3
)
]
)
r("div"
zR
  v(si(Q
  )
.量比
)
1
)
]
)
]
)
)
: E(""
true
)
]
)
S.value ? (g(
)
b("section"
LR
[r("div"
DR
[o[319] || (o[319] = K("📈 K线分析 "
-1
)
)
r("span"
PR
"综合评分 " + v(S.value.score ?? "--"
)
+ "/10"
1
)
]
)
r("div"
{ class: M(["ka-verdict"
eg.value]
)
}
v(S.value.verdict || S.value.trend
)
3
)
r("div"
OR
[r("div"
AR
  [o[320] || (o[320] = r("div"
  { class: "il" }
  "近5日"
-1
)
)
r("div"
  { class: M(["iv"
  Pt(S.value.chg_5d
  )
]
)
}
  v(Qe(S.value.chg_5d
  )
)
3
)
]
)
r("div"
NR
  [o[321] || (o[321] = r("div"
  { class: "il" }
  "近20日"
-1
)
)
r("div"
  { class: M(["iv"
  Pt(S.value.chg_20d
  )
]
)
}
  v(Qe(S.value.chg_20d
  )
)
3
)
]
)
r("div"
IR
  [o[322] || (o[322] = r("div"
  { class: "il" }
  "均线"
-1
)
)
r("div"
FR
v(S.value.ma_status
)
1
)
]
)
r("div"
VR
  [o[324] || (o[324] = r("div"
  { class: "il" }
  "RSI/KDJ"
-1
)
)
r("div"
BR
  [K("RSI " + v(S.value.rsi ?? "--"
  )
1
)
    o[323] || (o[323] = r("br"
    null
    null
  -1
  )
)
  K("J " + v(S.value.kdj_j ?? "--"
  )
1
)
]
)
]
)
r("div"
jR
  [o[325] || (o[325] = r("div"
  { class: "il" }
  "支撑"
-1
)
)
r("div"
WR
  v(Lt(S.value.support
  )
)
1
)
]
)
r("div"
HR
  [o[326] || (o[326] = r("div"
  { class: "il" }
  "压力"
-1
)
)
r("div"
KR
  v(Lt(S.value.resistance
  )
)
1
)
]
)
]
)
S.value.signals && S.value.signals.length ? (g(
)
b("div"
qR
[(g(true
)
  b(J
  null
    vt(S.value.signals
      (h
    q
    )
      => (g(
      )
        b("div"
        { class: "sig"
        key: q }
        "• " + v(h
        )
      1
      )
    )
  )
128
)
)
]
)
)
: E(""
true
)
r("div"
UR
v(S.value.summary
)
1
)
r("div"
JR
v(si(Q
)
.评分
)
1
)
]
)
)
: E(""
true
)
D.value ? (g(
)
b("section"
XR
[o[327] || (o[327] = r("div"
{ class: "sec-title" }
[K("🐂 主力做局 "
)
r("span"
{ class: "sec-sub" }
"长线视角 \xB7 主力战期可达1-2年"
)
]
-1
)
)
r("div"
GR
[(g(true
)
b(J
null
  vt(yt.value
    (h
  q
  )
    => (g(
    )
      b("div"
      { class: "mf-cell"
      key: q }
        [r("div"
        QR
        v(h.label
        )
      1
      )
        r("div"
          { class: M(["iv"
          Pt(h.value
          )
        ]
        )
        }
          v(h.value != null ? ae(h.value
          )
        : "--"
        )
      3
      )
    ]
    )
  )
)
128
)
)
]
)
$.value.length ? (g(
)
b("div"
YR
[(g(true
)
  b(J
  null
    vt($.value
      (h
    q
    )
      => (g(
      )
        b("div"
          { class: M(["sig"
        "sig-" + h.level]
        )
        key: q }
        v(h.text
        )
      3
      )
    )
  )
128
)
)
]
)
)
: E(""
true
)
o[328] || (o[328] = r("div"
{ class: "il-exp" }
"当日骗人 \xB7 看20日 \xB7 户数看筹码（数据季度更新）"
-1
)
)
]
)
)
: E(""
true
)
I.value ? (g(
)
b("section"
ZR
[o[335] || (o[335] = r("div"
{ class: "sec-title" }
"📊 今日盘中量价分析"
-1
)
)
r("div"
t8
[r("div"
e8
  [o[329] || (o[329] = r("span"
  null
  "均价(VWAP)"
-1
)
)
r("b"
null
  v(Lt(I.value.vwap
  )
)
1
)
]
)
r("div"
s8
  [o[330] || (o[330] = r("span"
  null
  "现价vs均价"
-1
)
)
r("b"
  { class: M(Pt(I.value.vsVwap
  )
)
}
v(I.value.vsVwap > 0 ? "+" : ""
)
  + v(I.value.vsVwap.toFixed(1
  )
)
+ "%"
3
)
]
)
r("div"
i8
  [o[331] || (o[331] = r("span"
  null
  "振幅"
-1
)
)
r("b"
null
  v(I.value.amplitude.toFixed(1
  )
)
+ "%"
1
)
]
)
r("div"
n8
  [o[332] || (o[332] = r("span"
  null
  "分时强度"
-1
)
)
r("b"
  { class: M(Pt(I.value.strength > 0 ? I.value.strength : -1
  )
)
}
v(I.value.strength > 0 ? "偏多" : "偏空"
)
3
)
]
)
]
)
(Yd = I.value.zones
)
!= null && Yd.length ? (g(
)
b("div"
l8
  [o[333] || (o[333] = r("div"
  { class: "idz-title" }
  "💰 成交密集价位"
-1
)
)
(g(true
)
  b(J
  null
    vt(I.value.zones
    (h
    )
      => (g(
      )
        b("div"
        { class: "idz-item"
        key: h.price }
          [r("span"
          null
            v(Lt(h.price
            )
          )
            + " ~ " + v(Lt(h.price2
            )
          )
        1
        )
          r("span"
          o8
          v(h.pct
          )
          + "%"
        1
        )
          r("span"
            { class: M(["idz-type"
          h.type === "accum" ? "green" : "red"]
          )
          }
          v(h.type === "accum" ? "吸筹" : "出货"
          )
        3
        )
      ]
      )
    )
  )
128
)
)
]
)
)
: E(""
true
)
(Zd = I.value.bigOrders
)
!= null && Zd.length ? (g(
)
b("div"
a8
  [o[334] || (o[334] = r("div"
  { class: "idz-title" }
  "🔔 大单异动"
-1
)
)
(g(true
)
  b(J
  null
    vt(I.value.bigOrders
    (h
    )
      => (g(
      )
        b("div"
        { class: "idb-item"
        key: h.time }
          [r("span"
          r8
          v(h.time
          )
        1
        )
          r("span"
            { class: M(["idb-dir"
          h.type === "buy" ? "green" : "red"]
          )
          }
          v(h.type === "buy" ? "买入" : "卖出"
          )
        3
        )
          r("span"
          null
            v(ae(h.amount
            )
          )
        1
        )
      ]
      )
    )
  )
128
)
)
]
)
)
: E(""
true
)
]
)
)
: E(""
true
)
y.value ? (g(
)
b("section"
c8
[o[338] || (o[338] = r("div"
{ class: "sec-title" }
[K("📐 PA/ICT 结构分析 "
)
r("span"
{ class: "sec-sub" }
"价格行为 \xB7 聪明钱视角"
)
]
-1
)
)
r("div"
{ class: M(["pa-struct"
"pa-" + y.value.structure]
)
}
v(y.value.structureText
)
3
)
r("div"
u8
[r("div"
h8
  [o[336] || (o[336] = r("div"
  { class: "il" }
  "支撑"
-1
)
)
r("div"
d8
  v(y.value.supports.map(Lt
  )
  .join(" / "
  )
|| "--"
)
1
)
]
)
r("div"
f8
  [o[337] || (o[337] = r("div"
  { class: "il" }
  "阻力"
-1
)
)
r("div"
v8
  v(y.value.resistances.map(Lt
  )
  .join(" / "
  )
|| "--"
)
1
)
]
)
]
)
y.value.liquidityText ? (g(
)
b("div"
p8
v(y.value.liquidityText
)
1
)
)
: E(""
true
)
y.value.signals && y.value.signals.length ? (g(
)
b("div"
m8
[(g(true
)
  b(J
  null
    vt(y.value.signals
      (h
    q
    )
      => (g(
      )
        b("div"
          { class: M(["sig"
        "sig-" + h.dir]
        )
        key: q }
        v(h.dir === "bullish" ? "🟢" : h.dir === "bearish" ? "🔴" : "⚪"
        )
        + " " + v(h.text
        )
      3
      )
    )
  )
128
)
)
]
)
)
: E(""
true
)
y.value.orderBlocks && y.value.orderBlocks.length ? (g(
)
b("div"
g8
[(g(true
)
  b(J
  null
    vt(y.value.orderBlocks
      (h
    q
    )
      => (g(
      )
        b("div"
        { class: "sig"
        key: "ob" + q }
        "🏦 " + v(h.text
        )
      1
      )
    )
  )
128
)
)
]
)
)
: E(""
true
)
y.value.fvgs && y.value.fvgs.length ? (g(
)
b("div"
b8
[(g(true
)
  b(J
  null
    vt(y.value.fvgs
      (h
    q
    )
      => (g(
      )
        b("div"
        { class: "sig"
        key: "f" + q }
        "🕳️ " + v(h.text
        )
      1
      )
    )
  )
128
)
)
]
)
)
: E(""
true
)
o[339] || (o[339] = r("div"
{ class: "il-exp" }
"图上虚线：绿=支撑 \xB7 红=阻力（PA 关键价位）"
-1
)
)
]
)
)
: E(""
true
)
]
512
)
[[vc
l.value === "tech"]]
)
de(r("div"
null
[r("section"
y8
[r("div"
_8
[o[340] || (o[340] = K("🤖 AI 分析 "
-1
)
)
r("button"
{ class: "mini-btn"
onClick: dh
disabled: Bt.value }
v(Bt.value ? "分析中..." : Un.value ? "重新分析" : "开始分析"
)
9
w8
)
]
)
!Ji.value && !ct.value ? (g(
)
b("div"
k8
"AI 分析走后端代理（无需 Key）；代理不可用时可在 ⚙️ 设置 DeepSeek Key"
)
)
: ct.value ? (g(
)
b("div"
S8
[Un.value ? (g(
)
b("div"
x8
"📌 " + v(Un.value
)
+ " 生成（点「重新分析」获取最新）"
1
)
)
: E(""
true
)
ue.value ? (g(
)
b(J
{ key: 1 }
  [r("div"
    { class: M(["llm-hero"
  he.value]
  )
  }
    [r("span"
    C8
    v(ct.value.verdict
    )
  1
  )
    r("span"
    M8
      [K(v(ct.value.score
      )
    1
    )
        o[341] || (o[341] = r("em"
        null
        "/10"
      -1
      )
    )
  ]
  )
    r("span"
    $8
      [(g(
      )
        b(J
        null
          vt(10
          (h
          )
            => r("i"
            { key: h
              class: M({ on: h <= (ct.value.score || 0
              )
            }
            )
            }
            null
          2
          )
        )
      64
      )
    )
  ]
  )
  ]
2
)
  r("div"
  T8
  "💬 " + v(ct.value.summary
  )
1
)
  r("div"
  E8
    [r("div"
    R8
        [o[342] || (o[342] = r("span"
        { class: "llm-sec-tag fu" }
        "💰 基本面"
      -1
      )
    )
      r("span"
      null
      v(ct.value.fundamental
      )
    1
    )
  ]
  )
    r("div"
    z8
        [o[343] || (o[343] = r("span"
        { class: "llm-sec-tag te" }
        "📈 技术面"
      -1
      )
    )
      r("span"
      null
      v(ct.value.technical
      )
    1
    )
  ]
  )
    r("div"
    L8
        [o[344] || (o[344] = r("span"
        { class: "llm-sec-tag mo" }
        "💸 资金面"
      -1
      )
    )
      r("span"
      null
      v(ct.value.money_flow
      )
    1
    )
  ]
  )
]
)
  ct.value.risks && ct.value.risks.length ? (g(
  )
    b("div"
    D8
        [o[345] || (o[345] = r("div"
        { class: "llm-risks-title" }
        "⚠️ 风险提示"
      -1
      )
    )
      (g(true
      )
        b(J
        null
          vt(ct.value.risks
            (h
          q
          )
            => (g(
            )
              b("div"
              { class: "vp"
              key: q }
              "\xB7 " + v(h
              )
            1
            )
          )
        )
      128
      )
    )
  ]
  )
)
  : E(""
true
)
  r("div"
  P8
  "✅ 建议：" + v(ct.value.action
  )
1
)
]
64
)
)
: (g(
)
b("div"
O8
v(ct.value
)
1
)
)
]
)
)
: (g(
)
b("div"
A8
"点击「开始分析」，AI 用大白话给你讲这只股票"
)
)
]
)
Ji.value ? (g(
)
b("section"
N8
[o[347] || (o[347] = r("div"
{ class: "sec-title" }
"💬 AI 问答"
-1
)
)
r("div"
{ class: "chat-box"
ref_key: "chatBoxRef"
ref: ia }
[(g(true
)
b(J
null
  vt(Nl.value
    (h
  q
  )
    => (g(
    )
      b("div"
        { class: M(["chat-msg"
      h.role]
      )
      key: q }
        [r("div"
        I8
        v(h.content
        )
      1
      )
      ]
    2
    )
  )
)
128
)
)
Fl.value ? (g(
)
b("div"
F8
    [...o[346] || (o[346] = [r("div"
    { class: "chat-bubble" }
    "思考中..."
  -1
  )
]
)
]
)
)
: E(""
true
)
]
512
)
r("div"
V8
[de(r("input"
  { "onUpdate:modelValue": o[115] || (o[115] = (h
  )
=> Il.value = h
)
  onKeyup: b0(fh
["enter"]
)
placeholder: "问问AI：这只股票现在能买吗？" }
null
544
)
[[Ne
Il.value]]
)
r("button"
{ onClick: fh
disabled: Fl.value }
"发送"
8
B8
)
]
)
]
)
)
: E(""
true
)
]
512
)
[[vc
l.value === "ai"]]
)
o[348] || (o[348] = r("div"
{ class: "foot-space" }
null
-1
)
)
]
)
)
: n.value === "sector" ? (g(
)
b("div"
j8
[r("header"
W8
[r("button"
{ class: "back-btn"
onClick: o[116] || (o[116] = (h
)
=> n.value = "home"
)
}
"←"
)
r("div"
H8
[K(v(Ds.value.name
)
+ " "
1
)
r("span"
K8
v(Ds.value.change_pct != null ? Qe(Ds.value.change_pct
)
: ""
)
+ " \xB7 " + v(T.value.length
)
+ "只成分股"
1
)
]
)
o[349] || (o[349] = r("div"
{ style: { width: "34px" } }
null
-1
)
)
]
)
r("div"
q8
[(g(true
)
b(J
null
vt(T.value
(h
)
=> (g(
)
b("div"
{ class: "row"
key: h.secid
onClick: (q
)
=> Si(h
)
}
[r("span"
{ class: "star"
  onClick: js((q
  )
  => Xr(h
  )
["stop"]
)
}
  v(Qt(h
  )
? "★" : "☆"
)
9
J8
)
r("span"
X8
v(h.name
)
1
)
r("span"
G8
v(h.code
)
1
)
r("span"
  { class: M(["price"
  Pt(h.change_pct
  )
]
)
}
v(h.price
)
3
)
r("span"
  { class: M(["pct"
  Pt(h.change_pct
  )
]
)
}
  v(Qe(h.change_pct
  )
)
3
)
]
8
U8
)
)
)
128
)
)
T.value.length ? E(""
true
)
: (g(
)
b("div"
{ key: 0
class: "empty"
onClick: o[117] || (o[117] = (h
)
=> na.value && la(Ds.value
)
)
}
v(na.value ? "加载失败，点击重试" : "加载中..."
)
1
)
)
]
)
]
)
)
: E(""
true
)
];
