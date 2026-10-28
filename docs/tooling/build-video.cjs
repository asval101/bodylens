/* 把 screencast 抓到的帧序列合成 1920×1080 30fps 视频
 *
 * 帧是可变间隔（页面动得勤就密、静止就疏），所以用 concat demuxer 的 duration
 * 表达「这一帧停多久」，再用 fps 滤镜转成恒定 30fps。
 *
 * 第三个参数可以换一份时间轴：剪辑节奏（比如把开头的静止段压短）只改那份 json，
 * 不动帧、不重录。生成方式见 `.tmpdoc/warp.cjs`。
 *
 * 用法：node .tmpdoc/build-video.cjs [帧目录] [输出文件] [时间轴文件名]
 */
const { execFileSync } = require('child_process');
const fs = require('fs'); const path = require('path');

const DIR = process.argv[2] || '.tmpdoc/rec2';
const OUT = process.argv[3] || 'video/产品演示段-无声.mp4';
const TIMES = process.argv[4] || 'times.json';
const FF = 'C:/Users/1/.workbuddy/binaries/node/workspace/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe';

const times = JSON.parse(fs.readFileSync(path.join(DIR, TIMES), 'utf8'));
const files = fs.readdirSync(DIR).filter(f => /^f\d+\.jpg$/.test(f)).sort();
if (files.length !== times.length) console.log('注意：帧数组长度不一致', files.length, times.length);

const abs = path.resolve(DIR).replace(/\\/g, '/');
const lines = [];
const n = Math.min(files.length, times.length);
for (let i = 0; i < n; i++) {
  const d = i < n - 1 ? (times[i + 1] - times[i]) / 1000 : 0.6;
  lines.push(`file '${abs}/${files[i]}'`);
  lines.push(`duration ${Math.max(0.004, d).toFixed(4)}`);
}
// concat 要求最后一行 file 再出现一次，否则最后一帧的 duration 被忽略
lines.push(`file '${abs}/${files[n - 1]}'`);

const listFile = path.join(DIR, 'frames.txt');
fs.writeFileSync(listFile, lines.join('\n'), 'utf8');

console.log('帧数', n, '时长', (times[n - 1] / 1000).toFixed(1) + 's →', OUT);

execFileSync(FF, [
  '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
  '-vf', 'fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf7f6f2',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
  '-pix_fmt', 'yuv420p', '-r', '30',
  '-movflags', '+faststart',
  OUT
], { stdio: 'inherit' });

const kb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
console.log('完成', OUT, kb + ' MB');
