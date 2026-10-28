/* 归档线上版的产品截图，存进 docs/evidence/screenshots/
 * 用法：node .tmpshot/shot-evidence.cjs [baseUrl]
 * 线上首屏约 4 秒才渲染完，所以每步都轮询等元素出现，不写死 sleep。
 */
const { spawn } = require('child_process');
const http = require('http'); const fs = require('fs'); const path = require('path');

const BASE = (process.argv[2] || 'https://body-ledger.com').replace(/\/$/, '');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9741;
const OUT = 'docs/evidence/screenshots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getT = () => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: '/json' }, r => {
    let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b)));
  }).on('error', rej);
});

const child = spawn(EDGE, [
  '--headless=new', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + path.resolve('.tmpshot/cdp-evidence'),
  '--no-proxy-server', '--proxy-bypass-list=*',
  '--window-size=1440,900', 'about:blank'
], { stdio: 'ignore' });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let t; for (let i = 0; i < 60; i++) { try { t = await getT(); if (t && t.length) break; } catch (e) { } await sleep(200); }
  const page = t.find(x => x.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = [];
  const call = (m, p) => new Promise(res => { const mid = ++id; pend.set(mid, res); ws.send(JSON.stringify({ id: mid, method: m, params: p || {} })); });
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result || m); pend.delete(m.id); }
  });
  await call('Page.enable'); await call('Runtime.enable');

  const run = async e => { const r = await call('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r && r.result ? r.result.value : undefined; };
  const waitFor = async (expr, ms = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await run(expr)) return true; await sleep(250); }
    return false;
  };
  const size = async (w, h) => call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });

  const shoot = async (name, full) => {
    await sleep(650);
    const p = full
      ? { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: await run('document.documentElement.scrollWidth'), height: await run('document.documentElement.scrollHeight'), scale: 1 } }
      : { format: 'png', captureBeyondViewport: false };
    const s = await call('Page.captureScreenshot', p);
    if (!s || !s.data) { console.log('  ✗ 截图失败', name, JSON.stringify(s).slice(0, 120)); return null; }
    const f = path.join(OUT, name + '.png');
    fs.writeFileSync(f, Buffer.from(s.data, 'base64'));
    const h = (await run('document.documentElement.scrollHeight'));
    console.log('  ✓', name, '高 ' + h + 'px');
    return f;
  };

  /* ---------- 1. 今天页 · 空态 ---------- */
  await size(1440, 900);
  await call('Page.navigate', { url: BASE + '/' });
  await waitFor(`!!document.querySelector('[data-pick]')`);
  await run(`localStorage.clear()`);
  await call('Page.reload', { ignoreCache: false });
  await waitFor(`!!document.querySelector('[data-pick]')`);
  await sleep(600);
  await run('window.scrollTo(0,0)');
  await shoot('2026-10-28-01-today-empty');

  /* ---------- 2. 今天页 · 记一笔之后 ---------- */
  await run(`document.querySelector('[data-pick="smoke"]').click()`);
  await sleep(500);
  await run(`(document.querySelector('[data-qty]')||{click(){}}).click()`);
  await sleep(900);
  await run('window.scrollTo(0,0)');
  await shoot('2026-10-28-02-today-recorded');

  /* ---------- 3. 今天页 · 推演卡（切到 1 年） ---------- */
  await run(`(()=>{const a=[...document.querySelectorAll('button,a')].find(e=>/1\\s*年/.test(e.textContent));if(a)a.click();})()`);
  await sleep(700);
  await run(`(()=>{const e=[...document.querySelectorAll('*')].find(x=>/如果一直这样/.test(x.textContent||'')&&x.children.length<6);if(e)e.scrollIntoView({block:'center'});})()`);
  await shoot('2026-10-28-03-today-forecast');

  /* ---------- 4. 行为资料库 ---------- */
  await call('Page.navigate', { url: BASE + '/#library' });
  await waitFor(`document.querySelectorAll('.library-card').length>0`);
  await sleep(500);
  await run('window.scrollTo(0,0)');
  await shoot('2026-10-28-04-library');

  /* ---------- 5. 资料库详情弹窗 ---------- */
  await run(`(()=>{const c=document.querySelector('.library-card[data-behavior="smoke"]')||document.querySelector('.library-card');c.click();})()`);
  await waitFor(`!document.getElementById('detail-modal').hidden`);
  await sleep(900);
  await shoot('2026-10-28-05-library-detail');

  /* ---------- 6. 今日计划 ---------- */
  await call('Page.navigate', { url: BASE + '/#plan' });
  await waitFor(`!!document.querySelector('#plan-form')`);
  await sleep(500);
  await shoot('2026-10-28-06-plan');

  /* ---------- 7. 数据与设置 ---------- */
  await call('Page.navigate', { url: BASE + '/#settings' });
  await waitFor(`!!document.querySelector('#export-backup')`);
  await sleep(500);
  await shoot('2026-10-28-07-settings');

  /* ---------- 8. 窄屏 390 ---------- */
  await size(390, 844);
  await call('Page.navigate', { url: BASE + '/' });
  await waitFor(`!!document.querySelector('[data-pick]')`);
  await sleep(600);
  await run('window.scrollTo(0,0)');
  await shoot('2026-10-28-08-today-390');

  console.log('\n控制台异常：', errs.length ? errs.slice(0, 3) : '无');
  ws.close(); child.kill(); process.exit(0);
})().catch(e => { console.error(e); child.kill(); process.exit(1); });
