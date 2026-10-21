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
    'M200.0 25.0 C202.7 25.0,205.3 24.8,208.0 25.0 C210.7 25.2,213.5 24.8,216.0 26.0 C218.5 27.2,221.0 29.0,223.0 32.0 C225.0 35.0,226.8 39.0,228.0 44.0 C229.2 49.0,230.0 56.3,230.0 62.0 C230.0 67.7,229.5 73.0,228.0 78.0 C226.5 83.0,224.2 88.0,221.0 92.0 C217.8 96.0,209.8 99.0,209.0 102.0 C208.2 105.0,214.7 105.7,216.0 110.0 C217.3 114.3,214.0 123.7,217.0 128.0 C220.0 132.3,228.2 133.7,234.0 136.0 C239.8 138.3,247.7 139.7,252.0 142.0 C256.3 144.3,259.0 144.3,260.0 150.0 C261.0 155.7,258.7 169.3,258.0 176.0 C257.3 182.7,256.7 180.3,256.0 190.0 C255.3 199.7,254.8 224.0,254.0 234.0 C253.2 244.0,251.3 245.3,251.0 250.0 C250.7 254.7,250.5 257.0,252.0 262.0 C253.5 267.0,258.7 273.0,260.0 280.0 C261.3 287.0,260.8 298.0,260.0 304.0 C259.2 310.0,256.3 309.0,255.0 316.0 C253.7 323.0,252.8 332.0,252.0 346.0 C251.2 360.0,250.7 385.2,250.0 400.0 C249.3 414.8,248.5 424.2,248.0 435.0 C247.5 445.8,247.7 452.5,247.0 465.0 C246.3 477.5,245.0 494.7,244.0 510.0 C243.0 525.3,241.8 542.0,241.0 557.0 C240.2 572.0,239.7 590.5,239.0 600.0 C238.3 609.5,237.0 610.0,237.0 614.0 C237.0 618.0,236.8 621.3,239.0 624.0 C241.2 626.7,250.2 628.0,250.0 630.0 C249.8 632.0,243.5 635.3,238.0 636.0 C232.5 636.7,220.8 637.3,217.0 634.0 C213.2 630.7,215.2 621.7,215.0 616.0 C214.8 610.3,216.5 618.5,216.0 600.0 C215.5 581.5,212.8 527.5,212.0 505.0 C211.2 482.5,211.7 479.2,211.0 465.0 C210.3 450.8,208.7 437.5,208.0 420.0 C207.3 402.5,207.7 374.2,207.0 360.0 C206.3 345.8,205.2 339.8,204.0 335.0 C202.8 330.2,201.3 331.0,200.0 331.0 C198.7 331.0,197.2 330.2,196.0 335.0 C194.8 339.8,193.7 345.8,193.0 360.0 C192.3 374.2,192.7 402.5,192.0 420.0 C191.3 437.5,189.7 450.8,189.0 465.0 C188.3 479.2,188.8 482.5,188.0 505.0 C187.2 527.5,184.5 581.5,184.0 600.0 C183.5 618.5,185.2 610.3,185.0 616.0 C184.8 621.7,186.8 630.7,183.0 634.0 C179.2 637.3,167.5 636.7,162.0 636.0 C156.5 635.3,150.2 632.0,150.0 630.0 C149.8 628.0,158.8 626.7,161.0 624.0 C163.2 621.3,163.0 618.0,163.0 614.0 C163.0 610.0,161.7 609.5,161.0 600.0 C160.3 590.5,159.8 572.0,159.0 557.0 C158.2 542.0,157.0 525.3,156.0 510.0 C155.0 494.7,153.7 477.5,153.0 465.0 C152.3 452.5,152.5 445.8,152.0 435.0 C151.5 424.2,150.7 414.8,150.0 400.0 C149.3 385.2,148.8 360.0,148.0 346.0 C147.2 332.0,146.3 323.0,145.0 316.0 C143.7 309.0,140.8 310.0,140.0 304.0 C139.2 298.0,138.7 287.0,140.0 280.0 C141.3 273.0,146.5 267.0,148.0 262.0 C149.5 257.0,149.3 254.7,149.0 250.0 C148.7 245.3,146.8 244.0,146.0 234.0 C145.2 224.0,144.7 199.7,144.0 190.0 C143.3 180.3,142.7 182.7,142.0 176.0 C141.3 169.3,139.0 155.7,140.0 150.0 C141.0 144.3,143.7 144.3,148.0 142.0 C152.3 139.7,160.2 138.3,166.0 136.0 C171.8 133.7,180.0 132.3,183.0 128.0 C186.0 123.7,182.7 114.3,184.0 110.0 C185.3 105.7,191.8 105.0,191.0 102.0 C190.2 99.0,182.2 96.0,179.0 92.0 C175.8 88.0,173.5 83.0,172.0 78.0 C170.5 73.0,170.0 67.7,170.0 62.0 C170.0 56.3,170.8 49.0,172.0 44.0 C173.2 39.0,175.0 35.0,177.0 32.0 C179.0 29.0,181.5 27.2,184.0 26.0 C186.5 24.8,189.3 25.2,192.0 25.0 C194.7 24.8,197.3 25.0,200.0 25.0 Z',
    'M262.0 146.0 C264.8 143.0,270.8 148.7,274.0 152.0 C277.2 155.3,279.7 160.7,281.0 166.0 C282.3 171.3,282.2 177.0,282.0 184.0 C281.8 191.0,281.0 198.0,280.0 208.0 C279.0 218.0,277.3 233.3,276.0 244.0 C274.7 254.7,273.2 263.0,272.0 272.0 C270.8 281.0,269.8 290.3,269.0 298.0 C268.2 305.7,267.5 311.0,267.0 318.0 C266.5 325.0,266.3 333.0,266.0 340.0 C265.7 347.0,265.0 353.7,265.0 360.0 C265.0 366.3,266.3 373.0,266.0 378.0 C265.7 383.0,264.5 387.3,263.0 390.0 C261.5 392.7,258.7 394.7,257.0 394.0 C255.3 393.3,253.3 390.0,253.0 386.0 C252.7 382.0,254.5 375.7,255.0 370.0 C255.5 364.3,255.7 357.7,256.0 352.0 C256.3 346.3,256.5 342.3,257.0 336.0 C257.5 329.7,258.3 324.7,259.0 314.0 C259.7 303.3,260.5 283.7,261.0 272.0 C261.5 260.3,261.8 254.7,262.0 244.0 C262.2 233.3,262.3 218.3,262.0 208.0 C261.7 197.7,260.8 188.3,260.0 182.0 C259.2 175.7,256.7 176.0,257.0 170.0 C257.3 164.0,259.2 149.0,262.0 146.0 Z',
    'M138.0 146.0 C135.2 143.0,129.2 148.7,126.0 152.0 C122.8 155.3,120.3 160.7,119.0 166.0 C117.7 171.3,117.8 177.0,118.0 184.0 C118.2 191.0,119.0 198.0,120.0 208.0 C121.0 218.0,122.7 233.3,124.0 244.0 C125.3 254.7,126.8 263.0,128.0 272.0 C129.2 281.0,130.2 290.3,131.0 298.0 C131.8 305.7,132.5 311.0,133.0 318.0 C133.5 325.0,133.7 333.0,134.0 340.0 C134.3 347.0,135.0 353.7,135.0 360.0 C135.0 366.3,133.7 373.0,134.0 378.0 C134.3 383.0,135.5 387.3,137.0 390.0 C138.5 392.7,141.3 394.7,143.0 394.0 C144.7 393.3,146.7 390.0,147.0 386.0 C147.3 382.0,145.5 375.7,145.0 370.0 C144.5 364.3,144.3 357.7,144.0 352.0 C143.7 346.3,143.5 342.3,143.0 336.0 C142.5 329.7,141.7 324.7,141.0 314.0 C140.3 303.3,139.5 283.7,139.0 272.0 C138.5 260.3,138.2 254.7,138.0 244.0 C137.8 233.3,137.7 218.3,138.0 208.0 C138.3 197.7,139.2 188.3,140.0 182.0 C140.8 175.7,143.3 176.0,143.0 170.0 C142.7 164.0,140.8 149.0,138.0 146.0 Z'
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
    return s;
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
  }

  /* 临时熄灭：刚记下的那一笔，器官要等粒子飞到才亮。
     否则 render 一执行器官就亮了，粒子只是在已经亮着的点上空飞过，因果就断了。 */
  function unmark(ids) {
    if (!svg || !ids) return;
    for (const id of ids) {
      const g = dotOf(id);
      if (g) g.classList.remove('is-hit', 'is-gain', 'is-flashing');
    }
  }

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
