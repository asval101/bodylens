/* Authored summaries of sources retrieved on 2026-10-17. No personal risk model. */
(function (global) {
  'use strict';
  const sources = {
    'nci-tobacco': {org:'美国国家癌症研究所 NCI',title:'Harms of Cigarette Smoking and Health Benefits of Quitting',url:'https://www.cancer.gov/about-cancer/causes-prevention/risk/tobacco/cessation-fact-sheet',year:'公开科普资料',scope:'吸烟、二手烟与戒烟的一般证据；并非短期个人风险预测。'},
    'nci-low': {org:'美国国家癌症研究所 NCI',title:'No Safe Level of Smoking: Even low-intensity smokers are at increased risk of earlier death',url:'https://www.cancer.gov/news-events/press-releases/2016/low-intensity-smoking-risk',year:'2016',scope:'NIH-AARP 队列；超过 29 万名美国成年人，入组时 59–82 岁，多为白人；长期吸烟史自报，低量组人数相对较少。DOI: 10.1001/jamainternmed.2016.7511。'},
    'who-activity': {org:'世界卫生组织 WHO',title:'Physical activity',url:'https://www.who.int/news-room/fact-sheets/detail/physical-activity',year:'公开事实清单',scope:'一般身体活动、久坐与健康的群体证据，不区分每个个体的具体风险。'},
    'nhs-activity': {org:'英国国民保健署 NHS',title:'Physical activity guidelines for adults aged 19 to 64',url:'https://www.nhs.uk/live-well/exercise/physical-activity-guidelines-for-adults-aged-19-to-64/',year:'2024',scope:'19–64 岁成年人；其具体周活动建议不直接套用于所有年龄。'},
    'who-diet': {org:'世界卫生组织 WHO',title:'Healthy diet',url:'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',year:'公开事实清单',scope:'一般饮食模式与疾病预防建议；不能由一顿饭推算器官损伤。'},
    'who-alcohol': {org:'世界卫生组织 WHO',title:'Alcohol',url:'https://www.who.int/news-room/fact-sheets/detail/alcohol',year:'公开事实清单',scope:'饮酒相关健康风险的群体证据；不提供安全饮酒量或个人风险概率。'},
    'nhs-sleep': {org:'英国国民保健署 NHS',title:'Insomnia',url:'https://www.nhs.uk/conditions/insomnia/',year:'2024',scope:'一般睡眠知识与睡眠习惯建议；不能仅凭晚睡时间诊断失眠。'},
    'nhs-water': {org:'英国国民保健署 NHS',title:'Water, drinks and hydration',url:'https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/',year:'2023',scope:'一般饮水与饮料选择；需限液者应按医嘱，杯数不适合所有人。'},
    'nhs-eyes': {org:'英国国民保健署 NHS',title:'Dry eyes',url:'https://www.nhs.uk/conditions/dry-eyes/',year:'2025',scope:'屏幕、环境与干眼的科普，不能推算近视度数或视力损伤百分比。'},
    'who-oral': {org:'世界卫生组织 WHO',title:'Oral health',url:'https://www.who.int/news-room/fact-sheets/detail/oral-health',year:'公开事实清单',scope:'口腔疾病、游离糖、烟酒与口腔卫生的一般证据。'},
    'nhs-teeth': {org:'英国国民保健署 NHS',title:'How to keep your teeth clean',url:'https://www.nhs.uk/live-well/healthy-teeth-and-gums/how-to-keep-your-teeth-clean/',year:'2025',scope:'一般日常口腔清洁建议；不替代牙科检查。'},
    'nhs-hands': {org:'英国国民保健署 NHS',title:'How to wash your hands',url:'https://www.nhs.uk/live-well/best-way-to-wash-your-hands/',year:'公开科普资料',scope:'洗手、感染传播与日常预防的一般建议。'}
  };
  const organs = {
    brain: {name:'大脑',en:'BRAIN',system:'nervous',function:'处理信息、调节注意与记忆，也参与睡眠和情绪调节。',view:'front',anchor:[200,58]},
    eyes: {name:'眼睛',en:'EYES',system:'sensory',function:'感知光线并形成视觉信息；泪膜帮助保护眼表。',view:'front',anchor:[200,86]},
    mouth: {name:'口腔',en:'ORAL CAVITY',system:'sensory',function:'参与咀嚼、发音及吞咽，牙齿和牙龈需要日常清洁。',view:'front',anchor:[200,98]},
    lungs: {name:'肺部',en:'LUNGS',system:'respiratory',function:'通过肺泡完成气体交换，把氧气送入血液，排出二氧化碳。',view:'front',anchor:[181,188]},
    heart: {name:'心脏',en:'HEART',system:'circulatory',function:'持续泵送血液，为全身组织输送氧气与营养。',view:'front',anchor:[212,200]},
    liver: {name:'肝脏',en:'LIVER',system:'digestive',function:'参与营养代谢、物质转化与胆汁生成。',view:'front',anchor:[181,232]},
    stomach: {name:'胃',en:'STOMACH',system:'digestive',function:'暂时储存食物，并通过胃液和运动参与初步消化。',view:'front',anchor:[220,250]},
    gut: {name:'肠道',en:'INTESTINES',system:'digestive',function:'小肠吸收大部分营养，大肠参与水分吸收与粪便形成。',view:'front',anchor:[198,292]},
    kidneys: {name:'肾脏',en:'KIDNEYS',system:'urinary',function:'过滤血液、形成尿液，参与体液和电解质平衡。',view:'back',anchor:[172,268]},
    spine: {name:'脊柱与肌肉',en:'SPINE & MUSCLES',system:'musculoskeletal',function:'支撑身体、保护脊髓，并与肌肉共同完成运动。',view:'back',anchor:[200,214]}
  };
  const categories = ['饮食饮水','睡眠作息','运动','久坐','用眼','烟酒','日常清洁'];
  const E = (organ,type,title,text,source) => ({organ,type,title,text,source});
  const B = (id,name,category,icon,aliases,scenarios,effects,action) => ({id,name,category,icon,aliases,scenarios,effects,action,durations:['今天 / 单次','1 周','1 个月','1 年','长期习惯'],scope:'一般成年人；当前情境用于描述输入，未建立剂量或个人概率模型。'});
  const behaviors = [
    B('smoke','抽烟','烟酒','cigarette',['吸烟','香烟','抽香烟'],['每天 1 支','每天 2 支','每天 5 支','每天 10 支'],[
      E('lungs','harm','烟雾到达肺部，影响不止停留在当下','烟草烟雾中的有害物质可损伤呼吸系统。吸烟会导致肺癌及慢性阻塞性肺疾病；少量吸烟也不等于没有风险。','nci-tobacco'),
      E('heart','harm','血管与心脏也会受到影响','吸烟会导致心脏病和卒中。肺部并不是唯一受影响的地方；不能用运动来抵消吸烟带来的这些风险。','nci-tobacco'),
      E('brain','harm','尼古丁会形成依赖，吸烟也增加卒中风险','尼古丁具有高度成瘾性，吸烟会导致卒中。这里将依赖与脑血管风险映射到大脑，并不表示已发现脑部病变。','nci-tobacco'),
      E('mouth','harm','烟草也是口腔癌的重要风险因素','吸烟会导致口腔与咽喉等部位的癌症，也影响牙周健康。','who-oral'),
      E('kidneys','harm','长期吸烟的风险还涉及肾脏','吸烟可导致肾癌；本资料未提供与你的具体支数和时长对应的个人概率。','nci-tobacco')
    ],'为自己写下一个戒烟理由，安排一次戒烟咨询'),
    B('secondhand','接触二手烟','烟酒','wind',['二手烟','被动吸烟'],['偶尔接触','经常在室内接触'],[
      E('lungs','harm','没有安全的二手烟暴露水平','二手烟会导致不吸烟成年人的肺癌。NCI 汇总的长期共同居住研究，可作为群体参考。','nci-tobacco'),E('heart','harm','二手烟也影响心血管','二手烟对心脏和血管有直接不良影响，并增加心脏病风险。','nci-tobacco')
    ],'把今天的活动空间换成无烟环境'),
    B('quit','戒烟','烟酒','leaf',['不抽烟了','停止吸烟'],['刚决定戒烟','已停止吸烟'],[
      E('lungs','benefit','停止持续暴露，获益会逐步发生','戒烟后数周至数月呼吸相关表现可改善；长期可降低吸烟相关癌症风险。恢复过程不同，不能从一次打卡判断器官已修复。','nci-tobacco'),E('heart','benefit','心血管获益也会逐步出现','戒烟后心率、血压和循环可逐步改善，长期可降低相关疾病风险。','nci-tobacco')
    ],'清理身边的烟草，并记录最容易想抽烟的情境'),
    B('alcohol','饮酒','烟酒','wine',['喝酒','白酒','啤酒','葡萄酒'],['偶尔饮用','经常饮用','一次饮用较多'],[
      E('liver','harm','酒精相关风险包括肝病和肝癌','酒精是一种有毒、可致依赖的物质，与肝病及肝癌等风险有关；低水平饮用也并非完全无风险。','who-alcohol'),E('heart','harm','心脏也不是酒精影响的例外','饮酒与多种心血管疾病有关，不把饮酒作为保护心脏的方法。','who-alcohol'),E('brain','harm','酒精还影响精神与行为健康','饮酒与酒精使用障碍、焦虑和抑郁等健康问题有关。','who-alcohol'),E('gut','harm','酒精也是结直肠癌的风险因素','WHO 将酒精列为已知致癌物，饮酒可增加结直肠等多种癌症风险。','who-alcohol')
    ],'把今天的一次含酒精饮品换成无酒精饮品'),
    B('short-sleep','睡眠不足','睡眠作息','moon',['睡不够','缺觉','少睡'],['每晚约 5 小时','每晚约 6 小时'],[E('brain','harm','疲惫与注意力下降，会先进入白天','睡眠不足可能表现为白天疲倦、易怒、难以集中注意。成年人平均需要 7–9 小时，但个体需求不同，不能仅凭小时数诊断疾病。','nhs-sleep')],'为今晚留出更充足的睡眠时间'),
    B('enough-sleep','充足睡眠','睡眠作息','moon',['睡够','好好睡觉'],['每晚约 7–9 小时','按自己的需要留足睡眠'],[E('brain','benefit','给白天的清醒留出恢复时间','一般成年人平均需要 7–9 小时睡眠。适宜时长与良好习惯有助于白天保持清醒，但不能保证治疗失眠或某种疾病。','nhs-sleep')],'今晚提前安排好入睡前的放松时间'),
    B('irregular-sleep','作息不规律','睡眠作息','clock',['睡觉不规律','倒时差','晚睡但睡够'],['每天入睡时间变化较大','周末和工作日差异较大'],[E('brain','harm','不规律的节奏可能影响睡眠体验','NHS 建议维持规律的起床时间。单纯晚睡不等于睡眠不足；这里讨论作息节奏，不推算器官年龄。','nhs-sleep')],'明天按一个自己能坚持的时间起床'),
    B('bedtime-screen','睡前刷手机','睡眠作息','phone',['睡前看手机','睡前玩手机'],['睡前持续使用手机','上床后继续看屏幕'],[E('brain','harm','入睡前的屏幕可能让你更清醒','NHS 建议避免在睡前立即使用手机等屏幕设备，屏幕光线可让人更清醒；这不等于所有使用者都会失眠。','nhs-sleep'),E('eyes','harm','连续看屏幕也可能让眼表不适','长时间看屏幕、较少休息，是干眼相关因素之一。','nhs-eyes')],'睡前留一段不看屏幕的放松时间'),
    B('walk','快走','运动','walk',['散步','步行','走路'],['轻松步行','能说话但不能唱歌的快走'],[E('heart','benefit','活动起来，心血管会从长期习惯中获益','规律身体活动与更好的心血管健康相关；快走是中等强度活动的例子。轻松散步也有价值，但不自动视作同等强度。','who-activity'),E('brain','benefit','身体活动也与认知和情绪健康有关','规律身体活动可促进脑健康、改善总体身心状态。单次活动不代表已有疾病风险被消除。','who-activity')],'在适合自己的强度下，安排一次步行'),
    B('run','跑步','运动','activity',['慢跑','跑步运动'],['轻松慢跑','较高强度跑步'],[E('heart','benefit','规律运动有助于心血管健康','跑步可计入身体活动。强度和进阶应与当前能力匹配；身体不适时不要强行完成。','who-activity'),E('brain','benefit','活动也是身心健康的一部分','规律活动有助于精神与认知健康，不用一次运动表现衡量自己的健康。','who-activity')],'安排一次与当前体能匹配的活动'),
    B('cycle','骑行','运动','bike',['骑车','骑自行车'],['轻松骑行','较快或上坡骑行'],[E('heart','benefit','把出行变成身体活动的一部分','骑行可以计入日常活动；不同速度和坡度强度不同。规律身体活动与心血管获益相关。','who-activity')],'在安全路线完成一次适量骑行'),
    B('strength','力量训练','运动','dumbbell',['抗阻训练','练力量','举铁'],['自身体重训练','弹力带或适量负重'],[E('spine','benefit','肌肉强化是身体活动的重要组成','肌肉强化活动有助于肌肉与功能健康；动作和负荷需适合自己，不把训练等同于治疗脊柱疾病。','who-activity')],'练习一组适合自己能力的基础力量动作'),
    B('inactive','缺乏运动','运动','activity',['不运动','运动不足'],['长期活动不足','大部分日子没有活动'],[E('heart','harm','活动不足的风险会在长期累积','WHO 指出，活动不足人群的死亡风险相对充分活动人群增加约 20%–30%。这是总体人群指标，不是你的个人概率或心脏损伤比例。','who-activity')],'今天从一次短时间步行开始'),
    B('sit','连续久坐','久坐','chair',['久坐','一直坐着'],['连续坐着约 2 小时','工作学习时较少起身'],[E('heart','harm','久坐关联的是长期风险，不是坐一会儿就发生病变','较多久坐与心血管疾病及全因死亡等风险相关。现有资料不支持按每坐一小时计算损伤。','who-activity')],'在下一段工作或学习间隙起身活动'),
    B('sit-break','打断久坐','久坐','stand',['起身活动','少坐多动'],['坐一段时间后起身','用走动替代部分静坐'],[E('heart','benefit','用活动打断长时间不动','减少久坐、用身体活动替代部分静坐有益健康；没有足够资料为每次起身分配精确风险下降值。','who-activity')],'下一次休息时离开座位走一走'),
    B('tv-sit','久坐看视频','久坐','monitor',['躺着刷视频','一直看电视'],['连续看视频且很少活动','长时间静坐娱乐'],[E('heart','harm','长时间静坐是这项行为的主要关注点','本条按久坐证据说明潜在影响；不是说某类视频内容本身会伤害心脏。','who-activity'),E('eyes','harm','长时间连续看屏幕可能出现干涩','看屏幕时应留出休息时间，持续不适需由眼科或验光专业人员评估。','nhs-eyes')],'看完这一段后起身，并让眼睛休息'),
    B('screen','长时间看屏幕','用眼','monitor',['电脑','看手机','用眼过度'],['连续使用较少休息','每日较长时间使用'],[E('eyes','harm','眼干、刺痛和模糊感可能与你的用眼情境有关','长时间看电脑且不休息是干眼相关因素之一。不能据此推断近视加深多少度，也不能把不适直接诊断为损伤。','nhs-eyes')],'下一次屏幕休息时，给眼睛放松片刻'),
    B('eye-break','屏幕间歇休息','用眼','eye',['眼睛休息','用眼休息'],['连续用屏幕后休息','减少连续屏幕时间'],[E('eyes','benefit','让眼表从连续屏幕使用中休息','NHS 建议看电视或使用电脑时休息眼睛；没有证据把一次休息换算成视力恢复值。','nhs-eyes')],'结束当前屏幕任务后让眼睛休息'),
    B('dry-air','长时间处于干燥环境','用眼','wind',['空调房','干燥环境'],['干燥或空调环境','有烟雾或灰尘的环境'],[E('eyes','harm','环境也会影响眼表舒适度','干燥、烟雾、灰尘、风和空调等环境可能与干眼相关。症状持续时应寻求专业评估。','nhs-eyes')],'调整吹向眼部的风，并安排一次用眼休息'),
    B('salt','高盐饮食','饮食饮水','salt',['吃太咸','重口味','盐多'],['常吃高盐加工食品','做饭时习惯多放盐'],[E('heart','harm','高钠摄入可推高血压，影响心血管','WHO 指出，高钠摄入与血压升高有关，后者可导致心血管疾病。一般成年人食盐应限制在每天少于 5 克；不能由一餐推算个人风险。','who-diet')],'下一餐少放一次盐或高钠调味料'),
    B('sugary','经常喝含糖饮料','饮食饮水','cup',['奶茶','可乐','含糖饮料','汽水'],['每天一杯 / 瓶','一周多次'],[E('mouth','harm','游离糖会被牙菌斑转化成侵蚀牙齿的酸','持续较高的游离糖摄入，是龋齿的重要风险因素；实际含糖量因配方与份量而异。','who-oral')],'把今天的一杯含糖饮料换成水'),
    B('water','规律补充水分','饮食饮水','droplet',['喝水','饮水'],['日常按需要饮水','运动或炎热时适量补水'],[E('kidneys','benefit','补水帮助维持正常体液平衡','水分对身体正常运作重要。尿色和环境可作为一般参考；不鼓励过量喝水，需限液者按医嘱。这里不宣称喝水能“排毒”或修复肾脏。','nhs-water')],'在方便的位置放一杯水，按需要饮用'),
    B('low-water','饮水不足','饮食饮水','droplet',['忘记喝水','喝水少'],['经常忘记补充液体','炎热或运动后补水不足'],[E('kidneys','harm','水分不足时，身体的体液平衡会受影响','NHS 建议根据日常需要补充液体，炎热、运动等情况下可能需要更多。单凭自报杯数不能诊断肾脏损伤。','nhs-water')],'留意口渴和当天活动情况，适量补充液体'),
    B('vegetables','规律吃蔬果','饮食饮水','leaf',['吃蔬菜','吃水果','蔬菜水果'],['每天搭配多样蔬果','用完整水果替代部分甜食'],[E('heart','benefit','多样饮食是长期健康的一部分','蔬果是健康饮食的重要组成。健康饮食有助于预防心血管等非传染性疾病，不把一份蔬菜折算成风险下降百分比。','who-diet'),E('gut','benefit','富含纤维的食物是健康饮食的一部分','蔬果、全谷物与豆类等为膳食纤维的重要来源。实际需要取决于整体饮食和个体情况。','who-diet')],'下一餐搭配一种蔬菜或完整水果'),
    B('wholegrain','吃全谷物','饮食饮水','wheat',['全谷物','粗粮','燕麦'],['用部分全谷替代精制主食','搭配豆类与全谷'],[E('gut','benefit','从主食中增加膳食纤维来源','WHO 建议健康饮食包含全谷物等多样食物；这是一种饮食模式建议，不等于治疗某种肠道疾病。','who-diet')],'下一餐用适量全谷物替代部分精制主食'),
    B('low-veg','蔬果摄入较少','饮食饮水','leaf',['不吃蔬菜','蔬菜少'],['大部分日子很少吃蔬果','饮食种类较单一'],[E('gut','harm','饮食过于单一可能缺少足够的纤维来源','WHO 指出不少人蔬果和膳食纤维摄入不足；这里提供饮食模式提醒，不诊断你已缺乏某种营养素。','who-diet')],'为下一餐补充一种方便获得的蔬果'),
    B('late-meal','临睡前吃大餐','饮食饮水','utensils',['睡前大餐','夜里吃太饱'],['临睡前吃较大份量','吃完很快上床'],[E('brain','harm','大餐时间也可能干扰睡眠习惯','NHS 的睡眠建议包括避免很晚吃大餐。这里只映射睡眠相关影响，不凭一顿夜宵判断胃部疾病。','nhs-sleep')],'今晚把较大份量的用餐安排在更早的时间'),
    B('brush','认真刷牙','日常清洁','brush',['刷牙','清洁牙齿'],['每天两次，每次约 2 分钟','使用含氟牙膏清洁各牙面'],[E('mouth','benefit','清除牙菌斑，让预防从每天开始','NHS 建议每天用含氟牙膏刷牙两次，每次约 2 分钟；清洁各个牙面有助于预防龋齿与牙龈问题。','nhs-teeth')],'今晚睡前认真刷牙约 2 分钟'),
    B('skip-brush','经常不刷牙','日常清洁','brush',['不刷牙','漏刷牙'],['经常漏掉睡前刷牙','长期清洁不足'],[E('mouth','harm','牙菌斑积累会增加龋齿与牙龈问题','牙菌斑是附着在牙面的细菌膜；缺乏有效清洁会让它积累，导致口腔健康问题。','nhs-teeth')],'为今晚的睡前刷牙留出约 2 分钟'),
    B('wash','认真洗手','日常清洁','hand',['洗手','饭前洗手'],['用肥皂和水清洁约 20 秒','饭前、如厕后等关键时刻'],[E('gut','benefit','减少从手到口的病原体传播','正确洗手有助于减少食物中毒、腹泻等疾病的传播。并不意味着洗一次手就能保证不感染。','nhs-hands')],'下一次饭前用肥皂和水认真洗手')
  ];
  const smokeMetric = {value:'近 12',unit:'倍',title:'肺癌死亡的相对风险',baseline:'从不吸烟者',exposed:'长期每天 1–10 支者',ratio:12,source:'nci-low',population:'美国 NIH-AARP 队列，入组时 59–82 岁；长期每天 1–10 支的吸烟者与从不吸烟者比较。',limit:'这是长期人群研究的肺癌死亡风险，不是肺癌发病率，也不是你的个人概率；不能换算成抽 1 个月的结果。'};
  const metrics = {
    'smoke:lungs':smokeMetric,
    'secondhand:lungs':{value:'20–30',unit:'%',title:'肺癌风险相对增加',baseline:'不接触二手烟者',exposed:'与吸烟者共同居住者',ratio:1.25,range:[1.2,1.3],source:'nci-tobacco',population:'NCI 引述美国卫生总监对不吸烟者与吸烟者共同居住的研究估计。',limit:'长期人群参考；20%–30% 是相对增加，不是个人有 20%–30% 的概率患癌，也不适用于一次短暂接触。'},
    'inactive:heart':{value:'20–30',unit:'%',title:'全因死亡风险相对增加',baseline:'充分活动人群',exposed:'活动不足人群',ratio:1.25,range:[1.2,1.3],source:'who-activity',population:'WHO 对活动不足与充分活动人群的总体比较；此处由心血管入口展示全因死亡指标。',limit:'不是心脏病发病概率、不是器官损伤程度；不能按少运动几天进行换算。'}
  };
  const assetCredits=[{title:'解剖交互图主体',author:'身知项目 SVG，基于前一版可编辑图稿迭代',license:'非临床解剖图谱；肺和肠道纹理另采用下述 OpenStax 资料的改编。',url:''},{title:'消化系统教学图与肠道纹理',author:'OpenStax · Anatomy and Physiology（第一版）',license:'CC BY 4.0；肠道纹理经裁剪、移除标注线、透明化并缩放。原书许可元数据已核对，不代表原作者背书。',url:'https://openstax.org/books/anatomy-and-physiology/pages/23-1-overview-of-the-digestive-system'},{title:'呼吸系统教学图与肺纹理',author:'OpenStax · Anatomy and Physiology（第一版）',license:'CC BY 4.0；肺纹理经裁剪、移除标注线、缩放及透明叠加。',url:'https://openstax.org/books/anatomy-and-physiology/pages/22-1-organs-and-structures-of-the-respiratory-system'}];
  const data={version:'2026.10.17',appVersion:'0.1.0',retrieved:'2026-10-17',sources,organs,categories,behaviors,metrics,assetCredits};
  if (typeof module!=='undefined' && module.exports) module.exports=data;
  else global.BodyLensData=data;
})(typeof window==='undefined'?globalThis:window);
