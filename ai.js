/* 解读层 —— 在线增强客户端
 *
 * 唯一职责：把已经算好的 summary 交给服务端，把回来的措辞一点点贴到界面上。
 * 前端不持有任何密钥，也不向服务端发送自由文本（只发白名单数值），
 * 所以服务端不需要信任浏览器，也就不存在「用户在输入框里注入提示词」这条路。
 *
 * 任何一步失败都退回本地解读，不弹错误、不打断用户。
 */
(function () {
  'use strict';

  const ENDPOINT = 'api/interpret';
  const FIRST_CHUNK_TIMEOUT = 8000;
  const TOTAL_TIMEOUT = 25000;
  const FAIL_KEY = 'bodylens-ai-offline';

  /* 本次会话中失败过就不再自动尝试，避免每次录入都白等 8 秒。 */
  function markedOffline() {
    try { return sessionStorage.getItem(FAIL_KEY) === '1'; } catch (e) { return false; }
  }

  function markOffline() {
    try { sessionStorage.setItem(FAIL_KEY, '1'); } catch (e) { /* 忽略 */ }
  }

  function clearOffline() {
    try { sessionStorage.removeItem(FAIL_KEY); } catch (e) { /* 忽略 */ }
  }

  function available() {
    if (typeof fetch !== 'function') return false;
    if (location.protocol === 'file:') return false;
    return !markedOffline();
  }

  /* 逐块解析 SSE。服务端每行发 `data: {"t":"..."}`，结束发 `data: [DONE]`。 */
  async function consume(response, handlers) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let got = false;

    while (true) {
      const step = await reader.read();
      if (step.done) break;
      buffer += decoder.decode(step.value, { stream: true });

      let cut;
      while ((cut = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, cut).trim();
        buffer = buffer.slice(cut + 1);
        if (!line.startsWith('data:')) continue;
        const body = line.slice(5).trim();
        if (body === '[DONE]') return { ok: true, got };
        let parsed;
        try { parsed = JSON.parse(body); } catch (e) { continue; }
        if (parsed && parsed.t) {
          got = true;
          handlers.onChunk(parsed.t);
        }
        if (parsed && parsed.error) throw new Error(parsed.error);
      }
    }
    return { ok: got, got };
  }

  /* 主入口。resolve 值为 'model' | 'local'，调用方据此切换标签。 */
  function enhance(payload, handlers) {
    if (!available()) return Promise.resolve('local');

    const controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), FIRST_CHUNK_TIMEOUT);
    let guard = setTimeout(() => controller.abort(), TOTAL_TIMEOUT);

    const finish = value => {
      clearTimeout(timer);
      clearTimeout(guard);
      return value;
    };

    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
      .then(response => {
        if (!response.ok || !response.body) {
          /* 429 是暂时的，不该让整场会话都失去在线增强。
             其他错误（无密钥、404、5xx）才是「这台服务器没有接上」。 */
          const error = new Error('http_' + response.status);
          error.temporary = response.status === 429;
          throw error;
        }
        /* 首个分块到达后放宽等待，避免长句在中间被掐断。 */
        clearTimeout(timer);
        timer = setTimeout(() => controller.abort(), TOTAL_TIMEOUT);
        if (handlers.onStart) handlers.onStart();
        return consume(response, handlers);
      })
      .then(result => {
        if (!result.got) throw new Error('empty');
        if (handlers.onDone) handlers.onDone();
        return finish('model');
      })
      .catch(error => {
        if (!error.temporary) markOffline();
        if (handlers.onFail) handlers.onFail(error);
        return finish('local');
      });
  }

  window.BodyLensAI = { enhance, available, clearOffline };
})();
