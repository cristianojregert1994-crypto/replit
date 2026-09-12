/**
 * LoveBoltReplit GPT Connector - Dual Route Command Sender (v3.48.0)
 *
 * Corrige o envio pelos botões Chat oficial / Chat GitHub:
 * - mostra o comando imediatamente no histórico da extensão;
 * - usa delegação de clique para sobreviver a re-renderizações do painel;
 * - mantém as rotas totalmente separadas;
 * - exibe status Enviando / Enviado / Erro no próprio chat da extensão.
 */
(function () {
  'use strict';

  if (window.__CHAT_COMMAND_SENDER_LOADED__) return;
  window.__CHAT_COMMAND_SENDER_LOADED__ = true;

  const LEGACY_HISTORY_KEY = 'chatSentHistory';
  const HISTORY_KEY_PREFIX = 'chatSentHistory:';
  const HISTORY_MIGRATION_KEY = 'chatSentHistoryMigratedV348';
  const DRAFT_KEY = 'loveboltChatDraft';
  const ROUTE_KEY = 'loveboltChatRoute';
  const HISTORY_LIMIT = 200;
  const SEND_TIMEOUT_MS = 30000;
  const MAX_ATTACHMENT_COUNT = 10;
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
  const MAX_ATTACHMENTS_TOTAL_BYTES = 20 * 1024 * 1024;

  function ensureHistoryUI() {
    if (!document.getElementById('loveboltHistoryRuntimeStyles')) {
      const style = document.createElement('style');
      style.id = 'loveboltHistoryRuntimeStyles';
      style.textContent = `
        .lovebolt-history-btn{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 10px;border:1px solid rgba(var(--accent-rgb),.28);border-radius:999px;background:rgba(var(--accent-rgb),.08);color:var(--text);font:700 11px/1 inherit;cursor:pointer}.lovebolt-history-btn.is-open,.lovebolt-history-btn:hover{border-color:rgba(var(--accent-rgb),.58);background:rgba(var(--accent-rgb),.15)}.lovebolt-history-btn b{min-width:20px;padding:2px 6px;border-radius:999px;background:rgba(var(--accent-rgb),.18);color:var(--accent-bright);font-size:9px}.lovebolt-history-panel{border:1px solid rgba(var(--accent-rgb),.24);border-radius:14px;background:rgba(var(--accent-rgb),.045);overflow:hidden}.lovebolt-history-panel[hidden]{display:none!important}.lovebolt-history-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(var(--accent-rgb),.16)}.lovebolt-history-head strong,.lovebolt-history-head small{display:block}.lovebolt-history-head strong{font-size:12px}.lovebolt-history-head small{margin-top:2px;font-size:9.5px;color:var(--text-secondary)}.lovebolt-history-clear{border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text-secondary);padding:6px 9px;font:700 9px/1 inherit;cursor:pointer}.lovebolt-history-list{max-height:270px;overflow:auto;padding:9px;display:flex;flex-direction:column;gap:8px}.lovebolt-history-empty{padding:22px 12px;text-align:center;color:var(--text-secondary);font-size:10px}.lovebolt-history-empty strong{display:block;margin-bottom:4px;color:var(--text);font-size:11px}`;
      document.head.appendChild(style);
    }

    if (!document.getElementById('chatHistoryBtn')) {
      const host = document.querySelector('.lovebolt-chat-window-actions') || document.querySelector('.lovebolt-chat-topbar');
      if (host) {
        const btn = document.createElement('button');
        btn.className = 'lovebolt-history-btn';
        btn.id = 'chatHistoryBtn';
        btn.type = 'button';
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<span>🕘</span><span>Histórico</span><b id="chatHistoryCount">0</b>';
        host.appendChild(btn);
      }
    }

    if (!document.getElementById('chatHistoryPanel')) {
      const projectBar = document.getElementById('chatProjectLabel');
      const messages = document.getElementById('chatMessages');
      const panel = document.createElement('div');
      panel.className = 'lovebolt-history-panel';
      panel.id = 'chatHistoryPanel';
      panel.hidden = true;
      panel.innerHTML = '<div class="lovebolt-history-head"><div><strong id="chatHistoryTitle">Histórico</strong><small id="chatHistorySubtitle"></small></div><button class="lovebolt-history-clear" id="chatHistoryClearBtn" type="button">Limpar</button></div><div class="lovebolt-history-list" id="chatHistoryList"></div>';
      if (projectBar?.parentNode) projectBar.insertAdjacentElement('afterend', panel);
      else messages?.parentNode?.insertBefore(panel, messages);
    }
  }

  // Histórico visual removido na v4.2.0.
  // ensureHistoryUI();

  const chatContainer = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const statusDot = document.getElementById('chatStatusDot');
  const statusText = document.getElementById('chatStatusText');
  const projectLabel = document.getElementById('chatProjectLabel');
  const historyBtn = document.getElementById('chatHistoryBtn');
  const historyCount = document.getElementById('chatHistoryCount');
  const historyPanel = document.getElementById('chatHistoryPanel');
  const historyList = document.getElementById('chatHistoryList');
  const historyTitle = document.getElementById('chatHistoryTitle');
  const historySubtitle = document.getElementById('chatHistorySubtitle');
  const historyClearBtn = document.getElementById('chatHistoryClearBtn');

  if (!chatContainer || !chatInput) return;

  let projectContext = null;
  let sentHistory = [];
  let pendingSends = 0;
  let selectedRoute = 'github';
  let pendingAttachments = [];
  const attachmentsHost = document.getElementById('chatAttachments');

  chrome.storage.local.remove([
    LEGACY_HISTORY_KEY,
    `${HISTORY_KEY_PREFIX}lovable`,
    `${HISTORY_KEY_PREFIX}bolt`,
    `${HISTORY_KEY_PREFIX}replit`,
    `${HISTORY_KEY_PREFIX}gpt`,
    HISTORY_MIGRATION_KEY
  ]);


  function normalizePlatform(value) {
    const p = String(value || '').toLowerCase();
    return ['lovable','bolt','replit','gpt'].includes(p) ? p : 'lovable';
  }

  function activePlatform() {
    return normalizePlatform(projectContext?.platform || document.body?.dataset?.platform || 'lovable');
  }

  function historyKey(platformName = activePlatform()) {
    return `${HISTORY_KEY_PREFIX}${normalizePlatform(platformName)}`;
  }

  function platformDisplayName(platformName = activePlatform()) {
    const p = normalizePlatform(platformName);
    return p === 'bolt' ? 'Bolt.new' : (p === 'replit' ? 'Replit' : (p === 'gpt' ? 'GPT Studio' : 'Lovable'));
  }

  function updateHistoryHeader() {
    const label = platformDisplayName();
    if (historyTitle) historyTitle.textContent = `Histórico ${label}`;
    if (historySubtitle) historySubtitle.textContent = `Somente envios feitos no ${label}.`;
    if (historyCount) historyCount.textContent = String(sentHistory.length);
  }

  function migrateLegacyHistory(done) {
    chrome.storage.local.get([
      LEGACY_HISTORY_KEY,
      `${HISTORY_KEY_PREFIX}lovable`,
      `${HISTORY_KEY_PREFIX}bolt`,
      `${HISTORY_KEY_PREFIX}replit`,
      HISTORY_MIGRATION_KEY
    ], (data) => {
      if (data?.[HISTORY_MIGRATION_KEY]) { done?.(); return; }
      const legacy = Array.isArray(data?.[LEGACY_HISTORY_KEY]) ? data[LEGACY_HISTORY_KEY] : [];
      const lovable = Array.isArray(data?.[`${HISTORY_KEY_PREFIX}lovable`]) ? data[`${HISTORY_KEY_PREFIX}lovable`].slice() : [];
      const bolt = Array.isArray(data?.[`${HISTORY_KEY_PREFIX}bolt`]) ? data[`${HISTORY_KEY_PREFIX}bolt`].slice() : [];
      const replit = Array.isArray(data?.[`${HISTORY_KEY_PREFIX}replit`]) ? data[`${HISTORY_KEY_PREFIX}replit`].slice() : [];
      const seenLovable = new Set(lovable.map((entry) => entry?.id).filter(Boolean));
      const seenBolt = new Set(bolt.map((entry) => entry?.id).filter(Boolean));
      const seenReplit = new Set(replit.map((entry) => entry?.id).filter(Boolean));
      legacy.forEach((entry) => {
        const target = normalizePlatform(entry?.platform);
        const list = target === 'bolt' ? bolt : (target === 'replit' ? replit : lovable);
        const seen = target === 'bolt' ? seenBolt : (target === 'replit' ? seenReplit : seenLovable);
        if (entry?.id && seen.has(entry.id)) return;
        list.push({ ...entry, platform: target });
        if (entry?.id) seen.add(entry.id);
      });
      chrome.storage.local.set({
        [`${HISTORY_KEY_PREFIX}lovable`]: lovable.slice(-HISTORY_LIMIT),
        [`${HISTORY_KEY_PREFIX}bolt`]: bolt.slice(-HISTORY_LIMIT),
        [`${HISTORY_KEY_PREFIX}replit`]: replit.slice(-HISTORY_LIMIT),
        [HISTORY_MIGRATION_KEY]: true
      }, done);
    });
  }

  function getRouteButtons() {
    return {
      official: document.getElementById('chatOfficialBtn'),
      github: document.getElementById('chatGithubBtn')
    };
  }

  function getAuxButtons() {
    return {
      send: document.getElementById('chatSendBtn'),
      attach: document.getElementById('chatAttachBtn'),
      attachmentInput: document.getElementById('chatAttachmentInput')
    };
  }

  function applyRouteSelection(route) {
    selectedRoute = route === 'official' ? 'official' : 'github';
    const buttons = getRouteButtons();
    Object.entries(buttons).forEach(([key, btn]) => {
      if (!btn) return;
      const active = key === selectedRoute;
      btn.classList.toggle('is-selected', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const aux = getAuxButtons();
    if (aux.send) aux.send.title = `Enviar pela rota selecionada: ${routeLabel(selectedRoute)}`;
    chrome.storage.local.set({ [ROUTE_KEY]: selectedRoute });
  }

  function setButtonsBusy(busy) {
    const buttons = getRouteButtons();
    Object.values(buttons).forEach((btn) => {
      if (!btn) return;
      btn.classList.toggle('is-sending', busy);
      btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    });
  }

  function refreshProject(callback) {
    chrome.storage.local.get('detectedProject', (data) => {
      projectContext = data?.detectedProject || projectContext || null;
      updateProjectBar();
      callback?.(projectContext);
    });
  }

  function loadProject() {
    refreshProject();
  }

  function updateProjectBar() {
    if (!projectLabel) return;
    if (!projectContext) {
      projectLabel.style.display = 'none';
      return;
    }

    projectLabel.style.display = 'flex';
    const nameEl = projectLabel.querySelector('.chat-project-name');
    const repoEl = projectLabel.querySelector('.chat-project-repo');
    const platformLabel = platformDisplayName(projectContext.platform);

    if (nameEl) nameEl.textContent = `${platformLabel} · ${projectContext.name || projectContext.id || ''}`;
    if (repoEl) {
      if (projectContext.repo) repoEl.textContent = projectContext.repo;
      else repoEl.textContent = `ID: ${projectContext.id || ''}`;
    }
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.detectedProject) {
      const previousPlatform = activePlatform();
      projectContext = changes.detectedProject.newValue || null;
      updateProjectBar();
      if (activePlatform() !== previousPlatform) loadHistory();
      else updateHistoryHeader();
    }
    const currentHistoryKey = historyKey();
    if (changes[currentHistoryKey]) {
      const stored = Array.isArray(changes[currentHistoryKey].newValue) ? changes[currentHistoryKey].newValue : [];
      sentHistory = stored.slice(-HISTORY_LIMIT).map(normalizeHistoryEntry);
      renderHistory();
    }
    if (changes[DRAFT_KEY]) {
      const draft = changes[DRAFT_KEY].newValue;
      const sameProject = !draft?.projectId || !projectContext?.id || String(draft.projectId) === String(projectContext.id);
      if (sameProject && typeof draft?.text === 'string' && document.activeElement !== chatInput && chatInput.value !== draft.text) {
        chatInput.value = draft.text;
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });

  loadProject();
  chrome.storage.local.get([DRAFT_KEY, ROUTE_KEY], (data) => {
    const draft = data?.[DRAFT_KEY];
    if (typeof draft?.text === 'string') chatInput.value = draft.text;
    applyRouteSelection(data?.[ROUTE_KEY] === 'official' ? 'official' : 'github');
  });


  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderAttachments() {
    if (!attachmentsHost) return;
    attachmentsHost.innerHTML = '';
    attachmentsHost.hidden = pendingAttachments.length === 0;
    for (const item of pendingAttachments) {
      const chip = document.createElement('div');
      chip.className = 'lovebolt-attachment-chip';
      chip.title = `${item.name} • ${formatBytes(item.size)}`;
      const label = document.createElement('span');
      label.className = 'lovebolt-attachment-name';
      label.textContent = item.name;
      const size = document.createElement('span');
      size.className = 'lovebolt-attachment-size';
      size.textContent = formatBytes(item.size);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'lovebolt-attachment-remove';
      remove.dataset.attachmentId = item.id;
      remove.setAttribute('aria-label', `Remover ${item.name}`);
      remove.title = `Remover ${item.name}`;
      remove.textContent = '×';
      chip.append(label, size, remove);
      attachmentsHost.appendChild(chip);
    }
    const aux = getAuxButtons();
    if (aux.attach) {
      aux.attach.classList.toggle('has-attachments', pendingAttachments.length > 0);
      aux.attach.title = pendingAttachments.length ? `Anexos: ${pendingAttachments.length}. Adicionar mais arquivos` : 'Anexar arquivos';
    }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const currentBytes = pendingAttachments.reduce((sum, item) => sum + Number(item.size || 0), 0);
    let total = currentBytes;
    const errors = [];
    for (const file of incoming) {
      if (pendingAttachments.length >= MAX_ATTACHMENT_COUNT) {
        errors.push(`Limite de ${MAX_ATTACHMENT_COUNT} arquivos atingido.`);
        break;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        errors.push(`${file.name}: máximo ${formatBytes(MAX_ATTACHMENT_BYTES)} por arquivo.`);
        continue;
      }
      if (total + file.size > MAX_ATTACHMENTS_TOTAL_BYTES) {
        errors.push(`Total máximo de anexos: ${formatBytes(MAX_ATTACHMENTS_TOTAL_BYTES)}.`);
        break;
      }
      const duplicate = pendingAttachments.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
      if (duplicate) continue;
      try {
        const dataUrl = await fileToDataUrl(file);
        pendingAttachments.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name || 'arquivo',
          type: file.type || 'application/octet-stream',
          size: file.size || 0,
          lastModified: file.lastModified || 0,
          dataUrl
        });
        total += file.size || 0;
      } catch (error) {
        errors.push(error?.message || `Falha ao anexar ${file.name}`);
      }
    }
    renderAttachments();
    if (errors.length) {
      if (statusText) statusText.textContent = `Anexo não adicionado: ${errors.join(' ')}`;
      if (statusDot) statusDot.className = 'chat-status-dot offline';
    }
  }

  function clearSentAttachments(snapshot) {
    const sentIds = new Set((snapshot || []).map((item) => item.id));
    pendingAttachments = pendingAttachments.filter((item) => !sentIds.has(item.id));
    renderAttachments();
  }

  function setStatus(connected) {
    if (statusDot) statusDot.className = 'chat-status-dot ' + (connected ? 'online' : 'offline');
    if (statusText) statusText.textContent = connected ? 'ChatGPT/GitHub conectado' : 'ChatGPT/GitHub aguardando';
  }

  function checkStatus() {
    chrome.runtime.sendMessage({ type: 'CHAT_GET_STATUS' }, (res) => {
      if (chrome.runtime.lastError) return setStatus(false);
      setStatus(Boolean(res?.connected));
    });
  }

  checkStatus();
  setInterval(checkStatus, 5000);

  function routeLabel(route) {
    return route === 'official' ? 'Chat oficial' : 'Chat GitHub';
  }

  function routeIcon(route) {
    return route === 'official' ? '💜⚡' : '🐙';
  }

  function normalizeHistoryEntry(raw) {
    return {
      id: raw?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: String(raw?.text || ''),
      route: raw?.route === 'official' ? 'official' : 'github',
      routeLabel: raw?.routeLabel || routeLabel(raw?.route),
      status: raw?.status || (raw?.error ? 'error' : 'sent'),
      error: String(raw?.error || ''),
      sentAt: raw?.sentAt || Date.now(),
      projectName: raw?.projectName || '',
      projectId: raw?.projectId || '',
      attachmentNames: Array.isArray(raw?.attachmentNames) ? raw.attachmentNames.map(String).slice(0, MAX_ATTACHMENT_COUNT) : [],
      platform: normalizePlatform(raw?.platform || activePlatform())
    };
  }

  function loadHistory() {
    sentHistory = [];
  }

  function saveHistory() {
    // Histórico persistente desativado: o chat agora prioriza a área de digitação.
  }

  function makeHistoryEntry(text, route, attachments = []) {
    return normalizeHistoryEntry({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      route,
      routeLabel: routeLabel(route),
      status: 'sending',
      sentAt: Date.now(),
      projectName: projectContext?.name || '',
      projectId: projectContext?.id || '',
      attachmentNames: attachments.map((item) => item.name).filter(Boolean),
      platform: activePlatform()
    });
  }

  function addHistoryEntry(entry) {
    // Mantém somente o envio atual em memória para acompanhar o retorno.
    sentHistory = [entry];
  }

  function updateHistoryEntry(id, patch) {
    const index = sentHistory.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    sentHistory[index] = { ...sentHistory[index], ...patch };
  }

  function renderHistory() {
    updateHistoryHeader();
    if (!historyList) return;
    historyList.innerHTML = '';
    if (!sentHistory.length) {
      const empty = document.createElement('div');
      empty.className = 'lovebolt-history-empty';
      empty.innerHTML = `<strong>Nenhum envio no ${platformDisplayName()}</strong><span>Os históricos de Lovable, Bolt e Replit são armazenados separadamente.</span>`;
      historyList.appendChild(empty);
      return;
    }
    sentHistory.forEach(appendHistoryEntry);
    historyList.scrollTop = historyList.scrollHeight;
  }

  function appendHistoryEntry(entry) {
    if (!historyList) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-msg chat-msg--user chat-history-item';
    wrapper.dataset.entryId = entry.id;

    const content = document.createElement('div');
    content.className = 'chat-msg-content';
    content.dataset.route = entry.route;

    const badge = document.createElement('div');
    badge.className = `chat-history-route chat-history-route--${entry.route}`;
    badge.textContent = `${routeIcon(entry.route)} ${entry.routeLabel}`;

    const text = document.createElement('div');
    text.className = 'chat-history-text';
    text.textContent = entry.text;

    const meta = document.createElement('div');
    meta.className = `chat-history-meta chat-history-meta--${entry.status || 'sent'}`;
    const time = new Date(entry.sentAt || Date.now());
    const timeLabel = time.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const statusLabel = entry.status === 'sending'
      ? 'Enviando…'
      : entry.status === 'error'
        ? `Erro: ${entry.error || 'falha no envio'}`
        : 'Enviado';
    const attachmentMeta = entry.attachmentNames?.length ? ` • 📎 ${entry.attachmentNames.length}` : '';
    meta.textContent = `${timeLabel}${entry.projectName ? ` • ${entry.projectName}` : ''}${attachmentMeta} • ${statusLabel}`;

    content.appendChild(badge);
    content.appendChild(text);
    if (entry.attachmentNames?.length) {
      const files = document.createElement('div');
      files.className = 'chat-history-files';
      files.textContent = entry.attachmentNames.join(' · ');
      content.appendChild(files);
    }
    content.appendChild(meta);
    wrapper.appendChild(content);
    historyList.appendChild(wrapper);
    historyList.scrollTop = historyList.scrollHeight;
  }

  function projectPayload() {
    if (!projectContext) return null;
    return {
      name: projectContext.name,
      id: projectContext.id,
      editorUrl: projectContext.editorUrl || projectContext.url || '',
      url: projectContext.url || projectContext.editorUrl || '',
      platform: projectContext.platform || 'lovable',
      platformLabel: projectContext.platformLabel || platformDisplayName(projectContext.platform),
      defaultBranch: projectContext.defaultBranch || '',
      repo: projectContext.repo || '',
      githubRepo: projectContext.githubRepo || '',
      githubVerified: projectContext.githubVerified === true,
      githubBindingSource: projectContext.githubBindingSource || '',
      githubConfidence: Number(projectContext.githubConfidence || 0),
      githubReason: projectContext.githubReason || '',
      githubBinding: projectContext.githubBinding || null,
      suggestedRepo: projectContext.suggestedRepo || '',
      repoCandidates: Array.isArray(projectContext.repoCandidates) ? projectContext.repoCandidates.slice(0, 10) : [],
      slug: projectContext.slug || '',
      projectSlug: projectContext.projectSlug || '',
      replId: projectContext.replId || '',
      uuid: projectContext.uuid || '',
      supabase: projectContext.supabase || null
    };
  }

  function finishPending() {
    pendingSends = Math.max(0, pendingSends - 1);
    setButtonsBusy(pendingSends > 0);
  }

  function sendPrepared(text, route, attachments = pendingAttachments) {
    const attachmentsSnapshot = Array.isArray(attachments) ? attachments.map((item) => ({ ...item })) : [];
    const typedCommand = String(text || '').trim();
    const command = typedCommand || (attachmentsSnapshot.length ? 'Analise os arquivos anexados e execute o pedido com base neles.' : '');
    const targetRoute = route === 'official' ? 'official' : 'github';
    if (!command) return false;

    refreshProject((project) => {
      if (!project) {
        if (statusText) statusText.textContent = 'Selecione/detecte um projeto primeiro.';
        if (statusDot) statusDot.className = 'chat-status-dot offline';
        return;
      }

      const entry = makeHistoryEntry(command, targetRoute, attachmentsSnapshot);
      addHistoryEntry(entry);
      if (statusText) statusText.textContent = `Enviando pelo ${routeLabel(targetRoute)}${attachmentsSnapshot.length ? ` • ${attachmentsSnapshot.length} anexo(s)` : ''}…`;
      if (statusDot) statusDot.className = 'chat-status-dot online';

      pendingSends += 1;
      setButtonsBusy(true);
      const aux = getAuxButtons();
      if (aux.send) aux.send.disabled = true;
      if (aux.attach) aux.attach.disabled = true;

      let settled = false;
      const settle = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        const ok = result?.ok !== false;
        updateHistoryEntry(entry.id, {
          status: ok ? 'sent' : 'error',
          error: ok ? '' : String(result?.error || 'Falha no envio')
        });
        if (ok) {
          chatInput.value = '';
          chrome.storage.local.set({ [DRAFT_KEY]: { text: '', projectId: projectContext?.id || '', platform: projectContext?.platform || '', updatedAt: Date.now() } });
          clearSentAttachments(attachmentsSnapshot);
        }
        if (statusText) statusText.textContent = ok ? 'Enviado com sucesso' : `Erro: ${String(result?.error || 'Falha no envio')}`;
        if (statusDot) statusDot.className = `chat-status-dot ${ok ? 'online' : 'offline'}`;
        setTimeout(checkStatus, 2400);
        const buttons = getAuxButtons();
        if (buttons.send) buttons.send.disabled = false;
        if (buttons.attach) buttons.attach.disabled = false;
        finishPending();
      };

      const timeout = setTimeout(() => {
        settle({ ok: false, error: 'O envio não respondeu em 30 segundos. Verifique se a aba de destino está aberta e recarregada.' });
      }, SEND_TIMEOUT_MS);

      try {
        chrome.runtime.sendMessage({
          type: 'CHAT_SEND',
          route: targetRoute,
          message: command,
          attachments: attachmentsSnapshot.map(({ id, lastModified, ...item }) => item),
          projectContext: projectPayload()
        }, (res) => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) settle({ ok: false, error: lastErr.message });
          else settle(res || { ok: true });
        });
      } catch (error) {
        settle({ ok: false, error: error?.message || String(error) });
      }
    });

    return true;
  }

  function sendFromInput(route) {
    const targetRoute = route === 'official' ? 'official' : 'github';
    applyRouteSelection(targetRoute);
    return sendPrepared(chatInput.value, targetRoute, pendingAttachments);
  }

  // API usada pelos presets. A rota é obrigatória e explícita.
  window.LG_SEND_CHAT_COMMAND = function LGSendChatCommand(text, route) {
    return sendPrepared(text, route);
  };

  document.addEventListener('click', (event) => {
    const attachBtn = event.target?.closest?.('#chatAttachBtn');
    if (attachBtn) {
      event.preventDefault();
      event.stopPropagation();
      const input = getAuxButtons().attachmentInput;
      if (input && !attachBtn.disabled) {
        input.value = '';
        input.click();
      }
      return;
    }
    const removeBtn = event.target?.closest?.('.lovebolt-attachment-remove[data-attachment-id]');
    if (removeBtn) {
      event.preventDefault();
      event.stopPropagation();
      const id = removeBtn.dataset.attachmentId;
      pendingAttachments = pendingAttachments.filter((item) => item.id !== id);
      renderAttachments();
    }
  }, true);

  getAuxButtons().attachmentInput?.addEventListener('change', async (event) => {
    await addFiles(event.target?.files || []);
    event.target.value = '';
  });

  renderAttachments();

  // Delegação: funciona mesmo se os botões forem reconstruídos pelo painel.
  document.addEventListener('click', (event) => {
    const sendBtn = event.target?.closest?.('#chatSendBtn');
    if (sendBtn) {
      event.preventDefault();
      event.stopPropagation();
      sendFromInput(selectedRoute);
      return;
    }

    const btn = event.target?.closest?.('#chatOfficialBtn, #chatGithubBtn, [data-chat-route]');
    if (!btn) return;
    const route = btn.id === 'chatOfficialBtn' || btn.dataset.chatRoute === 'official' ? 'official' : 'github';
    event.preventDefault();
    event.stopPropagation();
    applyRouteSelection(route);
    if (chatInput.value.trim()) sendPrepared(chatInput.value, route);
  }, true);

  // Enter comum não envia para evitar gasto acidental no agente oficial.
  // Ctrl/Cmd+Enter = Chat GitHub.
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendFromInput(selectedRoute);
    }
  });

  chatInput.addEventListener('input', () => {
    chrome.storage.local.set({ [DRAFT_KEY]: { text: chatInput.value, projectId: projectContext?.id || '', platform: projectContext?.platform || '', updatedAt: Date.now() } });
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'CHAT_CONNECTED') setStatus(true);
    if (msg?.type === 'CHAT_DISCONNECTED') setStatus(false);
    // Não respondemos genericamente a todas as mensagens para não disputar
    // sendResponse com outros listeners do sidepanel.
    return false;
  });

  function setHistoryOpen(open) {
    if (!historyPanel || !historyBtn) return;
    historyPanel.hidden = !open;
    historyBtn.classList.toggle('is-open', open);
    historyBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) loadHistory();
  }

  historyBtn?.addEventListener('click', () => setHistoryOpen(Boolean(historyPanel?.hidden)));
  historyClearBtn?.addEventListener('click', () => {
    const platformName = activePlatform();
    const label = platformDisplayName(platformName);
    if (!window.confirm(`Limpar somente o histórico ${label}?`)) return;
    sentHistory = [];
    chrome.storage.local.set({ [historyKey(platformName)]: [] }, renderHistory);
  });

  loadHistory();
  console.log('[Dual Route Sender] Loaded v4.3.0 — tema unificado + chat expandido sem histórico');
})();
