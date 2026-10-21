/* 提示词拼装
 *
 * 这几条锁的都是同一个教训：不要在指令里要一个数据里不存在的东西。
 *
 * 曾经系统提示写死「四句」，第一句必答"比昨天多还是少"、第三句必答
 * "只记录不折算的条目"。用户第一次记录时这两样都没有，模型只能编，
 * 于是输出了"比昨天多损耗 200 分钟"这种根本没有依据的话。
 * 现在结构由 buildPrompt 按数据生成，测试就盯住"没有的就不许要"。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { SYSTEM, buildPrompt } = require('../server/prompt.cjs');

/* 一份最普通的账本：只有折算条目，没有只记录条目，昨天没有记录 */
function base(over = {}) {
  return Object.assign({
    mode: 'ledger',
    totalMinutes: -200,
    counted: 1,
    items: [{
      id: 'smoke', name: '香烟', qty: 10, unit: '支', minutes: -200,
      direction: '3', value: '3', withinCap: false, hasRange: true
    }],
    noted: [],
    yesterdayMinutes: null,
    delta: null,
    weekTotals: [0, 0, 0, 0, 0, 0, -200]
  }, over);
}

test('没有昨天记录时，不许要求做前后比较', () => {
  const text = buildPrompt(base());
  assert.ok(!text.includes('今天比昨天'), '输入里不该出现比较行');
  assert.ok(!/第 \d 句：.*和昨天比/.test(text), '清单里不该要求写比较');
  assert.ok(text.includes('昨天没有记录'), '应明确告知没有对照，而不是留空让人猜');
});

test('没有昨天记录时，也不许在清单里提到「第一次记录」这类话', () => {
  const text = buildPrompt(base());
  assert.ok(!text.includes('第一次记录'), '别说"第一次记录"，读者不关心这是第几次');
});

test('有昨天记录时才生成比较句，并把方向讲清楚', () => {
  const text = buildPrompt(base({ yesterdayMinutes: -400, delta: 200 }));
  assert.ok(text.includes('今天和昨天比：比昨天损耗少 200 分钟'));
  assert.ok(/第 1 句：.*比昨天损耗少 200 分钟/.test(text));
});

test('输入里不出现带负号的数字，模型照抄也不会念出 -200', () => {
  const text = buildPrompt(base({ yesterdayMinutes: -400, delta: 200 }));
  assert.ok(!/-\d+\s*分钟/.test(text), '负号是机器约定，先翻译成人话再给模型');
  assert.ok(text.includes('今日合计：损耗 200 分钟'));
  assert.ok(text.includes('昨天合计：损耗 400 分钟'));
});

test('没有只记录条目时，不许要求点这类条目', () => {
  const text = buildPrompt(base());
  assert.ok(!text.includes('只记录、不折算的条目：'), '输入里不该有空的分组标题');
  assert.ok(!/第 \d 句：.*只记录/.test(text), '清单里不该要求写这一句');
});

test('有只记录条目时，要求点名，且给出名字省得它自己找', () => {
  const text = buildPrompt(base({
    noted: [{ id: 'sleep', name: '睡眠不足', qty: 7, unit: '小时' }]
  }));
  assert.ok(text.includes('只记录、不折算的条目：'));
  assert.ok(text.includes('点一个「只记录、不折算」的条目（睡眠不足）'));
});

test('近七天逐日数组不进提示词，避免诱使它求和', () => {
  const text = buildPrompt(base({ weekTotals: [0, 0, 0, -100, 0, 0, -200] }));
  assert.ok(!text.includes('近七天'), '这串数字用不上，给了只会让它去做禁止的相加');
});

test('点名的最大条目按绝对值挑，损耗是负数不能被最小值骗到', () => {
  const text = buildPrompt(base({
    items: [
      { id: 'a', name: '小损耗', qty: 1, unit: '次', minutes: -10, direction: '2', value: '2', withinCap: false, hasRange: false },
      { id: 'b', name: '大损耗', qty: 3, unit: '次', minutes: -90, direction: '3', value: '3', withinCap: false, hasRange: false }
    ]
  }));
  assert.ok(text.includes('点名分钟数最大的那一条（大损耗）'));
});

test('句数声明与清单条数一致', () => {
  const withAll = buildPrompt(base({
    yesterdayMinutes: -400, delta: 200,
    noted: [{ id: 'sleep', name: '熬夜', qty: 1, unit: '次' }]
  }));
  assert.ok(withAll.includes('这一份要写 4 句'), '合计+比较、点名、只记录、动作');

  const bare = buildPrompt(base());
  assert.ok(bare.includes('这一份要写 3 句'), '合计、点名、动作');
});

test('动作句只管这条数据本身：不许数字，也不许端出输入里没有的东西', () => {
  /* 曾经允许"复用上面的时长"，模型把"10 支"当"10 分钟"，
     缝出"少抽 10 分钟烟"；改成禁数字后它又端出"用茶代替咖啡"，
     咖啡在输入里根本不存在。所以现在把允许的范围直接写进清单。 */
  const text = buildPrompt(base());
  assert.ok(text.includes('不许出现数字'));
  assert.ok(text.includes('只能围绕「香烟」这一条来说'), '必须把范围钉在最大条目上');
  assert.ok(text.includes('不许提茶、咖啡、运动、喝水'));
  assert.ok(text.includes('不许说「减少依赖」「对身体好」'));
});

test('系统提示要求「有几条写几条」，避免句数被硬编码回四句', () => {
  assert.ok(SYSTEM.includes('有几条就写几句'));
  assert.ok(!/结构（四句/.test(SYSTEM), '不能又退回写死四句');
});
