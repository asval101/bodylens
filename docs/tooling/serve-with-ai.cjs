/* 本机起「带 AI 的」完整服务：静态文件 + /api 反代，两个端口一次起好
 *
 * 为什么需要这个：`npm start` 只起静态服务，没有 /api，页面会一直停在「本地解读」。
 * 录屏要拍到「AI 解读」那个标签，就必须把 server/proxy.cjs 也接上。
 *
 * proxy.cjs 自己不读 .env（线上是 systemd 用 EnvironmentFile 注入的），
 * 所以这里先把它读进 process.env。改动产品代码一行不用。
 *
 * 用法：
 *   cp server/.env.example server/.env   # 填上 AI_API_KEY
 *   node docs/tooling/serve-with-ai.cjs  # → http://127.0.0.1:4173
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ENV = path.join(ROOT, 'server', '.env');
const PORT = Number(process.env.PORT || 4173);
const API_PORT = Number(process.env.API_PORT || 8080);

if (fs.existsSync(ENV)) {
  for (const line of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[t.slice(0, i).trim()] = v;
  }
  console.log('已读入 server/.env');
} else {
  console.log('没有 server/.env，/api 会返回 503，页面停在「本地解读」');
}

process.env.PORT = String(API_PORT);
process.env.BIND = process.env.BIND || '127.0.0.1';
require(path.join(ROOT, 'server', 'proxy.cjs'));

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp'
};

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    // SSE 靠不缓冲：直接 pipe，不攒包
    const up = http.request({
      host: '127.0.0.1', port: API_PORT, path: req.url, method: req.method,
      headers: Object.assign({}, req.headers, { host: '127.0.0.1:' + API_PORT })
    }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', e => { res.writeHead(502); res.end('upstream: ' + e.message); });
    req.pipe(up);
    return;
  }
  let target;
  try {
    target = path.resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  } catch { res.writeHead(400); return res.end('bad request'); }
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  if (target === ROOT) target = path.join(ROOT, 'index.html');
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {
      'Content-Type': types[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => console.log('带 AI 的本地服务: http://127.0.0.1:' + PORT));
