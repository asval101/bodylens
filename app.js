(function(){
  'use strict';
  const D=window.BodyLensData, M=window.BodyLensDomain;
  const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
  const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons={
    settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m9 3-.5 2-2 1.2-2-.6L2 10l1.5 1.5v2L2 15l2.5 4.4 2-.6 2 1.2.5 2h6l.5-2 2-1.2 2 .6L22 15l-1.5-1.5v-2L22 10l-2.5-4.4-2 .6-2-1.2L15 3Z"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    cigarette:'<path d="M3 14h15v5H3zM15 14v5M21 14v5M18 3c-3 2 3 4 0 7M12 3c-3 2 3 4 0 7"/>',
    moon:'<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    phone:'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
    walk:'<circle cx="13" cy="4" r="2"/><path d="m8 22 3-7-1-5 3-3 3 6 4 1M4 13l4-2 3-4m0 8 5 3 1 4"/>',
    activity:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',
    chair:'<path d="M6 13V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8M4 13h16v5H4zM6 18v4m12-4v4"/>',
    stand:'<circle cx="12" cy="4" r="2"/><path d="M12 7v8m0-6-6 3m6-3 6 3m-6 3-4 7m4-7 4 7"/>',
    eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    monitor:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    wine:'<path d="M8 2h8l2 6a6 6 0 0 1-12 0Zm4 12v8m-5 0h10M6 7h12"/>',
    leaf:'<path d="M20 3C8 2 2 6 4 15c3 8 15 5 16-12ZM3 22l12-12"/>',
    salt:'<path d="m8 3 8 0 1 4-10 0Zm-1 4L4 21h16L17 7M10 4h.01M14 4h.01M8 12h8"/>',
    cup:'<path d="M5 4h12v14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3ZM17 7h2a3 3 0 0 1 0 6h-2"/>',
    droplet:'<path d="M12 2s8 9 8 13a8 8 0 0 1-16 0c0-4 8-13 8-13Z"/>',
    wheat:'<path d="M12 22V3m0 7C5 10 3 7 4 3c4 0 8 3 8 7Zm0 5c7 0 9-3 8-7-4 0-8 3-8 7Zm0 4c-7 0-9-3-8-7 4 0 8 3 8 7Z"/>',
    utensils:'<path d="M4 2v7a3 3 0 0 0 6 0V2M7 2v20M20 22V2c-6 4-6 10 0 10"/>',
    brush:'<path d="m7 21 3-12 5 1-3 12ZM10 9l1-5h9v6h-5M12 4V2m3 2V2m3 2V2"/>',
    hand:'<path d="M8 12V4a2 2 0 0 1 4 0v7-8a2 2 0 0 1 4 0v9-6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-4-1-6-4l-4-5c-1-2 1-3 3-2l2 2"/>',
    wind:'<path d="M2 8h13a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M2 17h7a2 2 0 1 1-2 2"/>',
    bike:'<circle cx="5" cy="16" r="4"/><circle cx="19" cy="16" r="4"/><path d="m5 16 5-9 5 9H5m5-9 9 9m-8-9h5l-2-4h-3"/>',
    dumbbell:'<path d="m6 6 12 12M3 8l5-5m8 18 5-5M2 5l3-3m14 20 3-3M4 10l6-6m4 16 6-6"/>',
    focus:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    play:'<path d="m8 4 12 8-12 8Z"/>',
    pause:'<path d="M8 4v16M16 4v16"/>',
    sprout:'<path d="M12 22V11m0 5C4 17 2 13 3 8c6 0 9 3 9 8Zm0-5c0-7 4-10 10-9 0 6-4 10-10 9Z"/>'
  };
  const icon=(name)=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.activity}</svg>`;
  const KEY='bodylens-user-v1', RESTORE_KEY='bodylens-restore-v1';
  const defaultState=()=>({age:'',sex:'unspecified',mode:'single',choices:[{id:'smoke',scenario:0,duration:'1 个月'}],applied:{demo:true,age:'',sex:'unspecified',mode:'single',choices:[{id:'smoke',scenario:0,duration:'1 个月'}]},tasks:[],prefs:{motion:true,depth:true},organ:'lungs',view:'front',zoom:'torso',system:'all'});
  let state=defaultState(), storageAvailable=true, storageError='', detailTab='impact',page='today',libraryCategory='全部',hoverOrgan=null,pathTimer=null,pathStep=0,pendingRestore=null,toastTimer=null,editingTask=null;
  try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed.schemaVersion!==1)throw new Error('本地数据版本不兼容');state=M.validateState(parsed.data);}}
  catch(error){storageError=error.message;storageAvailable=false;}
  const behavior=id=>D.behaviors.find(b=>b.id===id);
  const appliedChoices=()=>state.applied?.choices||[];
  const dirty=()=>!state.applied||state.applied.demo||JSON.stringify({age:state.age,sex:state.sex,mode:state.mode,choices:state.choices})!==JSON.stringify({age:state.applied.age,sex:state.applied.sex,mode:state.applied.mode,choices:state.applied.choices});
  const dayTasks=()=>state.tasks.filter(t=>t.date===M.localDate());
  function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
  function feedback(message,choices=[]){const el=$('#input-feedback');el.hidden=false;el.innerHTML=`<span>${escape(message)}</span>${choices.map(id=>`<button type="button" data-choose="${id}">${escape(behavior(id).name)}</button>`).join('')}`;}
  function save(){
    if(!storageAvailable){$('#save-state').textContent='未保存';return false;}
    try{const stored=structuredClone(state);if(!M.validAge(stored.age))stored.age='';localStorage.setItem(KEY,JSON.stringify({schemaVersion:1,dataVersion:D.version,data:stored}));$('#save-state').textContent='已保存在本机';return true;}
    catch(error){storageAvailable=false;storageError=error.message;$('#save-state').textContent='保存失败';toast('本地保存失败，请及时导出备份。当前操作仍可继续。');return false;}
  }
  function renderInput(){
    $('#age').value=state.age;$('#sex').value=state.sex;
    $('#quick-behaviors').innerHTML=['smoke','short-sleep','sit','sugary','walk','alcohol'].map(id=>{const b=behavior(id);return `<button class="behavior-chip" data-choose="${id}" aria-pressed="${state.choices.some(c=>c.id===id)}">${icon(b.icon)}<span>${b.name}</span></button>`;}).join('');
    $$('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.mode===state.mode));
    $('#selected-behaviors').innerHTML=state.choices.length?state.choices.map(c=>{const b=behavior(c.id);return `<div class="scenario-card"><div class="scenario-header">${icon(b.icon)}<span>${b.name}</span><button data-remove="${c.id}" aria-label="移除${b.name}">×</button></div><label>数量 / 频率<select data-scenario="${c.id}" aria-label="${b.name}数量或频率">${b.scenarios.map((s,i)=>`<option value="${i}" ${c.scenario===i?'selected':''}>${s}</option>`).join('')}</select></label><label>持续时间<select data-duration="${c.id}" aria-label="${b.name}持续时间">${b.durations.map(t=>`<option ${t===c.duration?'selected':''}>${t}</option>`).join('')}</select></label></div>`;}).join(''):'<p class="empty-state">选择一个行为，为身体探索设定情境。</p>';
    updateDirty();
  }
  function updateDirty(){
    const el=$('#dirty-note');el.classList.toggle('dirty',dirty()&&!state.applied?.demo);
    el.textContent=state.applied?.demo?'当前为吸烟示例。填写年龄后，按你的情境查看。':dirty()?'情境已修改，等待更新；右侧仍为上次结果。':'已更新 · 研究数字不会按支数或天数自动换算。';
    renderContext();
  }
  function addBehavior(id){
    if(!behavior(id))return;
    if(state.choices.some(c=>c.id===id)){toast('这个行为已在当前情境中。');return;}
    const c={id,scenario:0,duration:'1 个月'};
    state.choices=state.mode==='single'?[c]:[...state.choices,c];
    $('#input-feedback').hidden=true;renderInput();save();
  }
  function addFromSearch(event){
    event.preventDefault();const value=$('#behavior-input').value.trim();if(!value)return;
    const r=M.matchInput(value);
    if(state.mode==='single'&&r.matched.length>1){feedback('输入了多个行为，请切换“综合”后添加。');return;}
    for(const id of r.matched){if(!state.choices.some(c=>c.id===id)){const c={id,scenario:0,duration:'1 个月'};state.choices=state.mode==='single'?[c]:[...state.choices,c];}}
    const messages=[];
    if(r.matched.length)messages.push(`已添加：${r.matched.map(id=>behavior(id).name).join('、')}`);
    if(r.unknown.length)messages.push(`暂不支持：${r.unknown.join('、')}。请从资料库选择已收录行为。`);
    if(r.ambiguous.length)messages.push('晚睡不一定等于睡不够。你想了解哪一种情境？');
    feedback(messages.join(' '),r.ambiguous.length?['short-sleep','irregular-sleep']:[]);
    if(r.matched.length&&!r.unknown.length&&!r.ambiguous.length)$('#behavior-input').value='';
    renderInput();save();
  }
  function renderContext(){
    const a=state.applied, el=$('#result-context');
    if(!a){el.innerHTML='<div class="context-strip">选择行为后查看身体影响</div>';return;}
    const demo=a.demo;
    const first=a.choices[0],name=first?behavior(first.id)?.name:'尚未选择';
    el.innerHTML=`<div class="context-strip ${demo?'demo':dirty()?'dirty':''}">${demo?'示例情境 · 未使用个人信息':dirty()?'情境已修改 · 下方仍为上次结果':`${escape(a.age)} 岁 · ${a.sex==='male'?'男性':a.sex==='female'?'女性':'未提供性别'} · 一般成年人参考`}</div><p class="context-description">${a.choices.length>1?`综合查看 ${a.choices.length} 项行为 · 分别呈现，不做抵消`:`${escape(name)}${first?' · '+escape(behavior(first.id).scenarios[first.scenario])+' · '+escape(first.duration):''}`}</p>`;
  }
  function resetPath(){clearInterval(pathTimer);pathTimer=null;pathStep=0;const group=$('.impact-animation');if(group)group.setAttribute('display','none');$$('.path-active').forEach(el=>el.classList.remove('path-active'));$('#path-caption').textContent='移动到器官探索，点击后查看影响';}
  function activateOrgan(id){
    if(!D.organs[id])return;
    resetPath();state.organ=id;state.system='all';state.view=D.organs[id].view;hoverOrgan=null;$('#organ-tooltip').hidden=true;
    renderAnatomy();renderDetail();save();
  }
  function visibleOrgan(id){
    const o=D.organs[id];if(state.system!=='all'&&o.system!==state.system)return false;
    if(state.view==='back')return ['brain','lungs','kidneys','spine'].includes(id);
    if(id==='spine')return false;
    if(id==='kidneys'&&state.system!=='urinary')return false;
    return true;
  }
  function renderAnatomy(){
    const svg=$('.human');if(!svg)return;
    const full=state.zoom==='full';svg.setAttribute('viewBox',full?'45 5 310 655':'65 8 270 415');
    svg.setAttribute('aria-label',`${state.view==='front'?'正面':'背面'}解剖示意，使用下方器官按钮可查看详情`);
    const effects=M.effectsFor(appliedChoices());
    $$('.organ',svg).forEach(el=>{
      const id=el.dataset.organ;const allowed=visibleOrgan(id);el.style.display=allowed?'':'none';
      el.classList.toggle('selected',id===state.organ);el.classList.toggle('no-impact',!effects.some(e=>e.organ===id));
      el.classList.toggle('filtered',!allowed);
    });
    $('.posterior-structures',svg).setAttribute('display',state.view==='back'?'':'none');
    $('.face-contours',svg).style.display=state.view==='back'?'none':'';
    const cavity=$('path[stroke="#bea28b"]',svg);if(cavity)cavity.style.opacity=state.view==='back'?'.5':'1';
    $$('[data-view]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.view===state.view));
    $$('[data-zoom]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.zoom===state.zoom));
    $('#system').value=state.system;
    $('#stage-state').textContent=state.applied?.demo?'人体探索 / 示例情境':state.applied?'人体探索 / 行为影响':'人体探索 / 自由浏览';
    $('#view-caption').textContent=`${state.view==='front'?'正面解剖示意':'背面分层示意'} · 非个人检测`;
    const labels=full?[
      ['brain',14,8,false],['lungs',10,29,false],['heart',76,31,true],['liver',8,40,false],['stomach',75,45,true],['gut',11,54,false],['kidneys',77,47,true],['spine',76,35,true]
    ]:[
      ['brain',12,10,false],['lungs',7,44,false],['heart',76,51,true],['liver',6,63,false],['stomach',76,71,true],['gut',9,84,false],['kidneys',73,74,true],['spine',75,50,true]
    ];
    $('#organ-labels').innerHTML=labels.filter(([id])=>visibleOrgan(id)).map(([id,x,y,right])=>`<button class="organ-label ${right?'right':''}" style="left:${x}%;top:${y}%" data-organ-button="${id}" aria-pressed="${id===state.organ}"><span class="indicator ${M.statusFor(appliedChoices(),id)}"></span>${D.organs[id].name}</button>`).join('');
    $('#organ-picker').innerHTML=Object.entries(D.organs).map(([id,o])=>`<button data-organ-button="${id}" data-status="${M.statusFor(appliedChoices(),id)}" aria-pressed="${id===state.organ}">${o.name}${o.view==='back'?' ↶':''}</button>`).join('');
  }
  function renderMetric(metric){
    const ratio=metric.ratio;
    const referenceLabel=metric.range?`约 ${metric.range[0]}–${metric.range[1]} 倍`:`约 ${ratio} 倍`;
    return `<div class="metric-card"><div class="metric-overline"><span>长期人群参考 · 非个人预测</span><span>${D.sources[metric.source].org.split(' ').pop()}</span></div><div class="metric-value">${metric.value}<small>${metric.unit}</small></div><div class="metric-title">${metric.title}</div><div class="metric-bars" role="img" aria-label="${escape(metric.baseline)}为 1 倍，${escape(metric.exposed)}${referenceLabel}"><div><div class="bar-label"><span>${metric.baseline}</span><span>1 倍</span></div><div class="bar-track"><span style="width:${100/ratio}%"></span></div></div><div><div class="bar-label"><span>${metric.exposed}</span><span>${referenceLabel}</span></div><div class="bar-track exposed"><span style="width:100%"></span></div></div></div><p class="metric-scope">${metric.population}</p><p class="metric-limit">${metric.limit}</p><button class="source-link" data-show-evidence>查看研究范围与原文 ↗</button></div>`;
  }
  function pathHTML(){
    if(!appliedChoices().some(c=>c.id==='smoke')||state.organ!=='lungs')return '';
    return `<div class="effect-path"><div class="path-item"><b>接触时 / 烟雾进入呼吸道</b>有害物质随吸入的烟雾进入呼吸系统。</div><div class="path-item"><b>持续暴露 / 损害逐步累积</b>可能损伤气道与肺组织，长期影响呼吸功能。</div><div class="path-item"><b>长期 / 疾病风险上升</b>吸烟可导致慢阻肺及肺癌，发生时间与程度因人而异。</div></div><button class="path-play" id="play-path">${icon('play')}观看影响路径</button><p class="form-note">路径为机制示意；时间与光效不代表你的损伤进度。</p>`;
  }
  function renderDetail(){
    const id=state.organ,o=D.organs[id],effects=M.effectsFor(appliedChoices(),id);
    $('#detail-heading').innerHTML=`<div class="organ-heading"><span class="organ-index">${String(Object.keys(D.organs).indexOf(id)+1).padStart(2,'0')}</span><h2>${o.name}<span class="organ-en">${o.en}</span></h2></div><p class="organ-function">${o.function}</p>`;
    renderContext();
    $$('[data-detail]').forEach(el=>{el.setAttribute('aria-selected',el.dataset.detail===detailTab);el.tabIndex=el.dataset.detail===detailTab?0:-1;});
    $('#detail-content').setAttribute('aria-label',detailTab==='impact'?'身体影响':detailTab==='evidence'?'证据与来源':'可以怎么做');
    if(!effects.length){$('#detail-content').innerHTML=`<div class="empty-state">${icon('info')}<h3>当前未收录对应结论</h3><p>${state.applied?'所选行为与这个器官的对应资料尚未收录。这不代表没有影响或对该器官无害。':'先选择行为并查看身体影响，也可以继续自由探索器官。'}</p></div>`;return;}
    if(detailTab==='impact'){
      $('#detail-content').innerHTML=effects.map(e=>`<article class="impact-card"><span class="impact-tag ${e.type}">${e.type==='harm'?'不利影响':'有益作用'} · ${e.behavior.name}</span><h3>${e.title}</h3><p>${e.text}</p>${D.metrics[`${e.behavior.id}:${id}`]?renderMetric(D.metrics[`${e.behavior.id}:${id}`]):`<button class="source-link" data-show-evidence>依据：${D.sources[e.source].org} ↗</button>`}</article>`).join('')+pathHTML()+(new Set(effects.map(e=>e.type)).size>1?'<div class="note-box">这里同时有不利影响与有益作用。它们分别有依据，不相互抵消，也不合成为“净健康分”。</div>':'')+`<button class="quiet-button" data-show-action style="margin-top:20px">从一个小行动开始 ↗</button>`;
    }else if(detailTab==='evidence'){
      const sourceIds=[...new Set(effects.map(e=>e.source).concat(effects.map(e=>D.metrics[`${e.behavior.id}:${id}`]?.source).filter(Boolean)))];
      $('#detail-content').innerHTML=`<div class="note-box" style="margin:0 0 20px">你设定的情境是输入描述。下列资料未按你的年龄、支数或天数拟合；没有完全匹配的数据时，展示一般结论与研究参考。</div>`+sourceIds.map(key=>{const s=D.sources[key];return `<article class="evidence-item"><div class="eyebrow">${s.org}</div><h3>${s.title}</h3><p>${s.year} · ${s.scope}</p><p class="evidence-status">已核对公开原文 · ${D.retrieved} · 尚未经临床审校</p><a class="source-link" href="${s.url}" target="_blank" rel="noopener noreferrer">打开原文 ↗</a></article>`;}).join('')+(id==='lungs'?`<figure class="teaching-image"><img src="assets/respiratory-original.jpg" alt="OpenStax 呼吸系统教学图，显示气管、支气管、双肺及膈肌" loading="lazy"><figcaption>教学补充：OpenStax《Anatomy and Physiology》第一版，CC BY 4.0。原图为正常结构示意，不表示你的身体状况。<a class="source-link" href="https://openstax.org/books/anatomy-and-physiology/pages/22-1-organs-and-structures-of-the-respiratory-system" target="_blank" rel="noopener noreferrer">图像出处 ↗</a></figcaption></figure>`:['gut','stomach','liver'].includes(id)?`<figure class="teaching-image"><img src="assets/digestive-original.jpg" alt="OpenStax 消化系统教学图，显示肝、胃及肠道等器官" loading="lazy"><figcaption>OpenStax《Anatomy and Physiology》第一版，CC BY 4.0。正常解剖教学图。<a class="source-link" href="https://openstax.org/books/anatomy-and-physiology/pages/23-1-overview-of-the-digestive-system" target="_blank" rel="noopener noreferrer">图像出处 ↗</a></figcaption></figure>`:'');
    }else{
      const unique=[...new Map(effects.map(e=>[e.behavior.id,e.behavior])).values()];
      $('#detail-content').innerHTML=unique.map(b=>`<article class="action-card"><div class="eyebrow">${b.name} / 一个可选行动</div><h3>${b.action}</h3><p>根据当前行为资料整理，你可以调整成自己今天能做到的版本。</p><button class="quiet-button" data-add-plan="${b.id}">加入今日计划 ＋</button></article>`).join('')+'<p class="form-note">勾选完成只记录行动，不代表身体已恢复。症状持续或明显不适时，寻求专业医疗帮助。</p>';
    }
  }
  function analyze(){
    if(!M.validAge(state.age)){$('#age').setAttribute('aria-invalid','true');$('#age').focus();feedback('请填写 18–120 岁之间的整数年龄。第一版面向成年人。');return;}
    $('#age').removeAttribute('aria-invalid');
    if(!state.choices.length){feedback('先添加一个已收录行为，再查看身体影响。');$('#behavior-input').focus();return;}
    resetPath();state.applied={demo:false,age:state.age,sex:state.sex,mode:state.mode,choices:structuredClone(state.choices)};
    const related=M.effectsFor(appliedChoices());if(!related.some(e=>e.organ===state.organ))state.organ=related[0].organ;
    state.view=D.organs[state.organ].view;state.system='all';detailTab='impact';$('#input-feedback').hidden=true;
    updateDirty();renderAnatomy();renderDetail();save();
    if(matchMedia('(max-width:650px)').matches)$('.body-stage').scrollIntoView({behavior:state.prefs.motion?'smooth':'instant',block:'start'});
  }
  function hover(id){
    if(!D.organs[id])return;hoverOrgan=id;
    $$('.organ').forEach(el=>el.classList.toggle('hovered',el.dataset.organ===id));
    const effects=M.effectsFor(appliedChoices(),id);$('#organ-tooltip').textContent=D.organs[id].name+' · '+(effects[0]?effects[0].title:'当前未收录对应影响');$('#organ-tooltip').hidden=false;
  }
  function renderLibrary(){
    $('#library-filters').innerHTML=['全部',...D.categories].map(c=>`<button data-category="${c}" aria-pressed="${c===libraryCategory}">${c}</button>`).join('');
    const term=$('#library-search').value.trim();const items=D.behaviors.filter(b=>(libraryCategory==='全部'||b.category===libraryCategory)&&(!term||[b.name,...b.aliases].some(s=>s.includes(term))));
    $('#library-count').textContent=`已收录 ${D.behaviors.length} 项行为 · 当前显示 ${items.length} 项 · 公开原文核对 ${D.retrieved}`;
    $('#library-grid').innerHTML=items.length?items.map(b=>`<article class="library-card panel"><span class="category-name">${b.category}</span><h2>${b.name}</h2><p>${b.effects[0].title}</p><div class="organ-tags">${[...new Set(b.effects.map(e=>e.organ))].map(id=>`<span>${D.organs[id].name}</span>`).join('')}</div><button class="quiet-button" data-explore-behavior="${b.id}">${state.mode==='combined'?'添加到综合情境':'查看身体影响'} ↗</button><span class="evidence-status">依据：${D.sources[b.effects[0].source].org}</span></article>`).join(''):'<p class="empty-state">暂未收录匹配的行为，请更换关键词或浏览分类。</p>';
  }
  function renderSummary(){
    const tasks=dayTasks(),done=tasks.filter(t=>t.done).length;$('#nav-plan-count').textContent=tasks.length?tasks.length:'';
    $('#plan-summary').textContent=tasks.length?`今天 ${done} / ${tasks.length} 项已完成${tasks.find(t=>!t.done)?' · '+tasks.find(t=>!t.done).title:''}`:'还没有计划，去添加一个小行动';
  }
  function renderPlan(){
    const today=M.localDate(),tasks=dayTasks();renderSummary();
    $('#plan-date').textContent=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date())+' · 按设备本地日期记录';
    $('#plan-progress').textContent=`${tasks.filter(t=>t.done).length} / ${tasks.length} 项完成`;
    $('#plan-list').innerHTML=tasks.length?tasks.map(t=>`<div class="plan-task ${t.done?'done':''}"><input type="checkbox" data-task-toggle="${escape(t.id)}" aria-label="完成计划：${escape(t.title)}" ${t.done?'checked':''}><div class="task-content">${editingTask===t.id?`<form class="task-edit-form" data-edit-form="${escape(t.id)}"><label>计划标题<input name="title" value="${escape(t.title)}" maxlength="120" required></label><label>备注<input name="note" value="${escape(t.note)}" maxlength="500"></label><button type="submit">保存</button><button type="button" data-cancel-edit>取消</button></form>`:`<div class="task-title">${escape(t.title)}</div>${t.note?`<p>${escape(t.note)}</p>`:''}${t.behavior?behavior(t.behavior)?`<button data-explore-behavior="${escape(t.behavior)}">关联行为：${behavior(t.behavior).name} ↗</button>`:'<p>原关联资料暂不可用，保留为普通任务</p>':'<p>自定义计划 · 不自动生成身体影响</p>'}`}</div><div class="task-actions"><button data-edit-task="${escape(t.id)}">编辑</button><button data-delete-task="${escape(t.id)}" aria-label="删除计划：${escape(t.title)}">删除</button></div></div>`).join(''):'<div class="empty-state"><h3>今天，从一件小事开始。</h3><p>可以自己写一条，也可以从器官详情中的“可以怎么做”添加。</p></div>';
    $('#past-plan-list').innerHTML=state.tasks.filter(t=>t.date!==today).sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`<div class="past-task">${escape(t.date)} · ${t.done?'已完成':'未完成'}<br>${escape(t.title)}</div>`).join('')||'还没有以前的计划。';
  }
  function addPlan(title,associated=null){
    if(!title.trim())return;const now=new Date().toISOString(),date=M.localDate();
    if(associated&&state.tasks.some(t=>t.date===date&&t.behavior===associated)){toast('这个行为的建议已在今日计划中，可以直接编辑它。');return;}
    state.tasks.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2),title:title.trim().slice(0,120),note:'',done:false,date,behavior:associated,createdAt:now,updatedAt:now});save();renderPlan();toast('已加入今日计划，今天先试这一小步。');
  }
  function applyPrefs(){
    document.body.classList.toggle('no-motion',!state.prefs.motion);document.body.classList.toggle('no-depth',!state.prefs.depth);
    $('#motion-setting').checked=state.prefs.motion;$('#depth-setting').checked=state.prefs.depth;
    $('#motion-toggle').innerHTML=icon(state.prefs.motion?'pause':'play');$('#motion-toggle').setAttribute('aria-label',state.prefs.motion?'关闭动态效果':'开启动画效果');$('#motion-toggle').setAttribute('aria-pressed',String(state.prefs.motion));
    if(!state.prefs.motion)resetPath();
  }
  function renderSettings(){
    $('#storage-info').textContent=storageAvailable?'已保存在当前浏览器。更换浏览器、地址或清除站点数据后，这些记录可能无法访问。':`当前未能保存到浏览器（${storageError||'存储不可用'}）。请导出备份保留本次记录。`;
    $('#data-version').textContent=`应用 ${D.appVersion} · 资料 ${D.version} · 已收录 ${D.behaviors.length} 项行为、${Object.keys(D.sources).length} 个来源。`;
    $('#asset-credits').innerHTML=D.assetCredits.map(a=>`<div class="credit">${a.title} · ${a.author}<small>${a.license}</small>${a.url?`<a href="${a.url}" target="_blank" rel="noopener noreferrer">查看出处 ↗</a>`:''}</div>`).join('');
    try{$('#undo-restore').hidden=!localStorage.getItem(RESTORE_KEY);}catch{$('#undo-restore').hidden=true;}
    applyPrefs();
  }
  function navigate(){
    page=['today','explore','library','plan','settings'].includes(location.hash.slice(1))?location.hash.slice(1):'today';
    $$('.page').forEach(el=>el.hidden=el.id!==`page-${page}`);$$('[data-nav]').forEach(el=>{el.classList.toggle('active',el.dataset.nav===page);if(el.dataset.nav===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    $('#settings-link').setAttribute('aria-current',page==='settings'?'page':'false');
    if(page==='library')renderLibrary();if(page==='plan')renderPlan();if(page==='settings')renderSettings();
    resetPath();window.scrollTo({top:0,behavior:'instant'});
  }
  function makeBackup(){const data=structuredClone(state);if(!M.validAge(data.age))data.age='';return {app:'bodylens',schemaVersion:1,appVersion:D.appVersion,dataVersion:D.version,exportedAt:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'local',data};}
  function exportBackup(){
    const blob=new Blob([JSON.stringify(makeBackup(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`bodylens-backup-${M.localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('备份已生成，包含明文生活记录，请妥善保存。');
  }
  async function readBackup(event){
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try{
      if(file.size>5*1024*1024)throw new Error('备份文件不能超过 5 MB');
      if(!file.name.toLowerCase().endsWith('.json'))throw new Error('请选择 JSON 备份文件');
      const raw=JSON.parse(await file.text()),next=M.parseBackup(raw);
      const unknown=next.tasks.filter(t=>t.behavior&&!behavior(t.behavior)).length;
      const skipped=(raw.data.choices.length-next.choices.length)+(raw.data.applied?.choices.length||0)-(next.applied?.choices.length||0);
      pendingRestore={next,raw};
      $('#restore-summary').textContent=`导出时间：${new Date(raw.exportedAt).toLocaleString('zh-CN')}\n基本信息：${next.age?next.age+' 岁':'未填写年龄'}；计划 ${next.tasks.length} 项（含往日记录）。${unknown?' '+unknown+' 项计划的原关联资料暂不可用，将保留任务。':''}${skipped?' '+skipped+' 个未知行为引用将忽略。':''}${raw.dataVersion!==D.version?' 资料版本不同，将使用网站当前资料重新显示结果。':''}`;
      $('#restore-summary').style.whiteSpace='pre-line';$('#restore-dialog').showModal();
    }catch(error){pendingRestore=null;toast('未恢复：'+(error instanceof SyntaxError?'文件不是有效的 JSON':error.message));}
  }
  function commitRestore(){
    if(!pendingRestore)return;
    try{
      const next=pendingRestore.next,point=JSON.stringify({schemaVersion:1,dataVersion:D.version,data:state});
      localStorage.setItem(RESTORE_KEY,point);
      try{localStorage.setItem(KEY,JSON.stringify({schemaVersion:1,dataVersion:D.version,data:next}));}catch(error){localStorage.setItem(KEY,point);throw error;}
      state=next;storageAvailable=true;storageError='';pendingRestore=null;$('#restore-dialog').close();refreshAll();toast('已恢复。可在数据与设置中撤销本次恢复。');
    }catch(error){toast('恢复未完成，原数据保留；请检查浏览器存储空间。');}
  }
  function undoRestore(){
    try{
      const saved=localStorage.getItem(RESTORE_KEY);if(!saved)return;
      const old=M.validateState(JSON.parse(saved).data);localStorage.setItem(KEY,JSON.stringify({schemaVersion:1,dataVersion:D.version,data:old}));state=old;localStorage.removeItem(RESTORE_KEY);storageAvailable=true;storageError='';refreshAll();toast('已撤销恢复，回到替换前的记录。');
    }catch(error){toast('未能撤销恢复，当前记录保持不变。');}
  }
  function refreshAll(){resetPath();renderInput();renderAnatomy();renderDetail();renderSummary();renderPlan();renderSettings();}
  function playPath(){
    resetPath();if(!state.prefs.motion||matchMedia('(prefers-reduced-motion:reduce)').matches){$('#path-caption').textContent='烟雾进入呼吸道 → 持续暴露损伤组织 → 长期疾病风险上升（机制示意）';return;}
    const group=$('.impact-animation');if(!group||state.view!=='front')return;group.setAttribute('display','');$('.organ[data-organ="lungs"]').classList.add('path-active');
    const captions=['烟雾经过呼吸道进入肺部 · 路径示意','持续暴露可损伤呼吸系统 · 不代表个人损伤进度','长期暴露增加疾病风险 · 具体程度因人而异'];$('#path-caption').textContent=captions[0];
    pathTimer=setInterval(()=>{pathStep++;if(pathStep>=captions.length){resetPath();return;}$('#path-caption').textContent=captions[pathStep];},3000);
  }
  function mount(){
    if(matchMedia('(prefers-reduced-motion:reduce)').matches)state.prefs.motion=false;
    $('#settings-link').innerHTML=icon('settings');$('#search-icon').innerHTML=icon('search');$('#library-search-icon').innerHTML=icon('search');$('#sidebar-info-icon').innerHTML=icon('info');$('#strip-icon').innerHTML=icon('sprout');$('#focus-toggle').innerHTML=icon('focus')+'<span>进入沉浸视图</span>';
    $('#anatomy-art').innerHTML=window.createAnatomy('bodylens-live');
    $('#behavior-form').addEventListener('submit',addFromSearch);$('#analyze').addEventListener('click',analyze);
    $('#age').addEventListener('input',event=>{state.age=event.target.value;updateDirty();save();});
    $('#sex').addEventListener('change',event=>{state.sex=event.target.value;updateDirty();save();});
    $('#system').addEventListener('change',event=>{resetPath();state.system=event.target.value;if(['urinary','musculoskeletal'].includes(state.system))state.view='back';else if(state.system!=='all')state.view='front';const candidates=Object.entries(D.organs).filter(([id])=>visibleOrgan(id));if(!candidates.some(([id])=>id===state.organ)&&candidates[0])state.organ=candidates[0][0];renderAnatomy();renderDetail();save();});
    $('#library-search').addEventListener('input',renderLibrary);
    $('#plan-form').addEventListener('submit',event=>{event.preventDefault();addPlan($('#plan-input').value);$('#plan-input').value='';});
    $('#plan-list').addEventListener('submit',event=>{const form=event.target.closest('[data-edit-form]');if(!form)return;event.preventDefault();const task=state.tasks.find(t=>t.id===form.dataset.editForm);if(!task)return;const data=new FormData(form);task.title=String(data.get('title')).trim().slice(0,120);task.note=String(data.get('note')).slice(0,500);task.updatedAt=new Date().toISOString();editingTask=null;save();renderPlan();});
    $('#plan-list').addEventListener('change',event=>{const id=event.target.dataset.taskToggle;if(!id)return;const task=state.tasks.find(t=>t.id===id);task.done=event.target.checked;task.updatedAt=new Date().toISOString();save();renderPlan();});
    $('#export-backup').addEventListener('click',exportBackup);$('#export-before-restore').addEventListener('click',exportBackup);$('#import-backup').addEventListener('change',readBackup);$('#confirm-restore').addEventListener('click',commitRestore);$('#undo-restore').addEventListener('click',undoRestore);
    $('#restore-dialog').addEventListener('close',()=>{pendingRestore=null;});
    $('#motion-setting').addEventListener('change',event=>{state.prefs.motion=event.target.checked;applyPrefs();save();});$('#depth-setting').addEventListener('change',event=>{state.prefs.depth=event.target.checked;applyPrefs();save();});
    $('#motion-toggle').addEventListener('click',()=>{state.prefs.motion=!state.prefs.motion;applyPrefs();save();});
    $('#focus-toggle').addEventListener('click',()=>{const on=!document.body.classList.contains('focused');document.body.classList.toggle('focused',on);$('#focus-toggle').setAttribute('aria-pressed',String(on));$('#focus-toggle').innerHTML=icon('focus')+`<span>${on?'退出沉浸视图':'进入沉浸视图'}</span>`;});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('focused'))$('#focus-toggle').click();});
    $('.detail-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=$$('[data-detail]');let index=tabs.indexOf(document.activeElement);if(index<0)return;event.preventDefault();index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[index].click();tabs[index].focus();});
    document.addEventListener('click',event=>{
      const el=event.target.closest('button');if(!el)return;
      if(el.dataset.choose)addBehavior(el.dataset.choose);
      if(el.dataset.remove){state.choices=state.choices.filter(c=>c.id!==el.dataset.remove);renderInput();save();}
      if(el.dataset.mode){state.mode=el.dataset.mode;if(state.mode==='single')state.choices=state.choices.slice(0,1);renderInput();save();}
      if(el.dataset.organButton)activateOrgan(el.dataset.organButton);
      if(el.dataset.view){resetPath();state.view=el.dataset.view;state.system='all';if(!visibleOrgan(state.organ))state.organ=state.view==='back'?'kidneys':'lungs';renderAnatomy();renderDetail();save();}
      if(el.dataset.zoom){state.zoom=el.dataset.zoom;renderAnatomy();save();}
      if(el.dataset.detail){resetPath();detailTab=el.dataset.detail;renderDetail();}
      if(el.hasAttribute('data-show-evidence')){detailTab='evidence';renderDetail();}
      if(el.hasAttribute('data-show-action')){detailTab='action';renderDetail();}
      if(el.dataset.addPlan){const b=behavior(el.dataset.addPlan);addPlan(b.action,b.id);}
      if(el.dataset.category){libraryCategory=el.dataset.category;renderLibrary();}
      if(el.dataset.exploreBehavior){addBehavior(el.dataset.exploreBehavior);location.hash='explore';toast('行为已带入情境，填写或检查基本信息后查看影响。');}
      if(el.dataset.deleteTask){state.tasks=state.tasks.filter(t=>t.id!==el.dataset.deleteTask);save();renderPlan();}
      if(el.dataset.editTask){editingTask=el.dataset.editTask;renderPlan();$('.task-edit-form input')?.focus();}
      if(el.hasAttribute('data-cancel-edit')){editingTask=null;renderPlan();}
      if(el.id==='play-path')playPath();
    });
    $('#selected-behaviors').addEventListener('change',event=>{const id=event.target.dataset.scenario||event.target.dataset.duration;const choice=state.choices.find(c=>c.id===id);if(!choice)return;if(event.target.dataset.scenario)choice.scenario=Number(event.target.value);else choice.duration=event.target.value;updateDirty();save();});
    $('#anatomy-art').addEventListener('pointerover',event=>{const organ=event.target.closest('.organ');if(organ)hover(organ.dataset.organ);});
    $('#organ-labels').addEventListener('pointerover',event=>{const organ=event.target.closest('[data-organ-button]');if(organ)hover(organ.dataset.organButton);});
    $('#anatomy-scene').addEventListener('pointerleave',()=>{hoverOrgan=null;$$('.organ.hovered').forEach(el=>el.classList.remove('hovered'));$('#organ-tooltip').hidden=true;$('.app-shell').style.setProperty('--art-x','0px');$('.app-shell').style.setProperty('--art-y','0px');});
    $('#anatomy-art').addEventListener('click',event=>{const organ=event.target.closest('.organ');if(organ)activateOrgan(organ.dataset.organ);});
    $('#anatomy-scene').addEventListener('pointermove',event=>{if(!state.prefs.depth||!state.prefs.motion||event.pointerType==='touch'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;const r=event.currentTarget.getBoundingClientRect(),x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;$('.app-shell').style.setProperty('--art-x',x*3+'px');$('.app-shell').style.setProperty('--art-y',y*2+'px');$('.app-shell').style.setProperty('--grid-x',-x*6+'px');$('.app-shell').style.setProperty('--grid-y',-y*4+'px');});
    window.addEventListener('hashchange',navigate);let previousDate=M.localDate();setInterval(()=>{if(M.localDate()!==previousDate){previousDate=M.localDate();renderSummary();if(page==='plan')renderPlan();}},15000);
    refreshAll();navigate();if(storageError){$('#save-state').textContent='未保存';toast('本地数据无法读取，已保留原记录。可继续体验或在设置中导出当前记录。');}
  }
  mount();
})();
