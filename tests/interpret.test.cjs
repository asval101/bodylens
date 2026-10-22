const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const W = require('../data/weights.js');
const L = require('../ledger.js');

/* interpret.js 是给浏览器用的 IIFE，这里用 vm 造一个最小的 window 沙箱来加载它。
   不为了「可测试」去改它的模块形式，保持浏览器端零构建。 */
const sandbox = { window: { BodyLensWeights: W, BodyLensLedger: L } };
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'interpret.js'), 'utf8'),
  sandbox,
  { filename: 'interpret.js' }
);
const I = sandbox.window.BodyLensInterpret;

const at = (n) => new Date('2026-10-20T' + String(n).padStart(2, '0') + ':00:00Z');

function day(entries, key) {
  const s = L.summarize(entries, key);
  const prev = L.summarize(entries, L.shiftDay(key, -1));
  return { s, cmp: L.compare(s, prev), week: L.dailyTotals(entries, key, 7) };
}

/* ---------- 空账本 ---------- */

test('没有记录时给出可执行的下一步，而不是空白', () => {
  const r = day([], '2026-10-20');
  const out = I.local(r.s, r.cmp);
  assert.match(out.headline, /还没有记录/);
  assert.match(out.detail, /记下一笔/);
  assert.strictEqual(out.stance, 'idle');
  assert.strictEqual(out.source, 'local');
});

/* ---------- 只有方向、没有数字 ---------- */

test('只有不可折算条目时不编数字', () => {
  const entries = [L.makeEntry('sugar', 1, '2026-10-20', at(23))];
  const r = day(entries, '2026-10-20');
  const out = I.local(r.s, r.cmp);
  assert.match(out.headline, /不折算成分钟/);
  assert.match(out.detail, /含糖饮料/);
  assert.doesNotMatch(out.detail, /\d+\s*分钟/);
});

/* ---------- 单项归因 ---------- */

test('单一来源时说明占比与数量', () => {
  const entries = [L.makeEntry('smoke', 5, '2026-10-20', at(9))];
  const r = day(entries, '2026-10-20');
  const out = I.local(r.s, r.cmp);
  assert.strictEqual(out.headline, '今天被拿走 1 小时 40 分。');
  assert.match(out.detail, /大半来自香烟/);
  assert.match(out.detail, /5 支/);
  assert.strictEqual(out.stance, 'steady');
});

test('只有收益时措辞改为往回拿', () => {
  /* 目前权重表里还没有「有分钟数的收益项」，所以收益分支用构造的 summary 验证，
     等将来某条收益项拿到可靠口径，这段措辞就自动生效。 */
  const s = {
    totalMinutes: 40,
    counted: 1,
    byItem: [{ itemId: 'walk', name: '快走', unit: '分钟', qty: 30, minutes: 40 }],
    noted: []
  };
  const out = I.local(s, L.compare(s, null));
  assert.match(out.headline, /往回拿了/);
  assert.match(out.detail, /其中大部分是/);
});

test('多项分散时不给虚假的单一归因', () => {
  const entries = [
    L.makeEntry('smoke', 2, '2026-10-20', at(9)),
    L.makeEntry('sit', 2, '2026-10-20', at(14))
  ];
  const r = day(entries, '2026-10-20');
  const out = I.local(r.s, r.cmp);
  assert.ok(out.detail.length > 0);
  assert.doesNotMatch(out.detail, /大半来自/);
});

/* ---------- 昨日对比 ---------- */

test('对比昨天变多与变少的措辞不同', () => {
  const more = day([
    L.makeEntry('smoke', 2, '2026-10-19', at(9)),
    L.makeEntry('smoke', 6, '2026-10-20', at(9))
  ], '2026-10-20');
  assert.match(I.local(more.s, more.cmp).detail, /比昨天多了/);

  const less = day([
    L.makeEntry('smoke', 8, '2026-10-19', at(9)),
    L.makeEntry('smoke', 2, '2026-10-20', at(9))
  ], '2026-10-20');
  assert.match(I.local(less.s, less.cmp).detail, /比昨天少了/);
});

/* ---------- 额度与区间必须被解释，不能被隐去 ---------- */

test('酒精在周额度内时，说明为什么不扣分钟', () => {
  const entries = [L.makeEntry('alcohol', 5, '2026-10-20', at(21))];
  const r = day(entries, '2026-10-20');
  const out = I.local(r.s, r.cmp);
  assert.strictEqual(r.s.totalMinutes, 0);
  assert.match(out.headline, /额度以内/);
  assert.match(out.detail, /剂量条件/);
  assert.doesNotMatch(out.headline, /被拿走 0/);
});

test('有区间的条目必须标注只能当量级看', () => {
  const entries = [L.makeEntry('sit', 2, '2026-10-20', at(14))];
  const r = day(entries, '2026-10-20');
  const out = I.local(r.s, r.cmp);
  assert.match(out.detail, /区间太宽/);
});

/* ---------- 建议与描述分开 ---------- */

test('建议单独成段，不混进描述里', () => {
  const entries = [L.makeEntry('smoke', 5, '2026-10-20', at(9))];
  const r = day(entries, '2026-10-20');
  const out = I.local(r.s, r.cmp);
  assert.ok(out.hint.length > 0, '应有建议');
  assert.match(out.hint, /今天少一支/);
  assert.ok(out.detail.indexOf(out.hint) === -1, '描述里不应重复建议');
});

test('没有可用建议时返回空串，而不是占位文字', () => {
  const empty = { totalMinutes: 0, counted: 0, byItem: [], noted: [] };
  const out = I.local(empty, L.compare(empty, null));
  assert.strictEqual(out.hint, '');
});

/* ---------- 交给服务端的载荷 ---------- */

test('载荷只含白名单字段，不夹带任何自由文本', () => {
  const entries = [
    L.makeEntry('smoke', 3, '2026-10-20', at(9)),
    L.makeEntry('sugar', 1, '2026-10-20', at(23))
  ];
  const r = day(entries, '2026-10-20');
  const p = I.payload(r.s, r.cmp, r.week);
  assert.strictEqual(p.mode, 'ledger');
  assert.strictEqual(typeof p.totalMinutes, 'number');
  assert.strictEqual(p.items[0].name, '香烟');
  assert.strictEqual(p.items[0].direction, 'A');
  assert.strictEqual(p.noted[0].name, '含糖饮料');
  assert.strictEqual(p.weekTotals.length, 7);
  const json = JSON.stringify(p);
  assert.doesNotMatch(json, /prompt|instruction|忽略/);
});

test('载荷里的分钟数与账本一致，不另算一套', () => {
  const entries = [L.makeEntry('smoke', 4, '2026-10-20', at(9))];
  const r = day(entries, '2026-10-20');
  const p = I.payload(r.s, r.cmp, r.week);
  assert.strictEqual(p.totalMinutes, r.s.totalMinutes);
  assert.strictEqual(p.items[0].minutes, Math.round(r.s.byItem[0].minutes));
});

/* ---------- 措辞红线 ---------- */

test('本地文案不含诊断、就医、寿命预测类表述', () => {
  const cases = [
    [L.makeEntry('smoke', 10, '2026-10-20', at(9))],
    [L.makeEntry('alcohol', 20, '2026-10-20', at(21))],
    [L.makeEntry('shortSleep', 2, '2026-10-20', at(23))],
    []
  ];
  const banned = /诊断|患病|就医|去医院|能活|寿命|预后|风险为/;
  for (const entries of cases) {
    const r = day(entries, '2026-10-20');
    const out = I.local(r.s, r.cmp);
    assert.doesNotMatch(out.headline + out.detail, banned);
  }
});
