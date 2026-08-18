// ===== v55 Rs 完整版 =====
function Rs(s, t = "swing") {
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
function zs(s, t, e = "swing") {
  if (s.length < 20) return { verdict: "\u6570\u636E\u4E0D\u8DB3", score: 0, summary: "\u6570\u636E\u4E0D\u8DB320\u4E2A\u4EA4\u6613\u65E5" };
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
  u > f && f > p && (m == null || p > m) ? ht = "\u591A\u5934\u6392\u5217" : u < f && f < p && (m == null || p < m) ? ht = "\u7A7A\u5934\u6392\u5217" : ht = "\u5747\u7EBF\u4EA4\u7EC7";
  let ct = 0;
  const Bt = [];
  n > p ? (ct += 2, Bt.push("\u4EF7\u683C\u7AD9\u4E0AMA20\uFF0C\u4E2D\u671F\u8D8B\u52BF\u504F\u591A")) : (ct -= 2, Bt.push("\u4EF7\u683C\u8DCC\u7834MA20\uFF0C\u4E2D\u671F\u8D8B\u52BF\u504F\u7A7A")), ht === "\u591A\u5934\u6392\u5217" ? (ct += 2, Bt.push("\u5747\u7EBF\u591A\u5934\u6392\u5217\uFF0C\u4E0A\u6DA8\u7ED3\u6784\u5B8C\u6574")) : ht === "\u7A7A\u5934\u6392\u5217" && (ct -= 2, Bt.push("\u5747\u7EBF\u7A7A\u5934\u6392\u5217\uFF0C\u4E0B\u8DCC\u7ED3\u6784\u538B\u5236")), w != null && S != null && (w > S && O > 0 ? (ct += 1, Bt.push("MACD\u91D1\u53C9\u8FD0\u884C\u4E2D\uFF0C\u591A\u65B9\u52A8\u80FD\u5360\u4F18")) : w < S && O < 0 && (ct -= 1, Bt.push("MACD\u6B7B\u53C9\u8FD0\u884C\u4E2D\uFF0C\u7A7A\u65B9\u52A8\u80FD\u5360\u4F18")), R != null && O > R && O > 0 ? (ct += 1, Bt.push("MACD\u7EA2\u67F1\u653E\u5927\uFF0C\u4E0A\u6DA8\u52A8\u80FD\u589E\u5F3A")) : R != null && O < R && O < 0 ? (ct -= 1, Bt.push("MACD\u7EFF\u67F1\u653E\u5927\uFF0C\u4E0B\u8DCC\u52A8\u80FD\u589E\u5F3A")) : R != null && O > R && O < 0 && (ct += 1, Bt.push("MACD\u7EFF\u67F1\u7F29\u77ED\uFF0C\u4E0B\u8DCC\u52A8\u80FD\u51CF\u5F31"))), Tt != null && (Tt > qt ? (ct -= 1, Bt.push(`RSI=${Tt}\u8FDB\u5165\u8D85\u4E70\u533A\uFF0C\u77ED\u7EBF\u56DE\u8C03\u98CE\u9669`)) : Tt < Xt ? (ct += 1, Bt.push(`RSI=${Tt}\u8FDB\u5165\u8D85\u5356\u533A\uFF0C\u77ED\u7EBF\u53CD\u5F39\u673A\u4F1A`)) : Tt > 50 && (ct += 0, Bt.push(`RSI=${Tt}\uFF0C\u591A\u65B9\u7565\u5360\u4F18\u52BF`))), $ != null && I != null && ($ > I && U < 80 ? (ct += 1, Bt.push("KDJ\u91D1\u53C9\u5411\u4E0A\uFF0C\u77ED\u7EBF\u52A8\u80FD\u826F\u597D")) : $ < I && (ct -= 1, Bt.push("KDJ\u6B7B\u53C9\u5411\u4E0B\uFF0C\u77ED\u7EBF\u504F\u5F31")), U > X ? (ct -= 1, Bt.push(`KDJ\u7684J\u503C>${X}\uFF0C\u77ED\u7EBF\u4E25\u91CD\u8D85\u4E70`)) : U < 0 && (ct += 1, Bt.push("KDJ\u7684J\u503C<0\uFF0C\u77ED\u7EBF\u4E25\u91CD\u8D85\u5356"))), tt != null && nt != null && (n > tt ? (ct -= 1, Bt.push("\u4EF7\u683C\u7A81\u7834\u5E03\u6797\u4E0A\u8F68\uFF0C\u77ED\u7EBF\u8FC7\u70ED")) : n < nt && (ct += 1, Bt.push("\u4EF7\u683C\u8DCC\u7834\u5E03\u6797\u4E0B\u8F68\uFF0C\u77ED\u7EBF\u8D85\u8DCC"))), W != null && (W > 1.5 && l > 0 ? (ct += 1, Bt.push(`\u8FD15\u65E5\u653E\u91CF\u4E0A\u6DA8\uFF08\u91CF\u6BD4${W}\uFF09\uFF0C\u8D44\u91D1\u4ECB\u5165\u660E\u663E`)) : W > 1.5 && l < 0 ? (ct -= 1, Bt.push(`\u8FD15\u65E5\u653E\u91CF\u4E0B\u8DCC\uFF08\u91CF\u6BD4${W}\uFF09\uFF0C\u8D44\u91D1\u51FA\u9003\u8B66\u60D5`)) : W < 0.6 && Bt.push(`\u7F29\u91CF\u8FD0\u884C\uFF08\u91CF\u6BD4${W}\uFF09\uFF0C\u89C2\u671B\u60C5\u7EEA\u6D53`)), l > yt ? (ct -= 1, Bt.push(`\u8FD15\u65E5\u6DA8\u5E45${l.toFixed(1)}%\u8FC7\u5927\uFF0C\u8FFD\u9AD8\u98CE\u9669`)) : l < -15 && (ct += 1, Bt.push(`\u8FD15\u65E5\u8DCC\u5E45${l.toFixed(1)}%\u8FC7\u5927\uFF0C\u8D85\u8DCC\u53CD\u5F39\u53EF\u80FD`)), ct = Math.max(-10, Math.min(10, ct));
  let ue, he;
  ct >= 6 ? (ue = "\u5F3A\u52BF\u770B\u591A", he = "bull") : ct >= 3 ? (ue = "\u504F\u591A", he = "bull") : ct >= -2 ? (ue = "\u9707\u8361\u89C2\u671B", he = "mid") : ct >= -5 ? (ue = "\u504F\u7A7A", he = "bear") : (ue = "\u5F31\u52BF\u770B\u7A7A", he = "bear");
  const Se = s.slice(-60), Ie = Math.min(...Se.map((Ut) => Ut.low)), Ke = Math.max(...Se.map((Ut) => Ut.high)), ye = `\u7EFC\u5408\u8BC4\u5206${ct}/10\uFF0C${ue}\u3002\u8FD15\u65E5${l >= 0 ? "\u6DA8" : "\u8DCC"}${Math.abs(l).toFixed(1)}%\uFF0C\u8FD120\u65E5${a >= 0 ? "\u6DA8" : "\u8DCC"}${Math.abs(a).toFixed(1)}%\uFF1B${ht}${y != null ? `\uFF0C\u5E74\u7EBFMA250=${y}` : ""}\uFF1B\u5173\u952E\u652F\u6491${Ie.toFixed(2)}\u3001\u538B\u529B${Ke.toFixed(2)}\u3002`;
  return { verdict: ue, tone: he, score: ct, chg_5d: +l.toFixed(2), chg_20d: +a.toFixed(2), ma_status: ht, ma250: y, rsi: D, kdj_j: U, vol_ratio: W, boll_pos: tt != null ? n < dt ? "\u4E0B\u8F68" : n > dt ? "\u4E0A\u8F68" : "\u4E2D\u8F68" : null, support: +Ie.toFixed(2), resistance: +Ke.toFixed(2), signals: Bt, summary: ye };
}

// ===== v55 vl 完整版 =====
function vl(s) {
  if (!s || s.length < 40) return null;
  const t = s.length, e = s.map((V) => V.high), i = s.map((V) => V.low), l = s.map((V) => V.close)[t - 1], a = [], c = [];
  for (let V = 3; V < t - 3; V++) {
    let A = true, X = true;
    for (let yt = V - 3; yt <= V + 3; yt++) yt !== V && (e[yt] >= e[V] && (A = false), i[yt] <= i[V] && (X = false));
    A && a.push({ idx: V, price: e[V] }), X && c.push({ idx: V, price: i[V] });
  }
  const u = a.slice(-2), f = c.slice(-2);
  let p = "range", m = "\u9707\u8361\u7ED3\u6784\uFF1A\u9AD8\u4F4E\u70B9\u4E92\u6709\u9AD8\u4F4E\uFF0C\u65B9\u5411\u672A\u660E";
  if (u.length >= 2 && f.length >= 2) {
    const V = u[1].price > u[0].price, A = f[1].price > f[0].price;
    V && A ? (p = "up", m = "\u4E0A\u5347\u7ED3\u6784\uFF1A\u9AD8\u70B9\u4F4E\u70B9\u6301\u7EED\u62AC\u5347\uFF0C\u591A\u5934\u5360\u4F18") : !V && !A && (p = "down", m = "\u4E0B\u964D\u7ED3\u6784\uFF1A\u9AD8\u70B9\u4F4E\u70B9\u6301\u7EED\u8D70\u4F4E\uFF0C\u7A7A\u5934\u5360\u4F18");
  }
  const y = a.filter((V) => V.idx >= t - 250), w = c.filter((V) => V.idx >= t - 250), S = [...new Set(w.map((V) => V.price).filter((V) => V < l && (l - V) / l < 0.25))].sort((V, A) => A - V).slice(0, 2), C = [...new Set(y.map((V) => V.price).filter((V) => V > l && (V - l) / l < 0.25))].sort((V, A) => V - A).slice(0, 2), O = s.slice(-60), R = Math.max(...O.map((V) => V.high)), D = Math.min(...O.map((V) => V.low)), N = R > l && (R - l) / l < 0.03, $ = D < l && (l - D) / l < 0.03;
  let I = "";
  N && $ ? I = `\u4E0A\u65B9 ${R.toFixed(2)} \u4E0E\u4E0B\u65B9 ${D.toFixed(2)} \u90FD\u6709\u6B62\u635F\u6C60\uFF0C\u6CE8\u610F\u53CC\u5411\u5047\u7A81\u7834` : N ? I = `\u4E0A\u65B9 ${R.toFixed(2)} \u6709\u6B62\u635F\u6C60\uFF08\u524D\u9AD8\uFF09\uFF0C\u7A81\u7834\u8C28\u9632\u5047\u7A81\u7834` : $ && (I = `\u4E0B\u65B9 ${D.toFixed(2)} \u6709\u6B62\u635F\u6C60\uFF08\u524D\u4F4E\uFF09\uFF0C\u8DCC\u7834\u8C28\u9632\u5047\u8DCC\u7834`);
  const U = [], tt = s.slice(-20);
  for (let V = 1; V < tt.length; V++) {
    const A = tt[V], X = tt[V - 1], yt = Math.abs(A.close - A.open), Tt = A.high - Math.max(A.open, A.close), qt = Math.min(A.open, A.close) - A.low;
    if (yt > 0 && qt >= 2 * yt && Tt <= yt) {
      const Xt = p === "down";
      U.push({ type: "hammer", dir: Xt ? "bullish" : "bearish", text: Xt ? "\u9524\u5B50\u7EBF\uFF08\u957F\u4E0B\u5F71\uFF09\uFF1A\u4E0B\u8DCC\u540E\u89C1\u5E95\u4FE1\u53F7\uFF0C\u4E0B\u65B9\u6709\u627F\u63A5" : "\u4E0A\u540A\u7EBF\uFF08\u957F\u4E0B\u5F71\uFF09\uFF1A\u4E0A\u6DA8\u540E\u51FA\u73B0\uFF0C\u8B66\u60D5\u89C1\u9876" });
    }
    yt > 0 && Tt >= 2 * yt && qt <= yt && U.push({ type: "shooting_star", dir: "bearish", text: "\u5C04\u51FB\u4E4B\u661F\uFF08\u957F\u4E0A\u5F71\uFF09\uFF1A\u4E0A\u65B9\u629B\u538B\u91CD\uFF0C\u89C1\u9876\u4FE1\u53F7" }), A.close > A.open && X.close < X.open && A.close >= X.open && A.open <= X.close && U.push({ type: "engulfing", dir: "bullish", text: "\u770B\u6DA8\u541E\u6CA1\uFF1A\u9633\u7EBF\u541E\u6389\u524D\u9634\u7EBF\uFF0C\u591A\u5934\u53CD\u653B" }), A.close < A.open && X.close > X.open && A.close <= X.open && A.open >= X.close && U.push({ type: "engulfing", dir: "bearish", text: "\u770B\u8DCC\u541E\u6CA1\uFF1A\u9634\u7EBF\u541E\u6389\u524D\u9633\u7EBF\uFF0C\u7A7A\u5934\u538B\u5236" }), A.high <= X.high && A.low >= X.low && yt > 0 && U.push({ type: "inside", dir: "neutral", text: "\u5185\u5305\u7EBF\uFF1A\u6CE2\u52A8\u6536\u7A84\uFF0C\u915D\u917F\u65B9\u5411\u9009\u62E9" });
  }
  const dt = s.slice(-40), nt = [];
  for (let V = 2; V < dt.length; V++) {
    const A = dt[V], X = dt[V - 1], yt = dt[V - 2];
    A.close > A.open && X.close < X.open && yt.close < yt.open && nt.push({ price: A.low, dir: "bullish", text: `\u770B\u6DA8\u8BA2\u5355\u5757 ${A.low.toFixed(2)}\uFF1A\u4E0B\u8DCC\u540E\u673A\u6784\u5EFA\u4ED3\u533A\uFF0C\u56DE\u8E29\u662F\u5173\u6CE8\u4F4D` }), A.close < A.open && X.close > X.open && yt.close > yt.open && nt.push({ price: A.high, dir: "bearish", text: `\u770B\u8DCC\u8BA2\u5355\u5757 ${A.high.toFixed(2)}\uFF1A\u4E0A\u6DA8\u540E\u673A\u6784\u51FA\u8D27\u533A\uFF0C\u53CD\u5F39\u662F\u538B\u529B` });
  }
  const W = [];
  for (let V = 2; V < dt.length; V++) {
    const A = dt[V], X = dt[V - 2];
    A.low > X.high && W.push({ price: (A.low + X.high) / 2, dir: "bullish", text: `\u770B\u6DA8\u7F3A\u53E3\uFF08FVG\uFF09${X.high.toFixed(2)}~${A.low.toFixed(2)}\uFF0C\u4EF7\u683C\u503E\u5411\u56DE\u8865` }), A.high < X.low && W.push({ price: (A.high + X.low) / 2, dir: "bearish", text: `\u770B\u8DCC\u7F3A\u53E3\uFF08FVG\uFF09${A.high.toFixed(2)}~${X.low.toFixed(2)}\uFF0C\u53CD\u5F39\u6709\u538B\u529B` });
  }
  return { structure: p, structureText: m, supports: S.slice(0, 2), resistances: C.slice(0, 2), liquidityText: I, signals: U.slice(-4), orderBlocks: nt.slice(-3), fvgs: W.slice(-2), levels: [...S.slice(0, 2).map((V) => ({ price: V, type: "support" })), ...C.slice(0, 2).map((V) => ({ price: V, type: "resistance" }))] };
}
