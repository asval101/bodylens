/* 把帧时间轴做一次「分段压缩」：静止段压快，动作段保持原速。
 *
 * 为什么不是整段倍速：产品段开头 26 秒里真正在动的只有 4.8 秒（光标移动 + 两次滚动），
 * 其余全是停着不动的空态。整段 1.5 倍会把滚动也拉快，看起来像快进；
 * 分段之后滚动还是原来的手感，只是「停住回味」的那几段变短。
 *
 * 帧一张不动，只改 build-video.cjs 用的时间轴 json。
 *
 * 用法：
 *   node docs/tooling/warp-timeline.cjs [帧目录]
 * 产出：
 *   <帧目录>/times-warped.json
 *   node docs/tooling/build-video.cjs <帧目录> out.mp4 times-warped.json
 *
 * 改完记得把后面每条字幕的时间码统一减掉「省下的秒数」（脚本最后一行会打印）。
 */
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2] || '.tmpdoc/rec4';
const SRC = path.join(DIR, 'times.json');
const DST = path.join(DIR, 'times-warped.json');

// 旧时间轴的分段：[起点, 终点, 倍率]。动作段 1.00，静止段按比例压。
// 这张表是照着 rec-product.cjs 里 A 段（首屏空态）的 sleep 排的，换录制脚本要重排。
const SEGS = [
  [0, 9.2, 0.50],    // 空态静止
  [9.2, 9.8, 1.00],  // 光标移到「抽烟」
  [9.8, 12.2, 0.50], // 停住
  [12.2, 14.2, 1.00],// 往下滚，露出「这张卡还没有数字」
  [14.2, 19.4, 0.55],// 停住
  [19.4, 21.6, 1.00],// 滚回顶部
  [21.6, 26.31, 0.85]// 最后停住，留够「首页显示还没开始」这句
];

const A_END = SEGS[SEGS.length - 1][1];

let acc = 0;
for (const [a, b, k] of SEGS) acc += (b - a) * k;
const NEW_A_END = acc;
const DELTA = A_END - NEW_A_END;

const map = t => {
  if (t >= A_END) return t - DELTA;
  let out = 0;
  for (const [a, b, k] of SEGS) {
    if (t <= b) return out + (t - a) * k;
    out += (b - a) * k;
  }
  return out;
};

const times = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const warped = times.map(t => Math.round(map(t / 1000) * 1000));

// 保证严格递增：压完之后间隔可能变成 0，concat 的 duration 最小 4ms
for (let i = 1; i < warped.length; i++) {
  if (warped[i] <= warped[i - 1]) warped[i] = warped[i - 1] + 4;
}

fs.writeFileSync(DST, JSON.stringify(warped));

console.log('开头', A_END.toFixed(2) + 's →', NEW_A_END.toFixed(2) + 's（省 ' + DELTA.toFixed(2) + 's）');
console.log('全片', (times[times.length - 1] / 1000).toFixed(2) + 's →',
  (warped[warped.length - 1] / 1000).toFixed(2) + 's');
console.log('后面所有字幕时间码统一减', DELTA.toFixed(2) + 's');
