/* 跨层一致性：数据层说的器官，人体图上必须真的存在。
 *
 * 这组用例的由来（2026-10-24）：
 * 10-21 为了让人脸干净，把眼睛从 anatomy.js 删掉了，但 catalog 里 5 条用眼行为
 * 和 weights 里「屏幕时间」的 organs 还挂着 eyes。结果是：记一条屏幕时间，
 * 文字写「涉及 心脏 · 眼睛」，人体上只有心脏亮 —— 文字承诺两处，画面只兑现一处。
 * 全程不报错，因为 app.js 有一道防御把画不出来的器官从列表里滤掉了，
 * 但它只滤了「可点列表」，没滤文字。
 *
 * 所以这里守两条不变量：
 *   1. 任何被数据层引用到的器官，人体 SVG 里必须有对应节点
 *   2. weights 某条行为的器官落点，必须是它对应的资料库行为里真实存在的
 *      —— 否则文字（读 weights）和画面（读 catalog）就会各说一套
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const D = require('../data/catalog.js');
const W = require('../data/weights.js');

const ROOT = path.join(__dirname, '..');
const anatomySrc = fs.readFileSync(path.join(ROOT, 'anatomy.js'), 'utf8');

/* 资料库的 behaviors 是数组，按 id 建索引 */
const BEH = new Map(D.behaviors.map(b => [b.id, b]));

/* 人体 SVG 上真正画出来的器官（data-organ 属性） */
const DRAWN = new Set(
  [...anatomySrc.matchAll(/data-organ="([a-zA-Z]+)"/g)].map(m => m[1])
);

/* today.js 里那张「权重项 → 资料库行为」的表，从源码里读，避免两处各写一份 */
function catalogOf() {
  const m = todaySrc().match(/const CATALOG_OF = \{([\s\S]*?)\};/);
  assert.ok(m, '没能在 today.js 里找到 CATALOG_OF');
  const map = {};
  for (const r of m[1].matchAll(/(\w+)\s*:\s*'([\w-]+)'/g)) map[r[1]] = r[2];
  return map;
}
let _today = null;
function todaySrc() {
  if (_today === null) _today = fs.readFileSync(path.join(ROOT, 'today.js'), 'utf8');
  return _today;
}

/* 数据层引用到的全部器官：资料库影响条目 + 权重表落点 */
function linkedOrgans() {
  const linked = new Set();
  for (const b of Object.values(D.behaviors)) for (const e of b.effects) linked.add(e.organ);
  for (const id of W.order) for (const o of (W.get(id).organs || [])) linked.add(o);
  return linked;
}

test('数据层引用到的每个器官，人体图上都画得出来', () => {
  const missing = [...linkedOrgans()].filter(id => !DRAWN.has(id)).sort();
  assert.deepEqual(
    missing, [],
    '这些器官被数据层引用，但 anatomy.js 里没有 data-organ 节点：' + missing.join('、') +
    '。要么补画，要么把数据层对它的引用一起处理掉 —— 只做一边会让文字和画面各说一套。'
  );
});

test('人体上的每个器官 id 都在资料库器官表里', () => {
  const unknown = [...DRAWN].filter(id => !D.organs[id]).sort();
  assert.deepEqual(unknown, [], 'anatomy.js 里有拼错或未登记的器官 id：' + unknown.join('、'));
});

test('权重表的器官落点，必须存在于对应资料库行为的影响条目里', () => {
  const map = catalogOf();
  /* 原来这里写死 >= 8，只是防止「解析失效」的粗检查，账本一改数就得跟着改，
     而且真的少掉一项链本项时它反而不会报警。改成跟账本项数精确对齐。 */
  assert.strictEqual(
    Object.keys(map).length, W.order.length,
    'CATALOG_OF 应覆盖全部 ' + W.order.length + ' 项链本项，实际解析出 ' + Object.keys(map).length + ' 条'
  );

  const problems = [];
  for (const id of W.order) {
    const item = W.get(id);
    const behavior = BEH.get(map[id]);
    if (!behavior) { problems.push(id + '：CATALOG_OF 指向的资料库行为 ' + map[id] + ' 不存在'); continue; }
    const known = new Set(behavior.effects.map(e => e.organ));
    for (const organ of (item.organs || [])) {
      if (!known.has(organ)) {
        problems.push(id + '：weights 说落在 ' + organ + '，但资料库行为「' + behavior.name + '」里没有这条影响');
      }
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('眼睛：曾经只删了一半的器官，现在三层齐全', () => {
  /* 这条是那个 bug 的定点回归：少任何一层都会让「文字说涉及眼睛，人体上没有」复发 */
  assert.ok(D.organs.eyes, '资料库器官表里没有眼睛');
  assert.ok(
    Object.values(D.behaviors).some(b => b.effects.some(e => e.organ === 'eyes')),
    '没有任何行为关联到眼睛，那它就是个点开是空的器官'
  );
  assert.ok(DRAWN.has('eyes'), 'anatomy.js 里没有眼睛节点');
  const sit = W.get('sit');
  assert.ok(sit.organs.includes('eyes'), '「屏幕时间」的落点里没有眼睛，记它不会亮眼睛');
  const mapped = BEH.get(catalogOf().sit);
  assert.ok(mapped && mapped.effects.some(e => e.organ === 'eyes'),
    '「屏幕时间」映射到的资料库行为里没有眼睛，画面还是亮不起来');
});
