/* Browser integration checks; set PLAYWRIGHT_MODULE to a local Playwright install. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',req=>requests.push(req.url()));
  const out=path.resolve(__dirname,'../test-results');fs.mkdirSync(out,{recursive:true});
  await page.goto('http://127.0.0.1:4173');
  await page.waitForSelector('.human');
  assert.match(await page.locator('#detail-content').innerText(),/肺癌死亡/);
  // Aim inside an actual lung lobe; the combined group's bounding-box center
  // is the empty mediastinum, not a lung hit area.
  const lungPoint=await page.locator('.human').evaluate(svg=>{const p=svg.createSVGPoint();p.x=176;p.y=196;const q=p.matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y};});
  await page.mouse.move(lungPoint.x,lungPoint.y);
  assert.match(await page.locator('#organ-tooltip').innerText(),/肺部/);
  await page.locator('#stage-state').hover();
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
  await page.locator('#age').fill('17');await page.locator('#analyze').click();assert.match(await page.locator('#input-feedback').innerText(),/18–120/);
  await page.locator('#age').fill('22');await page.locator('#analyze').click();assert.match(await page.locator('#result-context').innerText(),/22 岁/);
  await page.locator('[data-duration="smoke"]').selectOption('1 年');assert.match(await page.locator('#dirty-note').innerText(),/等待更新/);assert.match(await page.locator('#result-context').innerText(),/1 个月/);
  await page.locator('#analyze').click();assert.match(await page.locator('#result-context').innerText(),/1 年/);
  await page.locator('[data-mode="combined"]').click();await page.locator('#quick-behaviors [data-choose="walk"]').click();await page.locator('#analyze').click();await page.locator('#organ-picker [data-organ-button="heart"]').click();assert.equal(await page.locator('.impact-card').count(),2);assert.match(await page.locator('#detail-content').innerText(),/不相互抵消/);
  await page.locator('#behavior-input').fill('不抽烟，神奇疗法');await page.locator('#behavior-form button').click();assert.match(await page.locator('#input-feedback').innerText(),/暂不支持/);assert.equal(await page.locator('.scenario-card').count(),2);
  await page.locator('#organ-picker [data-organ-button="kidneys"]').click();assert.equal(await page.locator('[data-view="back"]').getAttribute('aria-pressed'),'true');
  await page.locator('#system').selectOption('circulatory');assert.equal(await page.locator('[data-view="front"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.organ[data-organ="heart"]').isVisible(),true);
  await page.locator('#organ-picker [data-organ-button="lungs"]').click();assert.equal(await page.locator('[data-view="front"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-detail="action"]').click();await page.locator('[data-add-plan="smoke"]').click();await page.locator('[data-add-plan="smoke"]').click();
  await page.locator('[data-nav="plan"]').click();assert.equal(await page.locator('.plan-task').count(),1);
  await page.locator('[data-task-toggle]').check();assert.match(await page.locator('#plan-progress').innerText(),/1 \/ 1/);
  await page.locator('#plan-input').fill('<img src=x onerror=alert(1)>');await page.locator('#plan-form button').click();assert.equal(await page.locator('#plan-list img').count(),0);assert.equal(await page.locator('.plan-task').count(),2);
  await page.reload();assert.equal(await page.locator('.plan-task').count(),2);
  await page.locator('#settings-link').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#export-backup').click();const download=await downloadPromise;const backupPath=path.join(out,download.suggestedFilename());await download.saveAs(backupPath);
  const content=JSON.parse(fs.readFileSync(backupPath,'utf8'));assert.equal(content.data.tasks.length,2);
  const badPath=path.join(out,'bad.json');fs.writeFileSync(badPath,'{"app":"bad"}');await page.locator('#import-backup').setInputFiles(badPath);await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('未恢复'));
  content.data.tasks[0].title='恢复测试任务';const goodPath=path.join(out,'restore.json');fs.writeFileSync(goodPath,JSON.stringify(content));
  await page.locator('#import-backup').setInputFiles(goodPath);await page.waitForSelector('#restore-dialog[open]');assert.ok(!(await page.locator('#plan-summary').innerText()).includes('恢复测试任务'));
  await page.locator('#confirm-restore').click();await page.locator('[data-nav="plan"]').click();assert.match(await page.locator('#plan-list').innerText(),/恢复测试任务/);
  await page.locator('#settings-link').click();await page.locator('#undo-restore').click();await page.locator('[data-nav="plan"]').click();assert.ok(!(await page.locator('#plan-list').innerText()).includes('恢复测试任务'));
  await page.locator('[data-nav="library"]').click();assert.ok(await page.locator('.library-card').count()>=30);
  await page.locator('#library-search').fill('奶茶');assert.equal(await page.locator('.library-card').count(),1);
  await page.locator('.library-card button').click();assert.equal(new URL(page.url()).hash,'#explore');
  await page.locator('#age').fill('22');await page.locator('#analyze').click();await page.locator('#organ-picker [data-organ-button="lungs"]').click();
  await page.locator('[data-detail="impact"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-detail="evidence"]').getAttribute('aria-selected'),'true');
  await page.locator('[data-detail="evidence"]').click();await page.waitForFunction(()=>[...document.querySelectorAll('.teaching-image img')].every(i=>i.complete&&i.naturalWidth>0));
  await page.locator('[data-detail="impact"]').click();await page.locator('#focus-toggle').click();assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('focused')),true);await page.keyboard.press('Escape');assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('focused')),false);
  for(const width of [1366,1024,390]){await page.setViewportSize({width,height:900});await page.screenshot({path:path.join(out,`width-${width}.png`),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No horizontal overflow at ${width}`);}
  await page.context().setOffline(true);await page.locator('[data-nav="plan"]').click();assert.equal(await page.locator('.plan-task').count(),2);await page.context().setOffline(false);
  // Installed Kaspersky injects its own script into local HTTP responses. It is
  // outside this app; do not disable or modify the user's protection software.
  const injected=requests.filter(url=>new URL(url).hostname==='me.kis.v2.scr.kaspersky-labs.com');
  const external=requests.filter(url=>!url.startsWith('http://127.0.0.1:4173')&&!url.startsWith('blob:')&&!injected.includes(url));
  if(external.length)console.log('Unexpected requests:',JSON.stringify(external,null,2));
  assert.equal(external.length,0,'No external runtime requests');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,checks:'age, dirty results, combined effects, negation, organ views, plans, persistence, XSS, backup/restore/undo, library, focus, three widths, offline, no app-originated external requests',environmentInjectedRequests:injected.length,screenshots:out},null,2));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
