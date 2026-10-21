'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { chatEndpoint } = require('../server/endpoint.cjs');

test('DeepSeek 风格：只给域名，补 /v1/chat/completions', () => {
  assert.strictEqual(
    chatEndpoint('https://api.deepseek.com'),
    'https://api.deepseek.com/v1/chat/completions'
  );
});

test('末尾多余斜杠要被吃掉', () => {
  assert.strictEqual(
    chatEndpoint('https://api.deepseek.com///'),
    'https://api.deepseek.com/v1/chat/completions'
  );
});

test('硅基流动风格：已带 /v1，不重复拼 v1', () => {
  assert.strictEqual(
    chatEndpoint('https://api.siliconflow.cn/v1'),
    'https://api.siliconflow.cn/v1/chat/completions'
  );
});

test('智谱风格：路径是 /api/paas/v4，不能拼成 v4/v1', () => {
  assert.strictEqual(
    chatEndpoint('https://open.bigmodel.cn/api/paas/v4'),
    'https://open.bigmodel.cn/api/paas/v4/chat/completions'
  );
});

test('阿里百炼风格：/compatible-mode/v1', () => {
  assert.strictEqual(
    chatEndpoint('https://dashscope.aliyuncs.com/compatible-mode/v1'),
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  );
});

test('已经写全的地址原样返回，不重复拼接', () => {
  const full = 'https://example.com/api/v3/chat/completions';
  assert.strictEqual(chatEndpoint(full), full);
});

test('空值不抛异常，回落到默认路径', () => {
  assert.strictEqual(chatEndpoint(''), '/v1/chat/completions');
  assert.strictEqual(chatEndpoint(undefined), '/v1/chat/completions');
});
