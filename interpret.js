/* 解读层 —— 本地规则引擎
 *
 * 设计前提：这一段在断网、无密钥、无账号时必须可用（AC-24）。
 * 所以它不是「AI 的降级替身」，而是产品的地基；在线大模型只是在这层之上做措辞增强。
 *
 * 三条硬约束：
 *   1. 只使用传入的 summary 里已经算好的数字，绝不自己造数。
 *   2. 不出现诊断、建议就医、预后一类表述。
 *   3. 没有可靠口径的行为，明说「不给数字」，不拿形容词糊过去。
 */
(function () {
  'use strict';

  const W = window.BodyLensWeights;
  const L = window.BodyLensLedger;
  if (!W || !L) return;

  /* 每个行为对应一条「可以试」的行动。都是低门槛、证据相对稳的，
     不写「戒掉」「必须」这类命令句。 */
  const ACTIONS = {
    smoke: '想少一点，从「今天少一支」开始，比「戒掉」更容易做到。',
    alcohol: '把这一周的总量记下来，比只盯某一天更有意义。',
    sit: '每坐满一小时，站起来走两分钟，是目前证据最稳的一条。',
    shortSleep: '今晚先把入睡时间往前挪二十分钟，比一次补觉更有用。',
    sugar: '把含糖饮料换成水，是这类习惯里最容易改的一步。',
    walk: '今天走的这些步数已经算数了，明天保持住比加量更重要。',
    sleep: '睡眠够了这件事值得记下来，它是账本里少见的正数。',
    noSmoke: '没抽烟的每一天都在往回拿时间，继续记着。'
  };

  function topItem(summary) {
    let best = null;
    for (const row of summary.byItem) {
      const abs = Math.abs(row.minutes);
      if (!best || abs > Math.abs(best.minutes)) best = row;
    }
    return best;
  }

  function share(top, total) {
    if (!top || !total) return 0;
    return Math.abs(top.minutes) / Math.abs(total);
  }

  function names(list) {
    return list.map(n => n.name).join('、');
  }

  /* 第一句：今天是什么量级，以及和昨天比。
     delta 的符号约定和账本一致：正数是「比昨天好」，负数是「比昨天差」。
     所以变多要把符号翻回来再取绝对值，否则会出现「比昨天多了 -80 分钟」。 */
  function opening(summary, cmp) {
    const total = Math.abs(summary.totalMinutes);
    if (!cmp.hasPrev) return '今天到目前为止 ' + L.formatMinutes(total) + '。';
    const d = cmp.delta;
    if (d > 15) return '比昨天少了 ' + L.formatMinutes(d) + '。';
    if (d < -15) return '比昨天多了 ' + L.formatMinutes(-d) + '。';
    return '和昨天基本持平。';
  }

  /* 第二句：钱花在哪。 */
  function attribution(summary) {
    const top = topItem(summary);
    const s = share(top, summary.totalMinutes);
    if (!top) return '';
    const min = L.formatMinutes(Math.abs(top.minutes));
    const verb = top.minutes > 0 ? '其中大部分是' : '其中大半来自';
    if (s >= 0.6) return verb + top.name + '，' + top.qty + ' ' + top.unit + '，约 ' + min + '。';
    if (s >= 0.35) return '最大的一项是' + top.name + '，约 ' + min + '，占不到一半。';
    return '损耗比较分散，没有哪一项超过四成。';
  }

  /* 第三句：把「为什么不给数字」讲清楚。这是本产品可信度的核心。
     控制在两句以内——三条细则各说一句会变成一堵墙，读者会直接跳过。 */
  function caveats(summary) {
    const parts = [];
    const capped = summary.byItem.filter(r => r.withinCap).map(r => r.name);
    const ranged = summary.byItem
      .filter(r => {
        const item = W.get(r.itemId);
        return item && item.range;
      })
      .map(r => r.name);

    if (capped.length || ranged.length) {
      const bits = [];
      if (capped.length) bits.push(capped.join('、') + '没超本周额度，不计分钟（那是研究成立的剂量条件）');
      if (ranged.length) bits.push(ranged.join('、') + '的原始区间太宽，只能当量级看');
      parts.push(bits.join('；') + '。');
    }

    if (summary.noted.length) {
      parts.push(names(summary.noted) + ' 没有公开的折算口径，只记下发生。');
    }

    return parts.join('');
  }

  function action(summary) {
    const top = topItem(summary);
    if (top && ACTIONS[top.itemId]) return ACTIONS[top.itemId];
    for (const row of summary.byItem) {
      if (ACTIONS[row.itemId]) return ACTIONS[row.itemId];
    }
    return '';
  }

  function stance(summary) {
    const total = Math.abs(summary.totalMinutes);
    if (summary.counted === 0) return 'idle';
    if (total < 60) return 'quiet';
    if (total < 240) return 'steady';
    return 'notice';
  }

  /* 主入口：本地解读。任何时候都能同步返回，不需要网络。
   * 返回三段，刻意分开：
   *   headline 只陈述数字（由账本算，模型无权改写）
   *   detail   解释这些数字怎么来的、哪些没有折
   *   hint     一句可以试的小动作，和描述分开，免得变成说教 */
  function local(summary, cmp) {
    if (summary.counted === 0 && summary.noted.length === 0) {
      return {
        headline: '今天还没有记录。',
        detail: '记下一笔，我就能告诉你它落在身体的哪一部分、大概占今天多少。',
        hint: '',
        stance: 'idle',
        source: 'local'
      };
    }

    if (summary.counted === 0) {
      return {
        headline: '今天记了 ' + summary.noted.length + ' 项，但都不折算成分钟。',
        detail: names(summary.noted) + ' 这一类，公开研究还给不出「一次折合多少分钟」的口径。所以我只记下它们发生过，不编一个数字给你。',
        hint: '',
        stance: 'idle',
        source: 'local'
      };
    }

    /* 有记录但合计为 0：典型情况是酒精还在本周额度内。
       这里不能输出「今天被拿走 0 分钟」，那等于把额度讲成了没事。 */
    const total = summary.totalMinutes;
    if (total === 0) {
      const capped = summary.byItem.filter(r => r.withinCap).map(r => r.name);
      const parts = [];
      if (capped.length) {
        parts.push(capped.join('、') + '没有超出本周额度，所以不计入分钟——那是研究成立的剂量条件，不是给它开后门。额度每周重置。');
      }
      if (summary.noted.length) {
        parts.push(names(summary.noted) + ' 没有公开的折算口径，只记录，不折分钟。');
      }
      return {
        headline: '今天记了 ' + summary.counted + ' 项，都还在额度以内。',
        detail: parts.join('') || '这些条目今天没有产生可折算的损耗。',
        hint: '',
        stance: 'quiet',
        source: 'local'
      };
    }

    /* 有正数（走路、睡够、没抽烟）时，总量可能是负的，措辞要跟着换。 */
    const gain = total > 0;
    const headline = gain
      ? '今天往回拿了 ' + L.formatMinutes(total) + '。'
      : '今天被拿走 ' + L.formatMinutes(Math.abs(total)) + '。';

    const detail = [opening(summary, cmp), attribution(summary), caveats(summary)]
      .filter(Boolean)
      .join('');

    return {
      headline: headline,
      detail: detail,
      hint: action(summary),
      stance: stance(summary),
      source: 'local'
    };
  }

  /* 交给服务端的载荷。只带白名单字段，
     这样后端不需要信任前端传来的任何自由文本。 */
  function payload(summary, cmp, week) {
    return {
      mode: 'ledger',
      totalMinutes: summary.totalMinutes,
      counted: summary.counted,
      items: summary.byItem.map(r => {
        const item = W.get(r.itemId);
        return {
          id: r.itemId,
          name: r.name,
          qty: r.qty,
          unit: r.unit,
          minutes: Math.round(r.minutes),
          direction: item ? item.direction : '',
          value: item ? item.value : '',
          withinCap: !!r.withinCap,
          hasRange: !!(item && item.range)
        };
      }),
      noted: summary.noted.map(r => ({ id: r.itemId, name: r.name, qty: r.qty, unit: r.unit })),
      yesterdayMinutes: cmp.hasPrev ? cmp.previousMinutes : null,
      delta: cmp.hasPrev ? Math.round(cmp.delta) : null,
      weekTotals: (week || []).map(d => Math.round(d.totalMinutes))
    };
  }

  window.BodyLensInterpret = { local, payload, ACTIONS };
})();
