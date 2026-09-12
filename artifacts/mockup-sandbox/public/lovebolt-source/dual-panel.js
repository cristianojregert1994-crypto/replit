(() => {
  'use strict';

  const chatFrame = document.getElementById('chatFrame');
  const loveboltFrame = document.getElementById('loveboltFrame');
  const syncStatus = document.getElementById('syncStatus');
  const fallback = document.getElementById('chatFallback');
  const shell = document.getElementById('dualShell');
  const divider = document.getElementById('dividerChat');
  const fullscreenModeBtn = document.getElementById('fullscreenModeBtn');
  const fullscreenModeIcon = document.getElementById('fullscreenModeIcon');
  const fullscreenModeLabel = document.getElementById('fullscreenModeLabel');

  const pageParams = new URLSearchParams(location.search);
  const isFullscreenWorkspace = pageParams.get('fullscreen') === '1';
  const openerWindowId = Number(pageParams.get('openerWindowId'));
  const FULLSCREEN_URL = chrome.runtime.getURL('sidepanel.html?fullscreen=1');
  const LAYOUT_KEY = 'crcellDualPaneLayoutV62';
  const THEME_KEY = 'crcellDualTheme';
  const MIN_PANE = 18;
  const DEFAULT_CONNECT = 35;

  const pending = new Map();
  const port = chrome.runtime.connect({ name: 'crcell-dual-panel' });
  let connectWidth = DEFAULT_CONNECT;
  let activePlatform = 'lovable';
  let dragging = false;
  let dragPointerId = null;
  let resizeRaf = 0;

  function clamp(n, min, max) { return Math.min(max, Math.max(min, Number(n) || 0)); }
  function normalizePlatform(value) {
    const p = String(value || '').toLowerCase();
    return ['lovable','bolt','replit','gpt'].includes(p) ? p : 'lovable';
  }

  function updateFullscreenButton() {
    if (!fullscreenModeBtn) return;
    fullscreenModeBtn.classList.toggle('is-active', isFullscreenWorkspace);
    fullscreenModeBtn.setAttribute('aria-pressed', String(isFullscreenWorkspace));
    if (fullscreenModeIcon) fullscreenModeIcon.textContent = isFullscreenWorkspace ? '↙' : '⛶';
    if (fullscreenModeLabel) fullscreenModeLabel.textContent = isFullscreenWorkspace ? 'Voltar' : 'Tela Cheia';
    fullscreenModeBtn.title = isFullscreenWorkspace
      ? 'Fechar a tela cheia e voltar para a janela original'
      : 'Abrir a extensão ocupando toda a tela';
    fullscreenModeBtn.setAttribute('aria-label', fullscreenModeBtn.title);
  }

  async function findExistingFullscreenWindow() {
    try {
      const windows = await chrome.windows.getAll({ populate: true });
      return windows.find((win) => Array.isArray(win.tabs) && win.tabs.some((tab) => String(tab.url || '').startsWith(FULLSCREEN_URL))) || null;
    } catch (_) { return null; }
  }

  async function openFullscreenWorkspace() {
    if (!fullscreenModeBtn) return;
    fullscreenModeBtn.disabled = true;
    try {
      const existing = await findExistingFullscreenWindow();
      if (existing?.id != null) {
        await chrome.windows.update(existing.id, { focused: true, state: 'fullscreen' });
        return;
      }
      const current = await chrome.windows.getCurrent();
      const opener = Number.isInteger(current?.id) ? current.id : '';
      await chrome.windows.create({
        url: `${FULLSCREEN_URL}&openerWindowId=${encodeURIComponent(opener)}`,
        type: 'popup', focused: true, state: 'fullscreen'
      });
    } catch (error) {
      console.error('[CRCELL] Falha ao abrir tela cheia:', error);
      try {
        const current = await chrome.windows.getCurrent();
        if (current?.id != null) await chrome.windows.update(current.id, { state: 'maximized', focused: true });
      } catch (_) {}
    } finally { fullscreenModeBtn.disabled = false; }
  }

  async function leaveFullscreenWorkspace() {
    if (!fullscreenModeBtn) return;
    fullscreenModeBtn.disabled = true;
    try {
      const current = await chrome.windows.getCurrent();
      if (Number.isInteger(openerWindowId)) {
        try { await chrome.windows.update(openerWindowId, { focused: true }); } catch (_) {}
      }
      if (current?.id != null) { await chrome.windows.remove(current.id); return; }
    } catch (error) {
      console.error('[CRCELL] Falha ao sair da tela cheia:', error);
      try {
        const current = await chrome.windows.getCurrent();
        if (current?.id != null) await chrome.windows.update(current.id, { state: 'normal', focused: true });
      } catch (_) {}
    } finally { fullscreenModeBtn.disabled = false; }
  }

  updateFullscreenButton();
  fullscreenModeBtn?.addEventListener('click', () => isFullscreenWorkspace ? leaveFullscreenWorkspace() : openFullscreenWorkspace());

  function applyLayout(_value, persist = false) {
    // v6.2.0: layout unificado e fixo — 35% Extensão / 65% ChatGPT.
    connectWidth = DEFAULT_CONNECT;
    shell?.style.setProperty('--pane-connect', '35fr');
    shell?.style.setProperty('--pane-chat', '65fr');
    if (persist) chrome.storage.local.set({ [LAYOUT_KEY]: DEFAULT_CONNECT }).catch?.(() => {});
  }

  function updateFromPointer(clientX) {
    if (!shell) return;
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      const rect = shell.getBoundingClientRect();
      const dividerWidth = divider?.getBoundingClientRect().width || 9;
      const usable = Math.max(1, rect.width - dividerWidth);
      const x = clamp(clientX - rect.left - dividerWidth / 2, 0, usable);
      applyLayout((x / usable) * 100, false);
    });
  }

  divider?.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    event.preventDefault();
    dragging = true;
    dragPointerId = event.pointerId;
    divider.setPointerCapture?.(event.pointerId);
    divider.classList.add('is-dragging');
    document.body.classList.add('is-resizing');
    updateFromPointer(event.clientX);
  });
  divider?.addEventListener('pointermove', (event) => {
    if (dragging && dragPointerId === event.pointerId) updateFromPointer(event.clientX);
  });
  function finishDrag(event) {
    if (!dragging) return;
    if (event?.pointerId != null && divider?.hasPointerCapture?.(event.pointerId)) divider.releasePointerCapture?.(event.pointerId);
    dragging = false;
    dragPointerId = null;
    cancelAnimationFrame(resizeRaf);
    divider?.classList.remove('is-dragging');
    document.body.classList.remove('is-resizing');
    applyLayout(connectWidth, true);
  }
  divider?.addEventListener('pointerup', finishDrag);
  divider?.addEventListener('pointercancel', finishDrag);
  divider?.addEventListener('lostpointercapture', finishDrag);
  divider?.addEventListener('dblclick', () => applyLayout(DEFAULT_CONNECT, true));
  divider?.addEventListener('keydown', (event) => {
    if (!['ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 8 : 2;
    if (event.key === 'Enter' || event.key === ' ') return applyLayout(DEFAULT_CONNECT, true);
    if (event.key === 'Home') return applyLayout(MIN_PANE, true);
    if (event.key === 'End') return applyLayout(100 - MIN_PANE, true);
    applyLayout(connectWidth + (event.key === 'ArrowLeft' ? -step : step), true);
  });

  function chatOrigin() {
    try { return new URL(chatFrame.src).origin; } catch (_) { return 'https://chatgpt.com'; }
  }
  function postFrame(frame, data, origin = '*') {
    try { frame?.contentWindow?.postMessage(data, origin); } catch (_) {}
  }
  function broadcastTheme() {
    postFrame(chatFrame, { type: 'CRCELL_EMBED_THEME', appearance: 'light' }, chatOrigin());
    postFrame(loveboltFrame, { type: 'CRCELL_DUAL_THEME', theme: 'light' });
  }
  function applyTheme({ persist = false } = {}) {
    document.body.classList.add('light');
    document.documentElement.classList.add('light');
    document.documentElement.dataset.theme = 'light';
    if (persist) chrome.storage.local.set({ [THEME_KEY]: 'light' }).catch?.(() => {});
    broadcastTheme();
  }
  function applyPlatform(platform) {
    activePlatform = normalizePlatform(platform);
    for (const p of ['lovable','bolt','replit','gpt']) document.body.classList.toggle(`platform-${p}`, activePlatform === p);
    document.body.dataset.platform = activePlatform;
  }

  chrome.storage.local.get([LAYOUT_KEY]).then((result) => {
    applyLayout(DEFAULT_CONNECT);
    applyTheme();
    chrome.storage.local.set({ [THEME_KEY]: 'light' }).catch?.(() => {});
  }).catch(() => { applyLayout(DEFAULT_CONNECT); applyTheme(); });
  window.addEventListener('resize', () => applyLayout(connectWidth));
  loveboltFrame?.addEventListener('load', () => setTimeout(broadcastTheme, 40));

  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (event.source === loveboltFrame?.contentWindow && data.type === 'CRCELL_DUAL_THEME_CHANGED') applyTheme({ persist: true });
  });

  chrome.runtime.sendMessage({ type: 'GET_DETECTED_PROJECT' }, (res) => applyPlatform(res?.project?.platform || 'lovable'));
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'PROJECT_DETECTED') applyPlatform(msg.project?.platform);
    if (msg?.type === 'CHAT_CONNECTED') setStatus('Relay conectado', 'online');
    if (msg?.type === 'CHAT_DISCONNECTED') setStatus('Relay desconectado', 'error');
    return false;
  });
  chrome.storage?.onChanged?.addListener((changes) => {
    if (changes.detectedProject) applyPlatform(changes.detectedProject.newValue?.platform);
    if (changes[THEME_KEY]) applyTheme();
  });

  function setStatus(text, state = '') {
    if (!syncStatus) return;
    syncStatus.textContent = text;
    syncStatus.classList.toggle('is-online', state === 'online');
    syncStatus.classList.toggle('is-error', state === 'error');
  }

  port.onMessage.addListener((msg) => {
    if (msg?.type !== 'EMBEDDED_CHAT_DELIVER' || !msg.requestId) return;
    if (!chatFrame?.contentWindow) {
      port.postMessage({ type: 'EMBEDDED_CHAT_RESULT', requestId: msg.requestId, result: { ok: false, error: 'Iframe do ChatGPT indisponível.' } });
      return;
    }
    pending.set(msg.requestId, Date.now());
    try {
      chatFrame.contentWindow.postMessage({ type: 'CRCELL_EMBED_CHAT_SEND', requestId: msg.requestId, payload: msg.payload || {} }, chatOrigin());
      setStatus('Relay sincronizando…');
    } catch (error) {
      pending.delete(msg.requestId);
      port.postMessage({ type: 'EMBEDDED_CHAT_RESULT', requestId: msg.requestId, result: { ok: false, error: error?.message || String(error) } });
      setStatus('Falha no relay', 'error');
    }
  });
  port.onDisconnect.addListener(() => setStatus('Relay desconectado', 'error'));

  window.addEventListener('message', (event) => {
    if (event.source !== chatFrame?.contentWindow) return;
    const allowedOrigin = /https:\/\/(?:[^.]+\.)?(?:chatgpt\.com|openai\.com)$/i.test(event.origin) || event.origin === 'https://chat.openai.com';
    if (!allowedOrigin) return;
    const data = event.data;
    if (data?.type !== 'CRCELL_EMBED_CHAT_RESULT' || !data.requestId || !pending.has(data.requestId)) return;
    pending.delete(data.requestId);
    const result = data.result || { ok: true };
    port.postMessage({ type: 'EMBEDDED_CHAT_RESULT', requestId: data.requestId, result });
    setStatus(result.ok === false ? 'Falha ao enviar' : 'Relay conectado', result.ok === false ? 'error' : 'online');
  });

  document.getElementById('chatHomeBtn')?.addEventListener('click', () => { chatFrame.src = 'https://chatgpt.com/'; setStatus('Abrindo ChatGPT…'); });
  document.getElementById('chatReloadBtn')?.addEventListener('click', () => { chatFrame.src = chatFrame.src; setStatus('Recarregando…'); });
  document.getElementById('chatOpenTabBtn')?.addEventListener('click', () => chrome.tabs.create({ url: 'https://chatgpt.com/' }));
  chatFrame?.addEventListener('load', () => { if (fallback) fallback.hidden = true; setStatus('Aguardando relay…'); setTimeout(broadcastTheme, 120); });
})();
