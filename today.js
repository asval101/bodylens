/* 今天的账本 —— 左栏渲染层 + 与右栏身体的数据桥
 * 只负责「读权重 → 算 → 显示」，所有计算都在 ledger.js / weights.js 里。
 * 不写死任何分钟数，不从别处复制数字。
 *
 * 合并成一页之后，这里多了一个职责：把今天的记录翻译成资料库能认的情境，
 * 让右边的人体亮在该亮的地方。这是全站唯一的一处转换，别的模块不许再写一遍。
 */
(function () {
  'use strict';

  const W = window.BodyLensWeights;
  const L = window.BodyLensLedger;
  const I = window.BodyLensInterpret;
  const AI = window.BodyLensAI;
  const CAT = window.BodyLensData;
  if (!W || !L) return;

  const KEY = 'bodylens-ledger-v1';
  const $ = sel => document.querySelector(sel);
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* 账本的行为 id → 资料库的行为 id。
   * 两边命名不同（账本只收能折算的八项，资料库为每个行为写了一条证据），
   * 这张表是唯一的桥。app.js 里还有一张反向的表，加新行为时两处都要登记。 */
  /* 权重项 → 资料库行为。这张表决定「人体上哪些器官会亮」，
   * 必须和 weights 里那条的 organs 对得上，否则文字说涉及 A·B，人体只亮 A。
   * sit 指向 tv-sit 而不是 sit：权重那边的证据是「看电视时长与预期寿命」
   * （BJSM 2011），而 tv-sit 的资料同时含心脏与眼表两条，正好覆盖
   * weights 里 sit 的 ['heart','eyes']。资料库的 sit 是「连续久坐」，
   * 只有心血管一条，直接用它会让眼睛永远亮不起来。 */
  const CATALOG_OF = {
    smoke: 'smoke',
    alcohol: 'alcohol',
    shortSleep: 'short-sleep',
    sit: 'tv-sit',
    sugar: 'sugary',
    walk: 'walk',
    sleep: 'enough-sleep',
    quit: 'quit'
  };

  let entries = [];
  let storeError = '';
  /* 初始不预选任何行为。原来写死 'smoke'，第一次打开的人看到的第一个高亮就是香烟，
     推演卡更直接写着「香烟 每天 3 支」——像是只给烟民做的。
     选中的事应该由用户自己说，不该由我们替他决定。 */
  let pickedItem = null;
  /* 刚记下的那一笔，用来在账本里高亮一下。不是状态，只是「让它闪一下」的标记。 */
  let justAdded = null;
  let shownTotal = null;

  function prefersReduce() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* 数字从旧值滚到新值，而不是瞬间跳。
     瞬间跳会让人以为两个数没有关系；滚过去才看得出「这一笔加在了原来那个数上」。 */
  function tweenNumber(el, from, to, dur) {
    if (prefersReduce()) { el.textContent = to; return; }
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- 给右栏身体用的两个接口 ---------- */
  function todaySummary() {
    return L.summarize(entries, L.dayKey());
  }

  /* 今天的记录 → 资料库情境。同一个行为记两次只取一次，器官不需要亮两遍。 */
  function scenario() {
    const today = L.dayKey();
    const ids = [];
    for (const e of entries) {
      if (e.date === today && !ids.includes(e.itemId)) ids.push(e.itemId);
    }
    return ids
      .map(id => CATALOG_OF[id])
      .filter(Boolean)
      .map(id => ({ id: id, scenario: 0, duration: '今天 / 单次' }));
  }

  function organSummary() {
    return L.organsFor(entries, L.dayKey());
  }

  /* 文字版的落点：窄屏没有人体时，这行是唯一的信息来源，所以不能省。 */
  function renderOrganLine() {
    const org = organSummary();
    const el = $('#today-organs');
    if (!el) return;
    const list = org.harm.concat(org.gain);
    if (!list.length) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    /* 只列前四个。七个器官全铺开会让这行变成一堵字墙，
       而且和上面的大数字抢注意力——它的作用是说明「有点的地方是哪」，
       不是把全部清单念一遍。 */
    const head = list.slice(0, 4);
    const rest = list.length - head.length;
    const names = head.map(id => (CAT && CAT.organs[id] ? CAT.organs[id].name : id)).join(' · ');
    el.innerHTML = '涉及 <b>' + esc(names) + '</b>' + (rest > 0 ? ' 等 ' + list.length + ' 处' : '');
    el.hidden = false;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return L.cleanEntries(parsed && parsed.entries);
    } catch (e) {
      storeError = '本地记录读取失败，已从空白开始。之前的记录可能已被浏览器清除。';
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, entries: entries }));
      storeError = '';
    } catch (e) {
      storeError = '本地保存失败：浏览器可能禁用了存储，或空间已满。这一笔只留在当前页面，关闭后会丢失。';
    }
  }

  /* 账本上方的一句话反馈。记账和撤销都要出声，
     否则「点了但没反应」和「点了记错了」在界面上长得一样。 */
  let noticeText = '';
  let noticeTimer = null;
  function notice(text) {
    noticeText = text;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { noticeText = ''; renderLog(); }, 3600);
  }

  function add(itemId, qty) {
    try {
      entries.push(L.makeEntry(itemId, qty));
      justAdded = itemId;
      save();
      const item = W.get(itemId);
      /* 说的是「这一笔记了什么」，不是「现在一共多少」。
       * 原来只写「记上了：香烟 2 支」，连续记两次会看不出是累加还是覆盖。 */
      const today = L.dayKey();
      const total = entries
        .filter(e => e.date === today && e.itemId === itemId)
        .reduce((sum, e) => sum + Number(e.qty || 0), 0);
      notice('新增 ' + qty + ' ' + item.unit + '，今天累计 ' + (Math.round(total * 10) / 10) + ' ' + item.unit);
      render();
    } catch (e) {
      // 数量或行为非法时不动账本，避免脏数据进入记录
      storeError = e.message;
      render();
    }
  }

  /* 撤销的是**最后一笔**，不是这一项今天的全部。
     记错了想退一步，结果整项被清掉，那等于用小错换大错。 */
  function undoLast(itemId) {
    const today = L.dayKey();
    let index = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].date === today && entries[i].itemId === itemId) { index = i; break; }
    }
    if (index < 0) return;
    const removed = entries[index];
    const item = W.get(removed.itemId);
    entries.splice(index, 1);
    justAdded = null;
    save();
    const today2 = L.dayKey();
    const rest = entries
      .filter(e => e.date === today2 && e.itemId === removed.itemId)
      .reduce((sum, e) => sum + Number(e.qty || 0), 0);
    notice(rest > 0
      ? '撤销了最后一笔 ' + removed.qty + ' ' + item.unit + '，今天还剩 ' + (Math.round(rest * 10) / 10) + ' ' + item.unit
      : '撤销了最后一笔，' + item.name + ' 今天没有记录了');
    render();
  }

  /* ---------- 焦点一 ---------- */
  function renderHero() {
    const today = L.dayKey();
    const s = L.summarize(entries, today);
    const y = L.summarize(entries, L.shiftDay(today, -1));
    const numEl = $('#today-number');
    const unitEl = $('#today-unit');
    const anchorEl = $('#today-anchor');
    const cmpEl = $('#today-compare');
    if (!numEl) return;

    numEl.classList.remove('is-empty', 'is-credit');
    /* 「这个数是怎么来的」藏在折叠里，要先点开才看得到它是估算。
       可数字是屏幕上最大的那个东西，人先读到它、先信它。
       所以这一行常驻，不用展开。 */
    const estEl = $('#today-estimate');

    if (s.counted === 0) {
      if (estEl) estEl.hidden = true;
      /* 只记了「快走」「睡够」这类没有折算口径的事时，原来一律显示「还没开始」——
         人明明做了一件好事，界面回他一句「还没开始」。这里改成承认它记下了。 */
      const gains = s.noted.filter(r => { const it = W.get(r.itemId); return it && it.tone === 'benefit'; });
      const harms = s.noted.filter(r => { const it = W.get(r.itemId); return !it || it.tone !== 'benefit'; });
      numEl.textContent = s.noted.length ? '已记下 ' + s.noted.length + ' 项' : '还没开始';
      numEl.classList.add('is-empty');
      unitEl.textContent = '';
      shownTotal = null;
      if (gains.length) {
        anchorEl.textContent = gains.map(r => r.name + ' ' + r.qty + ' ' + r.unit).join('、') +
          '，记下了。这类事没有可折算的分钟数，所以上面的数字不动 —— 但它确实发生了。';
      } else if (harms.length) {
        anchorEl.textContent = '今天记了 ' + harms.length + ' 项，但这些行为没有可靠的折算口径，所以这里不给分钟数。';
      } else {
        anchorEl.textContent = '先选一件今天发生的事，再点一下数量，第一笔就记上了。';
      }
      cmpEl.textContent = '';
      renderOrganLine();
      return;
    }

    const abs = Math.abs(s.totalMinutes);
    if (estEl) estEl.hidden = false;
    /* 大数字只取整：21.8 这种权重累加后会出现小数，而小数在这里传递的是假精度 */
    const target = Math.round(abs);
    if (shownTotal === null || shownTotal === target) {
      numEl.textContent = target;
    } else {
      tweenNumber(numEl, shownTotal, target, 620);
    }
    shownTotal = target;
    unitEl.textContent = '分钟';
    renderOrganLine();

    if (abs === 0) {
      /* 有记录但没有超出任何门槛，这里给正面反馈而不是留一片空 */
      anchorEl.innerHTML = '今天没有超出建议量的部分，账是平的。';
      cmpEl.textContent = '';
      return;
    }

    const anchor = L.anchorText(abs);
    anchorEl.innerHTML = anchor
      ? '大约等于 <em>' + esc(anchor.replace('大约', '')) + '</em>'
      : '';

    const c = L.compare(s, y);
    if (!c.hasPrev) {
      cmpEl.textContent = '昨天没有记录，今天是第一天。';
    } else if (c.delta > 0) {
      cmpEl.innerHTML = '<span class="up">比昨天少 ' + esc(L.formatMinutes(c.delta)) + '</span>　—　继续';
    } else if (c.delta < 0) {
      cmpEl.innerHTML = '<span class="down">比昨天多 ' + esc(L.formatMinutes(-c.delta)) + '</span>';
    } else {
      cmpEl.textContent = '和昨天持平。';
    }
  }

  /* ---------- 焦点二：记一笔 ---------- */
  function renderEntry() {
    const chips = $('#today-entry-chips');
    const qtyBox = $('#today-entry-qty');
    if (!chips || !qtyBox) return;

    chips.innerHTML = W.order.map((id, i) => {
      const item = W.get(id);
      const picked = id === pickedItem;
      return '<button type="button" class="entry-chip' + (picked ? ' is-picked' : '') + '"' +
        ' style="--i:' + i + '"' +
        ' data-pick="' + id + '" aria-pressed="' + picked + '">' + esc(item.name) + '</button>';
    }).join('');

    /* 没选行为时不铺数量按钮。先铺上的话，人会先点数字——
       那一步点下去记的是我们默认挑的那一项，不是他想记的那一项。 */
    if (!pickedItem) {
      qtyBox.innerHTML = '<span class="qty-hint is-lead">先选上面的一件，再点数量</span>';
      return;
    }

    const item = W.get(pickedItem);
    const hintText = item.hint || (W.hasNumber(pickedItem) ? '会折算成分钟' : '只记录，不折算分钟');
    /* 加号是给「点下去是加一笔」这件事看的。
     * 原来写「2 支」，点了两次变成 3 支时人会以为按钮是「设成 2 支」，
     * 会觉得记错了。写成 +2 支，动作和结果就一致了。 */
    qtyBox.innerHTML = item.presets.map((n, i) =>
      '<button type="button" class="qty-btn" style="--i:' + i + '" data-add="' + pickedItem + '" data-qty="' + n + '" title="再记 ' + n + ' ' + esc(item.unit) + '">+' + n + ' ' + esc(item.unit) + '</button>'
    ).join('') + '<span class="qty-hint">' + esc(hintText) + '</span>';
  }

  /* ---------- 焦点三：今天记了什么 ---------- */
  function renderLog() {
    const box = $('#today-log');
    if (!box) return;
    const s = L.summarize(entries, L.dayKey());
    const rows = [];

    for (const row of s.byItem) {
      const item = W.get(row.itemId);
      /* 正向条目（快走、睡够、没抽烟）原来是跟损耗一样画成「− 15 分钟」的陶土橙，
         做了好事在账本上长得像又亏了一笔。方向不同，符号和颜色就得不同。 */
      const gain = !!(item && item.tone === 'benefit');
      const sign = gain ? '＋' : '−';
      let valueHtml;
      if (row.withinCap) {
        valueHtml = '<span class="log-value qualitative">本周额度内</span>';
      } else if (item && item.range) {
        const lo = Math.round(Math.abs(item.range[0]) * row.qty);
        const hi = Math.round(Math.abs(item.range[1]) * row.qty);
        valueHtml = '<span class="log-value has-range' + (gain ? ' is-gain' : '') + '" title="研究给出的不确定区间">' + sign + Math.round(Math.abs(row.minutes)) +
          ' <em>分钟</em><small>区间 ' + lo + '–' + hi + '</small></span>';
      } else {
        valueHtml = '<span class="log-value' + (gain ? ' is-gain' : '') + '">' + sign + Math.round(Math.abs(row.minutes)) + ' 分钟</span>';
      }
      rows.push('<div class="log-line' + (justAdded === row.itemId ? ' is-new' : '') + '">' +
        '<span class="who"><b>' + esc(row.name) + '</b><span>' + row.qty + ' ' + esc(row.unit) + '</span></span>' +
        valueHtml +
        '<button type="button" class="log-del" data-remove="' + row.itemId + '" title="撤销最后一笔 ' + esc(row.name) + '" aria-label="撤销最后一笔' + esc(row.name) + '记录">×</button>' +
        '</div>');
    }
    for (const row of s.noted) {
      const it = W.get(row.itemId);
      const gain = !!(it && it.tone === 'benefit');
      rows.push('<div class="log-line' + (justAdded === row.itemId ? ' is-new' : '') + '">' +
        '<span class="who"><b>' + esc(row.name) + '</b><span>' + row.qty + ' ' + esc(row.unit) + '</span></span>' +
        /* 「仅记录」写在快走上像在说「这笔记了也白记」。好事要被认下来，
           但也不给分钟数——收益和损耗不互相抵消，这条不能松。 */
        (gain
          ? '<span class="log-value is-gain">已记下</span>'
          : '<span class="log-value qualitative">仅记录</span>') +
        '<button type="button" class="log-del" data-remove="' + row.itemId + '" title="撤销最后一笔 ' + esc(row.name) + '" aria-label="撤销最后一笔' + esc(row.name) + '记录">×</button>' +
        '</div>');
    }

    const noticeHtml = noticeText ? '<div class="log-notice" role="status">' + esc(noticeText) + '</div>' : '';

    if (!rows.length) {
      box.innerHTML = noticeHtml + '<div class="log-empty">今天还没有记录。<br><b>先从最想改的那一件开始记。</b></div>';
      return;
    }
    box.innerHTML = noticeHtml + '<div class="log-head"><span>今天记了 ' + (s.byItem.length + s.noted.length) + ' 项</span><span>折合</span></div>' + rows.join('');
  }

  /* ---------- 次级：近 7 天 ---------- */
  function renderTrend() {
    const box = $('#today-trend');
    if (!box) return;
    const today = L.dayKey();
    const rows = L.dailyTotals(entries, today, 7);
    const peak = Math.max.apply(null, rows.map(r => Math.abs(r.totalMinutes)).concat([1]));
    const names = ['日', '一', '二', '三', '四', '五', '六'];

    const bars = rows.map(r => {
      const abs = Math.abs(r.totalMinutes);
      const h = abs ? Math.max(3, Math.round(abs / peak * 100)) : 0;
      const isToday = r.date === today;
      return '<div class="trend-col' + (isToday ? ' is-today' : '') + (abs ? '' : ' is-zero') + '">' +
        '<div class="trend-bar" style="height:' + h + '%"></div>' +
        '</div>';
    }).join('');

    const days = rows.map(r => {
      const d = new Date(r.date + 'T00:00:00');
      const isToday = r.date === today;
      return '<div class="trend-col' + (isToday ? ' is-today' : '') + '">' +
        '<span class="trend-day">' + (isToday ? '今天' : '周' + names[d.getDay()]) + '</span>' +
        '</div>';
    }).join('');

    /* 「还没有数据」和「记了，但没有可折算的分钟」是两件事。
       只记快走的人看到「还没有数据」，会以为刚才那笔没记上。
       所以先看这几天到底有没有条目，有就承认有。 */
    const dates = rows.map(r => r.date);
    const notedCount = entries.filter(e => dates.indexOf(e.date) !== -1).length;
    const trendNote = peak > 1
      ? '最高 ' + L.formatMinutes(peak)
      : (notedCount ? '记了 ' + notedCount + ' 项，暂无分钟数' : '还没有数据');

    box.innerHTML = '<div class="trend-head"><span>近 7 天</span><span>' + trendNote + '</span></div>' +
      '<div class="trend-bars">' + bars + '</div>' +
      '<div class="trend-days">' + days + '</div>';
  }

  /* ---------- 解读下面的行动 ----------
   * 「看完一句建议，接下来能做什么」不该再点两下才找到。
   * 原来「加入今日计划」只藏在右边器官详情的第三个标签页里，
   * 于是解读说得再好，话和行动之间还隔着一次导航。
   * 现在把今天的记录直接翻成一条能立刻收下的小事，按钮就在这句话后面。 */
  /* 这一项今天是不是已经在计划里。
   * 计划存在 app.js 的 'bodylens-user-v1' 里，这里只读不写 ——
   * 写入永远走 app.js 那一份，两个模块各存一份就等于有两个真相。 */
  function inPlanToday(catalogId) {
    try {
      const raw = localStorage.getItem('bodylens-user-v1');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      /* app.js 存的是 {schemaVersion, dataVersion, data:state}，
       * tasks 在 data 里面。直接读 parsed.tasks 会永远是空数组。 */
      const tasks = (parsed.data && parsed.data.tasks) || parsed.tasks || [];
      const today = L.dayKey();
      return tasks.some(t => t.date === today && t.behavior === catalogId);
    } catch (e) {
      return false;
    }
  }

  function renderActions() {
    const box = $('#today-actions');
    if (!box || !I || !I.ACTIONS) return;
    const s = L.summarize(entries, L.dayKey());
    const seen = [];
    const list = [];
    for (const row of s.byItem.concat(s.noted)) {
      if (seen.indexOf(row.itemId) !== -1) continue;
      seen.push(row.itemId);
      const catalogId = CATALOG_OF[row.itemId];
      if (!catalogId) continue;
      /* 文案必须和「加入计划」真正存进去的那句是同一句。
       * 原来这里读的是 interpret 的 ACTIONS（「想少一点，从今天少一支开始」），
       * 而 app.js 存的是资料库条目的 action（「为自己写下一个戒烟理由，
       * 安排一次戒烟咨询」）—— 用户确认的是 A，落到计划里是 B。
       * 现在就取 action 本身，看到什么就存什么。 */
      const beh = CAT && CAT.behaviors ? CAT.behaviors.find(b => b.id === catalogId) : null;
      const text = (beh && beh.action) || I.ACTIONS[row.itemId];
      if (!text) continue;
      list.push({ name: row.name, text: text, catalogId: catalogId, added: inPlanToday(catalogId) });
    }
    actionsOn = list.length > 0;
    if (!actionsOn) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    const head = list.length > 1 ? '今天可以试的几件小事' : '今天可以试的一件小事';
    box.innerHTML =
      '<div class="actions-head"><span>' + head + '</span><span class="tiny-label">ONE SMALL STEP</span></div>' +
      '<ul class="action-list">' + list.slice(0, 3).map(a =>
        '<li><p class="action-text"><span class="action-why">' + esc(a.name) + '</span>' + esc(a.text) + '</p>' +
        (a.added
          /* 已经收下的按钮不该还在邀请你收一次。改成去计划里看，
             而不是留一个点下去只会弹「已经在计划中了」的按钮。 */
          ? '<a class="action-add is-added" href="#plan">已在今日计划 · 去查看 ›</a>'
          : '<button type="button" class="action-add" data-add-plan="' + a.catalogId + '">加入今日计划 ＋</button>') +
        '</li>'
      ).join('') + '</ul>';
    box.hidden = false;
  }

  /* ---------- 解读 ----------
   * 分工是刻意的：数字永远由 ledger 算，模型只负责把数字说成人话。
   * 所以 lead 那行永远是本地算出来的结论，模型只替换下面的正文。
   * 在线失败、超时、没有密钥，正文都会退回本地规则文本，界面不报错。 */
  let aiToken = 0;
  let aiTimer = null;
  /* 行动按钮是否已经显示。paintAI 用它决定还要不要再说一句 hint。 */
  let actionsOn = false;

  function paintAI(view) {
    const leadEl = $('#ai-lead');
    const bodyEl = $('#ai-body');
    const hintEl = $('#ai-hint');
    const tagEl = $('#ai-tag');
    const noteEl = $('#ai-note');
    const retryEl = $('#ai-retry');
    if (!leadEl || !bodyEl) return;

    const tag = view.tag || '本地解读';
    leadEl.textContent = view.headline || '';
    bodyEl.textContent = view.body || '';
    bodyEl.classList.toggle('is-live', tag === '正在读');

    if (hintEl) {
      /* 行动按钮已经摆在下面时，不再把同一句话念一遍 ——
         hint 和行动区读的是同一份 ACTIONS，重复就成了啰嗦。 */
      const show = !!view.hint && !actionsOn;
      hintEl.hidden = !show;
      hintEl.textContent = show ? view.hint : '';
    }
    if (tagEl) {
      tagEl.textContent = tag;
      tagEl.dataset.source = tag === 'AI 解读' ? 'model' : tag === '正在读' ? 'busy' : 'local';
    }
    if (noteEl) {
      noteEl.hidden = !view.note;
      noteEl.textContent = view.note || '';
    }
    /* 失败时也要给出重试入口：AI 层一旦把「离线」记进 sessionStorage，
       同一标签页里不会再自动尝试，没有按钮用户就只能关页面。 */
    if (retryEl) {
      retryEl.hidden = !(tag === 'AI 解读' || !!view.note);
      retryEl.textContent = view.note ? '重试在线解读' : '换个说法';
    }
  }

  function renderAI() {
    const section = $('#today-ai');
    if (!section || !I) return;

    const today = L.dayKey();
    const s = L.summarize(entries, today);
    const prev = L.summarize(entries, L.shiftDay(today, -1));
    const cmp = L.compare(s, prev);
    const week = L.dailyTotals(entries, today, 7);
    const base = I.local(s, cmp);

    aiToken += 1;
    const token = aiToken;
    clearTimeout(aiTimer);
    section.dataset.stance = base.stance;

    const canModel = !!(AI && AI.available() && s.counted > 0);
    /* 冷却期也要说清楚。不解释的话，用户只会看到"怎么一直是本地解读"，
       误以为在线功能压根没接上——实际上只是刚才失败过、需要等一下或手动重试。 */
    const cooling = !!(AI && s.counted > 0 && AI.reason && AI.reason() === 'cooling');
    paintAI({
      headline: base.headline,
      body: base.detail,
      hint: base.hint,
      tag: '本地解读',
      note: cooling ? '在线解读刚才没接上，先给本地版本。点右侧可以立刻重试。' : ''
    });

    if (!canModel) return;

    const payload = I.payload(s, cmp, week);
    aiTimer = setTimeout(() => {
      if (token !== aiToken) return;
      paintAI({ headline: base.headline, body: base.detail, hint: base.hint, tag: '正在读' });
      let text = '';
      AI.enhance(payload, {
        onChunk(chunk) {
          if (token !== aiToken) return;
          text += chunk;
          const bodyEl = $('#ai-body');
          if (bodyEl) bodyEl.textContent = text;
        },
        onDone() {
          if (token !== aiToken) return;
          const clean = text.trim();
          if (clean) paintAI({ headline: base.headline, body: clean, hint: base.hint, tag: 'AI 解读' });
        },
        onFail(error) {
          if (token !== aiToken) return;
          const note = error && error.temporary
            ? '这一分钟问得太频繁，先用本地解读。'
            : '在线解读这次没接上，下面是本地规则版本。';
          paintAI({ headline: base.headline, body: base.detail, hint: base.hint, tag: '本地解读', note: note });
        }
      });
    }, 700);
  }

  /* 记录一变，右栏就得跟着变。autoFocus 只在「从空到有」时传 true。 */
  function notifyBody() {
    const api = window.BodyLensBody;
    if (!api || typeof api.refresh !== 'function') return;
    const s = L.summarize(entries, L.dayKey());
    api.refresh(s.counted > 0 || s.noted.length > 0);
  }

  function render() {
    const page = document.getElementById('page-today');
    if (!page) return;
    const warn = $('#today-storage-warn');
    if (warn) {
      warn.hidden = !storeError;
      warn.textContent = storeError;
    }
    renderHero();
    renderEntry();
    renderLog();
    /* 先算行动，再算解读：解读里的那句建议要据此决定说不说。 */
    renderActions();
    renderAI();
    renderTrend();
    notifyBody();
    if (window.BodyLensForecast) window.BodyLensForecast.render(entries);
  }

  function bind() {
    const page = document.getElementById('page-today');
    if (!page) return;

    page.addEventListener('click', event => {
      const pickBtn = event.target.closest('[data-pick]');
      if (pickBtn) {
        pickedItem = pickBtn.dataset.pick;
        renderEntry();
        return;
      }
      const addBtn = event.target.closest('[data-add]');
      if (addBtn) {
        add(addBtn.dataset.add, Number(addBtn.dataset.qty));
        return;
      }
      const delBtn = event.target.closest('[data-remove]');
      if (delBtn) {
        undoLast(delBtn.dataset.remove);
        return;
      }
      /* 加入计划这件事由 app.js 负责存，这里只等它存完之后把按钮改成
         「已在今日计划」。存和显示分开，但看到的状态必须是真的。 */
      const planBtn = event.target.closest('[data-add-plan]');
      if (planBtn) {
        setTimeout(renderActions, 220);
      }
    });

    const retryBtn = $('#ai-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        if (AI) AI.clearOffline();
        renderAI();
      });
    }

    window.addEventListener('hashchange', () => {
      if (location.hash.replace('#', '') === 'today') render();
    });

    // 跨过零点时把「今天」滚到新的一天，避免页面停在前一天的账上
    let lastDay = L.dayKey();
    setInterval(() => {
      const now = L.dayKey();
      if (now !== lastDay) {
        lastDay = now;
        render();
      }
    }, 30000);
  }

  /* 资料库的「记一笔」跳过来时用它预选行为。 */
  window.BodyLensToday = {
    scenario: scenario,
    summary: todaySummary,
    pick(itemId) {
      if (!W.get(itemId)) return;
      pickedItem = itemId;
      renderEntry();
      $('#today-entry-qty') && $('#today-entry-qty').scrollIntoView({ behavior: prefersReduce() ? 'instant' : 'smooth', block: 'center' });
    }
  };

  function init() {
    entries = load();
    bind();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
