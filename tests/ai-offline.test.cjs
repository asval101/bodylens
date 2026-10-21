/* ai.js 的「失败后冷却」逻辑
 *
 * 这一条是有教训的：原先的实现在 sessionStorage 里写死 '1'，
 * 只要失败过一次，整个标签页就永久停在本地解读，
 * 而且因为不再发起请求，失败回调也不会走，界面上什么提示都没有。
 * 用户看到的现象是「怎么一直是本地解读」，看起来像功能没做。
 *
 * ai.js 是浏览器脚本（IIFE + window），没有模块系统，
 * 所以这里用 vm 造一个最小的浏览器环境来测，不去改动发布代码。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'ai.js'), 'utf8');
const FAIL_KEY = 'bodylens-ai-offline';

/* 造一个能控制时间的浏览器环境。fetch 默认失败，用来触发失败记录。 */
function browser(initial = {}, protocol = 'https:') {
  const store = new Map(Object.entries(initial));
  const clock = { now: 1_700_000_000_000 };

  const sandbox = {
    location: { protocol },
    sessionStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: key => store.delete(key)
    },
    fetch: async () => { throw new Error('boom'); },
    AbortController,
    TextDecoder,
    setTimeout,
    clearTimeout,
    console,
    Date: { now: () => clock.now }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);

  return { ai: sandbox.BodyLensAI, store, clock };
}

/* 走一次注定失败的在线解读，让失败被记录下来 */
async function failOnce(ai) {
  const result = await ai.enhance({ mode: 'ledger' }, {});
  assert.strictEqual(result, 'local', '请求失败时应退回 local');
}

test('刚打开页面时在线解读可用', () => {
  const { ai } = browser();
  assert.strictEqual(ai.reason(), 'ok');
  assert.strictEqual(ai.available(), true);
});

test('失败一次后进入冷却，不再自动尝试', async () => {
  const { ai } = browser();
  await failOnce(ai);
  assert.strictEqual(ai.reason(), 'cooling');
  assert.strictEqual(ai.available(), false);
});

test('冷却一分钟后自动恢复，不需要用户重启页面', async () => {
  const { ai, clock } = browser();
  await failOnce(ai);
  assert.strictEqual(ai.available(), false);

  clock.now += 59_000;
  assert.strictEqual(ai.available(), false, '一分钟内仍应保持安静');

  clock.now += 2_000;
  assert.strictEqual(ai.available(), true, '超过一分钟应自动重试');
});

test('点重试能立刻解除冷却', async () => {
  const { ai } = browser();
  await failOnce(ai);
  assert.strictEqual(ai.available(), false);
  ai.clearOffline();
  assert.strictEqual(ai.available(), true);
});

test('旧版本留下的永久标记不再把人锁死', () => {
  /* 老版本存的是字符串 '1'，解析出来是 1970 年，应视为早已过期 */
  const { ai } = browser({ [FAIL_KEY]: '1' });
  assert.strictEqual(ai.available(), true);
});

test('从本地文件直接打开时不去请求接口', () => {
  const { ai } = browser({}, 'file:');
  assert.strictEqual(ai.available(), false);
  assert.strictEqual(ai.reason(), 'offline-file');
});
