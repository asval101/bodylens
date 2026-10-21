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

  /* 失败后冷却一段时间再自动尝试，别让每次录入都白等 8 秒。
   *
   * 原先是「本会话失败过就永不再试」，把标记存成 '1'。这个设计有个死角：
   * 一次失败（比如那会儿服务端还没配密钥）会让整个标签页永久停在本地解读，
   * 而且因为根本没发起请求，连失败回调都不会走，用户看不到任何提示。
   * 改成记时间戳：一分钟内不打扰，超过就自动重来。 */
  const COOLDOWN_MS = 60 * 1000;

  function lastFailAt() {
    try {
      const raw = sessionStorage.getItem(FAIL_KEY);
      if (!raw) return 0;
      const at = Number(raw);
      /* 旧版本存的是 '1'，解析出来是 1（1970 年），自然视为已过期 */
      return Number.isFinite(at) && at > 1000 ? at : 0;
    } catch (e) { return 0; }
  }

  function markedOffline() {
    const at = lastFailAt();
    return at > 0 && Date.now() - at < COOLDOWN_MS;
  }

  function markOffline() {
    try { sessionStorage.setItem(FAIL_KEY, String(Date.now())); } catch (e) { /* 忽略 */ }
  }

  function clearOffline() {
    try { sessionStorage.removeItem(FAIL_KEY); } catch (e) { /* 忽略 */ }
  }

  /* 给界面一个理由，才知道该不该提示"可以重试"。 */
  function reason() {
    if (typeof fetch !== 'function') return 'unsupported';
    if (location.protocol === 'file:') return 'offline-file';
    if (markedOffline()) return 'cooling';
    return 'ok';
  }

  function available() {
    return reason() === 'ok';
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

  window.BodyLensAI = { enhance, available, reason, clearOffline };
})();
