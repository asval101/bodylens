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
