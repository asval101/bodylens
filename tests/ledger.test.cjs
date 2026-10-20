const test = require('node:test');
const assert = require('node:assert');
const W = require('../data/weights.js');
const L = require('../ledger.js');

test('权重表自身校验通过：来源齐全、等级不越级', () => {
  assert.deepStrictEqual(W.validate(), []);
});

test('每条有数字的条目都登记了来源', () => {
  for (const id of W.order) {
    const item = W.get(id);
    assert.ok(W.sources[item.source], id + ' 的来源缺失');
  }
});

test('数值等级不得高于方向等级', () => {
  for (const id of W.order) {
    const item = W.get(id);
    assert.ok(W.rank[item.value] <= W.rank[item.direction], id + ' 数值等级高于方向等级');
  }
});

test('有出处的行为能算出分钟，无口径的返回 null 而不是 0', () => {
  assert.strictEqual(W.minutesFor('smoke', 1), -20);
  assert.strictEqual(W.minutesFor('smoke', 10), -200);
  assert.strictEqual(W.minutesFor('alcohol', 3), null);
  assert.strictEqual(W.minutesFor('shortSleep', 2), null);
});

test('缺失或非法数量不产生数字', () => {
  assert.strictEqual(W.minutesFor('smoke', 0), null);
  assert.strictEqual(W.minutesFor('smoke', -1), null);
  assert.strictEqual(W.minutesFor('nonexistent', 1), null);
});

test('记录不冗余存储分钟，改权重后自动同步', () => {
  const e = L.makeEntry('smoke', 2, '2026-10-20', new Date('2026-10-20T09:00:00Z'));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(e, 'minutes'), false);
});

test('汇总把有数字与只有方向的分开统计', () => {
  const entries = [
    L.makeEntry('smoke', 3, '2026-10-20', new Date('2026-10-20T09:00:00Z')),
    L.makeEntry('alcohol', 2, '2026-10-20', new Date('2026-10-20T22:00:00Z'))
  ];
  const s = L.summarize(entries, '2026-10-20');
  assert.strictEqual(s.totalMinutes, -60);
  assert.strictEqual(s.counted, 1);
  assert.strictEqual(s.noted.length, 1);
  assert.strictEqual(s.noted[0].itemId, 'alcohol');
  assert.strictEqual(s.byItem.length, 1);
  assert.strictEqual(s.byItem[0].qty, 3);
});

test('同一行为多次录入会合并成一行', () => {
  const entries = [
    L.makeEntry('smoke', 2, '2026-10-20', new Date('2026-10-20T09:00:00Z')),
    L.makeEntry('smoke', 3, '2026-10-20', new Date('2026-10-20T18:00:00Z'))
  ];
  const s = L.summarize(entries, '2026-10-20');
  assert.strictEqual(s.byItem.length, 1);
  assert.strictEqual(s.byItem[0].qty, 5);
  assert.strictEqual(s.byItem[0].minutes, -100);
  assert.strictEqual(s.totalMinutes, -100);
});

test('与昨日对比：负得少即为好转', () => {
  const cur = { totalMinutes: -40, counted: 1, noted: [] };
  const prev = { totalMinutes: -100, counted: 1, noted: [] };
  const c = L.compare(cur, prev);
  assert.strictEqual(c.hasPrev, true);
  assert.strictEqual(c.delta, 60);
  assert.ok(c.delta > 0);
});

test('昨天没有任何记录时不算对比', () => {
  const c = L.compare({ totalMinutes: -40, counted: 1, noted: [] }, { totalMinutes: 0, counted: 0, noted: [] });
  assert.strictEqual(c.hasPrev, false);
});

test('分钟格式化覆盖分钟、小时、天三档', () => {
  assert.strictEqual(L.formatMinutes(20), '20 分钟');
  assert.strictEqual(L.formatMinutes(60), '1 小时');
  assert.strictEqual(L.formatMinutes(200), '3 小时 20 分');
  assert.strictEqual(L.formatMinutes(1500), '1 天 1 小时');
});

test('类比只在 0.5–2 倍区间内使用', () => {
  assert.strictEqual(L.anchorText(90), '大约一部电影');
  assert.strictEqual(L.anchorText(45), '大约一集电视剧');
  assert.strictEqual(L.anchorText(0), '');
  assert.strictEqual(L.anchorText(30000), '');
});

test('类比总是选比值最接近 1 的那一档', () => {
  // 160 分钟同时落在「两部电影」和「一个下午」附近，取更贴近的一档
  assert.strictEqual(L.anchorText(160), '大约一个下午');
  // 250 分钟只有「下午」档落在区间内，此时才用「将近两个」
  assert.strictEqual(L.anchorText(250), '将近两个下午');
});

test('类比超出区间时换档而不是硬用', () => {
  const text = L.anchorText(430);
  assert.ok(text.includes('晚上') || text.includes('下午'), '应切换到更大量级，实际：' + text);
});

test('跨月日期推移正确', () => {
  assert.strictEqual(L.shiftDay('2026-10-01', -1), '2026-09-30');
  assert.strictEqual(L.shiftDay('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(L.shiftDay('2026-03-01', -1), '2026-02-28');
});

test('非法记录在读取时被丢弃而不是让页面崩溃', () => {
  const raw = [
    null,
    { id: 'a', date: '2026-10-20', itemId: 'nonexistent', qty: 1, at: '2026-10-20T09:00:00Z' },
    { id: 'b', date: '2026-13-40', itemId: 'smoke', qty: 1, at: '2026-10-20T09:00:00Z' },
    { id: 'c', date: '2026-10-20', itemId: 'smoke', qty: 0, at: '2026-10-20T09:00:00Z' },
    { id: 'd', date: '2026-10-20', itemId: 'smoke', qty: 2, at: '2026-10-20T09:00:00Z' }
  ];
  const cleaned = L.cleanEntries(raw);
  assert.strictEqual(cleaned.length, 1);
  assert.strictEqual(cleaned[0].id, 'd');
});

test('重复 id 只保留第一条', () => {
  const raw = [
    { id: 'x', date: '2026-10-20', itemId: 'smoke', qty: 1, at: '2026-10-20T09:00:00Z' },
    { id: 'x', date: '2026-10-20', itemId: 'smoke', qty: 9, at: '2026-10-20T10:00:00Z' }
  ];
  assert.strictEqual(L.cleanEntries(raw).length, 1);
});

test('逐日合计按从旧到新排列且长度正确', () => {
  const entries = [L.makeEntry('smoke', 1, '2026-10-20', new Date('2026-10-20T09:00:00Z'))];
  const rows = L.dailyTotals(entries, '2026-10-20', 7);
  assert.strictEqual(rows.length, 7);
  assert.strictEqual(rows[6].date, '2026-10-20');
  assert.strictEqual(rows[6].totalMinutes, -20);
  assert.strictEqual(rows[0].date, '2026-10-14');
});
