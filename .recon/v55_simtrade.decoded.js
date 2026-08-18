__name: "SimTrade", props: { mode: { type: String, default: "swing" } }, setup(s) {
  const t = s, e = [{ key: "short", icon: "⚡", name: "超短", desc: "打板\xB7持仓1-3天" }, { key: "swing", icon: "📈", name: "波段", desc: "趋势\xB7持仓2-8周" }, { key: "long", icon: "🏦", name: "长线", desc: "价值\xB7持仓6月+" }], i = { sig_leader: "龙头", sig_trend: "趋势", sig_breakH: "突破", sig_vcp: "VCP", sig_maBull: "多头", sig_maTight: "粘合", sig_bollSq: "布林收口", sig_wyckoff: "吸筹", sig_fib: "斐波", sig_kdj: "KDJ金叉", sig_volDry: "地量", sig_value: "价值" }, n = P(""), l = P(false), a = P([]), c = P(null), u = P(120), f = P(1), p = P(5), m = P(false), y = P(""), w = P(null);
  async function S() {
    if (n.value.trim()) {
      l.value = true;
      try {
        const D = await ru(n.value.trim(), 12);
        a.value = (D || []).map((N) => ({ secid: N.secid, code: N.code, name: N.name, board: N.board || "" }));
      } catch {
        a.value = [];
      }
      l.value = false;
    }
  }
  function C(D) {
    c.value = D, a.value = [], n.value = "", w.value = null;
  }
  function O(D, N, $, I) {
    var Ps, Ss;
    const U = D.length;
    if (U < 25) return { score: 0, sigs: {} };
    const tt = D.map((Yt) => Yt.close), dt = D.map((Yt) => Yt.high), nt = D.map((Yt) => Yt.low), W = D.map((Yt) => Yt.volume), V = tt[U - 1], A = (Yt) => {
      for (let Ft = Yt.length - 1; Ft >= 0; Ft--) if (Yt[Ft] != null) return Yt[Ft];
      return null;
    }, X = A(N.ma[5]), yt = A(N.ma[10]), Tt = A(N.ma[20]), qt = A(N.ma[60]), Xt = A(N.macd.dif);
    A(N.macd.dea);
    const ht = A(N.rsi[14]), ct = A(N.volRatio), Bt = U >= 6 ? (tt[U - 1] / tt[U - 6] - 1) * 100 : 0, ue = { short: 5, swing: 20, long: 60 }[I] || 20, he = U > ue ? (tt[U - 1] / tt[U - 1 - ue] - 1) * 100 : 0, Se = { short: yt, swing: Tt, long: qt }[I] || Tt, Ie = { short: 5, swing: 10, long: 20 }[I] || 10, Ke = { short: 0.8, swing: 0.85, long: 0.85 }[I] || 0.85, ye = D.slice(-Ie).map((Yt) => (Yt.high - Yt.low) / Yt.close * 100), Ut = Math.max(1, Math.floor(Ie / 2)), fe = ye.length >= Ie && ye.slice(Ut).reduce((Yt, Ft) => Yt + Ft, 0) / Ut < ye.slice(0, Ut).reduce((Yt, Ft) => Yt + Ft, 0) / Ut * Ke, _e = he > 0 && Bt > 0 && V > Se && X > Se, ks = fe && ct > ({ short: 1.3, swing: 1.1, long: 1.1 }[I] || 1.1), Ds = (I === "long" ? Tt > qt : I === "short" ? X > yt && yt > Tt : X > Tt && yt > Tt && Tt > qt) && Xt > 0, T = I !== "short" && ct < 0.85 && ht > 30 && ht < 60 && ($ == null ? void 0 : $.chg_20d) < 5 && ($ == null ? void 0 : $.chg_20d) > -5, L = false, H = false, it = { short: 10, swing: 20, long: 60 }[I] || 20, G = Math.max(...dt.slice(-it)), et = Math.min(...nt.slice(-it)), xt = G - (G - et) * 0.382, _t = G - (G - et) * 0.618, Q = V >= _t && V <= xt && ct > 0.9 && ht < 50;
    let st = false;
    if (N.boll && N.boll.mid && N.boll.upper) {
      const Yt = N.boll.mid, Ft = N.boll.upper, Ve = (Ft[Ft.length - 1] - Yt[Yt.length - 1]) * 2;
      let rs = 0, Os = 0;
      for (let ie = Math.max(0, U - 20); ie < U; ie++) Ft[ie] != null && Yt[ie] != null && (rs += (Ft[ie] - Yt[ie]) * 2, Os++);
      const fn = Os > 0 ? rs / Os : Ve, qe = { short: 0.6, swing: 0.65, long: 0.7 }[I] || 0.65;
      st = Ve < fn * qe && Math.abs(V - Yt[Yt.length - 1]) / Yt[Yt.length - 1] < 0.02;
    }
    const at = N.kdj || {}, Mt = A(at.k) || 50, It = A(at.d) || 50, ee = ((Ps = at.k) == null ? void 0 : Ps[U - 2]) || 50, z = ((Ss = at.d) == null ? void 0 : Ss[U - 2]) || 50, j = ee < z && Mt > It && (A(at.j) || 50) < ({ short: 80, swing: 100, long: 60 }[I] || 100), ot = { short: { r: 0.5, lo: -10, hi: 5 }, swing: { r: 0.5, lo: -20, hi: 8 }, long: { r: 0.4, lo: -30, hi: 15 } }[I] || { r: 0.5, lo: -20, hi: 8 }, $t = W.slice(-20).reduce((Yt, Ft) => Yt + Ft, 0) / 20, Kt = $t > 0 && W[U - 1] < $t * ot.r && ($ == null ? void 0 : $.chg_20d) > ot.lo && ($ == null ? void 0 : $.chg_20d) < ot.hi, te = { short: 1.5, swing: 1.3, long: 1.2 }[I] || 1.3, jt = V >= G * 0.995 && ct > te, Qt = { short: { gap: 2.5, vr: 1.3, mas: [5, 10, 20] }, swing: { gap: 3, vr: 1.1, mas: [5, 10, 20] }, long: { gap: 5, vr: 1.1, mas: [10, 20, 60] } }[I] || { gap: 3, vr: 1.1, mas: [5, 10, 20] }, Gt = Qt.mas.map((Yt) => A(N.ma[Yt])).filter((Yt) => Yt != null), Ot = Gt.length === 3 ? (Math.max(...Gt) / Math.min(...Gt) - 1) * 100 : 99, se = Gt.length === 3 && Ot < Qt.gap && ct > Qt.vr, ve = { sig_leader: L, sig_trend: _e, sig_breakH: jt, sig_vcp: ks, sig_maBull: Ds, sig_value: H, sig_wyckoff: T, sig_fib: Q, sig_bollSq: st, sig_kdj: j, sig_volDry: Kt, sig_maTight: se }, Ee = { short: 2, swing: 2, long: 1 }[I] || 2, Xe = { short: 0, swing: 1, long: 2 }[I] || 1;
    let Fe = 0;
    for (const Yt of ["sig_trend", "sig_vcp", "sig_maBull", "sig_fib", "sig_bollSq", "sig_kdj", "sig_volDry", "sig_breakH", "sig_maTight"]) ve[Yt] && (Fe += 1);
    return ve.sig_wyckoff && (Fe += 1), ve.sig_leader && (Fe += Ee), ve.sig_value && (Fe += Xe), { score: Fe, sigs: ve };
  }
  async function R() {
    if (c.value) {
      m.value = true, w.value = null, y.value = "拉取K线...";
      try {
        const D = await ii(c.value.secid, 101);
        if (!D || D.length < 60) {
          y.value = "K线数据不足", m.value = false;
          return;
        }
        const N = D.length, $ = Math.max(25, N - u.value), I = [];
        let U = null;
        for (let yt = $; yt + f.value < N; yt++) {
          y.value = `模拟中 ${yt - $ + 1}/${N - f.value - $}`;
          const Tt = D.slice(0, yt + 1), qt = Rs(Tt, t.mode), Xt = zs(Tt, qt, t.mode), ht = O(Tt, qt, Xt, t.mode);
          if (ht.score <= 0) continue;
          const ct = yt + 1, Bt = D[ct].open, ue = +(Bt * (1 - p.value / 100)).toFixed(2);
          let he = null, Se = null, Ie = "持有到期";
          for (let Ut = ct; Ut < Math.min(ct + f.value, N); Ut++) if (D[Ut].low <= ue) {
            he = Ut, Se = ue, Ie = "止损";
            break;
          }
          he === null && (he = Math.min(ct + f.value - 1, N - 1), Se = D[he].close);
          const Ke = (Se - Bt) / Bt * 100, ye = Object.entries(ht.sigs).filter(([Ut, fe]) => fe).map(([Ut]) => i[Ut] || Ut).join("/");
          I.push({ buyDate: D[ct].time, buy: Bt, exitDate: D[he].time, exit: Se, ret: Ke, reason: Ie, sigs: ye, score: ht.score }), U === null && (U = { date: D[yt].time, score: ht.score, sigs: { ...ht.sigs }, buy: Bt });
        }
        const tt = I.length, dt = I.filter((yt) => yt.ret > 0).length, nt = tt ? Math.round(dt / tt * 100) : 0, W = I.reduce((yt, Tt) => yt + Tt.ret, 0), V = tt ? W / tt : 0, A = tt ? Math.min(...I.map((yt) => yt.ret)) : 0;
        let X;
        tt ? nt >= 60 && V > 0 ? X = `✅ ${nt}% 胜率且平均盈利，这套信号对该股在该区间表现稳定` : nt >= 45 && V > 0 ? X = "⚠️ 信号有正收益但胜率一般，注意单笔止损纪律" : X = `❌ 胜率 ${nt}%、平均 ${V.toFixed(2)}%——该股此区间信号效果差，谨慎参考` : X = "回退期间无信号触发。可以试更早日期/更长区间/换股。", w.value = { total: tt, wins: dt, winRate: nt, totalRet: W, avgRet: V, maxLoss: A, verdict: X, trades: I.slice(0, 200), lastSig: U }, y.value = "";
      } catch (D) {
        y.value = "出错：" + D.message;
      }
      m.value = false;
    }
  }
  return (D, N) => (g(), b("div", S_, [N[16] || (N[16] = r("div", { class: "sim-head" }, [r("div", { class: "sim-title" }, "🧪 个股模拟交易回测"), r("div", { class: "sim-hint" }, "回退到历史节点 → 只用当时数据算信号 → 模拟次日买入持有卖出。无未来函数，信号逻辑与预测完全一致。")], -1)), r("div", x_, [de(r("input", { class: "aa-input", "onUpdate:modelValue": N[0] || (N[0] = ($) => n.value = $), placeholder: "输入股票名称/代码，如：601168 或 中际旭创", onKeyup: b0(S, ["enter"]) }, null, 544), [[Ne, n.value]]), r("button", { class: "aa-btn", onClick: S, disabled: l.value }, v(l.value ? "搜索中..." : "🔍 搜索"), 9, C_)]), a.value.length ? (g(), b("div", M_, [(g(true), b(J, null, vt(a.value, ($) => (g(), b("div", { class: "sim-item", key: $.secid, onClick: (I) => C($) }, [r("b", null, v($.name), 1), r("em", null, v($.code), 1), r("i", null, v($.board), 1)], 8, $_))), 128))])) : E("", true), c.value ? (g(), b("div", T_, [K(" ✅ " + v(c.value.name) + "（" + v(c.value.code) + "）", 1), r("button", { class: "aa-btn", style: { "margin-left": "6px" }, onClick: N[1] || (N[1] = ($) => {
    c.value = null, a.value = [];
  }) }, "换股")])) : E("", true), c.value ? (g(), b("div", E_, [r("div", R_, [N[5] || (N[5] = r("label", null, "回退到", -1)), de(r("input", { class: "aa-input", type: "range", min: "30", max: "500", step: "1", "onUpdate:modelValue": N[2] || (N[2] = ($) => u.value = $) }, null, 512), [[Ne, u.value, void 0, { number: true }]]), r("b", null, v(u.value) + " 个交易日前", 1)]), r("div", z_, [N[7] || (N[7] = r("label", null, "持有", -1)), de(r("select", { class: "aa-input", "onUpdate:modelValue": N[3] || (N[3] = ($) => f.value = $) }, [...N[6] || (N[6] = [r("option", { value: 1 }, "1 天（次日卖）", -1), r("option", { value: 3 }, "3 天", -1), r("option", { value: 5 }, "5 天", -1), r("option", { value: 10 }, "10 天", -1)])], 512), [[fl, f.value, void 0, { number: true }]]), N[8] || (N[8] = r("label", { style: { "margin-left": "10px" } }, "模式", -1)), r("em", L_, v((e.find(($) => $.key === s.mode) || {}).name) + "（" + v((e.find(($) => $.key === s.mode) || {}).desc) + "）", 1)]), r("div", D_, [N[10] || (N[10] = r("label", null, "止损", -1)), de(r("select", { class: "aa-input", "onUpdate:modelValue": N[4] || (N[4] = ($) => p.value = $) }, [...N[9] || (N[9] = [r("option", { value: 5 }, "-5%", -1), r("option", { value: 8 }, "-8%", -1), r("option", { value: 10 }, "-10%", -1)])], 512), [[fl, p.value, void 0, { number: true }]]), r("button", { class: "aa-btn bt-go", onClick: R, disabled: m.value, style: { "margin-left": "auto" } }, v(m.value ? "⏳ " + y.value : "▶ 开始模拟"), 9, P_)])])) : E("", true), w.value ? (g(), b("div", O_, [r("div", A_, [r("div", N_, [r("b", { class: M(w.value.winRate >= 60 ? "up" : w.value.winRate >= 45 ? "warn" : "down") }, v(w.value.winRate) + "%", 3), r("i", null, "胜率（" + v(w.value.wins) + "/" + v(w.value.total) + "）", 1)]), r("div", I_, [r("b", { class: M(w.value.totalRet >= 0 ? "up" : "down") }, v(w.value.totalRet >= 0 ? "+" : "") + v(w.value.totalRet.toFixed(2)) + "%", 3), N[11] || (N[11] = r("i", null, "累计收益", -1))]), r("div", F_, [r("b", { class: M(w.value.avgRet >= 0 ? "up" : "down") }, v(w.value.avgRet >= 0 ? "+" : "") + v(w.value.avgRet.toFixed(2)) + "%", 3), N[12] || (N[12] = r("i", null, "平均每笔", -1))]), r("div", V_, [r("b", B_, v(w.value.maxLoss.toFixed(2)) + "%", 1), N[13] || (N[13] = r("i", null, "最大单笔亏损", -1))])]), r("div", j_, v(w.value.verdict), 1), w.value.lastSig ? (g(), b("div", W_, [r("div", H_, "📡 回退节点当日信号（" + v(w.value.lastSig.date) + "，用此前数据计算）", 1), r("div", K_, [N[14] || (N[14] = K("综合 ", -1)), r("b", null, v(w.value.lastSig.score), 1), N[15] || (N[15] = K(" 分", -1))]), r("div", q_, [(g(true), b(J, null, vt(w.value.lastSig.sigs, ($, I) => (g(), b("span", { key: I, class: M($ ? "on" : "") }, v(i[I] || I) + v($ ? "✅" : "⬜"), 3))), 128))]), r("div", U_, "模拟买入：次日开盘 " + v(w.value.lastSig.buy) + " / 止损 -" + v(p.value) + "%", 1)])) : E("", true), r("div", J_, "📋 模拟交易清单（" + v(w.value.total) + " 笔）", 1), r("div", X_, [(g(true), b(J, null, vt(w.value.trades, ($, I) => (g(), b("div", { class: "sim-trade", key: I }, [r("div", G_, [r("b", null, v($.buyDate.slice(5)) + " 买 " + v($.buy), 1), r("em", null, v($.exitDate.slice(5)) + " 卖 " + v($.exit) + "（" + v($.reason) + "）", 1), r("span", Q_, v($.sigs), 1)]), r("div", { class: M(["st-right", $.ret >= 0 ? "up" : "down"]) }, v($.ret >= 0 ? "+" : "") + v($.ret.toFixed(2)) + "%", 3)]))), 128)), w.value.trades.length ? E("", true) : (g(), b("div", Y_, "回退期间没有触发任何信号——可以试试更早的日期或换一只股票"))])])) : E("", true)]));
} }, tw = $0(Z_, [["__scopeId", "data-v-dc25b69b"]]);
function De(s) {
  var t = s.width, e = s.height;
  if (t < 0) throw new Error("Negative width is not allowed for Size");
  if (e < 0) throw new Error("Negative height is not allowed for Size");
  return { width: t, height: e };
}
function Bn(s, t) {
  return s.width === t.width && s.height === t.height;
}
var ew = function() {
  function s(t) {
    var e = this;
    this._resolutionListener = function() {
      return e._onResolutionChanged();
    }, this._resolutionMediaQueryList = null, this._observers = [], this._window = t, this._installResolutionListener();
  }
  return s.prototype.dispose = function() {
    this._uninstallResolutionListener(), this._window = null;
  }, Object.defineProperty(s.prototype, "value", { get: function() {
    return this._window.devicePixelRatio;
  }, enumerable: false, configurable: true }), s.prototype.subscribe = function(t) {
    var e = this, i = { next: t };
    return this._observers.push(i), { unsubscribe: function() {
      e._observers = e._observers.filter(function(n) {
        return n !== i;
      });
    } };
  }, s.prototype._installResolutionListener = function() {
    if (this._resolutionMediaQueryList !== null) throw new Error("Resolution listener is already installed");
    var t = this._window.devicePixelRatio;
    this._resolutionMediaQueryList = this._window.matchMedia("all and (resolution: ".concat(t, "dppx)")), this._resolutionMediaQueryList.addListener(this._resolutionListener);
  }, s.prototype._uninstallResolutionListener = function() {
    this._resolutionMediaQueryList !== null && (this._resolutionMediaQueryList.removeListener(this._resolutionListener), this._resolutionMediaQueryList = null);
  }, s.prototype._reinstallResolutionListener = function() {
    this._uninstallResolutionListener(), this._installResolutionListener();
  }, s.prototype._onResolutionChanged = function() {
    var t = this;
    this._observers.forEach(function(e) {
      return e.next(t._window.devicePixelRatio);
    }), this._reinstallResolutionListener();
  }, s;
}();
function sw(s) {
  return new ew(s);
}
var iw = function() {
  function s(t, e, i) {
    var n;
    this._canvasElement = null, this._bitmapSizeChangedListeners = [], this._suggestedBitmapSize = null, this._suggestedBitmapSizeChangedListeners = [], this._devicePixelRatioObservable = null, this._canvasElementResizeObserver = null, this._canvasElement = t, this._canvasElementClientSize = De({ width: this._canvasElement.clientWidth, height: this._canvasElement.clientHeight }), this._transformBitmapSize = e ?? function(l) {
      return l;
    }, this._allowResizeObserver = (n = i == null ? void 0 : i.allowResizeObserver) !== null && n !== void 0 ? n : true, this._chooseAndInitObserver();
  }
  return s.prototype.dispose = function() {
    var t, e;
    if (this._canvasElement === null) throw new Error("Object is disposed");
    (t = this._canvasElementResizeObserver) === null || t === void 0 || t.disconnect(), this._canvasElementResizeObserver = null, (e = this._devicePixelRatioObservable) === null || e === void 0 || e.dispose(), this._devicePixelRatioObservable = null, this._suggestedBitmapSizeChangedListeners.length = 0, this._bitmapSizeChangedListeners.length = 0, this._canvasElement = null;
  }, Object.defineProperty(s.prototype, "canvasElement", { get: function() {
    if (this._canvasElement === null) throw new Error("Object is disposed");
    return this._canvasElement;
  }, enumerable: false, configurable: true }), Object.defineProperty(s.prototype, "canvasElementClientSize", { get: function() {
    return this._canvasElementClientSize;
  }, enumerable: false, configurable: true }), Object.defineProperty(s.prototype, "bitmapSize", { get: function() {
    return De({ width: this.canvasElement.width, height: this.canvasElement.height });
  }, enumerable: false, configurable: true }), s.prototype.resizeCanvasElement = function(t) {
    this._canvasElementClientSize = De(t), this.canvasElement.style.width = "".concat(this._canvasElementClientSize.width, "px"), this.canvasElement.style.height = "".concat(this._canvasElementClientSize.height, "px"), this._invalidateBitmapSize();
  }, s.prototype.subscribeBitmapSizeChanged = function(t) {
    this._bitmapSizeChangedListeners.push(t);
  }, s.prototype.unsubscribeBitmapSizeChanged = function(t) {
    this._bitmapSizeChangedListeners = this._bitmapSizeChangedListeners.filter(function(e) {
      return e !== t;
    });
  }, Object.defineProperty(s.prototype, "suggestedBitmapSize", { get: function() {
    return this._suggestedBitmapSize;
  }, enumerable: false, configurable: true }), s.prototype.subscribeSuggestedBitmapSizeChanged = function(t) {
    this._suggestedBitmapSizeChangedListeners.push(t);
  }, s.prototype.unsubscribeSuggestedBitmapSizeChanged = function(t) {
    this._suggestedBitmapSizeChangedListeners = this._suggestedBitmapSizeChangedListeners.filter(function(e) {
      return e !== t;
    });
  }, s.prototype.applySuggestedBitmapSize = function() {
    if (this._suggestedBitmapSize !== null) {
      var t = this._suggestedBitmapSize;
      this._suggestedBitmapSize = null, this._resizeBitmap(t), this._emitSuggestedBitmapSizeChanged(t, this._suggestedBitmapSize);
    }
  }, s.prototype._resizeBitmap = function(t) {
    var e = this.bitmapSize;
    Bn(e, t) || (this.canvasElement.width = t.width, this.canvasElement.height = t.height, this._emitBitmapSizeChanged(e, t));
  }, s.prototype._emitBitmapSizeChanged = function(t, e) {
    var i = this;
    this._bitmapSizeChangedListeners.forEach(function(n) {
      return n.call(i, t, e);
    });
  }, s.prototype._suggestNewBitmapSize = function(t) {
    var e = this._suggestedBitmapSize, i = De(this._transformBitmapSize(t, this._canvasElementClientSize)), n = Bn(this.bitmapSize, i) ? null : i;
    e === null && n === null || e !== null && n !== null && Bn(e, n) || (this._suggestedBitmapSize = n, this._emitSuggestedBitmapSizeChanged(e, n));
  }, s.prototype._emitSuggestedBitmapSizeChanged = function(t, e) {
    var i = this;
    this._suggestedBitmapSizeChangedListeners.forEach(function(n) {
      return n.call(i, t, e);
    });
  }, s.prototype._chooseAndInitObserver = function() {
    var t = this;
    if (!this._allowResizeObserver) {
      this._initDevicePixelRatioObservable();
      return;
    }
    lw().then(function(e) {
      return e ? t._initResizeObserver() : t._initDevicePixelRatioObservable();
    });
  }, s.prototype._initDevicePixelRatioObservable = function() {
    var t = this;
    if (this._canvasElement !== null) {
      var e = av(this._canvasElement);
      if (e === null) throw new Error("No window is associated with the canvas");
      this._devicePixelRatioObservable = sw(e), this._devicePixelRatioObservable.subscribe(function() {
        return t._invalidateBitmapSize();
      }), this._invalidateBitmapSize();
    }
  }, s.prototype._invalidateBitmapSize = function() {
    var t, e;
    if (this._canvasElement !== null) {
      var i = av(this._canvasElement);
      if (i !== null) {
        var n = (e = (t = this._devicePixelRatioObservable) === null || t === void 0 ? void 0 : t.value) !== null && e !== void 0 ? e : i.devicePixelRatio, l = this._canvasElement.getClientRects(), a = l[0] !== void 0 ? ow(l[0], n) : De({ width: this._canvasElementClientSize.width * n, height: this._canvasElementClientSize.height * n });
        this._suggestNewBitmapSize(a);
      }
    }
  }, s.prototype._initResizeObserver = function() {
    var t = this;
    this._canvasElement !== null && (this._canvasElementResizeObserver = new ResizeObserver(function(e) {
      var i = e.find(function(a) {
        return a.target === t._canvasElement;
      });
      if (!(!i || !i.devicePixelContentBoxSize || !i.devicePixelContentBoxSize[0])) {
        var n = i.devicePixelContentBoxSize[0], l = De({ width: n.inlineSize, height: n.blockSize });
        t._suggestNewBitmapSize(l);
      }
    }), this._canvasElementResizeObserver.observe(this._canvasElement, { box: "device-pixel-content-box" }));
  }, s;
}();
function nw(s, t) {
  return new iw(s, t.transform, t.options);
}
function av(s) {
  return s.ownerDocument.defaultView;
}
function lw() {
  return new Promise(function(s) {
    var t = new ResizeObserver(function(e) {
      s(e.every(function(i) {
        return "devicePixelContentBoxSize" in i;
      })), t.disconnect();
    });
    t.observe(document.body, { box: "device-pixel-content-box" });
  }).catch(function() {
    return false;
  });
}
function ow(s, t) {
  return De({ width: Math.round(s.left * t + s.width * t) - Math.round(s.left * t), height: Math.round(s.top * t + s.height * t) - Math.round(s.top * t) });
}
var aw = function() {
  function s(t, e, i) {
    if (e.width === 0 || e.height === 0) throw new TypeError("Rendering target could only be created on a media with positive width and height");
    if (this._mediaSize = e, i.width === 0 || i.height === 0) throw new TypeError("Rendering target could only be created using a bitmap with positive integer width and height");
    this._bitmapSize = i, this._context = t;
  }
  return s.prototype.useMediaCoordinateSpace = function(t) {
    try {
      return this._context.save(), this._context.setTransform(1, 0, 0, 1, 0, 0), this._context.scale(this._horizontalPixelRatio, this._verticalPixelRatio), t({ context: this._context, mediaSize: this._mediaSize });
    } finally {
      this._context.restore();
    }
  }, s.prototype.useBitmapCoordinateSpace = function(t) {
    try {
      return this._context.save(), this._context.setTransform(1, 0, 0, 1, 0, 0), t({ context: this._context, mediaSize: this._mediaSize, bitmapSize: this._bitmapSize, horizontalPixelRatio: this._horizontalPixelRatio, verticalPixelRatio: this._verticalPixelRatio });
    } finally {
      this._context.restore();
    }
  }, Object.defineProperty(s.prototype, "_horizontalPixelRatio", { get: function() {
    return this._bitmapSize.width / this._mediaSize.width;
  }, enumerable: false, configurable: true }), Object.defineProperty(s.prototype, "_verticalPixelRatio", { get: function() {
    return this._bitmapSize.height / this._mediaSize.height;
  }, enumerable: false, configurable: true }), s;
}();
function jn(s, t) {
  var e = s.canvasElementClientSize;
  if (e.width === 0 || e.height === 0) return null;
  var i = s.bitmapSize;
  if (i.width === 0 || i.height === 0) return null;
  var n = s.canvasElement.getContext("2d", t);
  return n === null ? null : new aw(n, e, i);
}
/*!
* @license
* TradingView Lightweight Charts™ v4.2.3
* Copyright (c) 2025 TradingView, Inc.
* Licensed under Apache License 2.0 https://www.apache.org/licenses/LICENSE-2.0
*/
const rw = { upColor: "#26a69a", downColor: "#ef5350", wickVisible: true, borderVisible: true, borderColor: "#378658", borderUpColor: "#26a69a", borderDownColor: "#ef5350", wickColor: "#737375", wickUpColor: "#26a69a", wickDownColor: "#ef5350" }, cw = { upColor: "#26a69a", downColor: "#ef5350", openVisible: true, thinBars: true }, uw = { color: "#2196f3", lineStyle: 0, lineWidth: 3, lineType: 0, lineVisible: true, crosshairMarkerVisible: true, crosshairMarkerRadius: 4, crosshairMarkerBorderColor: "", crosshairMarkerBorderWidth: 2, crosshairMarkerBackgroundColor: "", lastPriceAnimation: 0, pointMarkersVisible: false }, hw = { topColor: "rgba( 46, 220, 135, 0.4)", bottomColor: "rgba( 40, 221, 100, 0)", invertFilledArea: false, lineColor: "#33D778", lineStyle: 0, lineWidth: 3, lineType: 0, lineVisible: true, crosshairMarkerVisible: true, crosshairMarkerRadius: 4, crosshairMarkerBorderColor: "", crosshairMarkerBorderWidth: 2, crosshairMarkerBackgroundColor: "", lastPriceAnimation: 0, pointMarkersVisible: false }, dw = { baseValue: { type: "price", price: 0 }, topFillColor1: "rgba(38, 166, 154, 0.28)", topFillColor2: "rgba(38, 166, 154, 0.05)", topLineColor: "rgba(38, 166, 154, 1)", bottomFillColor1: "rgba(239, 83, 80, 0.05)", bottomFillColor2: "rgba(239, 83, 80, 0.28)", bottomLineColor: "rgba(239, 83, 80, 1)", lineWidth: 3, lineStyle: 0, lineType: 0, lineVisible: true, crosshairMarkerVisible: true, crosshairMarkerRadius: 4, crosshairMarkerBorderColor: "", crosshairMarkerBorderWidth: 2, crosshairMarkerBackgroundColor: "", lastPriceAnimation: 0, pointMarkersVisible: false }, fw = { color: "#26a69a", base: 0 }, T0 = { color: "#2196f3" }, E0 = { title: "", visible: true, lastValueVisible: true, priceLineVisible: true, priceLineSource: 0, priceLineWidth: 1, priceLineColor: "", priceLineStyle: 2, baseLineVisible: true, baseLineWidth: 1, baseLineColor: "#B2B5BE", baseLineStyle: 0, priceFormat: { type: "price", precision: 2, minMove: 0.01 } };
var rv, cv;
function Wn(s, t) {
  const e = { 0: [], 1: [s.lineWidth, s.lineWidth], 2: [2 * s.lineWidth, 2 * s.lineWidth], 3: [6 * s.lineWidth, 6 * s.lineWidth], 4: [s.lineWidth, 4 * s.lineWidth] }[t];
  s.setLineDash(e);
}
function R0(s, t, e, i) {
  s.beginPath();
  const n = s.lineWidth % 2 ? 0.5 : 0;
  s.moveTo(e, t + n), s.lineTo(i, t + n), s.stroke();
}
function hn(s, t) {
  if (!s) throw new Error("Assertion failed" + (t ? ": " + t : ""));
}
function ws(s) {
  if (s === void 0) throw new Error("Value is undefined");
  return s;
}
function ut(s) {
  if (s === null) throw new Error("Value is null");
  return s;
}
function pl(s) {
  return ut(ws(s));
}
(function(s) {
  s[s.Simple = 0] = "Simple", s[s.WithSteps = 1] = "WithSteps", s[s.Curved = 2] = "Curved";
})(rv || (rv = {})), function(s) {
  s[s.Solid = 0] = "Solid", s[s.Dotted = 1] = "Dotted", s[s.Dashed = 2] = "Dashed", s[s.LargeDashed = 3] = "LargeDashed", s[s.SparseDotted = 4] = "SparseDotted";
}(cv || (cv = {}));
const uv = { khaki: "#f0e68c", azure: "#f0ffff", aliceblue: "#f0f8ff", ghostwhite: "#f8f8ff", gold: "#ffd700", goldenrod: "#daa520", gainsboro: "#dcdcdc", gray: "#808080", green: "#008000", honeydew: "#f0fff0", floralwhite: "#fffaf0", lightblue: "#add8e6", lightcoral: "#f08080", lemonchiffon: "#fffacd", hotpink: "#ff69b4", lightyellow: "#ffffe0", greenyellow: "#adff2f", lightgoldenrodyellow: "#fafad2", limegreen: "#32cd32", linen: "#faf0e6", lightcyan: "#e0ffff", magenta: "#f0f", maroon: "#800000", olive: "#808000", orange: "#ffa500", oldlace: "#fdf5e6", mediumblue: "#0000cd", transparent: "#0000", lime: "#0f0", lightpink: "#ffb6c1", mistyrose: "#ffe4e1", moccasin: "#ffe4b5", midnightblue: "#191970", orchid: "#da70d6", mediumorchid: "#ba55d3", mediumturquoise: "#48d1cc", orangered: "#ff4500", royalblue: "#4169e1", powderblue: "#b0e0e6", red: "#f00", coral: "#ff7f50", turquoise: "#40e0d0", white: "#fff", whitesmoke: "#f5f5f5", wheat: "#f5deb3", teal: "#008080", steelblue: "#4682b4", bisque: "#ffe4c4", aquamarine: "#7fffd4", aqua: "#0ff", sienna: "#a0522d", silver: "#c0c0c0", springgreen: "#00ff7f", antiquewhite: "#faebd7", burlywood: "#deb887", brown: "#a52a2a", beige: "#f5f5dc", chocolate: "#d2691e", chartreuse: "#7fff00", cornflowerblue: "#6495ed", cornsilk: "#fff8dc", crimson: "#dc143c", cadetblue: "#5f9ea0", tomato: "#ff6347", fuchsia: "#f0f", blue: "#00f", salmon: "#fa8072", blanchedalmond: "#ffebcd", slateblue: "#6a5acd", slategray: "#708090", thistle: "#d8bfd8", tan: "#d2b48c", cyan: "#0ff", darkblue: "#00008b", darkcyan: "#008b8b", darkgoldenrod: "#b8860b", darkgray: "#a9a9a9", blueviolet: "#8a2be2", black: "#000", darkmagenta: "#8b008b", darkslateblue: "#483d8b", darkkhaki: "#bdb76b", darkorchid: "#9932cc", darkorange: "#ff8c00", darkgreen: "#006400", darkred: "#8b0000", dodgerblue: "#1e90ff", darkslategray: "#2f4f4f", dimgray: "#696969", deepskyblue: "#00bfff", firebrick: "#b22222", forestgreen: "#228b22", indigo: "#4b0082", ivory: "#fffff0", lavenderblush: "#fff0f5", feldspar: "#d19275", indianred: "#cd5c5c", lightgreen: "#90ee90", lightgrey: "#d3d3d3", lightskyblue: "#87cefa", lightslategray: "#789", lightslateblue: "#8470ff", snow: "#fffafa", lightseagreen: "#20b2aa", lightsalmon: "#ffa07a", darksalmon: "#e9967a", darkviolet: "#9400d3", mediumpurple: "#9370d8", mediumaquamarine: "#66cdaa", skyblue: "#87ceeb", lavender: "#e6e6fa", lightsteelblue: "#b0c4de", mediumvioletred: "#c71585", mintcream: "#f5fffa", navajowhite: "#ffdead", navy: "#000080", olivedrab: "#6b8e23", palevioletred: "#d87093", violetred: "#d02090", yellow: "#ff0", yellowgreen: "#9acd32", lawngreen: "#7cfc00", pink: "#ffc0cb", paleturquoise: "#afeeee", palegoldenrod: "#eee8aa", darkolivegreen: "#556b2f", darkseagreen: "#8fbc8f", darkturquoise: "#00ced1", peachpuff: "#ffdab9", deeppink: "#ff1493", violet: "#ee82ee", palegreen: "#98fb98", mediumseagreen: "#3cb371", peru: "#cd853f", saddlebrown: "#8b4513", sandybrown: "#f4a460", rosybrown: "#bc8f8f", purple: "#800080", seagreen: "#2e8b57", seashell: "#fff5ee", papayawhip: "#ffefd5", mediumslateblue: "#7b68ee", plum: "#dda0dd", mediumspringgreen: "#00fa9a" };
function Js(s) {
  return s < 0 ? 0 : s > 255 ? 255 : Math.round(s) || 0;
}
function z0(s) {
  return s <= 0 || s > 1 ? Math.min(Math.max(s, 0), 1) : Math.round(1e4 * s) / 1e4;
}
const vw = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i, pw = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i, mw = /^rgb\(\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*\)$/, gw = /^rgba\(\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*,\s*(-?\d*\.?\d+)\s*\)$/;
function zo(s) {
  (s = s.toLowerCase()) in uv && (s = uv[s]);
  {
    const t = gw.exec(s) || mw.exec(s);
    if (t) return [Js(parseInt(t[1], 10)), Js(parseInt(t[2], 10)), Js(parseInt(t[3], 10)), z0(t.length < 5 ? 1 : parseFloat(t[4]))];
  }
  {
    const t = pw.exec(s);
    if (t) return [Js(parseInt(t[1], 16)), Js(parseInt(t[2], 16)), Js(parseInt(t[3], 16)), 1];
  }
  {
    const t = vw.exec(s);
    if (t) return [Js(17 * parseInt(t[1], 16)), Js(17 * parseInt(t[2], 16)), Js(17 * parseInt(t[3], 16)), 1];
  }
  throw new Error(`Cannot parse color: ${s}`);
}
function L0(s) {
  return 0.199 * s[0] + 0.687 * s[1] + 0.114 * s[2];
}
function Mr(s) {
  const t = zo(s);
  return { t: `rgb(${t[0]}, ${t[1]}, ${t[2]})`, i: L0(t) > 160 ? "black" : "white" };
}
class Be {
  constructor() {
    this.h = [];
  }
  l(t, e, i) {
    const n = { o: t, _: e, u: i === true };
    this.h.push(n);
  }
  v(t) {
    const e = this.h.findIndex((i) => t === i.o);
    e > -1 && this.h.splice(e, 1);
  }
  p(t) {
    this.h = this.h.filter((e) => e._ !== t);
  }
  m(t, e, i) {
    const n = [...this.h];
    this.h = this.h.filter((l) => !l.u), n.forEach((l) => l.o(t, e, i));
  }
  M() {
    return this.h.length > 0;
  }
  S() {
    this.h = [];
  }
}
function ri(s, ...t) {
  for (const e of t) for (const i in e) e[i] !== void 0 && Object.prototype.hasOwnProperty.call(e, i) && !["__proto__", "constructor", "prototype"].includes(i) && (typeof e[i] != "object" || s[i] === void 0 || Array.isArray(e[i]) ? s[i] = e[i] : ri(s[i], e[i]));
  return s;
}
function _i(s) {
  return typeof s == "number" && isFinite(s);
}
function Lo(s) {
  return typeof s == "number" && s % 1 == 0;
}
function Vo(s) {
  return typeof s == "string";
}
function Ra(s) {
  return typeof s == "boolean";
}
function Fi(s) {
  const t = s;
  if (!t || typeof t != "object") return t;
  let e, i, n;
  for (i in e = Array.isArray(t) ? [] : {}, t) t.hasOwnProperty(i) && (n = t[i], e[i] = n && typeof n == "object" ? Fi(n) : n);
  return e;
}
function bw(s) {
  return s !== null;
}
function Do(s) {
  return s === null ? void 0 : s;
}
const Du = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
function xl(s, t, e) {
  return t === void 0 && (t = Du), `${e = e !== void 0 ? `${e} ` : ""}${s}px ${t}`;
}
class yw {
  constructor(t) {
    this.k = { C: 1, T: 5, P: NaN, R: "", D: "", V: "", O: "", B: 0, A: 0, I: 0, L: 0, N: 0 }, this.F = t;
  }
  W() {
    const t = this.k, e = this.j(), i = this.H();
    return t.P === e && t.D === i || (t.P = e, t.D = i, t.R = xl(e, i), t.L = 2.5 / 12 * e, t.B = t.L, t.A = e / 12 * t.T, t.I = e / 12 * t.T, t.N = 0), t.V = this.$(), t.O = this.U(), this.k;
  }
  $() {
    return this.F.W().layout.textColor;
  }
  U() {
    return this.F.q();
  }
  j() {
    return this.F.W().layout.fontSize;
  }
  H() {
    return this.F.W().layout.fontFamily;
  }
}
class Pu {
  constructor() {
    this.Y = [];
  }
  Z(t) {
    this.Y = t;
  }
  X(t, e, i) {
    this.Y.forEach((n) => {
      n.X(t, e, i);
    });
  }
}
class ci {
  X(t, e, i) {
    t.useBitmapCoordinateSpace((n) => this.K(n, e, i));
  }
}
class _w extends ci {
  constructor() {
    super(...arguments), this.G = null;
  }
  J(t) {
    this.G = t;
  }
  K({ context: t, horizontalPixelRatio: e, verticalPixelRatio: i }) {
    if (this.G === null || this.G.tt === null) return;
    const n = this.G.tt, l = this.G, a = Math.max(1, Math.floor(e)) % 2 / 2, c = (u) => {
      t.beginPath();
      for (let f = n.to - 1; f >= n.from; --f) {
        const p = l.it[f], m = Math.round(p.nt * e) + a, y = p.st * i, w = u * i + a;
        t.moveTo(m, y), t.arc(m, y, w, 0, 2 * Math.PI);
      }
      t.fill();
    };
    l.et > 0 && (t.fillStyle = l.rt, c(l.ht + l.et)), t.fillStyle = l.lt, c(l.ht);
  }
}
function ww() {
  return { it: [{ nt: 0, st: 0, ot: 0, _t: 0 }], lt: "", rt: "", ht: 0, et: 0, tt: null };
}
const kw = { from: 0, to: 1 };
class Sw {
  constructor(t, e) {
    this.ut = new Pu(), this.ct = [], this.dt = [], this.ft = true, this.F = t, this.vt = e, this.ut.Z(this.ct);
  }
  bt(t) {
    const e = this.F.wt();
    e.length !== this.ct.length && (this.dt = e.map(ww), this.ct = this.dt.map((i) => {
      const n = new _w();
      return n.J(i), n;
    }), this.ut.Z(this.ct)), this.ft = true;
  }
  gt() {
    return this.ft && (this.Mt(), this.ft = false), this.ut;
  }
  Mt() {
    const t = this.vt.W().mode === 2, e = this.F.wt(), i = this.vt.xt(), n = this.F.St();
    e.forEach((l, a) => {
      var c;
      const u = this.dt[a], f = l.kt(i);
      if (t || f === null || !l.yt()) return void (u.tt = null);
      const p = ut(l.Ct());
      u.lt = f.Tt, u.ht = f.ht, u.et = f.Pt, u.it[0]._t = f._t, u.it[0].st = l.Dt().Rt(f._t, p.Vt), u.rt = (c = f.Ot) !== null && c !== void 0 ? c : this.F.Bt(u.it[0].st / l.Dt().At()), u.it[0].ot = i, u.it[0].nt = n.It(i), u.tt = kw;
    });
  }
}
class xw extends ci {
  constructor(t) {
    super(), this.zt = t;
  }
  K({ context: t, bitmapSize: e, horizontalPixelRatio: i, verticalPixelRatio: n }) {
    if (this.zt === null) return;
    const l = this.zt.Lt.yt, a = this.zt.Et.yt;
    if (!l && !a) return;
    const c = Math.round(this.zt.nt * i), u = Math.round(this.zt.st * n);
    t.lineCap = "butt", l && c >= 0 && (t.lineWidth = Math.floor(this.zt.Lt.et * i), t.strokeStyle = this.zt.Lt.V, t.fillStyle = this.zt.Lt.V, Wn(t, this.zt.Lt.Nt), function(f, p, m, y) {
      f.beginPath();
      const w = f.lineWidth % 2 ? 0.5 : 0;
      f.moveTo(p + w, m), f.lineTo(p + w, y), f.stroke();
    }(t, c, 0, e.height)), a && u >= 0 && (t.lineWidth = Math.floor(this.zt.Et.et * n), t.strokeStyle = this.zt.Et.V, t.fillStyle = this.zt.Et.V, Wn(t, this.zt.Et.Nt), R0(t, u, 0, e.width));
  }
}
class Cw {
  constructor(t) {
    this.ft = true, this.Ft = { Lt: { et: 1, Nt: 0, V: "", yt: false }, Et: { et: 1, Nt: 0, V: "", yt: false }, nt: 0, st: 0 }, this.Wt = new xw(this.Ft), this.jt = t;
  }
  bt() {
    this.ft = true;
  }
  gt() {
    return this.ft && (this.Mt(), this.ft = false), this.Wt;
  }
  Mt() {
    const t = this.jt.yt(), e = ut(this.jt.Ht()), i = e.$t().W().crosshair, n = this.Ft;
    if (i.mode === 2) return n.Et.yt = false, void (n.Lt.yt = false);
    n.Et.yt = t && this.jt.Ut(e), n.Lt.yt = t && this.jt.qt(), n.Et.et = i.horzLine.width, n.Et.Nt = i.horzLine.style, n.Et.V = i.horzLine.color, n.Lt.et = i.vertLine.width, n.Lt.Nt = i.vertLine.style, n.Lt.V = i.vertLine.color, n.nt = this.jt.Yt(), n.st = this.jt.Zt();
  }
}
function Mw(s, t, e, i, n, l) {
  s.fillRect(t + l, e, i - 2 * l, l), s.fillRect(t + l, e + n - l, i - 2 * l, l), s.fillRect(t, e, l, n), s.fillRect(t + i - l, e, l, n);
}
function $r(s, t, e, i, n, l) {
  s.save(), s.globalCompositeOperation = "copy", s.fillStyle = l, s.fillRect(t, e, i, n), s.restore();
}
function hv(s, t, e, i, n, l) {
  s.beginPath(), s.roundRect ? s.roundRect(t, e, i, n, l) : (s.lineTo(t + i - l[1], e), l[1] !== 0 && s.arcTo(t + i, e, t + i, e + l[1], l[1]), s.lineTo(t + i, e + n - l[2]), l[2] !== 0 && s.arcTo(t + i, e + n, t + i - l[2], e + n, l[2]), s.lineTo(t + l[3], e + n), l[3] !== 0 && s.arcTo(t, e + n, t, e + n - l[3], l[3]), s.lineTo(t, e + l[0]), l[0] !== 0 && s.arcTo(t, e, t + l[0], e, l[0]));
}
function dv(s, t, e, i, n, l, a = 0, c = [0, 0, 0, 0], u = "") {
  if (s.save(), !a || !u || u === l) return hv(s, t, e, i, n, c), s.fillStyle = l, s.fill(), void s.restore();
  const f = a / 2;
  var p;
  hv(s, t + f, e + f, i - a, n - a, (p = -f, c.map((m) => m === 0 ? m : m + p))), l !== "transparent" && (s.fillStyle = l, s.fill()), u !== "transparent" && (s.lineWidth = a, s.strokeStyle = u, s.closePath(), s.stroke()), s.restore();
}
function D0(s, t, e, i, n, l, a) {
  s.save(), s.globalCompositeOperation = "copy";
  const c = s.createLinearGradient(0, 0, 0, n);
  c.addColorStop(0, l), c.addColorStop(1, a), s.fillStyle = c, s.fillRect(t, e, i, n), s.restore();
}
class fv {
  constructor(t, e) {
    this.J(t, e);
  }
  J(t, e) {
    this.zt = t, this.Xt = e;
  }
  At(t, e) {
    return this.zt.yt ? t.P + t.L + t.B : 0;
  }
  X(t, e, i, n) {
    if (!this.zt.yt || this.zt.Kt.length === 0) return;
    const l = this.zt.V, a = this.Xt.t, c = t.useBitmapCoordinateSpace((u) => {
      const f = u.context;
      f.font = e.R;
      const p = this.Gt(u, e, i, n), m = p.Jt;
      return p.Qt ? dv(f, m.ti, m.ii, m.ni, m.si, a, m.ei, [m.ht, 0, 0, m.ht], a) : dv(f, m.ri, m.ii, m.ni, m.si, a, m.ei, [0, m.ht, m.ht, 0], a), this.zt.hi && (f.fillStyle = l, f.fillRect(m.ri, m.li, m.ai - m.ri, m.oi)), this.zt._i && (f.fillStyle = e.O, f.fillRect(p.Qt ? m.ui - m.ei : 0, m.ii, m.ei, m.ci - m.ii)), p;
    });
    t.useMediaCoordinateSpace(({ context: u }) => {
      const f = c.di;
      u.font = e.R, u.textAlign = c.Qt ? "right" : "left", u.textBaseline = "middle", u.fillStyle = l, u.fillText(this.zt.Kt, f.fi, (f.ii + f.ci) / 2 + f.pi);
    });
  }
  Gt(t, e, i, n) {
    var l;
    const { context: a, bitmapSize: c, mediaSize: u, horizontalPixelRatio: f, verticalPixelRatio: p } = t, m = this.zt.hi || !this.zt.mi ? e.T : 0, y = this.zt.bi ? e.C : 0, w = e.L + this.Xt.wi, S = e.B + this.Xt.gi, C = e.A, O = e.I, R = this.zt.Kt, D = e.P, N = i.Mi(a, R), $ = Math.ceil(i.xi(a, R)), I = D + w + S, U = e.C + C + O + $ + m, tt = Math.max(1, Math.floor(p));
    let dt = Math.round(I * p);
    dt % 2 != tt % 2 && (dt += 1);
    const nt = y > 0 ? Math.max(1, Math.floor(y * f)) : 0, W = Math.round(U * f), V = Math.round(m * f), A = (l = this.Xt.Si) !== null && l !== void 0 ? l : this.Xt.ki, X = Math.round(A * p) - Math.floor(0.5 * p), yt = Math.floor(X + tt / 2 - dt / 2), Tt = yt + dt, qt = n === "right", Xt = qt ? u.width - y : y, ht = qt ? c.width - nt : nt;
    let ct, Bt, ue;
    return qt ? (ct = ht - W, Bt = ht - V, ue = Xt - m - C - y) : (ct = ht + W, Bt = ht + V, ue = Xt + m + C), { Qt: qt, Jt: { ii: yt, li: X, ci: Tt, ni: W, si: dt, ht: 2 * f, ei: nt, ti: ct, ri: ht, ai: Bt, oi: tt, ui: c.width }, di: { ii: yt / p, ci: Tt / p, fi: ue, pi: N } };
  }
}
class Tr {
  constructor(t) {
    this.yi = { ki: 0, t: "#000", gi: 0, wi: 0 }, this.Ci = { Kt: "", yt: false, hi: true, mi: false, Ot: "", V: "#FFF", _i: false, bi: false }, this.Ti = { Kt: "", yt: false, hi: false, mi: true, Ot: "", V: "#FFF", _i: true, bi: true }, this.ft = true, this.Pi = new (t || fv)(this.Ci, this.yi), this.Ri = new (t || fv)(this.Ti, this.yi);
  }
  Kt() {
    return this.Di(), this.Ci.Kt;
  }
  ki() {
    return this.Di(), this.yi.ki;
  }
  bt() {
    this.ft = true;
  }
  At(t, e = false) {
    return Math.max(this.Pi.At(t, e), this.Ri.At(t, e));
  }
  Vi() {
    return this.yi.Si || 0;
  }
  Oi(t) {
    this.yi.Si = t;
  }
  Bi() {
    return this.Di(), this.Ci.yt || this.Ti.yt;
  }
  Ai() {
    return this.Di(), this.Ci.yt;
  }
  gt(t) {
    return this.Di(), this.Ci.hi = this.Ci.hi && t.W().ticksVisible, this.Ti.hi = this.Ti.hi && t.W().ticksVisible, this.Pi.J(this.Ci, this.yi), this.Ri.J(this.Ti, this.yi), this.Pi;
  }
  Ii() {
    return this.Di(), this.Pi.J(this.Ci, this.yi), this.Ri.J(this.Ti, this.yi), this.Ri;
  }
  Di() {
    this.ft && (this.Ci.hi = true, this.Ti.hi = false, this.zi(this.Ci, this.Ti, this.yi));
  }
}
class $w extends Tr {
  constructor(t, e, i) {
    super(), this.jt = t, this.Li = e, this.Ei = i;
  }
  zi(t, e, i) {
    if (t.yt = false, this.jt.W().mode === 2) return;
    const n = this.jt.W().horzLine;
    if (!n.labelVisible) return;
    const l = this.Li.Ct();
    if (!this.jt.yt() || this.Li.Ni() || l === null) return;
    const a = Mr(n.labelBackgroundColor);
    i.t = a.t, t.V = a.i;
    const c = 2 / 12 * this.Li.P();
    i.wi = c, i.gi = c;
    const u = this.Ei(this.Li);
    i.ki = u.ki, t.Kt = this.Li.Fi(u._t, l), t.yt = true;
  }
}
const Tw = /[1-9]/g;
class P0 {
  constructor() {
    this.zt = null;
  }
  J(t) {
    this.zt = t;
  }
  X(t, e) {
    if (this.zt === null || this.zt.yt === false || this.zt.Kt.length === 0) return;
    const i = t.useMediaCoordinateSpace(({ context: y }) => (y.font = e.R, Math.round(e.Wi.xi(y, ut(this.zt).Kt, Tw))));
    if (i <= 0) return;
    const n = e.ji, l = i + 2 * n, a = l / 2, c = this.zt.Hi;
    let u = this.zt.ki, f = Math.floor(u - a) + 0.5;
    f < 0 ? (u += Math.abs(0 - f), f = Math.floor(u - a) + 0.5) : f + l > c && (u -= Math.abs(c - (f + l)), f = Math.floor(u - a) + 0.5);
    const p = f + l, m = Math.ceil(0 + e.C + e.T + e.L + e.P + e.B);
    t.useBitmapCoordinateSpace(({ context: y, horizontalPixelRatio: w, verticalPixelRatio: S }) => {
      const C = ut(this.zt);
      y.fillStyle = C.t;
      const O = Math.round(f * w), R = Math.round(0 * S), D = Math.round(p * w), N = Math.round(m * S), $ = Math.round(2 * w);
      if (y.beginPath(), y.moveTo(O, R), y.lineTo(O, N - $), y.arcTo(O, N, O + $, N, $), y.lineTo(D - $, N), y.arcTo(D, N, D, N - $, $), y.lineTo(D, R), y.fill(), C.hi) {
        const I = Math.round(C.ki * w), U = R, tt = Math.round((U + e.T) * S);
        y.fillStyle = C.V;
        const dt = Math.max(1, Math.floor(w)), nt = Math.floor(0.5 * w);
        y.fillRect(I - nt, U, dt, tt - U);
      }
    }), t.useMediaCoordinateSpace(({ context: y }) => {
      const w = ut(this.zt), S = 0 + e.C + e.T + e.L + e.P / 2;
      y.font = e.R, y.textAlign = "left", y.textBaseline = "middle", y.fillStyle = w.V;
      const C = e.Wi.Mi(y, "Apr0");
      y.translate(f + n, S + C), y.fillText(w.Kt, 0, 0);
    });
  }
}
class Ew {
  constructor(t, e, i) {
    this.ft = true, this.Wt = new P0(), this.Ft = { yt: false, t: "#4c525e", V: "white", Kt: "", Hi: 0, ki: NaN, hi: true }, this.vt = t, this.$i = e, this.Ei = i;
  }
  bt() {
    this.ft = true;
  }
  gt() {
    return this.ft && (this.Mt(), this.ft = false), this.Wt.J(this.Ft), this.Wt;
  }
  Mt() {
    const t = this.Ft;
    if (t.yt = false, this.vt.W().mode === 2) return;
    const e = this.vt.W().vertLine;
    if (!e.labelVisible) return;
    const i = this.$i.St();
    if (i.Ni()) return;
    t.Hi = i.Hi();
    const n = this.Ei();
    if (n === null) return;
    t.ki = n.ki;
    const l = i.Ui(this.vt.xt());
    t.Kt = i.qi(ut(l)), t.yt = true;
    const a = Mr(e.labelBackgroundColor);
    t.t = a.t, t.V = a.i, t.hi = i.W().ticksVisible;
  }
}
class Ou {
  constructor() {
    this.Yi = null, this.Zi = 0;
  }
  Xi() {
    return this.Zi;
  }
  Ki(t) {
    this.Zi = t;
  }
  Dt() {
    return this.Yi;
  }
  Gi(t) {
    this.Yi = t;
  }
  Ji(t) {
    return [];
  }
  Qi() {
    return [];
  }
  yt() {
    return true;
  }
}
var vv;
(function(s) {
  s[s.Normal = 0] = "Normal", s[s.Magnet = 1] = "Magnet", s[s.Hidden = 2] = "Hidden";
})(vv || (vv = {}));
class Rw extends Ou {
  constructor(t, e) {
    super(), this.tn = null, this.nn = NaN, this.sn = 0, this.en = true, this.rn = /* @__PURE__ */ new Map(), this.hn = false, this.ln = NaN, this.an = NaN, this._n = NaN, this.un = NaN, this.$i = t, this.cn = e, this.dn = new Sw(t, this), this.fn = /* @__PURE__ */ ((n, l) => (a) => {
      const c = l(), u = n();
      if (a === ut(this.tn).vn()) return { _t: u, ki: c };
      {
        const f = ut(a.Ct());
        return { _t: a.pn(c, f), ki: c };
      }
    })(() => this.nn, () => this.an);
    const i = /* @__PURE__ */ ((n, l) => () => {
      const a = this.$i.St().mn(n()), c = l();
      return a && Number.isFinite(c) ? { ot: a, ki: c } : null;
    })(() => this.sn, () => this.Yt());
    this.bn = new Ew(this, t, i), this.wn = new Cw(this);
  }
  W() {
    return this.cn;
  }
  gn(t, e) {
    this._n = t, this.un = e;
  }
  Mn() {
    this._n = NaN, this.un = NaN;
  }
  xn() {
    return this._n;
  }
  Sn() {
    return this.un;
  }
  kn(t, e, i) {
    this.hn || (this.hn = true), this.en = true, this.yn(t, e, i);
  }
  xt() {
    return this.sn;
  }
  Yt() {
    return this.ln;
  }
  Zt() {
    return this.an;
  }
  yt() {
    return this.en;
  }
  Cn() {
    this.en = false, this.Tn(), this.nn = NaN, this.ln = NaN, this.an = NaN, this.tn = null, this.Mn();
  }
  Pn(t) {
    return this.tn !== null ? [this.wn, this.dn] : [];
  }
  Ut(t) {
    return t === this.tn && this.cn.horzLine.visible;
  }
  qt() {
    return this.cn.vertLine.visible;
  }
  Rn(t, e) {
    this.en && this.tn === t || this.rn.clear();
    const i = [];
    return this.tn === t && i.push(this.Dn(this.rn, e, this.fn)), i;
  }
  Qi() {
    return this.en ? [this.bn] : [];
  }
  Ht() {
    return this.tn;
  }
  Vn() {
    this.wn.bt(), this.rn.forEach((t) => t.bt()), this.bn.bt(), this.dn.bt();
  }
  On(t) {
    return t && !t.vn().Ni() ? t.vn() : null;
  }
  yn(t, e, i) {
    this.Bn(t, e, i) && this.Vn();
  }
  Bn(t, e, i) {
    const n = this.ln, l = this.an, a = this.nn, c = this.sn, u = this.tn, f = this.On(i);
    this.sn = t, this.ln = isNaN(t) ? NaN : this.$i.St().It(t), this.tn = i;
    const p = f !== null ? f.Ct() : null;
    return f !== null && p !== null ? (this.nn = e, this.an = f.Rt(e, p)) : (this.nn = NaN, this.an = NaN), n !== this.ln || l !== this.an || c !== this.sn || a !== this.nn || u !== this.tn;
  }
  Tn() {
    const t = this.$i.wt().map((i) => i.In().An()).filter(bw), e = t.length === 0 ? null : Math.max(...t);
    this.sn = e !== null ? e : NaN;
  }
  Dn(t, e, i) {
    let n = t.get(e);
    return n === void 0 && (n = new $w(this, e, i), t.set(e, n)), n;
  }
}
function Er(s) {
  return s === "left" || s === "right";
}
class ss {
  constructor(t) {
    this.zn = /* @__PURE__ */ new Map(), this.Ln = [], this.En = t;
  }
  Nn(t, e) {
    const i = function(n, l) {
      return n === void 0 ? l : { Fn: Math.max(n.Fn, l.Fn), Wn: n.Wn || l.Wn };
    }(this.zn.get(t), e);
    this.zn.set(t, i);
  }
  jn() {
    return this.En;
  }
  Hn(t) {
    const e = this.zn.get(t);
    return e === void 0 ? { Fn: this.En } : { Fn: Math.max(this.En, e.Fn), Wn: e.Wn };
  }
  $n() {
    this.Un(), this.Ln = [{ qn: 0 }];
  }
  Yn(t) {
    this.Un(), this.Ln = [{ qn: 1, Vt: t }];
  }
  Zn(t) {
    this.Xn(), this.Ln.push({ qn: 5, Vt: t });
  }
  Un() {
    this.Xn(), this.Ln.push({ qn: 6 });
  }
  Kn() {
    this.Un(), this.Ln = [{ qn: 4 }];
  }
  Gn(t) {
    this.Un(), this.Ln.push({ qn: 2, Vt: t });
  }
  Jn(t) {
    this.Un(), this.Ln.push({ qn: 3, Vt: t });
  }
  Qn() {
    return this.Ln;
  }
  ts(t) {
    for (const e of t.Ln) this.ns(e);
    this.En = Math.max(this.En, t.En), t.zn.forEach((e, i) => {
      this.Nn(i, e);
    });
  }
  static ss() {
    return new ss(2);
  }
  static es() {
    return new ss(3);
  }
  ns(t) {
    switch (t.qn) {
      case 0:
        this.$n();
        break;
      case 1:
        this.Yn(t.Vt);
        break;
      case 2:
        this.Gn(t.Vt);
        break;
      case 3:
        this.Jn(t.Vt);
        break;
      case 4:
        this.Kn();
        break;
      case 5:
        this.Zn(t.Vt);
        break;
      case 6:
        this.Xn();
    }
  }
  Xn() {
    const t = this.Ln.findIndex((e) => e.qn === 5);
    t !== -1 && this.Ln.splice(t, 1);
  }
}
const pv = ".";
function Vi(s, t) {
  if (!_i(s)) return "n/a";
  if (!Lo(t)) throw new TypeError("invalid length");
  if (t < 0 || t > 16) throw new TypeError("invalid length");
  return t === 0 ? s.toString() : ("0000000000000000" + s.toString()).slice(-t);
}
class Rr {
  constructor(t, e) {
    if (e || (e = 1), _i(t) && Lo(t) || (t = 100), t < 0) throw new TypeError("invalid base");
    this.Li = t, this.rs = e, this.hs();
  }
  format(t) {
    const e = t < 0 ? "−" : "";
    return t = Math.abs(t), e + this.ls(t);
  }
  hs() {
    if (this._s = 0, this.Li > 0 && this.rs > 0) {
      let t = this.Li;
      for (; t > 1; ) t /= 10, this._s++;
    }
  }
  ls(t) {
    const e = this.Li / this.rs;
    let i = Math.floor(t), n = "";
    const l = this._s !== void 0 ? this._s : NaN;
    if (e > 1) {
      let a = +(Math.round(t * e) - i * e).toFixed(this._s);
      a >= e && (a -= e, i += 1), n = pv + Vi(+a.toFixed(this._s) * this.rs, l);
    } else i = Math.round(i * e) / e, l > 0 && (n = pv + Vi(0, l));
    return i.toFixed(0) + n;
  }
}
class O0 extends Rr {
  constructor(t = 100) {
    super(t);
  }
  format(t) {
    return `${super.format(t)}%`;
  }
}
class zw {
  constructor(t) {
    this.us = t;
  }
  format(t) {
    let e = "";
    return t < 0 && (e = "-", t = -t), t < 995 ? e + this.cs(t) : t < 999995 ? e + this.cs(t / 1e3) + "K" : t < 999999995 ? (t = 1e3 * Math.round(t / 1e3), e + this.cs(t / 1e6) + "M") : (t = 1e6 * Math.round(t / 1e6), e + this.cs(t / 1e9) + "B");
  }
  cs(t) {
    let e;
    const i = Math.pow(10, this.us);
    return e = (t = Math.round(t * i) / i) >= 1e-15 && t < 1 ? t.toFixed(this.us).replace(/\.?0+$/, "") : String(t), e.replace(/(\.[1-9]*)0+$/, (n, l) => l);
  }
}
function A0(s, t, e, i, n, l, a) {
  if (t.length === 0 || i.from >= t.length || i.to <= 0) return;
  const { context: c, horizontalPixelRatio: u, verticalPixelRatio: f } = s, p = t[i.from];
  let m = l(s, p), y = p;
  if (i.to - i.from < 2) {
    const w = n / 2;
    c.beginPath();
    const S = { nt: p.nt - w, st: p.st }, C = { nt: p.nt + w, st: p.st };
    c.moveTo(S.nt * u, S.st * f), c.lineTo(C.nt * u, C.st * f), a(s, m, S, C);
  } else {
    const w = (C, O) => {
      a(s, m, y, O), c.beginPath(), m = C, y = O;
    };
    let S = y;
    c.beginPath(), c.moveTo(p.nt * u, p.st * f);
    for (let C = i.from + 1; C < i.to; ++C) {
      S = t[C];
      const O = l(s, S);
      switch (e) {
        case 0:
          c.lineTo(S.nt * u, S.st * f);
          break;
        case 1:
          c.lineTo(S.nt * u, t[C - 1].st * f), O !== m && (w(O, S), c.lineTo(S.nt * u, t[C - 1].st * f)), c.lineTo(S.nt * u, S.st * f);
          break;
        case 2: {
          const [R, D] = Lw(t, C - 1, C);
          c.bezierCurveTo(R.nt * u, R.st * f, D.nt * u, D.st * f, S.nt * u, S.st * f);
          break;
        }
      }
      e !== 1 && O !== m && (w(O, S), c.moveTo(S.nt * u, S.st * f));
    }
    (y !== S || y === S && e === 1) && a(s, m, y, S);
  }
}
const mv = 6;
function Mc(s, t) {
  return { nt: s.nt - t.nt, st: s.st - t.st };
}
function gv(s, t) {
  return { nt: s.nt / t, st: s.st / t };
}
function Lw(s, t, e) {
  const i = Math.max(0, t - 1), n = Math.min(s.length - 1, e + 1);
  var l, a;
  return [(l = s[t], a = gv(Mc(s[e], s[i]), mv), { nt: l.nt + a.nt, st: l.st + a.st }), Mc(s[e], gv(Mc(s[n], s[t]), mv))];
}
function Dw(s, t, e, i, n) {
  const { context: l, horizontalPixelRatio: a, verticalPixelRatio: c } = t;
  l.lineTo(n.nt * a, s * c), l.lineTo(i.nt * a, s * c), l.closePath(), l.fillStyle = e, l.fill();
}
class N0 extends ci {
  constructor() {
    super(...arguments), this.G = null;
  }
  J(t) {
    this.G = t;
  }
  K(t) {
    var e;
    if (this.G === null) return;
    const { it: i, tt: n, ds: l, et: a, Nt: c, fs: u } = this.G, f = (e = this.G.vs) !== null && e !== void 0 ? e : this.G.ps ? 0 : t.mediaSize.height;
    if (n === null) return;
    const p = t.context;
    p.lineCap = "butt", p.lineJoin = "round", p.lineWidth = a, Wn(p, c), p.lineWidth = 1, A0(t, i, u, n, l, this.bs.bind(this), Dw.bind(null, f));
  }
}
function uu(s, t, e) {
  return Math.min(Math.max(s, t), e);
}
function za(s, t, e) {
  return t - s <= e;
}
function I0(s) {
  const t = Math.ceil(s);
  return t % 2 == 0 ? t - 1 : t;
}
class Au {
  ws(t, e) {
    const i = this.gs, { Ms: n, xs: l, Ss: a, ks: c, ys: u, vs: f } = e;
    if (this.Cs === void 0 || i === void 0 || i.Ms !== n || i.xs !== l || i.Ss !== a || i.ks !== c || i.vs !== f || i.ys !== u) {
      const p = t.context.createLinearGradient(0, 0, 0, u);
      if (p.addColorStop(0, n), f != null) {
        const m = uu(f * t.verticalPixelRatio / u, 0, 1);
        p.addColorStop(m, l), p.addColorStop(m, a);
      }
      p.addColorStop(1, c), this.Cs = p, this.gs = e;
    }
    return this.Cs;
  }
}
class Pw extends N0 {
  constructor() {
    super(...arguments), this.Ts = new Au();
  }
  bs(t, e) {
    return this.Ts.ws(t, { Ms: e.Ps, xs: "", Ss: "", ks: e.Rs, ys: t.bitmapSize.height });
  }
}
function Ow(s, t) {
  const e = s.context;
  e.strokeStyle = t, e.stroke();
}
class F0 extends ci {
  constructor() {
    super(...arguments), this.G = null;
  }
  J(t) {
    this.G = t;
  }
  K(t) {
    if (this.G === null) return;
    const { it: e, tt: i, ds: n, fs: l, et: a, Nt: c, Ds: u } = this.G;
    if (i === null) return;
    const f = t.context;
    f.lineCap = "butt", f.lineWidth = a * t.verticalPixelRatio, Wn(f, c), f.lineJoin = "round";
    const p = this.Vs.bind(this);
    l !== void 0 && A0(t, e, l, i, n, p, Ow), u && function(m, y, w, S, C) {
      const { horizontalPixelRatio: O, verticalPixelRatio: R, context: D } = m;
      let N = null;
      const $ = Math.max(1, Math.floor(O)) % 2 / 2, I = w * R + $;
      for (let U = S.to - 1; U >= S.from; --U) {
        const tt = y[U];
        if (tt) {
          const dt = C(m, tt);
          dt !== N && (D.beginPath(), N !== null && D.fill(), D.fillStyle = dt, N = dt);
          const nt = Math.round(tt.nt * O) + $, W = tt.st * R;
          D.moveTo(nt, W), D.arc(nt, W, I, 0, 2 * Math.PI);
        }
      }
      D.fill();
    }(t, e, u, i, p);
  }
}
class V0 extends F0 {
  Vs(t, e) {
    return e.lt;
  }
}
function B0(s, t, e, i, n = 0, l = t.length) {
  let a = l - n;
  for (; 0 < a; ) {
    const c = a >> 1, u = n + c;
    i(t[u], e) === s ? (n = u + 1, a -= c + 1) : a = c;
  }
  return n;
}
const Bo = B0.bind(null, true), j0 = B0.bind(null, false);
function Aw(s, t) {
  return s.ot < t;
}
function Nw(s, t) {
  return t < s.ot;
}
function W0(s, t, e) {
  const i = t.Os(), n = t.ui(), l = Bo(s, i, Aw), a = j0(s, n, Nw);
  if (!e) return { from: l, to: a };
  let c = l, u = a;
  return l > 0 && l < s.length && s[l].ot >= i && (c = l - 1), a > 0 && a < s.length && s[a - 1].ot <= n && (u = a + 1), { from: c, to: u };
}
class Nu {
  constructor(t, e, i) {
    this.Bs = true, this.As = true, this.Is = true, this.zs = [], this.Ls = null, this.Es = t, this.Ns = e, this.Fs = i;
  }
  bt(t) {
    this.Bs = true, t === "data" && (this.As = true), t === "options" && (this.Is = true);
  }
  gt() {
    return this.Es.yt() ? (this.Ws(), this.Ls === null ? null : this.js) : null;
  }
  Hs() {
    this.zs = this.zs.map((t) => Object.assign(Object.assign({}, t), this.Es.Us().$s(t.ot)));
  }
  qs() {
    this.Ls = null;
  }
  Ws() {
    this.As && (this.Ys(), this.As = false), this.Is && (this.Hs(), this.Is = false), this.Bs && (this.Zs(), this.Bs = false);
  }
  Zs() {
    const t = this.Es.Dt(), e = this.Ns.St();
    if (this.qs(), e.Ni() || t.Ni()) return;
    const i = e.Xs();
    if (i === null || this.Es.In().Ks() === 0) return;
    const n = this.Es.Ct();
    n !== null && (this.Ls = W0(this.zs, i, this.Fs), this.Gs(t, e, n.Vt), this.Js());
  }
}
class zr extends Nu {
  constructor(t, e) {
    super(t, e, true);
  }
  Gs(t, e, i) {
    e.Qs(this.zs, Do(this.Ls)), t.te(this.zs, i, Do(this.Ls));
  }
  ie(t, e) {
    return { ot: t, _t: e, nt: NaN, st: NaN };
  }
  Ys() {
    const t = this.Es.Us();
    this.zs = this.Es.In().ne().map((e) => {
      const i = e.Vt[3];
      return this.se(e.ee, i, t);
    });
  }
}
class Iw extends zr {
  constructor(t, e) {
    super(t, e), this.js = new Pu(), this.re = new Pw(), this.he = new V0(), this.js.Z([this.re, this.he]);
  }
  se(t, e, i) {
    return Object.assign(Object.assign({}, this.ie(t, e)), i.$s(t));
  }
  Js() {
    const t = this.Es.W();
    this.re.J({ fs: t.lineType, it: this.zs, Nt: t.lineStyle, et: t.lineWidth, vs: null, ps: t.invertFilledArea, tt: this.Ls, ds: this.Ns.St().le() }), this.he.J({ fs: t.lineVisible ? t.lineType : void 0, it: this.zs, Nt: t.lineStyle, et: t.lineWidth, tt: this.Ls, ds: this.Ns.St().le(), Ds: t.pointMarkersVisible ? t.pointMarkersRadius || t.lineWidth / 2 + 2 : void 0 });
  }
}
class Fw extends ci {
  constructor() {
    super(...arguments), this.zt = null, this.ae = 0, this.oe = 0;
  }
  J(t) {
    this.zt = t;
  }
  K({ context: t, horizontalPixelRatio: e, verticalPixelRatio: i }) {
    if (this.zt === null || this.zt.In.length === 0 || this.zt.tt === null) return;
    this.ae = this._e(e), this.ae >= 2 && Math.max(1, Math.floor(e)) % 2 != this.ae % 2 && this.ae--, this.oe = this.zt.ue ? Math.min(this.ae, Math.floor(e)) : this.ae;
    let n = null;
    const l = this.oe <= this.ae && this.zt.le >= Math.floor(1.5 * e);
    for (let a = this.zt.tt.from; a < this.zt.tt.to; ++a) {
      const c = this.zt.In[a];
      n !== c.ce && (t.fillStyle = c.ce, n = c.ce);
      const u = Math.floor(0.5 * this.oe), f = Math.round(c.nt * e), p = f - u, m = this.oe, y = p + m - 1, w = Math.min(c.de, c.fe), S = Math.max(c.de, c.fe), C = Math.round(w * i) - u, O = Math.round(S * i) + u, R = Math.max(O - C, this.oe);
      t.fillRect(p, C, m, R);
      const D = Math.ceil(1.5 * this.ae);
      if (l) {
        if (this.zt.ve) {
          const U = f - D;
          let tt = Math.max(C, Math.round(c.pe * i) - u), dt = tt + m - 1;
          dt > C + R - 1 && (dt = C + R - 1, tt = dt - m + 1), t.fillRect(U, tt, p - U, dt - tt + 1);
        }
        const N = f + D;
        let $ = Math.max(C, Math.round(c.me * i) - u), I = $ + m - 1;
        I > C + R - 1 && (I = C + R - 1, $ = I - m + 1), t.fillRect(y + 1, $, N - y, I - $ + 1);
      }
    }
  }
  _e(t) {
    const e = Math.floor(t);
    return Math.max(e, Math.floor(function(i, n) {
      return Math.floor(0.3 * i * n);
    }(ut(this.zt).le, t)));
  }
}
class H0 extends Nu {
  constructor(t, e) {
    super(t, e, false);
  }
  Gs(t, e, i) {
    e.Qs(this.zs, Do(this.Ls)), t.be(this.zs, i, Do(this.Ls));
  }
  we(t, e, i) {
    return { ot: t, ge: e.Vt[0], Me: e.Vt[1], xe: e.Vt[2], Se: e.Vt[3], nt: NaN, pe: NaN, de: NaN, fe: NaN, me: NaN };
  }
  Ys() {
    const t = this.Es.Us();
    this.zs = this.Es.In().ne().map((e) => this.se(e.ee, e, t));
  }
}
class Vw extends H0 {
  constructor() {
    super(...arguments), this.js = new Fw();
  }
  se(t, e, i) {
    return Object.assign(Object.assign({}, this.we(t, e, i)), i.$s(t));
  }
  Js() {
    const t = this.Es.W();
    this.js.J({ In: this.zs, le: this.Ns.St().le(), ve: t.openVisible, ue: t.thinBars, tt: this.Ls });
  }
}
class Bw extends N0 {
  constructor() {
    super(...arguments), this.Ts = new Au();
  }
  bs(t, e) {
    const i = this.G;
    return this.Ts.ws(t, { Ms: e.ke, xs: e.ye, Ss: e.Ce, ks: e.Te, ys: t.bitmapSize.height, vs: i.vs });
  }
}
class jw extends F0 {
  constructor() {
    super(...arguments), this.Pe = new Au();
  }
  Vs(t, e) {
    const i = this.G;
    return this.Pe.ws(t, { Ms: e.Re, xs: e.Re, Ss: e.De, ks: e.De, ys: t.bitmapSize.height, vs: i.vs });
  }
}
class Ww extends zr {
  constructor(t, e) {
    super(t, e), this.js = new Pu(), this.Ve = new Bw(), this.Oe = new jw(), this.js.Z([this.Ve, this.Oe]);
  }
  se(t, e, i) {
    return Object.assign(Object.assign({}, this.ie(t, e)), i.$s(t));
  }
  Js() {
    const t = this.Es.Ct();
    if (t === null) return;
    const e = this.Es.W(), i = this.Es.Dt().Rt(e.baseValue.price, t.Vt), n = this.Ns.St().le();
    this.Ve.J({ it: this.zs, et: e.lineWidth, Nt: e.lineStyle, fs: e.lineType, vs: i, ps: false, tt: this.Ls, ds: n }), this.Oe.J({ it: this.zs, et: e.lineWidth, Nt: e.lineStyle, fs: e.lineVisible ? e.lineType : void 0, Ds: e.pointMarkersVisible ? e.pointMarkersRadius || e.lineWidth / 2 + 2 : void 0, vs: i, tt: this.Ls, ds: n });
  }
}
class Hw extends ci {
  constructor() {
    super(...arguments), this.zt = null, this.ae = 0;
  }
  J(t) {
    this.zt = t;
  }
  K(t) {
    if (this.zt === null || this.zt.In.length === 0 || this.zt.tt === null) return;
    const { horizontalPixelRatio: e } = t;
    this.ae = function(l, a) {
      if (l >= 2.5 && l <= 4) return Math.floor(3 * a);
      const c = 1 - 0.2 * Math.atan(Math.max(4, l) - 4) / (0.5 * Math.PI), u = Math.floor(l * c * a), f = Math.floor(l * a), p = Math.min(u, f);
      return Math.max(Math.floor(a), p);
    }(this.zt.le, e), this.ae >= 2 && Math.floor(e) % 2 != this.ae % 2 && this.ae--;
    const i = this.zt.In;
    this.zt.Be && this.Ae(t, i, this.zt.tt), this.zt._i && this.Ie(t, i, this.zt.tt);
    const n = this.ze(e);
    (!this.zt._i || this.ae > 2 * n) && this.Le(t, i, this.zt.tt);
  }
  Ae(t, e, i) {
    if (this.zt === null) return;
    const { context: n, horizontalPixelRatio: l, verticalPixelRatio: a } = t;
    let c = "", u = Math.min(Math.floor(l), Math.floor(this.zt.le * l));
    u = Math.max(Math.floor(l), Math.min(u, this.ae));
    const f = Math.floor(0.5 * u);
    let p = null;
    for (let m = i.from; m < i.to; m++) {
      const y = e[m];
      y.Ee !== c && (n.fillStyle = y.Ee, c = y.Ee);
      const w = Math.round(Math.min(y.pe, y.me) * a), S = Math.round(Math.max(y.pe, y.me) * a), C = Math.round(y.de * a), O = Math.round(y.fe * a);
      let R = Math.round(l * y.nt) - f;
      const D = R + u - 1;
      p !== null && (R = Math.max(p + 1, R), R = Math.min(R, D));
      const N = D - R + 1;
      n.fillRect(R, C, N, w - C), n.fillRect(R, S + 1, N, O - S), p = D;
    }
  }
  ze(t) {
    let e = Math.floor(1 * t);
    this.ae <= 2 * e && (e = Math.floor(0.5 * (this.ae - 1)));
    const i = Math.max(Math.floor(t), e);
    return this.ae <= 2 * i ? Math.max(Math.floor(t), Math.floor(1 * t)) : i;
  }
  Ie(t, e, i) {
    if (this.zt === null) return;
    const { context: n, horizontalPixelRatio: l, verticalPixelRatio: a } = t;
    let c = "";
    const u = this.ze(l);
    let f = null;
    for (let p = i.from; p < i.to; p++) {
      const m = e[p];
      m.Ne !== c && (n.fillStyle = m.Ne, c = m.Ne);
      let y = Math.round(m.nt * l) - Math.floor(0.5 * this.ae);
      const w = y + this.ae - 1, S = Math.round(Math.min(m.pe, m.me) * a), C = Math.round(Math.max(m.pe, m.me) * a);
      if (f !== null && (y = Math.max(f + 1, y), y = Math.min(y, w)), this.zt.le * l > 2 * u) Mw(n, y, S, w - y + 1, C - S + 1, u);
      else {
        const O = w - y + 1;
        n.fillRect(y, S, O, C - S + 1);
      }
      f = w;
    }
  }
  Le(t, e, i) {
    if (this.zt === null) return;
    const { context: n, horizontalPixelRatio: l, verticalPixelRatio: a } = t;
    let c = "";
    const u = this.ze(l);
    for (let f = i.from; f < i.to; f++) {
      const p = e[f];
      let m = Math.round(Math.min(p.pe, p.me) * a), y = Math.round(Math.max(p.pe, p.me) * a), w = Math.round(p.nt * l) - Math.floor(0.5 * this.ae), S = w + this.ae - 1;
      if (p.ce !== c) {
        const C = p.ce;
        n.fillStyle = C, c = C;
      }
      this.zt._i && (w += u, m += u, S -= u, y -= u), m > y || n.fillRect(w, m, S - w + 1, y - m + 1);
    }
  }
}
class Kw extends H0 {
  constructor() {
    super(...arguments), this.js = new Hw();
  }
  se(t, e, i) {
    return Object.assign(Object.assign({}, this.we(t, e, i)), i.$s(t));
  }
  Js() {
    const t = this.Es.W();
    this.js.J({ In: this.zs, le: this.Ns.St().le(), Be: t.wickVisible, _i: t.borderVisible, tt: this.Ls });
  }
}
class qw {
  constructor(t, e) {
    this.Fe = t, this.Li = e;
  }
  X(t, e, i) {
    this.Fe.draw(t, this.Li, e, i);
  }
}
class $c extends Nu {
  constructor(t, e, i) {
    super(t, e, false), this.wn = i, this.js = new qw(this.wn.renderer(), (n) => {
      const l = t.Ct();
      return l === null ? null : t.Dt().Rt(n, l.Vt);
    });
  }
  We(t) {
    return this.wn.priceValueBuilder(t);
  }
  je(t) {
    return this.wn.isWhitespace(t);
  }
  Ys() {
    const t = this.Es.Us();
    this.zs = this.Es.In().ne().map((e) => Object.assign(Object.assign({ ot: e.ee, nt: NaN }, t.$s(e.ee)), { He: e.$e }));
  }
  Gs(t, e) {
    e.Qs(this.zs, Do(this.Ls));
  }
  Js() {
    this.wn.update({ bars: this.zs.map(Uw), barSpacing: this.Ns.St().le(), visibleRange: this.Ls }, this.Es.W());
  }
}
function Uw(s) {
  return { x: s.nt, time: s.ot, originalData: s.He, barColor: s.ce };
}
class Jw extends ci {
  constructor() {
    super(...arguments), this.zt = null, this.Ue = [];
  }
  J(t) {
    this.zt = t, this.Ue = [];
  }
  K({ context: t, horizontalPixelRatio: e, verticalPixelRatio: i }) {
    if (this.zt === null || this.zt.it.length === 0 || this.zt.tt === null) return;
    this.Ue.length || this.qe(e);
    const n = Math.max(1, Math.floor(i)), l = Math.round(this.zt.Ye * i) - Math.floor(n / 2), a = l + n;
    for (let c = this.zt.tt.from; c < this.zt.tt.to; c++) {
      const u = this.zt.it[c], f = this.Ue[c - this.zt.tt.from], p = Math.round(u.st * i);
      let m, y;
      t.fillStyle = u.ce, p <= l ? (m = p, y = a) : (m = l, y = p - Math.floor(n / 2) + n), t.fillRect(f.Os, m, f.ui - f.Os + 1, y - m);
    }
  }
  qe(t) {
    if (this.zt === null || this.zt.it.length === 0 || this.zt.tt === null) return void (this.Ue = []);
    const e = Math.ceil(this.zt.le * t) <= 1 ? 0 : Math.max(1, Math.floor(t)), i = Math.round(this.zt.le * t) - e;
    this.Ue = new Array(this.zt.tt.to - this.zt.tt.from);
    for (let l = this.zt.tt.from; l < this.zt.tt.to; l++) {
      const a = this.zt.it[l], c = Math.round(a.nt * t);
      let u, f;
      if (i % 2) {
        const p = (i - 1) / 2;
        u = c - p, f = c + p;
      } else {
        const p = i / 2;
        u = c - p, f = c + p - 1;
      }
      this.Ue[l - this.zt.tt.from] = { Os: u, ui: f, Ze: c, Xe: a.nt * t, ot: a.ot };
    }
    for (let l = this.zt.tt.from + 1; l < this.zt.tt.to; l++) {
      const a = this.Ue[l - this.zt.tt.from], c = this.Ue[l - this.zt.tt.from - 1];
      a.ot === c.ot + 1 && a.Os - c.ui !== e + 1 && (c.Ze > c.Xe ? c.ui = a.Os - e - 1 : a.Os = c.ui + e + 1);
    }
    let n = Math.ceil(this.zt.le * t);
    for (let l = this.zt.tt.from; l < this.zt.tt.to; l++) {
      const a = this.Ue[l - this.zt.tt.from];
      a.ui < a.Os && (a.ui = a.Os);
      const c = a.ui - a.Os + 1;
      n = Math.min(c, n);
    }
    if (e > 0 && n < 4) for (let l = this.zt.tt.from; l < this.zt.tt.to; l++) {
      const a = this.Ue[l - this.zt.tt.from];
      a.ui - a.Os + 1 > n && (a.Ze > a.Xe ? a.ui -= 1 : a.Os += 1);
    }
  }
}
class Xw extends zr {
  constructor() {
    super(...arguments), this.js = new Jw();
  }
  se(t, e, i) {
    return Object.assign(Object.assign({}, this.ie(t, e)), i.$s(t));
  }
  Js() {
    const t = { it: this.zs, le: this.Ns.St().le(), tt: this.Ls, Ye: this.Es.Dt().Rt(this.Es.W().base, ut(this.Es.Ct()).Vt) };
    this.js.J(t);
  }
}
class Gw extends zr {
  constructor() {
    super(...arguments), this.js = new V0();
  }
  se(t, e, i) {
    return Object.assign(Object.assign({}, this.ie(t, e)), i.$s(t));
  }
  Js() {
    const t = this.Es.W(), e = { it: this.zs, Nt: t.lineStyle, fs: t.lineVisible ? t.lineType : void 0, et: t.lineWidth, Ds: t.pointMarkersVisible ? t.pointMarkersRadius || t.lineWidth / 2 + 2 : void 0, tt: this.Ls, ds: this.Ns.St().le() };
    this.js.J(e);
  }
}
const Qw = /[2-9]/g;
class Po {
  constructor(t = 50) {
    this.Ke = 0, this.Ge = 1, this.Je = 1, this.Qe = {}, this.tr = /* @__PURE__ */ new Map(), this.ir = t;
  }
  nr() {
    this.Ke = 0, this.tr.clear(), this.Ge = 1, this.Je = 1, this.Qe = {};
  }
  xi(t, e, i) {
    return this.sr(t, e, i).width;
  }
  Mi(t, e, i) {
    const n = this.sr(t, e, i);
    return ((n.actualBoundingBoxAscent || 0) - (n.actualBoundingBoxDescent || 0)) / 2;
  }
  sr(t, e, i) {
    const n = i || Qw, l = String(e).replace(n, "0");
    if (this.tr.has(l)) return ws(this.tr.get(l)).er;
    if (this.Ke === this.ir) {
      const c = this.Qe[this.Je];
      delete this.Qe[this.Je], this.tr.delete(c), this.Je++, this.Ke--;
    }
    t.save(), t.textBaseline = "middle";
    const a = t.measureText(l);
    return t.restore(), a.width === 0 && e.length || (this.tr.set(l, { er: a, rr: this.Ge }), this.Qe[this.Ge] = l, this.Ke++, this.Ge++), a;
  }
}
class Yw {
  constructor(t) {
    this.hr = null, this.k = null, this.lr = "right", this.ar = t;
  }
  _r(t, e, i) {
    this.hr = t, this.k = e, this.lr = i;
  }
  X(t) {
    this.k !== null && this.hr !== null && this.hr.X(t, this.k, this.ar, this.lr);
  }
}
class K0 {
  constructor(t, e, i) {
    this.ur = t, this.ar = new Po(50), this.cr = e, this.F = i, this.j = -1, this.Wt = new Yw(this.ar);
  }
  gt() {
    const t = this.F.dr(this.cr);
    if (t === null) return null;
    const e = t.vr(this.cr) ? t.pr() : this.cr.Dt();
    if (e === null) return null;
    const i = t.mr(e);
    if (i === "overlay") return null;
    const n = this.F.br();
    return n.P !== this.j && (this.j = n.P, this.ar.nr()), this.Wt._r(this.ur.Ii(), n, i), this.Wt;
  }
}
class Zw extends ci {
  constructor() {
    super(...arguments), this.zt = null;
  }
  J(t) {
    this.zt = t;
  }
  wr(t, e) {
    var i;
    if (!(!((i = this.zt) === null || i === void 0) && i.yt)) return null;
    const { st: n, et: l, gr: a } = this.zt;
    return e >= n - l - 7 && e <= n + l + 7 ? { Mr: this.zt, gr: a } : null;
  }
  K({ context: t, bitmapSize: e, horizontalPixelRatio: i, verticalPixelRatio: n }) {
    if (this.zt === null || this.zt.yt === false) return;
    const l = Math.round(this.zt.st * n);
    l < 0 || l > e.height || (t.lineCap = "butt", t.strokeStyle = this.zt.V, t.lineWidth = Math.floor(this.zt.et * i), Wn(t, this.zt.Nt), R0(t, l, 0, e.width));
  }
}
class Iu {
  constructor(t) {
    this.Sr = { st: 0, V: "rgba(0, 0, 0, 0)", et: 1, Nt: 0, yt: false }, this.kr = new Zw(), this.ft = true, this.Es = t, this.Ns = t.$t(), this.kr.J(this.Sr);
  }
  bt() {
    this.ft = true;
  }
  gt() {
    return this.Es.yt() ? (this.ft && (this.yr(), this.ft = false), this.kr) : null;
  }
}
class t2 extends Iu {
  constructor(t) {
    super(t);
  }
  yr() {
    this.Sr.yt = false;
    const t = this.Es.Dt(), e = t.Cr().Cr;
    if (e !== 2 && e !== 3) return;
    const i = this.Es.W();
    if (!i.baseLineVisible || !this.Es.yt()) return;
    const n = this.Es.Ct();
    n !== null && (this.Sr.yt = true, this.Sr.st = t.Rt(n.Vt, n.Vt), this.Sr.V = i.baseLineColor, this.Sr.et = i.baseLineWidth, this.Sr.Nt = i.baseLineStyle);
  }
}
class e2 extends ci {
  constructor() {
    super(...arguments), this.zt = null;
  }
  J(t) {
    this.zt = t;
  }
  $e() {
    return this.zt;
  }
  K({ context: t, horizontalPixelRatio: e, verticalPixelRatio: i }) {
    const n = this.zt;
    if (n === null) return;
    const l = Math.max(1, Math.floor(e)), a = l % 2 / 2, c = Math.round(n.Xe.x * e) + a, u = n.Xe.y * i;
    t.fillStyle = n.Tr, t.beginPath();
    const f = Math.max(2, 1.5 * n.Pr) * e;
    t.arc(c, u, f, 0, 2 * Math.PI, false), t.fill(), t.fillStyle = n.Rr, t.beginPath(), t.arc(c, u, n.ht * e, 0, 2 * Math.PI, false), t.fill(), t.lineWidth = l, t.strokeStyle = n.Dr, t.beginPath(), t.arc(c, u, n.ht * e + l / 2, 0, 2 * Math.PI, false), t.stroke();
  }
}
const s2 = [{ Vr: 0, Or: 0.25, Br: 4, Ar: 10, Ir: 0.25, zr: 0, Lr: 0.4, Er: 0.8 }, { Vr: 0.25, Or: 0.525, Br: 10, Ar: 14, Ir: 0, zr: 0, Lr: 0.8, Er: 0 }, { Vr: 0.525, Or: 1, Br: 14, Ar: 14, Ir: 0, zr: 0, Lr: 0, Er: 0 }];
function bv(s, t, e, i) {
  return function(n, l) {
    if (n === "transparent") return n;
    const a = zo(n), c = a[3];
    return `rgba(${a[0]}, ${a[1]}, ${a[2]}, ${l * c})`;
  }(s, e + (i - e) * t);
}
function yv(s, t) {
  const e = s % 2600 / 2600;
  let i;
  for (const u of s2) if (e >= u.Vr && e <= u.Or) {
    i = u;
    break;
  }
  hn(i !== void 0, "Last price animation internal logic error");
  const n = (e - i.Vr) / (i.Or - i.Vr);
  return { Rr: bv(t, n, i.Ir, i.zr), Dr: bv(t, n, i.Lr, i.Er), ht: (l = n, a = i.Br, c = i.Ar, a + (c - a) * l) };
  var l, a, c;
}
class i2 {
  constructor(t) {
    this.Wt = new e2(), this.ft = true, this.Nr = true, this.Fr = performance.now(), this.Wr = this.Fr - 1, this.jr = t;
  }
  Hr() {
    this.Wr = this.Fr - 1, this.bt();
  }
  $r() {
    if (this.bt(), this.jr.W().lastPriceAnimation === 2) {
      const t = performance.now(), e = this.Wr - t;
      if (e > 0) return void (e < 650 && (this.Wr += 2600));
      this.Fr = t, this.Wr = t + 2600;
    }
  }
  bt() {
    this.ft = true;
  }
  Ur() {
    this.Nr = true;
  }
  yt() {
    return this.jr.W().lastPriceAnimation !== 0;
  }
  qr() {
    switch (this.jr.W().lastPriceAnimation) {
      case 0:
        return false;
      case 1:
        return true;
      case 2:
        return performance.now() <= this.Wr;
    }
  }
  gt() {
    return this.ft ? (this.Mt(), this.ft = false, this.Nr = false) : this.Nr && (this.Yr(), this.Nr = false), this.Wt;
  }
  Mt() {
    this.Wt.J(null);
    const t = this.jr.$t().St(), e = t.Xs(), i = this.jr.Ct();
    if (e === null || i === null) return;
    const n = this.jr.Zr(true);
    if (n.Xr || !e.Kr(n.ee)) return;
    const l = { x: t.It(n.ee), y: this.jr.Dt().Rt(n._t, i.Vt) }, a = n.V, c = this.jr.W().lineWidth, u = yv(this.Gr(), a);
    this.Wt.J({ Tr: a, Pr: c, Rr: u.Rr, Dr: u.Dr, ht: u.ht, Xe: l });
  }
  Yr() {
    const t = this.Wt.$e();
    if (t !== null) {
      const e = yv(this.Gr(), t.Tr);
      t.Rr = e.Rr, t.Dr = e.Dr, t.ht = e.ht;
    }
  }
  Gr() {
    return this.qr() ? performance.now() - this.Fr : 2599;
  }
}
function mo(s, t) {
  return I0(Math.min(Math.max(s, 12), 30) * t);
}
function Oo(s, t) {
  switch (s) {
    case "arrowDown":
    case "arrowUp":
      return mo(t, 1);
    case "circle":
      return mo(t, 0.8);
    case "square":
      return mo(t, 0.7);
  }
}
function q0(s) {
  return function(t) {
    const e = Math.ceil(t);
    return e % 2 != 0 ? e - 1 : e;
  }(mo(s, 1));
}
function _v(s) {
  return Math.max(mo(s, 0.1), 3);
}
function wv(s, t, e) {
  return t ? s : e ? Math.ceil(s / 2) : 0;
}
function U0(s, t, e, i, n) {
  const l = Oo("square", e), a = (l - 1) / 2, c = s - a, u = t - a;
  return i >= c && i <= c + l && n >= u && n <= u + l;
}
function kv(s, t, e, i) {
  const n = (Oo("arrowUp", i) - 1) / 2 * e.Jr, l = (I0(i / 2) - 1) / 2 * e.Jr;
  t.beginPath(), s ? (t.moveTo(e.nt - n, e.st), t.lineTo(e.nt, e.st - n), t.lineTo(e.nt + n, e.st), t.lineTo(e.nt + l, e.st), t.lineTo(e.nt + l, e.st + n), t.lineTo(e.nt - l, e.st + n), t.lineTo(e.nt - l, e.st)) : (t.moveTo(e.nt - n, e.st), t.lineTo(e.nt, e.st + n), t.lineTo(e.nt + n, e.st), t.lineTo(e.nt + l, e.st), t.lineTo(e.nt + l, e.st - n), t.lineTo(e.nt - l, e.st - n), t.lineTo(e.nt - l, e.st)), t.fill();
}
function n2(s, t, e, i, n, l) {
  return U0(t, e, i, n, l);
}
class l2 extends ci {
  constructor() {
    super(...arguments), this.zt = null, this.ar = new Po(), this.j = -1, this.H = "", this.Qr = "";
  }
  J(t) {
    this.zt = t;
  }
  _r(t, e) {
    this.j === t && this.H === e || (this.j = t, this.H = e, this.Qr = xl(t, e), this.ar.nr());
  }
  wr(t, e) {
    if (this.zt === null || this.zt.tt === null) return null;
    for (let i = this.zt.tt.from; i < this.zt.tt.to; i++) {
      const n = this.zt.it[i];
      if (a2(n, t, e)) return { Mr: n.th, gr: n.gr };
    }
    return null;
  }
  K({ context: t, horizontalPixelRatio: e, verticalPixelRatio: i }, n, l) {
    if (this.zt !== null && this.zt.tt !== null) {
      t.textBaseline = "middle", t.font = this.Qr;
      for (let a = this.zt.tt.from; a < this.zt.tt.to; a++) {
        const c = this.zt.it[a];
        c.Kt !== void 0 && (c.Kt.Hi = this.ar.xi(t, c.Kt.ih), c.Kt.At = this.j, c.Kt.nt = c.nt - c.Kt.Hi / 2), o2(c, t, e, i);
      }
    }
  }
}
function o2(s, t, e, i) {
  t.fillStyle = s.V, s.Kt !== void 0 && function(n, l, a, c, u, f) {
    n.save(), n.scale(u, f), n.fillText(l, a, c), n.restore();
  }(t, s.Kt.ih, s.Kt.nt, s.Kt.st, e, i), function(n, l, a) {
    if (n.Ks !== 0) {
      switch (n.nh) {
        case "arrowDown":
          return void kv(false, l, a, n.Ks);
        case "arrowUp":
          return void kv(true, l, a, n.Ks);
        case "circle":
          return void function(c, u, f) {
            const p = (Oo("circle", f) - 1) / 2;
            c.beginPath(), c.arc(u.nt, u.st, p * u.Jr, 0, 2 * Math.PI, false), c.fill();
          }(l, a, n.Ks);
        case "square":
          return void function(c, u, f) {
            const p = Oo("square", f), m = (p - 1) * u.Jr / 2, y = u.nt - m, w = u.st - m;
            c.fillRect(y, w, p * u.Jr, p * u.Jr);
          }(l, a, n.Ks);
      }
      n.nh;
    }
  }(s, t, function(n, l, a) {
    const c = Math.max(1, Math.floor(l)) % 2 / 2;
    return { nt: Math.round(n.nt * l) + c, st: n.st * a, Jr: l };
  }(s, e, i));
}
function a2(s, t, e) {
  return !(s.Kt === void 0 || !function(i, n, l, a, c, u) {
    const f = a / 2;
    return c >= i && c <= i + l && u >= n - f && u <= n + f;
  }(s.Kt.nt, s.Kt.st, s.Kt.Hi, s.Kt.At, t, e)) || function(i, n, l) {
    if (i.Ks === 0) return false;
    switch (i.nh) {
      case "arrowDown":
      case "arrowUp":
        return n2(0, i.nt, i.st, i.Ks, n, l);
      case "circle":
        return function(a, c, u, f, p) {
          const m = 2 + Oo("circle", u) / 2, y = a - f, w = c - p;
          return Math.sqrt(y * y + w * w) <= m;
        }(i.nt, i.st, i.Ks, n, l);
      case "square":
        return U0(i.nt, i.st, i.Ks, n, l);
    }
  }(s, t, e);
}
function r2(s, t, e, i, n, l, a, c, u) {
  const f = _i(e) ? e : e.Se, p = _i(e) ? e : e.Me, m = _i(e) ? e : e.xe, y = _i(t.size) ? Math.max(t.size, 0) : 1, w = q0(c.le()) * y, S = w / 2;
  switch (s.Ks = w, t.position) {
    case "inBar":
      return s.st = a.Rt(f, u), void (s.Kt !== void 0 && (s.Kt.st = s.st + S + l + 0.6 * n));
    case "aboveBar":
      return s.st = a.Rt(p, u) - S - i.sh, s.Kt !== void 0 && (s.Kt.st = s.st - S - 0.6 * n, i.sh += 1.2 * n), void (i.sh += w + l);
    case "belowBar":
      return s.st = a.Rt(m, u) + S + i.eh, s.Kt !== void 0 && (s.Kt.st = s.st + S + l + 0.6 * n, i.eh += 1.2 * n), void (i.eh += w + l);
  }
  t.position;
}
class c2 {
  constructor(t, e) {
    this.ft = true, this.rh = true, this.hh = true, this.ah = null, this.oh = null, this.Wt = new l2(), this.jr = t, this.$i = e, this.zt = { it: [], tt: null };
  }
  bt(t) {
    this.ft = true, this.hh = true, t === "data" && (this.rh = true, this.oh = null);
  }
  gt(t) {
    if (!this.jr.yt()) return null;
    this.ft && this._h();
    const e = this.$i.W().layout;
    return this.Wt._r(e.fontSize, e.fontFamily), this.Wt.J(this.zt), this.Wt;
  }
  uh() {
    if (this.hh) {
      if (this.jr.dh().length > 0) {
        const t = this.$i.St().le(), e = _v(t), i = 1.5 * q0(t) + 2 * e, n = this.fh();
        this.ah = { above: wv(i, n.aboveBar, n.inBar), below: wv(i, n.belowBar, n.inBar) };
      } else this.ah = null;
      this.hh = false;
    }
    return this.ah;
  }
  fh() {
    return this.oh === null && (this.oh = this.jr.dh().reduce((t, e) => (t[e.position] || (t[e.position] = true), t), { inBar: false, aboveBar: false, belowBar: false })), this.oh;
  }
  _h() {
    const t = this.jr.Dt(), e = this.$i.St(), i = this.jr.dh();
    this.rh && (this.zt.it = i.map((p) => ({ ot: p.time, nt: 0, st: 0, Ks: 0, nh: p.shape, V: p.color, th: p.th, gr: p.id, Kt: void 0 })), this.rh = false);
    const n = this.$i.W().layout;
    this.zt.tt = null;
    const l = e.Xs();
    if (l === null) return;
    const a = this.jr.Ct();
    if (a === null || this.zt.it.length === 0) return;
    let c = NaN;
    const u = _v(e.le()), f = { sh: u, eh: u };
    this.zt.tt = W0(this.zt.it, l, true);
    for (let p = this.zt.tt.from; p < this.zt.tt.to; p++) {
      const m = i[p];
      m.time !== c && (f.sh = u, f.eh = u, c = m.time);
      const y = this.zt.it[p];
      y.nt = e.It(m.time), m.text !== void 0 && m.text.length > 0 && (y.Kt = { ih: m.text, nt: 0, st: 0, Hi: 0, At: 0 });
      const w = this.jr.ph(m.time);
      w !== null && r2(y, m, w, f, n.fontSize, u, t, e, a.Vt);
    }
    this.ft = false;
  }
}
class u2 extends Iu {
  constructor(t) {
    super(t);
  }
  yr() {
    const t = this.Sr;
    t.yt = false;
    const e = this.Es.W();
    if (!e.priceLineVisible || !this.Es.yt()) return;
    const i = this.Es.Zr(e.priceLineSource === 0);
    i.Xr || (t.yt = true, t.st = i.ki, t.V = this.Es.mh(i.V), t.et = e.priceLineWidth, t.Nt = e.priceLineStyle);
  }
}
class h2 extends Tr {
  constructor(t) {
    super(), this.jt = t;
  }
  zi(t, e, i) {
    t.yt = false, e.yt = false;
    const n = this.jt;
    if (!n.yt()) return;
    const l = n.W(), a = l.lastValueVisible, c = n.bh() !== "", u = l.seriesLastValueMode === 0, f = n.Zr(false);
    if (f.Xr) return;
    a && (t.Kt = this.wh(f, a, u), t.yt = t.Kt.length !== 0), (c || u) && (e.Kt = this.gh(f, a, c, u), e.yt = e.Kt.length > 0);
    const p = n.mh(f.V), m = Mr(p);
    i.t = m.t, i.ki = f.ki, e.Ot = n.$t().Bt(f.ki / n.Dt().At()), t.Ot = p, t.V = m.i, e.V = m.i;
  }
  gh(t, e, i, n) {
    let l = "";
    const a = this.jt.bh();
    return i && a.length !== 0 && (l += `${a} `), e && n && (l += this.jt.Dt().Mh() ? t.xh : t.Sh), l.trim();
  }
  wh(t, e, i) {
    return e ? i ? this.jt.Dt().Mh() ? t.Sh : t.xh : t.Kt : "";
  }
}
function Sv(s, t, e, i) {
  const n = Number.isFinite(t), l = Number.isFinite(e);
  return n && l ? s(t, e) : n || l ? n ? t : e : i;
}
class Ls {
  constructor(t, e) {
    this.kh = t, this.yh = e;
  }
  Ch(t) {
    return t !== null && this.kh === t.kh && this.yh === t.yh;
  }
  Th() {
    return new Ls(this.kh, this.yh);
  }
  Ph() {
    return this.kh;
  }
  Rh() {
    return this.yh;
  }
  Dh() {
    return this.yh - this.kh;
  }
  Ni() {
    return this.yh === this.kh || Number.isNaN(this.yh) || Number.isNaN(this.kh);
  }
  ts(t) {
    return t === null ? this : new Ls(Sv(Math.min, this.Ph(), t.Ph(), -1 / 0), Sv(Math.max, this.Rh(), t.Rh(), 1 / 0));
  }
  Vh(t) {
    if (!_i(t) || this.yh - this.kh === 0) return;
    const e = 0.5 * (this.yh + this.kh);
    let i = this.yh - e, n = this.kh - e;
    i *= t, n *= t, this.yh = e + i, this.kh = e + n;
  }
  Oh(t) {
    _i(t) && (this.yh += t, this.kh += t);
  }
  Bh() {
    return { minValue: this.kh, maxValue: this.yh };
  }
  static Ah(t) {
    return t === null ? null : new Ls(t.minValue, t.maxValue);
  }
}
class cr {
  constructor(t, e) {
    this.Ih = t, this.zh = e || null;
  }
  Lh() {
    return this.Ih;
  }
  Eh() {
    return this.zh;
  }
  Bh() {
    return this.Ih === null ? null : { priceRange: this.Ih.Bh(), margins: this.zh || void 0 };
  }
  static Ah(t) {
    return t === null ? null : new cr(Ls.Ah(t.priceRange), t.margins);
  }
}
class d2 extends Iu {
  constructor(t, e) {
    super(t), this.Nh = e;
  }
  yr() {
    const t = this.Sr;
    t.yt = false;
    const e = this.Nh.W();
    if (!this.Es.yt() || !e.lineVisible) return;
    const i = this.Nh.Fh();
    i !== null && (t.yt = true, t.st = i, t.V = e.color, t.et = e.lineWidth, t.Nt = e.lineStyle, t.gr = this.Nh.W().id);
  }
}
class f2 extends Tr {
  constructor(t, e) {
    super(), this.jr = t, this.Nh = e;
  }
  zi(t, e, i) {
    t.yt = false, e.yt = false;
    const n = this.Nh.W(), l = n.axisLabelVisible, a = n.title !== "", c = this.jr;
    if (!l || !c.yt()) return;
    const u = this.Nh.Fh();
    if (u === null) return;
    a && (e.Kt = n.title, e.yt = true), e.Ot = c.$t().Bt(u / c.Dt().At()), t.Kt = this.Wh(n.price), t.yt = true;
    const f = Mr(n.axisLabelColor || n.color);
    i.t = f.t;
    const p = n.axisLabelTextColor || f.i;
    t.V = p, e.V = p, i.ki = u;
  }
  Wh(t) {
    const e = this.jr.Ct();
    return e === null ? "" : this.jr.Dt().Fi(t, e.Vt);
  }
}
class v2 {
  constructor(t, e) {
    this.jr = t, this.cn = e, this.jh = new d2(t, this), this.ur = new f2(t, this), this.Hh = new K0(this.ur, t, t.$t());
  }
  $h(t) {
    ri(this.cn, t), this.bt(), this.jr.$t().Uh();
  }
  W() {
    return this.cn;
  }
  qh() {
    return this.jh;
  }
  Yh() {
    return this.Hh;
  }
  Zh() {
    return this.ur;
  }
  bt() {
    this.jh.bt(), this.ur.bt();
  }
  Fh() {
    const t = this.jr, e = t.Dt();
    if (t.$t().St().Ni() || e.Ni()) return null;
    const i = t.Ct();
    return i === null ? null : e.Rt(this.cn.price, i.Vt);
  }
}
class p2 extends Ou {
  constructor(t) {
    super(), this.$i = t;
  }
  $t() {
    return this.$i;
  }
}
const m2 = { Bar: (s, t, e, i) => {
  var n;
  const l = t.upColor, a = t.downColor, c = ut(s(e, i)), u = pl(c.Vt[0]) <= pl(c.Vt[3]);
  return { ce: (n = c.V) !== null && n !== void 0 ? n : u ? l : a };
}, Candlestick: (s, t, e, i) => {
  var n, l, a;
  const c = t.upColor, u = t.downColor, f = t.borderUpColor, p = t.borderDownColor, m = t.wickUpColor, y = t.wickDownColor, w = ut(s(e, i)), S = pl(w.Vt[0]) <= pl(w.Vt[3]);
  return { ce: (n = w.V) !== null && n !== void 0 ? n : S ? c : u, Ne: (l = w.Ot) !== null && l !== void 0 ? l : S ? f : p, Ee: (a = w.Xh) !== null && a !== void 0 ? a : S ? m : y };
}, Custom: (s, t, e, i) => {
  var n;
  return { ce: (n = ut(s(e, i)).V) !== null && n !== void 0 ? n : t.color };
}, Area: (s, t, e, i) => {
  var n, l, a, c;
  const u = ut(s(e, i));
  return { ce: (n = u.lt) !== null && n !== void 0 ? n : t.lineColor, lt: (l = u.lt) !== null && l !== void 0 ? l : t.lineColor, Ps: (a = u.Ps) !== null && a !== void 0 ? a : t.topColor, Rs: (c = u.Rs) !== null && c !== void 0 ? c : t.bottomColor };
}, Baseline: (s, t, e, i) => {
  var n, l, a, c, u, f;
  const p = ut(s(e, i));
  return { ce: p.Vt[3] >= t.baseValue.price ? t.topLineColor : t.bottomLineColor, Re: (n = p.Re) !== null && n !== void 0 ? n : t.topLineColor, De: (l = p.De) !== null && l !== void 0 ? l : t.bottomLineColor, ke: (a = p.ke) !== null && a !== void 0 ? a : t.topFillColor1, ye: (c = p.ye) !== null && c !== void 0 ? c : t.topFillColor2, Ce: (u = p.Ce) !== null && u !== void 0 ? u : t.bottomFillColor1, Te: (f = p.Te) !== null && f !== void 0 ? f : t.bottomFillColor2 };
}, Line: (s, t, e, i) => {
  var n, l;
  const a = ut(s(e, i));
  return { ce: (n = a.V) !== null && n !== void 0 ? n : t.color, lt: (l = a.V) !== null && l !== void 0 ? l : t.color };
}, Histogram: (s, t, e, i) => {
  var n;
  return { ce: (n = ut(s(e, i)).V) !== null && n !== void 0 ? n : t.color };
} };
class g2 {
  constructor(t) {
    this.Kh = (e, i) => i !== void 0 ? i.Vt : this.jr.In().Gh(e), this.jr = t, this.Jh = m2[t.Qh()];
  }
  $s(t, e) {
    return this.Jh(this.Kh, this.jr.W(), t, e);
  }
}
var xv;
(function(s) {
  s[s.NearestLeft = -1] = "NearestLeft", s[s.None = 0] = "None", s[s.NearestRight = 1] = "NearestRight";
})(xv || (xv = {}));
const nn = 30;
class b2 {
  constructor() {
    this.tl = [], this.il = /* @__PURE__ */ new Map(), this.nl = /* @__PURE__ */ new Map();
  }
  sl() {
    return this.Ks() > 0 ? this.tl[this.tl.length - 1] : null;
  }
  el() {
    return this.Ks() > 0 ? this.rl(0) : null;
  }
  An() {
    return this.Ks() > 0 ? this.rl(this.tl.length - 1) : null;
  }
  Ks() {
    return this.tl.length;
  }
  Ni() {
    return this.Ks() === 0;
  }
  Kr(t) {
    return this.hl(t, 0) !== null;
  }
  Gh(t) {
    return this.ll(t);
  }
  ll(t, e = 0) {
    const i = this.hl(t, e);
    return i === null ? null : Object.assign(Object.assign({}, this.al(i)), { ee: this.rl(i) });
  }
  ne() {
    return this.tl;
  }
  ol(t, e, i) {
    if (this.Ni()) return null;
    let n = null;
    for (const l of i) n = La(n, this._l(t, e, l));
    return n;
  }
  J(t) {
    this.nl.clear(), this.il.clear(), this.tl = t;
  }
  rl(t) {
    return this.tl[t].ee;
  }
  al(t) {
    return this.tl[t];
  }
  hl(t, e) {
    const i = this.ul(t);
    if (i === null && e !== 0) switch (e) {
      case -1:
        return this.cl(t);
      case 1:
        return this.dl(t);
      default:
        throw new TypeError("Unknown search mode");
    }
    return i;
  }
  cl(t) {
    let e = this.fl(t);
    return e > 0 && (e -= 1), e !== this.tl.length && this.rl(e) < t ? e : null;
  }
  dl(t) {
    const e = this.vl(t);
    return e !== this.tl.length && t < this.rl(e) ? e : null;
  }
  ul(t) {
    const e = this.fl(t);
    return e === this.tl.length || t < this.tl[e].ee ? null : e;
  }
  fl(t) {
    return Bo(this.tl, t, (e, i) => e.ee < i);
  }
  vl(t) {
    return j0(this.tl, t, (e, i) => e.ee > i);
  }
  pl(t, e, i) {
    let n = null;
    for (let l = t; l < e; l++) {
      const a = this.tl[l].Vt[i];
      Number.isNaN(a) || (n === null ? n = { ml: a, bl: a } : (a < n.ml && (n.ml = a), a > n.bl && (n.bl = a)));
    }
    return n;
  }
  _l(t, e, i) {
    if (this.Ni()) return null;
    let n = null;
    const l = ut(this.el()), a = ut(this.An()), c = Math.max(t, l), u = Math.min(e, a), f = Math.ceil(c / nn) * nn, p = Math.max(f, Math.floor(u / nn) * nn);
    {
      const y = this.fl(c), w = this.vl(Math.min(u, f, e));
      n = La(n, this.pl(y, w, i));
    }
    let m = this.il.get(i);
    m === void 0 && (m = /* @__PURE__ */ new Map(), this.il.set(i, m));
    for (let y = Math.max(f + 1, c); y < p; y += nn) {
      const w = Math.floor(y / nn);
      let S = m.get(w);
      if (S === void 0) {
        const C = this.fl(w * nn), O = this.vl((w + 1) * nn - 1);
        S = this.pl(C, O, i), m.set(w, S);
      }
      n = La(n, S);
    }
    {
      const y = this.fl(p), w = this.vl(u);
      n = La(n, this.pl(y, w, i));
    }
    return n;
  }
}
function La(s, t) {
  return s === null ? t : t === null ? s : { ml: Math.min(s.ml, t.ml), bl: Math.max(s.bl, t.bl) };
}
class y2 {
  constructor(t) {
    this.wl = t;
  }
  X(t, e, i) {
    this.wl.draw(t);
  }
  gl(t, e, i) {
    var n, l;
    (l = (n = this.wl).drawBackground) === null || l === void 0 || l.call(n, t);
  }
}
class Tc {
  constructor(t) {
    this.tr = null, this.wn = t;
  }
  gt() {
    var t;
    const e = this.wn.renderer();
    if (e === null) return null;
    if (((t = this.tr) === null || t === void 0 ? void 0 : t.Ml) === e) return this.tr.xl;
    const i = new y2(e);
    return this.tr = { Ml: e, xl: i }, i;
  }
  Sl() {
    var t, e, i;
    return (i = (e = (t = this.wn).zOrder) === null || e === void 0 ? void 0 : e.call(t)) !== null && i !== void 0 ? i : "normal";
  }
}
function J0(s) {
  var t, e, i, n, l;
  return { Kt: s.text(), ki: s.coordinate(), Si: (t = s.fixedCoordinate) === null || t === void 0 ? void 0 : t.call(s), V: s.textColor(), t: s.backColor(), yt: (i = (e = s.visible) === null || e === void 0 ? void 0 : e.call(s)) === null || i === void 0 || i, hi: (l = (n = s.tickVisible) === null || n === void 0 ? void 0 : n.call(s)) === null || l === void 0 || l };
}
class _2 {
  constructor(t, e) {
    this.Wt = new P0(), this.kl = t, this.yl = e;
  }
  gt() {
    return this.Wt.J(Object.assign({ Hi: this.yl.Hi() }, J0(this.kl))), this.Wt;
  }
}
class w2 extends Tr {
  constructor(t, e) {
    super(), this.kl = t, this.Li = e;
  }
  zi(t, e, i) {
    const n = J0(this.kl);
    i.t = n.t, t.V = n.V;
    const l = 2 / 12 * this.Li.P();
    i.wi = l, i.gi = l, i.ki = n.ki, i.Si = n.Si, t.Kt = n.Kt, t.yt = n.yt, t.hi = n.hi;
  }
}
class k2 {
  constructor(t, e) {
    this.Cl = null, this.Tl = null, this.Pl = null, this.Rl = null, this.Dl = null, this.Vl = t, this.jr = e;
  }
  Ol() {
    return this.Vl;
  }
  Vn() {
    var t, e;
    (e = (t = this.Vl).updateAllViews) === null || e === void 0 || e.call(t);
  }
  Pn() {
    var t, e, i, n;
    const l = (i = (e = (t = this.Vl).paneViews) === null || e === void 0 ? void 0 : e.call(t)) !== null && i !== void 0 ? i : [];
    if (((n = this.Cl) === null || n === void 0 ? void 0 : n.Ml) === l) return this.Cl.xl;
    const a = l.map((c) => new Tc(c));
    return this.Cl = { Ml: l, xl: a }, a;
  }
  Qi() {
    var t, e, i, n;
    const l = (i = (e = (t = this.Vl).timeAxisViews) === null || e === void 0 ? void 0 : e.call(t)) !== null && i !== void 0 ? i : [];
    if (((n = this.Tl) === null || n === void 0 ? void 0 : n.Ml) === l) return this.Tl.xl;
    const a = this.jr.$t().St(), c = l.map((u) => new _2(u, a));
    return this.Tl = { Ml: l, xl: c }, c;
  }
  Rn() {
    var t, e, i, n;
    const l = (i = (e = (t = this.Vl).priceAxisViews) === null || e === void 0 ? void 0 : e.call(t)) !== null && i !== void 0 ? i : [];
    if (((n = this.Pl) === null || n === void 0 ? void 0 : n.Ml) === l) return this.Pl.xl;
    const a = this.jr.Dt(), c = l.map((u) => new w2(u, a));
    return this.Pl = { Ml: l, xl: c }, c;
  }
  Bl() {
    var t, e, i, n;
    const l = (i = (e = (t = this.Vl).priceAxisPaneViews) === null || e === void 0 ? void 0 : e.call(t)) !== null && i !== void 0 ? i : [];
    if (((n = this.Rl) === null || n === void 0 ? void 0 : n.Ml) === l) return this.Rl.xl;
    const a = l.map((c) => new Tc(c));
    return this.Rl = { Ml: l, xl: a }, a;
  }
  Al() {
    var t, e, i, n;
    const l = (i = (e = (t = this.Vl).timeAxisPaneViews) === null || e === void 0 ? void 0 : e.call(t)) !== null && i !== void 0 ? i : [];
    if (((n = this.Dl) === null || n === void 0 ? void 0 : n.Ml) === l) return this.Dl.xl;
    const a = l.map((c) => new Tc(c));
    return this.Dl = { Ml: l, xl: a }, a;
  }
  Il(t, e) {
    var i, n, l;
    return (l = (n = (i = this.Vl).autoscaleInfo) === null || n === void 0 ? void 0 : n.call(i, t, e)) !== null && l !== void 0 ? l : null;
  }
  wr(t, e) {
    var i, n, l;
    return (l = (n = (i = this.Vl).hitTest) === null || n === void 0 ? void 0 : n.call(i, t, e)) !== null && l !== void 0 ? l : null;
  }
}
function Ec(s, t, e, i) {
  s.forEach((n) => {
    t(n).forEach((l) => {
      l.Sl() === e && i.push(l);
    });
  });
}
function Rc(s) {
  return s.Pn();
}
function S2(s) {
  return s.Bl();
}
function x2(s) {
  return s.Al();
}
class Fu extends p2 {
  constructor(t, e, i, n, l) {
    super(t), this.zt = new b2(), this.jh = new u2(this), this.zl = [], this.Ll = new t2(this), this.El = null, this.Nl = null, this.Fl = [], this.Wl = [], this.jl = null, this.Hl = [], this.cn = e, this.$l = i;
    const a = new h2(this);
    this.rn = [a], this.Hh = new K0(a, this, t), i !== "Area" && i !== "Line" && i !== "Baseline" || (this.El = new i2(this)), this.Ul(), this.ql(l);
  }
  S() {
    this.jl !== null && clearTimeout(this.jl);
  }
  mh(t) {
    return this.cn.priceLineColor || t;
  }
  Zr(t) {
    const e = { Xr: true }, i = this.Dt();
    if (this.$t().St().Ni() || i.Ni() || this.zt.Ni()) return e;
    const n = this.$t().St().Xs(), l = this.Ct();
    if (n === null || l === null) return e;
    let a, c;
    if (t) {
      const m = this.zt.sl();
      if (m === null) return e;
      a = m, c = m.ee;
    } else {
      const m = this.zt.ll(n.ui(), -1);
      if (m === null || (a = this.zt.Gh(m.ee), a === null)) return e;
      c = m.ee;
    }
    const u = a.Vt[3], f = this.Us().$s(c, { Vt: a }), p = i.Rt(u, l.Vt);
    return { Xr: false, _t: u, Kt: i.Fi(u, l.Vt), xh: i.Yl(u), Sh: i.Zl(u, l.Vt), V: f.ce, ki: p, ee: c };
  }
  Us() {
    return this.Nl !== null || (this.Nl = new g2(this)), this.Nl;
  }
  W() {
    return this.cn;
  }
  $h(t) {
    const e = t.priceScaleId;
    e !== void 0 && e !== this.cn.priceScaleId && this.$t().Xl(this, e), ri(this.cn, t), t.priceFormat !== void 0 && (this.Ul(), this.$t().Kl()), this.$t().Gl(this), this.$t().Jl(), this.wn.bt("options");
  }
  J(t, e) {
    this.zt.J(t), this.Ql(), this.wn.bt("data"), this.dn.bt("data"), this.El !== null && (e && e.ta ? this.El.$r() : t.length === 0 && this.El.Hr());
    const i = this.$t().dr(this);
    this.$t().ia(i), this.$t().Gl(this), this.$t().Jl(), this.$t().Uh();
  }
  na(t) {
    this.Fl = t, this.Ql();
    const e = this.$t().dr(this);
    this.dn.bt("data"), this.$t().ia(e), this.$t().Gl(this), this.$t().Jl(), this.$t().Uh();
  }
  sa() {
    return this.Fl;
  }
  dh() {
    return this.Wl;
  }
  ea(t) {
    const e = new v2(this, t);
    return this.zl.push(e), this.$t().Gl(this), e;
  }
  ra(t) {
    const e = this.zl.indexOf(t);
    e !== -1 && this.zl.splice(e, 1), this.$t().Gl(this);
  }
  Qh() {
    return this.$l;
  }
  Ct() {
    const t = this.ha();
    return t === null ? null : { Vt: t.Vt[3], la: t.ot };
  }
  ha() {
    const t = this.$t().St().Xs();
    if (t === null) return null;
    const e = t.Os();
    return this.zt.ll(e, 1);
  }
  In() {
    return this.zt;
  }
  ph(t) {
    const e = this.zt.Gh(t);
    return e === null ? null : this.$l === "Bar" || this.$l === "Candlestick" || this.$l === "Custom" ? { ge: e.Vt[0], Me: e.Vt[1], xe: e.Vt[2], Se: e.Vt[3] } : e.Vt[3];
  }
  aa(t) {
    const e = [];
    Ec(this.Hl, Rc, "top", e);
    const i = this.El;
    return i !== null && i.yt() && (this.jl === null && i.qr() && (this.jl = setTimeout(() => {
      this.jl = null, this.$t().oa();
    }, 0)), i.Ur(), e.unshift(i)), e;
  }
  Pn() {
    const t = [];
    this._a() || t.push(this.Ll), t.push(this.wn, this.jh, this.dn);
    const e = this.zl.map((i) => i.qh());
    return t.push(...e), Ec(this.Hl, Rc, "normal", t), t;
  }
  ua() {
    return this.ca(Rc, "bottom");
  }
  da(t) {
    return this.ca(S2, t);
  }
  fa(t) {
    return this.ca(x2, t);
  }
  va(t, e) {
    return this.Hl.map((i) => i.wr(t, e)).filter((i) => i !== null);
  }
  Ji(t) {
    return [this.Hh, ...this.zl.map((e) => e.Yh())];
  }
  Rn(t, e) {
    if (e !== this.Yi && !this._a()) return [];
    const i = [...this.rn];
    for (const n of this.zl) i.push(n.Zh());
    return this.Hl.forEach((n) => {
      i.push(...n.Rn());
    }), i;
  }
  Qi() {
    const t = [];
    return this.Hl.forEach((e) => {
      t.push(...e.Qi());
    }), t;
  }
  Il(t, e) {
    if (this.cn.autoscaleInfoProvider !== void 0) {
      const i = this.cn.autoscaleInfoProvider(() => {
        const n = this.pa(t, e);
        return n === null ? null : n.Bh();
      });
      return cr.Ah(i);
    }
    return this.pa(t, e);
  }
  ma() {
    return this.cn.priceFormat.minMove;
  }
  ba() {
    return this.wa;
  }
  Vn() {
    var t;
    this.wn.bt(), this.dn.bt();
    for (const e of this.rn) e.bt();
    for (const e of this.zl) e.bt();
    this.jh.bt(), this.Ll.bt(), (t = this.El) === null || t === void 0 || t.bt(), this.Hl.forEach((e) => e.Vn());
  }
  Dt() {
    return ut(super.Dt());
  }
  kt(t) {
    if (!((this.$l === "Line" || this.$l === "Area" || this.$l === "Baseline") && this.cn.crosshairMarkerVisible)) return null;
    const e = this.zt.Gh(t);
    return e === null ? null : { _t: e.Vt[3], ht: this.ga(), Ot: this.Ma(), Pt: this.xa(), Tt: this.Sa(t) };
  }
  bh() {
    return this.cn.title;
  }
  yt() {
    return this.cn.visible;
  }
  ka(t) {
    this.Hl.push(new k2(t, this));
  }
  ya(t) {
    this.Hl = this.Hl.filter((e) => e.Ol() !== t);
  }
  Ca() {
    if (this.wn instanceof $c) return (t) => this.wn.We(t);
  }
  Ta() {
    if (this.wn instanceof $c) return (t) => this.wn.je(t);
  }
  _a() {
    return !Er(this.Dt().Pa());
  }
  pa(t, e) {
    if (!Lo(t) || !Lo(e) || this.zt.Ni()) return null;
    const i = this.$l === "Line" || this.$l === "Area" || this.$l === "Baseline" || this.$l === "Histogram" ? [3] : [2, 1], n = this.zt.ol(t, e, i);
    let l = n !== null ? new Ls(n.ml, n.bl) : null;
    if (this.Qh() === "Histogram") {
      const c = this.cn.base, u = new Ls(c, c);
      l = l !== null ? l.ts(u) : u;
    }
    let a = this.dn.uh();
    return this.Hl.forEach((c) => {
      const u = c.Il(t, e);
      if (u != null && u.priceRange) {
        const w = new Ls(u.priceRange.minValue, u.priceRange.maxValue);
        l = l !== null ? l.ts(w) : w;
      }
      var f, p, m, y;
      u != null && u.margins && (f = a, p = u.margins, a = { above: Math.max((m = f == null ? void 0 : f.above) !== null && m !== void 0 ? m : 0, p.above), below: Math.max((y = f == null ? void 0 : f.below) !== null && y !== void 0 ? y : 0, p.below) });
    }), new cr(l, a);
  }
  ga() {
    switch (this.$l) {
      case "Line":
      case "Area":
      case "Baseline":
        return this.cn.crosshairMarkerRadius;
    }
    return 0;
  }
  Ma() {
    switch (this.$l) {
      case "Line":
      case "Area":
      case "Baseline": {
        const t = this.cn.crosshairMarkerBorderColor;
        if (t.length !== 0) return t;
      }
    }
    return null;
  }
  xa() {
    switch (this.$l) {
      case "Line":
      case "Area":
      case "Baseline":
        return this.cn.crosshairMarkerBorderWidth;
    }
    return 0;
  }
  Sa(t) {
    switch (this.$l) {
      case "Line":
      case "Area":
      case "Baseline": {
        const e = this.cn.crosshairMarkerBackgroundColor;
        if (e.length !== 0) return e;
      }
    }
    return this.Us().$s(t).ce;
  }
  Ul() {
    switch (this.cn.priceFormat.type) {
      case "custom":
        this.wa = { format: this.cn.priceFormat.formatter };
        break;
      case "volume":
        this.wa = new zw(this.cn.priceFormat.precision);
        break;
      case "percent":
        this.wa = new O0(this.cn.priceFormat.precision);
        break;
      default: {
        const t = Math.pow(10, this.cn.priceFormat.precision);
        this.wa = new Rr(t, this.cn.priceFormat.minMove * t);
      }
    }
    this.Yi !== null && this.Yi.Ra();
  }
  Ql() {
    const t = this.$t().St();
    if (!t.Da() || this.zt.Ni()) return void (this.Wl = []);
    const e = ut(this.zt.el());
    this.Wl = this.Fl.map((i, n) => {
      const l = ut(t.Va(i.time, true)), a = l < e ? 1 : -1;
      return { time: ut(this.zt.ll(l, a)).ee, position: i.position, shape: i.shape, color: i.color, id: i.id, th: n, text: i.text, size: i.size, originalTime: i.originalTime };
    });
  }
  ql(t) {
    switch (this.dn = new c2(this, this.$t()), this.$l) {
      case "Bar":
        this.wn = new Vw(this, this.$t());
        break;
      case "Candlestick":
        this.wn = new Kw(this, this.$t());
        break;
      case "Line":
        this.wn = new Gw(this, this.$t());
        break;
      case "Custom":
        this.wn = new $c(this, this.$t(), ws(t));
        break;
      case "Area":
        this.wn = new Iw(this, this.$t());
        break;
      case "Baseline":
        this.wn = new Ww(this, this.$t());
        break;
      case "Histogram":
        this.wn = new Xw(this, this.$t());
        break;
      default:
        throw Error("Unknown chart style assigned: " + this.$l);
    }
  }
  ca(t, e) {
    const i = [];
    return Ec(this.Hl, t, e, i), i;
  }
}
class C2 {
  constructor(t) {
    this.cn = t;
  }
  Oa(t, e, i) {
    let n = t;
    if (this.cn.mode === 0) return n;
    const l = i.vn(), a = l.Ct();
    if (a === null) return n;
    const c = l.Rt(t, a), u = i.Ba().filter((p) => p instanceof Fu).reduce((p, m) => {
      if (i.vr(m) || !m.yt()) return p;
      const y = m.Dt(), w = m.In();
      if (y.Ni() || !w.Kr(e)) return p;
      const S = w.Gh(e);
      if (S === null) return p;
      const C = pl(m.Ct());
      return p.concat([y.Rt(S.Vt[3], C.Vt)]);
    }, []);
    if (u.length === 0) return n;
    u.sort((p, m) => Math.abs(p - c) - Math.abs(m - c));
    const f = u[0];
    return n = l.pn(f, a), n;
  }
}
class M2 extends ci {
  constructor() {
    super(...arguments), this.zt = null;
  }
  J(t) {
    this.zt = t;
  }
  K({ context: t, bitmapSize: e, horizontalPixelRatio: i, verticalPixelRatio: n }) {
    if (this.zt === null) return;
    const l = Math.max(1, Math.floor(i));
    t.lineWidth = l, function(a, c) {
      a.save(), a.lineWidth % 2 && a.translate(0.5, 0.5), c(), a.restore();
    }(t, () => {
      const a = ut(this.zt);
      if (a.Aa) {
        t.strokeStyle = a.Ia, Wn(t, a.za), t.beginPath();
        for (const c of a.La) {
          const u = Math.round(c.Ea * i);
          t.moveTo(u, -l), t.lineTo(u, e.height + l);
        }
        t.stroke();
      }
      if (a.Na) {
        t.strokeStyle = a.Fa, Wn(t, a.Wa), t.beginPath();
        for (const c of a.ja) {
          const u = Math.round(c.Ea * n);
          t.moveTo(-l, u), t.lineTo(e.width + l, u);
        }
        t.stroke();
      }
    });
  }
}
class $2 {
  constructor(t) {
    this.Wt = new M2(), this.ft = true, this.tn = t;
  }
  bt() {
    this.ft = true;
  }
  gt() {
    if (this.ft) {
      const t = this.tn.$t().W().grid, e = { Na: t.horzLines.visible, Aa: t.vertLines.visible, Fa: t.horzLines.color, Ia: t.vertLines.color, Wa: t.horzLines.style, za: t.vertLines.style, ja: this.tn.vn().Ha(), La: (this.tn.$t().St().Ha() || []).map((i) => ({ Ea: i.coord })) };
      this.Wt.J(e), this.ft = false;
    }
    return this.Wt;
  }
}
class T2 {
  constructor(t) {
    this.wn = new $2(t);
  }
  qh() {
    return this.wn;
  }
}
const zc = { $a: 4, Ua: 1e-4 };
function ml(s, t) {
  const e = 100 * (s - t) / t;
  return t < 0 ? -e : e;
}
function E2(s, t) {
  const e = ml(s.Ph(), t), i = ml(s.Rh(), t);
  return new Ls(e, i);
}
function go(s, t) {
  const e = 100 * (s - t) / t + 100;
  return t < 0 ? -e : e;
}
function R2(s, t) {
  const e = go(s.Ph(), t), i = go(s.Rh(), t);
  return new Ls(e, i);
}
function ur(s, t) {
  const e = Math.abs(s);
  if (e < 1e-15) return 0;
  const i = Math.log10(e + t.Ua) + t.$a;
  return s < 0 ? -i : i;
}
function bo(s, t) {
  const e = Math.abs(s);
  if (e < 1e-15) return 0;
  const i = Math.pow(10, e - t.$a) - t.Ua;
  return s < 0 ? -i : i;
}
function no(s, t) {
  if (s === null) return null;
  const e = ur(s.Ph(), t), i = ur(s.Rh(), t);
  return new Ls(e, i);
}
function Da(s, t) {
  if (s === null) return null;
  const e = bo(s.Ph(), t), i = bo(s.Rh(), t);
  return new Ls(e, i);
}
function Lc(s) {
  if (s === null) return zc;
  const t = Math.abs(s.Rh() - s.Ph());
  if (t >= 1 || t < 1e-15) return zc;
  const e = Math.ceil(Math.abs(Math.log10(t))), i = zc.$a + e;
  return { $a: i, Ua: 1 / Math.pow(10, i) };
}
class Dc {
  constructor(t, e) {
    if (this.qa = t, this.Ya = e, function(i) {
      if (i < 0) return false;
      for (let n = i; n > 1; n /= 10) if (n % 10 != 0) return false;
      return true;
    }(this.qa)) this.Za = [2, 2.5, 2];
    else {
      this.Za = [];
      for (let i = this.qa; i !== 1; ) {
        if (i % 2 == 0) this.Za.push(2), i /= 2;
        else {
          if (i % 5 != 0) throw new Error("unexpected base");
          this.Za.push(2, 2.5), i /= 5;
        }
        if (this.Za.length > 100) throw new Error("something wrong with base");
      }
    }
  }
  Xa(t, e, i) {
    const n = this.qa === 0 ? 0 : 1 / this.qa;
    let l = Math.pow(10, Math.max(0, Math.ceil(Math.log10(t - e)))), a = 0, c = this.Ya[0];
    for (; ; ) {
      const m = za(l, n, 1e-14) && l > n + 1e-14, y = za(l, i * c, 1e-14), w = za(l, 1, 1e-14);
      if (!(m && y && w)) break;
      l /= c, c = this.Ya[++a % this.Ya.length];
    }
    if (l <= n + 1e-14 && (l = n), l = Math.max(1, l), this.Za.length > 0 && (u = l, f = 1, p = 1e-14, Math.abs(u - f) < p)) for (a = 0, c = this.Za[0]; za(l, i * c, 1e-14) && l > n + 1e-14; ) l /= c, c = this.Za[++a % this.Za.length];
    var u, f, p;
    return l;
  }
}
class Cv {
  constructor(t, e, i, n) {
    this.Ka = [], this.Li = t, this.qa = e, this.Ga = i, this.Ja = n;
  }
  Xa(t, e) {
    if (t < e) throw new Error("high < low");
    const i = this.Li.At(), n = (t - e) * this.Qa() / i, l = new Dc(this.qa, [2, 2.5, 2]), a = new Dc(this.qa, [2, 2, 2.5]), c = new Dc(this.qa, [2.5, 2, 2]), u = [];
    return u.push(l.Xa(t, e, n), a.Xa(t, e, n), c.Xa(t, e, n)), function(f) {
      if (f.length < 1) throw Error("array is empty");
      let p = f[0];
      for (let m = 1; m < f.length; ++m) f[m] < p && (p = f[m]);
      return p;
    }(u);
  }
  io() {
    const t = this.Li, e = t.Ct();
    if (e === null) return void (this.Ka = []);
    const i = t.At(), n = this.Ga(i - 1, e), l = this.Ga(0, e), a = this.Li.W().entireTextOnly ? this.no() / 2 : 0, c = a, u = i - 1 - a, f = Math.max(n, l), p = Math.min(n, l);
    if (f === p) return void (this.Ka = []);
    let m = this.Xa(f, p), y = f % m;
    y += y < 0 ? m : 0;
    const w = f >= p ? 1 : -1;
    let S = null, C = 0;
    for (let O = f - y; O > p; O -= m) {
      const R = this.Ja(O, e, true);
      S !== null && Math.abs(R - S) < this.Qa() || R < c || R > u || (C < this.Ka.length ? (this.Ka[C].Ea = R, this.Ka[C].so = t.eo(O)) : this.Ka.push({ Ea: R, so: t.eo(O) }), C++, S = R, t.ro() && (m = this.Xa(O * w, p)));
    }
    this.Ka.length = C;
  }
  Ha() {
    return this.Ka;
  }
  no() {
    return this.Li.P();
  }
  Qa() {
    return Math.ceil(2.5 * this.no());
  }
}
function X0(s) {
  return s.slice().sort((t, e) => ut(t.Xi()) - ut(e.Xi()));
}
var Mv;
(function(s) {
  s[s.Normal = 0] = "Normal", s[s.Logarithmic = 1] = "Logarithmic", s[s.Percentage = 2] = "Percentage", s[s.IndexedTo100 = 3] = "IndexedTo100";
})(Mv || (Mv = {}));
const $v = new O0(), Tv = new Rr(100, 1);
class z2 {
  constructor(t, e, i, n) {
    this.ho = 0, this.lo = null, this.Ih = null, this.ao = null, this.oo = { _o: false, uo: null }, this.co = 0, this.do = 0, this.fo = new Be(), this.vo = new Be(), this.po = [], this.mo = null, this.bo = null, this.wo = null, this.Mo = null, this.wa = Tv, this.xo = Lc(null), this.So = t, this.cn = e, this.ko = i, this.yo = n, this.Co = new Cv(this, 100, this.To.bind(this), this.Po.bind(this));
  }
  Pa() {
    return this.So;
  }
  W() {
    return this.cn;
  }
  $h(t) {
    if (ri(this.cn, t), this.Ra(), t.mode !== void 0 && this.Ro({ Cr: t.mode }), t.scaleMargins !== void 0) {
      const e = ws(t.scaleMargins.top), i = ws(t.scaleMargins.bottom);
      if (e < 0 || e > 1) throw new Error(`Invalid top margin - expect value between 0 and 1, given=${e}`);
      if (i < 0 || i > 1) throw new Error(`Invalid bottom margin - expect value between 0 and 1, given=${i}`);
      if (e + i > 1) throw new Error(`Invalid margins - sum of margins must be less than 1, given=${e + i}`);
      this.Do(), this.bo = null;
    }
  }
  Vo() {
    return this.cn.autoScale;
  }
  ro() {
    return this.cn.mode === 1;
  }
  Mh() {
    return this.cn.mode === 2;
  }
  Oo() {
    return this.cn.mode === 3;
  }
  Cr() {
    return { Wn: this.cn.autoScale, Bo: this.cn.invertScale, Cr: this.cn.mode };
  }
  Ro(t) {
    const e = this.Cr();
    let i = null;
    t.Wn !== void 0 && (this.cn.autoScale = t.Wn), t.Cr !== void 0 && (this.cn.mode = t.Cr, t.Cr !== 2 && t.Cr !== 3 || (this.cn.autoScale = true), this.oo._o = false), e.Cr === 1 && t.Cr !== e.Cr && (function(l, a) {
      if (l === null) return false;
      const c = bo(l.Ph(), a), u = bo(l.Rh(), a);
      return isFinite(c) && isFinite(u);
    }(this.Ih, this.xo) ? (i = Da(this.Ih, this.xo), i !== null && this.Ao(i)) : this.cn.autoScale = true), t.Cr === 1 && t.Cr !== e.Cr && (i = no(this.Ih, this.xo), i !== null && this.Ao(i));
    const n = e.Cr !== this.cn.mode;
    n && (e.Cr === 2 || this.Mh()) && this.Ra(), n && (e.Cr === 3 || this.Oo()) && this.Ra(), t.Bo !== void 0 && e.Bo !== t.Bo && (this.cn.invertScale = t.Bo, this.Io()), this.vo.m(e, this.Cr());
  }
  zo() {
    return this.vo;
  }
  P() {
    return this.ko.fontSize;
  }
  At() {
    return this.ho;
  }
  Lo(t) {
    this.ho !== t && (this.ho = t, this.Do(), this.bo = null);
  }
  Eo() {
    if (this.lo) return this.lo;
    const t = this.At() - this.No() - this.Fo();
    return this.lo = t, t;
  }
  Lh() {
    return this.Wo(), this.Ih;
  }
  Ao(t, e) {
    const i = this.Ih;
    (e || i === null && t !== null || i !== null && !i.Ch(t)) && (this.bo = null, this.Ih = t);
  }
  Ni() {
    return this.Wo(), this.ho === 0 || !this.Ih || this.Ih.Ni();
  }
  jo(t) {
    return this.Bo() ? t : this.At() - 1 - t;
  }
  Rt(t, e) {
    return this.Mh() ? t = ml(t, e) : this.Oo() && (t = go(t, e)), this.Po(t, e);
  }
  te(t, e, i) {
    this.Wo();
    const n = this.Fo(), l = ut(this.Lh()), a = l.Ph(), c = l.Rh(), u = this.Eo() - 1, f = this.Bo(), p = u / (c - a), m = i === void 0 ? 0 : i.from, y = i === void 0 ? t.length : i.to, w = this.Ho();
    for (let S = m; S < y; S++) {
      const C = t[S], O = C._t;
      if (isNaN(O)) continue;
      let R = O;
      w !== null && (R = w(C._t, e));
      const D = n + p * (R - a), N = f ? D : this.ho - 1 - D;
      C.st = N;
    }
  }
  be(t, e, i) {
    this.Wo();
    const n = this.Fo(), l = ut(this.Lh()), a = l.Ph(), c = l.Rh(), u = this.Eo() - 1, f = this.Bo(), p = u / (c - a), m = i === void 0 ? 0 : i.from, y = i === void 0 ? t.length : i.to, w = this.Ho();
    for (let S = m; S < y; S++) {
      const C = t[S];
      let O = C.ge, R = C.Me, D = C.xe, N = C.Se;
      w !== null && (O = w(C.ge, e), R = w(C.Me, e), D = w(C.xe, e), N = w(C.Se, e));
      let $ = n + p * (O - a), I = f ? $ : this.ho - 1 - $;
      C.pe = I, $ = n + p * (R - a), I = f ? $ : this.ho - 1 - $, C.de = I, $ = n + p * (D - a), I = f ? $ : this.ho - 1 - $, C.fe = I, $ = n + p * (N - a), I = f ? $ : this.ho - 1 - $, C.me = I;
    }
  }
  pn(t, e) {
    const i = this.To(t, e);
    return this.$o(i, e);
  }
  $o(t, e) {
    let i = t;
    return this.Mh() ? i = function(n, l) {
      return l < 0 && (n = -n), n / 100 * l + l;
    }(i, e) : this.Oo() && (i = function(n, l) {
      return n -= 100, l < 0 && (n = -n), n / 100 * l + l;
    }(i, e)), i;
  }
  Ba() {
    return this.po;
  }
  Uo() {
    if (this.mo) return this.mo;
    let t = [];
    for (let e = 0; e < this.po.length; e++) {
      const i = this.po[e];
      i.Xi() === null && i.Ki(e + 1), t.push(i);
    }
    return t = X0(t), this.mo = t, this.mo;
  }
  qo(t) {
    this.po.indexOf(t) === -1 && (this.po.push(t), this.Ra(), this.Yo());
  }
  Zo(t) {
    const e = this.po.indexOf(t);
    if (e === -1) throw new Error("source is not attached to scale");
    this.po.splice(e, 1), this.po.length === 0 && (this.Ro({ Wn: true }), this.Ao(null)), this.Ra(), this.Yo();
  }
  Ct() {
    let t = null;
    for (const e of this.po) {
      const i = e.Ct();
      i !== null && (t === null || i.la < t.la) && (t = i);
    }
    return t === null ? null : t.Vt;
  }
  Bo() {
    return this.cn.invertScale;
  }
  Ha() {
    const t = this.Ct() === null;
    if (this.bo !== null && (t || this.bo.Xo === t)) return this.bo.Ha;
    this.Co.io();
    const e = this.Co.Ha();
    return this.bo = { Ha: e, Xo: t }, this.fo.m(), e;
  }
  Ko() {
    return this.fo;
  }
  Go(t) {
    this.Mh() || this.Oo() || this.wo === null && this.ao === null && (this.Ni() || (this.wo = this.ho - t, this.ao = ut(this.Lh()).Th()));
  }
  Jo(t) {
    if (this.Mh() || this.Oo() || this.wo === null) return;
    this.Ro({ Wn: false }), (t = this.ho - t) < 0 && (t = 0);
    let e = (this.wo + 0.2 * (this.ho - 1)) / (t + 0.2 * (this.ho - 1));
    const i = ut(this.ao).Th();
    e = Math.max(e, 0.1), i.Vh(e), this.Ao(i);
  }
  Qo() {
    this.Mh() || this.Oo() || (this.wo = null, this.ao = null);
  }
  t_(t) {
    this.Vo() || this.Mo === null && this.ao === null && (this.Ni() || (this.Mo = t, this.ao = ut(this.Lh()).Th()));
  }
  i_(t) {
    if (this.Vo() || this.Mo === null) return;
    const e = ut(this.Lh()).Dh() / (this.Eo() - 1);
    let i = t - this.Mo;
    this.Bo() && (i *= -1);
    const n = i * e, l = ut(this.ao).Th();
    l.Oh(n), this.Ao(l, true), this.bo = null;
  }
  n_() {
    this.Vo() || this.Mo !== null && (this.Mo = null, this.ao = null);
  }
  ba() {
    return this.wa || this.Ra(), this.wa;
  }
  Fi(t, e) {
    switch (this.cn.mode) {
      case 2:
        return this.s_(ml(t, e));
      case 3:
        return this.ba().format(go(t, e));
      default:
        return this.Wh(t);
    }
  }
  eo(t) {
    switch (this.cn.mode) {
      case 2:
        return this.s_(t);
      case 3:
        return this.ba().format(t);
      default:
        return this.Wh(t);
    }
  }
  Yl(t) {
    return this.Wh(t, ut(this.e_()).ba());
  }
  Zl(t, e) {
    return t = ml(t, e), this.s_(t, $v);
  }
  r_() {
    return this.po;
  }
  h_(t) {
    this.oo = { uo: t, _o: false };
  }
  Vn() {
    this.po.forEach((t) => t.Vn());
  }
  Ra() {
    this.bo = null;
    const t = this.e_();
    let e = 100;
    t !== null && (e = Math.round(1 / t.ma())), this.wa = Tv, this.Mh() ? (this.wa = $v, e = 100) : this.Oo() ? (this.wa = new Rr(100, 1), e = 100) : t !== null && (this.wa = t.ba()), this.Co = new Cv(this, e, this.To.bind(this), this.Po.bind(this)), this.Co.io();
  }
  Yo() {
    this.mo = null;
  }
  e_() {
    return this.po[0] || null;
  }
  No() {
    return this.Bo() ? this.cn.scaleMargins.bottom * this.At() + this.do : this.cn.scaleMargins.top * this.At() + this.co;
  }
  Fo() {
    return this.Bo() ? this.cn.scaleMargins.top * this.At() + this.co : this.cn.scaleMargins.bottom * this.At() + this.do;
  }
  Wo() {
    this.oo._o || (this.oo._o = true, this.l_());
  }
  Do() {
    this.lo = null;
  }
  Po(t, e) {
    if (this.Wo(), this.Ni()) return 0;
    t = this.ro() && t ? ur(t, this.xo) : t;
    const i = ut(this.Lh()), n = this.Fo() + (this.Eo() - 1) * (t - i.Ph()) / i.Dh();
    return this.jo(n);
  }
  To(t, e) {
    if (this.Wo(), this.Ni()) return 0;
    const i = this.jo(t), n = ut(this.Lh()), l = n.Ph() + n.Dh() * ((i - this.Fo()) / (this.Eo() - 1));
    return this.ro() ? bo(l, this.xo) : l;
  }
  Io() {
    this.bo = null, this.Co.io();
  }
  l_() {
    const t = this.oo.uo;
    if (t === null) return;
    let e = null;
    const i = this.r_();
    let n = 0, l = 0;
    for (const u of i) {
      if (!u.yt()) continue;
      const f = u.Ct();
      if (f === null) continue;
      const p = u.Il(t.Os(), t.ui());
      let m = p && p.Lh();
      if (m !== null) {
        switch (this.cn.mode) {
          case 1:
            m = no(m, this.xo);
            break;
          case 2:
            m = E2(m, f.Vt);
            break;
          case 3:
            m = R2(m, f.Vt);
        }
        if (e = e === null ? m : e.ts(ut(m)), p !== null) {
          const y = p.Eh();
          y !== null && (n = Math.max(n, y.above), l = Math.max(l, y.below));
        }
      }
    }
    if (n === this.co && l === this.do || (this.co = n, this.do = l, this.bo = null, this.Do()), e !== null) {
      if (e.Ph() === e.Rh()) {
        const u = this.e_(), f = 5 * (u === null || this.Mh() || this.Oo() ? 1 : u.ma());
        this.ro() && (e = Da(e, this.xo)), e = new Ls(e.Ph() - f, e.Rh() + f), this.ro() && (e = no(e, this.xo));
      }
      if (this.ro()) {
        const u = Da(e, this.xo), f = Lc(u);
        if (a = f, c = this.xo, a.$a !== c.$a || a.Ua !== c.Ua) {
          const p = this.ao !== null ? Da(this.ao, this.xo) : null;
          this.xo = f, e = no(u, f), p !== null && (this.ao = no(p, f));
        }
      }
      this.Ao(e);
    } else this.Ih === null && (this.Ao(new Ls(-0.5, 0.5)), this.xo = Lc(null));
    var a, c;
    this.oo._o = true;
  }
  Ho() {
    return this.Mh() ? ml : this.Oo() ? go : this.ro() ? (t) => ur(t, this.xo) : null;
  }
  a_(t, e, i) {
    return e === void 0 ? (i === void 0 && (i = this.ba()), i.format(t)) : e(t);
  }
  Wh(t, e) {
    return this.a_(t, this.yo.priceFormatter, e);
  }
  s_(t, e) {
    return this.a_(t, this.yo.percentageFormatter, e);
  }
}
class L2 {
  constructor(t, e) {
    this.po = [], this.o_ = /* @__PURE__ */ new Map(), this.ho = 0, this.__ = 0, this.u_ = 1e3, this.mo = null, this.c_ = new Be(), this.yl = t, this.$i = e, this.d_ = new T2(this);
    const i = e.W();
    this.f_ = this.v_("left", i.leftPriceScale), this.p_ = this.v_("right", i.rightPriceScale), this.f_.zo().l(this.m_.bind(this, this.f_), this), this.p_.zo().l(this.m_.bind(this, this.p_), this), this.b_(i);
  }
  b_(t) {
    if (t.leftPriceScale && this.f_.$h(t.leftPriceScale), t.rightPriceScale && this.p_.$h(t.rightPriceScale), t.localization && (this.f_.Ra(), this.p_.Ra()), t.overlayPriceScales) {
      const e = Array.from(this.o_.values());
      for (const i of e) {
        const n = ut(i[0].Dt());
        n.$h(t.overlayPriceScales), t.localization && n.Ra();
      }
    }
  }
  w_(t) {
    switch (t) {
      case "left":
        return this.f_;
      case "right":
        return this.p_;
    }
    return this.o_.has(t) ? ws(this.o_.get(t))[0].Dt() : null;
  }
  S() {
    this.$t().g_().p(this), this.f_.zo().p(this), this.p_.zo().p(this), this.po.forEach((t) => {
      t.S && t.S();
    }), this.c_.m();
  }
  M_() {
    return this.u_;
  }
  x_(t) {
    this.u_ = t;
  }
  $t() {
    return this.$i;
  }
  Hi() {
    return this.__;
  }
  At() {
    return this.ho;
  }
  S_(t) {
    this.__ = t, this.k_();
  }
  Lo(t) {
    this.ho = t, this.f_.Lo(t), this.p_.Lo(t), this.po.forEach((e) => {
      if (this.vr(e)) {
        const i = e.Dt();
        i !== null && i.Lo(t);
      }
    }), this.k_();
  }
  Ba() {
    return this.po;
  }
  vr(t) {
    const e = t.Dt();
    return e === null || this.f_ !== e && this.p_ !== e;
  }
  qo(t, e, i) {
    const n = i !== void 0 ? i : this.C_().y_ + 1;
    this.T_(t, e, n);
  }
  Zo(t) {
    const e = this.po.indexOf(t);
    hn(e !== -1, "removeDataSource: invalid data source"), this.po.splice(e, 1);
    const i = ut(t.Dt()).Pa();
    if (this.o_.has(i)) {
      const l = ws(this.o_.get(i)), a = l.indexOf(t);
      a !== -1 && (l.splice(a, 1), l.length === 0 && this.o_.delete(i));
    }
    const n = t.Dt();
    n && n.Ba().indexOf(t) >= 0 && n.Zo(t), n !== null && (n.Yo(), this.P_(n)), this.mo = null;
  }
  mr(t) {
    return t === this.f_ ? "left" : t === this.p_ ? "right" : "overlay";
  }
  R_() {
    return this.f_;
  }
  D_() {
    return this.p_;
  }
  V_(t, e) {
    t.Go(e);
  }
  O_(t, e) {
    t.Jo(e), this.k_();
  }
  B_(t) {
    t.Qo();
  }
  A_(t, e) {
    t.t_(e);
  }
  I_(t, e) {
    t.i_(e), this.k_();
  }
  z_(t) {
    t.n_();
  }
  k_() {
    this.po.forEach((t) => {
      t.Vn();
    });
  }
  vn() {
    let t = null;
    return this.$i.W().rightPriceScale.visible && this.p_.Ba().length !== 0 ? t = this.p_ : this.$i.W().leftPriceScale.visible && this.f_.Ba().length !== 0 ? t = this.f_ : this.po.length !== 0 && (t = this.po[0].Dt()), t === null && (t = this.p_), t;
  }
  pr() {
    let t = null;
    return this.$i.W().rightPriceScale.visible ? t = this.p_ : this.$i.W().leftPriceScale.visible && (t = this.f_), t;
  }
  P_(t) {
    t !== null && t.Vo() && this.L_(t);
  }
  E_(t) {
    const e = this.yl.Xs();
    t.Ro({ Wn: true }), e !== null && t.h_(e), this.k_();
  }
  N_() {
    this.L_(this.f_), this.L_(this.p_);
  }
  F_() {
    this.P_(this.f_), this.P_(this.p_), this.po.forEach((t) => {
      this.vr(t) && this.P_(t.Dt());
    }), this.k_(), this.$i.Uh();
  }
  Uo() {
    return this.mo === null && (this.mo = X0(this.po)), this.mo;
  }
  W_() {
    return this.c_;
  }
  j_() {
    return this.d_;
  }
  L_(t) {
    const e = t.r_();
    if (e && e.length > 0 && !this.yl.Ni()) {
      const i = this.yl.Xs();
      i !== null && t.h_(i);
    }
    t.Vn();
  }
  C_() {
    const t = this.Uo();
    if (t.length === 0) return { H_: 0, y_: 0 };
    let e = 0, i = 0;
    for (let n = 0; n < t.length; n++) {
      const l = t[n].Xi();
      l !== null && (l < e && (e = l), l > i && (i = l));
    }
    return { H_: e, y_: i };
  }
  T_(t, e, i) {
    let n = this.w_(e);
    if (n === null && (n = this.v_(e, this.$i.W().overlayPriceScales)), this.po.push(t), !Er(e)) {
      const l = this.o_.get(e) || [];
      l.push(t), this.o_.set(e, l);
    }
    n.qo(t), t.Gi(n), t.Ki(i), this.P_(n), this.mo = null;
  }
  m_(t, e, i) {
    e.Cr !== i.Cr && this.L_(t);
  }
  v_(t, e) {
    const i = Object.assign({ visible: true, autoScale: true }, Fi(e)), n = new z2(t, i, this.$i.W().layout, this.$i.W().localization);
    return n.Lo(this.At()), n;
  }
}
class D2 {
  constructor(t, e, i = 50) {
    this.Ke = 0, this.Ge = 1, this.Je = 1, this.tr = /* @__PURE__ */ new Map(), this.Qe = /* @__PURE__ */ new Map(), this.U_ = t, this.q_ = e, this.ir = i;
  }
  Y_(t) {
    const e = t.time, i = this.q_.cacheKey(e), n = this.tr.get(i);
    if (n !== void 0) return n.Z_;
    if (this.Ke === this.ir) {
      const a = this.Qe.get(this.Je);
      this.Qe.delete(this.Je), this.tr.delete(ws(a)), this.Je++, this.Ke--;
    }
    const l = this.U_(t);
    return this.tr.set(i, { Z_: l, rr: this.Ge }), this.Qe.set(this.Ge, i), this.Ke++, this.Ge++, l;
  }
}
class yo {
  constructor(t, e) {
    hn(t <= e, "right should be >= left"), this.X_ = t, this.K_ = e;
  }
  Os() {
    return this.X_;
  }
  ui() {
    return this.K_;
  }
  G_() {
    return this.K_ - this.X_ + 1;
  }
  Kr(t) {
    return this.X_ <= t && t <= this.K_;
  }
  Ch(t) {
    return this.X_ === t.Os() && this.K_ === t.ui();
  }
}
function Ev(s, t) {
  return s === null || t === null ? s === t : s.Ch(t);
}
class P2 {
  constructor() {
    this.J_ = /* @__PURE__ */ new Map(), this.tr = null, this.Q_ = false;
  }
  tu(t) {
    this.Q_ = t, this.tr = null;
  }
  iu(t, e) {
    this.nu(e), this.tr = null;
    for (let i = e; i < t.length; ++i) {
      const n = t[i];
      let l = this.J_.get(n.timeWeight);
      l === void 0 && (l = [], this.J_.set(n.timeWeight, l)), l.push({ index: i, time: n.time, weight: n.timeWeight, originalTime: n.originalTime });
    }
  }
  su(t, e) {
    const i = Math.ceil(e / t);
    return this.tr !== null && this.tr.eu === i || (this.tr = { Ha: this.ru(i), eu: i }), this.tr.Ha;
  }
  nu(t) {
    if (t === 0) return void this.J_.clear();
    const e = [];
    this.J_.forEach((i, n) => {
      t <= i[0].index ? e.push(n) : i.splice(Bo(i, t, (l) => l.index < t), 1 / 0);
    });
    for (const i of e) this.J_.delete(i);
  }
  ru(t) {
    let e = [];
    for (const i of Array.from(this.J_.keys()).sort((n, l) => l - n)) {
      if (!this.J_.get(i)) continue;
      const n = e;
      e = [];
      const l = n.length;
      let a = 0;
      const c = ws(this.J_.get(i)), u = c.length;
      let f = 1 / 0, p = -1 / 0;
      for (let m = 0; m < u; m++) {
        const y = c[m], w = y.index;
        for (; a < l; ) {
          const S = n[a], C = S.index;
          if (!(C < w)) {
            f = C;
            break;
          }
          a++, e.push(S), p = C, f = 1 / 0;
        }
        if (f - w >= t && w - p >= t) e.push(y), p = w;
        else if (this.Q_) return n;
      }
      for (; a < l; a++) e.push(n[a]);
    }
    return e;
  }
}
class wl {
  constructor(t) {
    this.hu = t;
  }
  lu() {
    return this.hu === null ? null : new yo(Math.floor(this.hu.Os()), Math.ceil(this.hu.ui()));
  }
  au() {
    return this.hu;
  }
  static ou() {
    return new wl(null);
  }
}
function O2(s, t) {
  return s.weight > t.weight ? s : t;
}
class A2 {
  constructor(t, e, i, n) {
    this.__ = 0, this._u = null, this.uu = [], this.Mo = null, this.wo = null, this.cu = new P2(), this.du = /* @__PURE__ */ new Map(), this.fu = wl.ou(), this.vu = true, this.pu = new Be(), this.mu = new Be(), this.bu = new Be(), this.wu = null, this.gu = null, this.Mu = [], this.cn = e, this.yo = i, this.xu = e.rightOffset, this.Su = e.barSpacing, this.$i = t, this.q_ = n, this.ku(), this.cu.tu(e.uniformDistribution);
  }
  W() {
    return this.cn;
  }
  yu(t) {
    ri(this.yo, t), this.Cu(), this.ku();
  }
  $h(t, e) {
    var i;
    ri(this.cn, t), this.cn.fixLeftEdge && this.Tu(), this.cn.fixRightEdge && this.Pu(), t.barSpacing !== void 0 && this.$i.Gn(t.barSpacing), t.rightOffset !== void 0 && this.$i.Jn(t.rightOffset), t.minBarSpacing !== void 0 && this.$i.Gn((i = t.barSpacing) !== null && i !== void 0 ? i : this.Su), this.Cu(), this.ku(), this.bu.m();
  }
  mn(t) {
    var e, i;
    return (i = (e = this.uu[t]) === null || e === void 0 ? void 0 : e.time) !== null && i !== void 0 ? i : null;
  }
  Ui(t) {
    var e;
    return (e = this.uu[t]) !== null && e !== void 0 ? e : null;
  }
  Va(t, e) {
    if (this.uu.length < 1) return null;
    if (this.q_.key(t) > this.q_.key(this.uu[this.uu.length - 1].time)) return e ? this.uu.length - 1 : null;
    const i = Bo(this.uu, this.q_.key(t), (n, l) => this.q_.key(n.time) < l);
    return this.q_.key(t) < this.q_.key(this.uu[i].time) ? e ? i : null : i;
  }
  Ni() {
    return this.__ === 0 || this.uu.length === 0 || this._u === null;
  }
  Da() {
    return this.uu.length > 0;
  }
  Xs() {
    return this.Ru(), this.fu.lu();
  }
  Du() {
    return this.Ru(), this.fu.au();
  }
  Vu() {
    const t = this.Xs();
    if (t === null) return null;
    const e = { from: t.Os(), to: t.ui() };
    return this.Ou(e);
  }
  Ou(t) {
    const e = Math.round(t.from), i = Math.round(t.to), n = ut(this.Bu()), l = ut(this.Au());
    return { from: ut(this.Ui(Math.max(n, e))), to: ut(this.Ui(Math.min(l, i))) };
  }
  Iu(t) {
    return { from: ut(this.Va(t.from, true)), to: ut(this.Va(t.to, true)) };
  }
  Hi() {
    return this.__;
  }
  S_(t) {
    if (!isFinite(t) || t <= 0 || this.__ === t) return;
    const e = this.Du(), i = this.__;
    if (this.__ = t, this.vu = true, this.cn.lockVisibleTimeRangeOnResize && i !== 0) {
      const n = this.Su * t / i;
      this.Su = n;
    }
    if (this.cn.fixLeftEdge && e !== null && e.Os() <= 0) {
      const n = i - t;
      this.xu -= Math.round(n / this.Su) + 1, this.vu = true;
    }
    this.zu(), this.Lu();
  }
  It(t) {
    if (this.Ni() || !Lo(t)) return 0;
    const e = this.Eu() + this.xu - t;
    return this.__ - (e + 0.5) * this.Su - 1;
  }
  Qs(t, e) {
    const i = this.Eu(), n = e === void 0 ? 0 : e.from, l = e === void 0 ? t.length : e.to;
    for (let a = n; a < l; a++) {
      const c = t[a].ot, u = i + this.xu - c, f = this.__ - (u + 0.5) * this.Su - 1;
      t[a].nt = f;
    }
  }
  Nu(t) {
    return Math.ceil(this.Fu(t));
  }
  Jn(t) {
    this.vu = true, this.xu = t, this.Lu(), this.$i.Wu(), this.$i.Uh();
  }
  le() {
    return this.Su;
  }
  Gn(t) {
    this.ju(t), this.Lu(), this.$i.Wu(), this.$i.Uh();
  }
  Hu() {
    return this.xu;
  }
  Ha() {
    if (this.Ni()) return null;
    if (this.gu !== null) return this.gu;
    const t = this.Su, e = 5 * (this.$i.W().layout.fontSize + 4) / 8 * (this.cn.tickMarkMaxCharacterLength || 8), i = Math.round(e / t), n = ut(this.Xs()), l = Math.max(n.Os(), n.Os() - i), a = Math.max(n.ui(), n.ui() - i), c = this.cu.su(t, e), u = this.Bu() + i, f = this.Au() - i, p = this.$u(), m = this.cn.fixLeftEdge || p, y = this.cn.fixRightEdge || p;
    let w = 0;
    for (const S of c) {
      if (!(l <= S.index && S.index <= a)) continue;
      let C;
      w < this.Mu.length ? (C = this.Mu[w], C.coord = this.It(S.index), C.label = this.Uu(S), C.weight = S.weight) : (C = { needAlignCoordinate: false, coord: this.It(S.index), label: this.Uu(S), weight: S.weight }, this.Mu.push(C)), this.Su > e / 2 && !p ? C.needAlignCoordinate = false : C.needAlignCoordinate = m && S.index <= u || y && S.index >= f, w++;
    }
    return this.Mu.length = w, this.gu = this.Mu, this.Mu;
  }
  qu() {
    this.vu = true, this.Gn(this.cn.barSpacing), this.Jn(this.cn.rightOffset);
  }
  Yu(t) {
    this.vu = true, this._u = t, this.Lu(), this.Tu();
  }
  Zu(t, e) {
    const i = this.Fu(t), n = this.le(), l = n + e * (n / 10);
    this.Gn(l), this.cn.rightBarStaysOnScroll || this.Jn(this.Hu() + (i - this.Fu(t)));
  }
  Go(t) {
    this.Mo && this.n_(), this.wo === null && this.wu === null && (this.Ni() || (this.wo = t, this.Xu()));
  }
  Jo(t) {
    if (this.wu === null) return;
    const e = uu(this.__ - t, 0, this.__), i = uu(this.__ - ut(this.wo), 0, this.__);
    e !== 0 && i !== 0 && this.Gn(this.wu.le * e / i);
  }
  Qo() {
    this.wo !== null && (this.wo = null, this.Ku());
  }
  t_(t) {
    this.Mo === null && this.wu === null && (this.Ni() || (this.Mo = t, this.Xu()));
  }
  i_(t) {
    if (this.Mo === null) return;
    const e = (this.Mo - t) / this.le();
    this.xu = ut(this.wu).Hu + e, this.vu = true, this.Lu();
  }
  n_() {
    this.Mo !== null && (this.Mo = null, this.Ku());
  }
  Gu() {
    this.Ju(this.cn.rightOffset);
  }
  Ju(t, e = 400) {
    if (!isFinite(t)) throw new RangeError("offset is required and must be finite number");
    if (!isFinite(e) || e <= 0) throw new RangeError("animationDuration (optional) must be finite positive number");
    const i = this.xu, n = performance.now();
    this.$i.Zn({ Qu: (l) => (l - n) / e >= 1, tc: (l) => {
      const a = (l - n) / e;
      return a >= 1 ? t : i + (t - i) * a;
    } });
  }
  bt(t, e) {
    this.vu = true, this.uu = t, this.cu.iu(t, e), this.Lu();
  }
  nc() {
    return this.pu;
  }
  sc() {
    return this.mu;
  }
  ec() {
    return this.bu;
  }
  Eu() {
    return this._u || 0;
  }
  rc(t) {
    const e = t.G_();
    this.ju(this.__ / e), this.xu = t.ui() - this.Eu(), this.Lu(), this.vu = true, this.$i.Wu(), this.$i.Uh();
  }
  hc() {
    const t = this.Bu(), e = this.Au();
    t !== null && e !== null && this.rc(new yo(t, e + this.cn.rightOffset));
  }
  lc(t) {
    const e = new yo(t.from, t.to);
    this.rc(e);
  }
  qi(t) {
    return this.yo.timeFormatter !== void 0 ? this.yo.timeFormatter(t.originalTime) : this.q_.formatHorzItem(t.time);
  }
  $u() {
    const { handleScroll: t, handleScale: e } = this.$i.W();
    return !(t.horzTouchDrag || t.mouseWheel || t.pressedMouseMove || t.vertTouchDrag || e.axisDoubleClickReset.time || e.axisPressedMouseMove.time || e.mouseWheel || e.pinch);
  }
  Bu() {
    return this.uu.length === 0 ? null : 0;
  }
  Au() {
    return this.uu.length === 0 ? null : this.uu.length - 1;
  }
  ac(t) {
    return (this.__ - 1 - t) / this.Su;
  }
  Fu(t) {
    const e = this.ac(t), i = this.Eu() + this.xu - e;
    return Math.round(1e6 * i) / 1e6;
  }
  ju(t) {
    const e = this.Su;
    this.Su = t, this.zu(), e !== this.Su && (this.vu = true, this.oc());
  }
  Ru() {
    if (!this.vu) return;
    if (this.vu = false, this.Ni()) return void this._c(wl.ou());
    const t = this.Eu(), e = this.__ / this.Su, i = this.xu + t, n = new yo(i - e + 1, i);
    this._c(new wl(n));
  }
  zu() {
    const t = this.uc();
    if (this.Su < t && (this.Su = t, this.vu = true), this.__ !== 0) {
      const e = 0.5 * this.__;
      this.Su > e && (this.Su = e, this.vu = true);
    }
  }
  uc() {
    return this.cn.fixLeftEdge && this.cn.fixRightEdge && this.uu.length !== 0 ? this.__ / this.uu.length : this.cn.minBarSpacing;
  }
  Lu() {
    const t = this.cc();
    t !== null && this.xu < t && (this.xu = t, this.vu = true);
    const e = this.dc();
    this.xu > e && (this.xu = e, this.vu = true);
  }
  cc() {
    const t = this.Bu(), e = this._u;
    return t === null || e === null ? null : t - e - 1 + (this.cn.fixLeftEdge ? this.__ / this.Su : Math.min(2, this.uu.length));
  }
  dc() {
    return this.cn.fixRightEdge ? 0 : this.__ / this.Su - Math.min(2, this.uu.length);
  }
  Xu() {
    this.wu = { le: this.le(), Hu: this.Hu() };
  }
  Ku() {
    this.wu = null;
  }
  Uu(t) {
    let e = this.du.get(t.weight);
    return e === void 0 && (e = new D2((i) => this.fc(i), this.q_), this.du.set(t.weight, e)), e.Y_(t);
  }
  fc(t) {
    return this.q_.formatTickmark(t, this.yo);
  }
  _c(t) {
    const e = this.fu;
    this.fu = t, Ev(e.lu(), this.fu.lu()) || this.pu.m(), Ev(e.au(), this.fu.au()) || this.mu.m(), this.oc();
  }
  oc() {
    this.gu = null;
  }
  Cu() {
    this.oc(), this.du.clear();
  }
  ku() {
    this.q_.updateFormatter(this.yo);
  }
  Tu() {
    if (!this.cn.fixLeftEdge) return;
    const t = this.Bu();
    if (t === null) return;
    const e = this.Xs();
    if (e === null) return;
    const i = e.Os() - t;
    if (i < 0) {
      const n = this.xu - i - 1;
      this.Jn(n);
    }
    this.zu();
  }
  Pu() {
    this.Lu(), this.zu();
  }
}
class N2 {
  X(t, e, i) {
    t.useMediaCoordinateSpace((n) => this.K(n, e, i));
  }
  gl(t, e, i) {
    t.useMediaCoordinateSpace((n) => this.vc(n, e, i));
  }
  vc(t, e, i) {
  }
}
class I2 extends N2 {
  constructor(t) {
    super(), this.mc = /* @__PURE__ */ new Map(), this.zt = t;
  }
  K(t) {
  }
  vc(t) {
    if (!this.zt.yt) return;
    const { context: e, mediaSize: i } = t;
    let n = 0;
    for (const a of this.zt.bc) {
      if (a.Kt.length === 0) continue;
      e.font = a.R;
      const c = this.wc(e, a.Kt);
      c > i.width ? a.Zu = i.width / c : a.Zu = 1, n += a.gc * a.Zu;
    }
    let l = 0;
    switch (this.zt.Mc) {
      case "top":
        l = 0;
        break;
      case "center":
        l = Math.max((i.height - n) / 2, 0);
        break;
      case "bottom":
        l = Math.max(i.height - n, 0);
    }
    e.fillStyle = this.zt.V;
    for (const a of this.zt.bc) {
      e.save();
      let c = 0;
      switch (this.zt.xc) {
        case "left":
          e.textAlign = "left", c = a.gc / 2;
          break;
        case "center":
          e.textAlign = "center", c = i.width / 2;
          break;
        case "right":
          e.textAlign = "right", c = i.width - 1 - a.gc / 2;
      }
      e.translate(c, l), e.textBaseline = "top", e.font = a.R, e.scale(a.Zu, a.Zu), e.fillText(a.Kt, 0, a.Sc), e.restore(), l += a.gc * a.Zu;
    }
  }
  wc(t, e) {
    const i = this.kc(t.font);
    let n = i.get(e);
    return n === void 0 && (n = t.measureText(e).width, i.set(e, n)), n;
  }
  kc(t) {
    let e = this.mc.get(t);
    return e === void 0 && (e = /* @__PURE__ */ new Map(), this.mc.set(t, e)), e;
  }
}
class F2 {
  constructor(t) {
    this.ft = true, this.Ft = { yt: false, V: "", bc: [], Mc: "center", xc: "center" }, this.Wt = new I2(this.Ft), this.jt = t;
  }
  bt() {
    this.ft = true;
  }
  gt() {
    return this.ft && (this.Mt(), this.ft = false), this.Wt;
  }
  Mt() {
    const t = this.jt.W(), e = this.Ft;
    e.yt = t.visible, e.yt && (e.V = t.color, e.xc = t.horzAlign, e.Mc = t.vertAlign, e.bc = [{ Kt: t.text, R: xl(t.fontSize, t.fontFamily, t.fontStyle), gc: 1.2 * t.fontSize, Sc: 0, Zu: 0 }]);
  }
}
class V2 extends Ou {
  constructor(t, e) {
    super(), this.cn = e, this.wn = new F2(this);
  }
  Rn() {
    return [];
  }
  Pn() {
    return [this.wn];
  }
  W() {
    return this.cn;
  }
  Vn() {
    this.wn.bt();
  }
}
var Rv, zv, Lv, hr, Dv;
(function(s) {
  s[s.OnTouchEnd = 0] = "OnTouchEnd", s[s.OnNextTap = 1] = "OnNextTap";
})(Rv || (Rv = {}));
class B2 {
  constructor(t, e, i) {
    this.yc = [], this.Cc = [], this.__ = 0, this.Tc = null, this.Pc = new Be(), this.Rc = new Be(), this.Dc = null, this.Vc = t, this.cn = e, this.q_ = i, this.Oc = new yw(this), this.yl = new A2(this, e.timeScale, this.cn.localization, i), this.vt = new Rw(this, e.crosshair), this.Bc = new C2(e.crosshair), this.Ac = new V2(this, e.watermark), this.Ic(), this.yc[0].x_(2e3), this.zc = this.Lc(0), this.Ec = this.Lc(1);
  }
  Kl() {
    this.Nc(ss.es());
  }
  Uh() {
    this.Nc(ss.ss());
  }
  oa() {
    this.Nc(new ss(1));
  }
  Gl(t) {
    const e = this.Fc(t);
    this.Nc(e);
  }
  Wc() {
    return this.Tc;
  }
  jc(t) {
    const e = this.Tc;
    this.Tc = t, e !== null && this.Gl(e.Hc), t !== null && this.Gl(t.Hc);
  }
  W() {
    return this.cn;
  }
  $h(t) {
    ri(this.cn, t), this.yc.forEach((e) => e.b_(t)), t.timeScale !== void 0 && this.yl.$h(t.timeScale), t.localization !== void 0 && this.yl.yu(t.localization), (t.leftPriceScale || t.rightPriceScale) && this.Pc.m(), this.zc = this.Lc(0), this.Ec = this.Lc(1), this.Kl();
  }
  $c(t, e) {
    if (t === "left") return void this.$h({ leftPriceScale: e });
    if (t === "right") return void this.$h({ rightPriceScale: e });
    const i = this.Uc(t);
    i !== null && (i.Dt.$h(e), this.Pc.m());
  }
  Uc(t) {
    for (const e of this.yc) {
      const i = e.w_(t);
      if (i !== null) return { Ht: e, Dt: i };
    }
    return null;
  }
  St() {
    return this.yl;
  }
  qc() {
    return this.yc;
  }
  Yc() {
    return this.Ac;
  }
  Zc() {
    return this.vt;
  }
  Xc() {
    return this.Rc;
  }
  Kc(t, e) {
    t.Lo(e), this.Wu();
  }
  S_(t) {
    this.__ = t, this.yl.S_(this.__), this.yc.forEach((e) => e.S_(t)), this.Wu();
  }
  Ic(t) {
    const e = new L2(this.yl, this);
    t !== void 0 ? this.yc.splice(t, 0, e) : this.yc.push(e);
    const i = t === void 0 ? this.yc.length - 1 : t, n = ss.es();
    return n.Nn(i, { Fn: 0, Wn: true }), this.Nc(n), e;
  }
  V_(t, e, i) {
    t.V_(e, i);
  }
  O_(t, e, i) {
    t.O_(e, i), this.Jl(), this.Nc(this.Gc(t, 2));
  }
  B_(t, e) {
    t.B_(e), this.Nc(this.Gc(t, 2));
  }
  A_(t, e, i) {
    e.Vo() || t.A_(e, i);
  }
  I_(t, e, i) {
    e.Vo() || (t.I_(e, i), this.Jl(), this.Nc(this.Gc(t, 2)));
  }
  z_(t, e) {
    e.Vo() || (t.z_(e), this.Nc(this.Gc(t, 2)));
  }
  E_(t, e) {
    t.E_(e), this.Nc(this.Gc(t, 2));
  }
  Jc(t) {
    this.yl.Go(t);
  }
  Qc(t, e) {
    const i = this.St();
    if (i.Ni() || e === 0) return;
    const n = i.Hi();
    t = Math.max(1, Math.min(t, n)), i.Zu(t, e), this.Wu();
  }
  td(t) {
    this.nd(0), this.sd(t), this.ed();
  }
  rd(t) {
    this.yl.Jo(t), this.Wu();
  }
  hd() {
    this.yl.Qo(), this.Uh();
  }
  nd(t) {
    this.yl.t_(t);
  }
  sd(t) {
    this.yl.i_(t), this.Wu();
  }
  ed() {
    this.yl.n_(), this.Uh();
  }
  wt() {
    return this.Cc;
  }
  ld(t, e, i, n, l) {
    this.vt.gn(t, e);
    let a = NaN, c = this.yl.Nu(t);
    const u = this.yl.Xs();
    u !== null && (c = Math.min(Math.max(u.Os(), c), u.ui()));
    const f = n.vn(), p = f.Ct();
    p !== null && (a = f.pn(e, p)), a = this.Bc.Oa(a, c, n), this.vt.kn(c, a, n), this.oa(), l || this.Rc.m(this.vt.xt(), { x: t, y: e }, i);
  }
  ad(t, e, i) {
    const n = i.vn(), l = n.Ct(), a = n.Rt(t, ut(l)), c = this.yl.Va(e, true), u = this.yl.It(ut(c));
    this.ld(u, a, null, i, true);
  }
  od(t) {
    this.Zc().Cn(), this.oa(), t || this.Rc.m(null, null, null);
  }
  Jl() {
    const t = this.vt.Ht();
    if (t !== null) {
      const e = this.vt.xn(), i = this.vt.Sn();
      this.ld(e, i, null, t);
    }
    this.vt.Vn();
  }
  _d(t, e, i) {
    const n = this.yl.mn(0);
    e !== void 0 && i !== void 0 && this.yl.bt(e, i);
    const l = this.yl.mn(0), a = this.yl.Eu(), c = this.yl.Xs();
    if (c !== null && n !== null && l !== null) {
      const u = c.Kr(a), f = this.q_.key(n) > this.q_.key(l), p = t !== null && t > a && !f, m = this.yl.W().allowShiftVisibleRangeOnWhitespaceReplacement, y = u && (i !== void 0 || m) && this.yl.W().shiftVisibleRangeOnNewBar;
      if (p && !y) {
        const w = t - a;
        this.yl.Jn(this.yl.Hu() - w);
      }
    }
    this.yl.Yu(t);
  }
  ia(t) {
    t !== null && t.F_();
  }
  dr(t) {
    const e = this.yc.find((i) => i.Uo().includes(t));
    return e === void 0 ? null : e;
  }
  Wu() {
    this.Ac.Vn(), this.yc.forEach((t) => t.F_()), this.Jl();
  }
  S() {
    this.yc.forEach((t) => t.S()), this.yc.length = 0, this.cn.localization.priceFormatter = void 0, this.cn.localization.percentageFormatter = void 0, this.cn.localization.timeFormatter = void 0;
  }
  ud() {
    return this.Oc;
  }
  br() {
    return this.Oc.W();
  }
  g_() {
    return this.Pc;
  }
  dd(t, e, i) {
    const n = this.yc[0], l = this.fd(e, t, n, i);
    return this.Cc.push(l), this.Cc.length === 1 ? this.Kl() : this.Uh(), l;
  }
  vd(t) {
    const e = this.dr(t), i = this.Cc.indexOf(t);
    hn(i !== -1, "Series not found"), this.Cc.splice(i, 1), ut(e).Zo(t), t.S && t.S();
  }
  Xl(t, e) {
    const i = ut(this.dr(t));
    i.Zo(t);
    const n = this.Uc(e);
    if (n === null) {
      const l = t.Xi();
      i.qo(t, e, l);
    } else {
      const l = n.Ht === i ? t.Xi() : void 0;
      n.Ht.qo(t, e, l);
    }
  }
  hc() {
    const t = ss.ss();
    t.$n(), this.Nc(t);
  }
  pd(t) {
    const e = ss.ss();
    e.Yn(t), this.Nc(e);
  }
  Kn() {
    const t = ss.ss();
    t.Kn(), this.Nc(t);
  }
  Gn(t) {
    const e = ss.ss();
    e.Gn(t), this.Nc(e);
  }
  Jn(t) {
    const e = ss.ss();
    e.Jn(t), this.Nc(e);
  }
  Zn(t) {
    const e = ss.ss();
    e.Zn(t), this.Nc(e);
  }
  Un() {
    const t = ss.ss();
    t.Un(), this.Nc(t);
  }
  md() {
    return this.cn.rightPriceScale.visible ? "right" : "left";
  }
  bd() {
    return this.Ec;
  }
  q() {
    return this.zc;
  }
  Bt(t) {
    const e = this.Ec, i = this.zc;
    if (e === i) return e;
    if (t = Math.max(0, Math.min(100, Math.round(100 * t))), this.Dc === null || this.Dc.Ps !== i || this.Dc.Rs !== e) this.Dc = { Ps: i, Rs: e, wd: /* @__PURE__ */ new Map() };
    else {
      const l = this.Dc.wd.get(t);
      if (l !== void 0) return l;
    }
    const n = function(l, a, c) {
      const [u, f, p, m] = zo(l), [y, w, S, C] = zo(a), O = [Js(u + c * (y - u)), Js(f + c * (w - f)), Js(p + c * (S - p)), z0(m + c * (C - m))];
      return `rgba(${O[0]}, ${O[1]}, ${O[2]}, ${O[3]})`;
    }(i, e, t / 100);
    return this.Dc.wd.set(t, n), n;
  }
  Gc(t, e) {
    const i = new ss(e);
    if (t !== null) {
      const n = this.yc.indexOf(t);
      i.Nn(n, { Fn: e });
    }
    return i;
  }
  Fc(t, e) {
    return e === void 0 && (e = 2), this.Gc(this.dr(t), e);
  }
  Nc(t) {
    this.Vc && this.Vc(t), this.yc.forEach((e) => e.j_().qh().bt());
  }
  fd(t, e, i, n) {
    const l = new Fu(this, t, e, i, n), a = t.priceScaleId !== void 0 ? t.priceScaleId : this.md();
    return i.qo(l, a), Er(a) || l.$h(t), l;
  }
  Lc(t) {
    const e = this.cn.layout;
    return e.background.type === "gradient" ? t === 0 ? e.background.topColor : e.background.bottomColor : e.background.color;
  }
}
function hu(s) {
  return !_i(s) && !Vo(s);
}
function G0(s) {
  return _i(s);
}
(function(s) {
  s[s.Disabled = 0] = "Disabled", s[s.Continuous = 1] = "Continuous", s[s.OnDataUpdate = 2] = "OnDataUpdate";
})(zv || (zv = {})), function(s) {
  s[s.LastBar = 0] = "LastBar", s[s.LastVisible = 1] = "LastVisible";
}(Lv || (Lv = {})), function(s) {
  s.Solid = "solid", s.VerticalGradient = "gradient";
}(hr || (hr = {})), function(s) {
  s[s.Year = 0] = "Year", s[s.Month = 1] = "Month", s[s.DayOfMonth = 2] = "DayOfMonth", s[s.Time = 3] = "Time", s[s.TimeWithSeconds = 4] = "TimeWithSeconds";
}(Dv || (Dv = {}));
const Pv = (s) => s.getUTCFullYear();
function j2(s, t, e) {
  return t.replace(/yyyy/g, ((i) => Vi(Pv(i), 4))(s)).replace(/yy/g, ((i) => Vi(Pv(i) % 100, 2))(s)).replace(/MMMM/g, ((i, n) => new Date(i.getUTCFullYear(), i.getUTCMonth(), 1).toLocaleString(n, { month: "long" }))(s, e)).replace(/MMM/g, ((i, n) => new Date(i.getUTCFullYear(), i.getUTCMonth(), 1).toLocaleString(n, { month: "short" }))(s, e)).replace(/MM/g, ((i) => Vi(((n) => n.getUTCMonth() + 1)(i), 2))(s)).replace(/dd/g, ((i) => Vi(((n) => n.getUTCDate())(i), 2))(s));
}
class Q0 {
  constructor(t = "yyyy-MM-dd", e = "default") {
    this.gd = t, this.Md = e;
  }
  Y_(t) {
    return j2(t, this.gd, this.Md);
  }
}
class W2 {
  constructor(t) {
    this.xd = t || "%h:%m:%s";
  }
  Y_(t) {
    return this.xd.replace("%h", Vi(t.getUTCHours(), 2)).replace("%m", Vi(t.getUTCMinutes(), 2)).replace("%s", Vi(t.getUTCSeconds(), 2));
  }
}
const H2 = { Sd: "yyyy-MM-dd", kd: "%h:%m:%s", yd: " ", Cd: "default" };
class K2 {
  constructor(t = {}) {
    const e = Object.assign(Object.assign({}, H2), t);
    this.Td = new Q0(e.Sd, e.Cd), this.Pd = new W2(e.kd), this.Rd = e.yd;
  }
  Y_(t) {
    return `${this.Td.Y_(t)}${this.Rd}${this.Pd.Y_(t)}`;
  }
}
function Pa(s) {
  return 60 * s * 60 * 1e3;
}
function Pc(s) {
  return 60 * s * 1e3;
}
const Oa = [{ Dd: (Ov = 1, 1e3 * Ov), Vd: 10 }, { Dd: Pc(1), Vd: 20 }, { Dd: Pc(5), Vd: 21 }, { Dd: Pc(30), Vd: 22 }, { Dd: Pa(1), Vd: 30 }, { Dd: Pa(3), Vd: 31 }, { Dd: Pa(6), Vd: 32 }, { Dd: Pa(12), Vd: 33 }];
var Ov;
function Av(s, t) {
  if (s.getUTCFullYear() !== t.getUTCFullYear()) return 70;
  if (s.getUTCMonth() !== t.getUTCMonth()) return 60;
  if (s.getUTCDate() !== t.getUTCDate()) return 50;
  for (let e = Oa.length - 1; e >= 0; --e) if (Math.floor(t.getTime() / Oa[e].Dd) !== Math.floor(s.getTime() / Oa[e].Dd)) return Oa[e].Vd;
  return 0;
}
function Oc(s) {
  let t = s;
  if (Vo(s) && (t = Vu(s)), !hu(t)) throw new Error("time must be of type BusinessDay");
  const e = new Date(Date.UTC(t.year, t.month - 1, t.day, 0, 0, 0, 0));
  return { Od: Math.round(e.getTime() / 1e3), Bd: t };
}
function Nv(s) {
  if (!G0(s)) throw new Error("time must be of type isUTCTimestamp");
  return { Od: s };
}
function Vu(s) {
  const t = new Date(s);
  if (isNaN(t.getTime())) throw new Error(`Invalid date string=${s}, expected format=yyyy-mm-dd`);
  return { day: t.getUTCDate(), month: t.getUTCMonth() + 1, year: t.getUTCFullYear() };
}
function Iv(s) {
  Vo(s.time) && (s.time = Vu(s.time));
}
class Fv {
  options() {
    return this.cn;
  }
  setOptions(t) {
    this.cn = t, this.updateFormatter(t.localization);
  }
  preprocessData(t) {
    Array.isArray(t) ? function(e) {
      e.forEach(Iv);
    }(t) : Iv(t);
  }
  createConverterToInternalObj(t) {
    return ut(function(e) {
      return e.length === 0 ? null : hu(e[0].time) || Vo(e[0].time) ? Oc : Nv;
    }(t));
  }
  key(t) {
    return typeof t == "object" && "Od" in t ? t.Od : this.key(this.convertHorzItemToInternal(t));
  }
  cacheKey(t) {
    const e = t;
    return e.Bd === void 0 ? new Date(1e3 * e.Od).getTime() : new Date(Date.UTC(e.Bd.year, e.Bd.month - 1, e.Bd.day)).getTime();
  }
  convertHorzItemToInternal(t) {
    return G0(e = t) ? Nv(e) : hu(e) ? Oc(e) : Oc(Vu(e));
    var e;
  }
  updateFormatter(t) {
    if (!this.cn) return;
    const e = t.dateFormat;
    this.cn.timeScale.timeVisible ? this.Ad = new K2({ Sd: e, kd: this.cn.timeScale.secondsVisible ? "%h:%m:%s" : "%h:%m", yd: "   ", Cd: t.locale }) : this.Ad = new Q0(e, t.locale);
  }
  formatHorzItem(t) {
    const e = t;
    return this.Ad.Y_(new Date(1e3 * e.Od));
  }
  formatTickmark(t, e) {
    const i = function(l, a, c) {
      switch (l) {
        case 0:
        case 10:
          return a ? c ? 4 : 3 : 2;
        case 20:
        case 21:
        case 22:
        case 30:
        case 31:
        case 32:
        case 33:
          return a ? 3 : 2;
        case 50:
          return 2;
        case 60:
          return 1;
        case 70:
          return 0;
      }
    }(t.weight, this.cn.timeScale.timeVisible, this.cn.timeScale.secondsVisible), n = this.cn.timeScale;
    if (n.tickMarkFormatter !== void 0) {
      const l = n.tickMarkFormatter(t.originalTime, i, e.locale);
      if (l !== null) return l;
    }
    return function(l, a, c) {
      const u = {};
      switch (a) {
        case 0:
          u.year = "numeric";
          break;
        case 1:
          u.month = "short";
          break;
        case 2:
          u.day = "numeric";
          break;
        case 3:
          u.hour12 = false, u.hour = "2-digit", u.minute = "2-digit";
          break;
        case 4:
          u.hour12 = false, u.hour = "2-digit", u.minute = "2-digit", u.second = "2-digit";
      }
      const f = l.Bd === void 0 ? new Date(1e3 * l.Od) : new Date(Date.UTC(l.Bd.year, l.Bd.month - 1, l.Bd.day));
      return new Date(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate(), f.getUTCHours(), f.getUTCMinutes(), f.getUTCSeconds(), f.getUTCMilliseconds()).toLocaleString(c, u);
    }(t.time, i, e.locale);
  }
  maxTickMarkWeight(t) {
    let e = t.reduce(O2, t[0]).weight;
    return e > 30 && e < 50 && (e = 30), e;
  }
  fillWeightsForPoints(t, e) {
    (function(i, n = 0) {
      if (i.length === 0) return;
      let l = n === 0 ? null : i[n - 1].time.Od, a = l !== null ? new Date(1e3 * l) : null, c = 0;
      for (let u = n; u < i.length; ++u) {
        const f = i[u], p = new Date(1e3 * f.time.Od);
        a !== null && (f.timeWeight = Av(p, a)), c += f.time.Od - (l || f.time.Od), l = f.time.Od, a = p;
      }
      if (n === 0 && i.length > 1) {
        const u = Math.ceil(c / (i.length - 1)), f = new Date(1e3 * (i[0].time.Od - u));
        i[0].timeWeight = Av(new Date(1e3 * i[0].time.Od), f);
      }
    })(t, e);
  }
  static Id(t) {
    return ri({ localization: { dateFormat: "dd MMM 'yy" } }, t ?? {});
  }
}
const Cl = typeof window < "u";
function Vv() {
  return !!Cl && window.navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
}
function Ac() {
  return !!Cl && /iPhone|iPad|iPod/.test(window.navigator.platform);
}
function du(s) {
  return s + s % 2;
}
function Nc(s, t) {
  return s.zd - t.zd;
}
function Ic(s, t, e) {
  const i = (s.zd - t.zd) / (s.ot - t.ot);
  return Math.sign(i) * Math.min(Math.abs(i), e);
}
class q2 {
  constructor(t, e, i, n) {
    this.Ld = null, this.Ed = null, this.Nd = null, this.Fd = null, this.Wd = null, this.jd = 0, this.Hd = 0, this.$d = t, this.Ud = e, this.qd = i, this.rs = n;
  }
  Yd(t, e) {
    if (this.Ld !== null) {
      if (this.Ld.ot === e) return void (this.Ld.zd = t);
      if (Math.abs(this.Ld.zd - t) < this.rs) return;
    }
    this.Fd = this.Nd, this.Nd = this.Ed, this.Ed = this.Ld, this.Ld = { ot: e, zd: t };
  }
  Vr(t, e) {
    if (this.Ld === null || this.Ed === null || e - this.Ld.ot > 50) return;
    let i = 0;
    const n = Ic(this.Ld, this.Ed, this.Ud), l = Nc(this.Ld, this.Ed), a = [n], c = [l];
    if (i += l, this.Nd !== null) {
      const f = Ic(this.Ed, this.Nd, this.Ud);
      if (Math.sign(f) === Math.sign(n)) {
        const p = Nc(this.Ed, this.Nd);
        if (a.push(f), c.push(p), i += p, this.Fd !== null) {
          const m = Ic(this.Nd, this.Fd, this.Ud);
          if (Math.sign(m) === Math.sign(n)) {
            const y = Nc(this.Nd, this.Fd);
            a.push(m), c.push(y), i += y;
          }
        }
      }
    }
    let u = 0;
    for (let f = 0; f < a.length; ++f) u += c[f] / i * a[f];
    Math.abs(u) < this.$d || (this.Wd = { zd: t, ot: e }, this.Hd = u, this.jd = function(f, p) {
      const m = Math.log(p);
      return Math.log(1 * m / -f) / m;
    }(Math.abs(u), this.qd));
  }
  tc(t) {
    const e = ut(this.Wd), i = t - e.ot;
    return e.zd + this.Hd * (Math.pow(this.qd, i) - 1) / Math.log(this.qd);
  }
  Qu(t) {
    return this.Wd === null || this.Zd(t) === this.jd;
  }
  Zd(t) {
    const e = t - ut(this.Wd).ot;
    return Math.min(e, this.jd);
  }
}
class U2 {
  constructor(t, e) {
    this.Xd = void 0, this.Kd = void 0, this.Gd = void 0, this.en = false, this.Jd = t, this.Qd = e, this.tf();
  }
  bt() {
    this.tf();
  }
  if() {
    this.Xd && this.Jd.removeChild(this.Xd), this.Kd && this.Jd.removeChild(this.Kd), this.Xd = void 0, this.Kd = void 0;
  }
  nf() {
    return this.en !== this.sf() || this.Gd !== this.ef();
  }
  ef() {
    return L0(zo(this.Qd.W().layout.textColor)) > 160 ? "dark" : "light";
  }
  sf() {
    return this.Qd.W().layout.attributionLogo;
  }
  rf() {
    const t = new URL(location.href);
    return t.hostname ? "&utm_source=" + t.hostname + t.pathname : "";
  }
  tf() {
    this.nf() && (this.if(), this.en = this.sf(), this.en && (this.Gd = this.ef(), this.Kd = document.createElement("style"), this.Kd.innerText = "a#tv-attr-logo{--fill:#131722;--stroke:#fff;position:absolute;left:10px;bottom:10px;height:19px;width:35px;margin:0;padding:0;border:0;z-index:3;}a#tv-attr-logo[data-dark]{--fill:#D1D4DC;--stroke:#131722;}", this.Xd = document.createElement("a"), this.Xd.href = `https://www.tradingview.com/?utm_medium=lwc-link&utm_campaign=lwc-chart${this.rf()}`, this.Xd.title = "Charting by TradingView", this.Xd.id = "tv-attr-logo", this.Xd.target = "_blank", this.Xd.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 35 19" width="35" height="19" fill="none"><g fill-rule="evenodd" clip-path="url(#a)" clip-rule="evenodd"><path fill="var(--stroke)" d="M2 0H0v10h6v9h21.4l.5-1.3 6-15 1-2.7H23.7l-.5 1.3-.2.6a5 5 0 0 0-7-.9V0H2Zm20 17h4l5.2-13 .8-2h-7l-1 2.5-.2.5-1.5 3.8-.3.7V17Zm-.8-10a3 3 0 0 0 .7-2.7A3 3 0 1 0 16.8 7h4.4ZM14 7V2H2v6h6v9h4V7h2Z"/><path fill="var(--fill)" d="M14 2H2v6h6v9h6V2Zm12 15h-7l6-15h7l-6 15Zm-7-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></g><defs><clipPath id="a"><path fill="var(--stroke)" d="M0 0h35v19H0z"/></clipPath></defs></svg>', this.Xd.toggleAttribute("data-dark", this.Gd === "dark"), this.Jd.appendChild(this.Kd), this.Jd.appendChild(this.Xd)));
  }
}
function Hn(s, t) {
  const e = ut(s.ownerDocument).createElement("canvas");
  s.appendChild(e);
  const i = nw(e, { options: { allowResizeObserver: false }, transform: (n, l) => ({ width: Math.max(n.width, l.width), height: Math.max(n.height, l.height) }) });
  return i.resizeCanvasElement(t), i;
}
function Kn(s) {
  var t;
  s.width = 1, s.height = 1, (t = s.getContext("2d")) === null || t === void 0 || t.clearRect(0, 0, 1, 1);
}
function fu(s, t, e, i) {
  s.gl && s.gl(t, e, i);
}
function Ua(s, t, e, i) {
  s.X(t, e, i);
}
function vu(s, t, e, i) {
  const n = s(e, i);
  for (const l of n) {
    const a = l.gt();
    a !== null && t(a);
  }
}
function J2(s) {
  Cl && window.chrome !== void 0 && s.addEventListener("mousedown", (t) => {
    if (t.button === 1) return t.preventDefault(), false;
  });
}
class Bu {
  constructor(t, e, i) {
    this.hf = 0, this.lf = null, this.af = { nt: Number.NEGATIVE_INFINITY, st: Number.POSITIVE_INFINITY }, this._f = 0, this.uf = null, this.cf = { nt: Number.NEGATIVE_INFINITY, st: Number.POSITIVE_INFINITY }, this.df = null, this.ff = false, this.vf = null, this.pf = null, this.mf = false, this.bf = false, this.wf = false, this.gf = null, this.Mf = null, this.xf = null, this.Sf = null, this.kf = null, this.yf = null, this.Cf = null, this.Tf = 0, this.Pf = false, this.Rf = false, this.Df = false, this.Vf = 0, this.Of = null, this.Bf = !Ac(), this.Af = (n) => {
      this.If(n);
    }, this.zf = (n) => {
      if (this.Lf(n)) {
        const l = this.Ef(n);
        if (++this._f, this.uf && this._f > 1) {
          const { Nf: a } = this.Ff(pi(n), this.cf);
          a < 30 && !this.wf && this.Wf(l, this.Hf.jf), this.$f();
        }
      } else {
        const l = this.Ef(n);
        if (++this.hf, this.lf && this.hf > 1) {
          const { Nf: a } = this.Ff(pi(n), this.af);
          a < 5 && !this.bf && this.Uf(l, this.Hf.qf), this.Yf();
        }
      }
    }, this.Zf = t, this.Hf = e, this.cn = i, this.Xf();
  }
  S() {
    this.gf !== null && (this.gf(), this.gf = null), this.Mf !== null && (this.Mf(), this.Mf = null), this.Sf !== null && (this.Sf(), this.Sf = null), this.kf !== null && (this.kf(), this.kf = null), this.yf !== null && (this.yf(), this.yf = null), this.xf !== null && (this.xf(), this.xf = null), this.Kf(), this.Yf();
  }
  Gf(t) {
    this.Sf && this.Sf();
    const e = this.Jf.bind(this);
    if (this.Sf = () => {
      this.Zf.removeEventListener("mousemove", e);
    }, this.Zf.addEventListener("mousemove", e), this.Lf(t)) return;
    const i = this.Ef(t);
    this.Uf(i, this.Hf.Qf), this.Bf = true;
  }
  Yf() {
    this.lf !== null && clearTimeout(this.lf), this.hf = 0, this.lf = null, this.af = { nt: Number.NEGATIVE_INFINITY, st: Number.POSITIVE_INFINITY };
  }
  $f() {
    this.uf !== null && clearTimeout(this.uf), this._f = 0, this.uf = null, this.cf = { nt: Number.NEGATIVE_INFINITY, st: Number.POSITIVE_INFINITY };
  }
  Jf(t) {
    if (this.Df || this.pf !== null || this.Lf(t)) return;
    const e = this.Ef(t);
    this.Uf(e, this.Hf.tv), this.Bf = true;
  }
  iv(t) {
    const e = Fc(t.changedTouches, ut(this.Of));
    if (e === null || (this.Vf = Aa(t), this.Cf !== null) || this.Rf) return;
    this.Pf = true;
    const i = this.Ff(pi(e), ut(this.pf)), { nv: n, sv: l, Nf: a } = i;
    if (this.mf || !(a < 5)) {
      if (!this.mf) {
        const c = 0.5 * n, u = l >= c && !this.cn.ev(), f = c > l && !this.cn.rv();
        u || f || (this.Rf = true), this.mf = true, this.wf = true, this.Kf(), this.$f();
      }
      if (!this.Rf) {
        const c = this.Ef(t, e);
        this.Wf(c, this.Hf.hv), ul(t);
      }
    }
  }
  lv(t) {
    if (t.button !== 0) return;
    const e = this.Ff(pi(t), ut(this.vf)), { Nf: i } = e;
    if (i >= 5 && (this.bf = true, this.Yf()), this.bf) {
      const n = this.Ef(t);
      this.Uf(n, this.Hf.av);
    }
  }
  Ff(t, e) {
    const i = Math.abs(e.nt - t.nt), n = Math.abs(e.st - t.st);
    return { nv: i, sv: n, Nf: i + n };
  }
  ov(t) {
    let e = Fc(t.changedTouches, ut(this.Of));
    if (e === null && t.touches.length === 0 && (e = t.changedTouches[0]), e === null) return;
    this.Of = null, this.Vf = Aa(t), this.Kf(), this.pf = null, this.yf && (this.yf(), this.yf = null);
    const i = this.Ef(t, e);
    if (this.Wf(i, this.Hf._v), ++this._f, this.uf && this._f > 1) {
      const { Nf: n } = this.Ff(pi(e), this.cf);
      n < 30 && !this.wf && this.Wf(i, this.Hf.jf), this.$f();
    } else this.wf || (this.Wf(i, this.Hf.uv), this.Hf.uv && ul(t));
    this._f === 0 && ul(t), t.touches.length === 0 && this.ff && (this.ff = false, ul(t));
  }
  If(t) {
    if (t.button !== 0) return;
    const e = this.Ef(t);
    if (this.vf = null, this.Df = false, this.kf && (this.kf(), this.kf = null), Vv() && this.Zf.ownerDocument.documentElement.removeEventListener("mouseleave", this.Af), !this.Lf(t)) if (this.Uf(e, this.Hf.cv), ++this.hf, this.lf && this.hf > 1) {
      const { Nf: i } = this.Ff(pi(t), this.af);
      i < 5 && !this.bf && this.Uf(e, this.Hf.qf), this.Yf();
    } else this.bf || this.Uf(e, this.Hf.dv);
  }
  Kf() {
    this.df !== null && (clearTimeout(this.df), this.df = null);
  }
  fv(t) {
    if (this.Of !== null) return;
    const e = t.changedTouches[0];
    this.Of = e.identifier, this.Vf = Aa(t);
    const i = this.Zf.ownerDocument.documentElement;
    this.wf = false, this.mf = false, this.Rf = false, this.pf = pi(e), this.yf && (this.yf(), this.yf = null);
    {
      const l = this.iv.bind(this), a = this.ov.bind(this);
      this.yf = () => {
        i.removeEventListener("touchmove", l), i.removeEventListener("touchend", a);
      }, i.addEventListener("touchmove", l, { passive: false }), i.addEventListener("touchend", a, { passive: false }), this.Kf(), this.df = setTimeout(this.vv.bind(this, t), 240);
    }
    const n = this.Ef(t, e);
    this.Wf(n, this.Hf.pv), this.uf || (this._f = 0, this.uf = setTimeout(this.$f.bind(this), 500), this.cf = pi(e));
  }
  mv(t) {
    if (t.button !== 0) return;
    const e = this.Zf.ownerDocument.documentElement;
    Vv() && e.addEventListener("mouseleave", this.Af), this.bf = false, this.vf = pi(t), this.kf && (this.kf(), this.kf = null);
    {
      const n = this.lv.bind(this), l = this.If.bind(this);
      this.kf = () => {
        e.removeEventListener("mousemove", n), e.removeEventListener("mouseup", l);
      }, e.addEventListener("mousemove", n), e.addEventListener("mouseup", l);
    }
    if (this.Df = true, this.Lf(t)) return;
    const i = this.Ef(t);
    this.Uf(i, this.Hf.bv), this.lf || (this.hf = 0, this.lf = setTimeout(this.Yf.bind(this), 500), this.af = pi(t));
  }
  Xf() {
    this.Zf.addEventListener("mouseenter", this.Gf.bind(this)), this.Zf.addEventListener("touchcancel", this.Kf.bind(this));
    {
      const t = this.Zf.ownerDocument, e = (i) => {
        this.Hf.wv && (i.composed && this.Zf.contains(i.composedPath()[0]) || i.target && this.Zf.contains(i.target) || this.Hf.wv());
      };
      this.Mf = () => {
        t.removeEventListener("touchstart", e);
      }, this.gf = () => {
        t.removeEventListener("mousedown", e);
      }, t.addEventListener("mousedown", e), t.addEventListener("touchstart", e, { passive: true });
    }
    Ac() && (this.xf = () => {
      this.Zf.removeEventListener("dblclick", this.zf);
    }, this.Zf.addEventListener("dblclick", this.zf)), this.Zf.addEventListener("mouseleave", this.gv.bind(this)), this.Zf.addEventListener("touchstart", this.fv.bind(this), { passive: true }), J2(this.Zf), this.Zf.addEventListener("mousedown", this.mv.bind(this)), this.Mv(), this.Zf.addEventListener("touchmove", () => {
    }, { passive: false });
  }
  Mv() {
    this.Hf.xv === void 0 && this.Hf.Sv === void 0 && this.Hf.kv === void 0 || (this.Zf.addEventListener("touchstart", (t) => this.yv(t.touches), { passive: true }), this.Zf.addEventListener("touchmove", (t) => {
      if (t.touches.length === 2 && this.Cf !== null && this.Hf.Sv !== void 0) {
        const e = Bv(t.touches[0], t.touches[1]) / this.Tf;
        this.Hf.Sv(this.Cf, e), ul(t);
      }
    }, { passive: false }), this.Zf.addEventListener("touchend", (t) => {
      this.yv(t.touches);
    }));
  }
  yv(t) {
    t.length === 1 && (this.Pf = false), t.length !== 2 || this.Pf || this.ff ? this.Cv() : this.Tv(t);
  }
  Tv(t) {
    const e = this.Zf.getBoundingClientRect() || { left: 0, top: 0 };
    this.Cf = { nt: (t[0].clientX - e.left + (t[1].clientX - e.left)) / 2, st: (t[0].clientY - e.top + (t[1].clientY - e.top)) / 2 }, this.Tf = Bv(t[0], t[1]), this.Hf.xv !== void 0 && this.Hf.xv(), this.Kf();
  }
  Cv() {
    this.Cf !== null && (this.Cf = null, this.Hf.kv !== void 0 && this.Hf.kv());
  }
  gv(t) {
    if (this.Sf && this.Sf(), this.Lf(t) || !this.Bf) return;
    const e = this.Ef(t);
    this.Uf(e, this.Hf.Pv), this.Bf = !Ac();
  }
  vv(t) {
    const e = Fc(t.touches, ut(this.Of));
    if (e === null) return;
    const i = this.Ef(t, e);
    this.Wf(i, this.Hf.Rv), this.wf = true, this.ff = true;
  }
  Lf(t) {
    return t.sourceCapabilities && t.sourceCapabilities.firesTouchEvents !== void 0 ? t.sourceCapabilities.firesTouchEvents : Aa(t) < this.Vf + 500;
  }
  Wf(t, e) {
    e && e.call(this.Hf, t);
  }
  Uf(t, e) {
    e && e.call(this.Hf, t);
  }
  Ef(t, e) {
    const i = e || t, n = this.Zf.getBoundingClientRect() || { left: 0, top: 0 };
    return { clientX: i.clientX, clientY: i.clientY, pageX: i.pageX, pageY: i.pageY, screenX: i.screenX, screenY: i.screenY, localX: i.clientX - n.left, localY: i.clientY - n.top, ctrlKey: t.ctrlKey, altKey: t.altKey, shiftKey: t.shiftKey, metaKey: t.metaKey, Dv: !t.type.startsWith("mouse") && t.type !== "contextmenu" && t.type !== "click", Vv: t.type, Ov: i.target, Bv: t.view, Av: () => {
      t.type !== "touchstart" && ul(t);
    } };
  }
}
function Bv(s, t) {
  const e = s.clientX - t.clientX, i = s.clientY - t.clientY;
  return Math.sqrt(e * e + i * i);
}
function ul(s) {
  s.cancelable && s.preventDefault();
}
function pi(s) {
  return { nt: s.pageX, st: s.pageY };
}
function Aa(s) {
  return s.timeStamp || performance.now();
}
function Fc(s, t) {
  for (let e = 0; e < s.length; ++e) if (s[e].identifier === t) return s[e];
  return null;
}
function Na(s) {
  return { Hc: s.Hc, Iv: { gr: s.zv.externalId }, Lv: s.zv.cursorStyle };
}
function X2(s, t, e) {
  for (const i of s) {
    const n = i.gt();
    if (n !== null && n.wr) {
      const l = n.wr(t, e);
      if (l !== null) return { Bv: i, Iv: l };
    }
  }
  return null;
}
function Vc(s, t) {
  return (e) => {
    var i, n, l, a;
    return ((n = (i = e.Dt()) === null || i === void 0 ? void 0 : i.Pa()) !== null && n !== void 0 ? n : "") !== t ? [] : (a = (l = e.da) === null || l === void 0 ? void 0 : l.call(e, s)) !== null && a !== void 0 ? a : [];
  };
}
function jv(s, t, e, i) {
  if (!s.length) return;
  let n = 0;
  const l = e / 2, a = s[0].At(i, true);
  let c = t === 1 ? l - (s[0].Vi() - a / 2) : s[0].Vi() - a / 2 - l;
  c = Math.max(0, c);
  for (let u = 1; u < s.length; u++) {
    const f = s[u], p = s[u - 1], m = p.At(i, false), y = f.Vi(), w = p.Vi();
    if (t === 1 ? y > w - m : y < w + m) {
      const S = w - m * t;
      f.Oi(S);
      const C = S - t * m / 2;
      if ((t === 1 ? C < 0 : C > e) && c > 0) {
        const O = t === 1 ? -1 - C : C - e, R = Math.min(O, c);
        for (let D = n; D < s.length; D++) s[D].Oi(s[D].Vi() + t * R);
        c -= R;
      }
    } else n = u, c = t === 1 ? w - m - y : y - (w + m);
  }
}
class Wv {
  constructor(t, e, i, n) {
    this.Li = null, this.Ev = null, this.Nv = false, this.Fv = new Po(200), this.Qr = null, this.Wv = 0, this.jv = false, this.Hv = () => {
      this.jv || this.tn.$v().$t().Uh();
    }, this.Uv = () => {
      this.jv || this.tn.$v().$t().Uh();
    }, this.tn = t, this.cn = e, this.ko = e.layout, this.Oc = i, this.qv = n === "left", this.Yv = Vc("normal", n), this.Zv = Vc("top", n), this.Xv = Vc("bottom", n), this.Kv = document.createElement("div"), this.Kv.style.height = "100%", this.Kv.style.overflow = "hidden", this.Kv.style.width = "25px", this.Kv.style.left = "0", this.Kv.style.position = "relative", this.Gv = Hn(this.Kv, De({ width: 16, height: 16 })), this.Gv.subscribeSuggestedBitmapSizeChanged(this.Hv);
    const l = this.Gv.canvasElement;
    l.style.position = "absolute", l.style.zIndex = "1", l.style.left = "0", l.style.top = "0", this.Jv = Hn(this.Kv, De({ width: 16, height: 16 })), this.Jv.subscribeSuggestedBitmapSizeChanged(this.Uv);
    const a = this.Jv.canvasElement;
    a.style.position = "absolute", a.style.zIndex = "2", a.style.left = "0", a.style.top = "0";
    const c = { bv: this.Qv.bind(this), pv: this.Qv.bind(this), av: this.tp.bind(this), hv: this.tp.bind(this), wv: this.ip.bind(this), cv: this.np.bind(this), _v: this.np.bind(this), qf: this.sp.bind(this), jf: this.sp.bind(this), Qf: this.ep.bind(this), Pv: this.rp.bind(this) };
    this.hp = new Bu(this.Jv.canvasElement, c, { ev: () => !this.cn.handleScroll.vertTouchDrag, rv: () => true });
  }
  S() {
    this.hp.S(), this.Jv.unsubscribeSuggestedBitmapSizeChanged(this.Uv), Kn(this.Jv.canvasElement), this.Jv.dispose(), this.Gv.unsubscribeSuggestedBitmapSizeChanged(this.Hv), Kn(this.Gv.canvasElement), this.Gv.dispose(), this.Li !== null && this.Li.Ko().p(this), this.Li = null;
  }
  lp() {
    return this.Kv;
  }
  P() {
    return this.ko.fontSize;
  }
  ap() {
    const t = this.Oc.W();
    return this.Qr !== t.R && (this.Fv.nr(), this.Qr = t.R), t;
  }
  op() {
    if (this.Li === null) return 0;
    let t = 0;
    const e = this.ap(), i = ut(this.Gv.canvasElement.getContext("2d"));
    i.save();
    const n = this.Li.Ha();
    i.font = this._p(), n.length > 0 && (t = Math.max(this.Fv.xi(i, n[0].so), this.Fv.xi(i, n[n.length - 1].so)));
    const l = this.up();
    for (let f = l.length; f--; ) {
      const p = this.Fv.xi(i, l[f].Kt());
      p > t && (t = p);
    }
    const a = this.Li.Ct();
    if (a !== null && this.Ev !== null && (c = this.cn.crosshair).mode !== 2 && c.horzLine.visible && c.horzLine.labelVisible) {
      const f = this.Li.pn(1, a), p = this.Li.pn(this.Ev.height - 2, a);
      t = Math.max(t, this.Fv.xi(i, this.Li.Fi(Math.floor(Math.min(f, p)) + 0.11111111111111, a)), this.Fv.xi(i, this.Li.Fi(Math.ceil(Math.max(f, p)) - 0.11111111111111, a)));
    }
    var c;
    i.restore();
    const u = t || 34;
    return du(Math.ceil(e.C + e.T + e.A + e.I + 5 + u));
  }
  cp(t) {
    this.Ev !== null && Bn(this.Ev, t) || (this.Ev = t, this.jv = true, this.Gv.resizeCanvasElement(t), this.Jv.resizeCanvasElement(t), this.jv = false, this.Kv.style.width = `${t.width}px`, this.Kv.style.height = `${t.height}px`);
  }
  dp() {
    return ut(this.Ev).width;
  }
  Gi(t) {
    this.Li !== t && (this.Li !== null && this.Li.Ko().p(this), this.Li = t, t.Ko().l(this.fo.bind(this), this));
  }
  Dt() {
    return this.Li;
  }
  nr() {
    const t = this.tn.fp();
    this.tn.$v().$t().E_(t, ut(this.Dt()));
  }
  vp(t) {
    if (this.Ev === null) return;
    if (t !== 1) {
      this.pp(), this.Gv.applySuggestedBitmapSize();
      const i = jn(this.Gv);
      i !== null && (i.useBitmapCoordinateSpace((n) => {
        this.mp(n), this.Ie(n);
      }), this.tn.bp(i, this.Xv), this.wp(i), this.tn.bp(i, this.Yv), this.gp(i));
    }
    this.Jv.applySuggestedBitmapSize();
    const e = jn(this.Jv);
    e !== null && (e.useBitmapCoordinateSpace(({ context: i, bitmapSize: n }) => {
      i.clearRect(0, 0, n.width, n.height);
    }), this.Mp(e), this.tn.bp(e, this.Zv));
  }
  xp() {
    return this.Gv.bitmapSize;
  }
  Sp(t, e, i) {
    const n = this.xp();
    n.width > 0 && n.height > 0 && t.drawImage(this.Gv.canvasElement, e, i);
  }
  bt() {
    var t;
    (t = this.Li) === null || t === void 0 || t.Ha();
  }
  Qv(t) {
    if (this.Li === null || this.Li.Ni() || !this.cn.handleScale.axisPressedMouseMove.price) return;
    const e = this.tn.$v().$t(), i = this.tn.fp();
    this.Nv = true, e.V_(i, this.Li, t.localY);
  }
  tp(t) {
    if (this.Li === null || !this.cn.handleScale.axisPressedMouseMove.price) return;
    const e = this.tn.$v().$t(), i = this.tn.fp(), n = this.Li;
    e.O_(i, n, t.localY);
  }
  ip() {
    if (this.Li === null || !this.cn.handleScale.axisPressedMouseMove.price) return;
    const t = this.tn.$v().$t(), e = this.tn.fp(), i = this.Li;
    this.Nv && (this.Nv = false, t.B_(e, i));
  }
  np(t) {
    if (this.Li === null || !this.cn.handleScale.axisPressedMouseMove.price) return;
    const e = this.tn.$v().$t(), i = this.tn.fp();
    this.Nv = false, e.B_(i, this.Li);
  }
  sp(t) {
    this.cn.handleScale.axisDoubleClickReset.price && this.nr();
  }
  ep(t) {
    this.Li !== null && (!this.tn.$v().$t().W().handleScale.axisPressedMouseMove.price || this.Li.Mh() || this.Li.Oo() || this.kp(1));
  }
  rp(t) {
    this.kp(0);
  }
  up() {
    const t = [], e = this.Li === null ? void 0 : this.Li;
    return ((i) => {
      for (let n = 0; n < i.length; ++n) {
        const l = i[n].Rn(this.tn.fp(), e);
        for (let a = 0; a < l.length; a++) t.push(l[a]);
      }
    })(this.tn.fp().Uo()), t;
  }
  mp({ context: t, bitmapSize: e }) {
    const { width: i, height: n } = e, l = this.tn.fp().$t(), a = l.q(), c = l.bd();
    a === c ? $r(t, 0, 0, i, n, a) : D0(t, 0, 0, i, n, a, c);
  }
  Ie({ context: t, bitmapSize: e, horizontalPixelRatio: i }) {
    if (this.Ev === null || this.Li === null || !this.Li.W().borderVisible) return;
    t.fillStyle = this.Li.W().borderColor;
    const n = Math.max(1, Math.floor(this.ap().C * i));
    let l;
    l = this.qv ? e.width - n : 0, t.fillRect(l, 0, n, e.height);
  }
  wp(t) {
    if (this.Ev === null || this.Li === null) return;
    const e = this.Li.Ha(), i = this.Li.W(), n = this.ap(), l = this.qv ? this.Ev.width - n.T : 0;
    i.borderVisible && i.ticksVisible && t.useBitmapCoordinateSpace(({ context: a, horizontalPixelRatio: c, verticalPixelRatio: u }) => {
      a.fillStyle = i.borderColor;
      const f = Math.max(1, Math.floor(u)), p = Math.floor(0.5 * u), m = Math.round(n.T * c);
      a.beginPath();
      for (const y of e) a.rect(Math.floor(l * c), Math.round(y.Ea * u) - p, m, f);
      a.fill();
    }), t.useMediaCoordinateSpace(({ context: a }) => {
      var c;
      a.font = this._p(), a.fillStyle = (c = i.textColor) !== null && c !== void 0 ? c : this.ko.textColor, a.textAlign = this.qv ? "right" : "left", a.textBaseline = "middle";
      const u = this.qv ? Math.round(l - n.A) : Math.round(l + n.T + n.A), f = e.map((p) => this.Fv.Mi(a, p.so));
      for (let p = e.length; p--; ) {
        const m = e[p];
        a.fillText(m.so, u, m.Ea + f[p]);
      }
    });
  }
  pp() {
    if (this.Ev === null || this.Li === null) return;
    const t = [], e = this.Li.Uo().slice(), i = this.tn.fp(), n = this.ap();
    this.Li === i.pr() && this.tn.fp().Uo().forEach((a) => {
      i.vr(a) && e.push(a);
    });
    const l = this.Li;
    e.forEach((a) => {
      a.Rn(i, l).forEach((c) => {
        c.Oi(null), c.Bi() && t.push(c);
      });
    }), t.forEach((a) => a.Oi(a.ki())), this.Li.W().alignLabels && this.yp(t, n);
  }
  yp(t, e) {
    if (this.Ev === null) return;
    const i = this.Ev.height / 2, n = t.filter((a) => a.ki() <= i), l = t.filter((a) => a.ki() > i);
    n.sort((a, c) => c.ki() - a.ki()), l.sort((a, c) => a.ki() - c.ki());
    for (const a of t) {
      const c = Math.floor(a.At(e) / 2), u = a.ki();
      u > -c && u < c && a.Oi(c), u > this.Ev.height - c && u < this.Ev.height + c && a.Oi(this.Ev.height - c);
    }
    jv(n, 1, this.Ev.height, e), jv(l, -1, this.Ev.height, e);
  }
  gp(t) {
    if (this.Ev === null) return;
    const e = this.up(), i = this.ap(), n = this.qv ? "right" : "left";
    e.forEach((l) => {
      l.Ai() && l.gt(ut(this.Li)).X(t, i, this.Fv, n);
    });
  }
  Mp(t) {
    if (this.Ev === null || this.Li === null) return;
    const e = this.tn.$v().$t(), i = [], n = this.tn.fp(), l = e.Zc().Rn(n, this.Li);
    l.length && i.push(l);
    const a = this.ap(), c = this.qv ? "right" : "left";
    i.forEach((u) => {
      u.forEach((f) => {
        f.gt(ut(this.Li)).X(t, a, this.Fv, c);
      });
    });
  }
  kp(t) {
    this.Kv.style.cursor = t === 1 ? "ns-resize" : "default";
  }
  fo() {
    const t = this.op();
    this.Wv < t && this.tn.$v().$t().Kl(), this.Wv = t;
  }
  _p() {
    return xl(this.ko.fontSize, this.ko.fontFamily);
  }
}
function G2(s, t) {
  var e, i;
  return (i = (e = s.ua) === null || e === void 0 ? void 0 : e.call(s, t)) !== null && i !== void 0 ? i : [];
}
function Ia(s, t) {
  var e, i;
  return (i = (e = s.Pn) === null || e === void 0 ? void 0 : e.call(s, t)) !== null && i !== void 0 ? i : [];
}
function Q2(s, t) {
  var e, i;
  return (i = (e = s.Ji) === null || e === void 0 ? void 0 : e.call(s, t)) !== null && i !== void 0 ? i : [];
}
function Y2(s, t) {
  var e, i;
  return (i = (e = s.aa) === null || e === void 0 ? void 0 : e.call(s, t)) !== null && i !== void 0 ? i : [];
}
class ju {
  constructor(t, e) {
    this.Ev = De({ width: 0, height: 0 }), this.Cp = null, this.Tp = null, this.Pp = null, this.Rp = null, this.Dp = false, this.Vp = new Be(), this.Op = new Be(), this.Bp = 0, this.Ap = false, this.Ip = null, this.zp = false, this.Lp = null, this.Ep = null, this.jv = false, this.Hv = () => {
      this.jv || this.Np === null || this.$i().Uh();
    }, this.Uv = () => {
      this.jv || this.Np === null || this.$i().Uh();
    }, this.Qd = t, this.Np = e, this.Np.W_().l(this.Fp.bind(this), this, true), this.Wp = document.createElement("td"), this.Wp.style.padding = "0", this.Wp.style.position = "relative";
    const i = document.createElement("div");
    i.style.width = "100%", i.style.height = "100%", i.style.position = "relative", i.style.overflow = "hidden", this.jp = document.createElement("td"), this.jp.style.padding = "0", this.Hp = document.createElement("td"), this.Hp.style.padding = "0", this.Wp.appendChild(i), this.Gv = Hn(i, De({ width: 16, height: 16 })), this.Gv.subscribeSuggestedBitmapSizeChanged(this.Hv);
    const n = this.Gv.canvasElement;
    n.style.position = "absolute", n.style.zIndex = "1", n.style.left = "0", n.style.top = "0", this.Jv = Hn(i, De({ width: 16, height: 16 })), this.Jv.subscribeSuggestedBitmapSizeChanged(this.Uv);
    const l = this.Jv.canvasElement;
    l.style.position = "absolute", l.style.zIndex = "2", l.style.left = "0", l.style.top = "0", this.$p = document.createElement("tr"), this.$p.appendChild(this.jp), this.$p.appendChild(this.Wp), this.$p.appendChild(this.Hp), this.Up(), this.hp = new Bu(this.Jv.canvasElement, this, { ev: () => this.Ip === null && !this.Qd.W().handleScroll.vertTouchDrag, rv: () => this.Ip === null && !this.Qd.W().handleScroll.horzTouchDrag });
  }
  S() {
    this.Cp !== null && this.Cp.S(), this.Tp !== null && this.Tp.S(), this.Pp = null, this.Jv.unsubscribeSuggestedBitmapSizeChanged(this.Uv), Kn(this.Jv.canvasElement), this.Jv.dispose(), this.Gv.unsubscribeSuggestedBitmapSizeChanged(this.Hv), Kn(this.Gv.canvasElement), this.Gv.dispose(), this.Np !== null && this.Np.W_().p(this), this.hp.S();
  }
  fp() {
    return ut(this.Np);
  }
  qp(t) {
    var e, i;
    this.Np !== null && this.Np.W_().p(this), this.Np = t, this.Np !== null && this.Np.W_().l(ju.prototype.Fp.bind(this), this, true), this.Up(), this.Qd.Yp().indexOf(this) === this.Qd.Yp().length - 1 ? (this.Pp = (e = this.Pp) !== null && e !== void 0 ? e : new U2(this.Wp, this.Qd), this.Pp.bt()) : ((i = this.Pp) === null || i === void 0 || i.if(), this.Pp = null);
  }
  $v() {
    return this.Qd;
  }
  lp() {
    return this.$p;
  }
  Up() {
    if (this.Np !== null && (this.Zp(), this.$i().wt().length !== 0)) {
      if (this.Cp !== null) {
        const t = this.Np.R_();
        this.Cp.Gi(ut(t));
      }
      if (this.Tp !== null) {
        const t = this.Np.D_();
        this.Tp.Gi(ut(t));
      }
    }
  }
  Xp() {
    this.Cp !== null && this.Cp.bt(), this.Tp !== null && this.Tp.bt();
  }
  M_() {
    return this.Np !== null ? this.Np.M_() : 0;
  }
  x_(t) {
    this.Np && this.Np.x_(t);
  }
  Qf(t) {
    if (!this.Np) return;
    this.Kp();
    const e = t.localX, i = t.localY;
    this.Gp(e, i, t);
  }
  bv(t) {
    this.Kp(), this.Jp(), this.Gp(t.localX, t.localY, t);
  }
  tv(t) {
    var e;
    if (!this.Np) return;
    this.Kp();
    const i = t.localX, n = t.localY;
    this.Gp(i, n, t);
    const l = this.wr(i, n);
    this.Qd.Qp((e = l == null ? void 0 : l.Lv) !== null && e !== void 0 ? e : null), this.$i().jc(l && { Hc: l.Hc, Iv: l.Iv });
  }
  dv(t) {
    this.Np !== null && (this.Kp(), this.tm(t));
  }
  qf(t) {
    this.Np !== null && this.im(this.Op, t);
  }
  jf(t) {
    this.qf(t);
  }
  av(t) {
    this.Kp(), this.nm(t), this.Gp(t.localX, t.localY, t);
  }
  cv(t) {
    this.Np !== null && (this.Kp(), this.Ap = false, this.sm(t));
  }
  uv(t) {
    this.Np !== null && this.tm(t);
  }
  Rv(t) {
    if (this.Ap = true, this.Ip === null) {
      const e = { x: t.localX, y: t.localY };
      this.rm(e, e, t);
    }
  }
  Pv(t) {
    this.Np !== null && (this.Kp(), this.Np.$t().jc(null), this.hm());
  }
  lm() {
    return this.Vp;
  }
  am() {
    return this.Op;
  }
  xv() {
    this.Bp = 1, this.$i().Un();
  }
  Sv(t, e) {
    if (!this.Qd.W().handleScale.pinch) return;
    const i = 5 * (e - this.Bp);
    this.Bp = e, this.$i().Qc(t.nt, i);
  }
  pv(t) {
    this.Ap = false, this.zp = this.Ip !== null, this.Jp();
    const e = this.$i().Zc();
    this.Ip !== null && e.yt() && (this.Lp = { x: e.Yt(), y: e.Zt() }, this.Ip = { x: t.localX, y: t.localY });
  }
  hv(t) {
    if (this.Np === null) return;
    const e = t.localX, i = t.localY;
    if (this.Ip === null) this.nm(t);
    else {
      this.zp = false;
      const n = ut(this.Lp), l = n.x + (e - this.Ip.x), a = n.y + (i - this.Ip.y);
      this.Gp(l, a, t);
    }
  }
  _v(t) {
    this.$v().W().trackingMode.exitMode === 0 && (this.zp = true), this.om(), this.sm(t);
  }
  wr(t, e) {
    const i = this.Np;
    return i === null ? null : function(n, l, a) {
      const c = n.Uo(), u = function(f, p, m) {
        var y, w;
        let S, C;
        for (const D of f) {
          const N = (w = (y = D.va) === null || y === void 0 ? void 0 : y.call(D, p, m)) !== null && w !== void 0 ? w : [];
          for (const $ of N) O = $.zOrder, (!(R = S == null ? void 0 : S.zOrder) || O === "top" && R !== "top" || O === "normal" && R === "bottom") && (S = $, C = D);
        }
        var O, R;
        return S && C ? { zv: S, Hc: C } : null;
      }(c, l, a);
      if ((u == null ? void 0 : u.zv.zOrder) === "top") return Na(u);
      for (const f of c) {
        if (u && u.Hc === f && u.zv.zOrder !== "bottom" && !u.zv.isBackground) return Na(u);
        const p = X2(f.Pn(n), l, a);
        if (p !== null) return { Hc: f, Bv: p.Bv, Iv: p.Iv };
        if (u && u.Hc === f && u.zv.zOrder !== "bottom" && u.zv.isBackground) return Na(u);
      }
      return u != null && u.zv ? Na(u) : null;
    }(i, t, e);
  }
  _m(t, e) {
    ut(e === "left" ? this.Cp : this.Tp).cp(De({ width: t, height: this.Ev.height }));
  }
  um() {
    return this.Ev;
  }
  cp(t) {
    Bn(this.Ev, t) || (this.Ev = t, this.jv = true, this.Gv.resizeCanvasElement(t), this.Jv.resizeCanvasElement(t), this.jv = false, this.Wp.style.width = t.width + "px", this.Wp.style.height = t.height + "px");
  }
  dm() {
    const t = ut(this.Np);
    t.P_(t.R_()), t.P_(t.D_());
    for (const e of t.Ba()) if (t.vr(e)) {
      const i = e.Dt();
      i !== null && t.P_(i), e.Vn();
    }
  }
  xp() {
    return this.Gv.bitmapSize;
  }
  Sp(t, e, i) {
    const n = this.xp();
    n.width > 0 && n.height > 0 && t.drawImage(this.Gv.canvasElement, e, i);
  }
  vp(t) {
    if (t === 0 || this.Np === null) return;
    if (t > 1 && this.dm(), this.Cp !== null && this.Cp.vp(t), this.Tp !== null && this.Tp.vp(t), t !== 1) {
      this.Gv.applySuggestedBitmapSize();
      const i = jn(this.Gv);
      i !== null && (i.useBitmapCoordinateSpace((n) => {
        this.mp(n);
      }), this.Np && (this.fm(i, G2), this.vm(i), this.pm(i), this.fm(i, Ia), this.fm(i, Q2)));
    }
    this.Jv.applySuggestedBitmapSize();
    const e = jn(this.Jv);
    e !== null && (e.useBitmapCoordinateSpace(({ context: i, bitmapSize: n }) => {
      i.clearRect(0, 0, n.width, n.height);
    }), this.bm(e), this.fm(e, Y2));
  }
  wm() {
    return this.Cp;
  }
  gm() {
    return this.Tp;
  }
  bp(t, e) {
    this.fm(t, e);
  }
  Fp() {
    this.Np !== null && this.Np.W_().p(this), this.Np = null;
  }
  tm(t) {
    this.im(this.Vp, t);
  }
  im(t, e) {
    const i = e.localX, n = e.localY;
    t.M() && t.m(this.$i().St().Nu(i), { x: i, y: n }, e);
  }
  mp({ context: t, bitmapSize: e }) {
    const { width: i, height: n } = e, l = this.$i(), a = l.q(), c = l.bd();
    a === c ? $r(t, 0, 0, i, n, c) : D0(t, 0, 0, i, n, a, c);
  }
  vm(t) {
    const e = ut(this.Np).j_().qh().gt();
    e !== null && e.X(t, false);
  }
  pm(t) {
    const e = this.$i().Yc();
    this.Mm(t, Ia, fu, e), this.Mm(t, Ia, Ua, e);
  }
  bm(t) {
    this.Mm(t, Ia, Ua, this.$i().Zc());
  }
  fm(t, e) {
    const i = ut(this.Np).Uo();
    for (const n of i) this.Mm(t, e, fu, n);
    for (const n of i) this.Mm(t, e, Ua, n);
  }
  Mm(t, e, i, n) {
    const l = ut(this.Np), a = l.$t().Wc(), c = a !== null && a.Hc === n, u = a !== null && c && a.Iv !== void 0 ? a.Iv.Mr : void 0;
    vu(e, (f) => i(f, t, c, u), n, l);
  }
  Zp() {
    if (this.Np === null) return;
    const t = this.Qd, e = this.Np.R_().W().visible, i = this.Np.D_().W().visible;
    e || this.Cp === null || (this.jp.removeChild(this.Cp.lp()), this.Cp.S(), this.Cp = null), i || this.Tp === null || (this.Hp.removeChild(this.Tp.lp()), this.Tp.S(), this.Tp = null);
    const n = t.$t().ud();
    e && this.Cp === null && (this.Cp = new Wv(this, t.W(), n, "left"), this.jp.appendChild(this.Cp.lp())), i && this.Tp === null && (this.Tp = new Wv(this, t.W(), n, "right"), this.Hp.appendChild(this.Tp.lp()));
  }
  xm(t) {
    return t.Dv && this.Ap || this.Ip !== null;
  }
  Sm(t) {
    return Math.max(0, Math.min(t, this.Ev.width - 1));
  }
  km(t) {
    return Math.max(0, Math.min(t, this.Ev.height - 1));
  }
  Gp(t, e, i) {
    this.$i().ld(this.Sm(t), this.km(e), i, ut(this.Np));
  }
  hm() {
    this.$i().od();
  }
  om() {
    this.zp && (this.Ip = null, this.hm());
  }
  rm(t, e, i) {
    this.Ip = t, this.zp = false, this.Gp(e.x, e.y, i);
    const n = this.$i().Zc();
    this.Lp = { x: n.Yt(), y: n.Zt() };
  }
  $i() {
    return this.Qd.$t();
  }
  sm(t) {
    if (!this.Dp) return;
    const e = this.$i(), i = this.fp();
    if (e.z_(i, i.vn()), this.Rp = null, this.Dp = false, e.ed(), this.Ep !== null) {
      const n = performance.now(), l = e.St();
      this.Ep.Vr(l.Hu(), n), this.Ep.Qu(n) || e.Zn(this.Ep);
    }
  }
  Kp() {
    this.Ip = null;
  }
  Jp() {
    if (this.Np) {
      if (this.$i().Un(), document.activeElement !== document.body && document.activeElement !== document.documentElement) ut(document.activeElement).blur();
      else {
        const t = document.getSelection();
        t !== null && t.removeAllRanges();
      }
      !this.Np.vn().Ni() && this.$i().St().Ni();
    }
  }
  nm(t) {
    if (this.Np === null) return;
    const e = this.$i(), i = e.St();
    if (i.Ni()) return;
    const n = this.Qd.W(), l = n.handleScroll, a = n.kineticScroll;
    if ((!l.pressedMouseMove || t.Dv) && (!l.horzTouchDrag && !l.vertTouchDrag || !t.Dv)) return;
    const c = this.Np.vn(), u = performance.now();
    if (this.Rp !== null || this.xm(t) || (this.Rp = { x: t.clientX, y: t.clientY, Od: u, ym: t.localX, Cm: t.localY }), this.Rp !== null && !this.Dp && (this.Rp.x !== t.clientX || this.Rp.y !== t.clientY)) {
      if (t.Dv && a.touch || !t.Dv && a.mouse) {
        const f = i.le();
        this.Ep = new q2(0.2 / f, 7 / f, 0.997, 15 / f), this.Ep.Yd(i.Hu(), this.Rp.Od);
      } else this.Ep = null;
      c.Ni() || e.A_(this.Np, c, t.localY), e.nd(t.localX), this.Dp = true;
    }
    this.Dp && (c.Ni() || e.I_(this.Np, c, t.localY), e.sd(t.localX), this.Ep !== null && this.Ep.Yd(i.Hu(), u));
  }
}
class Hv {
  constructor(t, e, i, n, l) {
    this.ft = true, this.Ev = De({ width: 0, height: 0 }), this.Hv = () => this.vp(3), this.qv = t === "left", this.Oc = i.ud, this.cn = e, this.Tm = n, this.Pm = l, this.Kv = document.createElement("div"), this.Kv.style.width = "25px", this.Kv.style.height = "100%", this.Kv.style.overflow = "hidden", this.Gv = Hn(this.Kv, De({ width: 16, height: 16 })), this.Gv.subscribeSuggestedBitmapSizeChanged(this.Hv);
  }
  S() {
    this.Gv.unsubscribeSuggestedBitmapSizeChanged(this.Hv), Kn(this.Gv.canvasElement), this.Gv.dispose();
  }
  lp() {
    return this.Kv;
  }
  um() {
    return this.Ev;
  }
  cp(t) {
    Bn(this.Ev, t) || (this.Ev = t, this.Gv.resizeCanvasElement(t), this.Kv.style.width = `${t.width}px`, this.Kv.style.height = `${t.height}px`, this.ft = true);
  }
  vp(t) {
    if (t < 3 && !this.ft || this.Ev.width === 0 || this.Ev.height === 0) return;
    this.ft = false, this.Gv.applySuggestedBitmapSize();
    const e = jn(this.Gv);
    e !== null && e.useBitmapCoordinateSpace((i) => {
      this.mp(i), this.Ie(i);
    });
  }
  xp() {
    return this.Gv.bitmapSize;
  }
  Sp(t, e, i) {
    const n = this.xp();
    n.width > 0 && n.height > 0 && t.drawImage(this.Gv.canvasElement, e, i);
  }
  Ie({ context: t, bitmapSize: e, horizontalPixelRatio: i, verticalPixelRatio: n }) {
    if (!this.Tm()) return;
    t.fillStyle = this.cn.timeScale.borderColor;
    const l = Math.floor(this.Oc.W().C * i), a = Math.floor(this.Oc.W().C * n), c = this.qv ? e.width - l : 0;
    t.fillRect(c, 0, l, a);
  }
  mp({ context: t, bitmapSize: e }) {
    $r(t, 0, 0, e.width, e.height, this.Pm());
  }
}
function Wu(s) {
  return (t) => {
    var e, i;
    return (i = (e = t.fa) === null || e === void 0 ? void 0 : e.call(t, s)) !== null && i !== void 0 ? i : [];
  };
}
const Z2 = Wu("normal"), tk = Wu("top"), ek = Wu("bottom");
class sk {
  constructor(t, e) {
    this.Rm = null, this.Dm = null, this.k = null, this.Vm = false, this.Ev = De({ width: 0, height: 0 }), this.Om = new Be(), this.Fv = new Po(5), this.jv = false, this.Hv = () => {
      this.jv || this.Qd.$t().Uh();
    }, this.Uv = () => {
      this.jv || this.Qd.$t().Uh();
    }, this.Qd = t, this.q_ = e, this.cn = t.W().layout, this.Xd = document.createElement("tr"), this.Bm = document.createElement("td"), this.Bm.style.padding = "0", this.Am = document.createElement("td"), this.Am.style.padding = "0", this.Kv = document.createElement("td"), this.Kv.style.height = "25px", this.Kv.style.padding = "0", this.Im = document.createElement("div"), this.Im.style.width = "100%", this.Im.style.height = "100%", this.Im.style.position = "relative", this.Im.style.overflow = "hidden", this.Kv.appendChild(this.Im), this.Gv = Hn(this.Im, De({ width: 16, height: 16 })), this.Gv.subscribeSuggestedBitmapSizeChanged(this.Hv);
    const i = this.Gv.canvasElement;
    i.style.position = "absolute", i.style.zIndex = "1", i.style.left = "0", i.style.top = "0", this.Jv = Hn(this.Im, De({ width: 16, height: 16 })), this.Jv.subscribeSuggestedBitmapSizeChanged(this.Uv);
    const n = this.Jv.canvasElement;
    n.style.position = "absolute", n.style.zIndex = "2", n.style.left = "0", n.style.top = "0", this.Xd.appendChild(this.Bm), this.Xd.appendChild(this.Kv), this.Xd.appendChild(this.Am), this.zm(), this.Qd.$t().g_().l(this.zm.bind(this), this), this.hp = new Bu(this.Jv.canvasElement, this, { ev: () => true, rv: () => !this.Qd.W().handleScroll.horzTouchDrag });
  }
  S() {
    this.hp.S(), this.Rm !== null && this.Rm.S(), this.Dm !== null && this.Dm.S(), this.Jv.unsubscribeSuggestedBitmapSizeChanged(this.Uv), Kn(this.Jv.canvasElement), this.Jv.dispose(), this.Gv.unsubscribeSuggestedBitmapSizeChanged(this.Hv), Kn(this.Gv.canvasElement), this.Gv.dispose();
  }
  lp() {
    return this.Xd;
  }
  Lm() {
    return this.Rm;
  }
  Em() {
    return this.Dm;
  }
  bv(t) {
    if (this.Vm) return;
    this.Vm = true;
    const e = this.Qd.$t();
    !e.St().Ni() && this.Qd.W().handleScale.axisPressedMouseMove.time && e.Jc(t.localX);
  }
  pv(t) {
    this.bv(t);
  }
  wv() {
    const t = this.Qd.$t();
    !t.St().Ni() && this.Vm && (this.Vm = false, this.Qd.W().handleScale.axisPressedMouseMove.time && t.hd());
  }
  av(t) {
    const e = this.Qd.$t();
    !e.St().Ni() && this.Qd.W().handleScale.axisPressedMouseMove.time && e.rd(t.localX);
  }
  hv(t) {
    this.av(t);
  }
  cv() {
    this.Vm = false;
    const t = this.Qd.$t();
    t.St().Ni() && !this.Qd.W().handleScale.axisPressedMouseMove.time || t.hd();
  }
  _v() {
    this.cv();
  }
  qf() {
    this.Qd.W().handleScale.axisDoubleClickReset.time && this.Qd.$t().Kn();
  }
  jf() {
    this.qf();
  }
  Qf() {
    this.Qd.$t().W().handleScale.axisPressedMouseMove.time && this.kp(1);
  }
  Pv() {
    this.kp(0);
  }
  um() {
    return this.Ev;
  }
  Nm() {
    return this.Om;
  }
  Fm(t, e, i) {
    Bn(this.Ev, t) || (this.Ev = t, this.jv = true, this.Gv.resizeCanvasElement(t), this.Jv.resizeCanvasElement(t), this.jv = false, this.Kv.style.width = `${t.width}px`, this.Kv.style.height = `${t.height}px`, this.Om.m(t)), this.Rm !== null && this.Rm.cp(De({ width: e, height: t.height })), this.Dm !== null && this.Dm.cp(De({ width: i, height: t.height }));
  }
  Wm() {
    const t = this.jm();
    return Math.ceil(t.C + t.T + t.P + t.L + t.B + t.Hm);
  }
  bt() {
    this.Qd.$t().St().Ha();
  }
  xp() {
    return this.Gv.bitmapSize;
  }
  Sp(t, e, i) {
    const n = this.xp();
    n.width > 0 && n.height > 0 && t.drawImage(this.Gv.canvasElement, e, i);
  }
  vp(t) {
    if (t === 0) return;
    if (t !== 1) {
      this.Gv.applySuggestedBitmapSize();
      const i = jn(this.Gv);
      i !== null && (i.useBitmapCoordinateSpace((n) => {
        this.mp(n), this.Ie(n), this.$m(i, ek);
      }), this.wp(i), this.$m(i, Z2)), this.Rm !== null && this.Rm.vp(t), this.Dm !== null && this.Dm.vp(t);
    }
    this.Jv.applySuggestedBitmapSize();
    const e = jn(this.Jv);
    e !== null && (e.useBitmapCoordinateSpace(({ context: i, bitmapSize: n }) => {
      i.clearRect(0, 0, n.width, n.height);
    }), this.Um([...this.Qd.$t().wt(), this.Qd.$t().Zc()], e), this.$m(e, tk));
  }
  $m(t, e) {
    const i = this.Qd.$t().wt();
    for (const n of i) vu(e, (l) => fu(l, t, false, void 0), n, void 0);
    for (const n of i) vu(e, (l) => Ua(l, t, false, void 0), n, void 0);
  }
  mp({ context: t, bitmapSize: e }) {
    $r(t, 0, 0, e.width, e.height, this.Qd.$t().bd());
  }
  Ie({ context: t, bitmapSize: e, verticalPixelRatio: i }) {
    if (this.Qd.W().timeScale.borderVisible) {
      t.fillStyle = this.qm();
      const n = Math.max(1, Math.floor(this.jm().C * i));
      t.fillRect(0, 0, e.width, n);
    }
  }
  wp(t) {
    const e = this.Qd.$t().St(), i = e.Ha();
    if (!i || i.length === 0) return;
    const n = this.q_.maxTickMarkWeight(i), l = this.jm(), a = e.W();
    a.borderVisible && a.ticksVisible && t.useBitmapCoordinateSpace(({ context: c, horizontalPixelRatio: u, verticalPixelRatio: f }) => {
      c.strokeStyle = this.qm(), c.fillStyle = this.qm();
      const p = Math.max(1, Math.floor(u)), m = Math.floor(0.5 * u);
      c.beginPath();
      const y = Math.round(l.T * f);
      for (let w = i.length; w--; ) {
        const S = Math.round(i[w].coord * u);
        c.rect(S - m, 0, p, y);
      }
      c.fill();
    }), t.useMediaCoordinateSpace(({ context: c }) => {
      const u = l.C + l.T + l.L + l.P / 2;
      c.textAlign = "center", c.textBaseline = "middle", c.fillStyle = this.$(), c.font = this._p();
      for (const f of i) if (f.weight < n) {
        const p = f.needAlignCoordinate ? this.Ym(c, f.coord, f.label) : f.coord;
        c.fillText(f.label, p, u);
      }
      this.Qd.W().timeScale.allowBoldLabels && (c.font = this.Zm());
      for (const f of i) if (f.weight >= n) {
        const p = f.needAlignCoordinate ? this.Ym(c, f.coord, f.label) : f.coord;
        c.fillText(f.label, p, u);
      }
    });
  }
  Ym(t, e, i) {
    const n = this.Fv.xi(t, i), l = n / 2, a = Math.floor(e - l) + 0.5;
    return a < 0 ? e += Math.abs(0 - a) : a + n > this.Ev.width && (e -= Math.abs(this.Ev.width - (a + n))), e;
  }
  Um(t, e) {
    const i = this.jm();
    for (const n of t) for (const l of n.Qi()) l.gt().X(e, i);
  }
  qm() {
    return this.Qd.W().timeScale.borderColor;
  }
  $() {
    return this.cn.textColor;
  }
  j() {
    return this.cn.fontSize;
  }
  _p() {
    return xl(this.j(), this.cn.fontFamily);
  }
  Zm() {
    return xl(this.j(), this.cn.fontFamily, "bold");
  }
  jm() {
    this.k === null && (this.k = { C: 1, N: NaN, L: NaN, B: NaN, ji: NaN, T: 5, P: NaN, R: "", Wi: new Po(), Hm: 0 });
    const t = this.k, e = this._p();
    if (t.R !== e) {
      const i = this.j();
      t.P = i, t.R = e, t.L = 3 * i / 12, t.B = 3 * i / 12, t.ji = 9 * i / 12, t.N = 0, t.Hm = 4 * i / 12, t.Wi.nr();
    }
    return this.k;
  }
  kp(t) {
    this.Kv.style.cursor = t === 1 ? "ew-resize" : "default";
  }
  zm() {
    const t = this.Qd.$t(), e = t.W();
    e.leftPriceScale.visible || this.Rm === null || (this.Bm.removeChild(this.Rm.lp()), this.Rm.S(), this.Rm = null), e.rightPriceScale.visible || this.Dm === null || (this.Am.removeChild(this.Dm.lp()), this.Dm.S(), this.Dm = null);
    const i = { ud: this.Qd.$t().ud() }, n = () => e.leftPriceScale.borderVisible && t.St().W().borderVisible, l = () => t.bd();
    e.leftPriceScale.visible && this.Rm === null && (this.Rm = new Hv("left", e, i, n, l), this.Bm.appendChild(this.Rm.lp())), e.rightPriceScale.visible && this.Dm === null && (this.Dm = new Hv("right", e, i, n, l), this.Am.appendChild(this.Dm.lp()));
  }
}
const ik = !!Cl && !!navigator.userAgentData && navigator.userAgentData.brands.some((s) => s.brand.includes("Chromium")) && !!Cl && (!((Bc = navigator == null ? void 0 : navigator.userAgentData) === null || Bc === void 0) && Bc.platform ? navigator.userAgentData.platform === "Windows" : navigator.userAgent.toLowerCase().indexOf("win") >= 0);
var Bc;
class nk {
  constructor(t, e, i) {
    var n;
    this.Xm = [], this.Km = 0, this.ho = 0, this.__ = 0, this.Gm = 0, this.Jm = 0, this.Qm = null, this.tb = false, this.Vp = new Be(), this.Op = new Be(), this.Rc = new Be(), this.ib = null, this.nb = null, this.Jd = t, this.cn = e, this.q_ = i, this.Xd = document.createElement("div"), this.Xd.classList.add("tv-lightweight-charts"), this.Xd.style.overflow = "hidden", this.Xd.style.direction = "ltr", this.Xd.style.width = "100%", this.Xd.style.height = "100%", (n = this.Xd).style.userSelect = "none", n.style.webkitUserSelect = "none", n.style.msUserSelect = "none", n.style.MozUserSelect = "none", n.style.webkitTapHighlightColor = "transparent", this.sb = document.createElement("table"), this.sb.setAttribute("cellspacing", "0"), this.Xd.appendChild(this.sb), this.eb = this.rb.bind(this), jc(this.cn) && this.hb(true), this.$i = new B2(this.Vc.bind(this), this.cn, i), this.$t().Xc().l(this.lb.bind(this), this), this.ab = new sk(this, this.q_), this.sb.appendChild(this.ab.lp());
    const l = e.autoSize && this.ob();
    let a = this.cn.width, c = this.cn.height;
    if (l || a === 0 || c === 0) {
      const u = t.getBoundingClientRect();
      a = a || u.width, c = c || u.height;
    }
    this._b(a, c), this.ub(), t.appendChild(this.Xd), this.cb(), this.$i.St().ec().l(this.$i.Kl.bind(this.$i), this), this.$i.g_().l(this.$i.Kl.bind(this.$i), this);
  }
  $t() {
    return this.$i;
  }
  W() {
    return this.cn;
  }
  Yp() {
    return this.Xm;
  }
  fb() {
    return this.ab;
  }
  S() {
    this.hb(false), this.Km !== 0 && window.cancelAnimationFrame(this.Km), this.$i.Xc().p(this), this.$i.St().ec().p(this), this.$i.g_().p(this), this.$i.S();
    for (const t of this.Xm) this.sb.removeChild(t.lp()), t.lm().p(this), t.am().p(this), t.S();
    this.Xm = [], ut(this.ab).S(), this.Xd.parentElement !== null && this.Xd.parentElement.removeChild(this.Xd), this.Rc.S(), this.Vp.S(), this.Op.S(), this.pb();
  }
  _b(t, e, i = false) {
    if (this.ho === e && this.__ === t) return;
    const n = function(c) {
      const u = Math.floor(c.width), f = Math.floor(c.height);
      return De({ width: u - u % 2, height: f - f % 2 });
    }(De({ width: t, height: e }));
    this.ho = n.height, this.__ = n.width;
    const l = this.ho + "px", a = this.__ + "px";
    ut(this.Xd).style.height = l, ut(this.Xd).style.width = a, this.sb.style.height = l, this.sb.style.width = a, i ? this.mb(ss.es(), performance.now()) : this.$i.Kl();
  }
  vp(t) {
    t === void 0 && (t = ss.es());
    for (let e = 0; e < this.Xm.length; e++) this.Xm[e].vp(t.Hn(e).Fn);
    this.cn.timeScale.visible && this.ab.vp(t.jn());
  }
  $h(t) {
    const e = jc(this.cn);
    this.$i.$h(t);
    const i = jc(this.cn);
    i !== e && this.hb(i), this.cb(), this.bb(t);
  }
  lm() {
    return this.Vp;
  }
  am() {
    return this.Op;
  }
  Xc() {
    return this.Rc;
  }
  wb() {
    this.Qm !== null && (this.mb(this.Qm, performance.now()), this.Qm = null);
    const t = this.gb(null), e = document.createElement("canvas");
    e.width = t.width, e.height = t.height;
    const i = ut(e.getContext("2d"));
    return this.gb(i), e;
  }
  Mb(t) {
    return t === "left" && !this.xb() || t === "right" && !this.Sb() || this.Xm.length === 0 ? 0 : ut(t === "left" ? this.Xm[0].wm() : this.Xm[0].gm()).dp();
  }
  kb() {
    return this.cn.autoSize && this.ib !== null;
  }
  yb() {
    return this.Xd;
  }
  Qp(t) {
    this.nb = t, this.nb ? this.yb().style.setProperty("cursor", t) : this.yb().style.removeProperty("cursor");
  }
  Cb() {
    return this.nb;
  }
  Tb() {
    return ws(this.Xm[0]).um();
  }
  bb(t) {
    (t.autoSize !== void 0 || !this.ib || t.width === void 0 && t.height === void 0) && (t.autoSize && !this.ib && this.ob(), t.autoSize === false && this.ib !== null && this.pb(), t.autoSize || t.width === void 0 && t.height === void 0 || this._b(t.width || this.__, t.height || this.ho));
  }
  gb(t) {
    let e = 0, i = 0;
    const n = this.Xm[0], l = (c, u) => {
      let f = 0;
      for (let p = 0; p < this.Xm.length; p++) {
        const m = this.Xm[p], y = ut(c === "left" ? m.wm() : m.gm()), w = y.xp();
        t !== null && y.Sp(t, u, f), f += w.height;
      }
    };
    this.xb() && (l("left", 0), e += ut(n.wm()).xp().width);
    for (let c = 0; c < this.Xm.length; c++) {
      const u = this.Xm[c], f = u.xp();
      t !== null && u.Sp(t, e, i), i += f.height;
    }
    e += n.xp().width, this.Sb() && (l("right", e), e += ut(n.gm()).xp().width);
    const a = (c, u, f) => {
      ut(c === "left" ? this.ab.Lm() : this.ab.Em()).Sp(ut(t), u, f);
    };
    if (this.cn.timeScale.visible) {
      const c = this.ab.xp();
      if (t !== null) {
        let u = 0;
        this.xb() && (a("left", u, i), u = ut(n.wm()).xp().width), this.ab.Sp(t, u, i), u += c.width, this.Sb() && a("right", u, i);
      }
      i += c.height;
    }
    return De({ width: e, height: i });
  }
  Pb() {
    let t = 0, e = 0, i = 0;
    for (const S of this.Xm) this.xb() && (e = Math.max(e, ut(S.wm()).op(), this.cn.leftPriceScale.minimumWidth)), this.Sb() && (i = Math.max(i, ut(S.gm()).op(), this.cn.rightPriceScale.minimumWidth)), t += S.M_();
    e = du(e), i = du(i);
    const n = this.__, l = this.ho, a = Math.max(n - e - i, 0), c = this.cn.timeScale.visible;
    let u = c ? Math.max(this.ab.Wm(), this.cn.timeScale.minimumHeight) : 0;
    var f;
    u = (f = u) + f % 2;
    const p = 0 + u, m = l < p ? 0 : l - p, y = m / t;
    let w = 0;
    for (let S = 0; S < this.Xm.length; ++S) {
      const C = this.Xm[S];
      C.qp(this.$i.qc()[S]);
      let O = 0, R = 0;
      R = S === this.Xm.length - 1 ? m - w : Math.round(C.M_() * y), O = Math.max(R, 2), w += O, C.cp(De({ width: a, height: O })), this.xb() && C._m(e, "left"), this.Sb() && C._m(i, "right"), C.fp() && this.$i.Kc(C.fp(), O);
    }
    this.ab.Fm(De({ width: c ? a : 0, height: u }), c ? e : 0, c ? i : 0), this.$i.S_(a), this.Gm !== e && (this.Gm = e), this.Jm !== i && (this.Jm = i);
  }
  hb(t) {
    t ? this.Xd.addEventListener("wheel", this.eb, { passive: false }) : this.Xd.removeEventListener("wheel", this.eb);
  }
  Rb(t) {
    switch (t.deltaMode) {
      case t.DOM_DELTA_PAGE:
        return 120;
      case t.DOM_DELTA_LINE:
        return 32;
    }
    return ik ? 1 / window.devicePixelRatio : 1;
  }
  rb(t) {
    if (!(t.deltaX !== 0 && this.cn.handleScroll.mouseWheel || t.deltaY !== 0 && this.cn.handleScale.mouseWheel)) return;
    const e = this.Rb(t), i = e * t.deltaX / 100, n = -e * t.deltaY / 100;
    if (t.cancelable && t.preventDefault(), n !== 0 && this.cn.handleScale.mouseWheel) {
      const l = Math.sign(n) * Math.min(1, Math.abs(n)), a = t.clientX - this.Xd.getBoundingClientRect().left;
      this.$t().Qc(a, l);
    }
    i !== 0 && this.cn.handleScroll.mouseWheel && this.$t().td(-80 * i);
  }
  mb(t, e) {
    var i;
    const n = t.jn();
    n === 3 && this.Db(), n !== 3 && n !== 2 || (this.Vb(t), this.Ob(t, e), this.ab.bt(), this.Xm.forEach((l) => {
      l.Xp();
    }), ((i = this.Qm) === null || i === void 0 ? void 0 : i.jn()) === 3 && (this.Qm.ts(t), this.Db(), this.Vb(this.Qm), this.Ob(this.Qm, e), t = this.Qm, this.Qm = null)), this.vp(t);
  }
  Ob(t, e) {
    for (const i of t.Qn()) this.ns(i, e);
  }
  Vb(t) {
    const e = this.$i.qc();
    for (let i = 0; i < e.length; i++) t.Hn(i).Wn && e[i].N_();
  }
  ns(t, e) {
    const i = this.$i.St();
    switch (t.qn) {
      case 0:
        i.hc();
        break;
      case 1:
        i.lc(t.Vt);
        break;
      case 2:
        i.Gn(t.Vt);
        break;
      case 3:
        i.Jn(t.Vt);
        break;
      case 4:
        i.qu();
        break;
      case 5:
        t.Vt.Qu(e) || i.Jn(t.Vt.tc(e));
    }
  }
  Vc(t) {
    this.Qm !== null ? this.Qm.ts(t) : this.Qm = t, this.tb || (this.tb = true, this.Km = window.requestAnimationFrame((e) => {
      if (this.tb = false, this.Km = 0, this.Qm !== null) {
        const i = this.Qm;
        this.Qm = null, this.mb(i, e);
        for (const n of i.Qn()) if (n.qn === 5 && !n.Vt.Qu(e)) {
          this.$t().Zn(n.Vt);
          break;
        }
      }
    }));
  }
  Db() {
    this.ub();
  }
  ub() {
    const t = this.$i.qc(), e = t.length, i = this.Xm.length;
    for (let n = e; n < i; n++) {
      const l = ws(this.Xm.pop());
      this.sb.removeChild(l.lp()), l.lm().p(this), l.am().p(this), l.S();
    }
    for (let n = i; n < e; n++) {
      const l = new ju(this, t[n]);
      l.lm().l(this.Bb.bind(this), this), l.am().l(this.Ab.bind(this), this), this.Xm.push(l), this.sb.insertBefore(l.lp(), this.ab.lp());
    }
    for (let n = 0; n < e; n++) {
      const l = t[n], a = this.Xm[n];
      a.fp() !== l ? a.qp(l) : a.Up();
    }
    this.cb(), this.Pb();
  }
  Ib(t, e, i) {
    var n;
    const l = /* @__PURE__ */ new Map();
    t !== null && this.$i.wt().forEach((p) => {
      const m = p.In().ll(t);
      m !== null && l.set(p, m);
    });
    let a;
    if (t !== null) {
      const p = (n = this.$i.St().Ui(t)) === null || n === void 0 ? void 0 : n.originalTime;
      p !== void 0 && (a = p);
    }
    const c = this.$t().Wc(), u = c !== null && c.Hc instanceof Fu ? c.Hc : void 0, f = c !== null && c.Iv !== void 0 ? c.Iv.gr : void 0;
    return { zb: a, ee: t ?? void 0, Lb: e ?? void 0, Eb: u, Nb: l, Fb: f, Wb: i ?? void 0 };
  }
  Bb(t, e, i) {
    this.Vp.m(() => this.Ib(t, e, i));
  }
  Ab(t, e, i) {
    this.Op.m(() => this.Ib(t, e, i));
  }
  lb(t, e, i) {
    this.Rc.m(() => this.Ib(t, e, i));
  }
  cb() {
    const t = this.cn.timeScale.visible ? "" : "none";
    this.ab.lp().style.display = t;
  }
  xb() {
    return this.Xm[0].fp().R_().W().visible;
  }
  Sb() {
    return this.Xm[0].fp().D_().W().visible;
  }
  ob() {
    return "ResizeObserver" in window && (this.ib = new ResizeObserver((t) => {
      const e = t.find((i) => i.target === this.Jd);
      e && this._b(e.contentRect.width, e.contentRect.height);
    }), this.ib.observe(this.Jd, { box: "border-box" }), true);
  }
  pb() {
    this.ib !== null && this.ib.disconnect(), this.ib = null;
  }
}
function jc(s) {
  return !!(s.handleScroll.mouseWheel || s.handleScale.mouseWheel);
}
function lk(s) {
  return function(t) {
    return t.open !== void 0;
  }(s) || function(t) {
    return t.value !== void 0;
  }(s);
}
function Y0(s, t) {
  var e = {};
  for (var i in s) Object.prototype.hasOwnProperty.call(s, i) && t.indexOf(i) < 0 && (e[i] = s[i]);
  if (s != null && typeof Object.getOwnPropertySymbols == "function") {
    var n = 0;
    for (i = Object.getOwnPropertySymbols(s); n < i.length; n++) t.indexOf(i[n]) < 0 && Object.prototype.propertyIsEnumerable.call(s, i[n]) && (e[i[n]] = s[i[n]]);
  }
  return e;
}
function Kv(s, t, e, i) {
  const n = e.value, l = { ee: t, ot: s, Vt: [n, n, n, n], zb: i };
  return e.color !== void 0 && (l.V = e.color), l;
}
function ok(s, t, e, i) {
  const n = e.value, l = { ee: t, ot: s, Vt: [n, n, n, n], zb: i };
  return e.lineColor !== void 0 && (l.lt = e.lineColor), e.topColor !== void 0 && (l.Ps = e.topColor), e.bottomColor !== void 0 && (l.Rs = e.bottomColor), l;
}
function ak(s, t, e, i) {
  const n = e.value, l = { ee: t, ot: s, Vt: [n, n, n, n], zb: i };
  return e.topLineColor !== void 0 && (l.Re = e.topLineColor), e.bottomLineColor !== void 0 && (l.De = e.bottomLineColor), e.topFillColor1 !== void 0 && (l.ke = e.topFillColor1), e.topFillColor2 !== void 0 && (l.ye = e.topFillColor2), e.bottomFillColor1 !== void 0 && (l.Ce = e.bottomFillColor1), e.bottomFillColor2 !== void 0 && (l.Te = e.bottomFillColor2), l;
}
function rk(s, t, e, i) {
  const n = { ee: t, ot: s, Vt: [e.open, e.high, e.low, e.close], zb: i };
  return e.color !== void 0 && (n.V = e.color), n;
}
function ck(s, t, e, i) {
  const n = { ee: t, ot: s, Vt: [e.open, e.high, e.low, e.close], zb: i };
  return e.color !== void 0 && (n.V = e.color), e.borderColor !== void 0 && (n.Ot = e.borderColor), e.wickColor !== void 0 && (n.Xh = e.wickColor), n;
}
function uk(s, t, e, i, n) {
  const l = ws(n)(e), a = Math.max(...l), c = Math.min(...l), u = l[l.length - 1], f = [u, a, c, u], p = e, { time: m, color: y } = p;
  return { ee: t, ot: s, Vt: f, zb: i, $e: Y0(p, ["time", "color"]), V: y };
}
function Fa(s) {
  return s.Vt !== void 0;
}
function qv(s, t) {
  return t.customValues !== void 0 && (s.jb = t.customValues), s;
}
function Ln(s) {
  return (t, e, i, n, l, a) => function(c, u) {
    return u ? u(c) : (f = c).open === void 0 && f.value === void 0;
    var f;
  }(i, a) ? qv({ ot: t, ee: e, zb: n }, i) : qv(s(t, e, i, n, l), i);
}
function Uv(s) {
  return { Candlestick: Ln(ck), Bar: Ln(rk), Area: Ln(ok), Baseline: Ln(ak), Histogram: Ln(Kv), Line: Ln(Kv), Custom: Ln(uk) }[s];
}
function Jv(s) {
  return { ee: 0, Hb: /* @__PURE__ */ new Map(), la: s };
}
function Xv(s, t) {
  if (s !== void 0 && s.length !== 0) return { $b: t.key(s[0].ot), Ub: t.key(s[s.length - 1].ot) };
}
function Gv(s) {
  let t;
  return s.forEach((e) => {
    t === void 0 && (t = e.zb);
  }), ws(t);
}
class hk {
  constructor(t) {
    this.qb = /* @__PURE__ */ new Map(), this.Yb = /* @__PURE__ */ new Map(), this.Zb = /* @__PURE__ */ new Map(), this.Xb = [], this.q_ = t;
  }
  S() {
    this.qb.clear(), this.Yb.clear(), this.Zb.clear(), this.Xb = [];
  }
  Kb(t, e) {
    let i = this.qb.size !== 0, n = false;
    const l = this.Yb.get(t);
    if (l !== void 0) if (this.Yb.size === 1) i = false, n = true, this.qb.clear();
    else for (const u of this.Xb) u.pointData.Hb.delete(t) && (n = true);
    let a = [];
    if (e.length !== 0) {
      const u = e.map((w) => w.time), f = this.q_.createConverterToInternalObj(e), p = Uv(t.Qh()), m = t.Ca(), y = t.Ta();
      a = e.map((w, S) => {
        const C = f(w.time), O = this.q_.key(C);
        let R = this.qb.get(O);
        R === void 0 && (R = Jv(C), this.qb.set(O, R), n = true);
        const D = p(C, R.ee, w, u[S], m, y);
        return R.Hb.set(t, D), D;
      });
    }
    i && this.Gb(), this.Jb(t, a);
    let c = -1;
    if (n) {
      const u = [];
      this.qb.forEach((f) => {
        u.push({ timeWeight: 0, time: f.la, pointData: f, originalTime: Gv(f.Hb) });
      }), u.sort((f, p) => this.q_.key(f.time) - this.q_.key(p.time)), c = this.Qb(u);
    }
    return this.tw(t, c, function(u, f, p) {
      const m = Xv(u, p), y = Xv(f, p);
      if (m !== void 0 && y !== void 0) return { ta: m.Ub >= y.Ub && m.$b >= y.$b };
    }(this.Yb.get(t), l, this.q_));
  }
  vd(t) {
    return this.Kb(t, []);
  }
  iw(t, e) {
    const i = e;
    (function(C) {
      C.zb === void 0 && (C.zb = C.time);
    })(i), this.q_.preprocessData(e);
    const n = this.q_.createConverterToInternalObj([e])(e.time), l = this.Zb.get(t);
    if (l !== void 0 && this.q_.key(n) < this.q_.key(l)) throw new Error(`Cannot update oldest data, last time=${l}, new time=${n}`);
    let a = this.qb.get(this.q_.key(n));
    const c = a === void 0;
    a === void 0 && (a = Jv(n), this.qb.set(this.q_.key(n), a));
    const u = Uv(t.Qh()), f = t.Ca(), p = t.Ta(), m = u(n, a.ee, e, i.zb, f, p);
    a.Hb.set(t, m), this.nw(t, m);
    const y = { ta: Fa(m) };
    if (!c) return this.tw(t, -1, y);
    const w = { timeWeight: 0, time: a.la, pointData: a, originalTime: Gv(a.Hb) }, S = Bo(this.Xb, this.q_.key(w.time), (C, O) => this.q_.key(C.time) < O);
    this.Xb.splice(S, 0, w);
    for (let C = S; C < this.Xb.length; ++C) Wc(this.Xb[C].pointData, C);
    return this.q_.fillWeightsForPoints(this.Xb, S), this.tw(t, S, y);
  }
  nw(t, e) {
    let i = this.Yb.get(t);
    i === void 0 && (i = [], this.Yb.set(t, i));
    const n = i.length !== 0 ? i[i.length - 1] : null;
    n === null || this.q_.key(e.ot) > this.q_.key(n.ot) ? Fa(e) && i.push(e) : Fa(e) ? i[i.length - 1] = e : i.splice(-1, 1), this.Zb.set(t, e.ot);
  }
  Jb(t, e) {
    e.length !== 0 ? (this.Yb.set(t, e.filter(Fa)), this.Zb.set(t, e[e.length - 1].ot)) : (this.Yb.delete(t), this.Zb.delete(t));
  }
  Gb() {
    for (const t of this.Xb) t.pointData.Hb.size === 0 && this.qb.delete(this.q_.key(t.time));
  }
  Qb(t) {
    let e = -1;
    for (let i = 0; i < this.Xb.length && i < t.length; ++i) {
      const n = this.Xb[i], l = t[i];
      if (this.q_.key(n.time) !== this.q_.key(l.time)) {
        e = i;
        break;
      }
      l.timeWeight = n.timeWeight, Wc(l.pointData, i);
    }
    if (e === -1 && this.Xb.length !== t.length && (e = Math.min(this.Xb.length, t.length)), e === -1) return -1;
    for (let i = e; i < t.length; ++i) Wc(t[i].pointData, i);
    return this.q_.fillWeightsForPoints(t, e), this.Xb = t, e;
  }
  sw() {
    if (this.Yb.size === 0) return null;
    let t = 0;
    return this.Yb.forEach((e) => {
      e.length !== 0 && (t = Math.max(t, e[e.length - 1].ee));
    }), t;
  }
  tw(t, e, i) {
    const n = { ew: /* @__PURE__ */ new Map(), St: { Eu: this.sw() } };
    if (e !== -1) this.Yb.forEach((l, a) => {
      n.ew.set(a, { $e: l, rw: a === t ? i : void 0 });
    }), this.Yb.has(t) || n.ew.set(t, { $e: [], rw: i }), n.St.hw = this.Xb, n.St.lw = e;
    else {
      const l = this.Yb.get(t);
      n.ew.set(t, { $e: l || [], rw: i });
    }
    return n;
  }
}
function Wc(s, t) {
  s.ee = t, s.Hb.forEach((e) => {
    e.ee = t;
  });
}
function Hu(s) {
  const t = { value: s.Vt[3], time: s.zb };
  return s.jb !== void 0 && (t.customValues = s.jb), t;
}
function Qv(s) {
  const t = Hu(s);
  return s.V !== void 0 && (t.color = s.V), t;
}
function dk(s) {
  const t = Hu(s);
  return s.lt !== void 0 && (t.lineColor = s.lt), s.Ps !== void 0 && (t.topColor = s.Ps), s.Rs !== void 0 && (t.bottomColor = s.Rs), t;
}
function fk(s) {
  const t = Hu(s);
  return s.Re !== void 0 && (t.topLineColor = s.Re), s.De !== void 0 && (t.bottomLineColor = s.De), s.ke !== void 0 && (t.topFillColor1 = s.ke), s.ye !== void 0 && (t.topFillColor2 = s.ye), s.Ce !== void 0 && (t.bottomFillColor1 = s.Ce), s.Te !== void 0 && (t.bottomFillColor2 = s.Te), t;
}
function Z0(s) {
  const t = { open: s.Vt[0], high: s.Vt[1], low: s.Vt[2], close: s.Vt[3], time: s.zb };
  return s.jb !== void 0 && (t.customValues = s.jb), t;
}
function vk(s) {
  const t = Z0(s);
  return s.V !== void 0 && (t.color = s.V), t;
}
function pk(s) {
  const t = Z0(s), { V: e, Ot: i, Xh: n } = s;
  return e !== void 0 && (t.color = e), i !== void 0 && (t.borderColor = i), n !== void 0 && (t.wickColor = n), t;
}
function pu(s) {
  return { Area: dk, Line: Qv, Baseline: fk, Histogram: Qv, Bar: vk, Candlestick: pk, Custom: mk }[s];
}
function mk(s) {
  const t = s.zb;
  return Object.assign(Object.assign({}, s.$e), { time: t });
}
const gk = { vertLine: { color: "#9598A1", width: 1, style: 3, visible: true, labelVisible: true, labelBackgroundColor: "#131722" }, horzLine: { color: "#9598A1", width: 1, style: 3, visible: true, labelVisible: true, labelBackgroundColor: "#131722" }, mode: 1 }, bk = { vertLines: { color: "#D6DCDE", style: 0, visible: true }, horzLines: { color: "#D6DCDE", style: 0, visible: true } }, yk = { background: { type: "solid", color: "#FFFFFF" }, textColor: "#191919", fontSize: 12, fontFamily: Du, attributionLogo: true }, Hc = { autoScale: true, mode: 0, invertScale: false, alignLabels: true, borderVisible: true, borderColor: "#2B2B43", entireTextOnly: false, visible: false, ticksVisible: false, scaleMargins: { bottom: 0.1, top: 0.2 }, minimumWidth: 0 }, _k = { rightOffset: 0, barSpacing: 6, minBarSpacing: 0.5, fixLeftEdge: false, fixRightEdge: false, lockVisibleTimeRangeOnResize: false, rightBarStaysOnScroll: false, borderVisible: true, borderColor: "#2B2B43", visible: true, timeVisible: false, secondsVisible: true, shiftVisibleRangeOnNewBar: true, allowShiftVisibleRangeOnWhitespaceReplacement: false, ticksVisible: false, uniformDistribution: false, minimumHeight: 0, allowBoldLabels: true }, wk = { color: "rgba(0, 0, 0, 0)", visible: false, fontSize: 48, fontFamily: Du, fontStyle: "", text: "", horzAlign: "center", vertAlign: "center" };
function Yv() {
  return { width: 0, height: 0, autoSize: false, layout: yk, crosshair: gk, grid: bk, overlayPriceScales: Object.assign({}, Hc), leftPriceScale: Object.assign(Object.assign({}, Hc), { visible: false }), rightPriceScale: Object.assign(Object.assign({}, Hc), { visible: true }), timeScale: _k, watermark: wk, localization: { locale: Cl ? navigator.language : "", dateFormat: "dd MMM 'yy" }, handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true }, handleScale: { axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: { time: true, price: true }, mouseWheel: true, pinch: true }, kineticScroll: { mouse: false, touch: true }, trackingMode: { exitMode: 1 } };
}
class kk {
  constructor(t, e) {
    this.aw = t, this.ow = e;
  }
  applyOptions(t) {
    this.aw.$t().$c(this.ow, t);
  }
  options() {
    return this.Li().W();
  }
  width() {
    return Er(this.ow) ? this.aw.Mb(this.ow) : 0;
  }
  Li() {
    return ut(this.aw.$t().Uc(this.ow)).Dt;
  }
}
function Zv(s, t, e) {
  const i = Y0(s, ["time", "originalTime"]), n = Object.assign({ time: t }, i);
  return e !== void 0 && (n.originalTime = e), n;
}
const Sk = { color: "#FF0000", price: 0, lineStyle: 2, lineWidth: 1, lineVisible: true, axisLabelVisible: true, title: "", axisLabelColor: "", axisLabelTextColor: "" };
class xk {
  constructor(t) {
    this.Nh = t;
  }
  applyOptions(t) {
    this.Nh.$h(t);
  }
  options() {
    return this.Nh.W();
  }
  _w() {
    return this.Nh;
  }
}
class Ck {
  constructor(t, e, i, n, l) {
    this.uw = new Be(), this.Es = t, this.cw = e, this.dw = i, this.q_ = l, this.fw = n;
  }
  S() {
    this.uw.S();
  }
  priceFormatter() {
    return this.Es.ba();
  }
  priceToCoordinate(t) {
    const e = this.Es.Ct();
    return e === null ? null : this.Es.Dt().Rt(t, e.Vt);
  }
  coordinateToPrice(t) {
    const e = this.Es.Ct();
    return e === null ? null : this.Es.Dt().pn(t, e.Vt);
  }
  barsInLogicalRange(t) {
    if (t === null) return null;
    const e = new wl(new yo(t.from, t.to)).lu(), i = this.Es.In();
    if (i.Ni()) return null;
    const n = i.ll(e.Os(), 1), l = i.ll(e.ui(), -1), a = ut(i.el()), c = ut(i.An());
    if (n !== null && l !== null && n.ee > l.ee) return { barsBefore: t.from - a, barsAfter: c - t.to };
    const u = { barsBefore: n === null || n.ee === a ? t.from - a : n.ee - a, barsAfter: l === null || l.ee === c ? c - t.to : c - l.ee };
    return n !== null && l !== null && (u.from = n.zb, u.to = l.zb), u;
  }
  setData(t) {
    this.q_, this.Es.Qh(), this.cw.pw(this.Es, t), this.mw("full");
  }
  update(t) {
    this.Es.Qh(), this.cw.bw(this.Es, t), this.mw("update");
  }
  dataByIndex(t, e) {
    const i = this.Es.In().ll(t, e);
    return i === null ? null : pu(this.seriesType())(i);
  }
  data() {
    const t = pu(this.seriesType());
    return this.Es.In().ne().map((e) => t(e));
  }
  subscribeDataChanged(t) {
    this.uw.l(t);
  }
  unsubscribeDataChanged(t) {
    this.uw.v(t);
  }
  setMarkers(t) {
    this.q_;
    const e = t.map((i) => Zv(i, this.q_.convertHorzItemToInternal(i.time), i.time));
    this.Es.na(e);
  }
  markers() {
    return this.Es.sa().map((t) => Zv(t, t.originalTime, void 0));
  }
  applyOptions(t) {
    this.Es.$h(t);
  }
  options() {
    return Fi(this.Es.W());
  }
  priceScale() {
    return this.dw.priceScale(this.Es.Dt().Pa());
  }
  createPriceLine(t) {
    const e = ri(Fi(Sk), t), i = this.Es.ea(e);
    return new xk(i);
  }
  removePriceLine(t) {
    this.Es.ra(t._w());
  }
  seriesType() {
    return this.Es.Qh();
  }
  attachPrimitive(t) {
    this.Es.ka(t), t.attached && t.attached({ chart: this.fw, series: this, requestUpdate: () => this.Es.$t().Kl() });
  }
  detachPrimitive(t) {
    this.Es.ya(t), t.detached && t.detached();
  }
  mw(t) {
    this.uw.M() && this.uw.m(t);
  }
}
class Mk {
  constructor(t, e, i) {
    this.ww = new Be(), this.mu = new Be(), this.Om = new Be(), this.$i = t, this.yl = t.St(), this.ab = e, this.yl.nc().l(this.gw.bind(this)), this.yl.sc().l(this.Mw.bind(this)), this.ab.Nm().l(this.xw.bind(this)), this.q_ = i;
  }
  S() {
    this.yl.nc().p(this), this.yl.sc().p(this), this.ab.Nm().p(this), this.ww.S(), this.mu.S(), this.Om.S();
  }
  scrollPosition() {
    return this.yl.Hu();
  }
  scrollToPosition(t, e) {
    e ? this.yl.Ju(t, 1e3) : this.$i.Jn(t);
  }
  scrollToRealTime() {
    this.yl.Gu();
  }
  getVisibleRange() {
    const t = this.yl.Vu();
    return t === null ? null : { from: t.from.originalTime, to: t.to.originalTime };
  }
  setVisibleRange(t) {
    const e = { from: this.q_.convertHorzItemToInternal(t.from), to: this.q_.convertHorzItemToInternal(t.to) }, i = this.yl.Iu(e);
    this.$i.pd(i);
  }
  getVisibleLogicalRange() {
    const t = this.yl.Du();
    return t === null ? null : { from: t.Os(), to: t.ui() };
  }
  setVisibleLogicalRange(t) {
    hn(t.from <= t.to, "The from index cannot be after the to index."), this.$i.pd(t);
  }
  resetTimeScale() {
    this.$i.Kn();
  }
  fitContent() {
    this.$i.hc();
  }
  logicalToCoordinate(t) {
    const e = this.$i.St();
    return e.Ni() ? null : e.It(t);
  }
  coordinateToLogical(t) {
    return this.yl.Ni() ? null : this.yl.Nu(t);
  }
  timeToCoordinate(t) {
    const e = this.q_.convertHorzItemToInternal(t), i = this.yl.Va(e, false);
    return i === null ? null : this.yl.It(i);
  }
  coordinateToTime(t) {
    const e = this.$i.St(), i = e.Nu(t), n = e.Ui(i);
    return n === null ? null : n.originalTime;
  }
  width() {
    return this.ab.um().width;
  }
  height() {
    return this.ab.um().height;
  }
  subscribeVisibleTimeRangeChange(t) {
    this.ww.l(t);
  }
  unsubscribeVisibleTimeRangeChange(t) {
    this.ww.v(t);
  }
  subscribeVisibleLogicalRangeChange(t) {
    this.mu.l(t);
  }
  unsubscribeVisibleLogicalRangeChange(t) {
    this.mu.v(t);
  }
  subscribeSizeChange(t) {
    this.Om.l(t);
  }
  unsubscribeSizeChange(t) {
    this.Om.v(t);
  }
  applyOptions(t) {
    this.yl.$h(t);
  }
  options() {
    return Object.assign(Object.assign({}, Fi(this.yl.W())), { barSpacing: this.yl.le() });
  }
  gw() {
    this.ww.M() && this.ww.m(this.getVisibleRange());
  }
  Mw() {
    this.mu.M() && this.mu.m(this.getVisibleLogicalRange());
  }
  xw(t) {
    this.Om.m(t.width, t.height);
  }
}
function $k(s) {
  if (s === void 0 || s.type === "custom") return;
  const t = s;
  t.minMove !== void 0 && t.precision === void 0 && (t.precision = function(e) {
    if (e >= 1) return 0;
    let i = 0;
    for (; i < 8; i++) {
      const n = Math.round(e);
      if (Math.abs(n - e) < 1e-8) return i;
      e *= 10;
    }
    return i;
  }(t.minMove));
}
function tp(s) {
  return function(t) {
    if (Ra(t.handleScale)) {
      const i = t.handleScale;
      t.handleScale = { axisDoubleClickReset: { time: i, price: i }, axisPressedMouseMove: { time: i, price: i }, mouseWheel: i, pinch: i };
    } else if (t.handleScale !== void 0) {
      const { axisPressedMouseMove: i, axisDoubleClickReset: n } = t.handleScale;
      Ra(i) && (t.handleScale.axisPressedMouseMove = { time: i, price: i }), Ra(n) && (t.handleScale.axisDoubleClickReset = { time: n, price: n });
    }
    const e = t.handleScroll;
    Ra(e) && (t.handleScroll = { horzTouchDrag: e, vertTouchDrag: e, mouseWheel: e, pressedMouseMove: e });
  }(s), s;
}
class Tk {
  constructor(t, e, i) {
    this.Sw = /* @__PURE__ */ new Map(), this.kw = /* @__PURE__ */ new Map(), this.yw = new Be(), this.Cw = new Be(), this.Tw = new Be(), this.Pw = new hk(e);
    const n = i === void 0 ? Fi(Yv()) : ri(Fi(Yv()), tp(i));
    this.q_ = e, this.aw = new nk(t, n, e), this.aw.lm().l((a) => {
      this.yw.M() && this.yw.m(this.Rw(a()));
    }, this), this.aw.am().l((a) => {
      this.Cw.M() && this.Cw.m(this.Rw(a()));
    }, this), this.aw.Xc().l((a) => {
      this.Tw.M() && this.Tw.m(this.Rw(a()));
    }, this);
    const l = this.aw.$t();
    this.Dw = new Mk(l, this.aw.fb(), this.q_);
  }
  remove() {
    this.aw.lm().p(this), this.aw.am().p(this), this.aw.Xc().p(this), this.Dw.S(), this.aw.S(), this.Sw.clear(), this.kw.clear(), this.yw.S(), this.Cw.S(), this.Tw.S(), this.Pw.S();
  }
  resize(t, e, i) {
    this.autoSizeActive() || this.aw._b(t, e, i);
  }
  addCustomSeries(t, e) {
    const i = pl(t), n = Object.assign(Object.assign({}, T0), i.defaultOptions());
    return this.Vw("Custom", n, e, i);
  }
  addAreaSeries(t) {
    return this.Vw("Area", hw, t);
  }
  addBaselineSeries(t) {
    return this.Vw("Baseline", dw, t);
  }
  addBarSeries(t) {
    return this.Vw("Bar", cw, t);
  }
  addCandlestickSeries(t = {}) {
    return function(e) {
      e.borderColor !== void 0 && (e.borderUpColor = e.borderColor, e.borderDownColor = e.borderColor), e.wickColor !== void 0 && (e.wickUpColor = e.wickColor, e.wickDownColor = e.wickColor);
    }(t), this.Vw("Candlestick", rw, t);
  }
  addHistogramSeries(t) {
    return this.Vw("Histogram", fw, t);
  }
  addLineSeries(t) {
    return this.Vw("Line", uw, t);
  }
  removeSeries(t) {
    const e = ws(this.Sw.get(t)), i = this.Pw.vd(e);
    this.aw.$t().vd(e), this.Ow(i), this.Sw.delete(t), this.kw.delete(e);
  }
  pw(t, e) {
    this.Ow(this.Pw.Kb(t, e));
  }
  bw(t, e) {
    this.Ow(this.Pw.iw(t, e));
  }
  subscribeClick(t) {
    this.yw.l(t);
  }
  unsubscribeClick(t) {
    this.yw.v(t);
  }
  subscribeCrosshairMove(t) {
    this.Tw.l(t);
  }
  unsubscribeCrosshairMove(t) {
    this.Tw.v(t);
  }
  subscribeDblClick(t) {
    this.Cw.l(t);
  }
  unsubscribeDblClick(t) {
    this.Cw.v(t);
  }
  priceScale(t) {
    return new kk(this.aw, t);
  }
  timeScale() {
    return this.Dw;
  }
  applyOptions(t) {
    this.aw.$h(tp(t));
  }
  options() {
    return this.aw.W();
  }
  takeScreenshot() {
    return this.aw.wb();
  }
  autoSizeActive() {
    return this.aw.kb();
  }
  chartElement() {
    return this.aw.yb();
  }
  paneSize() {
    const t = this.aw.Tb();
    return { height: t.height, width: t.width };
  }
  setCrosshairPosition(t, e, i) {
    const n = this.Sw.get(i);
    if (n === void 0) return;
    const l = this.aw.$t().dr(n);
    l !== null && this.aw.$t().ad(t, e, l);
  }
  clearCrosshairPosition() {
    this.aw.$t().od(true);
  }
  Vw(t, e, i = {}, n) {
    $k(i.priceFormat);
    const l = ri(Fi(E0), Fi(e), i), a = this.aw.$t().dd(t, l, n), c = new Ck(a, this, this, this, this.q_);
    return this.Sw.set(c, a), this.kw.set(a, c), c;
  }
  Ow(t) {
    const e = this.aw.$t();
    e._d(t.St.Eu, t.St.hw, t.St.lw), t.ew.forEach((i, n) => n.J(i.$e, i.rw)), e.Wu();
  }
  Bw(t) {
    return ws(this.kw.get(t));
  }
  Rw(t) {
    const e = /* @__PURE__ */ new Map();
    t.Nb.forEach((n, l) => {
      const a = l.Qh(), c = pu(a)(n);
      if (a !== "Custom") hn(lk(c));
      else {
        const u = l.Ta();
        hn(!u || u(c) === false);
      }
      e.set(this.Bw(l), c);
    });
    const i = t.Eb !== void 0 && this.kw.has(t.Eb) ? this.Bw(t.Eb) : void 0;
    return { time: t.zb, logical: t.ee, point: t.Lb, hoveredSeries: i, hoveredObjectId: t.Fb, seriesData: e, sourceEvent: t.Wb };
  }
}
function Ek(s, t, e) {
  let i;
  if (Vo(s)) {
    const l = document.getElementById(s);
    hn(l !== null, `Cannot find element in DOM with id=${s}`), i = l;
  } else i = s;
  const n = new Tk(i, t, e);
  return t.setOptions(n.options()), n;
}
function ep(s, t) {
  return Ek(s, new Fv(), Fv.Id(t));
}
Object.assign(Object.assign({}, E0), T0);
const Rk = { key: 0, class: "kchart-fsbar" }, zk = { class: "fs-title" }, Lk = { class: "fs-rotate" }, Dk = { class: "ktabs" }, Pk = ["onClick"], Ok = ["title"], Ak = { key: 0, class: "kc-loading" }, Nk = { key: 1, class: "kzoom" }, Ik = { key: 2, class: "ksub-tabs" }, Fk = ["onClick"], Vk = { key: 3, class: "kohlc" }, Bk = { class: "kohlc-time" }, jk = { style: { color: "#f85149" } }, Wk = { style: { color: "#3fb950" } }, Hk = { style: { "margin-left": "auto" } }, Kk = { key: 4, class: "klegend" }, qk = { style: { color: "#58a6ff" } }, Uk = { style: { color: "#8b949e", "margin-left": "auto" } }, Jk = { key: 5, class: "klegend" }, Xk = { style: { color: "#f0c929" } }, Gk = { style: { color: "#58a6ff" } }, Qk = { key: 6, class: "beh-bar" }, Yk = ["title"], Va = 5, Zk = { 