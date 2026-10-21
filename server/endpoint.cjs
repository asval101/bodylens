'use strict';

/**
 * 把 AI_BASE_URL 补成完整的 chat/completions 地址。
 *
 * 各家「OpenAI 兼容」的路径并不一致，所以四种写法都要认：
 *
 *   https://api.deepseek.com                 → https://api.deepseek.com/v1/chat/completions
 *   https://api.siliconflow.cn/v1            → https://api.siliconflow.cn/v1/chat/completions
 *   https://open.bigmodel.cn/api/paas/v4     → https://open.bigmodel.cn/api/paas/v4/chat/completions
 *   https://xxx/openai/v1/chat/completions   → 原样使用
 *
 * 起因：之前写死成 base + '/v1/chat/completions'，换智谱会拼出
 * /api/paas/v4/v1/chat/completions 这种不存在的地址，表现为 404 而非报错，
 * 很容易误判成密钥无效。
 */
function chatEndpoint(base) {
  const clean = String(base || '').replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(clean)) return clean;
  if (/\/v\d+$/.test(clean)) return clean + '/chat/completions';
  return clean + '/v1/chat/completions';
}

module.exports = { chatEndpoint };
