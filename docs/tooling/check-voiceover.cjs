/* 配音自检：每条字幕窗口里有没有声音、实际说了多久、语速多少
 *
 * 用途：拿剪映（或别处）配好音的成片，回头核对「字幕和配音对不对得上」。
 * 只看两点——窗口内有没有声音、语速是不是齐的。音色好不好听它判断不了。
 *
 * 用法：
 *   node docs/tooling/check-voiceover.cjs "<成片.mp4>" [srt]
 */
const { spawnSync } = require('child_process');
const fs = require('fs');

const FF = 'C:/Users/1/.workbuddy/binaries/node/workspace/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe';
const SRC = process.argv[2];
const SRT = process.argv[3] || 'video/产品演示段-修订字幕-v5.srt';
if (!SRC) { console.log('用法：node check-voiceover.cjs <成片.mp4> [srt]'); process.exit(1); }

const toSec = s => {
  const [h, m, r] = s.trim().split(':');
  const [sec, ms] = r.split(',');
  return (+h) * 3600 + (+m) * 60 + (+sec) + (+ms) / 1000;
};

/* 1. 静音区间（-35dB 以下超过 0.3 秒算静音） */
const sr = spawnSync(FF, ['-hide_banner', '-i', SRC, '-t', '600', '-af',
  'silencedetect=noise=-35dB:d=0.30', '-f', 'null', '-'], { encoding: 'utf8' });
const sil = [];
let cur = null;
for (const line of (sr.stderr || '').split('\n')) {
  const a = line.match(/silence_start:\s*(-?[\d.]+)/);
  const b = line.match(/silence_end:\s*(-?[\d.]+)/);
  if (a) cur = +a[1];
  if (b && cur !== null) { sil.push([cur, +b[1]]); cur = null; }
}
if (cur !== null) sil.push([cur, 9999]);
const overlap = (a, b) => sil.reduce((acc, [x, y]) => acc + Math.max(0, Math.min(b, y) - Math.max(a, x)), 0);

/* 2. 逐条字幕 */
const blocks = fs.readFileSync(SRT, 'utf8').replace(/\r/g, '').split(/\n\s*\n/);
const rows = [];
for (const blk of blocks) {
  const L = blk.split('\n').filter(x => x.trim());
  if (L.length < 2) continue;
  const m = L[1].match(/^(\d+:\d+:\d+,\d+)\s*-->\s*(\d+:\d+:\d+,\d+)$/);
  if (!m) continue;
  const a = toSec(m[1]), b = toSec(m[2]);
  const text = L.slice(2).join('');
  const chars = text.replace(/[\s，。、“”：；？！—…·「」()（）]/g, '').length;

  const r = spawnSync(FF, ['-hide_banner', '-ss', a.toFixed(3), '-t', Math.max(0.2, b - a).toFixed(3),
    '-i', SRC, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const s = r.stderr || '';
  const mean = +((s.match(/mean_volume:\s*(-?[\d.]+)/) || [])[1]);
  const max = +((s.match(/max_volume:\s*(-?[\d.]+)/) || [])[1]);

  const spoken = Math.max(0.2, (b - a) - overlap(a, b));
  rows.push({ i: +L[0], a, b, chars, mean, max, spoken, rate: chars / spoken });
}

let empty = 0;
for (const x of rows) {
  const tag = x.mean > -36 ? '' : (x.max > -28 ? '弱' : '空');
  if (tag === '空') empty++;
  const fast = x.rate > 7 ? ' 偏快' : (x.rate < 2.5 ? ' 偏慢' : '');
  console.log(String(x.i).padStart(2) + '  ' + x.a.toFixed(1) + '–' + x.b.toFixed(1) +
    '  ' + x.chars + '字 说' + x.spoken.toFixed(1) + 's  ' + x.rate.toFixed(1) + '字/秒' +
    '  mean ' + x.mean.toFixed(1) + '  ' + (tag || '有') + fast);
}

const gaps = sil.filter(([a, b]) => b - a > 3 && a < rows[rows.length - 1].b);
console.log('\n共 ' + rows.length + ' 条，没声音 ' + empty + ' 条');
console.log('超过 3 秒的静音 ' + gaps.length + ' 处：' + gaps.map(([a, b]) => a.toFixed(1) + '–' + b.toFixed(1)).join('，'));
