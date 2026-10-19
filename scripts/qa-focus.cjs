/* Standalone organ-camera regressions; uses a disposable browser profile. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addInitScript(() => {
      window.__focusStorageWrites = 0;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (...args) {
        window.__focusStorageWrites++;
        return original.apply(this, args);
      };
    });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requests.push(r.url()));
    const output = path.resolve(__dirname, '../test-results/organ-focus');
    fs.mkdirSync(output, { recursive: true });
    const layer = page.locator('.organ-focus');
    const organ = id => page.locator('#organ-picker [data-organ-button="' + id + '"]');
    const waitClosed = () => page.waitForFunction(() => document.querySelector('.organ-focus').hidden);
    const stable = () => page.waitForFunction(() =>
      !document.querySelector('.of-world').getAnimations({ subtree: false }).some(a => a.playState === 'running'));
    async function opened(id) {
      await page.waitForFunction(id => {
        const el = document.querySelector('.organ-focus');
        return !el.hidden && el.dataset.organ === id;
      }, id);
      await stable();
    }
    async function insideFrame() {
      const result = await page.evaluate(() => {
        const layer = document.querySelector('.organ-focus').getBoundingClientRect();
        const story = document.querySelector('.of-story').getBoundingClientRect();
        return [...document.querySelectorAll('.of-target')].every(node => {
          const r = node.getBoundingClientRect();
          return r.left >= layer.left - 1 && r.right <= layer.right + 1 &&
            r.top >= layer.top + 65 && r.bottom <= story.top + 1;
        });
      });
      assert.ok(result, 'Organ fits above the story card, inside the scene');
    }

    await page.goto('http://127.0.0.1:4173');
    await page.waitForSelector('.human');
    await page.waitForTimeout(900);
    assert.equal(await page.locator('.impact-explanation[open]').count(), 0);
    assert.equal(await page.locator('.metric-scope').isVisible(), true);
    assert.equal(await page.locator('.metric-limit').isVisible(), true);
    await page.screenshot({ path: path.join(output, 'overview-1366.png'), fullPage: true });

    // Click the actual anatomical lobe, not its combined group's empty center.
    const hit = await page.locator('.human').evaluate(svg => {
      const point = svg.createSVGPoint(); point.x = 176; point.y = 196;
      const screen = point.matrixTransform(svg.getScreenCTM());
      return { x: screen.x, y: screen.y };
    });
    await page.mouse.click(hit.x, hit.y);
    await page.waitForFunction(() => !document.querySelector('.organ-focus').hidden);
    await stable();
    assert.equal(await layer.getAttribute('data-organ'), 'lungs');
    assert.equal(await page.locator('.of-step').count(), 3);
    assert.ok(await page.locator('.of-target').count() >= 1);
    assert.equal(await layer.locator('[data-organ]').count(), 0, 'Clones never become live organ hit targets');
    assert.equal(await page.locator('.of-human').evaluate(svg => {
      const ids = new Set([...svg.querySelectorAll('[id]')].map(n => n.id));
      return [...svg.querySelectorAll('*')].every(n => [...n.attributes].every(a =>
        [...a.value.matchAll(/url\(#([^)]+)\)/g)].every(m => ids.has(m[1]))));
    }), true, 'All cloned gradient and texture references resolve inside the clone');
    await insideFrame();
    await page.locator('.of-play').click();
    const paused = await layer.getAttribute('data-step');
    await page.waitForTimeout(600);
    assert.equal(await layer.getAttribute('data-step'), paused);
    const writes = await page.evaluate(() => window.__focusStorageWrites);
    await page.locator('.of-step').nth(2).click();
    assert.match(await page.locator('.of-caption').innerText(), /慢阻肺及肺癌/);
    await page.locator('.of-play').click();
    await page.waitForFunction(() => document.querySelector('.organ-focus').dataset.step === '2' &&
      !document.querySelector('.organ-focus').classList.contains('of-playing'), null, { timeout: 13000 });
    assert.equal(await page.evaluate(() => window.__focusStorageWrites), writes, 'Playback never changes stored user data');
    assert.equal(await layer.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length), 0);
    await page.keyboard.press('Escape'); await waitClosed();
    assert.equal(await organ('lungs').evaluate(el => el === document.activeElement), true);

    // Regression: app.js replaces the clicked picker before document bubbling.
    await organ('lungs').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('.organ-focus').hidden);
    assert.equal(await layer.getAttribute('data-organ'), 'lungs');
    await organ('heart').click();
    await page.waitForFunction(() => document.querySelector('.organ-focus').dataset.organ === 'heart');
    await stable();
    assert.equal(await page.locator('.of-step').count(), 1, 'No fabricated mechanism for other organs');
    assert.equal(await page.locator('.of-flow').count(), 0);
    await page.locator('.of-back').click(); await waitClosed();

    for (const width of [1366, 1024, 390]) {
      await page.setViewportSize({ width, height: 768 });
      await organ('lungs').click(); await opened('lungs');
      await page.locator('.of-step').nth(1).click();
      await insideFrame();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('#anatomy-scene').screenshot({ path: path.join(output, 'lungs-' + width + '.png') });
      await page.locator('.of-back').click(); await waitClosed();
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await organ('lungs').click(); await stable();
    await page.locator('#focus-toggle').click();
    await stable(); await insideFrame();
    await page.keyboard.press('Escape'); await waitClosed();
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('focused')), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('focused')), false);

    await page.locator('#settings-link').click();
    await page.locator('#motion-setting').uncheck();
    await page.locator('[data-nav="explore"]').click();
    await organ('lungs').click(); await stable();
    assert.equal(await layer.evaluate(el => el.classList.contains('of-playing')), false);
    assert.equal(await layer.evaluate(el => el.getAnimations({ subtree: true }).length), 0);
    await page.locator('.of-step').nth(2).click();
    assert.match(await page.locator('.of-caption').innerText(), /慢阻肺及肺癌/);
    await page.locator('.of-evidence').click(); await waitClosed();
    assert.equal(await page.locator('[data-detail="evidence"]').getAttribute('aria-selected'), 'true');
    assert.match(await page.locator('#detail-content').innerText(), /未按你的年龄、支数或天数拟合/);

    await page.locator('[data-detail="impact"]').click();
    await page.locator('#settings-link').click();
    await page.locator('#motion-setting').check();
    await page.locator('#depth-setting').uncheck();
    await page.locator('[data-nav="explore"]').click();
    await organ('lungs').click();
    assert.equal(await page.locator('.of-world').evaluate(el => el.getAnimations().length), 0, 'No camera travel with depth disabled');
    await page.locator('.of-back').click(); await waitClosed();
    await page.locator('#settings-link').click();
    await page.locator('#depth-setting').check();
    await page.locator('[data-nav="explore"]').click();
    await organ('lungs').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('.organ-focus').classList.contains('of-playing'));
    await stable();
    assert.equal(await layer.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length), 0);
    await context.setOffline(true);
    await page.locator('.of-step').nth(1).click();
    assert.match(await page.locator('.of-caption').innerText(), /肺组织/);
    await page.locator('.of-back').click(); await waitClosed();
    await organ('kidneys').click();
    assert.equal(await layer.getAttribute('data-organ'), 'kidneys');
    await page.locator('.of-back').click(); await waitClosed();
    assert.deepEqual(errors, []);
    const external = requests.filter(url => !url.startsWith('http://127.0.0.1:4173') &&
      !url.startsWith('blob:') && new URL(url).hostname !== 'me.kis.v2.scr.kaspersky-labs.com');
    assert.deepEqual(external, []);

    const fileContext = await browser.newContext({ offline: true, reducedMotion: 'reduce' });
    const local = await fileContext.newPage();
    await local.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await local.locator('#organ-picker [data-organ-button="lungs"]').click();
    await local.locator('.organ-focus').waitFor({ state: 'visible' });
    assert.equal(await local.locator('.organ-focus').isVisible(), true, 'The distribution opens from local files with networking disabled');
    assert.equal(await local.locator('.of-step').count(), 3);
    await fileContext.close();
    console.log(JSON.stringify({ ok: true, checks: 'anatomical hit, replaced picker, keyboard, texture references, finite playback, no storage mutation, interrupt, reverse, three widths, immersive resize, both switches, live reduced motion, sources, offline files, no external app requests', output }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
