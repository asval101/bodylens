(function(global){
  'use strict';
  const D=typeof module!=='undefined'&&module.exports?require('./data/catalog.js'):global.BodyLensData;
  const ids=new Set(D.behaviors.map(b=>b.id));
  const norm=s=>String(s).trim().replace(/[。.!！?？]/g,'').replace(/^我(?:想|要)?/,'').replace(/对(?:肺|心脏|身体)(?:部)?(?:的)?影响$/,'').trim();
  function matchInput(value){
    const matched=[],unknown=[],ambiguous=[];
    for(const raw of value.split(/[，,、;；\n]+/).map(s=>s.trim()).filter(Boolean)){
      const word=norm(raw);
      if(['熬夜','晚睡'].includes(word)){ambiguous.push(raw);continue;}
      const found=D.behaviors.find(b=>[b.name,...b.aliases].includes(word));
      if(found&&!matched.includes(found.id))matched.push(found.id);else if(!found)unknown.push(raw);
    }
    return {matched,unknown,ambiguous};
  }
  function localDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function isDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const [y,m,d]=value.split('-').map(Number);const v=new Date(y,m-1,d);return v.getFullYear()===y&&v.getMonth()===m-1&&v.getDate()===d;}
  function validAge(age){return String(age).trim()!==''&&Number.isInteger(Number(age))&&Number(age)>=18&&Number(age)<=120;}
  function cleanChoices(value,allowUnknown=false){
    if(!Array.isArray(value)||value.length>60)throw new Error('行为列表格式不正确');
    const seen=new Set(),result=[];
    for(const item of value){
      if(!item||typeof item.id!=='string'||!Number.isInteger(item.scenario)||typeof item.duration!=='string')throw new Error('行为情境字段无效');
      const b=D.behaviors.find(x=>x.id===item.id);
      if(!b){if(allowUnknown)continue;throw new Error('行为不存在');}
      if(item.scenario<0||item.scenario>=b.scenarios.length||!b.durations.includes(item.duration))throw new Error('行为情境超出范围');
      if(!seen.has(item.id)){result.push({id:item.id,scenario:item.scenario,duration:item.duration});seen.add(item.id);}
    }
    return result;
  }
  /* 字段宽容度说明：合并成一页之后，年龄 / 性别 / 情境选择 / 结果快照这四组字段
   * 已经不再参与任何计算（年龄只曾用于一句说明文案）。为了仍能恢复旧备份，
   * 它们「存在就校验、不存在就跳过」，但不会再被写回 state。 */
  function validateState(raw,allowUnknown=true){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('用户数据格式不正确');
    if(raw.age!==undefined&&(typeof raw.age!=='string'||(raw.age!==''&&!validAge(raw.age))))throw new Error('备份中的年龄无效');
    if(raw.sex!==undefined&&!['male','female','unspecified'].includes(raw.sex))throw new Error('性别字段无效');
    if(raw.mode!==undefined&&!['single','combined'].includes(raw.mode))throw new Error('分析模式无效');
    if(!Array.isArray(raw.tasks)||raw.tasks.length>10000)throw new Error('计划数据格式不正确');
    const seen=new Set();
    const tasks=raw.tasks.map(t=>{
      if(!t||typeof t.id!=='string'||t.id.length>100||seen.has(t.id)||typeof t.title!=='string'||!t.title.trim()||t.title.length>120||typeof t.note!=='string'||t.note.length>500||typeof t.done!=='boolean'||!isDate(t.date)||typeof t.createdAt!=='string'||!Number.isFinite(Date.parse(t.createdAt))||typeof t.updatedAt!=='string'||!Number.isFinite(Date.parse(t.updatedAt)))throw new Error('计划字段无效或存在重复编号');
      if(t.behavior!==null&&typeof t.behavior!=='string')throw new Error('计划关联字段无效');
      seen.add(t.id);return {id:t.id,title:t.title,note:t.note,done:t.done,date:t.date,behavior:t.behavior,createdAt:t.createdAt,updatedAt:t.updatedAt};
    });
    cleanChoices(Array.isArray(raw.choices)?raw.choices:[],allowUnknown);
    if(!raw.prefs||typeof raw.prefs.motion!=='boolean'||typeof raw.prefs.depth!=='boolean')throw new Error('显示偏好无效');
    const organ=Object.hasOwn(D.organs,raw.organ)?raw.organ:'lungs';
    const view=raw.view==='back'?'back':'front';
    return {tasks,prefs:{motion:raw.prefs.motion,depth:raw.prefs.depth},view,organ};
  }
  function parseBackup(raw){
    if(!raw||raw.schemaVersion!==1||raw.app!=='bodylens'||typeof raw.appVersion!=='string'||typeof raw.dataVersion!=='string'||typeof raw.exportedAt!=='string'||!Number.isFinite(Date.parse(raw.exportedAt))||typeof raw.timezone!=='string')throw new Error('不是受支持的身知备份，或备份版本不兼容');
    return validateState(raw.data,true);
  }
  function effectsFor(choices,organ){return choices.flatMap(c=>{const behavior=D.behaviors.find(b=>b.id===c.id);return behavior?behavior.effects.filter(e=>!organ||e.organ===organ).map(e=>({...e,behavior,choice:c})):[];});}
  function statusFor(choices,organ){const types=new Set(effectsFor(choices,organ).map(e=>e.type));return types.size>1?'mixed':types.values().next().value||'neutral';}
  const api={matchInput,localDate,isDate,validAge,cleanChoices,validateState,parseBackup,effectsFor,statusFor,ids};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.BodyLensDomain=api;
})(typeof window==='undefined'?globalThis:window);
