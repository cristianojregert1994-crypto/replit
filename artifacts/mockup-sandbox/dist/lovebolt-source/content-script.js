/**
 * LoveBoltReplit GPT Connector - Content Script for ChatGPT
 * 
 * Injected into chatgpt.com. Handles:
 * - Receiving messages from background
 * - Typing into ChatGPT input
 * - Clicking send
 * - Monitoring responses via MutationObserver
 * - Sending responses back to background
 */
(function() {
  'use strict';

  if (window.__LOVABLE_RELAY_LOADED__) return;
  window.__LOVABLE_RELAY_LOADED__ = true;

  let isMonitoring = false;
  let lastAssistantCount = 0;
  let streamingText = '';
  let checkInterval = null;
  let safetyTimeout = null;

  const LOG = '[Lovable Relay]';

  // v5.8.0: ChatGPT usa somente o tema NATIVO claro/oficial.
  // A extensão não injeta cores próprias no ChatGPT; apenas fixa a aparência em light.
  const CRCELL_THEME_STYLE_ID = 'crcell-lovebolt-unified-theme';
  const CRCELL_THEME_STORAGE_KEY = 'crcellDualTheme';
  let crcellAppearance = null;
  let nativeThemeObserver = null;
  let applyingNativeTheme = false;

  function removeLegacyChatGPTThemeOverrides() {
    // Remove qualquer CSS artificial deixado por versões anteriores.
    document.getElementById(CRCELL_THEME_STYLE_ID)?.remove();

    const root = document.documentElement;
    if (!root) return;
    delete root.dataset.crcellPlatform;
    delete root.dataset.crcellAppearance;
  }

  function applyNativeChatGPTTheme(value) {
    const appearance = 'light';
    crcellAppearance = appearance;
    removeLegacyChatGPTThemeOverrides();

    const root = document.documentElement;
    if (!root) return;

    applyingNativeTheme = true;

    // O ChatGPT usa seus próprios tokens/estilos. Alteramos apenas os
    // seletores de aparência e deixamos todas as cores para o site oficial.
    root.classList.toggle('dark', appearance === 'dark');
    root.setAttribute('data-theme', appearance);
    root.style.colorScheme = appearance;

    queueMicrotask(() => { applyingNativeTheme = false; });
  }

  function keepNativeThemeSynced() {
    if (nativeThemeObserver || !document.documentElement) return;
    nativeThemeObserver = new MutationObserver(() => {
      if (applyingNativeTheme || !crcellAppearance) return;
      const root = document.documentElement;
      const wantsDark = crcellAppearance === 'dark';
      const classMismatch = root.classList.contains('dark') !== wantsDark;
      const themeMismatch = root.getAttribute('data-theme') !== crcellAppearance;
      if (classMismatch || themeMismatch) applyNativeChatGPTTheme(crcellAppearance);
    });
    nativeThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });
  }

  function applyCrCellTheme(payload = {}) {
    applyNativeChatGPTTheme('light');
    keepNativeThemeSynced();
  }

  // Lê o mesmo seletor da extensão logo ao carregar para evitar mistura
  // entre tema salvo do ChatGPT e o tema escolhido no painel CRCELL.
  removeLegacyChatGPTThemeOverrides();
  keepNativeThemeSynced();
  try {
    applyNativeChatGPTTheme('light');
    chrome.storage.local.set({ [CRCELL_THEME_STORAGE_KEY]: 'light' });
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (changes?.[CRCELL_THEME_STORAGE_KEY]) applyNativeChatGPTTheme('light');
    });
  } catch (_) { applyNativeChatGPTTheme('light'); }

  // Register with background
  chrome.runtime.sendMessage({ type: 'CHATGPT_TAB_READY' });

  // v4.0.0: bridge from the local dual sidepanel parent to this ChatGPT iframe.
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== window.parent) return;
    if (data?.type === 'CRCELL_EMBED_THEME') {
      applyCrCellTheme(data);
      return;
    }
    if (data?.type !== 'CRCELL_EMBED_CHAT_SEND') return;
    const payload = data.payload || {};
    const requestId = data.requestId;
    handleSendMessage(payload.message, payload.attachments || [], (result) => {
      try {
        window.parent.postMessage({
          type: 'CRCELL_EMBED_CHAT_RESULT',
          requestId,
          result: result || { ok: true }
        }, '*');
      } catch (error) {
        console.warn(LOG, 'Embedded bridge response failed:', error);
      }
    });
  });

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log(LOG, 'Received:', msg.type);

    switch (msg.type) {
      case 'CHAT_SEND':
        handleSendMessage(msg.message, msg.attachments || [], sendResponse);
        return true;
    }
  });

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function dataUrlToFile(item) {
    const raw = String(item?.dataUrl || '');
    const match = raw.match(/^data:([^;,]*)(;base64)?,(.*)$/s);
    if (!match) throw new Error(`Anexo inválido: ${item?.name || 'arquivo'}`);
    const mime = match[1] || item?.type || 'application/octet-stream';
    const decoded = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    return new File([bytes], item?.name || 'arquivo', { type: mime, lastModified: Date.now() });
  }

  function findFileInput() {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]')).filter((el) => !el.disabled);
    if (!inputs.length) return null;
    const prompt = findInput();
    if (!prompt) return inputs[0];
    const promptRect = prompt.getBoundingClientRect();
    return inputs
      .map((el) => {
        const host = el.closest('form') || el.parentElement;
        const rect = host?.getBoundingClientRect?.() || { top: 0, left: 0 };
        return { el, score: Math.abs(rect.top - promptRect.top) + Math.abs(rect.left - promptRect.left) };
      })
      .sort((a, b) => a.score - b.score)[0]?.el || inputs[0];
  }

  async function exposeFileInput() {
    let input = findFileInput();
    if (input) return input;
    const selectors = [
      'button[aria-label*="Attach" i]', 'button[aria-label*="anex" i]',
      'button[aria-label*="upload" i]', 'button[title*="Attach" i]',
      'button[title*="anex" i]', '[data-testid*="attach" i]', '[data-testid*="upload" i]'
    ];
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (!button || button.disabled) continue;
      button.click();
      await sleep(250);
      input = findFileInput();
      if (input) return input;
    }
    // Some ChatGPT builds open a menu first; try its upload/file item.
    const menuItem = Array.from(document.querySelectorAll('[role="menuitem"],button,[role="button"]')).find((el) => {
      const label = [el.textContent, el.getAttribute?.('aria-label'), el.getAttribute?.('title')].filter(Boolean).join(' ').toLowerCase();
      return /(upload|arquivo|file|foto|photo|anex)/i.test(label) && !el.disabled;
    });
    if (menuItem) {
      menuItem.click();
      await sleep(250);
      input = findFileInput();
    }
    return input;
  }

  async function uploadAttachments(items) {
    if (!items?.length) return { ok: true, count: 0 };
    try {
      const input = await exposeFileInput();
      if (!input) return { ok: false, error: 'Campo de anexos do ChatGPT não encontrado. Recarregue a aba do ChatGPT e tente novamente.' };
      const transfer = new DataTransfer();
      for (const item of items) transfer.items.add(dataUrlToFile(item));
      input.files = transfer.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // Give ChatGPT time to register/upload the chips before the prompt is sent.
      await sleep(Math.min(4000, 700 + items.length * 350));
      return { ok: true, count: transfer.files.length };
    } catch (error) {
      console.error(LOG, 'Attachment upload error:', error);
      return { ok: false, error: error?.message || String(error) };
    }
  }

  // ── Send Message to ChatGPT ──
  async function handleSendMessage(message, attachments, sendResponse) {
    try {
      const uploadResult = await uploadAttachments(Array.isArray(attachments) ? attachments : []);
      if (!uploadResult.ok) {
        sendResponse({ ok: false, error: uploadResult.error || 'Falha ao anexar arquivo no ChatGPT.' });
        return;
      }

      const input = findInput();
      if (!input) {
        sendResponse({ ok: false, error: 'Input do ChatGPT não encontrado. Recarregue a página.' });
        return;
      }

      // Focus
      input.focus();
      await sleep(300);

      // Clear
      clearInput(input);
      await sleep(200);

      // Type message
      await typeMessage(input, message);
      await sleep(500);

      // Start monitoring BEFORE clicking send
      startMonitoring();

      // Click send
      const sent = clickSendButton();

      if (!sent) {
        // Fallback: press Enter
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
        }));
      }

      sendResponse({ ok: true });
    } catch (e) {
      console.error(LOG, 'Send error:', e);
      sendResponse({ ok: false, error: e.message });
    }
  }

  // ── Find Input Field ──
  function findInput() {
    const selectors = [
      '#prompt-textarea',
      'div[contenteditable="true"][data-placeholder]',
      'div.ProseMirror',
      'div[role="textbox"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    // Fallback: any contenteditable without much content
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      const text = el.innerText || '';
      if (text.length < 50) return el;
    }

    return null;
  }

  function clearInput(input) {
    if (input.tagName === 'TEXTAREA') {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      input.textContent = '';
      input.innerHTML = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  async function typeMessage(input, text) {
    // Method 1: execCommand (works with ProseMirror)
    input.focus();
    const inserted = document.execCommand('insertText', false, text);

    if (!inserted || (input.innerText || '').trim().length < 3) {
      // Method 2: Clipboard paste
      try {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', text);
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true, cancelable: true, clipboardData
        });
        input.dispatchEvent(pasteEvent);
      } catch (e) {
        // Method 3: Direct textContent (basic fallback)
        input.textContent = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    await sleep(200);
  }

  function clickSendButton() {
    // Try specific selectors
    const selectors = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Enviar prompt"]',
      'form button:last-of-type'
    ];

    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn && !btn.disabled) {
        btn.click();
        return true;
      }
    }

    // Fallback: find send button by SVG icon
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (label.includes('send') || label.includes('enviar')) {
        btn.click();
        return true;
      }
    }

    // Fallback: form submit
    const input = findInput();
    if (input) {
      const form = input.closest('form');
      if (form) {
        const btn = form.querySelector('button:not([disabled])');
        if (btn) {
          btn.click();
          return true;
        }
      }
    }

    return false;
  }

  // ── Monitor Responses ──
  function startMonitoring() {
    if (isMonitoring) return;
    isMonitoring = true;
    streamingText = '';

    // Count existing assistant messages
    const existing = document.querySelectorAll('[data-message-author-role="assistant"]');
    lastAssistantCount = existing.length;

    // Notify
    chrome.runtime.sendMessage({ type: 'CHAT_TYPING', typing: true });

    // Check every second
    checkInterval = setInterval(checkForResponse, 1000);

    // Safety timeout: 120 seconds
    safetyTimeout = setTimeout(() => {
      if (isMonitoring && streamingText) {
        finishMonitoring();
      }
    }, 120000);
  }

  // Thinking indicators to filter out
  const THINKING_PATTERNS = [
    /^pensando$/i, /^thinking$/i, /^analyzing$/i, /^processando$/i,
    /^analyzing\b/i, /^searching/i, /^updating/i, /^creating/i,
    /^writing/i, /^reading/i, /^editing/i, /^deleting/i,
    /^using\s/i, /^calling\s/i, /^invoking/i, /^running/i,
    /^searching\s/i, /^search\s/i, /^apply/i, /^update\s/i,
    /^create\s/i, /^read\s/i, /^write\s/i, /^edit\s/i,
    /^delete\s/i, /^list\s/i, /^get\s/i, /^set\s/i,
    /^fetching/i, /^loading/i, /^connecting/i, /^sending/i,
    /^perguntando/i, /^buscando/i, /^verificando/i,
  ];

  function isThinkingIndicator(text) {
    if (!text) return true;
    const trimmed = text.trim();
    if (trimmed.length < 2) return true;
    if (trimmed.length > 100) return false; // Real responses are longer
    return THINKING_PATTERNS.some(p => p.test(trimmed));
  }

  function checkForResponse() {
    if (!isMonitoring) {
      clearInterval(checkInterval);
      return;
    }

    const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
    const latest = assistantMessages[assistantMessages.length - 1];

    if (latest) {
      const rawText = extractText(latest);

      // Skip thinking indicators ("Pensando", "Analyzing", etc.)
      if (isThinkingIndicator(rawText)) {
        // Still show typing indicator but don't send the text
        return;
      }

      // Only send if we have real content that changed
      if (rawText && rawText.length > 5 && rawText !== streamingText) {
        streamingText = rawText;

        chrome.runtime.sendMessage({
          type: 'CHAT_STREAM_UPDATE',
          text: streamingText
        });
      }

      // Check if done (stop button gone)
      const stopBtn = document.querySelector('button[aria-label="Stop generating"]') ||
                      document.querySelector('button[aria-label="Parar de gerar"]');

      if (!stopBtn && assistantMessages.length > lastAssistantCount && streamingText.length > 5) {
        finishMonitoring();
      }
    }
  }

  function finishMonitoring() {
    isMonitoring = false;
    clearInterval(checkInterval);
    clearTimeout(safetyTimeout);

    chrome.runtime.sendMessage({ type: 'CHAT_TYPING', typing: false });

    // Get the latest real response (skip thinking)
    const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
    const latest = assistantMessages[assistantMessages.length - 1];
    let finalText = latest ? extractText(latest) : streamingText;

    // If the final text is still a thinking indicator, use the streaming text
    if (isThinkingIndicator(finalText) && streamingText && !isThinkingIndicator(streamingText)) {
      finalText = streamingText;
    }

    // If still thinking, try to wait a bit more
    if (isThinkingIndicator(finalText)) {
      // Wait 3 seconds and try again
      setTimeout(() => {
        const retryMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
        const retryLatest = retryMessages[retryMessages.length - 1];
        if (retryLatest) {
          const retryText = extractText(retryLatest);
          if (!isThinkingIndicator(retryText) && retryText.length > 5) {
            sendFinalResponse(retryText);
          }
        }
      }, 3000);
      return;
    }

    sendFinalResponse(finalText);
  }

  function sendFinalResponse(text) {
    if (!text || text.length < 5) return;

    // Detect code blocks
    const codeBlocks = [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[2].trim().length > 10) {
        codeBlocks.push({ language: match[1] || 'code', code: match[2].trim() });
      }
    }

    // Detect confirmation / tool call
    const lower = text.toLowerCase();
    const isConfirmation = [
      'posso prosseguir', 'confirma', 'deseja que eu',
      'quer que eu', 'devo continuar', 'shall i proceed',
      'would you like me to', 'permitir que', 'aprovar',
      'está tudo certo', 'pode prosseguir', 'confirmação',
      'you need to approve', 'please confirm', 'allow',
      'autorizar', 'preciso da sua autorização'
    ].some(p => lower.includes(p));

    // Send final response
    chrome.runtime.sendMessage({
      type: 'CHAT_STREAM_DONE',
      text: text,
      codeBlockCount: codeBlocks.length,
      isConfirmation
    });

    // v3.48.0: code blocks are never written automatically. GitHub writes require an explicit edit action.

    if (isConfirmation) {
      chrome.runtime.sendMessage({
        type: 'CHAT_TOOL_CONFIRM',
        text: text
      });
    }
  }

  function extractText(element) {
    const clone = element.cloneNode(true);

    // Remove buttons and toolbars (but keep confirmation text)
    clone.querySelectorAll('button[class*="send"], button[class*="copy"], button[class*="edit"], [class*="toolbar"], [class*="actions"]').forEach(el => el.remove());

    // Also capture tool confirmation boxes (like Lovable tool)
    const toolBoxes = clone.querySelectorAll('[class*="tool"], [class*="plugin"], [data-testid*="tool"]');
    let toolText = '';
    toolBoxes.forEach(box => {
      toolText += (box.innerText || '') + '\n';
    });

    const mainText = (clone.innerText || '').trim();
    return toolText ? mainText + '\n' + toolText : mainText;
  }

  console.log(LOG, 'Content script loaded v3.48.0');
})();
