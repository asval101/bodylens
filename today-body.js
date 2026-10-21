/* 今日页的人体落点 —— 让「记一笔」有物理去向。
 *
 * 分工：
 *   哪个行为影响哪个器官 → weights.js 的 organs 字段
 *   器官叫什么、在哪个坐标 → data/catalog.js（唯一真相源，这里不复制坐标）
 *   怎么画、怎么动 → 这里
 *
 * 三条约束：
 *   1. 只用 SVG + CSS，不用 Canvas / WebGL —— 断网可用与十分钟复现都靠这条。
 *   2. 支持 prefers-reduced-motion：粒子不飞，器官直接亮。
 *   3. 人体是示意，不是诊断图。点在那里只表示「今天有事发生在这一带」，
 *      不表示损伤程度——所以这里没有任何随剂量变化的尺寸或深浅编码。
 *      唯一改变的是「有没有被点亮」这个二值状态。
 */
(function () {
  'use strict';

  const D = window.BodyLensData;
  const ORGANS = D && D.organs;
  if (!ORGANS) return;

  const NS = 'http://www.w3.org/2000/svg';
  const VIEW = [400, 660];
  /* 今日页只显示正面；肾脏、脊柱属于背面，和正面器官会叠在同一个位置。 */
  const ORDER = ['brain', 'eyes', 'mouth', 'lungs', 'heart', 'liver', 'gut'];

  /* 头部三个器官在解剖上本来就挨着（脑 55、眼 83、口腔 103），
     用同样大的点会连成一串珠子，反而数不清有几处。
     所以头部用小一号：它们的作用是提示「头面部被点亮了」，不是精确标三个位置。 */
  const SMALL = ['brain', 'eyes', 'mouth'];
  /* 光点半径跟着新骨架收小：躯干半宽只有 51~56，原来 7.5 的半径
     占了躯干宽度的三成，看着像贴了两个药片。 */
  const R_BODY = 6.4;
  const R_HEAD = 4.4;

  /* 标注：贴着画布两侧排，同侧相邻两行至少隔 LABEL_GAP，
     否则「肺」「心」这种上下相邻的器官会叠在一起。
     偏移量按最宽的手臂算：手臂外缘到中线 81，再加一个字的呼吸距离。 */
  const LABEL_OFFSET = 104;  // 名字到中线的距离，刚好让开手臂外缘
  const LABEL_GAP = 30;

  /* 身体轮廓：头、躯干、双腿连成一条闭合线，两臂各一条闭合胶囊。
     一条线走完是为了不在骨盆里留下"弦"——之前手臂、腿各画一段，
     接缝处会出现横穿身体的直线，凑近了看像一件灯笼裤。

     比例不是随手画的，按 8 头身立骨架（身高 612，头高 82 → 7.46 头身），
     再让肚脐落在 0.382 的黄金分割点、耻骨落在身高一半：
     头顶 24 / 下巴 106 / 肩峰 150 / 胸 190 / 腰 250 / 肚脐 258 /
     胯 280 / 裆 331 / 膝 465 / 踝 608 / 脚底 636。
     旧版是 6.3 头身、腿只占身高 0.41，头偏大腿偏短，站在那儿像另一个人。

     坐标由 .tmpshot/gen-body.cjs 用 Catmull-Rom 生成后固化在这里，
     运行时不重算——静态数据才配得上「十分钟复现」这条硬指标。 */
  const SHAPES = [
    'M200.0 25.0 C202.7 25.0,205.3 24.8,208.0 25.0 C210.7 25.2,213.5 24.8,216.0 26.0 C218.5 27.2,221.0 29.0,223.0 32.0 C225.0 35.0,226.8 39.0,228.0 44.0 C229.2 49.0,230.0 56.3,230.0 62.0 C230.0 67.7,229.3 73.0,228.0 78.0 C226.7 83.0,224.5 88.0,222.0 92.0 C219.5 96.0,213.3 99.0,213.0 102.0 C212.7 105.0,218.7 106.0,220.0 110.0 C221.3 114.0,218.7 121.7,221.0 126.0 C223.3 130.3,228.8 133.3,234.0 136.0 C239.2 138.7,247.7 139.7,252.0 142.0 C256.3 144.3,259.0 144.3,260.0 150.0 C261.0 155.7,258.7 169.3,258.0 176.0 C257.3 182.7,256.7 180.3,256.0 190.0 C255.3 199.7,254.8 224.0,254.0 234.0 C253.2 244.0,251.2 244.7,251.0 250.0 C250.8 255.3,252.0 260.7,253.0 266.0 C254.0 271.3,256.2 276.3,257.0 282.0 C257.8 287.7,258.5 294.3,258.0 300.0 C257.5 305.7,255.2 311.0,254.0 316.0 C252.8 321.0,251.7 324.0,251.0 330.0 C250.3 336.0,249.8 340.3,250.0 352.0 C250.2 363.7,251.8 386.2,252.0 400.0 C252.2 413.8,251.3 424.2,251.0 435.0 C250.7 445.8,250.7 452.5,250.0 465.0 C249.3 477.5,248.2 494.7,247.0 510.0 C245.8 525.3,244.2 542.0,243.0 557.0 C241.8 572.0,241.0 590.5,240.0 600.0 C239.0 609.5,236.8 610.7,237.0 614.0 C237.2 617.3,238.2 617.7,241.0 620.0 C243.8 622.3,253.5 625.3,254.0 628.0 C254.5 630.7,250.5 635.0,244.0 636.0 C237.5 637.0,220.2 637.7,215.0 634.0 C209.8 630.3,212.8 619.7,213.0 614.0 C213.2 608.3,216.2 618.2,216.0 600.0 C215.8 581.8,212.8 527.5,212.0 505.0 C211.2 482.5,211.7 479.2,211.0 465.0 C210.3 450.8,208.7 437.5,208.0 420.0 C207.3 402.5,207.7 374.2,207.0 360.0 C206.3 345.8,205.2 339.8,204.0 335.0 C202.8 330.2,201.3 331.0,200.0 331.0 C198.7 331.0,197.2 330.2,196.0 335.0 C194.8 339.8,193.7 345.8,193.0 360.0 C192.3 374.2,192.7 402.5,192.0 420.0 C191.3 437.5,189.7 450.8,189.0 465.0 C188.3 479.2,188.8 482.5,188.0 505.0 C187.2 527.5,184.2 581.8,184.0 600.0 C183.8 618.2,186.8 608.3,187.0 614.0 C187.2 619.7,190.2 630.3,185.0 634.0 C179.8 637.7,162.5 637.0,156.0 636.0 C149.5 635.0,145.5 630.7,146.0 628.0 C146.5 625.3,156.2 622.3,159.0 620.0 C161.8 617.7,162.8 617.3,163.0 614.0 C163.2 610.7,161.0 609.5,160.0 600.0 C159.0 590.5,158.2 572.0,157.0 557.0 C155.8 542.0,154.2 525.3,153.0 510.0 C151.8 494.7,150.7 477.5,150.0 465.0 C149.3 452.5,149.3 445.8,149.0 435.0 C148.7 424.2,147.8 413.8,148.0 400.0 C148.2 386.2,149.8 363.7,150.0 352.0 C150.2 340.3,149.7 336.0,149.0 330.0 C148.3 324.0,147.2 321.0,146.0 316.0 C144.8 311.0,142.5 305.7,142.0 300.0 C141.5 294.3,142.2 287.7,143.0 282.0 C143.8 276.3,146.0 271.3,147.0 266.0 C148.0 260.7,149.2 255.3,149.0 250.0 C148.8 244.7,146.8 244.0,146.0 234.0 C145.2 224.0,144.7 199.7,144.0 190.0 C143.3 180.3,142.7 182.7,142.0 176.0 C141.3 169.3,139.0 155.7,140.0 150.0 C141.0 144.3,143.7 144.3,148.0 142.0 C152.3 139.7,160.8 138.7,166.0 136.0 C171.2 133.3,176.7 130.3,179.0 126.0 C181.3 121.7,178.7 114.0,180.0 110.0 C181.3 106.0,187.3 105.0,187.0 102.0 C186.7 99.0,180.5 96.0,178.0 92.0 C175.5 88.0,173.3 83.0,172.0 78.0 C170.7 73.0,170.0 67.7,170.0 62.0 C170.0 56.3,170.8 49.0,172.0 44.0 C173.2 39.0,175.0 35.0,177.0 32.0 C179.0 29.0,181.5 27.2,184.0 26.0 C186.5 24.8,189.3 25.2,192.0 25.0 C194.7 24.8,197.3 25.0,200.0 25.0 Z',
    'M260.0 150.0 C262.7 147.2,270.7 152.0,274.0 155.0 C277.3 158.0,278.8 163.2,280.0 168.0 C281.2 172.8,281.2 177.3,281.0 184.0 C280.8 190.7,280.0 198.0,279.0 208.0 C278.0 218.0,276.2 233.3,275.0 244.0 C273.8 254.7,272.8 263.0,272.0 272.0 C271.2 281.0,270.7 290.3,270.0 298.0 C269.3 305.7,268.5 311.0,268.0 318.0 C267.5 325.0,267.2 333.0,267.0 340.0 C266.8 347.0,266.8 353.7,267.0 360.0 C267.2 366.3,268.2 373.0,268.0 378.0 C267.8 383.0,267.2 387.0,266.0 390.0 C264.8 393.0,262.7 396.3,261.0 396.0 C259.3 395.7,256.7 392.0,256.0 388.0 C255.3 384.0,256.7 378.0,257.0 372.0 C257.3 366.0,257.8 358.0,258.0 352.0 C258.2 346.0,257.8 342.3,258.0 336.0 C258.2 329.7,258.5 324.7,259.0 314.0 C259.5 303.3,260.5 283.7,261.0 272.0 C261.5 260.3,261.8 254.7,262.0 244.0 C262.2 233.3,262.3 217.7,262.0 208.0 C261.7 198.3,260.7 192.0,260.0 186.0 C259.3 180.0,258.0 178.0,258.0 172.0 C258.0 166.0,257.3 152.8,260.0 150.0 Z',
    'M140.0 150.0 C137.3 147.2,129.3 152.0,126.0 155.0 C122.7 158.0,121.2 163.2,120.0 168.0 C118.8 172.8,118.8 177.3,119.0 184.0 C119.2 190.7,120.0 198.0,121.0 208.0 C122.0 218.0,123.8 233.3,125.0 244.0 C126.2 254.7,127.2 263.0,128.0 272.0 C128.8 281.0,129.3 290.3,130.0 298.0 C130.7 305.7,131.5 311.0,132.0 318.0 C132.5 325.0,132.8 333.0,133.0 340.0 C133.2 347.0,133.2 353.7,133.0 360.0 C132.8 366.3,131.8 373.0,132.0 378.0 C132.2 383.0,132.8 387.0,134.0 390.0 C135.2 393.0,137.3 396.3,139.0 396.0 C140.7 395.7,143.3 392.0,144.0 388.0 C144.7 384.0,143.3 378.0,143.0 372.0 C142.7 366.0,142.2 358.0,142.0 352.0 C141.8 346.0,142.2 342.3,142.0 336.0 C141.8 329.7,141.5 324.7,141.0 314.0 C140.5 303.3,139.5 283.7,139.0 272.0 C138.5 260.3,138.2 254.7,138.0 244.0 C137.8 233.3,137.7 217.7,138.0 208.0 C138.3 198.3,139.3 192.0,140.0 186.0 C140.7 180.0,142.0 178.0,142.0 172.0 C142.0 166.0,142.7 152.8,140.0 150.0 Z'
  ];

  let svg = null;
  let host = null;

  function node(name, attrs) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function build() {
    const s = node('svg', {
      viewBox: '0 0 ' + VIEW[0] + ' ' + VIEW[1],
      class: 'body-figure',
      'aria-hidden': 'true',
      focusable: 'false'
    });

    const outline = node('g', { class: 'body-outline' });
    for (const d of SHAPES) outline.appendChild(node('path', { d }));
    s.appendChild(outline);

    const dots = node('g', { class: 'body-dots' });
    for (const id of ORDER) {
      const meta = ORGANS[id];
      if (!meta || !meta.anchor) continue;
      const cx = meta.anchor[0];
      const cy = meta.anchor[1];

      /* r 按 viewBox 单位算，不能按像素想：142px 宽的人体缩放比约 0.355，
         所以 r=3.4 只有 1.2 像素，等于看不见。 */
      const r = SMALL.indexOf(id) !== -1 ? R_HEAD : R_BODY;
      const g = node('g', { class: 'organ-dot', 'data-organ': id });
      g.appendChild(node('circle', { class: 'dot-ring', cx: cx, cy: cy, r: r }));
      g.appendChild(node('circle', { class: 'dot-core', cx: cx, cy: cy, r: r }));
      const t = document.createElementNS(NS, 'title');
      t.textContent = meta.name;
      g.appendChild(t);
      dots.appendChild(g);
    }
    s.appendChild(dots);

    const labels = node('g', { class: 'body-labels' });
    labels.setAttribute('aria-hidden', 'true');
    s.appendChild(labels);
    return s;
  }

  /* 标注：只给「被点亮的」器官标名字，没点亮的不标。
   *
   * 为什么不把七个都标上：人体只有 156px 宽，七个名字会糊成一片，
   * 而且多数点是空的——空点标名字等于让人读一份不存在的体检报告。
   * 反过来，点亮的那几个才是今天真正发生的事，通常 1~3 个，标得下。
   *
   * 名字拉到身体两侧，字不压在身上，尽量与器官同高；同侧太挤时按顺序下推。
   * 位置关系靠这条水平线说清楚，不靠引线——长引线必然横穿躯干，
   * 几根细线叠在人体上像一张故障的电路图。塞不进引线，也就不用引线。 */
  function drawLabels(harm, gain) {
    if (!svg) return;
    const layer = svg.querySelector('.body-labels');
    if (!layer) return;
    layer.textContent = '';

    const lit = [];
    for (const id of ORDER) {
      const meta = ORGANS[id];
      if (!meta || !meta.anchor) continue;
      const isHarm = harm.indexOf(id) !== -1;
      const isGain = !isHarm && gain.indexOf(id) !== -1;
      if (!isHarm && !isGain) continue;
      lit.push({ id: id, name: meta.name, x: meta.anchor[0], y: meta.anchor[1], tone: isHarm ? 'hit' : 'gain' });
    }
    if (!lit.length) return;

    /* 左右分栏：按坐标落在中线哪一侧决定，同侧再按 y 排开 */
    const sides = { left: [], right: [] };
    for (const one of lit) (one.x < VIEW[0] / 2 ? sides.left : sides.right).push(one);
    for (const key of ['left', 'right']) {
      const list = sides[key].sort((a, b) => a.y - b.y);
      let floor = -Infinity;
      for (const one of list) {
        one.labelY = Math.max(one.y, floor);
        floor = one.labelY + LABEL_GAP;
      }
    }

    for (const one of lit) {
      const isLeft = one.x < VIEW[0] / 2;
      const textX = isLeft ? VIEW[0] / 2 - LABEL_OFFSET : VIEW[0] / 2 + LABEL_OFFSET;

      const g = node('g', { class: 'body-label is-' + one.tone });
      /* 不画引线，也不画名字外侧那截短线。
       * 短线试过：156px 的实际显示里只有 0.7 像素，放大看还会压在手臂上，
       * 等于花一个瑕疵换一个看不见的提示。名字和目标在同一行上，位置关系已经够了。 */
      const t = node('text', {
        x: textX, y: one.labelY,
        'text-anchor': isLeft ? 'end' : 'start',
        class: 'label-text'
      });
      t.textContent = one.name;
      g.appendChild(t);
      layer.appendChild(g);
    }
  }

  function mount(el) {
    if (!el) return null;
    if (host === el && svg) return svg;
    host = el;
    svg = build();
    el.innerHTML = '';
    el.appendChild(svg);
    return svg;
  }

  function dotOf(id) {
    return svg ? svg.querySelector('.organ-dot[data-organ="' + id + '"]') : null;
  }

  /* 屏幕坐标：粒子要飞到这里，所以必须用真实布局结果，不能拿 viewBox 换算。 */
  function screenPoint(id) {
    const core = svg && svg.querySelector('.organ-dot[data-organ="' + id + '"] .dot-core');
    if (!core) return null;
    const r = core.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* 静态标记：刷新后今天记录过的器官应该仍然亮着。
     否则数据只活在「点击那一瞬间」，一刷新就没了。 */
  function mark(harmIds, gainIds) {
    if (!svg) return;
    const harm = harmIds || [];
    const gain = gainIds || [];
    for (const id of ORDER) {
      const g = dotOf(id);
      if (!g) continue;
      const isHarm = harm.indexOf(id) !== -1;
      const isGain = !isHarm && gain.indexOf(id) !== -1;
      g.classList.toggle('is-hit', isHarm);
      g.classList.toggle('is-gain', isGain);
    }
    litHarm = harm;
    litGain = gain;
    drawLabels(harm, gain);
  }

  /* 临时熄灭：刚记下的那一笔，器官要等粒子飞到才亮。
     否则 render 一执行器官就亮了，粒子只是在已经亮着的点上空飞过，因果就断了。 */
  function unmark(ids) {
    if (!svg || !ids) return;
    for (const id of ids) {
      const g = dotOf(id);
      if (g) g.classList.remove('is-hit', 'is-gain', 'is-flashing');
    }
    /* 名字跟着一起收掉：粒子还在飞，名字先出来会抢在因果前面 */
    litHarm = litHarm.filter(id => ids.indexOf(id) === -1);
    litGain = litGain.filter(id => ids.indexOf(id) === -1);
    drawLabels(litHarm, litGain);
  }

  /* 当前点亮的清单。unmark 需要它才能"减掉"而不是清空。 */
  let litHarm = [];
  let litGain = [];

  function flash(id, tone, delay) {
    const g = dotOf(id);
    if (!g) return;
    setTimeout(() => {
      g.classList.remove('is-flashing');
      void g.getBoundingClientRect();
      g.classList.add(tone === 'benefit' ? 'is-gain' : 'is-hit');
      g.classList.add('is-flashing');
      setTimeout(() => g.classList.remove('is-flashing'), 1500);
    }, delay);
  }

  function pulse(ids, tone) {
    if (!svg || !ids || !ids.length) return;
    ids.forEach((id, i) => flash(id, tone, i * 90));
  }

  /* 粒子：从按钮飞到器官，到达那一刻器官才亮。
     这一步是整条链的意义所在——它回答了「我刚点的那一下去哪了」。 */
  function fly(from, ids, tone, onArrive) {
    if (!svg || !ids || !ids.length || !from) {
      if (onArrive) onArrive();
      return;
    }
    const target = screenPoint(ids[0]);
    if (!target || reduced()) {
      if (onArrive) onArrive();
      return;
    }

    /* 连点时不再取消前一个粒子：多粒同时飞反而更像真的在记账。
       但超过 6 个就不再生成，避免狂点时页面堆满元素。 */
    if (document.querySelectorAll('.ledger-particle').length >= 6) {
      if (onArrive) onArrive();
      return;
    }

    const dot = document.createElement('div');
    dot.className = 'ledger-particle' + (tone === 'benefit' ? ' is-gain' : '');
    document.body.appendChild(dot);

    const x0 = from.x;
    const y0 = from.y;
    const x1 = target.x;
    const y1 = target.y;
    /* 控制点抬到两点上方：直线会穿过标题文字，抬起来才有「抛过去」的感觉。 */
    const mx = (x0 + x1) / 2 + (y1 - y0) * 0.06;
    const my = Math.min(y0, y1) - Math.max(26, Math.abs(x1 - x0) * 0.24);
    const DUR = 620;
    const start = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - start) / DUR);
      const e = 1 - Math.pow(1 - t, 3);
      const u = 1 - e;
      const x = u * u * x0 + 2 * u * e * mx + e * e * x1;
      const y = u * u * y0 + 2 * u * e * my + e * e * y1;
      dot.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + (1 - e * 0.4).toFixed(3) + ')';
      dot.style.opacity = t > 0.9 ? ((1 - t) / 0.1).toFixed(2) : '1';
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        dot.remove();
        if (onArrive) onArrive();
      }
    }
    requestAnimationFrame(frame);
  }

  window.TodayBody = { mount, pulse, fly, mark, unmark, screenPoint, ORDER };
})();
