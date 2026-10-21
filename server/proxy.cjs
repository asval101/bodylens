/* 身知 BodyLens —— 零依赖服务端
 *
 * 只做两件事：
 *   1. 托管静态文件（和 scripts/serve.cjs 行为一致，但监听公网）
 *   2. POST /api/interpret —— 替浏览器保管大模型密钥，流式转发解读
 *
 * 为什么不用 Express：装了依赖就多一步 npm install，
 * 「10 分钟复现」这条硬指标会立刻变脆。Node 内置的 http + fetch 够了。
 *
 * 环境变量（写在同目录 .env，由 systemd 注入）：
 *   AI_API_KEY    必填。没有它服务照常启动，只是 /api/interpret 返回 503，
 *                 前端会自动退回本地解读——这正好是断网可用的演练。
 *   AI_BASE_URL   默认 https://api.deepseek.com   （OpenAI 兼容即可）
 *   AI_MODEL      默认 deepseek-chat
 *   PORT          默认 8080
 *   BIND          默认 0.0.0.0
 *   STATIC_ROOT   默认上一级目录
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const PORT = Number(process.env.PORT || 8080);
const BIND = process.env.BIND || '0.0.0.0';
const ROOT = path.resolve(process.env.STATIC_ROOT || path.join(__dirname, '..'));

const AI_KEY = (process.env.AI_API_KEY || '').trim();
const AI_BASE = (process.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';

const { chatEndpoint } = require('./endpoint.cjs');

const MAX_BODY = 8 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 12;
const DAILY_MAX = 800;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8'
};

/* 只压缩文本类，图片再压没意义反而费 CPU。 */
const COMPRESSIBLE = /\.(html|css|js|json|svg|txt|md)$/;

/* ---------- 限流 ---------- */

const hits = new Map();
let dayStamp = new Date().toISOString().slice(0, 10);
let dayCount = 0;

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.socket.remoteAddress || 'unknown';
}

function rateLimited(ip) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayStamp) {
    dayStamp = today;
    dayCount = 0;
  }
  if (dayCount >= DAILY_MAX) return 'daily';

  const now = Date.now();
  const slot = hits.get(ip);
  if (!slot || now > slot.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    dayCount += 1;
    return null;
  }
  if (slot.count >= RATE_MAX) return 'window';
  slot.count += 1;
  dayCount += 1;
  return null;
}

/* ---------- 输入校验 ---------- */

const TEXT_KEYS = ['name', 'unit', 'id'];

function clip(value, max) {
  if (typeof value !== 'string') return '';
  /* 去掉控制字符与尖括号，既防注入也防把界面撑破。 */
  return value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
}

function num(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function validate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const items = Array.isArray(raw.items) ? raw.items.slice(0, 12) : [];
  const noted = Array.isArray(raw.noted) ? raw.noted.slice(0, 12) : [];

  const cleanItems = items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      id: clip(item.id, 24),
      name: clip(item.name, 10),
      qty: num(item.qty, 0, 100000),
      unit: clip(item.unit, 4),
      minutes: num(item.minutes, -100000, 100000),
      direction: clip(item.direction, 1),
      value: clip(item.value, 1),
      withinCap: item.withinCap === true,
      hasRange: item.hasRange === true
    }))
    .filter(item => item.name && item.minutes !== 0 || item.withinCap);

  const cleanNoted = noted
    .filter(item => item && typeof item === 'object')
    .map(item => ({ name: clip(item.name, 10), qty: num(item.qty, 0, 100000), unit: clip(item.unit, 4) }))
    .filter(item => item.name);

  const week = Array.isArray(raw.weekTotals)
    ? raw.weekTotals.slice(0, 7).map(v => num(v, -100000, 100000))
    : [];

  return {
    mode: pickMode(raw.mode),
    totalMinutes: num(raw.totalMinutes, -100000, 100000),
    counted: num(raw.counted, 0, 100),
    items: cleanItems,
    noted: cleanNoted,
    yesterdayMinutes: raw.yesterdayMinutes === null ? null : num(raw.yesterdayMinutes, -100000, 100000),
    delta: raw.delta === null ? null : num(raw.delta, -100000, 100000),
    weekTotals: week
  };
}

/* ---------- 提示词 ---------- */
/* 提示词与输入拼装拆到 prompt.cjs：那份文件记着为什么句子结构必须按
   这份账本实际有的数据生成，而不是在系统提示里写死四句。 */
const { SYSTEM, buildPrompt } = require('./prompt.cjs');

/* 目前只有一种解读模式。将来加「一句话记账解析」「推演结果解读」时，
   只要在这里注册一对 system + build，路由、限流、密钥、流式转发都不用改。
   客户端通过 payload.mode 选择，未注册的 mode 一律落回 ledger。 */
const MODES = {
  ledger: { system: SYSTEM, build: buildPrompt }
};

function pickMode(name) {
  return Object.prototype.hasOwnProperty.call(MODES, name) ? name : 'ledger';
}

/* ---------- 上游调用 ---------- */

async function callModel(payload, mode, onDelta) {
  const response = await fetch(chatEndpoint(AI_BASE), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + AI_KEY
    },
    body: JSON.stringify({
      model: AI_MODEL,
      stream: true,
      temperature: 0.3,
      max_tokens: 260,
      messages: [
        { role: 'system', content: mode.system },
        { role: 'user', content: mode.build(payload) }
      ]
    })
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    throw new Error('upstream_' + response.status + (detail ? ':' + detail.slice(0, 120) : ''));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const step = await reader.read();
    if (step.done) break;
    buffer += decoder.decode(step.value, { stream: true });

    let cut;
    while ((cut = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      if (!line.startsWith('data:')) continue;
      const body = line.slice(5).trim();
      if (!body || body === '[DONE]') continue;
      let chunk;
      try { chunk = JSON.parse(body); } catch (e) { continue; }
      const delta = chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
      if (delta && typeof delta.content === 'string' && delta.content) onDelta(delta.content);
    }
  }
}

/* ---------- 路由 ---------- */

function sendJson(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      parts.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleInterpret(req, res) {
  if (!AI_KEY) return sendJson(res, 503, { error: 'no_key' });

  const limited = rateLimited(clientIp(req));
  if (limited) {
    res.setHeader('Retry-After', '60');
    return sendJson(res, 429, { error: 'rate_limited_' + limited });
  }

  let payload;
  try {
    const raw = await readBody(req);
    payload = validate(JSON.parse(raw));
  } catch (error) {
    return sendJson(res, error.message === 'too_large' ? 413 : 400, { error: 'bad_request' });
  }
  if (!payload) return sendJson(res, 400, { error: 'bad_request' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  let closed = false;
  res.on('close', () => { closed = true; });

  const emit = obj => {
    if (closed) return;
    res.write('data: ' + JSON.stringify(obj) + '\n\n');
  };

  try {
    await callModel(payload, MODES[payload.mode], text => emit({ t: text }));
    emit({ done: true });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[interpret]', error.message);
    emit({ error: 'upstream_failed' });
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

/* ---------- 静态文件 ---------- */

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400);
    return res.end('Bad request');
  }

  let target = path.resolve(ROOT, '.' + pathname);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (target === ROOT || pathname === '/') target = path.join(ROOT, 'index.html');

  fs.stat(target, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }

    const type = TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream';
    const headers = {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN'
    };

    const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const useGzip = acceptsGzip && COMPRESSIBLE.test(target) && stat.size > 1024;
    if (useGzip) headers['Content-Encoding'] = 'gzip';

    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();

    const stream = fs.createReadStream(target);
    if (useGzip) stream.pipe(zlib.createGzip()).pipe(res);
    else stream.pipe(res);
    stream.on('error', () => res.destroy());
  });
}

const server = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0];

  if (pathname === '/api/interpret') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'method_not_allowed' });
    }
    return handleInterpret(req, res);
  }

  if (pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, ai: AI_KEY ? 'on' : 'off', model: AI_KEY ? AI_MODEL : null });
  }

  serveStatic(req, res);
});

server.on('error', error => {
  console.error(error.message);
  process.exitCode = 1;
});

server.listen(PORT, BIND, () => {
  console.log('BodyLens serving ' + ROOT);
  console.log('listening on http://' + BIND + ':' + PORT);
  console.log('AI: ' + (AI_KEY ? AI_MODEL + ' via ' + AI_BASE : 'off (返回 503，前端自动用本地解读)'));
});
