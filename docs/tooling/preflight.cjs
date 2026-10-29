/* 提交前体检：把 README「10 分钟极速复现」每一行都真跑一遍，按页面实际文本判断。
 *
 *   node .tmpshot/preflight.cjs [url]
 *
 * 和 check-readme.cjs 的区别：那个是分步调试用的，会复用浏览器 profile，
 * 第二次跑时账本里已经有上一次的记录，量出来就不对了。这个每次先清 storage 再 reload，
 * 而且选择器只认今天页的节点（今天页没有 h1，用 hero 区自己的类名）。
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const os = require('os');
const path = require('path');

const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = process.argv[2] || 'http://127.0.0.1:4173/';
const PORT = 9351;
const PROFILE = path.join(os.tmpdir(), 'bodylens-preflight');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + PROFILE, '--window-size=1455,1000', 'about:blank',
], { stdio: 'ignore' });

const getTargets = () => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: '/json' }, r => {
    let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b)));
  }).on('error', rej);
});

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
};

(async () => {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await getTargets(); if (targets.length) break; } catch (e) {}
    await sleep(200);
  }
  if (!targets) { console.error('浏览器没起来'); process.exit(1); }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (m, p) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  };
  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r && r.exceptionDetails) return { __err: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception || {}).description };
    return r && r.result ? r.result.value : null;
  };

  // 等到某个表达式为真，最多等 ms 毫秒
  const waitFor = async (expr, ms = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const ok = await ev(`(() => { try { return !!(${expr}); } catch (e) { return false; } })()`);
      if (ok === true) return true;
      await sleep(150);
    }
    return false;
  };

  // 干净的、渲染完成的首屏。线上首屏要 4 秒才出内容，等元素出现不够，
  // 要等「行为按钮已经渲染出来」——那才说明 JS 跑完了。
  const READY = `document.querySelector('#today-entry-chips') && document.querySelector('#today-entry-chips').children.length > 0`;

  await send('Page.navigate', { url: URL });
  await sleep(2500);
  await ev('localStorage.clear(); sessionStorage.clear(); "cleared"');
  await send('Page.reload', { ignoreCache: true });
  if (!await waitFor(READY, 20000)) { console.error('今天页没渲染出来（行为按钮始终是空的）'); process.exit(1); }
  await sleep(900);

  // ---------- 3 分钟：首屏 ----------
  const first = await ev(`(() => {
    const q = s => document.querySelector(s);
    const txt = s => { const e = q(s); return e ? e.innerText.trim() : null; };
    const today = q('#page-today');
    return {
      number: txt('#today-number'),
      unit: txt('#today-unit'),
      label: txt('.hero-label'),
      anchor: txt('#today-anchor'),
      compare: txt('#today-compare'),
      organs: txt('#today-organs'),
      estimateHidden: q('#today-estimate') ? q('#today-estimate').hidden : null,
      logLines: (q('#today-log') ? q('#today-log').innerText : '').split('\\n').map(s=>s.trim()).filter(Boolean).slice(0,6),
      todayText: today ? today.innerText.slice(0, 500) : '',
      bodyHasNotStarted: document.body.innerText.includes('还没开始')
    };
  })()`);
  console.log('\n========== 3 分钟：首屏 ==========');
  console.log(JSON.stringify(first, null, 2));
  check('首屏写「还没开始」，不编数字', first.number === '还没开始', `实际「${first.number}」`);
  check('首屏不显示估算提示（没数字就不该有口径）', first.estimateHidden === true);

  // ---------- 7 分钟：空账本的三块 ----------
  const empty = await ev(`(() => {
    const t = document.body.innerText;
    return {
      forecastEmpty: t.includes('这张卡还没有数字'),
      trendEmpty: t.includes('还没有数据'),
      hasInterpret: t.includes('解读'),
      aiTag: (document.querySelector('.ai-tag') || {}).innerText || null
    };
  })()`);
  console.log('\n========== 7 分钟：空账本三块 ==========');
  console.log(JSON.stringify(empty, null, 2));
  check('推演卡写「这张卡还没有数字」', empty.forecastEmpty === true);
  check('趋势写「还没有数据」', empty.trendEmpty === true);

  // ---------- 5 分钟：记一支烟 ----------
  const rec = await ev(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const btns = [...document.querySelectorAll('button, [role=button]')];
    const smoke = btns.find(b => (b.innerText || '').trim().startsWith('香烟'));
    if (!smoke) return { error: '找不到「香烟」按钮', seen: btns.map(b => (b.innerText||'').trim()).filter(Boolean).slice(0, 20) };
    smoke.click();
    await sleep(500);
    const plus = [...document.querySelectorAll('button')].find(b => /^\\+1 支$/.test((b.innerText || '').trim()));
    if (!plus) return { error: '找不到「+1 支」按钮', seen: [...document.querySelectorAll('button')].map(b => (b.innerText||'').trim()).filter(Boolean).slice(0, 24) };
    plus.click();
    // 等数字真的落到 20（线上慢，写死 sleep 会读到中间态）
    for (let i = 0; i < 40; i++) {
      const n = document.querySelector('#today-number');
      if (n && n.innerText.trim() === '20') break;
      await sleep(150);
    }
    await sleep(400);
    const q = s => document.querySelector(s);
    const txt = s => { const e = q(s); return e ? e.innerText.trim() : null; };
    return {
      number: txt('#today-number'),
      unit: txt('#today-unit'),
      estimate: txt('#today-estimate'),
      estimateHidden: q('#today-estimate') ? q('#today-estimate').hidden : null,
      anchor: txt('#today-anchor'),
      compare: txt('#today-compare'),
      organs: txt('#today-organs'),
      logText: (q('#today-log') || {}).innerText || null
    };
  })()`);
  console.log('\n========== 5 分钟：记一支烟 ==========');
  console.log(JSON.stringify(rec, null, 2));
  const recOk = !rec.error;
  check('记一支烟后大数字变成 20 分钟', recOk && rec.number === '20', recOk ? `实际「${rec.number}${rec.unit || ''}」` : rec.error);
  check('估算提示出现且写明「不是你的个人预测」', recOk && rec.estimateHidden === false && /不是你的个人预测/.test(rec.estimate || ''), rec.estimate);
  check('换算成「大约等于 一集短剧」', recOk && /一集短剧/.test(rec.anchor || ''), rec.anchor);
  check('涉及 肺部 · 心脏 · 大脑 · 口腔', recOk && ['肺部', '心脏', '大脑', '口腔'].every(k => (rec.organs || '').includes(k)), rec.organs);

  // ---------- 10 分钟：点器官出详情 ----------
  const organ = await ev(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    // 优先点肺（有行为关联、一定出详情）；退回到列表里按名字挑
    let node = document.querySelector('[data-organ="lungs"]');
    if (!node) {
      const picker = [...document.querySelectorAll('#organ-picker button')];
      node = picker.find(b => (b.innerText || '').includes('肺'));
    }
    if (!node) return { error: '找不到可点的肺' };
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    for (let i = 0; i < 40; i++) {
      const p = document.querySelector('.detail-panel');
      if (p && /证据|来源/.test(p.innerText || '')) break;
      await sleep(150);
    }
    const panel = document.querySelector('.detail-panel');
    return { panelText: panel ? panel.innerText.slice(0, 300) : null };
  })()`);
  console.log('\n========== 10 分钟：点器官 ==========');
  console.log(JSON.stringify(organ, null, 2));
  check('点肺出现详情（功能/关联行为/证据）', !organ.error && !!organ.panelText && /证据|来源/.test(organ.panelText), organ.error || (organ.panelText || '').slice(0, 60));

  // 把详情面板关掉，免得影响后面
  await ev(`(() => { const c = document.querySelector('.detail-panel .detail-close, #detail-close'); if (c) c.click(); return 1; })()`);
  await sleep(500);

  // ---------- 9 分钟：断网再记一笔 ----------
  // 注意：不能 reload。断网后刷新等于重新下载 html，本地也没有 service worker，
  // 白屏是必然的，那不是「断网可用」要验的东西。README 里写的也是「再记一笔」。
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  const offlineRec = await ev(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const btns = [...document.querySelectorAll('button')];
    const smoke = btns.find(b => (b.innerText || '').trim().startsWith('香烟'));
    if (!smoke) return { error: '断网后找不到行为按钮' };
    smoke.click();
    await sleep(500);
    const plus = [...document.querySelectorAll('button')].find(b => /^\\+1 支$/.test((b.innerText || '').trim()));
    if (!plus) return { error: '断网后找不到数量按钮' };
    plus.click();
    for (let i = 0; i < 40; i++) {
      const n = document.querySelector('#today-number');
      if (n && n.innerText.trim() === '40') break;
      await sleep(150);
    }
    await sleep(400);
    const q = s => document.querySelector(s);
    return {
      number: q('#today-number') ? q('#today-number').innerText.trim() : null,
      aiTag: q('#ai-tag') ? q('#ai-tag').innerText.trim() : null,
      logText: (q('#today-log') || {}).innerText || null
    };
  })()`);
  console.log('\n========== 9 分钟：断网后记一笔 ==========');
  console.log(JSON.stringify(offlineRec, null, 2));
  check('断网后还能记账（1 支 → 2 支，20 → 40 分钟）', !offlineRec.error && offlineRec.number === '40', offlineRec.error || `实际「${offlineRec.number}」`);
  check('断网时标签仍是「本地解读」', /本地解读/.test(offlineRec.aiTag || ''), offlineRec.aiTag);

  // 恢复网络，别把离线状态带出去
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  // ---------- 390 窄屏 ----------
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(1500);
  const narrow = await ev(`(() => {
    const de = document.documentElement;
    const wide = [...document.querySelectorAll('body *')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > de.clientWidth + 1;
    }).slice(0, 6).map(el => el.tagName + '.' + (el.className || '').toString().split(' ')[0] + ' right=' + Math.round(el.getBoundingClientRect().right));
    return { clientWidth: de.clientWidth, scrollWidth: de.scrollWidth, overflow: wide };
  })()`);
  console.log('\n========== 390 窄屏 ==========');
  console.log(JSON.stringify(narrow, null, 2));
  check('390 宽无横向溢出', narrow.scrollWidth <= narrow.clientWidth + 1, `clientWidth ${narrow.clientWidth} / scrollWidth ${narrow.scrollWidth}`);

  // 控制台报错
  const errs = await ev(`(() => (window.__errs || []).length)()`);

  ws.close();
  child.kill();

  const pass = results.filter(r => r.pass).length;
  console.log('\n==================================');
  console.log(`合计 ${pass}/${results.length} 项通过`);
  results.filter(r => !r.pass).forEach(r => console.log('未通过：' + r.name + '  ' + (r.detail || '')));
  process.exit(pass === results.length ? 0 : 2);
})().catch(e => { console.error(e); try { child.kill(); } catch (_) {} process.exit(1); });
