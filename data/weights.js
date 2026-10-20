/* 行为时间权重表 —— 全站唯一的数值真相源。
 *
 * 规则（违反即为缺陷，不是待优化项）：
 *   1. 任何分钟数只能从这里读。界面、文案、其他模块一律不得自行写死数字。
 *   2. 每条有数字的条目必须有 source，且 source 必须在本文件 sources 中登记。
 *   3. value（数值等级）不得高于 direction（方向等级）——方向都不可信，数值必然不可信。
 *   4. minutes 为 null 表示「方向可信但没有可靠的折算口径」，界面只给方向，不给数字。
 *   5. 宁可不给数字，也不给一个找不到出处的数字。
 *
 * 证据等级含义：
 *   direction  A 多项独立研究结论一致 ｜ B 结论较一致但有前提 ｜ C 目前证据有限
 *   value      A 可直接引用        ｜ B 群体平均，个体差异大 ｜ C 无一致口径
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BodyLensWeights = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  const sources = {
    'ucl-cigarette-2024': {
      org: '伦敦大学学院 UCL',
      title: 'The price of a cigarette: 20 minutes of life?',
      journal: 'Addiction',
      year: '2024-12-29',
      population: '英国医生研究（男性，1951 年起）与百万女性研究（女性，1996 年起）中的长期吸烟者',
      note: '每支烟平均缩短预期寿命 20 分钟：男性 17 分钟、女性 22 分钟。群体平均值，不是个人预测。DOI 与原文链接待补。'
    },
    'who-alcohol': {
      org: '世界卫生组织 WHO',
      title: 'Alcohol — Fact sheet',
      year: '公开事实清单',
      population: '一般人群饮酒相关风险的群体证据',
      note: '酒精与肝病、多种癌症及心血管疾病相关，不存在可以认定为「安全」的饮酒水平。原文未给出每杯折算寿命的口径。'
    },
    'nhs-sleep': {
      org: '英国国民保健署 NHS',
      title: 'Insomnia / How much sleep do I need?',
      year: '2024',
      population: '一般成年人',
      note: '成年人平均需要 7–9 小时睡眠，个体需求不同。长期睡眠不足与代谢、心血管及心理健康风险相关，原文未给出按小时折算寿命的口径。'
    },
    'who-activity': {
      org: '世界卫生组织 WHO',
      title: 'Physical activity — Fact sheet',
      year: '公开事实清单',
      population: '一般人群',
      note: '规律身体活动与心血管健康、全因死亡风险改善相关；活动不足人群死亡风险相对增加约 20%–30%。这是群体相对风险，不能折算为个人分钟数。'
    },
    'who-diet': {
      org: '世界卫生组织 WHO',
      title: 'Healthy diet — Fact sheet',
      year: '公开事实清单',
      population: '一般人群',
      note: '游离糖摄入与龋齿、体重相关；原文按占能量比例给出建议，未给出按份折算寿命的口径。'
    },
    'nci-tobacco': {
      org: '美国国家癌症研究所 NCI',
      title: 'Harms of Cigarette Smoking and Health Benefits of Quitting',
      year: '公开科普资料',
      population: '吸烟与戒烟的一般证据',
      note: '吸烟导致多种癌症、心脏病与卒中；戒烟后风险逐步下降。'
    }
  };

  /* minutes：单次/单位数量的分钟变动。负为损耗，正为收益。
   * presets：界面上直接可点的常见数量，避免用户为了记一次账要打三次键盘。 */
  const items = {
    smoke: {
      name: '香烟',
      unit: '支',
      minutes: -20,
      direction: 'A',
      value: 'B',
      source: 'ucl-cigarette-2024',
      presets: [1, 2, 5, 10, 20],
      line: '每支烟从你的生命里拿走约 20 分钟。',
      caveat: '群体平均值（男 17、女 22）。个体差异很大，用于累积对比，不用于推测你还能活多久。'
    },
    alcohol: {
      name: '酒精',
      unit: '标准杯',
      minutes: null,
      direction: 'A',
      value: 'C',
      source: 'who-alcohol',
      presets: [1, 2, 3, 5],
      line: '酒精没有可以认定为安全的摄入量。',
      caveat: '方向明确，但「一杯折合多少分钟」目前没有一致口径，所以这里不折算成分钟。'
    },
    shortSleep: {
      name: '睡眠不足',
      unit: '小时（缺）',
      minutes: null,
      direction: 'B',
      value: 'C',
      source: 'nhs-sleep',
      presets: [1, 2, 3],
      line: '长期睡不够，影响的是白天和长期的代谢、心血管状态。',
      caveat: '成年人平均需要 7–9 小时，个体差异大；单纯晚睡不等于睡眠不足。暂不折算分钟。'
    },
    sit: {
      name: '连续久坐',
      unit: '小时',
      minutes: null,
      direction: 'B',
      value: 'C',
      source: 'who-activity',
      presets: [1, 2, 4, 8],
      line: '久坐的风险是长期累积的，不是坐一小时就发生病变。',
      caveat: '现有资料不支持按每坐一小时计算损伤，暂不折算分钟。'
    },
    sugar: {
      name: '含糖饮料',
      unit: '份（约 50g 糖）',
      minutes: null,
      direction: 'B',
      value: 'C',
      source: 'who-diet',
      presets: [1, 2, 3],
      line: '游离糖摄入与龋齿和体重增加相关。',
      caveat: '「一份」在不同产品间差异很大，暂按 50g 添加糖粗略归并，不折算分钟。'
    },
    walk: {
      name: '快走',
      unit: '分钟',
      minutes: null,
      direction: 'A',
      value: 'C',
      source: 'who-activity',
      presets: [15, 30, 45, 60],
      line: '规律活动是少数确定有收益的事。',
      caveat: '收益与累计活动量相关，但「走一分钟抵消多少损耗」没有可靠口径，不做抵扣。'
    },
    sleep: {
      name: '睡够了',
      unit: '晚',
      minutes: null,
      direction: 'B',
      value: 'C',
      source: 'nhs-sleep',
      presets: [1],
      line: '按自己的需要睡够，是第二天状态的基础。',
      caveat: '「睡够」因人而异，暂不折算分钟。'
    },
    quit: {
      name: '没抽烟',
      unit: '天',
      minutes: null,
      direction: 'A',
      value: 'C',
      source: 'nci-tobacco',
      presets: [1],
      line: '每少抽一支，那段被拿走的时间就留在你这里。',
      caveat: '戒烟获益会逐步发生；这里只记录行为，不宣称器官已修复。'
    }
  };

  const order = ['smoke', 'alcohol', 'shortSleep', 'sit', 'sugar', 'walk', 'sleep', 'quit'];

  /* 等级比较：A > B > C。用于校验 value 不得高于 direction。 */
  const rank = { A: 3, B: 2, C: 1 };

  function get(id) {
    return Object.prototype.hasOwnProperty.call(items, id) ? items[id] : null;
  }

  function hasNumber(id) {
    const item = get(id);
    return !!item && typeof item.minutes === 'number' && item.minutes !== 0;
  }

  /* 计算一条记录的分钟变动；无可靠口径返回 null（而不是 0）。 */
  function minutesFor(id, qty) {
    const item = get(id);
    if (!item || typeof item.minutes !== 'number') return null;
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return null;
    return item.minutes * n;
  }

  function validate() {
    const problems = [];
    for (const id of Object.keys(items)) {
      const item = items[id];
      if (!sources[item.source]) problems.push(id + '：来源 ' + item.source + ' 未登记');
      if (!rank[item.direction] || !rank[item.value]) problems.push(id + '：证据等级取值非法');
      if (rank[item.value] > rank[item.direction]) problems.push(id + '：数值等级高于方向等级');
      if (typeof item.minutes === 'number' && !item.caveat) problems.push(id + '：有数字但缺限制说明');
    }
    return problems;
  }

  return { sources, items, order, rank, get, hasNumber, minutesFor, validate };
});
