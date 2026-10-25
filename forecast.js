/* 推演 —— 「如果一直这样」
 *
 * 先把一件事说清楚：这一段不是 AI 生成的，是全站唯一那份权重表算出来的。
 * 和左边的大数字用的是同一批数据、同一个 ledger，只是换了一个时间尺度：
 * 大数字看今天，这里看一个月、一年。
 *
 * 为什么不做成模型生成：推演的价值在于「数字可追溯」。模型能换措辞，
 * 但不能换数。一句话里只要有一个数字是编的，整页的可信度就没了。
 *
 * 两条约束（违反即为缺陷）：
 *   1. 不累计额度内的部分。酒精这类有 weeklyCap 的条目，必须走 ledger 的
 *      逐日边际计算，不能拿 minutes × qty × 天数 了事 —— 那会把「没超量」
 *      算成一笔损耗。
 *   2. 只说「累计了多少时间」，不说「少活多少天」。后者是把群体平均值
 *      当成了个人预后，超出了这些研究能支持的范围。
 */
(function () {
  'use strict';

  const W = window.BodyLensWeights;
  const L = window.BodyLensLedger;
  const CAT = window.BodyLensData;
  if (!W || !L) return;

  const $ = sel => document.querySelector(sel);
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const DURATIONS = [
    { key: 'week', label: '1 周', days: 7 },
    { key: 'month', label: '1 个月', days: 30 },
    { key: 'year', label: '1 年', days: 365 }
  ];

  /* 只有「在推演的时间尺度内成立」的数字才进得来。
     含糖饮料、快走这类方向可信但没有折算口径的条目，推演里出现一个编出来的数字，
     比不出现更糟。
     睡眠不足现在有数字了（每少睡 1 小时约 11 分钟），但那个数是从「一辈子少活
     0.94 年」摊到 60 年得出的，前提是长期维持。推演卡最长只看 1 年，比 60 年
     短两个数量级，放进来等于把「一辈子的代价」说成「一年的代价」。所以仍然排除。 */
  const ELIGIBLE = ['smoke', 'alcohol', 'sit'];

  let picked = null;
  let qty = null;
  let duration = 'month';
  let fromToday = false;
  let bound = false;

  function days() {
    return (DURATIONS.find(d => d.key === duration) || DURATIONS[1]).days;
  }

  /* 把「每天一次」铺成真实的日记录，交给 ledger 自己去算。
   * 这样周额度、区间、取整口径全部复用账本的逻辑，这里不重复实现一遍 ——
   * 两套算法迟早会算出两个数，用户一对比就完了。 */
  function accumulate(itemId, perDay, dayCount) {
    const today = L.dayKey();
    const rows = [];
    for (let i = 0; i < dayCount; i++) {
      const date = L.shiftDay(today, -(dayCount - 1) + i);
      rows.push(L.makeEntry(itemId, perDay, date));
    }
    let total = 0;
    for (let i = 0; i < dayCount; i++) {
      const date = L.shiftDay(today, -(dayCount - 1) + i);
      total += L.summarize(rows, date).totalMinutes;
    }
    return total;
  }

  function figure(minutes) {
    const m = Math.abs(minutes);
    if (m < 60) return { value: String(Math.round(m)), unit: '分钟', scale: 1 };
    if (m < 60 * 24 * 2) return { value: (m / 60).toFixed(m < 600 ? 1 : 0), unit: '小时', scale: 60 };
    return { value: (m / 1440).toFixed(1), unit: '天', scale: 1440 };
  }

  /* 类比只在自己算得出来的尺度上用。
     账本的锚点是为「一天」设计的（一集电视剧、一个下午），
     放到一个月上全都超出量程，所以这里另有几条累计尺度的参照物。 */
  function analogy(minutes) {
    const nights = Math.abs(minutes) / 450; /* 7.5 小时算一个整晚 */
    if (nights >= 0.9 && nights < 60) {
      const n = Math.round(nights);
      return '相当于 ' + n + ' 个整晚的睡眠时间';
    }
    const days = Math.abs(minutes) / 1440;
    if (days >= 2 && days < 120) return '相当于 ' + Math.round(days) + ' 个整天';
    const anchor = L.anchorText(Math.abs(minutes));
    return anchor ? '大约等于' + anchor.replace('大约', '') : '';
  }

  /* 默认值跟着今天的记录走：今天真抽了几支，就从那几支起算。
     这样「如果一直这样」问的是用户自己的生活，不是一个虚构的例子。
     只在账本推过来时调用 —— 用户自己调过的数字不该被一次渲染打回去。 */
  function syncFromToday(entries) {
    if (!entries || !entries.length) return false;
    const today = L.dayKey();
    let best = null;
    for (const e of entries) {
      if (e.date !== today || !W.hasNumber(e.itemId) || ELIGIBLE.indexOf(e.itemId) < 0) continue;
      if (!best || Math.abs(e.qty) > Math.abs(best.qty)) best = e;
    }
    if (!best) return false;
    picked = best.itemId;
    qty = Math.max(1, Math.round(best.qty));
    return true;
  }

  /* 引导态：没有记录、用户也还没选过任何行为。
   *
   * 原来这里写死 picked='smoke' qty=3，空账本也会渲染出
   * 「香烟 每天 3 支 · 1 个月 → 30 天」。两件事同时错了：
   * 一是把一个编出来的例子当成用户的生活，二是让不抽烟的人
   * 第一次打开就以为这产品只给烟民做。宁可这张卡空着等，也不替人举例。 */
  function renderEmpty(box) {
    box.dataset.tone = 'idle';
    box.innerHTML =
      '<div class="fc-head"><span class="fc-title">如果一直这样</span><span class="tiny-label">IF THIS CONTINUES</span></div>' +
      '<p class="fc-empty-lead">这张卡还没有数字，因为还不知道你的一天是什么样。</p>' +
      '<p class="fc-empty-body">它做的事是：把你今天的量铺成一个月、一年来算。上面还没记过东西，所以它没有起点 —— 与其编一个例子，不如等你自己说。</p>' +
      '<div class="fc-controls fc-controls-empty">' +
        '<span class="fc-empty-or">想先看看它是怎么算的，选一项：</span>' +
        '<div class="fc-behaviors" role="group" aria-label="选择要推演的行为">' +
          ELIGIBLE.map(id => {
            const it = W.get(id);
            return '<button type="button" data-fc-pick="' + id + '" aria-pressed="false">' + esc(it.name) + '</button>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  function render(entries) {
    const box = $('#today-forecast');
    if (!box) return;

    /* 只有账本推过来（带 entries）时才重新对齐今天；
       用户在这里点加减时走的是 render()，那次不该把选择打回去。 */
    if (entries) fromToday = syncFromToday(entries);

    if (!picked) {
      renderEmpty(box);
      if (!bound) {
        box.addEventListener('click', onClick);
        bound = true;
      }
      return;
    }

    const item = W.get(picked);
    if (!item) { renderEmpty(box); return; }
    if (!qty) qty = item.presets[Math.min(1, item.presets.length - 1)];

    const total = accumulate(picked, qty, days());
    const f = figure(total);
    const ana = analogy(total);
    const organs = (item.organs || []).slice(0, 4)
      .map(id => (CAT && CAT.organs[id] ? CAT.organs[id].name : id)).join(' · ');
    const source = W.sources[item.source];
    const durLabel = (DURATIONS.find(d => d.key === duration) || DURATIONS[1]).label;

    box.dataset.tone = item.tone;

    box.innerHTML =
      '<div class="fc-head"><span class="fc-title">如果一直这样</span>' +
        '<span class="fc-origin' + (fromToday ? ' is-today' : '') + '">' + (fromToday ? '按今天的记录' : '示例情境') + '</span>' +
      '</div>' +
      '<div class="fc-controls">' +
        '<div class="fc-behaviors" role="group" aria-label="选择要推演的行为">' +
          ELIGIBLE.map(id => {
            const it = W.get(id);
            return '<button type="button" data-fc-pick="' + id + '" aria-pressed="' + (id === picked) + '">' + esc(it.name) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="fc-qty" role="group" aria-label="每天的数量">' +
          '<span>每天</span>' +
          '<button type="button" data-fc-step="-1" aria-label="减少数量">−</button>' +
          '<b>' + qty + '</b><i>' + esc(item.unit) + '</i>' +
          '<button type="button" data-fc-step="1" aria-label="增加数量">＋</button>' +
        '</div>' +
        '<div class="fc-durations" role="group" aria-label="持续多久">' +
          DURATIONS.map(d => '<button type="button" data-fc-duration="' + d.key + '" aria-pressed="' + (d.key === duration) + '">' + d.label + '</button>').join('') +
        '</div>' +
      '</div>' +
      '<div class="fc-result">' +
        '<div class="fc-figure-wrap"><span class="fc-figure">' + esc(f.value) + '</span><span class="fc-unit">' + esc(f.unit) + '</span></div>' +
        (ana ? '<p class="fc-analogy">' + esc(ana) + '</p>' : '') +
        '<p class="fc-line">每天 ' + qty + ' ' + esc(item.unit) + '，' + durLabel + '累计。' +
          (organs ? '主要落在 <b>' + esc(organs) + '</b>。' : '') + '</p>' +
      '</div>' +
      '<p class="fc-note">' +
        esc(source.org) + (source.year ? ' ' + esc(source.year) : '') + ' 的折算口径 · 按每天相同量线性累计。' +
        '这是一个群体平均值，不是对你个人能活多久的预测；' +
        (item.weeklyCap ? '额度以内的部分不计入。' : '') +
      '</p>';

    if (!bound) {
      box.addEventListener('click', onClick);
      bound = true;
    }
  }

  function onClick(event) {
    const btn = event.target.closest('button');
    if (!btn) return;
    let changed = false;

    if (btn.dataset.fcPick) {
      picked = btn.dataset.fcPick;
      const presets = (W.get(picked) || {}).presets || [1];
      /* 换行为就换一套数量档位。只有 qty 落在档位外才重置，
         免得用户刚调好的数字被一次点击抹掉。 */
      if (!qty || qty < presets[0] || qty > presets[presets.length - 1]) {
        qty = presets[Math.min(1, presets.length - 1)];
      }
      changed = true;
    }
    if (btn.dataset.fcStep) {
      const item = W.get(picked);
      const step = Number(btn.dataset.fcStep);
      /* 步进走整数，不锁死在预设档位上。
         研究给的是「每单位多少分钟」的线性关系，3 支和 5 支同样成立，
         锁档反而让「我只是抽得比 2 支多一点」的人对不上号。 */
      const ceiling = item.presets[item.presets.length - 1];
      qty = Math.max(1, Math.min(ceiling, qty + step));
      changed = true;
    }
    if (btn.dataset.fcDuration) {
      duration = btn.dataset.fcDuration;
      changed = true;
    }
    if (changed) render();
  }

  window.BodyLensForecast = { render: render };
})();
