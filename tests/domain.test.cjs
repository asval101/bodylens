const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../data/catalog.js');
const M=require('../domain.js');
const fixture=()=>({age:'22',sex:'unspecified',mode:'combined',choices:[{id:'smoke',scenario:0,duration:'1 个月'},{id:'walk',scenario:1,duration:'1 年'}],applied:{demo:false,age:'22',sex:'unspecified',mode:'combined',choices:[{id:'smoke',scenario:0,duration:'1 个月'},{id:'walk',scenario:1,duration:'1 年'}]},tasks:[{id:'task-1',title:'<script>alert(1)</script>',note:'保留为纯文本',done:false,date:'2026-10-17',behavior:'unavailable-old-behavior',createdAt:'2026-10-17T02:00:00.000Z',updatedAt:'2026-10-17T02:00:00.000Z'}],prefs:{motion:true,depth:true},view:'front',zoom:'torso',organ:'lungs',system:'all'});
const backup=()=>({app:'bodylens',schemaVersion:1,appVersion:'0.1.0',dataVersion:D.version,exportedAt:'2026-10-17T02:00:00.000Z',timezone:'Asia/Shanghai',data:fixture()});
test('受控匹配不把否定输入变为吸烟，混合输入分别报告',()=>{
  assert.deepEqual(M.matchInput('不抽烟').matched,[]);
  assert.deepEqual(M.matchInput('戒烟').matched,['quit']);
  const r=M.matchInput('吸烟，打断久坐，神奇疗法');
  assert.deepEqual(r.matched,['smoke','sit-break']);assert.deepEqual(r.unknown,['神奇疗法']);
  assert.deepEqual(M.matchInput('熬夜').ambiguous,['熬夜']);
});
test('综合结果保留吸烟与活动的独立心脏影响',()=>{
  const choices=fixture().choices;
  assert.equal(M.statusFor(choices,'heart'),'mixed');
  const effects=M.effectsFor(choices,'heart');assert.equal(effects.length,2);assert.equal(effects[0].behavior.id,'smoke');assert.equal(effects[1].behavior.id,'walk');
  assert.equal(M.statusFor(choices,'stomach'),'neutral');
});
test('成年人年龄约束和真实本地日期校验',()=>{
  for(const age of ['','17','18.5','abc','121'])assert.equal(M.validAge(age),false);
  for(const age of ['18','80','120'])assert.equal(M.validAge(age),true);
  assert.equal(M.isDate('2026-02-30'),false);assert.equal(M.isDate('2024-02-29'),true);
  assert.equal(M.localDate(new Date(2026,9,17,0,1)),'2026-10-17');
});
test('备份往返保留日期、纯文本和未知关联任务；未知分析行为丢弃',()=>{
  const raw=backup();raw.data.choices.push({id:'old-removed',scenario:0,duration:'1 个月'});
  const clean=M.parseBackup(JSON.parse(JSON.stringify(raw)));
  assert.equal(clean.tasks[0].date,'2026-10-17');assert.equal(clean.tasks[0].behavior,'unavailable-old-behavior');assert.equal(clean.tasks[0].title,'<script>alert(1)</script>');assert.equal(clean.choices.length,2);
});
test('不兼容版本、坏字段、错误日期与重复任务拒绝导入',()=>{
  let raw=backup();raw.schemaVersion=2;assert.throws(()=>M.parseBackup(raw));
  raw=backup();raw.data.tasks[0].done='yes';assert.throws(()=>M.parseBackup(raw));
  raw=backup();raw.data.tasks[0].date='2026-02-30';assert.throws(()=>M.parseBackup(raw));
  raw=backup();raw.data.tasks.push({...raw.data.tasks[0]});assert.throws(()=>M.parseBackup(raw));
  raw=backup();raw.data.choices[0].scenario=900;assert.throws(()=>M.parseBackup(raw));
  raw=backup();raw.data.mode='single';assert.throws(()=>M.parseBackup(raw));
});
test('资料映射有效，七类至少各两项，总数至少30',()=>{
  assert.ok(D.behaviors.length>=30);
  for(const category of D.categories)assert.ok(D.behaviors.filter(b=>b.category===category).length>=2,category);
  assert.equal(new Set(D.behaviors.map(b=>b.id)).size,D.behaviors.length);
  for(const b of D.behaviors)for(const e of b.effects){assert.ok(D.organs[e.organ],b.id);assert.ok(D.sources[e.source],b.id);}
  for(const metric of Object.values(D.metrics))assert.ok(D.sources[metric.source]);
});
