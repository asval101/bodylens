/* 账本领域逻辑（纯函数，无 DOM）
 *
 * 设计要点：
 *   1. 记录里**不存分钟数**。分钟永远由 weights.js 实时算出，改一次权重全站同步。
 *      冗余存储派生值是两套数字打架的根源，之前已经吃过一次亏。
 *   2. 没有可靠口径的行为照样能记账，只是不进分钟合计（counted / noted 分开统计）。
 *   3. 所有对外的百分比、合计、对比都在这里算，界面只负责显示。
 */
(function (root, factory) {
  const W = (typeof module !== 'undefined' && module.exports)
    ? require('./data/weights.js')
    : root.BodyLensWeights;
  const api = factory(W);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BodyLensLedger = api;
})(typeof window === 'undefined' ? globalThis : window, function (W) {
  'use strict';

  /* 类比参照物。0.5×–2× 区间内才用，超出就换下一档 —— 见 docs/TIME-ANCHORS.md */
  const ANCHORS = [
    { at: 10, unit: '碗泡面' },
    { at: 20, unit: '集短剧' },
    { at: 45, unit: '集电视剧' },
    { at: 90, unit: '部电影' },
    { at: 180, unit: '个下午' },
    { at: 420, unit: '个晚上的睡眠' },
    { at: 1440, unit: '天' },
    { at: 10080, unit: '周' }
  ];

  function pad(n) { return String(n).padStart(2, '0'); }

  function dayKey(date) {
    const d = date instanceof Date ? date : new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function shiftDay(key, delta) {
    const parts = String(key).split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + delta);
    return dayKey(d);
  }

  function isDayKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const p = value.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }

  /* 一条记录：{ id, date, itemId, qty, at } */
  function makeEntry(itemId, qty, date, now) {
    const item = W.get(itemId);
    if (!item) throw new Error('未收录的行为：' + itemId);
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0 || n > 1000) throw new Error('数量必须是 0 到 1000 之间的数');
    const key = date || dayKey(now || new Date());
    if (!isDayKey(key)) throw new Error('日期格式不正确');
    return {
      id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      date: key,
      itemId,
      qty: Math.round(n * 100) / 100,
      at: (now || new Date()).toISOString()
    };
  }

  function cleanEntries(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    for (const e of raw) {
      if (!e || typeof e !== 'object') continue;
      if (typeof e.id !== 'string' || seen.has(e.id)) continue;
      if (!W.get(e.itemId)) continue;
      if (!isDayKey(e.date)) continue;
      const qty = Number(e.qty);
      if (!Number.isFinite(qty) || qty <= 0 || qty > 1000) continue;
      seen.add(e.id);
      out.push({
        id: e.id,
        date: e.date,
        itemId: e.itemId,
        qty: Math.round(qty * 100) / 100,
        at: typeof e.at === 'string' && Number.isFinite(Date.parse(e.at)) ? e.at : e.date + 'T00:00:00.000Z'
      });
    }
    return out;
  }

  /* 该日所在的自然周起始（周一）。用于带周额度的行为做边际计算。 */
  function weekStart(key) {
    const d = new Date(key + 'T00:00:00');
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    return shiftDay(key, -dow);
  }

  /* 带 weeklyCap 的行为：只有超出本周额度的那部分才计入分钟。
   * 用「今日之后的超出量 − 今日之前的超出量」求边际，而不是简单按量相乘，
   * 否则用户会在额度内也看到损耗，数字与研究的成立前提不一致。 */
  function cappedMinutes(entries, itemId, key) {
    const item = W.get(itemId);
    const list = entries || [];
    const todayQty = list
      .filter(e => e.date === key && e.itemId === itemId)
      .reduce((sum, e) => sum + e.qty, 0);
    if (!todayQty) return 0;
    const start = weekStart(key);
    const beforeQty = list
      .filter(e => e.itemId === itemId && e.date >= start && e.date < key)
      .reduce((sum, e) => sum + e.qty, 0);
    const cap = item.weeklyCap;
    const overBefore = Math.max(0, beforeQty - cap);
    const overAfter = Math.max(0, beforeQty + todayQty - cap);
    return (overAfter - overBefore) * item.minutes;
  }

  /* 汇总某一天。minutes 只累加有可靠口径的条目。 */
  function summarize(entries, key) {
    const day = (entries || []).filter(e => e.date === key);
    const byItem = [];
    const noted = [];
    let total = 0;
    let counted = 0;
    const index = new Map();
    /* noted 也要按 itemId 合并。原来这里直接 push，同一天记两笔快走
       就在账本和首页各出现两行「快走 15 分钟」，读起来像记重了；
       而能折算分钟的 byItem 早就是合并的，两边的口径就分了岔。 */
    const notedIndex = new Map();

    for (const e of day) {
      const item = W.get(e.itemId);
      if (!item) continue;
      const m = item.weeklyCap ? cappedMinutes(entries, e.itemId, key) : W.minutesFor(e.itemId, e.qty);
      if (m === null) {
        if (notedIndex.has(e.itemId)) {
          notedIndex.get(e.itemId).qty += e.qty;
        } else {
          const row = { itemId: e.itemId, name: item.name, qty: e.qty, unit: item.unit };
          notedIndex.set(e.itemId, row);
          noted.push(row);
        }
        continue;
      }
      counted += 1;
      total += m;
      const withinCap = !!item.weeklyCap && m === 0;
      if (index.has(e.itemId)) {
        const row = index.get(e.itemId);
        row.qty += e.qty;
        row.minutes += m;
        row.withinCap = row.minutes === 0;
      } else {
        const row = { itemId: e.itemId, name: item.name, unit: item.unit, qty: e.qty, minutes: m, withinCap };
        index.set(e.itemId, row);
        byItem.push(row);
      }
    }

    return {
      date: key,
      entries: day.slice().sort((a, b) => String(a.at).localeCompare(String(b.at))),
      totalMinutes: total,
      counted,
      noted,
      byItem
    };
  }

  /* 与前一天对比。delta > 0 表示今天负得少，即好转。 */
  function compare(current, previous) {
    const hasPrev = !!previous && (previous.counted > 0 || previous.noted.length > 0);
    return {
      hasPrev,
      delta: current.totalMinutes - (previous ? previous.totalMinutes : 0),
      previousMinutes: previous ? previous.totalMinutes : 0
    };
  }

  /* 绝对分钟 → 人话。60 以下只给分钟。 */
  function formatMinutes(absMinutes) {
    const m = Math.round(Math.abs(absMinutes));
    if (m < 60) return m + ' 分钟';
    if (m < 1440) {
      const h = Math.floor(m / 60);
      const rest = m % 60;
      return rest ? h + ' 小时 ' + rest + ' 分' : h + ' 小时';
    }
    const d = Math.floor(m / 1440);
    const restH = Math.round((m % 1440) / 60);
    return restH ? d + ' 天 ' + restH + ' 小时' : d + ' 天';
  }

  /* 绝对分钟 → 类比。无合适档位时返回空串（宁可不写，也不写错）。 */
  function anchorText(absMinutes) {
    const m = Math.abs(absMinutes);
    if (!Number.isFinite(m) || m <= 0) return '';
    let best = null;
    for (const a of ANCHORS) {
      const ratio = m / a.at;
      if (ratio < 0.5 || ratio > 2) continue;
      const score = Math.abs(Math.log(ratio));
      if (!best || score < best.score) best = { unit: a.unit, ratio: ratio, score: score };
    }
    if (!best) return '';
    const r = best.ratio;
    const unit = best.unit;
    if (r < 0.75) return '大约半' + unit;
    if (r < 1.3) return '大约一' + unit;
    if (r < 1.8) return '将近两' + unit;
    return '大约两' + unit;
  }

  /* 近 N 天逐日合计，用于趋势。返回从旧到新。 */
  function dailyTotals(entries, endKey, days) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = shiftDay(endKey, -i);
      const s = summarize(entries, key);
      out.push({ date: key, totalMinutes: s.totalMinutes, counted: s.counted });
    }
    return out;
  }

  /* 某一天涉及哪些器官，损耗与收益分开。
   *
   * 两个刻意的决定：
   *   1. 这里遍历 entries 而不是 summarize 的 byItem。睡眠不足、含糖饮料这类
   *      「仅记录」的行为没有分钟数，但同样有器官落点，用 byItem 会把它们漏掉。
   *   2. 损耗与收益不互相抵消。catalog 里明确写了「不能用运动来抵消吸烟带来的
   *      这些风险」，所以同一个器官既被损耗又被照顾时，只算损耗。
   *      在界面上把它们相加，等于暗示「跑两步就把烟抽回来了」。
   */
  function organsFor(entries, key) {
    const harm = [];
    const gain = [];
    for (const e of entries || []) {
      if (e.date !== key) continue;
      const item = W.get(e.itemId);
      if (!item || !item.organs) continue;
      const bucket = item.tone === 'benefit' ? gain : harm;
      for (const id of item.organs) {
        if (bucket.indexOf(id) === -1) bucket.push(id);
      }
    }
    for (let i = gain.length - 1; i >= 0; i--) {
      if (harm.indexOf(gain[i]) !== -1) gain.splice(i, 1);
    }
    return { harm: harm, gain: gain };
  }

  return {
    ANCHORS,
    dayKey, shiftDay, isDayKey, weekStart,
    makeEntry, cleanEntries,
    summarize, compare, dailyTotals, cappedMinutes, organsFor,
    formatMinutes, anchorText
  };
});
