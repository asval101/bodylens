/* 页面装配与交互
 *
 * 合并后只有一页「今天」：左边是账本，右边是身体。
 * 身体的详情区不再有一份独立的数据源 —— 它读的就是今天记下的那几笔。
 * 唯一的数据入口是 appliedChoices()，所以改数据源只需要改那一个函数。
 */
(function(){
  'use strict';
  const D=window.BodyLensData,M=window.BodyLensDomain,W=window.BodyLensWeights;
  const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
  const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons={
    settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m9 3-.5 2-2 1.2-2-.6L2 10l1.5 1.5v2L2 15l2.5 4.4 2-.6 2 1.2.5 2h6l.5-2 2-1.2 2 .6L22 15l-1.5-1.5v-2L22 10l-2.5-4.4-2 .6-2-1.2L15 3Z"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    play:'<path d="m8 4 12 8-12 8Z"/>',
    pause:'<path d="M8 4v16M16 4v16"/>'
  };
  const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.info}</svg>`;

  /* 资料库的行为 id → 账本的行为 id。
   * 两边是两套命名（资料库为每个行为写了一条证据，账本只收能折算的八项），
   * 这张表是唯一的桥，加新行为时两边都要登记。 */
  const LEDGER_OF={'smoke':'smoke','alcohol':'alcohol','short-sleep':'shortSleep','sit':'sit','tv-sit':'sit','walk':'walk','sugary':'sugar','quit':'quit'};

  const KEY='bodylens-user-v1', RESTORE_KEY='bodylens-restore-v1';
  const defaultState=()=>({tasks:[],prefs:{motion:true,depth:true},organ:'lungs',view:'front'});
  let state=defaultState(),storageAvailable=true,storageError='',detailTab='impact',page='today',libraryCategory='全部',hoverOrgan=null,pathTimer=null,pathStep=0,pendingRestore=null,toastTimer=null,editingTask=null;
  try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed.schemaVersion!==1)throw new Error('本地数据版本不兼容');state=M.validateState(parsed.data);}}
  catch(error){storageError=error.message;storageAvailable=false;}

  const behavior=id=>D.behaviors.find(b=>b.id===id);
  /* 今天的情境。没有账本接口时返回空数组，页面仍然可用（只是没有落点）。 */
  const appliedChoices=()=>{
    const api=window.BodyLensToday;
    return api&&typeof api.scenario==='function'?api.scenario():[];
  };
  const todaySummary=()=>{
    const api=window.BodyLensToday;
    return api&&typeof api.summary==='function'?api.summary():null;
  };
  const dayTasks=()=>state.tasks.filter(t=>t.date===M.localDate());
  function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
  function save(){
    if(!storageAvailable){$('#save-state').textContent='未保存';return false;}
    try{localStorage.setItem(KEY,JSON.stringify({schemaVersion:1,dataVersion:D.version,data:state}));$('#save-state').textContent='已保存在本机';return true;}
    catch(error){storageAvailable=false;storageError=error.message;$('#save-state').textContent='保存失败';toast('本地保存失败，请及时导出备份。当前操作仍可继续。');return false;}
  }

  /* ---------- 身体的详情区 ----------
   * 内容全部由「今天记了什么」推出来：记了烟，肺和心就亮；没记，就说明还没发生。
   * 这里不提供假设推演 —— 假设在左栏的推演卡里，那是另一个尺度的事。 */
  function renderContext(){
    const el=$('#result-context');if(!el)return;
    const s=todaySummary();
    if(!s||(s.counted===0&&s.noted.length===0)){
      el.innerHTML='<div class="context-strip">今天还没有记录</div>';
      return;
    }
    const names=s.byItem.concat(s.noted).map(r=>r.name).join(' · ');
    el.innerHTML=`<div class="context-strip">今天 · ${escape(names)}</div>`;
  }
  function resetPath(){
    clearInterval(pathTimer);pathTimer=null;pathStep=0;
    const group=$('.impact-animation');if(group)group.setAttribute('display','none');
    $$('.path-active').forEach(el=>el.classList.remove('path-active'));
    const cap=$('#path-caption');if(cap)cap.textContent='点一下器官，看它在今天发生了什么';
  }
  function activateOrgan(id){
    if(!D.organs[id])return;
    resetPath();state.organ=id;state.view=D.organs[id].view;hoverOrgan=null;
    const tip=$('#organ-tooltip');if(tip)tip.hidden=true;
    renderAnatomy();renderDetail();save();
  }
  /* 资料库里出现过至少一次的行为关联。器官表里有一条「胃」，但 30 条行为的
   * 影响条目里没有任何一条指向它 —— 它永远只会是「未收录关联」，点开是空的。
   * 画面上不显示它，规则按数据来推：没有关联就不画，将来补了证据自动回来。 */
  const LINKED=new Set();
  for(const b of Object.values(D.behaviors))for(const e of b.effects)LINKED.add(e.organ);
  /* 编号按同一份「有关联的器官」排，正背面一致。
   * 不能拿 D.organs 的下标：胃还在数据里但不显示，编号会从 06 跳到 08。 */
  const IDX=Object.keys(D.organs).filter(id=>LINKED.has(id));

  /* 正面看不到肾和脊柱：它们本来就在后面，硬画在正面只是错。 */
  function visibleOrgan(id){
    if(!LINKED.has(id))return false;
    /* 人体上没画出来的器官（眼睛已删掉）列表里也不出现，
       否则点它人体毫无反应，看着像坏了。 */
    const human=$('.human');
    if(human&&!$(`[data-organ="${id}"]`,human))return false;
    if(state.view==='back')return ['brain','lungs','kidneys','spine'].includes(id);
    return !['spine','kidneys'].includes(id);
  }
  function renderAnatomy(){
    const svg=$('.human');if(!svg)return;
    /* 旧存档里可能选着一个已经画不出来的器官，回退到肺 */
    if(!$(`[data-organ="${state.organ}"]`,svg))state.organ='lungs';
    svg.setAttribute('viewBox','65 8 270 415');
    svg.setAttribute('aria-label',`${state.view==='front'?'正面':'背面'}解剖示意，点击器官查看今天的影响`);
    const effects=M.effectsFor(appliedChoices());
    $$('.organ',svg).forEach(el=>{
      const id=el.dataset.organ,allowed=visibleOrgan(id);
      el.style.display=allowed?'':'none';
      el.classList.toggle('selected',id===state.organ);
      el.classList.toggle('no-impact',!effects.some(e=>e.organ===id));
      el.classList.toggle('filtered',!allowed);
    });
    const posterior=$('.posterior-structures',svg);if(posterior)posterior.setAttribute('display',state.view==='back'?'':'none');
    const face=$('.face-contours',svg);if(face)face.style.display=state.view==='back'?'none':'';
    $$('[data-view]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.view===state.view));
    const s=todaySummary();
    const hasToday=!!(s&&(s.counted>0||s.noted.length));
    $('#stage-state').textContent=hasToday?'今天的身体':'今天的身体 / 还没有记录';
    const caption=$('#view-caption');if(caption)caption.textContent=`${state.view==='front'?'正面解剖示意':'背面分层示意'} · 非个人检测`;
    $('#organ-picker').innerHTML=Object.entries(D.organs).filter(([id])=>visibleOrgan(id)).map(([id,o])=>`<button data-organ-button="${id}" data-status="${M.statusFor(appliedChoices(),id)}" aria-pressed="${id===state.organ}">${o.name}</button>`).join('');
  }
  function renderMetric(metric){
    const ratio=metric.ratio;
    const referenceLabel=metric.range?`约 ${metric.range[0]}–${metric.range[1]} 倍`:`约 ${ratio} 倍`;
    return `<div class="metric-card"><div class="metric-overline"><span>长期人群参考 · 非个人预测</span><span>${D.sources[metric.source].org.split(' ').pop()}</span></div><div class="metric-value">${metric.value}<small>${metric.unit}</small></div><div class="metric-title">${metric.title}</div><div class="metric-bars" role="img" aria-label="${escape(metric.baseline)}为 1 倍，${escape(metric.exposed)}${referenceLabel}"><div><div class="bar-label"><span>${escape(metric.baseline)}</span><span>1 倍</span></div><div class="bar-track"><span style="width:${100/ratio}%"></span></div></div><div><div class="bar-label"><span>${escape(metric.exposed)}</span><span>${referenceLabel}</span></div><div class="bar-track exposed"><span style="width:100%"></span></div></div></div><p class="metric-scope">${metric.population}</p><p class="metric-limit">${metric.limit}</p><button class="source-link" data-show-evidence>查看研究范围与原文 ↗</button></div>`;
  }
  function pathHTML(){
    if(!appliedChoices().some(c=>c.id==='smoke')||state.organ!=='lungs')return '';
    return `<div class="effect-path"><div class="path-item"><b>接触时 / 烟雾进入呼吸道</b>有害物质随吸入的烟雾进入呼吸系统。</div><div class="path-item"><b>持续暴露 / 损害逐步累积</b>可能损伤气道与肺组织，长期影响呼吸功能。</div><div class="path-item"><b>长期 / 疾病风险上升</b>吸烟可导致慢阻肺及肺癌，发生时间与程度因人而异。</div></div><button class="path-play" id="play-path">${icon('play')}观看影响路径</button><p class="form-note">路径为机制示意；时间与光效不代表你的损伤进度。</p>`;
  }
  function renderDetail(){
    const id=state.organ,o=D.organs[id],effects=M.effectsFor(appliedChoices(),id);
    const s=todaySummary(),hasToday=!!(s&&(s.counted>0||s.noted.length));
    $('#detail-heading').innerHTML=`<div class="organ-heading"><span class="organ-index">${String(IDX.indexOf(id)+1).padStart(2,'0')}</span><h2>${o.name}<span class="organ-en">${o.en}</span></h2></div><p class="organ-function">${o.function}</p>`;
    renderContext();
    $$('[data-detail]').forEach(el=>{el.setAttribute('aria-selected',el.dataset.detail===detailTab);el.tabIndex=el.dataset.detail===detailTab?0:-1;});
    $('#detail-content').setAttribute('aria-label',detailTab==='impact'?'身体影响':detailTab==='evidence'?'证据与来源':'可以怎么做');
    if(!effects.length){
      $('#detail-content').innerHTML=`<div class="empty-state">${icon('info')}<h3>今天这里还没有对应的事</h3><p>${hasToday?'今天的记录里没有影响这个器官的行为。这不代表它一定没事 —— 只是账本里没有这笔。':'先在左边记一笔，这里就会说明它落在身体的哪一部分。'}</p></div>`;
      return;
    }
    if(detailTab==='impact'){
      $('#detail-content').innerHTML=effects.map(e=>`<article class="impact-card"><span class="impact-tag ${e.type}">${e.type==='harm'?'不利影响':'有益作用'} · ${e.behavior.name}</span><h3>${e.title}</h3><p>${e.text}</p>${D.metrics[`${e.behavior.id}:${id}`]?renderMetric(D.metrics[`${e.behavior.id}:${id}`]):`<button class="source-link" data-show-evidence>依据：${D.sources[e.source].org} ↗</button>`}</article>`).join('')+pathHTML()+(new Set(effects.map(e=>e.type)).size>1?'<div class="note-box">这里同时有不利影响与有益作用。它们分别有依据，不相互抵消，也不合成为“净健康分”。</div>':'')+`<button class="quiet-button" data-show-action style="margin-top:18px">从一个小行动开始 ↗</button>`;
    }else if(detailTab==='evidence'){
      const sourceIds=[...new Set(effects.map(e=>e.source).concat(effects.map(e=>D.metrics[`${e.behavior.id}:${id}`]?.source).filter(Boolean)))];
      $('#detail-content').innerHTML=`<div class="note-box" style="margin:0 0 16px">这些资料没有按你的支数或天数拟合；账本里的分钟数另有来源。这里呈现的是行为与器官关联的一般结论。</div>`+sourceIds.map(key=>{const src=D.sources[key];return `<article class="evidence-item"><div class="eyebrow">${src.org}</div><h3>${src.title}</h3><p>${src.year} · ${src.scope}</p><p class="evidence-status">已核对公开原文 · ${D.retrieved} · 尚未经临床审校</p><a class="source-link" href="${src.url}" target="_blank" rel="noopener noreferrer">打开原文 ↗</a></article>`;}).join('')+(id==='lungs'?`<figure class="teaching-image"><img src="assets/respiratory-original.jpg" alt="OpenStax 呼吸系统教学图，显示气管、支气管、双肺及膈肌" loading="lazy"><figcaption>教学补充：OpenStax《Anatomy and Physiology》第一版，CC BY 4.0。原图为正常结构示意，不表示你的身体状况。<a class="source-link" href="https://openstax.org/books/anatomy-and-physiology/pages/22-1-organs-and-structures-of-the-respiratory-system" target="_blank" rel="noopener noreferrer">图像出处 ↗</a></figcaption></figure>`:['gut','stomach','liver'].includes(id)?`<figure class="teaching-image"><img src="assets/digestive-original.jpg" alt="OpenStax 消化系统教学图，显示肝、胃及肠道等器官" loading="lazy"><figcaption>OpenStax《Anatomy and Physiology》第一版，CC BY 4.0。正常解剖教学图。<a class="source-link" href="https://openstax.org/books/anatomy-and-physiology/pages/23-1-overview-of-the-digestive-system" target="_blank" rel="noopener noreferrer">图像出处 ↗</a></figcaption></figure>`:'');
    }else{
      const unique=[...new Map(effects.map(e=>[e.behavior.id,e.behavior])).values()];
      $('#detail-content').innerHTML=unique.map(b=>`<article class="action-card"><div class="eyebrow">${b.name} / 一个可选行动</div><h3>${b.action}</h3><p>根据当前行为资料整理，你可以调整成自己今天能做到的版本。</p><button class="quiet-button" data-add-plan="${b.id}">加入今日计划 ＋</button></article>`).join('')+'<p class="form-note">勾选完成只记录行动，不代表身体已恢复。症状持续或明显不适时，寻求专业医疗帮助。</p>';
    }
  }
  function hover(id){
    if(!D.organs[id])return;hoverOrgan=id;
    $$('.organ').forEach(el=>el.classList.toggle('hovered',el.dataset.organ===id));
    const effects=M.effectsFor(appliedChoices(),id);
    const tip=$('#organ-tooltip');
    tip.textContent=D.organs[id].name+' · '+(effects[0]?effects[0].title:'今天没有涉及这里');
    tip.hidden=false;
  }

  /* ---------- 资料库 ---------- */
  function renderLibrary(){
    $('#library-filters').innerHTML=['全部',...D.categories].map(c=>`<button data-category="${c}" aria-pressed="${c===libraryCategory}">${c}</button>`).join('');
    const term=$('#library-search').value.trim();
    const items=D.behaviors.filter(b=>(libraryCategory==='全部'||b.category===libraryCategory)&&(!term||[b.name,...b.aliases].some(s=>s.includes(term))));
    $('#library-count').textContent=`已收录 ${D.behaviors.length} 项行为 · 当前显示 ${items.length} 项 · 公开原文核对 ${D.retrieved}`;
    $('#library-grid').innerHTML=items.length?items.map(b=>{
      const ledgerId=LEDGER_OF[b.id];
      return `<article class="library-card panel"><span class="category-name">${b.category}</span><h2>${b.name}</h2><p>${b.effects[0].title}</p><div class="organ-tags">${[...new Set(b.effects.map(e=>e.organ))].map(id=>`<span>${D.organs[id].name}</span>`).join('')}</div><span class="evidence-status">依据：${D.sources[b.effects[0].source].org}</span>${ledgerId?`<button class="quiet-button" data-log-behavior="${ledgerId}">记一笔 ＋</button>`:''}</article>`;
    }).join(''):'<p class="empty-state">暂未收录匹配的行为，请更换关键词或浏览分类。</p>';
  }

  /* ---------- 计划 ---------- */
  function renderSummary(){
    const tasks=dayTasks(),done=tasks.filter(t=>t.done).length;
    $('#nav-plan-count').textContent=tasks.length?tasks.length:'';
    if(!tasks.length){$('#plan-summary')&&($('#plan-summary').textContent='还没有计划，去添加一个小行动');return;}
    $('#plan-summary')&&($('#plan-summary').textContent=`今天 ${done} / ${tasks.length} 项已完成`);
  }
  function renderPlan(){
    const today=M.localDate(),tasks=dayTasks();renderSummary();
    $('#plan-date').textContent=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date())+' · 按设备本地日期记录';
    $('#plan-progress').textContent=`${tasks.filter(t=>t.done).length} / ${tasks.length} 项完成`;
    $('#plan-list').innerHTML=tasks.length?tasks.map(t=>`<div class="plan-task ${t.done?'done':''}"><input type="checkbox" data-task-toggle="${escape(t.id)}" aria-label="完成计划：${escape(t.title)}" ${t.done?'checked':''}><div class="task-content">${editingTask===t.id?`<form class="task-edit-form" data-edit-form="${escape(t.id)}"><label>计划标题<input name="title" value="${escape(t.title)}" maxlength="120" required></label><label>备注<input name="note" value="${escape(t.note)}" maxlength="500"></label><button type="submit">保存</button><button type="button" data-cancel-edit>取消</button></form>`:`<div class="task-title">${escape(t.title)}</div>${t.note?`<p>${escape(t.note)}</p>`:''}${t.behavior?(behavior(t.behavior)?`<p class="task-link">关联资料：${behavior(t.behavior).name}</p>`:'<p>原关联资料暂不可用，保留为普通任务</p>'):'<p>自定义计划 · 不自动生成身体影响</p>'}`}</div><div class="task-actions"><button data-edit-task="${escape(t.id)}">编辑</button><button data-delete-task="${escape(t.id)}" aria-label="删除计划：${escape(t.title)}">删除</button></div></div>`).join(''):'<div class="empty-state"><h3>今天，从一件小事开始。</h3><p>可以自己写一条，也可以从器官详情中的“可以怎么做”添加。</p></div>';
    $('#past-plan-list').innerHTML=state.tasks.filter(t=>t.date!==today).sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`<div class="past-task">${escape(t.date)} · ${t.done?'已完成':'未完成'}<br>${escape(t.title)}</div>`).join('')||'还没有以前的计划。';
  }
  function addPlan(title,associated=null){
    if(!title.trim())return;const now=new Date().toISOString(),date=M.localDate();
    if(associated&&state.tasks.some(t=>t.date===date&&t.behavior===associated)){toast('这个行为的建议已在今日计划中，可以直接编辑它。');return;}
    state.tasks.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2),title:title.trim().slice(0,120),note:'',done:false,date,behavior:associated,createdAt:now,updatedAt:now});save();renderPlan();toast('已加入今日计划，今天先试这一小步。');
  }

  /* ---------- 设置与备份 ---------- */
  function applyPrefs(){
    document.body.classList.toggle('no-motion',!state.prefs.motion);document.body.classList.toggle('no-depth',!state.prefs.depth);
    const ms=$('#motion-setting'),ds=$('#depth-setting');
    if(ms)ms.checked=state.prefs.motion;if(ds)ds.checked=state.prefs.depth;
    const mt=$('#motion-toggle');
    if(mt){mt.innerHTML=icon(state.prefs.motion?'pause':'play');mt.setAttribute('aria-label',state.prefs.motion?'关闭动态效果':'开启动画效果');mt.setAttribute('aria-pressed',String(state.prefs.motion));}
    if(!state.prefs.motion)resetPath();
  }
  function renderSettings(){
    $('#storage-info').textContent=storageAvailable?'已保存在当前浏览器。更换浏览器、地址或清除站点数据后，这些记录可能无法访问。':`当前未能保存到浏览器（${storageError||'存储不可用'}）。请导出备份保留本次记录。`;
    $('#data-version').textContent=`应用 ${D.appVersion} · 资料 ${D.version} · 已收录 ${D.behaviors.length} 项行为、${Object.keys(D.sources).length} 个来源。`;
    $('#asset-credits').innerHTML=D.assetCredits.map(a=>`<div class="credit">${a.title} · ${a.author}<small>${a.license}</small>${a.url?`<a href="${a.url}" target="_blank" rel="noopener noreferrer">查看出处 ↗</a>`:''}</div>`).join('');
    try{$('#undo-restore').hidden=!localStorage.getItem(RESTORE_KEY);}catch{$('#undo-restore').hidden=true;}
    applyPrefs();
  }
  function makeBackup(){return{app:'bodylens',schemaVersion:1,appVersion:D.appVersion,dataVersion:D.version,exportedAt:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'local',data:structuredClone(state)};}
  function exportBackup(){
    const blob=new Blob([JSON.stringify(makeBackup(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`bodylens-backup-${M.localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('备份已生成，包含明文记录，请妥善保存。');
  }
  async function readBackup(event){
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try{
      if(file.size>5*1024*1024)throw new Error('备份文件不能超过 5 MB');
      if(!file.name.toLowerCase().endsWith('.json'))throw new Error('请选择 JSON 备份文件');
      const raw=JSON.parse(await file.text()),next=M.parseBackup(raw);
      const unknown=next.tasks.filter(t=>t.behavior&&!behavior(t.behavior)).length;
      pendingRestore={next,raw};
      $('#restore-summary').textContent=`导出时间：${new Date(raw.exportedAt).toLocaleString('zh-CN')}\n计划 ${next.tasks.length} 项（含往日记录）。${unknown?' '+unknown+' 项计划的原关联资料暂不可用，将保留任务。':''}${raw.dataVersion!==D.version?' 资料版本不同，将使用网站当前资料重新显示结果。':''}`;
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
      const old=M.validateState(JSON.parse(saved).data);
      localStorage.setItem(KEY,JSON.stringify({schemaVersion:1,dataVersion:D.version,data:old}));
      state=old;localStorage.removeItem(RESTORE_KEY);storageAvailable=true;storageError='';refreshAll();toast('已撤销恢复，回到替换前的记录。');
    }catch(error){toast('未能撤销恢复，当前记录保持不变。');}
  }

  function navigate(){
    page=['today','library','plan','settings'].includes(location.hash.slice(1))?location.hash.slice(1):'today';
    $$('.page').forEach(el=>el.hidden=el.id!==`page-${page}`);
    $$('[data-nav]').forEach(el=>{el.classList.toggle('active',el.dataset.nav===page);if(el.dataset.nav===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    $('#settings-link').setAttribute('aria-current',page==='settings'?'page':'false');
    if(page==='library')renderLibrary();if(page==='plan')renderPlan();if(page==='settings')renderSettings();
    resetPath();window.scrollTo({top:0,behavior:'instant'});
  }
  function refreshAll(){resetPath();renderAnatomy();renderDetail();renderSummary();renderPlan();renderSettings();}
  function playPath(){
    resetPath();
    const cap=$('#path-caption');
    if(!state.prefs.motion||matchMedia('(prefers-reduced-motion:reduce)').matches){if(cap)cap.textContent='烟雾进入呼吸道 → 持续暴露损伤组织 → 长期疾病风险上升（机制示意）';return;}
    const group=$('.impact-animation');if(!group||state.view!=='front')return;
    group.setAttribute('display','');$('.organ[data-organ="lungs"]').classList.add('path-active');
    const captions=['烟雾经过呼吸道进入肺部 · 路径示意','持续暴露可损伤呼吸系统 · 不代表个人损伤进度','长期暴露增加疾病风险 · 具体程度因人而异'];
    if(cap)cap.textContent=captions[0];
    pathTimer=setInterval(()=>{pathStep++;if(pathStep>=captions.length){resetPath();return;}if(cap)cap.textContent=captions[pathStep];},3000);
  }

  /* 账本变化时由 today.js 调用。autoFocus 只在「从没有记录变成有记录」时传 true，
     免得每次点都抢走用户当前正在看的器官。 */
  window.BodyLensBody={refresh(autoFocus){
    if(autoFocus){
      const effects=M.effectsFor(appliedChoices());
      if(effects.length&&!effects.some(e=>e.organ===state.organ))state.organ=effects[0].organ;
    }
    renderAnatomy();renderDetail();
  }};

  function mount(){
    if(matchMedia('(prefers-reduced-motion:reduce)').matches)state.prefs.motion=false;
    $('#settings-link').innerHTML=icon('settings');$('#library-search-icon').innerHTML=icon('search');
    $('#anatomy-art').innerHTML=window.createAnatomy('bodylens-live');
    $('#library-search').addEventListener('input',renderLibrary);
    $('#plan-form').addEventListener('submit',event=>{event.preventDefault();addPlan($('#plan-input').value);$('#plan-input').value='';});
    $('#plan-list').addEventListener('submit',event=>{const form=event.target.closest('[data-edit-form]');if(!form)return;event.preventDefault();const task=state.tasks.find(t=>t.id===form.dataset.editForm);if(!task)return;const data=new FormData(form);task.title=String(data.get('title')).trim().slice(0,120);task.note=String(data.get('note')).slice(0,500);task.updatedAt=new Date().toISOString();editingTask=null;save();renderPlan();});
    $('#plan-list').addEventListener('change',event=>{const id=event.target.dataset.taskToggle;if(!id)return;const task=state.tasks.find(t=>t.id===id);task.done=event.target.checked;task.updatedAt=new Date().toISOString();save();renderPlan();});
    $('#export-backup').addEventListener('click',exportBackup);$('#export-before-restore').addEventListener('click',exportBackup);$('#import-backup').addEventListener('change',readBackup);$('#confirm-restore').addEventListener('click',commitRestore);$('#undo-restore').addEventListener('click',undoRestore);
    $('#restore-dialog').addEventListener('close',()=>{pendingRestore=null;});
    $('#motion-setting').addEventListener('change',event=>{state.prefs.motion=event.target.checked;applyPrefs();save();});
    $('#depth-setting').addEventListener('change',event=>{state.prefs.depth=event.target.checked;applyPrefs();save();});
    $('#motion-toggle').addEventListener('click',()=>{state.prefs.motion=!state.prefs.motion;applyPrefs();save();});
    $('.detail-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=$$('[data-detail]');let index=tabs.indexOf(document.activeElement);if(index<0)return;event.preventDefault();index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[index].click();tabs[index].focus();});
    document.addEventListener('click',event=>{
      const el=event.target.closest('button');if(!el)return;
      if(el.dataset.organButton)activateOrgan(el.dataset.organButton);
      if(el.dataset.view){resetPath();state.view=el.dataset.view;if(!visibleOrgan(state.organ))state.organ=state.view==='back'?'kidneys':'lungs';renderAnatomy();renderDetail();save();}
      if(el.dataset.detail){resetPath();detailTab=el.dataset.detail;renderDetail();}
      if(el.hasAttribute('data-show-evidence')){detailTab='evidence';renderDetail();}
      if(el.hasAttribute('data-show-action')){detailTab='action';renderDetail();}
      if(el.dataset.addPlan){const b=behavior(el.dataset.addPlan);addPlan(b.action,b.id);}
      if(el.dataset.category){libraryCategory=el.dataset.category;renderLibrary();}
      if(el.dataset.logBehavior){
        location.hash='today';
        const api=window.BodyLensToday;
        if(api&&typeof api.pick==='function')api.pick(el.dataset.logBehavior);
        toast('已选中这项，点数量就记上了。');
      }
      if(el.dataset.deleteTask){state.tasks=state.tasks.filter(t=>t.id!==el.dataset.deleteTask);save();renderPlan();}
      if(el.dataset.editTask){editingTask=el.dataset.editTask;renderPlan();const input=$('.task-edit-form input');if(input)input.focus();}
      if(el.hasAttribute('data-cancel-edit')){editingTask=null;renderPlan();}
      if(el.id==='play-path')playPath();
    });
    $('#anatomy-art').addEventListener('pointerover',event=>{const organ=event.target.closest('.organ');if(organ)hover(organ.dataset.organ);});
    $('#anatomy-scene').addEventListener('pointerleave',()=>{hoverOrgan=null;$$('.organ.hovered').forEach(el=>el.classList.remove('hovered'));$('#organ-tooltip').hidden=true;const sh=$('.app-shell');sh.style.setProperty('--art-x','0px');sh.style.setProperty('--art-y','0px');});
    $('#anatomy-art').addEventListener('click',event=>{const organ=event.target.closest('.organ');if(organ)activateOrgan(organ.dataset.organ);});
    $('#anatomy-scene').addEventListener('pointermove',event=>{if(!state.prefs.depth||!state.prefs.motion||event.pointerType==='touch'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;const r=event.currentTarget.getBoundingClientRect(),x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;const sh=$('.app-shell');sh.style.setProperty('--art-x',x*3+'px');sh.style.setProperty('--art-y',y*2+'px');sh.style.setProperty('--grid-x',-x*6+'px');sh.style.setProperty('--grid-y',-y*4+'px');});
    window.addEventListener('hashchange',navigate);
    let previousDate=M.localDate();
    setInterval(()=>{if(M.localDate()!==previousDate){previousDate=M.localDate();renderSummary();if(page==='plan')renderPlan();}},15000);
    refreshAll();navigate();
    if(storageError){$('#save-state').textContent='未保存';toast('本地数据无法读取，已保留原记录。可继续体验或在设置中导出当前记录。');}
  }
  mount();
})();
