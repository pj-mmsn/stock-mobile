<template>
  <div class="app">
    <transition name="page-fade">
      <!-- ================= 主页 ================= -->
      <div v-if="view === 'home'" class="home">
        <header class="hdr">
          <div class="logo">📈 手机看盘 <span class="ver-tag">{{ ver }}</span></div>
          <button class="set-btn bell" :class="{ on: alerts.filter(a => !a.triggered).length }" @click="showAlerts = true">🔔</button>
          <button class="set-btn" @click="showSettings = true">⚙️</button>
        </header>

        <!-- 预警弹层 -->
        <div v-if="showAlerts" class="modal-overlay" @click.self="showAlerts = false">
          <div class="modal sheet alerts-modal">
            <div class="modal-title">🔔 价格预警 <span class="sec-sub">{{ alerts.filter(a => !a.triggered).length }} 个活跃</span></div>
            <div class="alert-add">
              <input v-model="alertForm.code" class="aa-input" placeholder="代码(如600519)" />
              <input v-model="alertForm.price" class="aa-input" placeholder="目标价" type="number" step="0.01" />
              <select v-model="alertForm.dir" class="aa-sel">
                <option value="above">涨到</option><option value="below">跌到</option>
              </select>
              <button class="aa-btn" @click="addAlert">+</button>
            </div>
            <div v-if="alerts.length" class="alert-list">
              <div v-for="a in alerts" :key="a.id" class="al-item" :class="{ triggered: a.triggered }">
                <span>{{ a.name || a.code }}</span>
                <span :class="a.dir === 'above' ? 'up' : 'down'">{{ a.dir === 'above' ? '涨到' : '跌到' }} {{ fmtNum(a.price) }}</span>
                <span class="al-status">{{ a.triggered ? '✅' : '等待' }}</span>
                <button class="al-del" @click="delAlert(a.id)">×</button>
              </div>
            </div>
            <div v-else class="empty" style="padding:12px">暂无预警</div>
            <button class="btn-ok" @click="showAlerts = false">关闭</button>
          </div>
        </div>

        <!-- 搜索 -->
        <div class="search-box">
          <input v-model="kw" placeholder="搜索代码/名称" @input="onSearch" @keyup.enter="goFirst" />
          <div v-if="searchResults.length" class="search-results">
            <div v-for="r in searchResults" :key="r.secid" class="sr-item" @click="openStock(r)">
              <span class="sr-name">{{ r.name }}</span><span class="sr-code">{{ r.code }}</span><span class="sr-type">{{ r.type }}</span>
            </div>
          </div>
        </div>

        <!-- 市场温度 -->
        <div class="fund-temp">
          <div class="ft-main">
            <span class="fb-note" v-if="marketTemp?.note">{{ marketTemp.note }}</span>
            <span class="ft-tip">{{ tempText }}</span>
          </div>
        </div>

        <!-- 指数条 -->
        <div class="market-strip">
          <div class="ms-row">
            <div class="ms-item"><span>沪</span><span :class="['ms-num', indices.sh >= 0 ? 'up' : 'down']">{{ fmtPct(indices.sh) }}</span></div>
            <div class="ms-item"><span>深</span><span :class="['ms-num', indices.sz >= 0 ? 'up' : 'down']">{{ fmtPct(indices.sz) }}</span></div>
            <div class="ms-item"><span>恒</span><span :class="['ms-num', indices.hk >= 0 ? 'up' : 'down']">{{ fmtPct(indices.hk) }}</span></div>
            <div class="ms-item"><span class="ms-bar">{{ marketText }}</span></div>
          </div>
        </div>

        <!-- 板块条 -->
        <div class="sector-strip">
          <div class="sector-scroll">
            <span v-for="s in sectors" :key="s.name" class="s-name" @click="goSector(s)">{{ s.name }} {{ s.count ? s.count + '家' : '' }}</span>
          </div>
        </div>

        <!-- 温度条 -->
        <div class="temp-bar">
          <span class="tb-item"><span class="up">{{ marketTemp?.up ?? marketStats.up }}涨</span></span>
          <span class="tb-item"><span class="down">{{ marketTemp?.down ?? marketStats.down }}跌</span></span>
          <span class="tb-item">{{ marketTemp?.north != null ? '北向 ' + fmtMoney(marketTemp.north) : '' }}</span>
          <span class="tb-item">{{ ztInfo }}</span>
        </div>

        <!-- 自选预警 -->
        <div v-for="w in watchAlerts" :key="w.code" class="watch-alert" @click="openStock(w)">
          <span class="wa-icon">🔥</span><span class="wa-name">{{ w.name }}</span><span class="wa-reason">{{ w.reason }}</span>
        </div>

        <!-- 分类 tab -->
        <div class="cat-tabs">
          <span v-for="c in cats" :key="c.key" :class="['ct', { on: st === c.key }]" @click="switchCat(c.key)">{{ c.label }}</span>
        </div>

        <!-- 列表（排序/筛选条） -->
        <div v-if="st !== 'zt' && st !== 'hold' && st !== 'lhb' && st !== 'fund'" class="filter-bar">
          <div class="fb-row">
            <span class="fb-label">排序</span>
            <span v-for="s in sortOpts" :key="s.key" :class="['fb-chip', { on: !metricCount && sortKey === s.key }]" @click="setSort(s.key)">{{ s.label }}</span>
          </div>
          <div class="fb-row">
            <span class="fb-label">筛选</span>
            <span v-for="f in filterOpts" :key="f.key" :class="['fb-chip', { on: chgFilter === f.key }]" @click="setChg(f.key)">{{ f.label }}</span>
            <span :class="['fb-chip metric', { on: metricCount }]" @click="showMetric = true">⚙ 指标</span>
          </div>
          <div v-if="st === 'stock'" class="fb-row">
            <span class="fb-label">RSI</span>
            <span :class="['fb-chip', { on: rsiFilter === '' }]" @click="setRsi('')">全部</span>
            <span :class="['fb-chip', { on: rsiFilter === 'os' }]" @click="setRsi('os')">超卖&lt;30</span>
            <span :class="['fb-chip', { on: rsiFilter === 'ob' }]" @click="setRsi('ob')">超买&gt;80</span>
            <span :class="['fb-chip', { on: rsiFilter === 'mid' }]" @click="setRsi('mid')">中位30-60</span>
          </div>
          <div v-if="st === 'stock'" class="fb-row">
            <span class="fb-label">板块</span>
            <span v-for="b in boardOpts" :key="b.key" :class="['fb-chip', { on: boardFilter === b.key }]" @click="setBoard(b.key)">{{ b.label }}</span>
          </div>
        </div>

        <!-- 列表内容 -->
        <div ref="listRef" class="list-scroll" @scroll="onListScroll">
          <div v-for="it in listItems" :key="it.secid || it.code" class="row-item" @click="openStock(it)">
            <div class="row-main">
              <div class="row-name">{{ it.name }} <span v-if="boardTag(it)" class="row-board">{{ boardTag(it).board }}</span></div>
              <div class="row-code">{{ (it.secid || it.code || '').split('.')[1] || it.code }}</div>
              <div v-if="it.price != null" class="row-price"><span :class="it.change_pct >= 0 ? 'up' : 'down'">{{ it.price.toFixed(2) }} {{ fmtPct(it.change_pct) }}</span></div>
            </div>
            <div class="row-metrics">
              <span v-if="it.score != null" class="rs-score" :class="scoreCls(it.score)">{{ it.score }}</span>
              <span v-if="it.main_flow != null" class="row-flow" :class="it.main_flow >= 0 ? 'up' : 'down'">{{ fmtMoney(it.main_flow) }}</span>
            </div>
          </div>
          <div v-if="loadingList" class="list-loading">⏳ 加载中...</div>
        </div>

        <!-- 涨停池 -->
        <div v-if="st === 'zt'" class="zt-page">
          <div class="zt-tabs">
            <span :class="{ on: ztTab === 'zt' }" @click="ztTab = 'zt'">🔥 涨停池 ({{ ztPool?.total || 0 }})</span>
            <span :class="{ on: ztTab === 'zb' }" @click="ztTab = 'zb'">💥 炸板池 ({{ zbPool?.total || 0 }})</span>
            <span :class="{ on: st === 'lhb' }" @click="st = 'lhb'; loadLhb()">🐉 龙虎榜</span>
            <span :class="{ on: st === 'fund' }" @click="st = 'fund'; loadFund()">💰 资金</span>
          </div>
          <div v-if="ztPool?.updated" class="zt-updated">🕐 更新于 {{ ztPool.updated.slice(11, 19) }}</div>
          <div v-if="ztTab === 'zt' && ztPool?.items?.length" class="zt-list">
            <div v-for="h in ztPool.items" :key="h.code" class="zt-item" @click="openStock(h)">
              <span class="zt-lb" :class="lbCls(h.limitCount)">{{ h.limitCount }}板</span>
              <div class="zt-main">
                <div class="zt-name">{{ h.name }} <span class="zt-code">{{ h.code }}</span></div>
                <div class="zt-sub">封单 {{ fmtMoney(h.seal) }} · {{ fmtTime(h.firstTime) }} 封板{{ h.breakCount ? ' · 炸板' + h.breakCount + '次' : '' }} · {{ h.industry }}</div>
              </div>
              <span class="zt-chg" :class="h.change_pct >= 0 ? 'up' : 'down'">{{ fmtPct(h.change_pct) }}</span>
            </div>
          </div>
          <div v-else-if="ztTab === 'zb' && zbPool?.items?.length" class="zt-list">
            <div v-for="h in zbPool.items" :key="h.code" class="zt-item" @click="openStock(h)">
              <span class="zt-lb zt-lb-zb">炸板</span>
              <div class="zt-main">
                <div class="zt-name">{{ h.name }} <span class="zt-code">{{ h.code }}</span></div>
                <div class="zt-sub">炸板 {{ h.breakCount || 1 }} 次</div>
              </div>
              <span class="zt-chg" :class="h.change_pct >= 0 ? 'up' : 'down'">{{ fmtPct(h.change_pct) }}</span>
            </div>
          </div>
          <div v-else-if="!loadingZt" class="empty">今日暂无涨停数据（收盘后/非交易日无更新）</div>
        </div>

        <!-- 龙虎榜 -->
        <div v-if="st === 'lhb'" class="lhb-page">
          <div v-if="lhbItems.length" class="lhb-summary">
            <span>🐉 近5日龙虎榜 <b>{{ lhbItems.length }}</b> 只上榜 · 净买合计 <b :class="lhbNet >= 0 ? 'up' : 'down'">{{ fmtMoney(lhbNet) }}</b></span>
          </div>
          <div class="lhb-list">
            <div v-for="it in lhbItems" :key="it.code" class="lhb-item" @click="openStock(it)">
              <div class="lhb-main"><span class="lhb-name">{{ it.name }}</span><span class="lhb-sub">{{ it.reason || '' }}</span></div>
              <span class="lhb-net" :class="(it.net || 0) >= 0 ? 'up' : 'down'">{{ fmtMoney(it.net) }}</span>
            </div>
          </div>
        </div>

        <!-- 资金页 -->
        <div v-if="st === 'fund'" class="fund-page">
          <div class="sec-title">💰 板块资金</div>
          <div v-for="s in fundSectors" :key="s.name" class="fund-card" @click="goSector(s)">
            <div class="fc-name">{{ s.name }}</div>
            <div class="fc-flow" :class="(s.flow || 0) >= 0 ? 'up' : 'down'">{{ fmtMoney(s.flow) }}</div>
          </div>
          <div class="sec-title">📊 概念资金</div>
          <div v-for="s in fundConcepts" :key="s.name" class="fund-card" @click="goSector(s)">
            <div class="fc-name">{{ s.name }}</div>
            <div class="fc-flow" :class="(s.flow || 0) >= 0 ? 'up' : 'down'">{{ fmtMoney(s.flow) }}</div>
          </div>
        </div>

        <!-- 持仓 -->
        <div v-if="st === 'hold'" class="hold-page">
          <div class="hold-summary">
            <div class="hs-item"><b :class="holdSum.totalPnl >= 0 ? 'up' : 'down'">{{ fmtMoney(holdSum.totalVal) }}</b><span>总市值</span></div>
            <div class="hs-item"><b>{{ fmtMoney(holdSum.totalCost) }}</b><span>总成本</span></div>
            <div class="hs-item"><b :class="holdSum.totalPnl >= 0 ? 'up' : 'down'">{{ (holdSum.totalPnl > 0 ? '+' : '') + holdSum.totalPnl.toFixed(1) }}%</b><span>总盈亏</span></div>
          </div>
          <div class="ha-title">📊 持仓明细</div>
          <div v-for="h in holdItems" :key="h.code" class="ha-item" @click="openStock(h)">
            <div class="ha-name"><span>{{ h.name || h.code }}</span><span class="hai-pct" :class="h.pl >= 0 ? 'up' : 'down'">{{ (h.pl > 0 ? '+' : '') + h.pl.toFixed(1) }}%</span></div>
            <div class="hai-fill" :class="h.pl >= 0 ? 'up' : 'down'" :style="{ width: Math.abs(h.pl) / 20 * 100 + '%' }"></div>
            <div class="ha-info"><span>成本 {{ fmtNum(h.cost) }} · {{ h.shares }}股</span><span>占比 {{ h.weight.toFixed(1) }}%</span></div>
          </div>
          <div class="hold-actions">
            <button class="aa-btn" @click="openHoldForm">+ 添加持仓</button>
            <button class="aa-btn" :disabled="aiHoldLoading" @click="runHoldAI">{{ aiHoldLoading ? '分析中...' : '🤖 AI 持仓分析' }}</button>
          </div>
          <div v-if="holdAI" class="hold-ai-result">
            <div class="hai-summary">{{ holdAI.summary }}</div>
            <div v-for="(p, i) in holdAI.plan" :key="i" class="hai-plan">
              <div class="hai-name">{{ p.name || p.code }}</div>
              <div class="hai-action" :class="String(p.action).includes('加') ? 'up' : String(p.action).includes('减') ? 'down' : ''">{{ p.action }}</div>
              <div class="hai-reason">{{ p.reason }}</div>
            </div>
            <div v-if="holdAI.portfolioAdvice" class="hai-advice">{{ holdAI.portfolioAdvice }}</div>
          </div>
          <!-- 交易日志 -->
          <div class="ha-title">📝 交易日志</div>
          <button class="aa-btn" style="float:right;font-size:12px" @click="showTradeForm = !showTradeForm">{{ showTradeForm ? '收起' : '+记一笔' }}</button>
          <div v-if="showTradeForm" class="trade-form">
            <input v-model="tradeForm.stock" class="hm-input" placeholder="股票名称" style="width:100px" />
            <select v-model="tradeForm.type" class="aa-sel"><option value="buy">买入</option><option value="sell">卖出</option></select>
            <input v-model="tradeForm.price" class="hm-input" placeholder="价格" type="number" step="0.01" />
            <input v-model="tradeForm.shares" class="hm-input" placeholder="股数" type="number" />
            <button class="aa-btn" @click="addTrade">保存</button>
          </div>
          <div v-for="t in trades" :key="t.id" class="trade-item">
            <span>{{ t.stock }} {{ t.type === 'buy' ? '买入' : '卖出' }} {{ t.shares }}股 @ {{ t.price }}</span>
            <span>{{ t.total }}</span>
            <button class="al-del" @click="delTrade(t.id)">×</button>
          </div>
        </div>
      </div>

      <!-- ================= 总览 ================= -->
      <div v-else-if="view === 'overview'" class="overview-page">
        <div class="hdr"><span class="logo">🎯 今日重点 <span class="ver-tag">{{ ver }}</span></span></div>
        <div class="ov-tabs">
          <span :class="{ on: ovTab === 'realtime' }" @click="ovTab = 'realtime'; loadRealtime()">🔴 实时机会</span>
          <span :class="{ on: ovTab === 'predict' }" @click="ovTab = 'predict'; loadOverview()">🔮 明日预测</span>
          <span :class="{ on: ovTab === 'focus' }" @click="ovTab = 'focus'">🎯 重点 Top10</span>
        </div>
        <div v-if="ovTab === 'focus'" class="rt-hint">🎯 实时机会 + 明日预测信号合并打分，按机会强度排序 —— 今天最值得关注的 Top10</div>
        <div v-if="ovTab === 'focus'" class="rt-filter">
          <span :class="['rt-chip', { on: rsiF === '' }]" @click="rsiF = ''">RSI全部</span>
          <span :class="['rt-chip', { on: rsiF === 'os' }]" @click="rsiF = 'os'">超卖&lt;30</span>
          <span :class="['rt-chip', { on: rsiF === 'ob' }]" @click="rsiF = 'ob'">超买&gt;80</span>
          <span :class="['rt-chip', { on: rsiF === 'mid' }]" @click="rsiF = 'mid'">中位</span>
        </div>
        <!-- 实时机会列表 -->
        <div v-if="ovTab === 'realtime'" class="rt-list">
          <div v-for="(h, q) in rtFiltered" :key="h.code" class="rt-item" @click="toggleFav(h)">
            <div class="rt-rank"><em>{{ q + 1 }}</em></div>
            <div class="rt-main">
              <div class="rt-name">{{ h.name }} <em>{{ h.code }}</em> <span class="rt-board">{{ boardName(h) }}</span> <span class="rt-hz" :class="styleCls(h)">{{ styleText(h) }}</span></div>
              <div class="rt-sigs">
                <span v-if="h.sig_zt" class="rt-sig hot">🚀涨停</span>
                <span v-if="h.sig_pump" class="rt-sig hot">📈今日拉升</span>
                <span v-if="h.sig_super" class="rt-sig hot">🃏超大扫货</span>
                <span v-if="h.sig_reverse" class="rt-sig dip">🔁反包</span>
                <span v-for="s in rtExtraSigs(h)" :key="s" class="rt-sig">{{ sigName(s) }}</span>
              </div>
            </div>
            <div class="rt-right">
              <div class="rt-score" :class="scoreCls(h.rtScore ?? h.score)">{{ h.rtScore ?? h.score }}</div>
              <div v-if="h.trade" class="rt-trade">→ {{ h.trade.entry_label }} {{ h.trade.entry }}</div>
              <div v-else-if="h.change_pct != null" class="rt-trade" :class="h.change_pct >= 0 ? 'up' : 'down'">{{ fmtPct(h.change_pct) }}</div>
            </div>
          </div>
        </div>
        <!-- 预测列表（总览） -->
        <div v-else-if="ovTab === 'predict' && overviewItems" class="pl-list">
          <div v-for="h in overviewItems" :key="h.code" class="oti" @click="openStock(h)">
            <div class="oti-left">
              <div class="oti-name">{{ h.name }} <span class="oti-code">{{ h.code }}</span> <span class="oti-board">{{ boardName(h) }}</span></div>
              <div class="oti-sigs">
                <span v-for="(s, i) in (Array.isArray(h.sigs) ? h.sigs : Object.keys(sigNames).filter(k => h[k])).slice(0, 5)" :key="i" class="ot-sig">{{ sigName(s) }}</span>
              </div>
            </div>
            <div class="oti-right">
              <div class="oti-score" :class="scoreCls(h.score)">{{ h.score }}/14</div>
              <div v-if="h.trade" class="oti-trade">→ {{ h.trade.entry_label }} {{ h.trade.entry }}</div>
            </div>
          </div>
        </div>
        <div v-else-if="ovTab === 'realtime' && !rtFiltered.length" class="empty">没有符合条件的股票 <button class="aa-btn" @click="resetRt" style="font-size:10px">重置筛选</button></div>
        <div v-else-if="ovTab === 'predict' && !overviewItems" class="empty">点击 🔮 预测 开始扫描</div>
        <!-- 持仓卡片 -->
        <div v-if="holdItems.length" class="ov-holds">
          <div class="sec-title">💼 持仓</div>
          <div v-for="h in holdItems.slice(0, 5)" :key="h.code" class="oh-item" @click="openStock(h)">
            <span>{{ h.name || h.code }}</span>
            <span :class="h.change_pct >= 0 ? 'up' : 'down'">{{ fmtNum(h.price) }}</span>
            <span :class="h.plPct >= 0 ? 'up' : 'down'">{{ (h.plPct > 0 ? '+' : '') + h.plPct }}%</span>
            <span v-if="h.predSignal" class="oh-sig" :class="{ gone: h.predSignal === 'gone' }">{{ h.predSignal === 'live' ? '✅' : '⚠️' }}</span>
          </div>
        </div>
        <!-- 主线板块 -->
        <div v-if="industryStats.length" class="ov-sector">
          <div class="sec-title">🔥 主线板块</div>
          <div class="sector-bars">
            <div v-for="s in industryStats" :key="s.industry" class="sbar">
              <span class="sbar-name">{{ s.industry }}</span>
              <span class="sbar-bar" :style="{ width: (s.count / maxIndCount * 100) + '%' }"></span>
              <span class="sbar-num">{{ s.count }}家涨停</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= 预测页 ================= -->
      <div v-else-if="view === 'predict'" class="bt-page">
        <div class="hdr"><span class="logo">🔮 预测 <span class="ver-tag">{{ ver }}</span></span></div>
        <div class="pred-top">
          <span :class="{ on: hi === 'realtime' }" @click="hi = 'realtime'; loadRealtime()">🔴 实时机会</span>
          <span :class="{ on: hi === 'predict' }" @click="hi = 'predict'; loadPredict()">🔮 明日预测</span>
        </div>
        <div v-if="netTip" class="net-tip" @click="netTip = false">⚠️ 后端响应偏慢——若开了翻墙请关闭（国内服务器绕路变慢），或点此关闭提示</div>

        <!-- 实时机会 -->
        <div v-if="hi === 'realtime'" class="rt-page">
          <div class="rt-search">
            <input v-model="rtKw" class="pl-search" placeholder="🔍 搜索代码/名称" />
          </div>
          <div class="rt-filters">
            <span :class="['pf-chip', { on: rtBoard === '' }]" @click="rtBoard = ''">全部</span>
            <span :class="['pf-chip', { on: rtBoard === '主板' }]" @click="rtBoard = '主板'">主板</span>
            <span :class="['pf-chip', { on: rtBoard === '创业板' }]" @click="rtBoard = '创业板'">创业板</span>
            <span :class="['pf-chip', { on: rtBoard === '科创板' }]" @click="rtBoard = '科创板'">科创板</span>
            <span :class="['pf-chip', { on: rtBoard === '北交所' }]" @click="rtBoard = '北交所'">北交所</span>
            <span :class="['pf-chip', { on: rtBoard === 'ST' }]" @click="rtBoard = 'ST'">ST</span>
            <span :class="['pf-chip', { on: rtScoreMin === 0 }]" @click="rtScoreMin = 0">≥0分</span>
            <span :class="['pf-chip', { on: rtScoreMin === 5 }]" @click="rtScoreMin = 5">≥5分</span>
            <span :class="['pf-chip', { on: rtScoreMin === 8 }]" @click="rtScoreMin = 8">≥8分</span>
          </div>
          <div class="rt-list">
            <div v-for="(h, q) in rtFiltered" :key="h.code" class="rt-item" @click="toggleFav(h)">
              <div class="rt-rank"><em>{{ q + 1 }}</em></div>
              <div class="rt-main">
                <div class="rt-name">{{ h.name }} <em>{{ h.code }}</em> <span class="rt-board">{{ boardName(h) }}</span> <span class="rt-hz" :class="styleCls(h)">{{ styleText(h) }}</span></div>
                <div class="rt-sigs">
                  <span v-if="h.sig_zt" class="rt-sig hot">🚀涨停</span>
                  <span v-if="h.sig_pump" class="rt-sig hot">📈今日拉升</span>
                  <span v-if="h.sig_super" class="rt-sig hot">🃏超大扫货</span>
                  <span v-if="h.sig_reverse" class="rt-sig dip">🔁反包</span>
                  <span v-for="s in rtExtraSigs(h)" :key="s" class="rt-sig">{{ sigName(s) }}</span>
                </div>
              </div>
              <div class="rt-right">
                <div class="rt-score" :class="scoreCls(h.rtScore ?? h.score)">{{ h.rtScore ?? h.score }}</div>
                <div v-if="h.trade" class="rt-trade">→ {{ h.trade.entry_label }} {{ h.trade.entry }}</div>
                <div v-else-if="h.change_pct != null" class="rt-trade" :class="h.change_pct >= 0 ? 'up' : 'down'">{{ fmtPct(h.change_pct) }}</div>
              </div>
            </div>
            <div v-if="!rtFiltered.length && !loadingRt" class="empty">没有符合条件的股票</div>
          </div>
        </div>

        <!-- 明日预测 -->
        <div v-else class="pred-page">
          <div class="style-tabs">
            <span v-for="s in styles" :key="s.key" :class="{ on: styleKey === s.key }" @click="setStyle(s.key)">{{ s.icon }} {{ s.name }}</span>
          </div>
          <div class="style-desc">{{ (styles.find(s => s.key === styleKey) || {}).desc || '' }}</div>
          <div v-if="predData?.boardStats" class="board-stats">
            <span v-for="(n, b) in predData.boardStats" :key="b">{{ boardIcon(b) }} {{ b }} <em>{{ n }}</em></span>
          </div>
          <div v-if="predData?.updated" class="pred-updated">🕐 信号更新: {{ typeof predData.updated === 'string' ? predData.updated.slice(11, 16) : '-' }}（K线信号60分钟重算·行情实时） · 扫描 {{ predData.total }} 只</div>
          <div class="pred-search"><input v-model="predKw" class="pl-search" placeholder="🔍 搜索代码/名称" /></div>
          <div class="pred-filters">
            <span :class="['pf-chip', { on: predBoard === '' }]" @click="predBoard = ''">全部</span>
            <span :class="['pf-chip', { on: predBoard === '主板' }]" @click="predBoard = '主板'">主板</span>
            <span :class="['pf-chip', { on: predBoard === '创业板' }]" @click="predBoard = '创业板'">创业板</span>
            <span :class="['pf-chip', { on: predBoard === '科创板' }]" @click="predBoard = '科创板'">科创板</span>
            <span :class="['pf-chip', { on: predBoard === '北交所' }]" @click="predBoard = '北交所'">北交所</span>
            <span :class="['pf-chip', { on: predBoard === 'ST' }]" @click="predBoard = 'ST'">ST</span>
            <span :class="['pf-chip', { on: predScoreMin === 0 }]" @click="predScoreMin = 0">≥0分</span>
            <span :class="['pf-chip', { on: predScoreMin === 6 }]" @click="predScoreMin = 6">≥6分</span>
            <span :class="['pf-chip', { on: predScoreMin === 9 }]" @click="predScoreMin = 9">≥9分</span>
          </div>
          <div class="pred-list">
            <div v-for="h in predFiltered" :key="h.code" class="plr" @click="openStock(h)">
              <div class="plr-name">{{ h.name }} <em class="plr-code">{{ h.code }}</em> <span class="plr-board">{{ boardIcon(h.board) }} {{ boardName(h) }}</span></div>
              <div class="plr-sigs">
                <span v-for="s in plrSigs(h)" :key="s.key" class="plr-sig" @click.stop="sigToStyle(s.key)">{{ sigName(s.key) }} <em>{{ sigCount[s.key] }}</em></span>
              </div>
              <div class="plr-right">
                <span class="plr-score" :class="scoreCls(h.score)">{{ h.score }}</span>
                <span v-if="h.trade" class="plr-trade">{{ h.trade.entry_label }} {{ h.trade.entry }} / 止 {{ h.trade.stop }} / 标 {{ h.trade.target }}</span>
              </div>
            </div>
            <div v-if="predLoading" class="pred-waiting">{{ predMsg }}</div>
            <div v-if="!predLoading && !predFiltered.length" class="empty">{{ predData?.message || predData?.error || '暂无预测（19:30 后生成）' }}</div>
          </div>
          <div class="plp-hint">点击信号 → 切到对应打法 · 点击股票行看入场/止损/仓位</div>

          <!-- 📜 预测/总结记录 -->
          <div class="hist-block">
            <div class="hist-title">📜 预测 / 总结记录 <button class="aa-btn" @click="loadHistory" style="font-size:10px">刷新</button></div>
            <div v-if="histStats.count" class="hist-stats">
              <div class="hs-card"><b>{{ histStats.count }}</b><i>总结天数</i></div>
              <div class="hs-card"><b :class="histStats.avgWr >= 50 ? 'up' : 'down'">{{ histStats.avgWr }}%</b><i>平均命中率</i></div>
              <div class="hs-card"><b :class="histStats.avgRet >= 0 ? 'up' : 'down'">{{ (histStats.avgRet > 0 ? '+' : '') + histStats.avgRet }}%</b><i>平均涨幅</i></div>
              <div class="hs-card"><b :class="histStats.recentWr >= 50 ? 'up' : 'down'">{{ histStats.recentWr }}%</b><i>近7天命中率</i></div>
            </div>

            <!-- 🧠 麦唛少年策略说明 -->
            <div class="mbm-block">
              <div class="mbm-title">🧠 麦唛少年 · ICIR 因子模型
                <button class="aa-btn" @click="loadMbmPredict" style="font-size:10px">{{ mbmLoading ? '打分中...' : (mbmData ? '刷新' : '生成预测') }}</button>
              </div>
              <div v-if="mbmData" class="mbm-result">
                <div class="mbm-stats">
                  <span>全市场 <b>{{ mbmData.total }}</b> 只</span>
                  <span>更新 <b>{{ mbmData.updated ? mbmData.updated.slice(11, 16) : '-' }}</b></span>
                  <span v-if="mbmData.review" :class="mbmData.review.winrate >= 53 ? 'up' : 'down'">昨日验证 {{ mbmData.review.winrate }}% (n={{ mbmData.review.total }})</span>
                </div>
                <div class="mbm-sec-title">🎯 Q4 入选（60-80 分位 · 回测胜率 {{ mode === 'long' ? '57.6' : mode === 'short' ? '54.6' : '54.0' }}%）</div>
                <div v-for="(x, i) in mbmQ4" :key="x.code" class="mbm-item" @click="openStock(x)">
                  <span class="mbm-rank">{{ i + 1 }}</span>
                  <span class="mbm-code">{{ x.code }}</span>
                  <span class="mbm-name">{{ x.name || '' }}</span>
                  <span class="mbm-score">{{ x.score }}</span>
                  <span class="mbm-pct">{{ x.pct }}%</span>
                </div>
                <div v-if="mbmQ4.length >= 50" class="mbm-more" @click="mbmShowAll = !mbmShowAll">{{ mbmShowAll ? '收起' : '展开全部' }}</div>
                <div v-if="mbmShowAll" class="mbm-all">
                  <div v-for="(x, i) in mbmQ4.slice(50)" :key="x.code" class="mbm-item" @click="openStock(x)">
                    <span class="mbm-rank">{{ 51 + i }}</span>
                    <span class="mbm-code">{{ x.code }}</span>
                    <span class="mbm-score">{{ x.score }}</span>
                    <span class="mbm-pct">{{ x.pct }}%</span>
                  </div>
                </div>
                <div class="mbm-sec-title warn">⚠️ Q1 回避（最弱 20% · 回测胜率仅 35%）</div>
                <div class="mbm-q1">
                  <span v-for="x in mbmQ1" :key="x.code" class="mbm-q1-chip" @click="openStock(x)">{{ x.code }}</span>
                </div>
                <details class="mbm-weights">
                  <summary>🔬 因子权重（透明可解释）</summary>
                  <div v-for="(w, k) in mbmData.weights" :key="k" class="mbm-w">
                    <span>{{ k }}</span><span :class="w >= 0 ? 'up' : 'down'">{{ w >= 0 ? '+' : '' }}{{ w }}</span>
                  </div>
                </details>
              </div>
              <div class="mbm-card"><b>策略原理</b>：24 个纯 K 线因子的 ICIR 加权打分——权重每 45 个交易日按因子有效性滚动自适应。样本外回测：IC 0.033-0.048、Q4 入选胜率 54-58%（规则基线 48%）。</div>
              <div class="mbm-card"><b>上线门槛（不达标不上线）</b>：walk-forward 60 天回测胜率 ≥ 规则基线 +5pp 才切换；双轨并行 2 周对照；熔断：连续 5 天胜率 &lt;45% 自动切回规则策略。</div>
              <div class="mbm-note">⚠️ 策略处于验证期，预测结果仅供研究参考，不构成投资建议。</div>
            </div>

            <div v-if="eveningHist.length" class="plh-group">
              <div class="plh-gh">🌙 盘后总结 · 当日验证</div>
              <div v-for="h in eveningHist" :key="h.date + h.type" class="plh-item" @click="openHistDetail(h)">
                <span>{{ String(h.date).slice(5) }}</span>
                <span v-if="h.winrate != null" class="plh-wr" :class="h.winrate >= 50 ? 'up' : 'down'">{{ h.winrate }}%</span>
                <span class="plh-sum">{{ h.summary || '' }}</span>
              </div>
            </div>
            <div v-if="morningHist.length" class="plh-group">
              <div class="plh-gh">🌅 明日预测</div>
              <div v-for="h in morningHist" :key="h.date + h.type" class="plh-item" @click="openHistDetail(h)">
                <span>{{ String(h.date).slice(5) }}</span>
                <span v-if="h.winrate != null" class="plh-wr" :class="h.winrate >= 50 ? 'up' : 'down'">{{ h.winrate }}%</span>
                <span class="plh-sum">{{ h.summary || '' }}</span>
              </div>
            </div>
            <div v-if="!histStats.count" class="empty">暂无记录</div>
          </div>
        </div>
      </div>

      <!-- ================= 回测页 ================= -->
      <div v-else-if="view === 'backtest'" class="bt-page">
        <div class="hdr"><span class="logo">🧪 策略回测 <span class="ver-tag">{{ ver }}</span></span></div>
        <div class="bt-strategies">
          <span v-for="s in strategies" :key="s.key" :class="['bt-chip', { on: btStrategy === s.key }]" @click="btStrategy = s.key">{{ s.icon }} {{ s.name }}</span>
        </div>
        <div class="bt-params">
          <span class="bp-label">天数</span>
          <button v-for="d in [15, 30, 60]" :key="d" :class="['bp-btn', { on: btDays === d }]" @click="btDays = d">{{ d }}</button>
          <span class="bp-label">股票池</span>
          <button v-for="n in [50, 100, 200]" :key="n" :class="['bp-btn', { on: btCount === n }]" @click="btCount = n">{{ n }}</button>
          <span class="bp-label">风格</span>
          <button v-for="g in btPresets" :key="g.key" :class="['bp-btn', { on: btPreset === g.key }]" @click="setPreset(g.key)">{{ g.label }}</button>
        </div>
        <div v-if="btStrategy === 'custom'" class="bt-factors">
          <span v-for="f in factors" :key="f.key" :class="['bf-chip', { on: f.on }]" @click="f.on = !f.on">{{ f.label }} <em>{{ f.weight }}</em></span>
          <span class="bf-score">门槛: {{ factorMin }}</span>
        </div>
        <div v-if="btStrategy === 'combo'" class="bt-combo">
          <span v-for="s in strategies.filter(x => !['combo', 'compare', 'resonance', 'leader', 'custom'].includes(x.key))" :key="s.key" :class="['bf-chip', { on: comboKeys.includes(s.key) }]" @click="toggleCombo(s.key)">{{ s.icon }} {{ s.name }}</span>
        </div>
        <button class="btn-ok bt-run" :disabled="btRunning" @click="runBacktest">{{ btRunning ? '回测中...' : '▶ 开始回测' }}</button>
        <div v-if="btRunning" class="bt-loading">
          <div class="btl-spinner"><span></span><span></span><span></span></div>
          <div class="btl-msg">{{ btMsg }}</div>
          <div class="btl-bar"><i :style="{ width: btProgress + '%' }"></i></div>
        </div>
        <div v-else-if="btResult" class="bt-result">
          <div v-if="btResult.error" class="bt-error">{{ btResult.error }}</div>
          <template v-else>
            <div v-if="btResult.compare" class="bt-compare">
              <div class="sec-title">策略对比</div>
              <div v-for="(v, k) in btResult.strategies" :key="k" class="btc-card" :class="{ best: btBest === k }">
                <div class="btc-icon">{{ (strategies.find(s => s.key === k) || {}).icon || '📈' }}</div>
                <div class="btc-name">{{ (strategies.find(s => s.key === k) || {}).name || k }}</div>
                <div class="btc-wr"><span :class="v.winRate >= 50 ? 'up' : 'down'">{{ v.winRate }}%</span><span class="btcc-label">胜率</span></div>
                <div class="btc-ar"><span :class="v.avgReturn >= 0 ? 'up' : 'down'">{{ (v.avgReturn > 0 ? '+' : '') + v.avgReturn }}%</span><span class="btcc-label">均收益</span></div>
                <div class="btc-total">{{ v.total }} 信号</div>
              </div>
            </div>
            <template v-else>
              <div class="bt-summary">
                <div class="bs-cell"><b :class="btResult.winRate >= 60 ? 'up' : btResult.winRate >= 45 ? 'mid' : 'down'">{{ btResult.winRate }}%</b><span>胜率</span></div>
                <div class="bs-cell"><b :class="btResult.avgReturn >= 0 ? 'up' : 'down'">{{ (btResult.avgReturn > 0 ? '+' : '') + btResult.avgReturn }}%</b><span>平均收益</span></div>
                <div class="bs-cell"><b>{{ btResult.plRatio }}</b><span>盈亏比</span></div>
                <div class="bs-cell"><b>{{ btResult.total }}</b><span>信号数</span></div>
              </div>
              <div class="bt-conclusion" :class="btResult.winRate >= 60 ? 'good' : btResult.winRate >= 45 ? 'mid' : 'bad'">
                {{ btResult.winRate >= 60 ? '✅ 策略稳定盈利，可考虑实盘' : btResult.winRate >= 45 ? '⚠️ 策略表现一般，需结合行情使用' : '❌ 策略胜率偏低，建议优化' }}
              </div>
              <div v-if="btResult.daily?.length" class="bt-bars">
                <div class="bb-row" v-for="d in btResult.daily" :key="d.date">
                  <span class="bb-date">{{ d.date.slice(5) }}</span>
                  <span class="bb-bar" :class="d.winRate >= 60 ? 'up' : d.winRate >= 45 ? 'mid' : 'down'" :style="{ width: (d.signals ? d.winRate : 0) + '%' }"></span>
                  <span class="bb-num">{{ d.signals ? d.winRate + '%' : '-' }} ({{ d.signals }})</span>
                </div>
              </div>
              <div class="bt-actions">
                <button class="aa-btn" @click="exportCSV">⬇ 导出 CSV</button>
              </div>
            </template>
          </template>
        </div>
        <div v-if="!btResult && !btRunning" class="bt-empty">
          <div class="bte-icon">🧪</div>
          <div class="bte-title">策略回测</div>
          <div class="bte-desc">用历史数据验证策略胜率，样本越大越准</div>
        </div>
        <div v-if="btHistory.length && !btResult" class="bt-history">
          <div class="btps-title">📋 历史回测</div>
          <div v-for="(h, i) in btHistory" :key="i" class="bth-item" @click="loadBtHist(h)">
            <span>{{ (strategies.find(s => s.key === h.strategy) || {}).icon }} {{ (strategies.find(s => s.key === h.strategy) || {}).name }}</span>
            <span>{{ h.time.slice(0, 10) }}</span>
            <span :class="h.result.winRate >= 50 ? 'up' : 'down'">{{ h.result.winRate }}%</span>
            <button class="bth-del" @click.stop="delBtHist(i)">×</button>
          </div>
        </div>
      </div>

      <!-- ================= 详情页 ================= -->
      <div v-else-if="view === 'detail' && cur" class="detail">
        <div class="hdr detail-hdr">
          <span class="back" @click="backHome">←</span>
          <span class="d-title">{{ cur.name }}</span>
          <span class="d-code">{{ cur.code }}</span>
          <button class="set-btn" @click="toggleFav(cur)">{{ isFav(cur) ? '⭐' : '☆' }}</button>
          <span class="ver-tag">{{ ver }}</span>
        </div>
        <div class="d-tabs">
          <span v-for="t in detailTabs" :key="t.key" :class="['dt', { on: detailTab === t.key }]" @click="switchDetailTab(t.key)">{{ t.label }}</span>
        </div>
        <!-- 报价区 -->
        <div class="q-zone">
          <div class="q-row1">
            <span class="q-price" :class="quote.change_pct >= 0 ? 'up' : 'down'">{{ quote.price != null ? quote.price.toFixed(2) : '-' }}</span>
            <span class="q-chg" :class="quote.change_pct >= 0 ? 'up' : 'down'">{{ fmtPct(quote.change_pct) }}</span>
            <span class="q-vol-tag" :class="volTagCls">{{ volTagText }}</span>
          </div>
          <div class="q-row2">
            <span>开 {{ fmtNum(quote.open) }}</span><span>高 <b style="color:#f85149">{{ fmtNum(quote.high) }}</b></span><span>低 <b style="color:#3fb950">{{ fmtNum(quote.low) }}</b></span>
            <span>量 {{ fmtVol(quote.volume) }}</span><span>额 {{ fmtMoney(quote.amount) }}</span><span>换手 {{ quote.turnover != null ? quote.turnover.toFixed(1) + '%' : '--' }}</span>
          </div>
        </div>
        <!-- K线/分时 -->
        <KChart v-if="detailTab === 'kline' || detailTab === 'trend'" ref="kchartRef"
          :klines="klines" :indicators="indicators" :trends="trends" :fsTitle="cur.name + ' ' + cur.code"
          :paict="paict" :hold-price="holdCost" :support-lines="supportLines"
          :timeframe="timeframe" :data-klt="dataKlt" :yday-trends="ydayTrends"
          :pred-lines="predLines" :beh-segs="behSegs" :limits="limits" :mode="mode"
          @timeframe="onTimeframe" />
        <!-- 实盘 -->
        <div v-if="detailTab === 'live'" class="live-page">
          <div class="live-head">
            <span class="live-dot" :class="{ on: isTrading }"></span>
            <span class="live-src">{{ liveSrc }}</span>
            <span class="live-freq">
              <button v-for="f in [3, 5, 10]" :key="f" :class="['mode-btn', { on: liveFreq === f }]" @click="setLiveFreq(f)">{{ f }}s</button>
            </span>
          </div>
          <div class="live-panel">
            <div class="lp-block">
              <div class="lp-name">🧠 行为识别</div>
              <div v-if="liveBehavior" class="beh-main">
                <span class="beh-emoji">{{ liveBehavior.emoji }}</span>
                <span class="beh-label" :style="{ color: liveBehavior.color }">{{ liveBehavior.label }}</span>
                <span class="beh-conf">置信{{ liveBehavior.confidence }}%</span>
              </div>
              <div v-else class="lp-sig-none">等待数据...</div>
            </div>
            <div class="lp-block">
              <div class="lp-name">📡 买卖信号</div>
              <div class="lp-sig-list">
                <div v-for="(s, i) in liveSignals" :key="i" class="lp-sig" :class="'sig-' + s.side">
                  <span class="lp-sig-id">{{ s.id }}</span>
                  <span class="lp-sig-label">{{ s.label }}</span>
                  <span class="lp-sig-pos">{{ s.pos }}</span>
                  <span class="lp-sig-trigger">{{ s.trigger }}</span>
                </div>
                <div v-if="!liveSignals.length" class="lp-sig-none">暂无信号</div>
              </div>
            </div>
            <div class="lp-block">
              <div class="lp-name">⚠️ 异常监测</div>
              <div class="live-anom">
                <div v-for="(a, i) in liveAnoms" :key="i" class="anom-item">
                  <span class="anom-type" :class="a.sev === '强' ? 'ai-a-sell' : ''">{{ anomName(a.type) }}</span>
                  <span class="anom-read">{{ a.read }}</span>
                  <span class="anom-act" :class="a.sev === '强' ? 'ai-a-sell' : ''">{{ a.act }}</span>
                </div>
                <div v-if="!liveAnoms.length" class="lp-sig-none">暂无异常</div>
              </div>
            </div>
          </div>
          <button class="llm-btn" :disabled="aiLiveLoading" @click="runLiveAI">{{ aiLiveLoading ? '分析中...' : '🤖 AI 解读当前盘面' }}</button>
          <div v-if="liveAI" class="llm-text" style="white-space:pre-wrap">{{ liveAI }}</div>
        </div>
        <!-- 策略详情 -->
        <div v-else-if="detailTab === 'strategy'" class="st-detail">
          <div class="std-section">
            <div class="sec-title">策略信号</div>
            <div class="std-items">
              <div v-for="(s, i) in klineSigs" :key="i" class="stdi">
                <span class="stdi-label">{{ sigName(s.key || s) }}</span>
                <span class="stdi-val">{{ sigParam(s.key || s) }}</span>
              </div>
              <div v-if="!klineSigs.length" class="empty">暂无信号</div>
            </div>
          </div>
        </div>
        <!-- 估值 -->
        <div v-else-if="detailTab === 'value'" class="val-page">
          <div class="val-card" :class="valCls">
            <div class="vc-title">估值判定</div>
            <div class="vc-verdict">{{ valuation?.verdict || '--' }}</div>
            <div class="vc-score">{{ valuation?.score || '--' }}/6分</div>
          </div>
          <div class="val-grid">
            <div class="vg-cell"><span>PE</span><b :class="peCls">{{ peText }}</b></div>
            <div class="vg-cell"><span>PB</span><b :class="pbCls">{{ pbText }}</b></div>
            <div class="vg-cell"><span>ROE</span><b :class="roeCls">{{ roeText }}</b></div>
            <div class="vg-cell"><span>市值</span><b>{{ capText }}</b></div>
          </div>
        </div>
        <!-- 资金流 -->
        <div v-else-if="detailTab === 'flow'" class="flow-page">
          <div class="flow-bars">
            <div v-for="f in flowBars" :key="f.name" class="fb-item">
              <span class="fbi-name">{{ f.name }}</span>
              <span class="fbi-bar" :class="f.cls" :style="{ width: f.width }"></span>
              <span class="fbi-val" :class="f.cls">{{ fmtMoney(f.value) }}</span>
            </div>
          </div>
          <div class="flow-notes">
            <div v-for="(n, i) in flowNotes" :key="i" class="fn-item">{{ n }}</div>
            <div v-if="!flowNotes.length" class="empty">暂无资金解读</div>
          </div>
        </div>
        <!-- AI 分析 -->
        <div v-else-if="detailTab === 'ai'" class="llm-sec">
          <button class="llm-btn" :disabled="aiLoading" @click="runAI">{{ aiLoading ? '分析中...' : '🤖 AI 综合分析' }}</button>
          <div v-if="aiOut" class="llm-text">
            <div class="llm-verdict" :class="verdictCls">{{ aiVerdict }}</div>
            <div style="white-space:pre-wrap">{{ aiText }}</div>
            <div v-if="aiTime" class="llm-time">🕐 {{ aiTime }}</div>
          </div>
        </div>
        <!-- 聊天 -->
        <div v-else-if="detailTab === 'chat'" class="chat-sec">
          <div ref="chatRef" class="chat-list">
            <div v-for="(m, i) in chatMsgs" :key="i" :class="['chat-msg', m.role]">{{ m.content }}</div>
          </div>
          <div class="chat-input">
            <input v-model="chatInput" placeholder="问 AI..." @keyup.enter="sendChat" />
            <button class="aa-btn" @click="sendChat" :disabled="chatLoading">发送</button>
          </div>
        </div>
        <!-- 持仓操作 -->
        <div class="d-actions">
          <button class="aa-btn" @click="openHoldFromDetail">💼 记入持仓</button>
        </div>
      </div>

      <!-- ================= 对比页 ================= -->
      <div v-else-if="view === 'compare'" class="compare-page">
        <div class="hdr"><span class="logo">⚖️ 对比</span><span class="back" @click="backHome">←</span></div>
        <div v-if="compareItems.length" class="cmp-table">
          <div v-for="it in compareItems" :key="it.code" class="cmp-row">
            <div class="cmp-name">{{ it.name }} {{ it.code }}</div>
            <div v-if="it.price != null" class="cmp-price" :class="it.change_pct >= 0 ? 'up' : 'down'">{{ it.price.toFixed(2) }} {{ fmtPct(it.change_pct) }}</div>
            <div v-if="it.score != null" class="cmp-score" :class="scoreCls(it.score)">{{ it.score }}</div>
          </div>
        </div>
      </div>

      <!-- ================= 板块页 ================= -->
      <div v-else-if="view === 'sector'" class="sector-page">
        <div class="hdr">
          <span class="back" @click="backHome">←</span>
          <span class="logo">{{ sectorName }}</span>
        </div>
        <div v-if="sectorLoading" class="empty">加载中...</div>
        <div v-for="s in sectorStocks" :key="s.code" class="row-item" @click="openStock(s)">
          <div class="row-main">
            <div class="row-name">{{ s.name }} <span class="row-board">{{ boardName(s) }}</span></div>
            <div class="row-code">{{ s.code }}</div>
            <div v-if="s.price != null" class="row-price"><span :class="s.change_pct >= 0 ? 'up' : 'down'">{{ s.price.toFixed(2) }} {{ fmtPct(s.change_pct) }}</span></div>
          </div>
        </div>
      </div>
    </transition>

    <!-- ========== 底部导航 ========== -->
    <div class="nav-bar">
      <button v-for="v in navs" :key="v.key" :class="['nav-btn', { on: view === v.key || (v.key === 'home' && view === 'detail') }]" @click="goNav(v.key)">{{ v.icon }}<span>{{ v.label }}</span></button>
    </div>

    <!-- 指标筛选弹层 -->
    <div v-if="showMetric" class="modal-mask" @click.self="showMetric = false">
      <div class="modal">
        <div class="modal-title">⚙ 指标筛选 <span class="sec-sub">按基本面条件选股票</span></div>
        <div v-for="m in metricDefs" :key="m.key" class="sheet-row">
          <div class="mr-label">{{ m.label }}<em v-if="m.key === 'roe'">（与详情页同口径）</em></div>
          <div class="mr-opts">
            <span v-for="o in m.opts" :key="o.val" :class="['fb-chip', { on: metricSel[m.key] === o.val }]" @click="setMetric(m.key, o.val)">{{ o.label }}</span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-ghost" @click="resetMetric">重置</button>
          <button class="btn-ok" @click="applyMetric">应用</button>
        </div>
      </div>
    </div>

    <!-- 指标解释弹层 -->
    <div v-if="showExplain" class="modal-mask" @click.self="showExplain = false">
      <div class="modal">
        <div class="modal-title">💡 指标怎么看（小白版）</div>
        <div v-for="(t, k) in explainText" :key="k" class="explain-item"><b>{{ k }}</b><p>{{ t }}</p></div>
        <div class="modal-actions"><button class="btn-ok" @click="showExplain = false">知道了</button></div>
      </div>
    </div>

    <!-- 设置弹层 -->
    <div v-if="showSettings" class="modal-mask" @click.self="showSettings = false">
      <div class="modal">
        <div class="modal-title">⚙️ 设置</div>
        <div class="set-row">
          <span>⚡ 实盘刷新频率（盘中轮询）</span>
          <div>
            <button v-for="f in [3, 5, 10]" :key="f" :class="['mode-btn', { on: liveFreq === f }]" @click="setLiveFreq(f)">{{ f }}秒</button>
          </div>
        </div>
        <div class="set-row">
          <span>🌐 后端地址</span>
          <input v-model="backendUrl" class="hm-input" placeholder="http://localhost:8003" style="flex:1" />
        </div>
        <div class="set-row">
          <span>🔑 DeepSeek API Key</span>
          <input v-model="deepseekKey" class="hm-input" placeholder="sk-..." style="flex:1" />
        </div>
        <div class="modal-actions">
          <button class="btn-ghost" @click="showSettings = false">取消</button>
          <button class="btn-ok" @click="saveSettings">保存</button>
        </div>
        <div class="set-status"><span :class="backendOk ? 'up' : 'down'">{{ backendOk ? '✅ 后端正常' : '❌ 后端连接失败' }}</span></div>
      </div>
    </div>

    <!-- 添加持仓弹层 -->
    <div v-if="showHoldForm" class="modal-mask" @click.self="closeHoldForm">
      <div class="modal">
        <div class="modal-title">💼 添加持仓</div>
        <div class="set-row">
          <input v-model="holdSearch" class="hm-input" placeholder="🔍 搜索股票" style="flex:1" />
        </div>
        <div v-for="s in holdSearchResults" :key="s.secid" class="sr-item" @click="pickHoldStock(s)">
          <span class="sr-name">{{ s.name }}</span><span class="sr-code">{{ s.code }}</span>
        </div>
        <div class="set-row">
          <span>股数</span><input v-model="holdShares" class="hm-input" type="number" style="width:80px" />
          <span>成本</span><input v-model="holdCostInput" class="hm-input" type="number" step="0.01" style="width:80px" />
        </div>
        <div class="modal-actions">
          <button class="btn-ghost" @click="closeHoldForm">取消</button>
          <button class="btn-ok" @click="saveHold">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// App.vue —— v55 完整版还原（dist 反编译 2026-08-18）
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as api from './api.js'
import { LiveEngine } from './liveEngine.js'
import KChart from './KChart.vue'
import './style.css'

const ver = 'v260818-0001'
const base = location.origin + '/'
const isTrading = () => {
  const d = new Date()
  if (d.getDay() === 0 || d.getDay() === 6) return false
  const m = d.getHours() * 60 + d.getMinutes()
  return m >= 9 * 60 + 15 && m <= 15 * 60 + 5
}

// ========== 状态 ==========
const view = ref('home')
const st = ref('stock')
const cur = ref(null)
const quote = ref({})
const klines = ref([])
const indicators = ref({})
const trends = ref([])
const paict = ref(null)
const klineAna = ref(null)
const timeframe = ref(101)
const dataKlt = ref(null)
const ydayTrends = ref([])
const predLines = ref({})
const behSegs = ref([])
const limits = ref({})
const multiFlow = ref(null)
const holderTrend = ref([])
const valuation = ref(null)
const supportLines = computed(() => {
  const o = []
  if (klineAna.value && klineAna.value.support) o.push({ price: klineAna.value.support, color: '#3fb950', label: '支撑' })
  if (klineAna.value && klineAna.value.resistance) o.push({ price: klineAna.value.resistance, color: '#f85149', label: '阻力' })
  return o
})

// 预警
const showAlerts = ref(false)
const alerts = ref(JSON.parse(localStorage.getItem('sm_alerts') || '[]'))
const alertForm = ref({ code: '', price: '', dir: 'above' })
function addAlert() {
  const code = alertForm.value.code.trim(), price = parseFloat(alertForm.value.price)
  if (!code || isNaN(price) || price <= 0) return
  alerts.value.push({ id: Date.now(), code, name: code, price, dir: alertForm.value.dir, triggered: false })
  localStorage.setItem('sm_alerts', JSON.stringify(alerts.value))
  alertForm.value = { code: '', price: '', dir: 'above' }
}
function delAlert(id) {
  alerts.value = alerts.value.filter(a => a.id !== id)
  localStorage.setItem('sm_alerts', JSON.stringify(alerts.value))
}
function checkAlerts() {
  if (!alerts.value.length) return
  const map = {}
  listItems.value.forEach(x => { map[x.code] = x })
  watchlist.value.forEach(x => { map[x.code] = x })
  let changed = false
  alerts.value.forEach(a => {
    if (a.triggered) return
    const k = map[a.code]
    if (k && k.price != null && ((a.dir === 'above' && k.price >= a.price) || (a.dir === 'below' && k.price <= a.price))) {
      a.triggered = true; a.triggeredAt = Date.now(); changed = true
      if (Notification && Notification.permission === 'granted') {
        new Notification(`${a.code} ${a.dir === 'above' ? '涨破' : '跌破'} ${a.price}`, { body: `当前价: ${k.price.toFixed(2)}`, icon: 'icon-192.png' })
      }
    }
  })
  if (changed) localStorage.setItem('sm_alerts', JSON.stringify(alerts.value))
}
if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission()

// 搜索
const kw = ref('')
const searchResults = ref([])
let searchTimer = null
async function onSearch() {
  const k = kw.value.trim()
  if (!k) { searchResults.value = []; return }
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    try { searchResults.value = await api.searchStock(k) } catch { searchResults.value = [] }
  }, 250)
}
function goFirst() { if (searchResults.value.length) openStock(searchResults.value[0]) }

// 市场
const marketTemp = ref(null)
const indices = ref({ sh: 0, sz: 0, hk: 0 })
const marketStats = ref({ up: 0, down: 0 })
const sectors = ref([])
const concepts = ref([])
const ztPool = ref(null)
const zbPool = ref(null)
const lhbItems = ref([])
const fundSectors = ref([])
const fundConcepts = ref([])
const loadingZt = ref(false)

async function loadMarket() {
  try { marketTemp.value = await api.getMarketTemp() } catch {}
  try {
    const [ta, ix] = await Promise.all([api.getMarketStats(), api.getIndices()])
    marketStats.value = ta || {}
    indices.value = ix || {}
  } catch {}
  try { sectors.value = await api.getSectors() } catch {}
  try { concepts.value = await api.getConcepts() } catch {}
}
const marketText = computed(() => `${marketStats.value.up ?? 0}涨 ${marketStats.value.down ?? 0}跌`)
const tempText = computed(() => marketTemp.value?.note || '')
const ztInfo = computed(() => marketTemp.value ? `涨停 ${marketTemp.value.limit_up ?? '--'}家 · 炸板率 ${marketTemp.value.break_rate ?? '--'}%` : '')

// 分类 tab
const cats = [
  { key: 'stock', label: '股票' },
  { key: 'zt', label: '涨停' },
  { key: 'lhb', label: '龙虎榜' },
  { key: 'hold', label: '持仓' },
  { key: 'fund', label: '资金' },
]
function switchCat(k) {
  st.value = k
  if (k === 'zt') loadZt()
  else if (k === 'lhb') loadLhb()
  else if (k === 'hold') loadHolds()
  else if (k === 'fund') loadFund()
  else loadList(1)
}

// 列表
const sortKey = ref('f6')
const chgFilter = ref('')
const rsiFilter = ref('')
const boardFilter = ref('')
const listItems = ref([])
const loadingList = ref(false)
const listPage = ref(1)
const listTotal = ref(0)
const listAllLoaded = ref(false)
const listRef = ref(null)
const sortOpts = [
  { key: 'f6', label: '成交额' }, { key: 'f3', label: '涨幅' }, { key: 'score', label: '综合分' },
  { key: 'f2', label: '价格' }, { key: 'f8', label: '换手' },
]
const filterOpts = [
  { key: '', label: '全部' }, { key: 'f3>0', label: '上涨' }, { key: 'f3<0', label: '下跌' },
]
const boardOpts = [
  { key: '', label: '全部' }, { key: 'm:0+t:6,m:1+t:2', label: '主板' }, { key: 'm:0+t:80', label: '创业板' },
  { key: 'm:1+t:23', label: '科创板' }, { key: 'm:0+t:81+s:2048', label: '北交所' },
]
async function loadList(p) {
  if (loadingList.value) return
  loadingList.value = true
  try {
    const d = await api.getList({
      page: p, page_size: 50, sort: sortKey.value, filter: chgFilter.value,
      board: boardFilter.value, metric: metricSel.value,
    })
    listItems.value = p === 1 ? (d.items || []) : [...listItems.value, ...(d.items || [])]
    listPage.value = p
    listTotal.value = d.total || 0
    listAllLoaded.value = listItems.value.length >= (d.total || 0)
  } catch {
    if (p === 1) listItems.value = []
  }
  loadingList.value = false
}
function setSort(k) { sortKey.value = k; loadList(1) }
function setChg(k) { chgFilter.value = k; loadList(1) }
function setRsi(k) { rsiFilter.value = k; if (k) api.rsiScan(k).then(d => { listItems.value = d.items || []; listAllLoaded.value = true }).catch(() => {}) ; else loadList(1) }
function setBoard(k) { boardFilter.value = k; loadList(1) }
function onListScroll() {
  const el = listRef.value
  if (!el) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60 && !listAllLoaded.value && !loadingList.value) loadList(listPage.value + 1)
}

// 指标筛选
const showMetric = ref(false)
const metricDefs = [
  { key: 'pe', label: '市盈率 PE', opts: [{ val: '', label: '不限' }, { val: 'pe<20', label: '<20 便宜' }, { val: 'pe20-50', label: '20~50' }, { val: 'pe>50', label: '>50 偏贵' }, { val: 'pe<0', label: '亏损' }] },
  { key: 'pb', label: '市净率 PB', opts: [{ val: '', label: '不限' }, { val: 'pb<1', label: '<1 破净' }, { val: 'pb1-3', label: '1~3' }, { val: 'pb>3', label: '>3' }] },
  { key: 'roe', label: 'ROE 净资产收益率', opts: [{ val: '', label: '不限' }, { val: 'roe>15', label: '>15% 优秀' }, { val: 'roe5-15', label: '5~15%' }, { val: 'roe<5', label: '<5% 弱' }] },
  { key: 'mktcap', label: '总市值', opts: [{ val: '', label: '不限' }, { val: 'mktcap>1000', label: '>1000亿' }, { val: 'mktcap100-1000', label: '100~1000亿' }, { val: 'mktcap<100', label: '<100亿' }] },
  { key: 'turnover', label: '换手率', opts: [{ val: '', label: '不限' }, { val: 'turnover>10', label: '>10% 活跃' }, { val: 'turnover3-10', label: '3~10%' }, { val: 'turnover<3', label: '<3% 冷清' }] },
  { key: 'flow', label: '主力资金', opts: [{ val: '', label: '不限' }, { val: 'flow>0', label: '净流入（主力在买）' }, { val: 'flow>5e7', label: '大幅流入 >5000万' }, { val: 'flow<0', label: '净流出（主力在卖）' }] },
  { key: 'flow10', label: '10日主力', opts: [{ val: '', label: '不限' }, { val: 'flow10>0', label: '净流入' }, { val: 'flow10<0', label: '净流出' }] },
  { key: 'flow20', label: '20日主力', opts: [{ val: '', label: '不限' }, { val: 'flow20>0', label: '净流入（中期在买）' }, { val: 'flow20<0', label: '净流出（中期在撤）' }] },
  { key: 'stage', label: '生命周期', opts: [{ val: '', label: '不限' }, { val: 'absorb', label: '吸筹期' }, { val: 'pump', label: '拉升期' }, { val: 'distribute', label: '派发期' }, { val: 'fall', label: '下跌期' }] },
]
const metricSel = ref({})
const metricCount = computed(() => Object.keys(metricSel.value).length)
function setMetric(k, v) {
  const m = { ...metricSel.value }
  v ? m[k] = v : delete m[k]
  metricSel.value = m
}
function resetMetric() { metricSel.value = {} }
function applyMetric() { showMetric.value = false; loadList(1) }

// 自选
const watchlist = ref(JSON.parse(localStorage.getItem('sm_watchlist') || '[]').filter(x => x && x.code))
const showCompare = ref(false)
const compareSel = ref([])
function isFav(d) { return d ? watchlist.value.some(o => o.secid === d.secid || o.code === d.code) : false }
function toggleFav(d) {
  if (!d) return
  if (isFav(d)) watchlist.value = watchlist.value.filter(o => !(o.secid === d.secid || o.code === d.code))
  else watchlist.value.unshift({ secid: d.secid, code: d.code, name: d.name || '', type: d.type || 'stock', price: d.price, change_pct: d.change_pct, board: d.board })
  localStorage.setItem('sm_watchlist', JSON.stringify(watchlist.value))
  api.saveWatchlist(watchlist.value.map(x => x.code)).catch(() => {})
}
function initWatchlist() {
  api.getWatchlist().then(list => {
    if (!Array.isArray(list) || !list.length) return
    const have = new Set(watchlist.value.map(x => x.code))
    let changed = false
    for (const c of list) if (!have.has(String(c))) {
      const code = String(c)
      watchlist.value.push({ secid: (code.startsWith('6') || code.startsWith('9') ? '1.' : '0.') + code, code, name: '', type: 'stock' })
      have.add(code); changed = true
    }
    if (changed) localStorage.setItem('sm_watchlist', JSON.stringify(watchlist.value))
  }).catch(() => {})
}

// 涨停/炸板/龙虎榜/资金
async function loadZt() {
  if (loadingZt.value) return
  loadingZt.value = true
  try {
    const [zt, zb] = await Promise.all([api.getZtPool(), api.getZbPool()])
    ztPool.value = zt; zbPool.value = zb
  } catch { ztPool.value = null }
  loadingZt.value = false
}
async function loadLhb() {
  try { lhbItems.value = (await api.getLhb())?.items || [] } catch { lhbItems.value = [] }
}
const lhbNet = computed(() => lhbItems.value.reduce((s, x) => s + (x.net || 0), 0))
async function loadFund() {
  try { fundSectors.value = await api.getFundSectors() } catch { fundSectors.value = [] }
  try { fundConcepts.value = await api.getFundConcepts() } catch { fundConcepts.value = [] }
}

// 总览/实时机会
const ovTab = ref('realtime')
const hi = ref('realtime')
const rtItems = ref([])
const loadingRt = ref(false)
const rtKw = ref('')
const rtBoard = ref('')
const rtScoreMin = ref(0)
const rsiF = ref('')
const styleKey = ref('all')
const overviewItems = ref(null)
const predData = ref(null)
watch(() => predData.value, (d) => {
  const p = d?.items?.find(x => x.code === cur.value?.code)
  predLines.value = p?.trade || {}
})
const netTip = ref(false)

const styles = [
  { key: 'all', icon: '⚡', name: '全部', desc: '展示所有触发信号的股票，按综合得分排序。适合快速浏览全场机会。', sigs: ['sig_leader', 'sig_trend', 'sig_breakH', 'sig_vcp', 'sig_maBull', 'sig_value', 'sig_wyckoff', 'sig_fib', 'sig_bollSq', 'sig_kdj', 'sig_volDry', 'sig_maTight'] },
  { key: 'hot', icon: '🔥', name: '短线追强', desc: '追涨停龙头和强势突破股：龙头(昨日涨停+封板资金)+突破前高+VCP收缩+KDJ金叉。适合市场情绪高、涨停多时使用。', sigs: ['sig_leader', 'sig_breakH', 'sig_vcp', 'sig_kdj'] },
  { key: 'trend', icon: '📈', name: '趋势跟踪', desc: '跟随上升趋势：20日放量上涨+均线多头排列+突破新高+布林开口。适合指数走强、板块轮动的行情。', sigs: ['sig_trend', 'sig_maBull', 'sig_breakH', 'sig_bollSq'] },
  { key: 'dip', icon: '🐻', name: '超跌抄底', desc: '找超跌反转：威科夫吸筹+斐波那契关键位+地量见底+KDJ超卖+低估值。适合大跌后的反弹行情。', sigs: ['sig_wyckoff', 'sig_fib', 'sig_volDry', 'sig_kdj', 'sig_value'] },
  { key: 'value', icon: '💎', name: '长线价值', desc: '低估值价值股：PE/PB/ROE 基本面 + 资金中期流入。适合长期配置。', sigs: ['sig_value', 'sig_volDry', 'sig_maBull'] },
]

async function loadRealtime() {
  if (loadingRt.value) return
  loadingRt.value = true
  try {
    const d = await api.getRealtime()
    if (d && d.items && d.items.length) { rtItems.value = d.items }
    else if (d && d.scanning) {
      netTip.value = true
      setTimeout(() => { hi.value === 'realtime' && loadRealtime() }, 15000)
    }
  } catch { /* retry later */ }
  loadingRt.value = false
}

async function loadOverview() {
  try {
    const d = await api.getPredict(mode.value)
    overviewItems.value = (d && d.items) || []
  } catch { overviewItems.value = [] }
}

const styleOf = (d) => {
  const o = d.sig_zt || d.sig_pump || d.sig_reverse || d.sig_vr ? 1 : 0
  const f = d.sig_flow || d.sig_super || d.sig_turn ? 1 : 0
  return o && f ? '短线+资金' : o ? '短线' : f ? '波段' : '观察'
}
const styleText = (d) => ({ '波段': '📈波段', '短线+资金': '🕐短线+📈', '短线': '🕐短线', '观察': '' }[styleOf(d)] || '')
const styleCls = (d) => styleOf(d) === '波段' ? 'hz-m' : styleOf(d).startsWith('短线') ? 'hz-s' : ''
const rtExtraSigs = (h) => ['sig_vr', 'sig_turn', 'sig_flow', 'sig_dump'].filter(k => h[k])
const sigNames = {
  sig_leader: '龙头', sig_trend: '趋势', sig_breakH: '突破', sig_vcp: 'VCP', sig_maBull: '多头',
  sig_value: '低估', sig_wyckoff: '吸筹', sig_fib: '斐波', sig_bollSq: '布林', sig_kdj: 'KDJ',
  sig_volDry: '地量', sig_maTight: '粘合', sig_lowBuy: '低吸', sig_zt: '涨停', sig_pump: '拉升',
  sig_reverse: '反包', sig_vr: '量比', sig_turn: '换手', sig_flow: '资金', sig_super: '超大', sig_dump: '出货',
}
const sigName = (k) => sigNames[k] || k
const rtFiltered = computed(() => {
  let d = (rtItems.value || []).filter(x => !x.participate || x.participate !== '已涨停')
  if (rtBoard.value !== '') d = d.filter(x => boardName(x) === rtBoard.value)
  if (rsiF.value) d = d.filter(x => x.rsi14 != null && (rsiF.value === 'os' ? x.rsi14 < 30 : rsiF.value === 'ob' ? (x.rsi6 ?? x.rsi14) > 80 : x.rsi14 >= 30 && x.rsi14 <= 60))
  if (rtKw.value.trim()) d = d.filter(x => (x.name || '').includes(rtKw.value.trim()) || (x.code || '').includes(rtKw.value.trim()))
  if (rtScoreMin.value > 0) d = d.filter(x => (x.rtScore ?? x.score) >= rtScoreMin.value)
  return d.slice(0, 80)
})
function resetRt() { rtKw.value = ''; rtBoard.value = ''; rtScoreMin.value = 0; rsiF.value = '' }

// 预测
const predLoading = ref(false)
const predMsg = ref('')
const predKw = ref('')
const predBoard = ref('')
const predScoreMin = ref(0)
const cacheKey = () => 'sm_pred_cache_' + mode.value
function predCache() {
  try {
    const c = JSON.parse(localStorage.getItem(cacheKey()))
    if (c && c.data && c.data.items && c.data.items.length && Date.now() - c.t < 24 * 3600 * 1000) return c.data
  } catch {}
  return null
}
function predToday() {
  try {
    const c = JSON.parse(localStorage.getItem(cacheKey()))
    if (!c || !c.data || !c.data.items || !c.data.items.length) return false
    const t = new Date(c.t), n = new Date()
    return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate()
  } catch { return false }
}
async function loadPredict() {
  predLoading.value = true
  try {
    const d = await api.getPredict(mode.value)
    if (d && d.items && d.items.length) { predData.value = d; savePredCache(d); predLoading.value = false; return }
  } catch {}
  const cached = predCache()
  if (cached) { predData.value = cached; predLoading.value = false; return }
  predMsg.value = '连接服务器...'
  try {
    const r = await fetch(base + '/api/predict?mode=' + mode.value, { signal: AbortSignal.timeout(15000), cache: 'no-store' })
    if (r.ok) {
      const d = await r.json()
      if (d.items && d.items.length) { predData.value = d; savePredCache(d); predLoading.value = false; return }
      predMsg.value = '预测由后台定时生成（每日19:30自动更新），等待中...'
      for (let i = 0; i < 8; i++) {
        await new Promise(res => setTimeout(res, 20000))
        try {
          const d2 = await (await fetch(base + '/api/predict?mode=' + mode.value, { signal: AbortSignal.timeout(12000), cache: 'no-store' })).json()
          predMsg.value = `等待后台预测生成... ${30 + Math.round((i + 1) / 8 * 60)}%`
          if (d2.items && d2.items.length && d2.stage === 'deep') { predData.value = d2; savePredCache(d2); break }
        } catch {}
      }
    }
  } catch {
    if (!predData.value?.items?.length) predData.value = { items: [], error: '服务器连接失败，请检查设置中的后端地址或稍后重试' }
  }
  predLoading.value = false
}
function savePredCache(d) {
  try { localStorage.setItem(cacheKey(), JSON.stringify({ t: Date.now(), data: d })) } catch {}
}
const sigCount = computed(() => {
  const d = {}
  for (const x of (predData.value?.items || [])) {
    const sigs = Array.isArray(x.sigs) ? x.sigs : Object.keys(sigNames).filter(k => x[k])
    for (const s of sigs) d[s] = (d[s] || 0) + 1
  }
  return d
})
const predFiltered = computed(() => {
  let d = (predData.value?.items || [])
  if (predBoard.value) d = d.filter(x => boardName(x) === predBoard.value)
  if (predKw.value.trim()) d = d.filter(x => (x.name || '').includes(predKw.value.trim()) || (x.code || '').includes(predKw.value.trim()))
  if (predScoreMin.value > 0) d = d.filter(x => x.score >= predScoreMin.value)
  return d
})
const plrSigs = (h) => {
  const sigs = Array.isArray(h.sigs) ? h.sigs : Object.keys(sigNames).filter(k => h[k])
  return sigs.map(k => ({ key: k })).filter(s => sigName(s.key))
}
function setStyle(k) {
  styleKey.value = k
  const s = styles.find(x => x.key === k)
  if (!s || !s.sigs || !predData.value) return
  const all = predData.value._allItems || predData.value.items
  if (!predData.value._allItems) predData.value._allItems = [...all]
  if (k === 'all') { predData.value.items = [...predData.value._allItems]; return }
  predData.value.items = predData.value._allItems.map(x => {
    let sc = 0
    for (const sig of s.sigs) if (Array.isArray(x.sigs) ? x.sigs.includes(sig) : x[sig]) sc += sig === 'sig_leader' ? 2 : 1
    return { ...x, styleScore: sc }
  }).filter(x => x.styleScore > 0).sort((a, b) => b.styleScore - a.styleScore)
}
function sigToStyle(sig) {
  const s = styles.find(x => (x.sigs || []).includes(sig))
  if (s) styleKey.value = s.key
}

// 🧠 麦唛 ICIR 预测
const mbmData = ref(null)
const mbmLoading = ref(false)
const mbmShowAll = ref(false)
const mbmQ4 = computed(() => (mbmData.value?.q4 || []).map(x => {
  const meta = (predData.value?._allItems || predData.value?.items || []).find(p => p.code === x.code)
  return { ...x, name: meta?.name || '' }
}))
const mbmQ1 = computed(() => mbmData.value?.q1 || [])
async function loadMbmPredict() {
  if (mbmLoading.value) return
  mbmLoading.value = true
  try {
    const r = await fetch(`${base}/api/mbm-predict?mode=${mode.value}`, { signal: AbortSignal.timeout(150000), cache: 'no-store' })
    if (r.ok) {
      const d = await r.json()
      if (d.ok) mbmData.value = d
    }
  } catch { /* 静默失败，下次再试 */ }
  mbmLoading.value = false
}

// 📜 历史记录
const histRecords = ref([])
const histStats = computed(() => {
  const eves = histRecords.value.filter(d => d.type === 'evening')
  const o = eves.filter(f => f.winrate != null)
  const k = eves.slice(0, 7).filter(f => f.winrate != null)
  const avg = (arr) => arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length * 10) / 10 : 0
  return {
    count: eves.length,
    avgWr: Math.round(avg(o.map(f => f.winrate))),
    avgRet: avg(eves.filter(f => f.avg_return != null).map(f => f.avg_return)),
    recentWr: Math.round(avg(k.map(f => f.winrate))),
  }
})
const eveningHist = computed(() => histRecords.value.filter(d => d.type === 'evening'))
const morningHist = computed(() => histRecords.value.filter(d => d.type === 'morning'))
async function loadHistory() {
  try {
    const d = await api.getHistory()
    const arr = Array.isArray(d) ? d : (d?.records || [])
    if (arr.length) histRecords.value = arr
  } catch {}
}
async function openHistDetail(h) {
  try {
    const r = await fetch(`${base}/api/forecast/detail?date=${h.date}&type=${h.type}`, { signal: AbortSignal.timeout(10000), cache: 'no-store' })
    if (r.ok) {
      const d = await r.json()
      if (d.ok) alert(JSON.stringify(d.summary || d, null, 2).slice(0, 800))
    }
  } catch {}
}

// 详情页
const detailTabs = [
  { key: 'kline', label: 'K线' }, { key: 'trend', label: '分时' }, { key: 'live', label: '实盘' },
  { key: 'strategy', label: '策略' }, { key: 'value', label: '估值' }, { key: 'flow', label: '资金' },
  { key: 'ai', label: 'AI' }, { key: 'chat', label: '聊' },
]
const detailTab = ref('kline')
const kchartRef = ref(null)
let loadSeq = 0

function openStock(d) {
  if (!d) return
  const code = String(d.code || d.secid?.split('.')[1] || '')
  const secid = d.secid || (code.startsWith('6') || code.startsWith('9') ? '1.' + code : '0.' + code)
  cur.value = { ...d, secid, code, name: d.name || code }
  view.value = 'detail'
  detailTab.value = 'kline'
  history.replaceState({ sm: true }, '')
  timeframe.value = 101
  dataKlt.value = null
  loadDetail()
}
async function loadDetail() {
  const secid = cur.value.secid
  const seq = ++loadSeq
  try {
    const d = await api.getDetail(secid)
    if (seq !== loadSeq || !d) return
    if (d.klines?.length) { klines.value = d.klines; indicators.value = d.indicators || {}; klineAna.value = d.klineAna || null; paict.value = d.paict || null; dataKlt.value = 101 }
    if (Array.isArray(d.trends) && d.trends.length) trends.value = d.trends
    if (d.quote) quote.value = d.quote
  } catch {}
  api.getQuote(secid).then(q => { if (seq === loadSeq && q) quote.value = q }).catch(() => {})
  await loadPeriod(101, seq)
}
async function loadPeriod(klt, seq = loadSeq) {
  if (seq !== loadSeq) return
  if (klt === 0) {
    if (trends.value.length) dataKlt.value = 0
    else {
      try { trends.value = await api.getTrends(cur.value.secid); if (seq === loadSeq) dataKlt.value = 0 } catch {}
    }
    return
  }
  try {
    const d = await api.getKlines(cur.value.secid, klt)
    if (seq !== loadSeq || !d || !d.length) return
    if (d.length > 10) {
      klines.value = d
      const ind = api.computeIndicators(d)
      indicators.value = ind
      klineAna.value = api.computeKlineAna(d, ind)
      paict.value = api.computePaict(d)
      if (seq === loadSeq) dataKlt.value = klt
    }
  } catch {}
}
function onTimeframe(klt) {
  const seq = ++loadSeq
  timeframe.value = klt
  if (klt === 0) loadPeriod(0, seq)
  else loadPeriod(klt, seq)
}
function switchDetailTab(t) {
  detailTab.value = t
  if (t === 'live') startLive()
  else if (t === 'trend' && dataKlt.value !== 0) { timeframe.value = 0; loadPeriod(0) }
  else if (t === 'kline' && dataKlt.value !== 101 && timeframe.value === 0) { timeframe.value = 101; loadPeriod(101) }
  else stopLive()
}
const holdCost = computed(() => {
  const h = holdItems.value.find(x => x.code === cur.value?.code)
  return h?.cost || 0
})

// 实盘
const liveEngine = ref(null)
const liveBehavior = ref(null)
const liveSignals = ref([])
const liveAnoms = ref([])
const liveSrc = ref('-')
const liveFreq = ref(Number(localStorage.getItem('sm_live_freq')) || 3)
const aiLiveLoading = ref(false)
const liveAI = ref('')
let liveTimer = null
let liveFrameCache = null

function startLive() {
  stopLive()
  liveEngine.value = new LiveEngine(cur.value.code || '')
  liveTick()
  liveTimer = setInterval(liveTick, liveFreq.value * 1000)
}
function stopLive() { if (liveTimer) { clearInterval(liveTimer); liveTimer = null } }
async function liveTick() {
  if (!cur.value || !liveEngine.value) return
  try {
    let quote2, trends2, mainNet
    try {
      const f = await api.getLiveFrame(cur.value.secid)
      quote2 = f.quote || {}; trends2 = f.trends || []; mainNet = f.fund?.mainNet ?? null
    } catch {
      quote2 = await api.getQuote(cur.value.secid).catch(() => ({}))
      trends2 = trends.value
    }
    quote.value = quote2
    liveSrc.value = '后端'
    const last = trends2[trends2.length - 1]
    const frame = {
      ts: Date.now(),
      time: new Date().toTimeString().slice(0, 5),
      isTrading: isTrading(),
      price: quote2.price, avgPrice: last?.avg ?? quote2.price,
      preClose: quote2.preClose, open: quote2.open, high: quote2.high, low: quote2.low,
      volRatio: quote2.volRatio, turnover: quote2.turnover, outer: quote2.outer, inner: quote2.inner,
      mainNet, amount: (quote2.volume || 0) * 100,
      highLimit: quote2.highLimit, lowLimit: quote2.lowLimit, bids: quote2.bids, asks: quote2.asks,
      pred: predLines.value, holdCost: holdCost.value,
      todayTrends: trends2, ydayTrends: ydayTrends.value,
    }
    const r = liveEngine.value.feed(frame)
    if (r.behavior) { liveBehavior.value = r.behavior; behSegs.value = r.behavior.segments }
    if (r.anomalies?.length) liveAnoms.value = r.anomalies.slice(0, 5)
    if (r.signals?.length) liveSignals.value = r.signals.slice(0, 6)
  } catch {}
}
function setLiveFreq(f) {
  liveFreq.value = f
  localStorage.setItem('sm_live_freq', String(f))
  if (liveTimer) { stopLive(); startLive() }
}
async function runLiveAI() {
  if (!cur.value || aiLiveLoading.value) return
  aiLiveLoading.value = true
  liveAI.value = ''
  try {
    const last = (trends.value || [])[trends.value.length - 1] || {}
    const prompt = `你是职业交易员。请基于以下实盘盘面数据，用大白话给股民解读当前走势并给出具体操作建议（必须包含具体价位+止损+仓位比例，禁止任何生活比喻）：
股票：${cur.value.name} ${cur.value.code}
现价：${quote.value.price} 涨跌：${quote.value.change_pct}% 量比：${quote.value.volRatio} 换手：${quote.value.turnover}%
均价：${last.avg ?? '-'} 今高：${quote.value.high} 今低：${quote.value.low}
主力行为：${liveBehavior.value ? liveBehavior.value.emoji + liveBehavior.value.label + '（置信' + liveBehavior.value.confidence + '%）' : '未知'}
行为依据：${liveBehavior.value?.evidence?.join('；') || '无'}
异常信号：${liveAnoms.value.map(a => a.type + ':' + a.data).join('；') || '无'}
预测位：入场${predLines.value?.entry || '-'} 止损${predLines.value?.stop || '-'} 目标${predLines.value?.target || '-'}
要求输出：1) 当前盘面一句话定性 2) 主力意图判断 3) 具体操作建议（含买入/卖出价位、止损位、仓位比例）4) 风险提示。控制在200字内。`
    const d = await api.llmAnalyze({ prompt, maxTokens: 800 })
    liveAI.value = d.text || d.summary || JSON.stringify(d)
  } catch (e) { liveAI.value = 'AI 分析失败：' + e.message }
  aiLiveLoading.value = false
}
const anomNames = {
  tail_pump: '尾盘急拉·违背画像', tail_dump: '尾盘急砸', top_div: '顶背离·新高资金流出', bot_div: '底背离·新低资金流入',
  churn: '对倒痕迹·量增价平', sweep: '大单扫货', seal_change: '封单突变', profile_anom: '画像反常',
  flash: '急拉脉冲', flash_dump: '急砸脉冲', spread: '盘口异动·价差扩大',
}
const anomName = (t) => anomNames[t] || t

// 策略详情
const klineSigs = computed(() => {
  const s = klineAna.value
  return s?.signals || Object.keys(sigNames).filter(k => s?.[k])
})
const sigParam = (k) => klineAna.value?.params?.[k] || ''

// 估值
const valCls = computed(() => {
  const v = valuation.value?.verdict
  return v === '优质标的' || v === '值得关注' ? 'val-good' : v === '亏损' || v === '需谨慎' || v === '基本面弱' ? 'val-bad' : 'val-mid'
})
const peText = computed(() => {
  const p = valuation.value?.pe
  return p == null ? '无 PE 数据' : p < 0 ? '亏损' : p < 10 ? '极低 · 便宜' : p < 15 ? '较低' : p < 25 ? '中等' : p < 40 ? '偏高' : '极高 · 贵'
})
const peCls = computed(() => { const p = valuation.value?.pe; return p == null || p < 0 ? 'sub-warn' : p < 25 ? 'sub-ok' : p < 40 ? 'sub-mid' : 'sub-warn' })
const pbText = computed(() => { const p = valuation.value?.pb; return p == null ? '--' : p < 1 ? '破净 · 便宜' : p < 3 ? '正常' : '偏高' })
const pbCls = computed(() => { const p = valuation.value?.pb; return p == null ? '' : p < 1 ? 'sub-ok' : p < 3 ? '' : 'sub-warn' })
const roeText = computed(() => { const r = valuation.value?.roe; return r == null ? '--' : r > 15 ? '优秀 · 赚钱强' : r >= 5 ? '中等' : r >= 0 ? '偏弱' : '亏损' })
const roeCls = computed(() => { const r = valuation.value?.roe; return r == null ? '' : r > 15 ? 'sub-good' : r >= 5 ? '' : 'sub-warn' })
const capText = computed(() => { const m = quote.value.mktcap; return m == null ? '--' : m > 1000 ? '大盘股' : m >= 100 ? '中盘股' : '小盘股' })

// 资金流
const flowBars = computed(() => {
  const f = multiFlow.value
  if (!f) return []
  const arr = [{ name: '超大单', value: f.super_large ?? 0 }, { name: '大单', value: f.large ?? 0 }, { name: '散户', value: (f.small ?? 0) + (f.medium ?? 0) }]
  const mx = Math.max(1, ...arr.map(x => Math.abs(x.value)))
  return arr.map(x => ({ name: x.name, value: x.value, cls: x.value >= 0 ? 'in' : 'out', width: Math.max(10, Math.round(Math.abs(x.value) / mx * 100)) + '%' }))
})
const flowNotes = computed(() => {
  const f = multiFlow.value
  if (!f) return []
  const o = []
  const main = f.main ?? 0, sup = f.super_large ?? 0, lg = f.large ?? 0, small = (f.small ?? 0) + (f.medium ?? 0)
  const up = (quote.value.change_pct ?? 0) > 0
  if (main > 0 && up) o.push('主力净买 + 股价上涨，方向一致')
  else if (main > 0 && !up) o.push('主力在买但股价不涨，警惕托底')
  else if (main < 0 && up) o.push('主力在卖但股价在涨，散户抬轿，别追高')
  else if (main < 0 && !up) o.push('主力流出 + 股价下跌，资金在撤')
  if (Math.abs(sup) > 1e8 && Math.abs(lg) > 1e8) {
    if (sup < 0 && lg > 0) o.push('超大单在撤、大单在接——大资金有分歧，警惕边拉边撤')
    else if (sup > 0 && lg < 0) o.push('超大单进场、大单在跑——顶级资金吸筹')
  }
  if (Math.abs(small) > 5e7) {
    if (small < 0 && main > 0) o.push('散户在卖、主力在买——筹码向主力集中')
    else if (small > 0 && main < 0) o.push('散户在接盘、主力在卖——别当接盘侠')
  }
  return o.slice(0, 3)
})

// AI 分析
const aiLoading = ref(false)
const aiOut = ref('')
const aiTime = ref('')
const aiCache = ref({})
function loadAiCache() { try { aiCache.value = JSON.parse(localStorage.getItem('sm_ai_cache')) || {} } catch { aiCache.value = {} } }
const aiVerdict = computed(() => (typeof aiOut.value === 'object' && aiOut.value?.verdict) ? aiOut.value.verdict : '')
const aiText = computed(() => typeof aiOut.value === 'object' ? (aiOut.value.summary || JSON.stringify(aiOut.value)) : aiOut.value)
const verdictCls = computed(() => {
  const v = aiVerdict.value
  return v === '强烈看好' || v === '偏多' ? 'val-good' : v === '偏空' || v === '回避' ? 'val-bad' : 'val-mid'
})
async function runAI() {
  if (!cur.value || aiLoading.value) return
  const cached = aiCache.value[cur.value.secid]
  if (cached?.result && Date.now() - (cached.time || 0) < 600000) {
    aiOut.value = cached.result
    aiTime.value = new Date(cached.time).toLocaleString('zh-CN', { hour12: false })
    return
  }
  aiLoading.value = true
  aiOut.value = ''
  try {
    const d = await api.llmAnalyze({
      secid: cur.value.secid, code: cur.value.code, name: cur.value.name,
      quote: quote.value, valuation: valuation.value, klineAna: klineAna.value,
      paict: paict.value, multiFlow: multiFlow.value, holderTrend: holderTrend.value,
    })
    aiOut.value = d
    aiCache.value[cur.value.secid] = { time: Date.now(), result: d }
    try { localStorage.setItem('sm_ai_cache', JSON.stringify(aiCache.value)) } catch {}
    aiTime.value = new Date().toLocaleString('zh-CN', { hour12: false })
  } catch (e) { aiOut.value = '分析失败：' + e.message }
  aiLoading.value = false
}

// 聊天
const chatMsgs = ref([])
const chatInput = ref('')
const chatLoading = ref(false)
const chatRef = ref(null)
async function sendChat() {
  const text = chatInput.value.trim()
  if (!text || chatLoading.value) return
  chatInput.value = ''
  chatMsgs.value.push({ role: 'user', content: text })
  chatLoading.value = true
  try {
    const sysPrompt = `你是A股职业交易员，给出具体可操作的建议（入场点、止损位、目标位），禁止比喻和废话。当前在看：${cur.value.name}（${cur.value.code}），现价${quote.value.price ?? '?'}元，涨跌幅${quote.value.change_pct ?? '?'}%。当前周期模式：${modeName.value}，按该模式的持仓周期和关注重点分析。
系统判定：${aiVerdict.value || '数据不足'}
回答150字以内，不构成投资建议。`
    const d = await api.llmAnalyze({ prompt: sysPrompt + '\n用户问题：' + text, maxTokens: 500 })
    chatMsgs.value.push({ role: 'assistant', content: d.text || d.summary || 'AI 无返回，请重试' })
  } catch (e) { chatMsgs.value.push({ role: 'assistant', content: '出错了：' + e.message }) }
  chatLoading.value = false
  nextTick(() => { chatRef.value && (chatRef.value.scrollTop = chatRef.value.scrollHeight) })
}

// 持仓
const showHoldForm = ref(false)
const holdSearch = ref('')
const holdSearchResults = ref([])
const holdShares = ref(null)
const holdCostInput = ref(null)
const holdStock = ref(null)
const holdItems = ref([])
const holdingToEdit = ref(null)
const aiHoldLoading = ref(false)
const holdAI = ref(null)
const showTradeForm = ref(false)
const tradeForm = ref({ stock: '', type: 'buy', price: '', shares: '', note: '' })
const trades = ref(JSON.parse(localStorage.getItem('sm_trades') || '[]'))
let holdSearchTimer = null

const holdSum = computed(() => {
  if (!holdItems.value?.length) return { items: [], totalVal: 0, totalCost: 0, totalPnl: 0 }
  const d = holdItems.value.map(x => {
    const price = x.price || 0
    const pnl = price && x.cost ? (price - x.cost) / x.cost * 100 : 0
    return { ...x, curPrice: price, pnl, val: price * (x.shares || 0) }
  })
  const totalVal = d.reduce((s, x) => s + x.val, 0)
  const totalCost = d.reduce((s, x) => s + (x.cost || 0) * (x.shares || 0), 0)
  const totalPnl = totalCost ? (totalVal - totalCost) / totalCost * 100 : 0
  d.forEach(x => { x.weight = totalVal ? x.val / totalVal * 100 : 0 })
  return { items: d, totalVal, totalCost, totalPnl }
})
function loadHolds() {
  try {
    const d = JSON.parse(localStorage.getItem('sm_holdings') || '[]')
    holdItems.value = Array.isArray(d) ? d : []
  } catch { holdItems.value = [] }
  api.getHoldings().then(list => {
    const have = new Set(holdItems.value.map(x => x.secid))
    let changed = false
    for (const x of (list?.items || [])) if (x?.secid && !have.has(x.secid)) {
      holdItems.value.push({ secid: x.secid, code: x.code || '', name: x.name || '', shares: x.shares || 0, cost: x.cost || 0 })
      have.add(x.secid); changed = true
    }
    if (changed) saveHolds()
  }).catch(() => {})
  refreshHolds()
}
function saveHolds() {
  localStorage.setItem('sm_holdings', JSON.stringify(holdItems.value))
  api.saveHoldings(holdItems.value).catch(() => {})
}
async function refreshHolds() {
  if (!holdItems.value.length) return
  const codes = holdItems.value.slice(0, 50).map(x => x.secid).join(',')
  if (!codes) return
  try {
    const quotes = await api.getQuotes(codes)
    holdItems.value = holdItems.value.map(h => {
      const q = quotes[String(h.code)]
      const price = q?.price ?? h.price ?? 0
      const chg = q?.chg ?? h.change_pct ?? 0
      const pl = price && h.cost ? (price - h.cost) / h.cost * 100 : 0
      const stopLoss = h.cost * 0.93
      let advice = '', adviceCls = ''
      if (pl <= -7) { advice = '🔴 距止损仅' + ((price - stopLoss) / stopLoss * 100).toFixed(1) + '%——建议减仓'; adviceCls = 'down' }
      else if (pl < -3 && (price - stopLoss) / stopLoss * 100 < 3) { advice = '🟡 接近止损线——密切关注'; adviceCls = '' }
      else if (pl > 10) { advice = '🟢 利润丰厚，可设移动止盈锁利'; adviceCls = 'up' }
      else if (chg < -3) { advice = '🟡 今日走弱，观察是否企稳'; adviceCls = '' }
      else if (pl > 0) { advice = '持有，趋势正常'; adviceCls = 'up' }
      else { advice = '观望，等待回本或止损'; adviceCls = '' }
      return { ...h, price, change_pct: chg, pl, plPct: +pl.toFixed(2), stopLoss, distToStop: stopLoss ? (price - stopLoss) / stopLoss * 100 : null, advice, adviceCls }
    })
  } catch {}
}
function openHoldForm() {
  showHoldForm.value = true
  holdSearch.value = ''; holdSearchResults.value = []
  holdShares.value = null; holdCostInput.value = null; holdStock.value = null
  holdingToEdit.value = null
}
function openHoldFromDetail() {
  if (!cur.value) return
  openHoldForm()
  holdStock.value = { code: cur.value.code, name: cur.value.name, secid: cur.value.secid }
  holdSearch.value = cur.value.name + ' ' + cur.value.code
}
function closeHoldForm() { showHoldForm.value = false }
watch(holdSearch, (v) => {
  clearTimeout(holdSearchTimer)
  if (!v || v.trim().length < 2) { holdSearchResults.value = []; return }
  holdSearchTimer = setTimeout(async () => {
    try { holdSearchResults.value = await api.searchStock(v.trim(), 6) } catch { holdSearchResults.value = [] }
  }, 300)
})
function pickHoldStock(s) { holdStock.value = { code: s.code, name: s.name, secid: s.secid }; holdSearch.value = s.name + ' ' + s.code; holdSearchResults.value = [] }
function saveHold() {
  if (!holdStock.value || !holdShares.value || !holdCostInput.value) return
  if (holdingToEdit.value) {
    holdingToEdit.value.shares = holdShares.value
    holdingToEdit.value.cost = holdCostInput.value
    holdingToEdit.value = null
  } else {
    const exist = holdItems.value.find(x => x.secid === holdStock.value.secid)
    if (exist) {
      exist.shares += Number(holdShares.value)
      exist.cost = +((exist.cost * (exist.shares - holdShares.value) + Number(holdCostInput.value) * Number(holdShares.value)) / exist.shares).toFixed(2)
    } else {
      holdItems.value.push({ secid: holdStock.value.secid, code: holdStock.value.code, name: holdStock.value.name, shares: Number(holdShares.value), cost: Number(holdCostInput.value) })
    }
  }
  saveHolds()
  closeHoldForm()
  refreshHolds()
}
async function runHoldAI() {
  if (!holdItems.value.length || aiHoldLoading.value) return
  aiHoldLoading.value = true
  holdAI.value = null
  try {
    const list = holdItems.value.map(x => `${x.name}(${x.code})：持有${x.shares}股，成本${x.cost}，现价${x.price}，盈亏${x.pl >= 0 ? '+' : ''}${(x.pl / 1e4).toFixed(1)}万(${x.plPct >= 0 ? '+' : ''}${x.plPct}%)`).join('\n')
    const prompt = `你是A股职业交易员。用户有以下持仓，请给出具体操作计划。当前周期模式：${modeName.value}，按该模式适合的持仓周期判断每只股票的加仓/减仓/清仓。

用户持仓：
${list}

【输出要求】只返回JSON，不要markdown代码块：
{"summary":"30字内整体判断，如：3成仓位偏低可加仓/7成仓位偏高应减仓","plan":[{"code":"股票代码","name":"股票名","action":"加仓/减仓/持有/清仓，一句话","reason":"理由30字内"}],"portfolioAdvice":"针对整体仓位的建议：现金怎么分配、仓位控制什么范围、当前市场环境下应该激进还是保守（50字以内）"}`
    const d = await api.llmAnalyze({ prompt, maxTokens: 1000 })
    const text = d.text || d.summary || ''
    const m = text.match(/\{[\s\S]*\}/)
    holdAI.value = m ? JSON.parse(m[0]) : { summary: text, plan: [], portfolioAdvice: '' }
  } catch (e) { holdAI.value = { summary: '分析失败：' + e.message, plan: [], portfolioAdvice: '' } }
  aiHoldLoading.value = false
}
function addTrade() {
  const price = parseFloat(tradeForm.value.price), shares = parseInt(tradeForm.value.shares)
  if (!tradeForm.value.stock || isNaN(price) || isNaN(shares) || shares <= 0) return
  trades.value.unshift({ id: Date.now(), ...JSON.parse(JSON.stringify(tradeForm.value)), price, shares, total: (price * shares).toFixed(2) })
  localStorage.setItem('sm_trades', JSON.stringify(trades.value))
  tradeForm.value = { stock: '', type: 'buy', price: '', shares: '', note: '' }
}
function delTrade(id) {
  trades.value = trades.value.filter(t => t.id !== id)
  localStorage.setItem('sm_trades', JSON.stringify(trades.value))
}

// 三档模式
const mode = ref(localStorage.getItem('sm_mode') || 'swing')
const modes = [
  { key: 'short', icon: '⚡', name: '超短', desc: '打板·持有1-3天' },
  { key: 'swing', icon: '📈', name: '波段', desc: '趋势·持有2-8周' },
  { key: 'long', icon: '🏦', name: '长线', desc: '价值·持有6月+' },
]
const modeName = computed(() => (modes.find(m => m.key === mode.value) || modes[1]).name)
const modeDesc = computed(() => (modes.find(m => m.key === mode.value) || modes[1]).desc)
function setMode(m) {
  mode.value = m
  localStorage.setItem('sm_mode', m)
  fetch(base + '/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: m }), signal: AbortSignal.timeout(6000) }).catch(() => {})
  if (view.value === 'detail' && cur.value) loadDetail()
  loadPredict()
}
const strategyText = {
  short: '超短（打板）：MACD(6,13,5)·MA5/10/20·RSI6·BOLL(10)·KDJ J>110才算超买·突破10日高·吸筹关闭·价值不参与·龙头权重×2',
  swing: '波段：MACD(12,26,9)·MA5/10/20/60·RSI14·BOLL(20)·标准·突破20日高·吸筹开启·价值权重1·龙头权重×2',
  long: '长线（价值）：MACD(26,52,9)·MA20/60/120/250·RSI14·突破60日高·吸筹更严·价值权重×2·龙头权重×1',
}
const explainText = {
  'MACD': '快慢均线差，金叉=动能转强，死叉=转弱',
  'RSI': '超买超卖指标，>70 过热，<30 超卖',
  'KDJ': '短线摆动指标，金叉低位更可靠',
  'BOLL': '布林带，缩口=变盘前兆，开口=趋势加速',
  '量比': '今日每分钟均量/过去5日每分钟均量，>1.5 放量',
  '换手率': '当日成交股数/流通股，>10% 活跃',
}

// 回测
const btStrategy = ref('canslim')
const btDays = ref(30)
const btCount = ref(100)
const btPreset = ref('balanced')
const btRunning = ref(false)
const btMsg = ref('')
const btProgress = ref(0)
const btResult = ref(null)
const factorMin = ref(6)
const comboKeys = ref(['canslim', 'vcp'])
const btHistory = ref(JSON.parse(localStorage.getItem('sm_backtestHistory') || '[]'))
const strategies = [
  { key: 'canslim', icon: '🏆', name: '欧奈尔突破', source: "William O'Neil", tags: '中短线·趋势', desc: 'CANSLIM体系：盈利增长+价格强度+机构介入+放量突破', rules: ['近20日涨>5%', 'ROE>15%', '换手率>3%', '主力20日净流入', '市值>100亿'], conds: { roe: 'roe>15', turnover: 'turnover3-10', mktcap: 'mktcap>1000' }, sort: 'f6', matchCount: null, filter: 'f3>0', needKline: true, klineTop: 30 },
  { key: 'vcp', icon: '🎯', name: '米勒维尼收缩', source: 'Mark Minervini', tags: '短线·突破', desc: 'SEPA体系：VCP波动率收缩+近1年新高附近+缩量横盘后放量突破', rules: ['距52周高<15%', '近10日振幅收窄', '量能递减(缩量)', '今日放量>均量1.5倍'], conds: { turnover: 'turnover>10' }, sort: 'f3', matchCount: null, needKline: true, klineTop: 30 },
  { key: 'stage2', icon: '🚀', name: '温斯坦二阶', source: 'Stan Weinstein', tags: '中长线·趋势', desc: 'Stage Analysis：均线多头排列+价站30周线+上涨结构+放量涨缩量跌', rules: ['MA5>MA10>MA20', 'MACD为正', '价>MA20', '近20日涨>0', '放量涨缩量跌'], conds: {}, sort: 'f3', matchCount: null, needKline: true, klineTop: 30 },
  { key: 'wyckoff', icon: '🐋', name: '威科夫吸筹', source: 'Richard Wyckoff', tags: '中线·抄底', desc: '主力底部吸筹：底部区间+缩量跌+放量涨+支撑多次测试+20日资金流入', rules: ['20日涨跌-10%~10%', '缩量<0.85倍', 'RSI 30-60', '放量涨缩量跌', '20日主力净流入'], conds: {}, sort: 'f3', matchCount: null, needKline: true, klineTop: 30 },
  { key: 'davis', icon: '💎', name: '戴维斯双击', source: 'Davis', tags: '长线·价值', desc: '低PE+高ROE+合理PB——戴维斯双击（盈利提升+估值修复）', rules: ['PE<25', 'ROE>15%', 'PB<3', '市值>50亿', '20日主力流入'], conds: { pe: 'pe<25', roe: 'roe>15' }, sort: 'f3', matchCount: null, needKline: true, klineTop: 30 },
  { key: 'combo', icon: '🧩', name: '组合共振', tags: '多策略', desc: '多个策略同时看好的票（少数服从多数）' },
  { key: 'compare', icon: '⚖️', name: '策略对比', tags: '对比', desc: '所有策略在同样本上的胜率横向对比' },
  { key: 'resonance', icon: '🌊', name: '共振分析', tags: '多策略', desc: '每个信号打分，共振数越多越强' },
  { key: 'leader', icon: '🔥', name: '龙头战法', tags: '打板', desc: '涨停池龙头：N连板+封单强度，次日溢价验证' },
  { key: 'custom', icon: '🛠', name: '自定义因子', tags: 'DIY', desc: '自己勾选因子+权重+门槛' },
]
const btPresets = [
  { key: 'aggressive', label: '激进' }, { key: 'balanced', label: '均衡' }, { key: 'conservative', label: '保守' },
]
const factors = [
  { key: 'trend20', label: '20日趋势', weight: 2, on: true },
  { key: 'dist52', label: '距52周高', weight: 2, on: true },
  { key: 'volBrk', label: '放量突破', weight: 2, on: true },
  { key: 'rsi', label: 'RSI动能', weight: 1, on: true },
  { key: 'maBull', label: 'MA多头排列', weight: 2, on: true },
  { key: 'vcp', label: 'VCP振幅收缩', weight: 3, on: false },
  { key: 'macd', label: 'MACD多头', weight: 1, on: false },
  { key: 'volQual', label: '量价配合', weight: 2, on: false },
  { key: 'volDry', label: '缩量枯竭', weight: 2, on: false },
]
function setPreset(k) {
  btPreset.value = k
  if (k === 'aggressive') { factors.forEach(f => f.on = ['trend20', 'volBrk', 'rsi', 'maBull', 'vcp'].includes(f.key)); factorMin.value = 4 }
  else if (k === 'balanced') { factors.forEach(f => f.on = ['trend20', 'dist52', 'volBrk', 'maBull', 'volQual'].includes(f.key)); factorMin.value = 6 }
  else { factors.forEach(f => f.on = ['trend20', 'dist52', 'volBrk', 'maBull', 'volQual', 'macd', 'volDry'].includes(f.key)); factorMin.value = 8 }
}
function toggleCombo(k) {
  const i = comboKeys.value.indexOf(k)
  i >= 0 ? comboKeys.value.splice(i, 1) : comboKeys.value.push(k)
}
async function runBacktest() {
  if (btRunning.value) return
  btRunning.value = true
  btResult.value = null
  btMsg.value = '连接后端...'
  btProgress.value = 5
  const days = Math.min(btDays.value, 120)
  try {
    // 龙头策略走后端
    if (btStrategy.value === 'leader') {
      const r = await fetch(base + '/api/backtest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strategy: 'leader', days, stockCount: 0 }) })
      if (r.ok) {
        const k = await r.json()
        btResult.value = { total: k.total || 0, winRate: k.winRate || 0, avgReturn: k.avgReturn || 0, plRatio: '--', daily: k.daily || [], stockCount: k.stockCount || 0 }
      }
      saveBtHist()
      btRunning.value = false
      return
    }
    // 通用策略：取股票池 → K线 → 逐日回测
    btMsg.value = '获取股票池...'
    btProgress.value = 15
    const pool = await api.getList({ page: 1, page_size: Math.min(btCount.value + 50, 500), sort: 'f20', filter: 'f20>0', metric: {} })
    const stocks = (pool.items || []).slice().sort(() => Math.random() - 0.5).slice(0, Math.min(btCount.value, pool.items?.length || 100))
    btMsg.value = '获取K线...'
    btProgress.value = 20
    const klineMap = {}
    for (let i = 0; i < stocks.length; i++) {
      try { klineMap[stocks[i].secid] = await api.getKlines(stocks[i].secid, 101) } catch {}
      if (i % 10 === 0) { btMsg.value = `K线 ${i}/${stocks.length}`; btProgress.value = 20 + Math.round(i / stocks.length * 30) }
    }
    btMsg.value = '回测中...'
    const daily = []
    let total = 0, wins = 0, retSum = 0, winRet = 0, winN = 0, lossRet = 0, lossN = 0
    for (let d = 0; d < days; d++) {
      const dt = new Date(); dt.setDate(dt.getDate() - 1 - d)
      const date = dt.toISOString().slice(0, 10)
      const next = new Date(dt); next.setDate(next.getDate() + 1)
      const nextDate = next.toISOString().slice(0, 10)
      btMsg.value = `回测 ${d + 1}/${days}`; btProgress.value = 50 + Math.round(d / days * 45)
      const picks = []
      for (const s of stocks) {
        const kl = klineMap[s.secid]
        if (!kl || kl.length < 40) continue
        const idx = kl.findIndex(k => k.time > date)
        const hist = idx > 0 ? kl.slice(0, idx) : kl
        if (hist.length < 20) continue
        const nxt = kl.find(k => k.time === nextDate)
        if (!nxt) continue
        const ind = api.computeIndicators(hist)
        const ana = api.computeKlineAna(hist, ind)
        const score = btStrategy.value === 'custom' ? customScore(s, hist, ind, ana) : strategyScore(btStrategy.value, s, hist, ind, ana)
        const threshold = btStrategy.value === 'custom' ? factorMin.value : 3
        if (score.total >= threshold) {
          const ret = (nxt.close - hist[hist.length - 1].close) / hist[hist.length - 1].close * 100
          picks.push({ code: s.code, name: s.name, score: score.total, ret })
        }
      }
      if (picks.length) {
        const win = picks.filter(p => p.ret > 0).length
        const avgRet = picks.reduce((s, p) => s + p.ret, 0) / picks.length
        daily.push({ date, winRate: Math.round(win / picks.length * 100), signals: picks.length, avgRet, picks: picks.sort((a, b) => b.ret - a.ret).slice(0, 20) })
        total += picks.length; wins += win; retSum += picks.reduce((s, p) => s + p.ret, 0)
        picks.forEach(p => { if (p.ret > 0) { winRet += p.ret; winN++ } else { lossRet += Math.abs(p.ret); lossN++ } })
      } else daily.push({ date, winRate: 0, signals: 0, avgRet: 0 })
    }
    btResult.value = {
      total, winRate: total ? Math.round(wins / total * 100) : 0,
      avgReturn: total ? +(retSum / total).toFixed(2) : 0,
      plRatio: winN && lossN ? +(winRet / winN / (lossRet / lossN)).toFixed(1) : '--',
      daily: daily.reverse(), stockCount: stocks.length,
    }
    saveBtHist()
  } catch (e) { btResult.value = { error: e.message } }
  btRunning.value = false
}
function strategyScore(key, s, kl, ind, ana) {
  const items = []
  const last = kl[kl.length - 1]
  const closes = kl.map(k => k.close)
  const chg20 = last.close / kl[Math.max(0, kl.length - 21)].close - 1
  const high52 = kl.length >= 250 ? Math.max(...kl.slice(-250).map(k => k.high)) : Math.max(...kl.map(k => k.high))
  const dist52 = (high52 - last.close) / high52 * 100
  const rsi = ind.rsi?.[14]?.slice(-1)[0] ?? 50
  const vr = ind.volRatio?.slice(-1)[0] ?? 1
  const ma5 = ind.ma?.[5]?.slice(-1)[0], ma10 = ind.ma?.[10]?.slice(-1)[0], ma20 = ind.ma?.[20]?.slice(-1)[0], ma60 = ind.ma?.[60]?.slice(-1)[0]
  const macdDif = ind.macd?.dif?.slice(-1)[0], macdBar = ind.macd?.bar?.slice(-1)[0]
  if (key === 'canslim') {
    items.push({ label: 'ROE(盈利)', val: (s.roe ?? '--') + '%', score: (s.roe ?? 0) > 20 ? 2 : (s.roe ?? 0) > 15 ? 1 : 0, max: 2, ok: (s.roe ?? 0) > 15 })
    items.push({ label: '20日趋势', val: (chg20 > 0 ? '+' : '') + (chg20 * 100).toFixed(1) + '%', score: chg20 * 100 > 10 ? 2 : chg20 > 0 ? 1 : -1, max: 2, ok: chg20 > 0 })
    items.push({ label: '距52周高', val: dist52.toFixed(0) + '%', score: dist52 < 10 ? 2 : dist52 < 20 ? 1 : 0, max: 2, ok: dist52 < 20 })
    items.push({ label: '放量突破', val: '量比' + vr.toFixed(1), score: vr > 1.5 ? 2 : vr > 1 ? 1 : 0, max: 2, ok: vr > 1 })
    items.push({ label: 'RSI动能', val: 'RSI' + rsi.toFixed(0), score: rsi > 60 ? 1 : 0, max: 1, ok: rsi > 50 })
    items.push({ label: '机构介入', val: (s.main_flow20 ?? 0) > 0 ? '20日主力流入' : '20日主力流出', score: (s.main_flow20 ?? 0) > 0 ? 1 : 0, max: 1, ok: (s.main_flow20 ?? 0) > 0 })
  } else if (key === 'vcp') {
    const at = kl.slice(-10).map(k => (k.high - k.low) / k.close * 100)
    const squeeze = at.length >= 10 && at.slice(5).reduce((s, v) => s + v, 0) / 5 < at.slice(0, 5).reduce((s, v) => s + v, 0) / 5 * 0.8
    const amp5 = (Math.max(...kl.slice(-5).map(k => k.high)) - Math.min(...kl.slice(-5).map(k => k.low))) / last.close * 100
    items.push({ label: 'VCP收缩', val: squeeze ? '振幅收窄' : '未收缩', score: squeeze ? 3 : 0, max: 3, ok: squeeze })
    items.push({ label: '距52周高', val: dist52.toFixed(0) + '%', score: dist52 < 15 ? 2 : dist52 < 25 ? 1 : 0, max: 2, ok: dist52 < 25 })
    items.push({ label: '放量突破', val: '量比' + vr.toFixed(1), score: vr > 1.5 ? 3 : vr > 1.2 ? 1 : 0, max: 3, ok: vr > 1.2 })
    items.push({ label: '振幅紧密', val: amp5.toFixed(1) + '%', score: amp5 < 8 ? 2 : 0, max: 2, ok: amp5 < 8 })
    items.push({ label: 'ROE', val: (s.roe ?? '--') + '%', score: (s.roe ?? 0) > 15 ? 1 : 0, max: 1, ok: (s.roe ?? 0) > 15 })
  } else if (key === 'stage2') {
    const bull = ma5 && ma10 && ma20 && ma5 > ma10 && ma10 > ma20
    items.push({ label: '30周线上', val: ma60 && last.close > ma60 ? '是' : '否', score: ma60 && last.close > ma60 ? 2 : 0, max: 2, ok: ma60 && last.close > ma60 })
    items.push({ label: '均线多头', val: bull ? 'MA多头' : '否', score: bull ? 2 : ma5 > ma20 ? 1 : 0, max: 2, ok: ma5 > ma20 })
    items.push({ label: '价>MA20', val: last.close > ma20 ? '是' : '否', score: last.close > ma20 ? 1 : 0, max: 1, ok: last.close > ma20 })
    items.push({ label: 'MACD', val: macdDif > 0 && macdBar > 0 ? '多头' : '偏空', score: macdDif > 0 && macdBar > 0 ? 1 : 0, max: 1, ok: macdDif > 0 && macdBar > 0 })
    items.push({ label: '量价配合', val: '--', score: 1, max: 2, ok: true })
    items.push({ label: '20日趋势', val: (chg20 > 0 ? '+' : '') + (chg20 * 100).toFixed(1) + '%', score: chg20 * 100 > 5 ? 1 : 0, max: 1, ok: chg20 > 0 })
  } else if (key === 'wyckoff') {
    items.push({ label: '底部区间', val: (chg20 * 100).toFixed(1) + '%', score: chg20 * 100 > -10 && chg20 * 100 < 10 ? 2 : chg20 * 100 > -20 ? 1 : 0, max: 2, ok: chg20 * 100 > -10 && chg20 * 100 < 10 })
    items.push({ label: '缩量枯竭', val: '量比' + vr.toFixed(1), score: vr < 0.8 ? 2 : vr < 1 ? 1 : 0, max: 2, ok: vr < 0.8 })
    items.push({ label: 'RSI回升', val: 'RSI' + rsi.toFixed(0), score: rsi > 30 && rsi < 55 ? 1 : 0, max: 1, ok: rsi > 30 && rsi < 55 })
    items.push({ label: '主力流入', val: (s.main_flow20 ?? 0) > 0 ? '20日流入' : '20日流出', score: (s.main_flow20 ?? 0) > 0 ? 2 : 0, max: 2, ok: (s.main_flow20 ?? 0) > 0 })
  } else if (key === 'davis') {
    items.push({ label: 'PE偏低', val: 'PE' + (s.pe ?? '--'), score: (s.pe ?? 0) > 0 && (s.pe ?? 0) < 15 ? 2 : (s.pe ?? 0) > 0 && (s.pe ?? 0) < 25 ? 1 : 0, max: 2, ok: (s.pe ?? 0) > 0 && (s.pe ?? 0) < 25 })
    items.push({ label: 'ROE优秀', val: (s.roe ?? '--') + '%', score: (s.roe ?? 0) > 20 ? 2 : (s.roe ?? 0) > 15 ? 1 : 0, max: 2, ok: (s.roe ?? 0) > 15 })
    items.push({ label: 'PB合理', val: 'PB' + (s.pb ?? '--'), score: (s.pb ?? 0) > 0 && (s.pb ?? 0) < 3 ? 1 : 0, max: 1, ok: (s.pb ?? 0) > 0 && (s.pb ?? 0) < 3 })
    items.push({ label: '市值', val: (s.mktcap ?? 0) + '亿', score: (s.mktcap ?? 0) > 100 ? 1 : 0, max: 1, ok: (s.mktcap ?? 0) > 50 })
    items.push({ label: '趋势确认', val: chg20 > 0 ? '上涨' : '下跌', score: chg20 > 0 ? 1 : 0, max: 1, ok: chg20 > 0 })
  }
  const total = items.reduce((s, x) => s + x.score, 0)
  const max = items.reduce((s, x) => s + x.max, 0)
  return { total, max, items }
}
function customScore(s, kl, ind, ana) {
  let total = 0
  const last = kl[kl.length - 1]
  const closes = kl.map(k => k.close)
  const chg20 = last.close / kl[Math.max(0, kl.length - 21)].close - 1
  const high52 = kl.length >= 250 ? Math.max(...kl.slice(-250).map(k => k.high)) : Math.max(...kl.map(k => k.high))
  const dist52 = (high52 - last.close) / high52 * 100
  const rsi = ind.rsi?.[14]?.slice(-1)[0] ?? 50
  const vr = ind.volRatio?.slice(-1)[0] ?? 1
  const ma5 = ind.ma?.[5]?.slice(-1)[0], ma20 = ind.ma?.[20]?.slice(-1)[0]
  const macdDif = ind.macd?.dif?.slice(-1)[0], macdBar = ind.macd?.bar?.slice(-1)[0]
  const volUp = kl.slice(-10).reduce((s, k, i, arr) => i > 0 && arr[i].close > arr[i - 1].close ? s + k.volume : s, 0)
  const volDn = kl.slice(-10).reduce((s, k, i, arr) => i > 0 && arr[i].close <= arr[i - 1].close ? s + k.volume : s, 0)
  const volQual = volUp > volDn * 1.3
  const at = kl.slice(-10).map(k => (k.high - k.low) / k.close * 100)
  const squeeze = at.length >= 10 && at.slice(5).reduce((s, v) => s + v, 0) / 5 < at.slice(0, 5).reduce((s, v) => s + v, 0) / 5 * 0.8
  for (const f of factors) {
    if (!f.on) continue
    let hit = false
    if (f.key === 'trend20' && chg20 > 0) hit = true
    else if (f.key === 'dist52' && dist52 < 25) hit = true
    else if (f.key === 'volBrk' && vr > 1.2) hit = true
    else if (f.key === 'rsi' && rsi > 60) hit = true
    else if (f.key === 'maBull' && ma5 > ma20) hit = true
    else if (f.key === 'vcp' && squeeze) hit = true
    else if (f.key === 'macd' && macdDif > 0 && macdBar > 0) hit = true
    else if (f.key === 'volQual' && volQual) hit = true
    else if (f.key === 'volDry' && vr < 0.8) hit = true
    if (hit) total += f.weight
  }
  return { total, max: factors.filter(f => f.on).reduce((s, f) => s + f.weight, 0), items: [] }
}
function saveBtHist() {
  if (!btResult.value || btResult.value.error) return
  btHistory.value.unshift({ time: new Date().toISOString(), strategy: btStrategy.value, days: btDays.value, count: btCount.value, result: btResult.value })
  btHistory.value = btHistory.value.slice(0, 10)
  localStorage.setItem('sm_backtestHistory', JSON.stringify(btHistory.value))
}
function loadBtHist(h) {
  btResult.value = h.result; btDays.value = h.days; btCount.value = h.count; btStrategy.value = h.strategy
}
function delBtHist(i) {
  btHistory.value.splice(i, 1)
  localStorage.setItem('sm_backtestHistory', JSON.stringify(btHistory.value))
}
const btBest = computed(() => {
  if (!btResult.value?.compare) return null
  const entries = Object.entries(btResult.value.strategies)
  if (!entries.length) return null
  return entries.reduce((best, [k, v]) => (v.winRate * (v.total || 1)) > (best._score || 0) ? { key: k, _score: v.winRate * (v.total || 1) } : best, { _score: 0 }).key
})
function exportCSV() {
  if (!btResult.value?.daily?.length) return
  const rows = ['日期,信号,胜率,均收益,股票,得分,个股收益']
  for (const d of btResult.value.daily) {
    if (d.picks?.length) for (const p of d.picks) rows.push(`${d.date},${d.signals},${d.winRate}%,${d.avgRet}%,${p.name}(${p.code}),${p.score},${p.ret}%`)
    else rows.push(`${d.date},${d.signals},${d.winRate}%,${d.avgRet}%,,,`)
  }
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `backtest_${btStrategy.value}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

// 板块/对比
const sectorName = ref('')
const sectorStocks = ref([])
const sectorLoading = ref(false)
async function goSector(s) {
  sectorName.value = s.name || ''
  view.value = 'sector'
  sectorLoading.value = true
  sectorStocks.value = []
  try { sectorStocks.value = await api.getSectorStocks(s.code || s.name) } catch { sectorLoading.value = false; return }
  sectorLoading.value = false
}
const compareItems = ref([])
const navs = [
  { key: 'home', label: '首页', icon: '🏠' },
  { key: 'overview', label: '总览', icon: '📊' },
  { key: 'predict', label: '预测', icon: '🔮' },
  { key: 'backtest', label: '回测', icon: '🧪' },
]
function goNav(k) {
  view.value = k
  if (k === 'home') { loadList(1); loadMarket() }
  else if (k === 'overview') { loadRealtime(); loadOverview() }
  else if (k === 'predict') { loadPredict(); loadRealtime() }
  else if (k === 'backtest') {}
}
function backHome() {
  view.value = 'home'
  cur.value = null
  stopLive()
}
function onPop() {
  if (view.value !== 'home') backHome()
}

// 设置
const showSettings = ref(false)
const backendUrl = ref(localStorage.getItem('sm_backend_url') || location.origin + '/')
const deepseekKey = ref(localStorage.getItem('sm_deepseek_key') || '')
const backendOk = ref(true)
function saveSettings() {
  localStorage.setItem('sm_backend_url', backendUrl.value)
  localStorage.setItem('sm_deepseek_key', deepseekKey.value)
  showSettings.value = false
  location.reload()
}
async function checkBackend() {
  try { backendOk.value = (await fetch(base + '/api/ping')).ok } catch { backendOk.value = false }
}

// 轮询
let pollTimer = null
function startPoll() {
  pollTimer = setInterval(async () => {
    try {
      if (view.value === 'detail' && cur.value) {
        if (isTrading()) {
          api.getQuote(cur.value.secid).then(q => { if (q?.price != null) quote.value = q }).catch(() => {})
        }
        if (detailTab.value === 'live') liveTick()
      }
      if (view.value === 'home' && st.value === 'stock' && listItems.value.length) {
        const codes = listItems.value.slice(0, 50).map(x => x.secid || x.code).filter(Boolean).join(',')
        if (codes) api.getQuotes(codes).then(map => {
          listItems.value.forEach(x => {
            const m = map[String(x.code || x.secid || '').split('.')[1]]
            if (m && m.price != null) { x.price = m.price; x.change_pct = m.chg }
          })
        }).catch(() => {})
        checkAlerts()
      }
      if (view.value === 'home' && st.value === 'hold') refreshHolds()
      if (view.value === 'overview' && ovTab.value === 'realtime') loadRealtime()
    } catch {}
  }, 10000)
}

// 格式化
const fmtNum = (v) => (v == null || isNaN(v) ? '--' : Number(v).toFixed(2))
const fmtPct = (v) => (v == null || isNaN(v) ? '--' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%')
const fmtVol = (v) => (v == null ? '--' : v >= 1e8 ? (v / 1e8).toFixed(2) + '亿手' : (v / 1e4).toFixed(0) + '万手')
const fmtMoney = (v) => {
  if (v == null || isNaN(v)) return '--'
  const a = Math.abs(v)
  return a >= 1e8 ? (v / 1e8).toFixed(2) + '亿' : a >= 1e4 ? (v / 1e4).toFixed(1) + '万' : v.toFixed(0)
}
const fmtTime = (t) => t ? (String(t).padStart(6, '0').slice(0, 2) + ':' + String(t).padStart(6, '0').slice(2, 4)) : '--'
const scoreCls = (s) => (s >= 70 ? 'hi' : s >= 55 ? 'mid' : 'lo')
function boardName(d) {
  const b = d?.board
  if (typeof b === 'string') return b
  return b?.board || api.boardOf(d?.code || (d?.secid || '').split('.')[1], d?.name)?.board || '主板'
}
function boardTag(d) {
  const b = boardName(d)
  return b !== '主板' ? { board: b } : null
}
const boardIcon = (b) => ({ '科创板': '🔬', '创业板': '🚀', '北交所': '🏛', 'ST': '⚠️' }[b] || '📋')
const volTagCls = computed(() => {
  const vr = quote.value.volRatio
  return vr == null ? '' : vr > 1.2 && (quote.value.change_pct || 0) > 0 ? 'up' : vr > 1.2 && (quote.value.change_pct || 0) < 0 ? 'down' : ''
})
const volTagText = computed(() => {
  const vr = quote.value.volRatio
  return vr == null ? '--' : vr > 1.2 && (quote.value.change_pct || 0) > 0 ? '放量涨 ↑' : vr > 1.2 && (quote.value.change_pct || 0) < 0 ? '放量跌 ↓' : '平量'
})
const lbCls = (n) => (n >= 5 ? 'lb5' : n === 4 ? 'lb4' : n === 3 ? 'lb3' : n === 2 ? 'lb2' : 'lb1')
const maxIndCount = computed(() => Math.max(...(industryStats.value || []).map(s => s.count), 1))
const industryStats = ref([])
const watchAlerts = computed(() => {
  const d = []
  for (const k of watchlist.value) {
    const x = (ztPool.value?.items || []).find(f => f.code === k.code)
    if (x) { d.push({ ...k, icon: '🔥', reason: `${x.limitCount}板 · 封单${fmtMoney(x.seal)}` }); continue }
  }
  return d.slice(0, 5)
})

onMounted(() => {
  window.addEventListener('popstate', onPop)
  loadList(1)
  loadMarket()
  loadZt()
  loadHolds()
  loadHistory()
  loadRealtime()
  initWatchlist()
  loadAiCache()
  checkBackend()
  startPoll()
  if (isTrading()) { try { ydayTrends.value = [] } catch {} }
})

onUnmounted(() => {
  stopLive()
  if (pollTimer) clearInterval(pollTimer)
  window.removeEventListener('popstate', onPop)
})
</script>
