/* 提示词与输入拼装
 *
 * 为什么单独拆一个文件：这里出过一次很典型的错。
 *
 * 系统提示词原来固定写「四句」，第一句要求"比昨天多还是少"、第三句要求
 * "点一个只记录不折算的条目"。可是用户第一次记录时既没有昨天、也没有
 * 睡眠这类只记录条目——模型手里没有材料，又必须把这两句写出来，
 * 于是编出了"比昨天多损耗 200 分钟"，还把"近七天"硬说成"没有可靠口径"。
 *
 * 所以结构不写死在系统提示里，而是由 buildPrompt 按这份账本实际有什么来生成。
 * 有几句就写几句，永远不去要一个不存在的东西。
 *
 * 另一个坑：原来会把近七天逐日合计原样塞进去（"0、0、0、0、0、0、-200"），
 * 模型看到这串数字就想求和归类，而求和恰好是硬规则禁止的。
 * 它既没用上，就不必给——少给一个会诱发错误的输入。
 */

const SYSTEM = [
  '你是一个健康科普产品里的账本解读员，读者是 18 到 30 岁的普通人。',
  '你会收到一份已经按公开研究折算好的今日账本，你只负责把它念成人话。',
  '',
  '硬规则（违反任何一条都算错）：',
  '1. 数字只能原样引用输入里的，不得相加、换算、估算，也不得引入任何新的医学数字。',
  '2. 不得新增输入里没有的健康结论或建议。「有助于恢复」「对身体好」「会损伤」「为健康加分」这类判断不许自己加。',
  '3. 证据等级必须原样说「方向和数值证据都是 N 级」，不许改写成「中等」「较强」「一般」这类主观词。条目名称照抄输入，不要把「香烟」改写成「吸烟」。',
  '4. 不做诊断，不建议就医，不预测寿命，不出现「患病风险是」这类表述。',
  '5. 语气克制，像朋友把账单平静念一遍。不用感叹号，不训人，不制造恐慌。',
  '6. 输入里没有的东西，整篇不许提。没有「今天比昨天」这一行，就不许出现「昨天」或任何比较；',
  '   没有「只记录、不折算的条目」，就不许把别的数字说成没有折算口径。宁可比要求少写一句，也不许拿别的数据凑。',
  '7. 严格按输入末尾「这一份要写几句」写，有几条就写几句，顺序不变，不加不减。',
  '',
  '示例输入：香烟 1 支：损耗 20 分钟（方向证据 3 级，数值证据 3 级）；今日合计：损耗 20 分钟；昨天合计：损耗 40 分钟；今天和昨天比：比昨天损耗少 20 分钟；睡眠 7 小时只记录不折算。',
  '示例输出：今天合计损耗 20 分钟，比昨天损耗少 20 分钟。这 20 分钟全部来自 1 支烟，方向和数值证据都是 3 级。睡眠记了 7 小时，目前没有可靠的折算口径，不计入。今晚可以比平时早 20 分钟放下手机。',
  '',
  '直接输出正文。不要标题、不要 Markdown、不要列表、不要引号。'
].join('\n');

/* 分钟数最大的一条（按绝对值比，损耗是负数，不能直接取最大值） */
function topItem(items) {
  let top = null;
  for (const item of items) {
    if (!top || Math.abs(item.minutes) > Math.abs(top.minutes)) top = item;
  }
  return top;
}

/* 负号是机器约定，不该让模型去翻译。
 * 之前输入写「合计：-200 分钟」，模型就老实念出"今天合计 -200 分钟"，
 * 普通读者看了一脸问号。这里直接给成人话，模型照抄就不会错。 */
function phrase(minutes) {
  const abs = Math.abs(minutes);
  if (abs === 0) return '0 分钟，收支相抵';
  return minutes < 0 ? '损耗 ' + abs + ' 分钟' : '净收益 ' + abs + ' 分钟';
}

function comparePhrase(delta) {
  const abs = Math.abs(delta);
  if (abs === 0) return '和昨天持平';
  return delta > 0 ? '比昨天损耗少 ' + abs + ' 分钟' : '比昨天损耗多 ' + abs + ' 分钟';
}

function buildPrompt(p) {
  const lines = [];
  lines.push('今天的行为已经按公开研究口径折算成时间。');

  if (p.items.length) {
    lines.push('已折算的条目：');
    for (const item of p.items) {
      const level = item.direction
        ? '（方向证据 ' + item.direction + ' 级，数值证据 ' + item.value + ' 级）'
        : '';
      const cap = item.withinCap ? '（本周额度内，实际计 0）' : '';
      const range = item.hasRange ? '（原始研究区间很宽）' : '';
      lines.push('- ' + item.name + ' ' + item.qty + ' ' + item.unit + '：' + phrase(item.minutes) + level + cap + range);
    }
  } else {
    lines.push('今天没有任何条目能折算成分钟。');
  }

  if (p.noted.length) {
    lines.push('只记录、不折算的条目：');
    for (const item of p.noted) lines.push('- ' + item.name + ' ' + item.qty + ' ' + item.unit);
  }

  lines.push('今日合计：' + phrase(p.totalMinutes) + '。');

  const hasCompare = p.yesterdayMinutes !== null && p.delta !== null;
  if (hasCompare) {
    lines.push('昨天合计：' + phrase(p.yesterdayMinutes) + '。');
    lines.push('今天和昨天比：' + comparePhrase(p.delta) + '。');
  } else {
    lines.push('昨天没有记录，这一份不做前后比较。');
  }

  const top = topItem(p.items);
  const plan = [];

  if (hasCompare) {
    plan.push('说今天合计多少，照抄「今日合计」那一句，再接上「' + comparePhrase(p.delta) + '」。');
  } else {
    plan.push('说今天合计多少，照抄「今日合计」那一句。到这里为止，不要提昨天，也不要交代这是第几次记录。');
  }

  if (top) {
    plan.push('点名分钟数最大的那一条（' + top.name + '），并原样引用它的证据等级。');
  }

  if (p.noted.length) {
    plan.push('点一个「只记录、不折算」的条目（' + p.noted[0].name + '），说明它没有可靠的折算口径。');
  }

  /* 动作句原本允许"复用上面的时长"，结果它把"10 支"当成"10 分钟"缝出
     "少抽 10 分钟烟"这种半截话；改成禁止数字后，它又端出"用茶代替咖啡"——
     咖啡在输入里根本不存在，是模型自己的戒烟常识。
     只写"不许提别的东西"拦不住，于是把允许的范围直接列出来。 */
  const anchor = top ? top.name : '今天的账本';
  plan.push('给一个今天就能做的小动作。只能围绕「' + anchor + '」这一条来说，' +
    '写成"比今天少一点，或者换一种更轻的做法"这个意思。' +
    '这一句里不许出现数字，不许提茶、咖啡、运动、喝水这类输入里没有的东西，' +
    '也不许说「减少依赖」「对身体好」这类好处判断；不许是「戒烟」「戒酒」这类大口号。');

  lines.push('这一份要写 ' + plan.length + ' 句，逐条对应：');
  plan.forEach((line, index) => lines.push('第 ' + (index + 1) + ' 句：' + line));

  return lines.join('\n');
}

module.exports = { SYSTEM, buildPrompt };
