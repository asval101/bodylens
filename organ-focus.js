/* Local, finite organ close-ups. Presentation only: reads the rendered DOM,
   never the catalog, user state or storage. Images and conclusions stay local. */
(function (global) {
  'use strict';

  function mergeBounds(rects) {
    const valid = rects.filter(r => r && [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0);
    if (!valid.length) return null;
    const x = Math.min(...valid.map(r => r.x)), y = Math.min(...valid.map(r => r.y));
    return { x, y, width: Math.max(...valid.map(r => r.x + r.width)) - x, height: Math.max(...valid.map(r => r.y + r.height)) - y };
  }

  function fitCamera(frame, bounds, padding) {
    if (!frame || !bounds || ![frame.width, frame.height, bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) return null;
    if (frame.width <= 0 || frame.height <= 0 || bounds.width <= 0 || bounds.height <= 0) return null;
    const p = Object.assign({ left: 26, right: 26, top: 82, bottom: 184 }, padding);
    const w = frame.width - p.left - p.right, h = frame.height - p.top - p.bottom;
    if (w <= 0 || h <= 0) return null;
    const scale = Math.min(w / bounds.width, h / bounds.height, 9);
    return {
      scale,
      x: p.left + w / 2 - (bounds.x + bounds.width / 2) * scale,
      y: p.top + h / 2 - (bounds.y + bounds.height / 2) * scale
    };
  }

  const geometry = Object.freeze({ mergeBounds, fitCamera });
  if (typeof module !== 'undefined' && module.exports) module.exports = geometry;
  if (!global.document) return;
  global.BodyLens = global.BodyLens || {};
  global.BodyLens.focusGeometry = geometry;

  const scene = document.getElementById('anatomy-scene');
  const art = document.getElementById('anatomy-art');
  const detail = document.getElementById('detail-content');
  if (!scene || !art || !detail) return;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionOn = () => !reduced.matches && !document.body.classList.contains('no-motion');
  const travelOn = () => motionOn() && !document.body.classList.contains('no-depth');
  const layer = document.createElement('section');
  layer.className = 'organ-focus';
  layer.hidden = true;
  layer.tabIndex = -1;
  layer.setAttribute('aria-label', '器官特写');
  layer.innerHTML = [
    '<div class="of-atmosphere" aria-hidden="true"></div>',
    '<div class="of-world" aria-hidden="true"></div>',
    '<div class="of-chrome"><button type="button" class="of-back">← 返回人体</button>',
    '<span class="of-disclaimer">结构与机制示意</span></div>',
    '<div class="of-heading"><span class="of-kicker"></span><h2></h2></div>',
    '<div class="of-story"><div class="of-story-top"><span class="of-counter"></span>',
    '<button type="button" class="of-play"></button></div>',
    '<div class="of-steps" role="group" aria-label="查看演示阶段"></div>',
    '<p class="of-caption" role="status" aria-live="polite"></p>',
    '<button type="button" class="of-evidence">查看依据与研究范围 ↗</button></div>'
  ].join('');
  scene.appendChild(layer);
  const world = $('.of-world', layer);
  const back = $('.of-back', layer);
  const stepRow = $('.of-steps', layer);
  const play = $('.of-play', layer);
  let active = null, timer = null, version = 0, selection = 0, animations = [];
  let readOnly = false;
  const transform = camera => 'translate(' + camera.x + 'px,' + camera.y + 'px) scale(' + camera.scale + ')';

  function stop() {
    clearTimeout(timer);
    timer = null;
    if (active) active.playing = false;
    layer.classList.remove('of-playing');
  }
  function cancelTravel() {
    animations.forEach(animation => animation.cancel());
    animations = [];
  }
  function animate(node, frames, options) {
    if (!node.animate) return null;
    const animation = node.animate(frames, options);
    animations.push(animation);
    return animation;
  }
  function cameraFor() {
    if (!active) return null;
    return fitCamera({ width: scene.clientWidth, height: scene.clientHeight }, active.bounds);
  }
  function overviewCamera(source) {
    const view = source.viewBox.baseVal, rect = source.getBoundingClientRect(), frame = scene.getBoundingClientRect();
    const scale = Math.min(rect.width / view.width, rect.height / view.height);
    return { scale, x: rect.left - frame.left + (rect.width - view.width * scale) / 2, y: rect.top - frame.top + (rect.height - view.height * scale) / 2 };
  }
  function refreshPlay() {
    play.hidden = !active || active.steps.length < 2 || !motionOn();
    play.textContent = active && active.playing ? 'Ⅱ 暂停' : '↻ 播放';
    play.setAttribute('aria-label', active && active.playing ? '暂停机制示意' : '播放机制示意');
  }
  function showStep(index) {
    if (!active) return;
    active.index = index;
    layer.dataset.step = String(index);
    $$('.of-step', layer).forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    $('.of-counter', layer).textContent = active.steps.length > 1 ? String(index + 1).padStart(2, '0') + ' / ' + String(active.steps.length).padStart(2, '0') : '器官结构';
    $('.of-caption', layer).textContent = active.steps[index].text;
    refreshPlay();
  }
  function schedule() {
    if (!active || !active.playing) return;
    timer = setTimeout(() => {
      if (!active || !active.playing) return;
      if (active.index + 1 < active.steps.length) {
        showStep(active.index + 1);
        schedule();
      } else {
        stop();
        refreshPlay();
      }
    }, 3400);
  }
  function start() {
    if (!active || active.steps.length < 2 || !motionOn()) return;
    stop();
    showStep(0);
    active.playing = true;
    layer.classList.add('of-playing');
    refreshPlay();
    schedule();
  }
  function safeClone(source, id) {
    const clone = source.cloneNode(true), prefix = 'of-' + version + '-';
    const ids = new Map();
    $$('[id]', clone).forEach(node => { ids.set(node.id, prefix + node.id); node.id = prefix + node.id; });
    [clone, ...$$('*', clone)].forEach(node => {
      [...node.attributes].forEach(attribute => {
        let value = attribute.value.replace(/url\(#([^)]+)\)/g, (match, key) => ids.has(key) ? 'url(#' + ids.get(key) + ')' : match);
        if (value[0] === '#' && ids.has(value.slice(1))) value = '#' + ids.get(value.slice(1));
        if (value !== attribute.value) node.setAttribute(attribute.name, value);
      });
      node.removeAttribute('tabindex');
      if (node.getAttribute('role') === 'button') node.removeAttribute('role');
    });
    clone.setAttribute('class', 'of-human');
    clone.setAttribute('aria-hidden', 'true');
    $$('.organ', clone).forEach(node => {
      const target = node.getAttribute('data-organ') === id;
      node.setAttribute('class', 'of-organ-shape' + (target ? ' of-target' : ''));
      node.removeAttribute('data-organ');
      node.style.removeProperty('transform');
    });
    $$('.impact-animation', clone).forEach(node => node.remove());
    [...clone.children].forEach(node => {
      if (node.tagName.toLowerCase() !== 'defs' && !node.classList.contains('of-target')) node.classList.add('of-context');
    });
    return clone;
  }
  function addFlow(svg) {
    const ns = 'http://www.w3.org/2000/svg';
    const group = document.createElementNS(ns, 'g');
    group.setAttribute('class', 'of-flow');
    group.setAttribute('aria-hidden', 'true');
    [0, 1].forEach(side => {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', side ? 'M200 123V169L224 194' : 'M200 123V169L176 194');
      path.setAttribute('class', 'of-airway');
      group.appendChild(path);
      [0, 1, 2].forEach(i => {
        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', '200');
        dot.setAttribute('cy', '123');
        dot.setAttribute('r', '1.7');
        dot.setAttribute('class', 'of-tracer of-tracer-' + side);
        dot.style.animationDelay = (i * 0.4) + 's';
        group.appendChild(dot);
      });
    });
    svg.appendChild(group);
  }
  function readSteps(id) {
    const path = id === 'lungs' ? $$('.effect-path .path-item', detail) : [];
    if (path.length) return path.map(item => {
      const title = $('b', item);
      const copy = item.cloneNode(true);
      $('b', copy)?.remove();
      return { label: title ? title.textContent.split('/')[0].trim() : '机制示意', text: copy.textContent.trim() };
    });
    return [{ label: '结构', text: $('#detail-heading .organ-function')?.textContent || '当前未收录对应结论。未收录不代表无害。' }];
  }
  function open(id, sourceButton) {
    const source = $('.human', art);
    if (!source || !/^[a-z]+$/.test(id)) return;
    const organs = $$('.organ[data-organ="' + id + '"]', source).filter(node => getComputedStyle(node).display !== 'none');
    const box = mergeBounds(organs.map(node => {
      const b = node.getBBox();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    }));
    if (!box) return;
    stop(); cancelTravel(); ++version;
    const view = source.viewBox.baseVal, frame = scene.getBoundingClientRect();
    active = { id, sourceButton, bounds: { x: box.x - view.x, y: box.y - view.y, width: box.width, height: box.height }, steps: readSteps(id), playing: false, index: 0 };
    const camera = cameraFor();
    if (!camera) { active = null; return; }
    active.initial = overviewCamera(source);
    const snapshot = safeClone(source, id);
    world.replaceChildren(snapshot);
    world.style.width = view.width + 'px';
    world.style.height = view.height + 'px';
    if (id === 'lungs' && active.steps.length > 1) addFlow(snapshot);
    const heading = $('#detail-heading h2');
    const title = heading?.firstChild?.textContent.trim() || '器官';
    $('.of-kicker', layer).textContent = $('#detail-heading .organ-en')?.textContent || 'BODY ATLAS';
    $('.of-heading h2', layer).textContent = title;
    layer.setAttribute('aria-label', title + '特写');
    layer.dataset.organ = id;
    layer.classList.toggle('of-has-mechanism', active.steps.length > 1);
    stepRow.replaceChildren(...active.steps.map((step, index) => {
      const button = document.createElement('button');
      button.className = 'of-step';
      button.type = 'button';
      button.dataset.stepIndex = String(index);
      button.textContent = String(index + 1).padStart(2, '0') + ' ' + step.label;
      return button;
    }));
    $('.of-disclaimer', layer).textContent = active.steps.length > 1 ? '机制示意 · 非个人损伤进度' : '结构示意 · 非个人检测';
    $('.of-evidence', layer).hidden = !detail.querySelector('.impact-card');
    layer.hidden = false;
    scene.classList.add('has-organ-focus');
    scene.classList.remove('vfx-focus', 'vfx-pointer');
    $('#organ-tooltip').hidden = true;
    world.style.transform = transform(camera);
    showStep(0);
    layer.focus({ preventScroll: true });
    if (frame.top < 0 || frame.bottom > innerHeight) scene.scrollIntoView({ block: 'center', behavior: motionOn() ? 'smooth' : 'instant' });
    if (travelOn()) {
      const options = { duration: 440, easing: 'cubic-bezier(.2,.7,.3,1)' };
      animate(world, [{ transform: transform(active.initial) }, { transform: transform(camera) }], options);
      animate($('.of-atmosphere', layer), [{ opacity: 0 }, { opacity: 1 }], options);
      $$('.of-context', world).forEach(node => animate(node, [{ opacity: 1 }, { opacity: 0.055 }], options));
      animate($('.of-story', layer), [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, delay: 180, easing: 'ease-out' });
    }
    const token = version;
    timer = setTimeout(() => { if (active && token === version) start(); }, travelOn() ? 450 : 0);
  }
  function finishClose(id, restoreFocus) {
    stop(); cancelTravel(); ++version;
    active = null;
    layer.hidden = true;
    world.replaceChildren();
    scene.classList.remove('has-organ-focus');
    if (restoreFocus) $('#organ-picker [data-organ-button="' + id + '"]')?.focus({ preventScroll: true });
  }
  function close(restoreFocus = true) {
    ++selection;
    if (!active) return;
    const id = active.id;
    if (!restoreFocus || !travelOn() || !world.animate) { finishClose(id, restoreFocus); return; }
    if (active.closing) return;
    stop(); cancelTravel();
    active.closing = true;
    const source = $('.human', art);
    if (source) active.initial = overviewCamera(source);
    const token = ++version;
    const start = world.style.transform, end = transform(active.initial);
    world.style.transform = end;
    const options = { duration: 380, easing: 'cubic-bezier(.2,.7,.3,1)' };
    const flight = animate(world, [{ transform: start }, { transform: end }], options);
    $$('.of-context', world).forEach(node => animate(node, [{ opacity: 0.055 }, { opacity: 1 }], options));
    animate($('.of-atmosphere', layer), [{ opacity: 1 }, { opacity: 0 }], options);
    animate($('.of-story', layer), [{ opacity: 1 }, { opacity: 0 }], { duration: 180 });
    if (flight) flight.finished.then(() => { if (active && version === token) finishClose(id, true); }).catch(() => {});
    else finishClose(id, true);
  }

  back.addEventListener('click', () => close());
  play.addEventListener('click', () => {
    if (!active) return;
    if (active.playing) { stop(); refreshPlay(); } else start();
  });
  stepRow.addEventListener('click', event => {
    const button = event.target.closest('[data-step-index]');
    if (!button) return;
    stop(); showStep(Number(button.dataset.stepIndex));
  });
  $('.of-evidence', layer).addEventListener('click', () => {
    const button = $('[data-show-evidence]', detail);
    close(false);
    if (button) button.click();
    const tab = $('[data-detail="evidence"]');
    tab?.focus();
    if (innerWidth <= 980) tab?.scrollIntoView({ block: 'center', behavior: motionOn() ? 'smooth' : 'instant' });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !active) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest('#play-path')) {
      event.preventDefault(); event.stopImmediatePropagation();
      open('lungs', event.target.closest('button'));
    }
  }, true);
  document.addEventListener('click', event => {
    const organ = event.target.closest('#anatomy-art [data-organ],#organ-labels [data-organ-button],#organ-picker [data-organ-button]');
    if (organ) {
      const id = organ.dataset.organ || organ.dataset.organButton;
      const token = ++selection;
      // Native event dispatch can run a microtask between capture and bubble.
      // Wait for app.js to finish replacing the detail DOM before reading it.
      setTimeout(() => { if (selection === token) open(id, organ); }, 0);
    } else if (active && event.target.closest('[data-view],[data-zoom],#analyze,[data-detail],[data-show-evidence],[data-show-action]')) {
      close(false);
    }
  }, true);
  /* 系统筛选下拉在合并成单页后已经移除。这里保留判断，
     是为了让 organ-focus 仍然是可选的增强模块 —— 页面少了哪块都不该报错。 */
  const systemSelect = $('#system');
  if (systemSelect) systemSelect.addEventListener('change', () => close(false));
  window.addEventListener('hashchange', () => close(false));
  function refit() {
    if (!active) return;
    if (active.closing) { finishClose(active.id, false); return; }
    cancelTravel();
    const camera = cameraFor();
    if (camera) world.style.transform = transform(camera);
  }
  window.addEventListener('resize', refit);
  if (global.ResizeObserver) new ResizeObserver(refit).observe(scene);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stop(); refreshPlay(); }
  });
  function syncPrefs() {
    if (!active) return;
    if (active.closing && !travelOn()) { finishClose(active.id, true); return; }
    if (!travelOn()) { cancelTravel(); const camera = cameraFor(); if (camera) world.style.transform = transform(camera); }
    if (!motionOn()) stop();
    refreshPlay();
  }
  new MutationObserver(syncPrefs).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  reduced.addEventListener('change', syncPrefs);

  // Progressive disclosure changes presentation only; research context stays
  // next to every numerical metric and all original source buttons still work.
  function conciseDetails() {
    if (readOnly) return;
    readOnly = true;
    $$('.impact-card > p', detail).forEach(paragraph => {
      const fold = document.createElement('details'), summary = document.createElement('summary');
      fold.className = 'impact-explanation';
      summary.textContent = '为什么会这样';
      paragraph.before(fold); fold.append(summary, paragraph);
    });
    const path = $('#detail-content > .effect-path');
    if (path) {
      const fold = document.createElement('details'), summary = document.createElement('summary');
      fold.className = 'path-explanation';
      summary.textContent = '查看三个阶段的文字说明';
      path.before(fold); fold.append(summary, path);
    }
    const button = $('#play-path');
    if (button) button.textContent = '进入肺部，观看机制示意 ↗';
    readOnly = false;
  }
  new MutationObserver(conciseDetails).observe(detail, { childList: true });
  conciseDetails();
  global.BodyLens.organFocus = Object.freeze({ close });
})(typeof window === 'undefined' ? globalThis : window);
