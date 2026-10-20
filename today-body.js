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
  const R_BODY = 7.5;
  const R_HEAD = 5.2;

  /* 身体轮廓：与 anatomy.js 同一套路径，去掉全部填充只留描边。
     半写实的肉色填充是廉价感的来源，这里刻意不复制。 */
  const SHAPES = [
    'M168 65 C166 35 180 17 200 17 C220 17 234 35 232 65 L228 89 Q223 110 200 115 Q177 110 172 89 Z',
    'M186 108 L186 132 Q179 139 153 142 Q133 144 125 161 L139 231 Q146 251 139 284 L142 345 Q141 382 164 403 Q181 417 200 419 Q219 417 236 403 Q259 382 258 345 L261 284 Q254 251 261 231 L275 161 Q267 144 247 142 Q221 139 214 132 L214 108 Z',
    'M151 143 Q127 139 115 161 L96 220 Q88 245 89 270 L78 328 Q75 344 79 357 L84 376 Q89 383 93 377 L94 356 L101 374 Q107 378 108 370 L105 348 L113 321 L119 280 Q131 253 138 226 L151 176 Z',
    'M249 143 Q273 139 285 161 L304 220 Q312 245 311 270 L322 328 Q325 344 321 357 L316 376 Q311 383 307 377 L306 356 L299 374 Q293 378 292 370 L295 348 L287 321 L281 280 Q269 253 262 226 L249 176 Z',
    'M153 384 Q141 419 147 465 L157 516 L154 570 L150 611 Q138 628 145 637 L179 638 Q186 632 180 621 L179 575 L183 521 L196 453 L200 419 Q174 415 153 384 Z',
    'M247 384 Q259 419 253 465 L243 516 L246 570 L250 611 Q262 628 255 637 L221 638 Q214 632 220 621 L221 575 L217 521 L204 453 L200 419 Q226 415 247 384 Z'
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
