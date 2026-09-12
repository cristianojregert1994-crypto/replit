/**
 * LoveBoltReplit GPT Connector - Native Builder Chat Blocker v3.48.0
 *
 * Keeps the official builder chat visible, but blocks user interaction with its
 * composer in Lovable, Bolt.new and Replit. No visual overlay, replacement UI,
 * image, textarea or floating panel is injected into the builder page.
 */
(function () {
  'use strict';

  if (window.__LOVEBOLT_NATIVE_CHAT_BLOCKER__) return;
  window.__LOVEBOLT_NATIVE_CHAT_BLOCKER__ = true;

  // Keep the existing storage key for backward compatibility with the sidepanel toggle.
  const BLOCK_ENABLED_KEY = 'loveboltOverlayEnabled';
  const host = String(location.hostname || '').toLowerCase();
  const platform = /(^|\.)bolt\.new$/i.test(host)
    ? 'bolt'
    : /(^|\.)replit\.com$/i.test(host)
      ? 'replit'
      : 'lovable';
  const platformLabel = platform === 'bolt' ? 'Bolt.new' : platform === 'replit' ? 'Replit' : 'Lovable';

  let nativeTarget = null;
  let nativeInput = null;
  let originalTargetState = null;
  let originalInputState = null;
  let lastUrl = location.href;
  let scanCountdown = 0;
  let destroyed = false;
  let blockerEnabled = null;

  function projectIdFromUrl() {
    if (platform === 'bolt') {
      const m = location.pathname.match(/^\/~\/([^/?#]+)/i) || location.pathname.match(/^\/project\/([^/?#]+)/i);
      return m ? decodeURIComponent(m[1]) : '';
    }
    if (platform === 'lovable') {
      return location.pathname.match(/\/projects\/([a-f0-9-]+)/i)?.[1] || '';
    }

    const path = location.pathname || '/';
    const atProject = path.match(/^\/@[^/]+\/([^/?#]+)/i)?.[1];
    const namedProject = path.match(/^\/(?:repl|project|app|workspace)\/([^/?#]+)/i)?.[1];
    const query = new URLSearchParams(location.search);
    return decodeURIComponent(atProject || namedProject || query.get('repl') || query.get('project') || query.get('workspace') || '');
  }

  function isProjectView() {
    if (platform !== 'replit') return Boolean(projectIdFromUrl());
    const path = location.pathname || '/';
    if (/^\/(?:$|login|signup|pricing|templates|community|search|account|notifications)(?:\/|$)/i.test(path)) return false;
    return true;
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 16 || rect.bottom <= 0 || rect.top >= innerHeight) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0.02;
  }

  function descriptor(el) {
    return [
      el.getAttribute?.('placeholder'), el.getAttribute?.('aria-label'), el.getAttribute?.('data-testid'),
      el.getAttribute?.('name'), el.getAttribute?.('title'), el.id,
      typeof el.className === 'string' ? el.className : ''
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function nearbyText(el) {
    let node = el;
    const parts = [];
    for (let i = 0; i < 4 && node && node !== document.body; i += 1, node = node.parentElement) {
      const text = String(node.innerText || '').replace(/\s+/g, ' ').trim();
      if (text) parts.push(text.slice(0, 900));
    }
    return parts.join(' ').toLowerCase();
  }

  function findNativeInput() {
    const bad = /(search|pesquisar|filter|filtro|rename|project name|nome do projeto|terminal|shell|console|command palette|find in files|quick open|git commit|commit message)/i;
    const good = /(chat|message|mensagem|prompt|ask|agent|build|change|request|describe|what do you want|how can|send a message|type a message|tell replit|ask replit|start building|make changes)/i;

    const discovered = Array.from(document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"],input[type="text"]'));
    // Keep tracking our currently blocked contenteditable after it becomes contenteditable=false.
    if (nativeInput?.isConnected && !discovered.includes(nativeInput)) discovered.unshift(nativeInput);

    const candidates = discovered
      .filter(visible)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const desc = descriptor(el);
        const context = nearbyText(el);
        if (bad.test(desc) || (bad.test(context) && !good.test(desc))) return null;

        let score = 0;
        if (el.tagName === 'TEXTAREA') score += 30;
        if (el.getAttribute?.('contenteditable') === 'true') score += 20;
        if (good.test(desc)) score += 86;
        else if (good.test(context)) score += 46;
        if (platform === 'replit' && /(agent|replit|build|app)/i.test(`${desc} ${context}`)) score += 24;
        if (r.top > innerHeight * .34) score += 22;
        if (r.width > Math.min(300, innerWidth * .34)) score += 22;
        if (el.closest('form')) score += 10;
        if (r.height > 220) score -= 35;
        return { el, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.score >= 52 ? candidates[0].el : null;
  }

  function chooseNativeTarget(input) {
    if (!input) return null;
    const ir = input.getBoundingClientRect();
    const tokenPattern = /(tokens?|cr[eé]ditos?|upgrade|pro\b|restam|remaining|recursos|resources|usage|limit|checkpoint)/i;
    const chatPattern = /(chat|message|mensagem|prompt|ask|agent|build|change|request|describe|lovable|bolt|replit)/i;
    const profile = platform === 'lovable'
      ? { minHeight: 104, idealMin: 138, idealMax: 390, maxHeight: Math.min(520, innerHeight * .68) }
      : platform === 'bolt'
        ? { minHeight: 96, idealMin: 126, idealMax: 360, maxHeight: Math.min(480, innerHeight * .62) }
        : { minHeight: 88, idealMin: 118, idealMax: 420, maxHeight: Math.min(560, innerHeight * .72) };

    let best = input.parentElement || input;
    let bestScore = -Infinity;
    let node = input;

    for (let i = 0; i < 13 && node && node !== document.body; i += 1, node = node.parentElement) {
      const r = node.getBoundingClientRect();
      if (r.width < Math.max(180, ir.width * .76)) continue;
      if (r.width > innerWidth * .995 || r.height > profile.maxHeight || r.height < profile.minHeight) continue;
      if (!(node === input || node.contains(input))) continue;

      const controls = node.querySelectorAll?.('button,[role="button"]')?.length || 0;
      const text = String(node.innerText || '').slice(0, 2600);
      let score = 0;
      const widthRatio = ir.width ? r.width / ir.width : 1;
      if (widthRatio >= .94 && widthRatio <= 1.85) score += 34;
      if (r.height >= profile.idealMin && r.height <= profile.idealMax) score += 42;
      else score += Math.max(0, 22 - Math.abs(r.height - profile.idealMin) * .08);
      if (r.top > innerHeight * .25) score += 18;
      if (controls >= 2) score += 18;
      if (controls >= 4) score += 8;
      if (chatPattern.test(text) || chatPattern.test(descriptor(node))) score += 24;
      if (tokenPattern.test(text)) score += platform === 'bolt' ? 48 : platform === 'replit' ? 34 : 22;
      if (node.closest?.('form') || node.tagName === 'FORM') score += 12;
      if (platform === 'lovable' && r.height < 132) score -= 40;
      if (r.height > innerHeight * .64) score -= 28;

      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    }
    return best;
  }

  function readAttrState(el, name) {
    return { present: el.hasAttribute(name), value: el.getAttribute(name) };
  }

  function restoreAttrState(el, name, state) {
    if (!el || !state) return;
    if (state.present) el.setAttribute(name, state.value ?? '');
    else el.removeAttribute(name);
  }

  function snapshotTarget(target) {
    return {
      inert: readAttrState(target, 'inert'),
      ariaDisabled: readAttrState(target, 'aria-disabled')
    };
  }

  function snapshotInput(input) {
    return {
      readOnly: readAttrState(input, 'readonly'),
      contentEditable: readAttrState(input, 'contenteditable'),
      tabIndex: readAttrState(input, 'tabindex'),
      ariaDisabled: readAttrState(input, 'aria-disabled')
    };
  }

  function restoreNative() {
    if (nativeTarget && originalTargetState) {
      restoreAttrState(nativeTarget, 'inert', originalTargetState.inert);
      restoreAttrState(nativeTarget, 'aria-disabled', originalTargetState.ariaDisabled);
    }
    if (nativeInput && originalInputState) {
      restoreAttrState(nativeInput, 'readonly', originalInputState.readOnly);
      restoreAttrState(nativeInput, 'contenteditable', originalInputState.contentEditable);
      restoreAttrState(nativeInput, 'tabindex', originalInputState.tabIndex);
      restoreAttrState(nativeInput, 'aria-disabled', originalInputState.ariaDisabled);
    }
    originalTargetState = null;
    originalInputState = null;
  }

  function ensureBlockedState() {
    if (!nativeTarget?.isConnected || !nativeInput?.isConnected) return;

    // `inert` blocks mouse, touch and keyboard focus without changing the native visuals.
    nativeTarget.setAttribute('inert', '');
    nativeTarget.setAttribute('aria-disabled', 'true');
    nativeInput.setAttribute('aria-disabled', 'true');
    nativeInput.setAttribute('tabindex', '-1');

    const tag = nativeInput.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') nativeInput.setAttribute('readonly', '');
    if (nativeInput.hasAttribute('contenteditable')) nativeInput.setAttribute('contenteditable', 'false');

    if (document.activeElement === nativeInput || nativeTarget.contains(document.activeElement)) {
      try { document.activeElement?.blur?.(); } catch (_) {}
    }
  }

  function blockNative(target, input) {
    if (!target || !input) return;

    if (target !== nativeTarget || input !== nativeInput || !originalTargetState || !originalInputState) {
      restoreNative();
      nativeTarget = target;
      nativeInput = input;
      originalTargetState = snapshotTarget(target);
      originalInputState = snapshotInput(input);
    }
    ensureBlockedState();
  }

  function cleanupBlocker() {
    restoreNative();
    nativeTarget = null;
    nativeInput = null;
  }

  function scanForTarget(force) {
    if (!isProjectView()) { cleanupBlocker(); return; }
    if (!force && nativeTarget?.isConnected && nativeInput?.isConnected) {
      ensureBlockedState();
      return;
    }

    const input = findNativeInput();
    if (!input) { cleanupBlocker(); return; }
    const target = chooseNativeTarget(input);
    if (!target) { cleanupBlocker(); return; }
    blockNative(target, input);
  }

  // Defense-in-depth: cancel trusted user events inside the blocked composer.
  // This covers dynamic editors that temporarily ignore/replace the inert state.
  function guardOfficialComposer(event) {
    if (!blockerEnabled || !nativeTarget?.isConnected) return;
    if (event.isTrusted === false) return;
    const target = event.target;
    if (!target || !(target === nativeTarget || nativeTarget.contains(target))) return;
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    if (event.type === 'focusin') {
      try { target.blur?.(); } catch (_) {}
    }
  }

  const guardedEvents = [
    'beforeinput', 'keydown', 'keypress', 'keyup', 'paste', 'drop',
    'pointerdown', 'mousedown', 'touchstart', 'click', 'focusin'
  ];
  guardedEvents.forEach((type) => document.addEventListener(type, guardOfficialComposer, true));

  function onStorageChange(changes) {
    if (!changes[BLOCK_ENABLED_KEY]) return;
    blockerEnabled = changes[BLOCK_ENABLED_KEY].newValue !== false;
    if (!blockerEnabled) cleanupBlocker();
    else scanCountdown = 0;
  }

  function frameLoop() {
    if (destroyed) return;

    if (blockerEnabled !== true) {
      if (blockerEnabled === false && (nativeTarget || nativeInput)) cleanupBlocker();
      requestAnimationFrame(frameLoop);
      return;
    }

    if (location.href !== lastUrl) {
      lastUrl = location.href;
      cleanupBlocker();
      scanCountdown = 0;
    }

    if (!isProjectView()) {
      if (nativeTarget || nativeInput) cleanupBlocker();
    } else if (scanCountdown <= 0 || !nativeTarget?.isConnected || !nativeInput?.isConnected) {
      scanForTarget(true);
      scanCountdown = 12;
    } else {
      scanCountdown -= 1;
      ensureBlockedState();
    }

    requestAnimationFrame(frameLoop);
  }

  const observer = new MutationObserver(() => { scanCountdown = 0; });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'aria-expanded', 'data-state', 'contenteditable']
  });

  addEventListener('pagehide', () => {
    destroyed = true;
    observer.disconnect();
    guardedEvents.forEach((type) => document.removeEventListener(type, guardOfficialComposer, true));
    cleanupBlocker();
  }, { once: true });

  chrome.storage.onChanged.addListener(onStorageChange);
  chrome.storage.local.get(BLOCK_ENABLED_KEY, (data) => {
    blockerEnabled = data?.[BLOCK_ENABLED_KEY] !== false;
    if (!blockerEnabled) cleanupBlocker();
    scanCountdown = 0;
  });

  requestAnimationFrame(frameLoop);
  console.log(`[LoveBoltReplit Chat Blocker] v3.48.0 loaded for ${platformLabel} (native composer visible, interaction blocked)`);
})();
