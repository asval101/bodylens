/* 技术文档 HTML → PDF
 * 用法：node .tmpdoc/to-pdf.cjs [in.html] [out.pdf]
 * 关键点：
 *   - preferCSSPageSize 让 @page{size:A4} 生效
 *   - printBackground 必须开，否则底色块和表格线全没
 *   - 页脚用 footerTemplate，中文字体在模板里要显式给（模板不继承页面 CSS）
 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const IN = path.resolve(process.argv[2] || '.tmpdoc/doc.html');
const OUT = path.resolve(process.argv[3] || 'docs/身知BodyLens-技术文档.pdf');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9711;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getT = () => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: '/json' }, r => {
    let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b)));
  }).on('error', rej);
});

const child = spawn(EDGE, [
  '--headless=new', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + path.resolve('.tmpdoc/cdp-pdf'),
  '--no-proxy-server', '--proxy-bypass-list=*',
  '--window-size=1200,900', 'about:blank'
], { stdio: 'ignore' });

const footer = `<div style="width:100%;font-family:'Microsoft YaHei',sans-serif;font-size:7.6pt;color:#8a938d;
  padding:0 17mm;display:flex;justify-content:space-between;align-items:center;letter-spacing:.06em;">
  <span>身知 BodyLens · 技术文档</span>
  <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`;
const header = `<div style="width:100%;font-size:1px;color:transparent;">&#8203;</div>`;

(async () => {
  let t;
  for (let i = 0; i < 60; i++) { try { t = await getT(); if (t && t.length) break; } catch (e) { } await sleep(200); }
  const page = t.find(x => x.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  const call = (m, p) => new Promise(res => { const mid = ++id; pend.set(mid, res); ws.send(JSON.stringify({ id: mid, method: m, params: p || {} })); });

  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result || m); pend.delete(m.id); }
  });

  await call('Page.enable');
  const url = 'file:///' + IN.replace(/\\/g, '/');
  await call('Page.navigate', { url });
  await sleep(1800);   // 等字体与布局稳定

  const r = await call('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: header,
    footerTemplate: footer,
    marginTop: 0.55, marginBottom: 0.55, marginLeft: 0, marginRight: 0,
    scale: 1,
    transferMode: 'ReturnAsBase64'
  });

  if (!r.data) { console.error('printToPDF 失败', JSON.stringify(r).slice(0, 300)); process.exit(1); }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(r.data, 'base64'));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log('PDF 已生成:', OUT, kb + ' KB');
  ws.close(); child.kill();
  process.exit(0);
})().catch(e => { console.error(e); child.kill(); process.exit(1); });
