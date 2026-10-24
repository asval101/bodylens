/* BodyLens · V2 视觉层行为
   分层景深、指针柔光、器官聚焦与点击脉冲。
   与 app.js 不互相依赖：只读取既有 DOM 与 body 上的 no-motion / no-depth 开关，
   不修改任何业务状态，移除本文件即回到原样。 */
(function () {
  'use strict';

  var scene = document.getElementById('anatomy-scene');
  var art = document.getElementById('anatomy-art');
  var labels = document.getElementById('organ-labels');
  if (!scene || !art) return;

  var rmq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function motionOn() {
    return !rmq.matches && !document.body.classList.contains('no-motion');
  }
  function depthOn() {
    return !document.body.classList.contains('no-depth');
  }

  /* ---------- 缓动插值：所有景深位移都经过一次低通，避免指针抖动直接传导 ---------- */
  var target = { rx: 0, ry: 0, ax: 0, ay: 0, gx: 0, gy: 0, lx: 0, ly: 0 };
  var current = { rx: 0, ry: 0, ax: 0, ay: 0, gx: 0, gy: 0, lx: 0, ly: 0 };
  var raf = null;

  var VARS = {
    rx: '--vfx-rx', ry: '--vfx-ry',
    ax: '--vfx-ax', ay: '--vfx-ay',
    gx: '--vfx-gx', gy: '--vfx-gy',
    lx: '--vfx-lx', ly: '--vfx-ly'
  };
  var UNIT = { rx: 'deg', ry: 'deg' };

  function paint() {
    var moving = false;
    for (var k in target) {
      var d = target[k] - current[k];
      if (Math.abs(d) > 0.015) {
        current[k] += d * 0.14;
        moving = true;
      } else {
        current[k] = target[k];
      }
      scene.style.setProperty(VARS[k], current[k].toFixed(2) + (UNIT[k] || 'px'));
    }
    raf = moving ? requestAnimationFrame(paint) : null;
  }
  function kick() {
    if (!raf) raf = requestAnimationFrame(paint);
  }

  function reset() {
    for (var k in target) target[k] = 0;
    scene.classList.remove('vfx-pointer');
    kick();
  }

  /* ---------- 指针：三层不同幅度，形成视差与轻微体积 ---------- */
  scene.addEventListener('pointermove', function (event) {
    if (event.pointerType === 'touch') return;
    var r = scene.getBoundingClientRect();
    var nx = (event.clientX - r.left) / r.width - 0.5;
    var ny = (event.clientY - r.top) / r.height - 0.5;

    scene.style.setProperty('--vfx-mx', (event.clientX - r.left).toFixed(0) + 'px');
    scene.style.setProperty('--vfx-my', (event.clientY - r.top).toFixed(0) + 'px');
    if (motionOn() && depthOn()) scene.classList.add('vfx-pointer');

    if (!motionOn() || !depthOn()) {
      if (!raf) reset(); else kick();
      return;
    }

    target.ry = nx * 6;
    target.rx = -ny * 5;
    target.ax = nx * 7;
    target.ay = ny * 5;
    target.gx = -nx * 18;
    target.gy = -ny * 14;
    target.lx = nx * 13;
    target.ly = ny * 10;
    kick();
  });

  scene.addEventListener('pointerleave', reset);
  window.addEventListener('blur', reset);

  /* ---------- 器官聚焦：悬停时其余元素后退，焦点器官浮起 ---------- */
  function hotOff() {
    var hot = art.querySelectorAll('.vfx-hot');
    for (var i = 0; i < hot.length; i++) hot[i].classList.remove('vfx-hot');
    if (labels) {
      var lb = labels.querySelectorAll('.vfx-hot');
      for (var j = 0; j < lb.length; j++) lb[j].classList.remove('vfx-hot');
    }
    scene.classList.remove('vfx-focus');
  }

  function hotOn(id) {
    scene.classList.add('vfx-focus');
    var el = art.querySelector('.organ[data-organ="' + id + '"]');
    if (el) el.classList.add('vfx-hot');
    if (labels) {
      var label = labels.querySelector('[data-organ-button="' + id + '"]');
      if (label) label.classList.add('vfx-hot');
    }
  }

  art.addEventListener('pointerover', function (event) {
    if (!motionOn()) return;
    var organ = event.target.closest ? event.target.closest('[data-organ]') : null;
    if (!organ) return;
    var id = organ.getAttribute('data-organ');
    if (!id) return;
    if (organ.classList.contains('vfx-hot')) return;
    hotOff();
    hotOn(id);
  });

  art.addEventListener('pointerout', function (event) {
    var organ = event.target.closest ? event.target.closest('[data-organ]') : null;
    if (!organ) return;
    if (event.relatedTarget && organ.contains(event.relatedTarget)) return;
    hotOff();
  });

  if (labels) {
    labels.addEventListener('pointerover', function (event) {
      if (!motionOn()) return;
      var btn = event.target.closest ? event.target.closest('[data-organ-button]') : null;
      if (!btn) return;
      hotOff();
      hotOn(btn.getAttribute('data-organ-button'));
    });
    labels.addEventListener('pointerout', function (event) {
      if (event.relatedTarget && labels.contains(event.relatedTarget)) return;
      hotOff();
    });
  }

  /* ---------- 点击脉冲：给出“这一下命中了”的即时反馈 ---------- */
  art.addEventListener('click', function (event) {
    if (!motionOn()) return;
    var r = scene.getBoundingClientRect();
    var pulse = document.createElement('span');
    pulse.className = 'vfx-ripple';
    pulse.setAttribute('aria-hidden', 'true');
    pulse.style.left = (event.clientX - r.left).toFixed(0) + 'px';
    pulse.style.top = (event.clientY - r.top).toFixed(0) + 'px';
    scene.appendChild(pulse);
    window.setTimeout(function () {
      if (pulse.parentNode) pulse.parentNode.removeChild(pulse);
    }, 950);
  });

  /* ---------- 行为 → 器官：粒子飞过去，告诉眼睛「这一笔落在哪」 ----------
     与业务无关，只读 DOM：点完数量后 today.js 已同步刷新过人体，
     所以这里读「没有 no-impact 类的可见器官」就是本次受影响的器官。
     没有可用记录时所有器官都带 no-impact，自然不播。 */
  var flightLayer = null;
  function layer() {
    if (flightLayer && flightLayer.parentNode) return flightLayer;
    flightLayer = document.createElement('div');
    flightLayer.className = 'vfx-flight-layer';
    flightLayer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(flightLayer);
    return flightLayer;
  }

  function litOrgans() {
    var out = [];
    var nodes = art.querySelectorAll('.organ');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.style.display === 'none') continue;
      if (el.classList.contains('no-impact')) continue;
      out.push(el);
    }
    return out;
  }

  /* 二次贝塞尔：让粒子走弧线而不是直线，直线看起来像连线图 */
  function seed(from, to, bow, index, total) {
    var p = document.createElement('span');
    p.className = 'vfx-seed';
    p.style.width = p.style.height = (index % 3 === 0 ? 6 : 4) + 'px';
    p.style.marginLeft = p.style.marginTop = (-(index % 3 === 0 ? 3 : 2)) + 'px';
    p.style.opacity = '0';
    layer().appendChild(p);

    var mx = (from.x + to.x) / 2;
    var my = (from.y + to.y) / 2;
    var dx = to.x - from.x, dy = to.y - from.y;
    var len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    /* 法线方向偏移，正负交替，形成一束散开的粒子 */
    var nx = -dy / len, ny = dx / len;
    var side = (index % 2 ? 1 : -1) * bow;
    var cx = mx + nx * side;
    var cy = my + ny * side;

    var dur = 760 + (index % 4) * 70;
    var delay = (index % total) * 55;
    var t0 = null;

    function step(ts) {
      if (t0 === null) t0 = ts;
      var raw = (ts - t0 - delay) / dur;
      if (raw < 0) { requestAnimationFrame(step); return; }
      var t = raw > 1 ? 1 : raw;
      var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;  /* easeInOutQuad */
      var u = 1 - e;
      var x = u * u * from.x + 2 * u * e * cx + e * e * to.x;
      var y = u * u * from.y + 2 * u * e * cy + e * e * to.y;
      p.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      p.style.opacity = t < 0.12 ? (t / 0.12 * 0.9).toFixed(2)
        : t > 0.82 ? ((1 - t) / 0.18 * 0.9).toFixed(2) : '0.9';
      if (t < 1) { requestAnimationFrame(step); return; }
      if (p.parentNode) p.parentNode.removeChild(p);
    }
    requestAnimationFrame(step);
  }

  /* 落点不放任何东西。
     试过三种：固定尺寸的圆环（套不住形状各异的心/脑/眼）、
     改器官 filter 让它亮一下（会被读成「这个器官变了颜色」，而且会退回去）、
     散开的光点（深色实心点停在浅色皮肤上就是斑点，越小的器官越明显）。
     三条路都指向同一件事：器官表面不该承载装饰。
     器官的颜色和形状是证据本身，粒子的作用是「指」，指到了就淡出。 */

  function flyTo(from) {
    if (!motionOn()) return;
    var organs = litOrgans();
    if (!organs.length) return;
    /* 最多 4 个落点：再多就成了一团噪点，反而看不清落在哪 */
    if (organs.length > 4) organs = organs.slice(0, 4);

    for (var i = 0; i < organs.length; i++) {
      var box = organs[i].getBoundingClientRect();
      if (!box.width && !box.height) continue;
      var to = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      var bow = Math.min(72, Math.max(26, Math.abs(to.y - from.y) * 0.14));
      var count = 3 + (i % 2);
      for (var k = 0; k < count; k++) seed(from, to, bow, k, count);
    }
  }

  /* 数量按钮是「这笔真的记上了」的那一刻；行为 chip 只换选择，不动账本，不播。
     必须用捕获阶段：today.js 的 add() 会重渲染数量按钮，冒泡到这里时按钮已脱离文档，
     再量 getBoundingClientRect() 只会拿到 0，粒子就会从屏幕左上角飞出来。 */
  document.addEventListener('click', function (event) {
    var btn = event.target.closest ? event.target.closest('[data-add]') : null;
    if (!btn) return;
    var qty = btn.dataset.qty;
    var r = btn.getBoundingClientRect();          /* 此刻按钮还在文档里，先量一份备用 */
    var fx = r.left + r.width / 2;
    var fy = r.top + r.height / 2;
    requestAnimationFrame(function () {           /* 等一轮：业务层已刷新完账本与人体 */
      var list = document.querySelectorAll('#today-entry-qty [data-add]');
      for (var i = 0; i < list.length; i++) {
        if (list[i].dataset.qty !== qty) continue;
        var now = list[i].getBoundingClientRect();  /* 记账后按钮会下移，取它现在的位置 */
        if (now.width) { fx = now.left + now.width / 2; fy = now.top + now.height / 2; }
        break;
      }
      flyTo({ x: fx, y: fy });
    });
  }, true);

  /* ---------- 详情区换内容时重新入场 ---------- */
  var detail = document.getElementById('detail-content');
  if (detail && window.MutationObserver) {
    new MutationObserver(function () {
      if (!motionOn()) return;
      detail.classList.remove('vfx-enter');
      void detail.offsetWidth;
      detail.classList.add('vfx-enter');
    }).observe(detail, { childList: true });
  }

  /* ---------- 切换页面时重放入场节奏（动画只跑过一次，不重放会显得死板） ---------- */
  function replay(page) {
    if (!page || !motionOn()) return;
    var nodes = page.querySelectorAll('.page-heading,.panel,.body-stage,.setting-card,.library-grid>*');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var prev = el.style.animation;
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = prev;
    }
  }

  window.addEventListener('hashchange', function () {
    var visible = document.querySelector('.page:not([hidden])');
    window.setTimeout(function () {
      replay(visible);
    }, 30);
  });
})();
