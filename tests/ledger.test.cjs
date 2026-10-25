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
  assert.strictEqual(W.minutesFor('alcohol', 3), -45);
  assert.strictEqual(W.minutesFor('shortSleep', 2), -22);
  assert.strictEqual(W.minutesFor('sugar', 2), null);
  assert.strictEqual(W.minutesFor('sleep', 1), null);
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
    L.makeEntry('sugar', 2, '2026-10-20', new Date('2026-10-20T22:00:00Z'))
  ];
  const s = L.summarize(entries, '2026-10-20');
  assert.strictEqual(s.totalMinutes, -60);
  assert.strictEqual(s.counted, 1);
  assert.strictEqual(s.noted.length, 1);
  assert.strictEqual(s.noted[0].itemId, 'sugar');
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

/* 只有记录、没有折算口径的行为，也要合并。
 * 同一天记两笔快走，原来账本上会出现两行「快走 15 分钟」，
 * 首页还会说「已记下 2 项、快走 15 分钟、快走 15 分钟」—— 像记重了。 */
test('没有折算口径的行为多次录入也合并成一行', () => {
  const entries = [
    L.makeEntry('walk', 15, '2026-10-20', new Date('2026-10-20T08:00:00Z')),
    L.makeEntry('walk', 30, '2026-10-20', new Date('2026-10-20T18:00:00Z'))
  ];
  const s = L.summarize(entries, '2026-10-20');
  assert.strictEqual(s.counted, 0);
  assert.strictEqual(s.noted.length, 1);
  assert.strictEqual(s.noted[0].qty, 45);
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

/* ---------- 周额度行为（酒精）的边际计算 ---------- */

test('额度内饮酒不计入损耗', () => {
  const e = [L.makeEntry('alcohol', 5, '2026-10-20', new Date('2026-10-20T21:00:00Z'))];
  const s = L.summarize(e, '2026-10-20');
  assert.strictEqual(s.totalMinutes, 0);
  assert.strictEqual(s.byItem[0].withinCap, true);
});

test('超出额度的部分才按 −15 分钟计', () => {
  // 2026-10-20 是周二，周一已喝 10 杯，今天再喝 5 杯 → 本周累计 15，超出 12.5 的 2.5 杯
  const e = [
    L.makeEntry('alcohol', 10, '2026-10-19', new Date('2026-10-19T21:00:00Z')),
    L.makeEntry('alcohol', 5, '2026-10-20', new Date('2026-10-20T21:00:00Z'))
  ];
  const s = L.summarize(e, '2026-10-20');
  assert.strictEqual(s.totalMinutes, -37.5);
});

test('周一已严重超标时，今天全部计入', () => {
  const e = [
    L.makeEntry('alcohol', 20, '2026-10-19', new Date('2026-10-19T21:00:00Z')),
    L.makeEntry('alcohol', 2, '2026-10-20', new Date('2026-10-20T21:00:00Z'))
  ];
  assert.strictEqual(L.summarize(e, '2026-10-20').totalMinutes, -30);
});

test('额度按自然周重置，跨周不累加', () => {
  // 10-18 是上周日，10-19 是本周一
  const e = [
    L.makeEntry('alcohol', 20, '2026-10-18', new Date('2026-10-18T21:00:00Z')),
    L.makeEntry('alcohol', 2, '2026-10-19', new Date('2026-10-19T21:00:00Z'))
  ];
  assert.strictEqual(L.summarize(e, '2026-10-19').totalMinutes, 0);
});

test('周起始固定为周一', () => {
  assert.strictEqual(L.weekStart('2026-10-20'), '2026-10-19');
  assert.strictEqual(L.weekStart('2026-10-19'), '2026-10-19');
  assert.strictEqual(L.weekStart('2026-10-25'), '2026-10-19');
});

test('屏幕时间带不确定区间，仍给出单一估算值', () => {
  const item = W.get('sit');
  assert.strictEqual(item.minutes, -21.8);
  assert.deepStrictEqual(item.range, [-0.3, -44.7]);
  const e = [L.makeEntry('sit', 2, '2026-10-20', new Date('2026-10-20T22:00:00Z'))];
  assert.strictEqual(L.summarize(e, '2026-10-20').totalMinutes, -43.6);
});

test('minutesFor 是原始乘算，不含周额度；周额度只由 summarize 实施', () => {
  // 防止将来有人在界面层直接调 minutesFor 算酒精，绕过阈值
  assert.strictEqual(W.minutesFor('alcohol', 1), -15);
  const e = [L.makeEntry('alcohol', 1, '2026-10-20', new Date('2026-10-20T21:00:00Z'))];
  assert.strictEqual(L.summarize(e, '2026-10-20').totalMinutes, 0);
});

/* ---------- 器官落点 ---------- */

/* 造一个「某天几点」的时间戳。器官落点只看 date 字段，时刻不影响结果，
   但 makeEntry 需要它来写记录时间，所以还是给一个合法值。 */
function at(hour) {
  return new Date('2026-10-20T' + String(hour).padStart(2, '0') + ':00:00Z');
}

test('器官落点包含「仅记录」的行为', () => {
  // 睡眠不足没有分钟数，但它是记录过的行为，仍然落到大脑
  const e = [L.makeEntry('shortSleep', 2, '2026-10-20', at(23))];
  const org = L.organsFor(e, '2026-10-20');
  assert.deepStrictEqual(org.harm, ['brain']);
  assert.deepStrictEqual(org.gain, []);
});

test('损耗与收益不互相抵消，同一器官只算损耗', () => {
  // 抽烟伤肺也伤心，快走在收益侧。心脏不能因为快走就从损耗里消失——
  // 那等于在界面上暗示「走两步就把烟抽回来了」。
  const e = [
    L.makeEntry('smoke', 5, '2026-10-20', at(9)),
    L.makeEntry('walk', 30, '2026-10-20', at(18))
  ];
  const org = L.organsFor(e, '2026-10-20');
  assert.deepStrictEqual(org.harm, ['lungs', 'heart', 'brain', 'mouth']);
  assert.strictEqual(org.gain.indexOf('heart'), -1, '同一器官不能同时出现在两边');
  assert.strictEqual(org.gain.length, 0, '烟与快走影响的器官完全重叠，收益侧应为空');
});

test('收益侧独立存在时不被吞掉', () => {
  // 屏幕时间影响心与眼，快走影响心与脑。只有心脏重叠，大脑应留在收益侧。
  const e = [
    L.makeEntry('sit', 2, '2026-10-20', at(10)),
    L.makeEntry('walk', 30, '2026-10-20', at(18))
  ];
  const org = L.organsFor(e, '2026-10-20');
  assert.deepStrictEqual(org.harm, ['heart', 'eyes']);
  assert.deepStrictEqual(org.gain, ['brain']);
});

test('器官去重，不按记录条数重复', () => {
  const e = [
    L.makeEntry('smoke', 1, '2026-10-20', at(9)),
    L.makeEntry('smoke', 3, '2026-10-20', at(15)),
    L.makeEntry('smoke', 5, '2026-10-20', at(21))
  ];
  assert.deepStrictEqual(L.organsFor(e, '2026-10-20').harm, ['lungs', 'heart', 'brain', 'mouth']);
});

test('器官落点只看当天', () => {
  const e = [
    L.makeEntry('smoke', 5, '2026-10-19', at(9)),
    L.makeEntry('alcohol', 2, '2026-10-20', at(21))
  ];
  const org = L.organsFor(e, '2026-10-20');
  assert.strictEqual(org.harm.indexOf('lungs'), -1, '昨天的烟不该算在今天的人体上');
  assert.ok(org.harm.indexOf('liver') !== -1);
});

test('没有记录时不返回器官', () => {
  assert.deepStrictEqual(L.organsFor([], '2026-10-20'), { harm: [], gain: [] });
  assert.deepStrictEqual(L.organsFor(null, '2026-10-20'), { harm: [], gain: [] });
});

test('权重表里每个器官 id 都能在 catalog 中找到', () => {
  const D = require('../data/catalog.js');
  for (const id of W.order) {
    for (const organ of W.get(id).organs) {
      assert.ok(D.organs[organ], id + ' 引用了不存在的器官：' + organ);
    }
  }
});

test('权重表的自检没有发现问题', () => {
  assert.deepStrictEqual(W.validate(), []);
});
