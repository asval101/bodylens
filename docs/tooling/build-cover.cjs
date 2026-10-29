#!/usr/bin/env node
/**
 * 生成报名表单用的封面图。
 *
 *   node docs/tooling/build-cover.cjs
 *
 * 输出 docs/assets/封面-16x9.png（1920×1080）与 封面-1x1.png（1200×1200）。
 * 版式在两个 html 里，改文案改那里。截图素材取自 docs/evidence/screenshots/，
 * 所以要先跑过 shot-evidence.cjs（或确认那些图还在）。
 *
 * 唯一外部依赖是浏览器：用本机 Edge 的无头模式，不需要 npm 装 puppeteer。
 * 换机器时用 EDGE_PATH 指一下就行。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = __dirname;
const ROOT = path.resolve(DIR, '..', '..');
const OUT = path.join(ROOT, 'docs', 'assets');

const CANDIDATES = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'google-chrome',
  'chromium',
].filter(Boolean);

const edge = CANDIDATES.find(p => {
  if (/[\\/]/.test(p)) return fs.existsSync(p);
  const r = spawnSync(p, ['--version'], { encoding: 'utf8' });
  return r.status === 0;
});

if (!edge) {
  console.error('没找到浏览器。用 EDGE_PATH=/path/to/msedge 指定一个。');
  process.exit(1);
}

const SHOT = path.join(ROOT, 'docs', 'evidence', 'screenshots', '2026-10-28-02-today-recorded.png');
if (!fs.existsSync(SHOT)) {
  console.error(`缺少截图素材：${SHOT}\n先跑 node docs/tooling/shot-evidence.cjs（没有服务就任何一张都拍不出来）`);
  process.exit(1);
}

const JOBS = [
  { html: 'cover-16x9.html', png: '封面-16x9.png', w: 1920, h: 1080 },
  { html: 'cover-1x1.html', png: '封面-1x1.png', w: 1200, h: 1200 },
];

fs.mkdirSync(OUT, { recursive: true });

for (const job of JOBS) {
  const src = path.join(DIR, 'cover', job.html);
  const dst = path.join(OUT, job.png);
  if (!fs.existsSync(src)) {
    console.error(`缺少版式：${src}`);
    process.exit(1);
  }
  const r = spawnSync(edge, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=' + job.w + ',' + job.h,
    '--screenshot=' + dst,
    '--virtual-time-budget=3000',
    'file:///' + src.replace(/\\/g, '/'),
  ], { encoding: 'utf8' });

  if (!fs.existsSync(dst)) {
    console.error(`生成失败：${job.png}\n${(r.stderr || '').slice(-400)}`);
    process.exit(1);
  }
  const kb = (fs.statSync(dst).size / 1024).toFixed(0);
  console.log(`${job.png.padEnd(18)} ${job.w}×${job.h}  ${kb}KB`);
}

console.log('\n注意：--window-size 给的是外框，加了 --hide-scrollbars 之后视口才等于这个数。');
console.log('如果输出尺寸不对，先看这一条，别去改版式。');
