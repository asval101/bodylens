/* 产品演示段录制（第二版）
 *
 * 与第一版的两处不同：
 *   1. 视口 1280×720 + deviceScaleFactor 1.5 → screencast 帧是 1920×1080，
 *      但布局按 1280 宽算，产品内容占满画面，文字在成片里大 1.5 倍、且是高清渲染不是拉伸。
 *   2. 节奏放慢到 2 分半，每个功能留出看的时间。
 *
 * 用法：node .tmpdoc/rec-product.cjs [baseUrl]
 */
const { spawn } = require('child_process');
const http = require('http'); const fs = require('fs'); const path = require('path');

const BASE = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9763;
const DIR = '.tmpdoc/rec3';
const W = 1280, H = 720, DSF = 1.5;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getT = () => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: '/json' }, r => {
    let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b)));
  }).on('error', rej);
});

const child = spawn(EDGE, [
  '--headless=new', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + path.resolve('.tmpdoc/cdp-rec2'),
  '--no-proxy-server', '--proxy-bypass-list=*',
  '--window-size=' + W + ',' + H, 'about:blank'
], { stdio: 'ignore' });

const CURSOR = `(()=>{
  if(document.getElementById('rec-cursor'))return 'exists';
  const d=document.createElement('div');d.id='rec-cursor';
  d.style.cssText='position:fixed;left:-40px;top:-40px;width:16px;height:16px;margin:-8px 0 0 -8px;'+
    'border-radius:50%;background:rgba(22,33,29,.5);border:2px solid rgba(255,255,255,.95);'+
    'box-shadow:0 2px 10px rgba(0,0,0,.3);z-index:2147483647;pointer-events:none;'+
    'transition:left .6s cubic-bezier(.25,1,.5,1),top .6s cubic-bezier(.25,1,.5,1),transform .1s ease-out';
  document.body.appendChild(d);
  return 'ok';
})()`;

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  if (fs.existsSync(path.join(DIR, 'times.json'))) {
    console.log('目录里已有上一次的帧，请换一个 DIR 再跑'); process.exit(1);
  }

  let t; for (let i = 0; i < 60; i++) { try { t = await getT(); if (t && t.length) break; } catch (e) { } await sleep(200); }
  const page = t.find(x => x.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  const call = (m, p) => new Promise(res => { const mid = ++id; pend.set(mid, res); ws.send(JSON.stringify({ id: mid, method: m, params: p || {} })); });

  const frames = []; let t0 = null;
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Page.screencastFrame') {
      const d = m.params;
      if (t0 === null) t0 = d.metadata.timestamp;
      fs.writeFileSync(path.join(DIR, 'f' + String(frames.length).padStart(5, '0') + '.jpg'), Buffer.from(d.data, 'base64'));
      frames.push({ ts: (d.metadata.timestamp - t0) * 1000 });
      call('Page.screencastFrameAck', { sessionId: d.sessionId });
    }
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result || m); pend.delete(m.id); }
  });

  await call('Page.enable'); await call('Runtime.enable');
  const run = async e => { const r = await call('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r && r.result ? r.result.value : undefined; };
  const waitFor = async (expr, ms = 20000) => { const s = Date.now(); while (Date.now() - s < ms) { if (await run(expr)) return true; await sleep(200); } return false; };

  const center = async sel => run(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
    if(!e)return null;const b=e.getBoundingClientRect();
    return JSON.stringify({x:b.left+b.width*0.45,y:b.top+b.height*0.5});})()`);
  const moveTo = async (sel, extra = 0) => {
    const s = await center(sel);
    if (!s) { console.log('   光标找不到', sel); return false; }
    const { x, y } = JSON.parse(s);
    await run(`(()=>{const c=document.getElementById('rec-cursor');if(c){c.style.left='${x}px';c.style.top='${y + extra}px';}})()`);
    return true;
  };
  const moveToText = async (txt, sel = '*') => {
    const s = await run(`(()=>{const els=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>
        (e.textContent||'').trim().includes(${JSON.stringify(txt)})&&e.children.length===0);
      const e=els[0];if(!e)return null;const b=e.getBoundingClientRect();
      return JSON.stringify({x:b.left+b.width*0.5,y:b.top+b.height*0.5});})()`);
    if (!s) { console.log('   文本找不到', txt); return false; }
    const { x, y } = JSON.parse(s);
    await run(`(()=>{const c=document.getElementById('rec-cursor');if(c){c.style.left='${x}px';c.style.top='${y}px';}})()`);
    return true;
  };
  const press = async () => {
    await run(`(()=>{const c=document.getElementById('rec-cursor');if(c)c.style.transform='scale(.58)';})()`);
    await sleep(140);
    await run(`(()=>{const c=document.getElementById('rec-cursor');if(c)c.style.transform='scale(1)';})()`);
  };
  const click = async (sel, hover = 700) => {
    if (!(await moveTo(sel))) return false;
    await sleep(hover); await press(); await sleep(110);
    await run(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e)e.click();})()`);
    await sleep(320); return true;
  };
  const clickText = async (txt, sel = 'button,a,label,summary') => {
    await moveToText(txt, sel); await sleep(700); await press(); await sleep(110);
    await run(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(x=>
        (x.textContent||'').trim().includes(${JSON.stringify(txt)})&&x.children.length===0)[0];if(e)e.click();})()`);
    await sleep(320);
  };
  const scrollTo = async (sel, ms = 1400) => {
    await run(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
      if(e)e.scrollIntoView({block:'center',behavior:'smooth'});})()`);
    await sleep(ms);
  };
  const scrollToText = async (txt, ms = 1500) => {
    await run(`(()=>{const els=[...document.querySelectorAll('section,div,article')].filter(e=>
        (e.textContent||'').includes(${JSON.stringify(txt)}));
      const e=els.sort((a,b)=>a.textContent.length-b.textContent.length)[0];
      if(e)e.scrollIntoView({block:'center',behavior:'smooth'});})()`);
    await sleep(ms);
  };
  const scrollY = async (y, ms = 1300) => { await run(`window.scrollTo({top:${y},behavior:'smooth'})`); await sleep(ms); };

  await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DSF, mobile: false });

  await call('Page.navigate', { url: BASE + '/' });
  await waitFor(`!!document.querySelector('[data-pick]')`);
  await run('localStorage.clear()');
  await call('Page.reload');
  await waitFor(`!!document.querySelector('[data-pick]')`);
  await sleep(1500);
  await run('window.scrollTo(0,0)');
  await run(CURSOR);
  await sleep(400);

  await call('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  console.log('录制开始');
  const mark = l => console.log('  ' + l + '  @' + ((frames.length ? frames[frames.length - 1].ts : 0) / 1000).toFixed(1) + 's  帧' + frames.length);

  /* ---- A 首屏空态 ---- */
  await sleep(6800);
  await moveTo('[data-pick="smoke"]'); await sleep(2600);
  await scrollY(430, 2000); await sleep(4400);
  await scrollY(0, 2000); await sleep(3000);
  await mark('A 首屏空态');

  /* ---- B 记一笔 ---- */
  await click('[data-pick="smoke"]', 2600);
  await sleep(2800);
  await moveTo('[data-qty]'); await sleep(2200);
  await click('[data-qty]', 2200);
  await sleep(5600);
  await mark('B 记一笔');

  /* ---- C 器官聚焦 ---- */
  await click('[data-organ-button="lungs"]', 2600);
  await sleep(5000);
  await mark('C-1 器官聚焦');
  await clickText('证据与来源', 'button');
  await sleep(3600);
  await click('.of-back');
  await sleep(3200);
  await mark('C-2 退出聚焦');

  /* ---- D 解读与推演 ---- */
  await scrollToText('如果一直这样', 2000); await sleep(4200);
  await clickText('1 年', 'button');
  await sleep(5000);
  await mark('D 推演');
  await scrollY(9999, 1800); await sleep(4000);
  await mark('D 近七天');

  /* ---- E 资料库 ---- */
  await scrollY(0, 1500);
  await click('a[href="#library"]', 2600);
  await waitFor(`document.querySelectorAll('.library-card').length>0`);
  await sleep(4400);
  await mark('E-1 资料库');
  await click('#library-search', 900);
  await run(`(()=>{const e=document.querySelector('#library-search');e.value='烟';
    e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(3400);
  await run(`(()=>{const e=document.querySelector('#library-search');e.value='';
    e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(2600);
  await mark('E-2 搜索');
  await click('.library-card[data-behavior="alcohol"]', 2200);
  await sleep(6000);
  await mark('E-3 详情弹窗');
  await click('#detail-close', 900);
  await sleep(3200);

  /* ---- F 今日计划 ---- */
  await click('a[href="#plan"]');
  await waitFor(`!!document.querySelector('#plan-input')`);
  await sleep(3800);
  await click('#plan-input', 900);
  await sleep(800);
  const text = '今晚十一点前放下手机';
  for (let i = 1; i <= text.length; i++) {
    await run(`(()=>{const e=document.querySelector('#plan-input');
      e.value=${JSON.stringify(text)}.slice(0,${i});
      e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await sleep(105);
  }
  await sleep(1900);
  await click('#plan-form button[type="submit"]', 900);
  await sleep(3800);
  await click('input[data-task-toggle]', 1100);
  await sleep(3200);
  await mark('F 今日计划');

  /* ---- G 设置 ---- */
  await click('#settings-link', 1600);
  await sleep(5400);
  await mark('G 设置');

  /* ---- H 收尾 ---- */
  await click('a[href="#today"]', 1100);
  await sleep(4600);
  await run(`(()=>{const c=document.getElementById('rec-cursor');if(c){c.style.left='1250px';c.style.top='700px';}})()`);
  await sleep(4200);
  await mark('H 收尾');



  await call('Page.stopScreencast');
  await sleep(400);
  fs.writeFileSync(path.join(DIR, 'times.json'), JSON.stringify(frames.map(f => Math.round(f.ts))));
  console.log('\n帧数', frames.length, ' 时长', (frames[frames.length - 1].ts / 1000).toFixed(1) + 's');
  ws.close(); child.kill(); process.exit(0);
})().catch(e => { console.error(e); child.kill(); process.exit(1); });
