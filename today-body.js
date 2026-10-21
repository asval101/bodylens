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
  /* 画布 240×636。原来 400 宽是给两侧标注文字留的位置，而这一列只有
     156px——字根本放不下，标注已经去掉。空着这 160 单位等于让人体白占：
     156px 的列里人体只画了 75px 宽，线宽 1.5 渲染出来 0.59 像素，
     被抗锯齿抹成一层灰。收紧之后缩放 0.65，人体 136px，线宽 1.0px。 */
  const VIEW = '80 16 240 636';
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

  /* 身体轮廓：**一条闭合线走完整个人**——头顶 → 右肩 → 右臂外侧 → 右手
     → 右臂内侧向上 → 腋窝 → 体侧 → 右腿 → 右脚 → 右腿内侧 → 裆，
     再镜像回左半边。所以 SHAPES 只有一条路径，不是三块拼的。

     连成一条是必须的，不是省事：手臂原来是一个独立的闭合胶囊，从肩头起笔
     盖在躯干上，放大看肩头会多出一个小套环，胳膊像一张贴纸贴在身上；
     连起来之后肩、臂、体侧是同一条线，腋窝成了轮廓上的一个凹口，
     胳膊才成为身体的一部分。

     比例不是随手画的，按 8 头身立骨架（身高 612，头高 82 → 7.46 头身），
     再让肚脐落在 0.382 的黄金分割点、耻骨落在身高一半：
     头顶 24 / 下巴 106 / 肩峰 150 / 腋窝 192 / 胸 190 / 腰 250 / 肚脐 258 /
     胯 280 / 裆 331 / 膝 465 / 踝 608 / 脚底 636。
     旧版是 6.3 头身、腿只占身高 0.41，头偏大腿偏短，站在那儿像另一个人。

     坐标由 .tmpshot/gen-body.cjs 用 Catmull-Rom 生成后固化在这里，
     运行时不重算——静态数据才配得上「十分钟复现」这条硬指标。 */
  const SHAPES = [
    'M200.0 24.0 C205.0 24.0,211.0 25.2,215.0 27.0 C219.0 28.8,221.7 31.7,224.0 35.0 C226.3 38.3,227.8 42.8,229.0 47.0 C230.2 51.2,230.8 55.8,231.0 60.0 C231.2 64.2,230.7 68.0,230.0 72.0 C229.3 76.0,228.5 80.0,227.0 84.0 C225.5 88.0,223.5 92.8,221.0 96.0 C218.5 99.2,214.8 101.5,212.0 103.0 C209.2 104.5,203.5 103.8,204.0 105.0 C204.5 106.2,212.5 107.7,215.0 110.0 C217.5 112.3,218.2 116.3,219.0 119.0 C219.8 121.7,218.0 123.8,220.0 126.0 C222.0 128.2,227.2 130.2,231.0 132.0 C234.8 133.8,239.5 135.5,243.0 137.0 C246.5 138.5,249.2 139.2,252.0 141.0 C254.8 142.8,257.8 144.8,260.0 148.0 C262.2 151.2,263.7 155.7,265.0 160.0 C266.3 164.3,266.2 166.3,268.0 174.0 C269.8 181.7,273.7 193.3,276.0 206.0 C278.3 218.7,280.2 234.3,282.0 250.0 C283.8 265.7,285.5 284.3,287.0 300.0 C288.5 315.7,289.8 331.0,291.0 344.0 C292.2 357.0,293.2 370.0,294.0 378.0 C294.8 386.0,296.7 388.0,296.0 392.0 C295.3 396.0,292.0 401.0,290.0 402.0 C288.0 403.0,285.3 402.0,284.0 398.0 C282.7 394.0,282.8 387.0,282.0 378.0 C281.2 369.0,280.0 357.0,279.0 344.0 C278.0 331.0,277.3 315.7,276.0 300.0 C274.7 284.3,273.0 265.3,271.0 250.0 C269.0 234.7,266.3 215.7,264.0 208.0 C261.7 200.3,258.3 203.7,257.0 204.0 C255.7 204.3,256.7 207.0,256.0 210.0 C255.3 213.0,253.8 217.0,253.0 222.0 C252.2 227.0,251.5 235.0,251.0 240.0 C250.5 245.0,250.0 247.7,250.0 252.0 C250.0 256.3,250.3 261.3,251.0 266.0 C251.7 270.7,253.2 275.3,254.0 280.0 C254.8 284.7,256.0 289.0,256.0 294.0 C256.0 299.0,254.7 305.0,254.0 310.0 C253.3 315.0,252.5 320.0,252.0 324.0 C251.5 328.0,251.0 329.3,251.0 334.0 C251.0 338.7,251.8 341.7,252.0 352.0 C252.2 362.3,252.8 377.2,252.0 396.0 C251.2 414.8,248.3 444.3,247.0 465.0 C245.7 485.7,244.8 502.8,244.0 520.0 C243.2 537.2,243.0 554.7,242.0 568.0 C241.0 581.3,239.0 593.0,238.0 600.0 C237.0 607.0,235.2 606.8,236.0 610.0 C236.8 613.2,242.3 615.3,243.0 619.0 C243.7 622.7,244.2 629.2,240.0 632.0 C235.8 634.8,222.3 637.0,218.0 636.0 C213.7 635.0,214.5 630.0,214.0 626.0 C213.5 622.0,214.7 621.7,215.0 612.0 C215.3 602.3,215.8 583.3,216.0 568.0 C216.2 552.7,216.5 537.2,216.0 520.0 C215.5 502.8,214.0 483.3,213.0 465.0 C212.0 446.7,211.0 426.5,210.0 410.0 C209.0 393.5,207.7 377.0,207.0 366.0 C206.3 355.0,207.2 349.7,206.0 344.0 C204.8 338.3,202.0 332.0,200.0 332.0 C198.0 332.0,195.2 338.3,194.0 344.0 C192.8 349.7,193.7 355.0,193.0 366.0 C192.3 377.0,191.0 393.5,190.0 410.0 C189.0 426.5,188.0 446.7,187.0 465.0 C186.0 483.3,184.5 502.8,184.0 520.0 C183.5 537.2,183.8 552.7,184.0 568.0 C184.2 583.3,184.7 602.3,185.0 612.0 C185.3 621.7,186.5 622.0,186.0 626.0 C185.5 630.0,186.3 635.0,182.0 636.0 C177.7 637.0,164.2 634.8,160.0 632.0 C155.8 629.2,156.3 622.7,157.0 619.0 C157.7 615.3,163.2 613.2,164.0 610.0 C164.8 606.8,163.0 607.0,162.0 600.0 C161.0 593.0,159.0 581.3,158.0 568.0 C157.0 554.7,156.8 537.2,156.0 520.0 C155.2 502.8,154.3 485.7,153.0 465.0 C151.7 444.3,148.8 414.8,148.0 396.0 C147.2 377.2,147.8 362.3,148.0 352.0 C148.2 341.7,149.0 338.7,149.0 334.0 C149.0 329.3,148.5 328.0,148.0 324.0 C147.5 320.0,146.7 315.0,146.0 310.0 C145.3 305.0,144.0 299.0,144.0 294.0 C144.0 289.0,145.2 284.7,146.0 280.0 C146.8 275.3,148.3 270.7,149.0 266.0 C149.7 261.3,150.0 256.3,150.0 252.0 C150.0 247.7,149.5 245.0,149.0 240.0 C148.5 235.0,147.8 227.0,147.0 222.0 C146.2 217.0,144.7 213.0,144.0 210.0 C143.3 207.0,144.3 204.3,143.0 204.0 C141.7 203.7,138.3 200.3,136.0 208.0 C133.7 215.7,131.0 234.7,129.0 250.0 C127.0 265.3,125.3 284.3,124.0 300.0 C122.7 315.7,122.0 331.0,121.0 344.0 C120.0 357.0,118.8 369.0,118.0 378.0 C117.2 387.0,117.3 394.0,116.0 398.0 C114.7 402.0,112.0 403.0,110.0 402.0 C108.0 401.0,104.7 396.0,104.0 392.0 C103.3 388.0,105.2 386.0,106.0 378.0 C106.8 370.0,107.8 357.0,109.0 344.0 C110.2 331.0,111.5 315.7,113.0 300.0 C114.5 284.3,116.2 265.7,118.0 250.0 C119.8 234.3,121.7 218.7,124.0 206.0 C126.3 193.3,130.2 181.7,132.0 174.0 C133.8 166.3,133.7 164.3,135.0 160.0 C136.3 155.7,137.8 151.2,140.0 148.0 C142.2 144.8,145.2 142.8,148.0 141.0 C150.8 139.2,153.5 138.5,157.0 137.0 C160.5 135.5,165.2 133.8,169.0 132.0 C172.8 130.2,178.0 128.2,180.0 126.0 C182.0 123.8,180.2 121.7,181.0 119.0 C181.8 116.3,182.5 112.3,185.0 110.0 C187.5 107.7,195.5 106.2,196.0 105.0 C196.5 103.8,190.8 104.5,188.0 103.0 C185.2 101.5,181.5 99.2,179.0 96.0 C176.5 92.8,174.5 88.0,173.0 84.0 C171.5 80.0,170.7 76.0,170.0 72.0 C169.3 68.0,168.8 64.2,169.0 60.0 C169.2 55.8,169.8 51.2,171.0 47.0 C172.2 42.8,173.7 38.3,176.0 35.0 C178.3 31.7,181.0 28.8,185.0 27.0 C189.0 25.2,195.0 24.0,200.0 24.0 Z'
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
      viewBox: VIEW,
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
