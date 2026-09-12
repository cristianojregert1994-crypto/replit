/**
 * LoveBoltReplit GPT Connector - Background Service Worker (v6.1.0)
 * 
 * Relay hub: sidebar ↔ content-script (ChatGPT tab) ↔ GitHub
 * 
 * Flow:
 *   Sidebar → background → content-script (ChatGPT tab) → types message → monitors response
 *   content-script → background → sidebar (stream updates + final response)
 *   GitHub writes require an explicit action
 */

importScripts('runtime-config.js', 'github-utils.js', 'project-context.js', 'github-write-utils.js');

// ── State ──
// Bootstrap identities plus a small set of persisted verified bindings used only as recovery seeds.
// Every repository is still revalidated against the currently connected GitHub account before write operations.
const VERIFIED_LOVABLE_PROJECTS = [
  // Bootstrap apenas dos projetos Lovable que o usuário decidiu manter na conta GitHub nova.
  // Outros projetos descobertos pela página podem entrar dinamicamente, mas só aparecem na UI
  // quando um repositório acessível pelo token GitHub atual for confirmado.
  { id: '6b1eb6de-aec6-4bd2-bcaa-385ad2b75c9b', name: 'CRCELL ASSISTENCIA TECNICA', slug: 'crcellassistenciatecnica', repo: 'cristianojregert1994-crypto/crcellassistenciatecnica', defaultBranch: 'main', workspace: "Crcell_01's Lovable", databaseEnabled: true, databaseStack: 'supabase', source: 'verified-snapshot', githubBindingSource: 'verified-snapshot', githubVerified: true, githubConfidence: 100, githubReason: 'Vínculo confirmado por ID do projeto e repositório GitHub' },
  { id: 'b9f65276-3d06-41de-a314-5a083f5af2d7', name: 'PAINEL EXTENÇAO', slug: 'licenseengine', repo: 'cristianojregert1994-crypto/licenseengine', defaultBranch: 'main', workspace: "Crcell_01's Lovable", databaseEnabled: true, databaseStack: 'supabase', source: 'verified-snapshot', githubBindingSource: 'verified-snapshot', githubVerified: true, githubConfidence: 100, githubReason: 'Vínculo confirmado por ID do projeto e repositório GitHub' },
  { id: 'f572373f-c345-491b-b019-11eb5df6bfa7', name: 'Projeto Davi Cunha', slug: 'davicunha', repo: 'cristianojregert1994-crypto/davicunha', defaultBranch: 'main', workspace: "Crcell_01's Lovable", databaseEnabled: true, databaseStack: 'supabase', source: 'verified-snapshot', githubBindingSource: 'verified-snapshot', githubVerified: true, githubConfidence: 100, githubReason: 'Vínculo confirmado por ID do projeto e repositório GitHub' }
].map(p => ({
  ...p,
  editorUrl: `https://lovable.dev/projects/${p.id}`,
  url: `https://lovable.dev/projects/${p.id}`, 
  repo: p.repo || '',
  defaultBranch: p.defaultBranch || ''
}));

// Bolt.new bootstrap contains identity only; repository authority is resolved live.
const VERIFIED_BOLT_PROJECTS = [
  {
    id: 'sb1-ttwmtk6k',
    name: 'Chrome Extension Editor',
    slug: 'boltnew1',
    repo: 'cristianojregert1994-crypto/boltnew1',
    defaultBranch: 'main',
    source: 'verified-snapshot',
    githubBindingSource: 'verified-snapshot',
    githubVerified: true,
    githubConfidence: 100,
    githubReason: 'Vínculo confirmado por ID do projeto Bolt.new e repositório GitHub'
  },
  {
    id: 'sb1-cwudjade',
    name: 'CRCELL Tech Repair PWA',
    repo: 'crcell1994-tech/crcell1994-tech',
    defaultBranch: 'main',
    source: 'verified-snapshot',
    githubBindingSource: 'verified-snapshot',
    githubVerified: true,
    githubConfidence: 100,
    githubReason: 'Vínculo previamente confirmado entre o projeto Bolt.new e o GitHub'
  }
].map(p => ({
  ...p,
  platform: 'bolt',
  platformLabel: 'Bolt.new',
  editorUrl: `https://bolt.new/~/${encodeURIComponent(p.id)}`,
  url: `https://bolt.new/~/${encodeURIComponent(p.id)}`
}));


// Replit bootstrap contains identity only; repository authority is resolved live.
const VERIFIED_REPLIT_PROJECTS = [
  {
    id: '532d925c-1791-4404-8c00-9b189ac3bdb7',
    name: 'Assistência Técnica de Celulares',
    slug: 'replitrepositorio',
    repo: 'cristianojregert1994-crypto/replitrepositorio',
    defaultBranch: 'main',
    source: 'verified-snapshot',
    githubBindingSource: 'verified-snapshot',
    githubVerified: true,
    githubConfidence: 100,
    githubReason: 'Vínculo confirmado por UUID Replit e repositório GitHub'
  }
].map(p => ({
  ...p,
  platform: 'replit',
  platformLabel: 'Replit',
  editorUrl: 'https://replit.com/',
  url: 'https://replit.com/'
}));


// GPT Studio bootstrap + recovery seed. Diferente dos builders externos, o GPT Studio
// não possui uma página pública para ser varrida. Portanto a identidade precisa ser
// recuperável pelo GitHub mesmo depois de atualizar ou reinstalar a extensão.
const GPT_PROJECT_METADATA_PATH = '.crcell/project.json';
const LEGACY_GPT_PROJECT_METADATA_PATH = '.crcell-preview/project.json';
const VERIFIED_GPT_PROJECTS = [
  {
    id: 'gpt-mt98xvek-itsck7',
    name: 'CRCell Importados',
    slug: 'crcell-importados',
    repo: 'cristianojregert1994-crypto/crcell-importados',
    defaultBranch: 'main',
    source: 'verified-snapshot',
    githubBindingSource: 'verified-snapshot',
    githubVerified: true,
    githubConfidence: 100,
    githubReason: 'Vínculo confirmado entre o projeto GPT Studio e o repositório GitHub'
  }
].map(p => ({
  ...p,
  platform: 'gpt',
  platformLabel: 'GPT Studio',
  projectSource: 'gpt',
  themePreset: 'light',
  ledPreset: 'black',
  url: ''
}));

let state = {
  github: { connected: false, token: null, user: null, repos: [] },
  supabase: { connected: false, url: null, anonKey: null, pendingUrl: null, status: 'idle', projectId: null },
  supabaseByProject: {},
  detectedProject: null,
  lovableProjects: VERIFIED_LOVABLE_PROJECTS.map(p => ({ ...p, platform: 'lovable', platformLabel: 'Lovable' })),
  boltProjects: VERIFIED_BOLT_PROJECTS.map(p => ({ ...p })),
  replitProjects: VERIFIED_REPLIT_PROJECTS.map(p => ({ ...p })),
  gptProjects: VERIFIED_GPT_PROJECTS.map(p => ({ ...p })),
  chatgptTabId: null,
  embeddedChatConnected: false,
  chatConnected: false,
  lastChatRoute: null
};

let dualPanelPort = null;
let dualPanelRequestSeq = 0;
const dualPanelPending = new Map();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'crcell-dual-panel') return;
  dualPanelPort = port;

  port.onMessage.addListener((msg) => {
    if (msg?.type !== 'EMBEDDED_CHAT_RESULT' || !msg.requestId) return;
    const pending = dualPanelPending.get(msg.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    dualPanelPending.delete(msg.requestId);
    const result = msg.result || { ok: true };
    state.chatConnected = result.ok !== false;
    pending.callback(result);
  });

  port.onDisconnect.addListener(() => {
    if (dualPanelPort === port) dualPanelPort = null;
    state.embeddedChatConnected = false;
    for (const [requestId, pending] of dualPanelPending) {
      clearTimeout(pending.timer);
      pending.callback({ ok: false, error: 'O painel duplo foi fechado durante o envio.' });
      dualPanelPending.delete(requestId);
    }
    if (!state.chatgptTabId) {
      state.chatConnected = false;
      broadcast({ type: 'CHAT_DISCONNECTED' });
    }
  });
});

function sendToEmbeddedChat(message, callback) {
  if (!dualPanelPort || !state.embeddedChatConnected) return false;
  const requestId = `embedded-${Date.now()}-${++dualPanelRequestSeq}`;
  const timer = setTimeout(() => {
    const pending = dualPanelPending.get(requestId);
    if (!pending) return;
    dualPanelPending.delete(requestId);
    pending.callback({ ok: false, error: 'O ChatGPT embutido não respondeu. Recarregue a metade direita.' });
  }, 15000);
  dualPanelPending.set(requestId, { callback, timer });
  try {
    dualPanelPort.postMessage({ type: 'EMBEDDED_CHAT_DELIVER', requestId, payload: message });
  } catch (error) {
    clearTimeout(timer);
    dualPanelPending.delete(requestId);
    state.embeddedChatConnected = false;
    return false;
  }
  return true;
}

function publicGithubState() {
  const { token, ...safe } = state.github || {};
  return safe;
}

async function persistGithubState() {
  const safe = publicGithubState();
  await chrome.storage.local.set({ github: safe });
  if (state.github?.token) await chrome.storage.local.set({ githubToken: state.github.token });
  else await chrome.storage.local.remove('githubToken');
}

function sanitizeLegacyGithubState(raw, storedToken) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const token = normalizeGithubToken(storedToken || source.token || '');
  const { token: _legacyToken, ...safe } = source;
  return { connected: !!safe.connected, user: safe.user || null, repos: Array.isArray(safe.repos) ? safe.repos : [], ...safe, token };
}

chrome.storage.local.get(['github', 'githubToken', 'supabase', 'supabaseByProject', 'detectedProject', 'lovableProjects', 'boltProjects', 'replitProjects', 'gptProjects'], (data) => {
  if (data.github || data.githubToken) {
    state.github = sanitizeLegacyGithubState(data.github, data.githubToken);
    // One-time migration: token is isolated from the public GitHub metadata object.
    persistGithubState().catch(() => {});
  }
  if (data.supabase) state.supabase = data.supabase;
  if (data.supabaseByProject && typeof data.supabaseByProject === 'object') state.supabaseByProject = data.supabaseByProject;
  if (data.detectedProject) {
    state.detectedProject = normalizeProject(data.detectedProject);
    if (state.detectedProject) chrome.storage.local.set({ detectedProject: state.detectedProject });
    else chrome.storage.local.remove('detectedProject');
  }
  if (state.detectedProject?.id) {
    const cached = state.supabaseByProject[state.detectedProject.id];
    if (cached?.url && cached?.anonKey) {
      state.supabase = { ...cached, connected: true, status: 'connected', projectId: state.detectedProject.id };
    } else if (state.supabase?.projectId !== state.detectedProject.id) {
      state.supabase = supabasePlaceholder(state.detectedProject, state.detectedProject.databaseEnabled ? 'available' : 'idle');
    }
    chrome.storage.local.set({ supabase: state.supabase });
  }
  if (Array.isArray(data.lovableProjects) && data.lovableProjects.length) {
    state.lovableProjects = mergeProjectArrays(VERIFIED_LOVABLE_PROJECTS, data.lovableProjects);
    // Grave imediatamente o merge: remove o estado antigo em que a sidebar lia do storage
    // antes da reconciliação e acabava sem nenhum projeto/repositório visível.
    chrome.storage.local.set({ lovableProjects: state.lovableProjects });
  } else {
    chrome.storage.local.set({ lovableProjects: state.lovableProjects });
  }
  if (Array.isArray(data.boltProjects)) {
    state.boltProjects = mergeBoltProjectArrays(VERIFIED_BOLT_PROJECTS, data.boltProjects);
  } else {
    state.boltProjects = mergeBoltProjectArrays(VERIFIED_BOLT_PROJECTS, []);
    chrome.storage.local.set({ boltProjects: state.boltProjects });
  }
  if (Array.isArray(data.replitProjects)) state.replitProjects = mergeReplitProjectArrays(VERIFIED_REPLIT_PROJECTS, data.replitProjects);
  else state.replitProjects = mergeReplitProjectArrays(VERIFIED_REPLIT_PROJECTS, []);
  chrome.storage.local.set({ replitProjects: state.replitProjects });
  if (Array.isArray(data.gptProjects)) state.gptProjects = mergeGptProjectArrays(VERIFIED_GPT_PROJECTS, data.gptProjects);
  else state.gptProjects = mergeGptProjectArrays(VERIFIED_GPT_PROJECTS, []);
  chrome.storage.local.set({ gptProjects: state.gptProjects });

  // On restart, validate and reconnect GitHub associations for all builders.
  if (state.github?.connected && state.github?.token) {
    setTimeout(() => refreshGithubRepositoryInventory().catch(() => reconcileAllProjectGithub().catch(() => {})), 50);
  }

  // If the extension restarts with GitHub + a selected project already saved, reconnect that project's DB automatically.
  if (state.github?.connected && state.detectedProject?.id && (state.detectedProject.platform || 'lovable') === 'lovable') {
    setTimeout(() => {
      resolveProjectConnections(state.detectedProject).then((resolved) => {
        if (resolved?.project) {
          state.detectedProject = normalizeLovableProject(resolved.project);
          chrome.storage.local.set({ detectedProject: state.detectedProject });
          mergeLovableProjects([state.detectedProject]);
          broadcast({ type: 'PROJECT_DETECTED', project: state.detectedProject });
        }
      }).catch(() => {});
    }, 100);
  }
});

// ── Find ChatGPT Tab ──
function findChatGptTab(callback) {
  if (state.chatgptTabId) {
    chrome.tabs.get(state.chatgptTabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        state.chatgptTabId = null;
        state.chatConnected = false;
        searchForTab(callback);
      } else {
        callback(tab);
      }
    });
  } else {
    searchForTab(callback);
  }
}

function searchForTab(callback) {
  chrome.tabs.query({}, (tabs) => {
    const chatTab = tabs.find(t =>
      t.url && (t.url.includes('chatgpt.com') || t.url.includes('chat.openai.com'))
    );
    if (chatTab) {
      state.chatgptTabId = chatTab.id;
      state.chatConnected = true;
      callback(chatTab);
    } else {
      state.chatConnected = false;
      callback(null);
    }
  });
}

function sendToChatTab(message, callback) {
  // v4.0.0: o ChatGPT embutido na metade direita é o destino preferencial.
  if (sendToEmbeddedChat(message, callback)) return;
  findChatGptTab((tab) => sendToResolvedChatTab(tab, message, callback));
}

function sendToResolvedChatTab(tab, message, callback) {
  if (!tab) {
    callback({ ok: false, error: 'ChatGPT não conectado. Abra/recarregue a metade direita ou abra chatgpt.com em uma aba.' });
    return;
  }

  chrome.tabs.sendMessage(tab.id, message, (response) => {
    if (chrome.runtime.lastError) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js']
      }, () => {
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, message, (retryResponse) => {
            if (chrome.runtime.lastError) {
              state.chatConnected = false;
              callback({ ok: false, error: 'Não foi possível conectar ao ChatGPT. Recarregue o ChatGPT.' });
            } else {
              callback(retryResponse || { ok: true });
            }
          });
        }, 1000);
      });
    } else {
      callback(response || { ok: true });
    }
  });
}

function clearProjectGithubBinding(project) {
  if (!project) return project;
  return withCanonicalGithubBinding({
    ...project,
    repo: '', githubRepo: '', github_repo: '', matchedRepo: null,
    defaultBranch: project.defaultBranch || '',
    githubVerified: false, githubManual: false,
    githubBindingSource: '', githubConfidence: 0, githubReason: '',
    githubRepoEmpty: false, githubHasCode: undefined,
    suggestedRepo: ''
  });
}

function clearCachedGithubBindings() {
  state.lovableProjects = (state.lovableProjects || []).map(clearProjectGithubBinding).filter(Boolean);
  state.boltProjects = (state.boltProjects || []).map(clearProjectGithubBinding).filter(Boolean);
  state.replitProjects = (state.replitProjects || []).map(clearProjectGithubBinding).filter(Boolean);
  state.gptProjects = (state.gptProjects || []).map(clearProjectGithubBinding).filter(Boolean);
  if (state.detectedProject) state.detectedProject = clearProjectGithubBinding(state.detectedProject);
  chrome.storage.local.set({
    lovableProjects: state.lovableProjects,
    boltProjects: state.boltProjects,
    replitProjects: state.replitProjects,
    gptProjects: state.gptProjects,
    detectedProject: state.detectedProject
  });
}

// ── Message Router ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[BG] Message:', msg.type);

  switch (msg.type) {
    // ── GitHub ──
    case 'GITHUB_CONNECT':
    case 'CONNECT_GITHUB': // legacy popup alias
      handleGitHubConnect(msg.token, sendResponse);
      return true;

    case 'GITHUB_DISCONNECT':
    case 'DISCONNECT_GITHUB': // legacy popup alias
      state.github = { connected: false, token: null, user: null, repos: [] };
      clearCachedGithubBindings();
      persistGithubState().catch(() => {});
      broadcast({ type: 'GITHUB_STATUS', ...publicGithubState() });
      sendResponse({ ok: true });
      break;

    case 'GITHUB_SYNC':
      syncGitHub(sendResponse);
      return true;

    case 'CREATE_GITHUB_REPOSITORY':
      createGithubRepositoryForProject(msg, sendResponse);
      return true;

    case 'FORCE_REPOSITORY_DISCOVERY':
      forceRepositoryDiscovery(sendResponse);
      return true;

    case 'GITHUB_STATUS':
      sendResponse(publicGithubState());
      break;

    // ── Supabase ──
    case 'SUPABASE_CONNECT': {
      const projectId = msg.projectId || state.detectedProject?.id || null;
      const next = {
        connected: true,
        url: msg.url,
        anonKey: msg.anonKey,
        pendingUrl: null,
        status: 'connected',
        projectId,
        projectRef: projectRefFromUrl(msg.url),
        databaseEnabled: true,
        stack: 'supabase',
        source: msg.source || 'manual'
      };
      activateSupabase(next, projectId);
      if (state.detectedProject?.id === projectId) {
        const updated = { ...state.detectedProject, supabase: publicSupabaseMeta(next) };
        if (state.detectedProject.platform === 'bolt') mergeBoltProjects([updated]);
        else if (state.detectedProject.platform === 'replit') mergeReplitProjects([updated]);
        else if (state.detectedProject.platform === 'gpt') mergeGptProjects([updated]);
        else mergeLovableProjects([updated]);
      }
      sendResponse({ ok: true, supabase: next });
      break;
    }

    case 'SUPABASE_DISCONNECT': {
      const projectId = msg.projectId || state.detectedProject?.id || state.supabase?.projectId || null;
      if (projectId && state.supabaseByProject[projectId]) {
        delete state.supabaseByProject[projectId];
        chrome.storage.local.set({ supabaseByProject: state.supabaseByProject });
      }
      const fallback = supabasePlaceholder(state.detectedProject, 'available');
      activateSupabase(fallback, projectId, false);
      sendResponse({ ok: true });
      break;
    }

    case 'SUPABASE_STATUS':
      sendResponse(state.supabase);
      break;

    case 'SUPABASE_QUERY':
      handleSupabaseQuery(msg.table, msg.action, msg.data, sendResponse);
      return true;

    // ── Project Detection ──
    case 'LOVABLE_PROJECT_DETECTED':
      handleProjectDetected(msg.project, sendResponse);
      return true;

    case 'BOLT_PROJECT_DETECTED':
      handleBoltProjectDetected(msg.project, sendResponse);
      return true;

    case 'REPLIT_PROJECT_DETECTED':
      handleReplitProjectDetected(msg.project, sendResponse);
      return true;

    case 'GET_DETECTED_PROJECT':
      sendResponse({ project: state.detectedProject });
      break;

    case 'GET_LOVABLE_PROJECTS':
      sendResponse({ projects: projectsVisibleForCurrentGithub(state.lovableProjects) });
      break;

    case 'GET_BOLT_PROJECTS':
      sendResponse({ projects: projectsVisibleForCurrentGithub(state.boltProjects) });
      break;

    case 'GET_REPLIT_PROJECTS':
      sendResponse({ projects: projectsVisibleForCurrentGithub(state.replitProjects) });
      break;

    case 'GET_GPT_PROJECTS':
      sendResponse({ projects: projectsVisibleForCurrentGithub(state.gptProjects) });
      break;

    case 'GET_BUILDER_PROJECTS':
      sendResponse({ projects: [
        ...projectsVisibleForCurrentGithub(state.lovableProjects),
        ...projectsVisibleForCurrentGithub(state.boltProjects),
        ...projectsVisibleForCurrentGithub(state.replitProjects),
        ...projectsVisibleForCurrentGithub(state.gptProjects)
      ] });
      break;

    case 'REGISTER_BUILDER_PROJECT':
      registerBuilderProject(msg, sendResponse);
      return true;

    case 'CREATE_GPT_PROJECT':
      createGptProject(msg, sendResponse);
      return true;





    case 'LOVABLE_PROJECTS_DISCOVERED':
      mergeLovableProjects(msg.projects || []);
      if (state.github?.connected) {
        reconcileAllProjectGithub().then(() => sendResponse({ ok: true, projects: state.lovableProjects })).catch(() => sendResponse({ ok: true, projects: state.lovableProjects }));
        return true;
      }
      sendResponse({ ok: true, projects: state.lovableProjects });
      break;

    case 'LOVABLE_PROJECTS_SYNC':
      syncLovableProjects(sendResponse);
      return true;

    case 'BOLT_PROJECTS_DISCOVERED':
      mergeBoltProjects(msg.projects || []);
      if (state.github?.connected) {
        reconcileAllProjectGithub().then(() => sendResponse({ ok: true, projects: state.boltProjects })).catch(() => sendResponse({ ok: true, projects: state.boltProjects }));
        return true;
      }
      sendResponse({ ok: true, projects: state.boltProjects });
      break;

    case 'BOLT_PROJECTS_SYNC':
      syncBoltProjects(sendResponse);
      return true;

    case 'REPLIT_PROJECTS_DISCOVERED':
      mergeReplitProjects(msg.projects || []);
      if (state.github?.connected) {
        reconcileAllProjectGithub().then(() => sendResponse({ ok: true, projects: state.replitProjects })).catch(() => sendResponse({ ok: true, projects: state.replitProjects }));
        return true;
      }
      sendResponse({ ok: true, projects: state.replitProjects });
      break;

    case 'REPLIT_PROJECTS_SYNC':
      syncReplitProjects(sendResponse);
      return true;

    case 'GPT_PROJECTS_SYNC':
      syncGptProjects(sendResponse);
      return true;

    case 'SELECT_BUILDER_PROJECT': {
      const platform = (msg.platform || '').toLowerCase();
      if (platform === 'bolt') selectBoltProject(msg.projectId, sendResponse);
      else if (platform === 'replit') selectReplitProject(msg.projectId, sendResponse);
      else if (platform === 'gpt') selectGptProject(msg.projectId, sendResponse);
      else selectLovableProject(msg.projectId, sendResponse);
      return true;
    }

    case 'OPEN_BUILDER_PROJECT': {
      const platform = (msg.platform || '').toLowerCase();
      if (platform === 'bolt') openBoltProject(msg.projectId || msg.project, sendResponse);
      else if (platform === 'replit') openReplitProject(msg.projectId || msg.project, sendResponse);
      else if (platform === 'gpt') openGptProject(msg.projectId || msg.project, sendResponse);
      else openLovableProject(msg.projectId || msg.project, sendResponse);
      return true;
    }

    case 'BIND_PROJECT_REPO':
      sendResponse({ ok: false, error: 'Vínculo manual desativado. A extensão detecta o repositório automaticamente.' });
      break;

    case 'SELECT_LOVABLE_PROJECT':
      selectLovableProject(msg.projectId, sendResponse);
      return true;


    // ── Chat Relay ──
    case 'CHAT_SEND':
      Promise.resolve(handleChatSend(msg.message, msg.projectContext, msg.route || 'github', msg.attachments || [], sendResponse))
        .catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }));
      return true;

    // Forward from content script to sidebar
    case 'CHAT_RESPONSE':
    case 'CHAT_STREAM_UPDATE':
    case 'CHAT_STREAM_DONE':
    case 'CHAT_USER_MESSAGE':
    case 'CHAT_TOOL_CONFIRM':
    case 'CHAT_ERROR':
    case 'CHAT_TYPING':
      broadcast(msg);
      sendResponse({ ok: true });
      break;

    case 'CHAT_GET_STATUS':
      sendResponse({ connected: state.chatConnected || state.embeddedChatConnected, tabId: state.chatgptTabId, embedded: state.embeddedChatConnected });
      break;

    case 'CHAT_CONFIRM':
      sendToChatTab({ type: 'CHAT_CONFIRM', action: msg.action, text: msg.text }, (res) => {
        sendResponse(res);
      });
      return true;

    // ── GitHub write guard ──
    case 'AUTO_PUSH_CODE':
      // Automatic writes from assistant code blocks are intentionally disabled.
      sendResponse({ ok: false, skipped: true, error: 'Auto-push desativado. Alterações no GitHub exigem uma ação explícita.' });
      return true;

    case 'PUSH_CODE':
      // Kept only for explicit/manual callers.
      handleAutoPushCode(msg.code, msg.language, 'manual-explicit', sendResponse);
      return true;

    // ── Content Script Registration ──
    case 'CHATGPT_TAB_READY': {
      const tabId = sender.tab?.id || null;
      const tabUrl = String(sender.tab?.url || '');
      const isRealChatTab = !!tabId && /https:\/\/(?:[^/]+\.)?(?:chatgpt\.com|chat\.openai\.com)\//i.test(tabUrl);
      if (isRealChatTab) state.chatgptTabId = tabId;
      else state.embeddedChatConnected = true;
      state.chatConnected = true;
      console.log('[BG] ChatGPT context registered:', isRealChatTab ? `tab ${tabId}` : 'embedded sidepanel');
      broadcast({ type: 'CHAT_CONNECTED' });
      sendResponse({ ok: true, embedded: !isRealChatTab });
      break;
    }

    case 'SIDEPANEL_SET_VISIBILITY':
      handleSidePanelVisibility(msg.visible !== false, sender, sendResponse);
      return true;

    case 'PING':
      sendResponse({ ok: true, state: { chatConnected: state.chatConnected, chatGptTabId: state.chatgptTabId } });
      break;
  }
});

async function handleSidePanelVisibility(visible, sender, sendResponse) {
  try {
    const tabId = sender?.tab?.id;
    const windowId = sender?.tab?.windowId;
    if (!chrome.sidePanel) throw new Error('Side Panel API indisponível neste Chrome.');

    if (visible) {
      if (typeof chrome.sidePanel.open !== 'function') throw new Error('Este Chrome não permite reabrir o sidepanel por API.');
      // open() precisa ser a primeira chamada assíncrona após o clique do content script
      // para preservar o gesto do usuário exigido pelo Chrome.
      await chrome.sidePanel.open(typeof windowId === 'number' ? { windowId } : { tabId });
    } else {
      if (typeof chrome.sidePanel.close === 'function') {
        await chrome.sidePanel.close(typeof windowId === 'number' ? { windowId } : { tabId });
      } else if (typeof tabId === 'number') {
        // Fallback para versões antigas: desabilitar o painel específico fecha/oculta quando aplicável.
        await chrome.sidePanel.setOptions({ tabId, enabled: false });
      } else {
        throw new Error('Não foi possível determinar a aba do sidepanel.');
      }
    }
    broadcast({ type: 'SIDEPANEL_VISIBILITY_CHANGED', visible });
    sendResponse({ ok: true, visible });
  } catch (error) {
    sendResponse({ ok: false, error: error?.message || String(error) });
  }
}

if (chrome.sidePanel?.onOpened) {
  chrome.sidePanel.onOpened.addListener(() => broadcast({ type: 'SIDEPANEL_VISIBILITY_CHANGED', visible: true }));
}
if (chrome.sidePanel?.onClosed) {
  chrome.sidePanel.onClosed.addListener(() => broadcast({ type: 'SIDEPANEL_VISIBILITY_CHANGED', visible: false }));
}

// ── Legacy manual binding disabled ──
async function bindProjectRepository(_msg, sendResponse) {
  sendResponse({ ok: false, error: 'Vínculo manual desativado. A extensão detecta o repositório automaticamente.' });
}

// ── Dual Route Send ──
async function handleChatSend(message, projectContext, route, attachments, sendResponse) {
  const targetRoute = route === 'official' ? 'official' : 'github';
  if (!message || !String(message).trim()) {
    sendResponse({ ok: false, error: 'Mensagem vazia.' });
    return;
  }
  if (!projectContext) {
    sendResponse({ ok: false, error: 'Projeto não detectado/selecionado.' });
    return;
  }

  if (targetRoute === 'official') {
    state.lastChatRoute = 'official';
    sendToOfficialPlatform(String(message).trim(), projectContext, attachments, sendResponse);
    return;
  }

  const platform = String(projectContext.platform || 'lovable').toLowerCase();
  const pool = platform === 'bolt' ? state.boltProjects : (platform === 'replit' ? state.replitProjects : (platform === 'gpt' ? state.gptProjects : state.lovableProjects));
  const stored = pool.find(p => String(p.id) === String(projectContext.id)) || null;
  const mergedContext = { ...(stored || {}), ...projectContext };
  if (!repoFullName(projectContext?.repo) && stored?.repo) mergedContext.repo = stored.repo;
  if (!projectContext?.githubBindingSource && stored?.githubBindingSource) mergedContext.githubBindingSource = stored.githubBindingSource;
  if (!projectContext?.githubReason && stored?.githubReason) mergedContext.githubReason = stored.githubReason;
  if (!projectContext?.githubConfidence && stored?.githubConfidence) mergedContext.githubConfidence = stored.githubConfidence;
  if (projectContext?.githubVerified !== true && stored?.githubVerified === true && mergedContext.repo === stored.repo) mergedContext.githubVerified = true;
  let resolvedContext = normalizeProject(mergedContext);
  if (state.github?.connected) resolvedContext = await reconcileProjectGithub(resolvedContext);

  // Final send-time recovery: never discard a binding already verified by project ID,
  // README, builder integration or a high-confidence detector merely because GitHub's
  // repository inventory endpoint is temporarily unavailable.
  if (!resolvedContext?.repo) {
    const trusted = trustedGithubBinding(resolvedContext) || trustedGithubBinding(mergedContext) || trustedGithubBinding(stored) || trustedGithubBinding(projectContext);
    if (trusted?.repo) {
      resolvedContext = normalizeProject({
        ...(resolvedContext || mergedContext),
        repo: trusted.repo,
        defaultBranch: resolvedContext?.defaultBranch || trusted.defaultBranch || 'main',
        githubVerified: !!trusted.verified,
        githubBindingSource: trusted.source || 'send-time-recovery',
        githubConfidence: Number(trusted.confidence || 92),
        githubReason: trusted.reason || 'Vínculo recuperado no momento do envio'
      });
    }
  }

  if (!resolvedContext?.repo) {
    const suggestion = resolvedContext?.suggestedRepo ? ` Candidato encontrado: ${resolvedContext.suggestedRepo}; atualize a detecção para a extensão tentar confirmar automaticamente.` : '';
    sendResponse({ ok: false, error: `A extensão ainda não conseguiu localizar automaticamente o repositório GitHub deste projeto.${suggestion}` });
    return;
  }

  const resolvedRepoMeta = findAccessibleGithubRepo(resolvedContext.repo);
  const resolvedBranch = resolvedContext.defaultBranch || resolvedRepoMeta?.default_branch || 'main';
  const liveContent = await githubRepositoryContentState(resolvedContext.repo, resolvedBranch);
  if (liveContent.checked && liveContent.empty) {
    resolvedContext.githubRepoEmpty = true;
    resolvedContext.githubHasCode = false;
    resolvedContext.githubReason = resolvedContext.githubReason || 'Repositório localizado e confirmado, mas ainda sem código na branch consultada';
    if (resolvedRepoMeta) { resolvedRepoMeta.empty = true; resolvedRepoMeta.hasCode = false; resolvedRepoMeta.contentChecked = true; }
  }
  // A stale GitHub size=0 must never block a repository whose root/files exist.
  if (liveContent.checked && liveContent.hasCode) {
    resolvedContext.githubRepoEmpty = false;
    resolvedContext.githubHasCode = true;
    if (resolvedRepoMeta) { resolvedRepoMeta.empty = false; resolvedRepoMeta.hasCode = true; resolvedRepoMeta.contentChecked = true; }
  }

  if (platform === 'bolt') mergeBoltProjects([resolvedContext]);
  else if (platform === 'replit') mergeReplitProjects([resolvedContext]);
  else if (platform === 'gpt') mergeGptProjects([resolvedContext]);
  else mergeLovableProjects([resolvedContext]);

  if (state.detectedProject?.id === resolvedContext.id && String(state.detectedProject?.platform || 'lovable').toLowerCase() === platform) {
    state.detectedProject = resolvedContext;
    chrome.storage.local.set({ detectedProject: resolvedContext });
    broadcast({ type: 'PROJECT_DETECTED', project: resolvedContext });
  }

  state.lastChatRoute = 'github';
  let fullMessage = buildProjectContextMessage(String(message).trim(), resolvedContext);
  const githubGuard = `[ROTA DE EXECUÇÃO: CHAT GITHUB]\nEsta solicitação NÃO deve ser enviada ao agente oficial do Lovable, Bolt.new ou Replit. Projetos GPT Studio devem ser trabalhados diretamente pelo repositório GitHub informado no contexto. NÃO use créditos/tokens do builder. Leia o estado real do repositório/branch antes de alterar, preserve funcionalidades não relacionadas, edite os arquivos corretos e valide a alteração. Se o repositório não estiver acessível, informe isso em vez de acionar o agente oficial da plataforma.\n[FIM DA ROTA]`;
  fullMessage = `${githubGuard}\n\n${fullMessage}`;

  sendToChatTab({ type: 'CHAT_SEND', message: fullMessage, attachments: Array.isArray(attachments) ? attachments : [] }, (response) => sendResponse(response));
}

function findBuilderTab(projectContext, callback) {
  const platform = String(projectContext?.platform || 'lovable').toLowerCase();
  if (platform === 'gpt') { callback(null); return; }
  const hostTest = platform === 'bolt'
    ? (url) => /^https:\/\/([^/]+\.)?bolt\.new\//i.test(url || '')
    : platform === 'replit'
      ? (url) => /^https:\/\/([^/]+\.)?replit\.com\//i.test(url || '')
      : (url) => /^https:\/\/([^/]+\.)?lovable\.dev\//i.test(url || '');
  const projectId = String(projectContext?.id || '').trim();
  const editorUrl = String(projectContext?.editorUrl || projectContext?.url || '').trim();

  chrome.tabs.query({}, (tabs) => {
    const candidates = (tabs || []).filter(t => hostTest(t.url));
    if (!candidates.length) return callback(null);
    const scored = candidates.map(tab => {
      const url = String(tab.url || '');
      let score = tab.active ? 20 : 0;
      if (editorUrl && url === editorUrl) score += 100;
      if (projectId && url.includes(projectId)) score += 80;
      return { tab, score };
    }).sort((a,b) => b.score - a.score);
    callback(scored[0]?.tab || null);
  });
}

function sendToOfficialPlatform(message, projectContext, attachments, sendResponse) {
  findBuilderTab(projectContext, (tab) => {
    if (!tab?.id) {
      sendResponse({ ok: false, error: String(projectContext?.platform || '').toLowerCase() === 'gpt' ? 'Projetos GPT Studio usam o Chat GitHub; não existe builder oficial externo para esta origem.' : 'Abra o projeto selecionado no Lovable, Bolt.new ou Replit antes de usar Chat oficial.' });
      return;
    }

    const platform = String(projectContext?.platform || 'lovable').toLowerCase();
    chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: async (text, platformName, filePayloads) => {
        const visible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = getComputedStyle(el);
          return r.width > 80 && r.height > 18 && r.bottom > 0 && r.top < innerHeight && st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
        };
        const attrText = (el) => [
          el.getAttribute?.('placeholder'), el.getAttribute?.('aria-label'), el.getAttribute?.('data-testid'),
          el.getAttribute?.('name'), el.getAttribute?.('title'), el.id, el.className
        ].filter(Boolean).join(' ').toLowerCase();
        const bad = /(search|pesquisar|filter|filtro|rename|nome do projeto|project name|command palette|terminal)/i;
        const good = /(chat|message|mensagem|prompt|ask|agent|build|change|request|describe|what do you want|send a message|type a message)/i;
        const payloads = Array.isArray(filePayloads) ? filePayloads : [];
        const dataUrlToFile = (item) => {
          const raw = String(item?.dataUrl || '');
          const match = raw.match(/^data:([^;,]*)(;base64)?,(.*)$/s);
          if (!match) throw new Error(`Anexo inválido: ${item?.name || 'arquivo'}`);
          const mime = match[1] || item?.type || 'application/octet-stream';
          const bytes = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
          const array = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
          return new File([array], item?.name || 'arquivo', { type: mime });
        };
        const uploadFiles = async () => {
          if (!payloads.length) return { ok: true, count: 0 };
          let fileInput = Array.from(document.querySelectorAll('input[type="file"]')).find(el => !el.disabled) || null;
          if (!fileInput) {
            const attachButton = Array.from(document.querySelectorAll('button,[role="button"]')).find((btn) => {
              const label = [btn.getAttribute?.('aria-label'), btn.getAttribute?.('title'), btn.textContent].filter(Boolean).join(' ').toLowerCase();
              return /(attach|anex|upload|arquivo|file|paperclip|clipe)/i.test(label) && visible(btn);
            });
            attachButton?.click?.();
            await new Promise(resolve => setTimeout(resolve, 250));
            fileInput = Array.from(document.querySelectorAll('input[type="file"]')).find(el => !el.disabled) || null;
          }
          if (!fileInput) return { ok: false, error: `O ${platformName} não expôs um campo de upload de arquivos nesta tela.` };
          try {
            const transfer = new DataTransfer();
            payloads.forEach(item => transfer.items.add(dataUrlToFile(item)));
            fileInput.files = transfer.files;
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 500));
            return { ok: true, count: transfer.files.length };
          } catch (error) {
            return { ok: false, error: error?.message || String(error) };
          }
        };
        const uploadResult = await uploadFiles();
        if (!uploadResult.ok) return uploadResult;

        const candidates = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"], input[type="text"]'))
          .filter(visible)
          .filter(el => !bad.test(attrText(el)))
          .map(el => {
            const r = el.getBoundingClientRect();
            let score = 0;
            if (el.tagName === 'TEXTAREA') score += 30;
            if (el.getAttribute?.('contenteditable') === 'true') score += 20;
            if (good.test(attrText(el))) score += 70;
            if (r.top > innerHeight * .45) score += 25;
            if (r.width > Math.min(420, innerWidth * .45)) score += 20;
            if (el.closest('form')) score += 12;
            return { el, score };
          })
          .sort((a,b) => b.score - a.score);

        const input = candidates[0]?.el;
        if (!input) return { ok: false, error: `Campo do Chat oficial não encontrado no ${platformName}.` };
        input.focus();

        try {
          if (input.isContentEditable) {
            input.textContent = text;
            input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
          } else {
            const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) setter.call(input, text); else input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } catch (_) {
          if (input.isContentEditable) input.textContent = text; else input.value = text;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const form = input.closest('form');
        const scopes = [input.parentElement, input.parentElement?.parentElement, form, document].filter(Boolean);
        let buttons = [];
        for (const scope of scopes) {
          buttons.push(...Array.from(scope.querySelectorAll?.('button, [role="button"]') || []));
          if (buttons.length > 40) break;
        }
        buttons = [...new Set(buttons)].filter(visible).filter(btn => !btn.disabled && btn.getAttribute?.('aria-disabled') !== 'true');
        const scoredButtons = buttons.map(btn => {
          const label = [btn.getAttribute?.('aria-label'), btn.getAttribute?.('title'), btn.getAttribute?.('data-testid'), btn.textContent].filter(Boolean).join(' ').trim().toLowerCase();
          let score = 0;
          if (/^(send|enviar|submit)$/i.test(label)) score += 100;
          if (/(send|enviar|submit|send message|send prompt|submit prompt)/i.test(label)) score += 70;
          if (/send-button|submit-button|chat-send/i.test(label)) score += 80;
          const br = btn.getBoundingClientRect(), ir = input.getBoundingClientRect();
          const dx = Math.abs(br.left - ir.right), dy = Math.abs(br.top - ir.top);
          if (dx < 220 && dy < 120) score += 35;
          if (form && btn.closest('form') === form) score += 20;
          return { btn, score, label };
        }).sort((a,b) => b.score - a.score);

        const send = scoredButtons.find(x => x.score >= 60)?.btn;
        if (send) {
          send.click();
          return { ok: true, method: 'button', platform: platformName };
        }
        if (form && typeof form.requestSubmit === 'function') {
          form.requestSubmit();
          return { ok: true, method: 'form', platform: platformName };
        }
        return { ok: false, error: `Mensagem preenchida, mas o botão Enviar do ${platformName} não foi encontrado. Nenhum envio foi feito.` };
      },
      args: [message, platform, Array.isArray(attachments) ? attachments : []]
    }, (results) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      const values = (results || []).map(r => r.result).filter(Boolean);
      const success = values.find(v => v.ok);
      if (success) {
        sendResponse({ ...success, route: 'official', tabId: tab.id });
      } else {
        sendResponse(values[0] || { ok: false, error: 'Não foi possível localizar o chat oficial nesta página.' });
      }
    });
  });
}

// ── GitHub Connect ──
async function fetchAllGithubRepos(token) {
  const headers = githubAuthHeaders(token);
  const dedup = new Map();
  let primaryStatus = 0;

  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`https://api.github.com/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&per_page=100&page=${page}&sort=updated`, { headers });
    if (!res.ok) {
      primaryStatus = res.status;
      break;
    }
    const batch = await res.json();
    if (!Array.isArray(batch)) break;
    for (const repo of batch) if (repo?.full_name) dedup.set(repo.full_name.toLowerCase(), mapGithubRepo(repo));
    if (batch.length < 100) break;
  }

  // Fallback para tokens fine-grained/installation que acessam repos específicos mas
  // não expõem /user/repos. Descubra o owner pelas evidências já detectadas e carregue
  // pelo menos os repositórios públicos desse owner; os privados conhecidos são
  // hidratados diretamente em hydrateDetectedRepoCandidates.
  if (!dedup.size) {
    const owners = new Set();
    if (state.github?.user?.login) owners.add(String(state.github.user.login));
    for (const full of detectedGithubRepoNamesForAuth()) {
      const owner = String(full || '').split('/')[0];
      if (owner) owners.add(owner);
    }
    for (const owner of [...owners].slice(0, 4)) {
      try {
        const res = await fetch(`https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=100&type=owner&sort=updated`, { headers });
        if (!res.ok) continue;
        const batch = await res.json();
        for (const repo of (Array.isArray(batch) ? batch : [])) if (repo?.full_name) dedup.set(repo.full_name.toLowerCase(), mapGithubRepo(repo));
      } catch (_) {}
    }
  }

  if (!dedup.size && primaryStatus) throw new Error(`Falha ao listar repositórios GitHub (${primaryStatus})`);
  return [...dedup.values()];
}

async function fetchGithubRepoDirect(token, fullName) {
  const normalized = repoFullName(fullName);
  if (!normalized) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${normalized}`, { headers: githubAuthHeaders(token) });
    if (!res.ok) return null;
    const repo = await res.json();
    return repo?.full_name ? mapGithubRepo(repo) : null;
  } catch (_) {
    return null;
  }
}

async function hydrateDetectedRepoCandidates(token, repos, extraProjects = []) {
  const dedup = new Map((Array.isArray(repos) ? repos : []).filter(r => r?.full_name).map(r => [r.full_name.toLowerCase(), r]));
  const projects = [...extraProjects, state.detectedProject, ...(state.replitProjects || []), ...(state.boltProjects || []), ...(state.gptProjects || []), ...(state.lovableProjects || [])].filter(Boolean);
  const candidates = new Set();
  for (const project of projects) {
    const direct = [project.repo, project.githubRepo, project.github_repo, project.suggestedRepo, project.matchedRepo?.full_name || project.matchedRepo];
    for (const value of direct) {
      const full = repoFullName(value);
      if (full) candidates.add(full);
    }
    for (const item of (Array.isArray(project.repoCandidates) ? project.repoCandidates : [])) {
      const full = repoFullName(item?.repo || item?.full_name || item);
      if (full) candidates.add(full);
    }
  }
  for (const full of [...candidates].slice(0, 20)) {
    if (dedup.has(full.toLowerCase())) continue;
    const repo = await fetchGithubRepoDirect(token, full);
    if (repo?.full_name) dedup.set(repo.full_name.toLowerCase(), repo);
  }
  return [...dedup.values()];
}

function detectedGithubRepoNamesForAuth() {
  const projects = [
    state.detectedProject,
    ...(state.replitProjects || []),
    ...(state.boltProjects || []),
    ...(state.gptProjects || []),
    ...(state.lovableProjects || [])
  ].filter(Boolean);

  const seen = new Set();
  const names = [];
  const add = (value) => {
    const full = repoFullName(value);
    if (!full) return;
    const key = full.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(full);
  };

  for (const project of projects) {
    add(project.repo);
    add(project.githubRepo);
    add(project.github_repo);
    add(project.suggestedRepo);
    add(project.matchedRepo?.full_name || project.matchedRepo);
    for (const item of (Array.isArray(project.repoCandidates) ? project.repoCandidates : [])) {
      add(item?.repo || item?.full_name || item);
    }
  }
  return names.slice(0, 20);
}

async function identifyGithubAccount(token) {
  const headers = githubAuthHeaders(token);
  let restStatus = 0;

  // 1) Caminho normal para PAT classic/fine-grained.
  try {
    const res = await fetch('https://api.github.com/user', { headers });
    restStatus = res.status;
    if (res.ok) {
      const user = await res.json();
      if (user?.login) {
        return {
          ok: true,
          user: { login: user.login, name: user.name, avatar_url: user.avatar_url, inferred: false },
          repos: [],
          source: 'rest-user'
        };
      }
    }
    if (res.status === 401) return { ok: false, invalid: true, status: 401 };
  } catch (_) {}

  // 2) Alguns tokens/credenciais conseguem usar GraphQL mesmo quando /user é restrito.
  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query { viewer { login name avatarUrl } }' })
    });
    if (res.status === 401) return { ok: false, invalid: true, status: 401 };
    if (res.ok) {
      const data = await res.json();
      const viewer = data?.data?.viewer;
      if (viewer?.login) {
        return {
          ok: true,
          user: { login: viewer.login, name: viewer.name, avatar_url: viewer.avatarUrl, inferred: false },
          repos: [],
          source: 'graphql-viewer'
        };
      }
    }
  } catch (_) {}

  // 3) Fallback para tokens restritos/installation tokens: valide diretamente um repo
  // que o builder já detectou. Uma resposta 200 autenticada prova que a credencial
  // consegue operar naquele projeto, que é o que a extensão realmente precisa.
  const candidates = detectedGithubRepoNamesForAuth();
  for (const fullName of candidates) {
    try {
      const res = await fetch(`https://api.github.com/repos/${fullName}`, { headers });
      if (res.status === 401) return { ok: false, invalid: true, status: 401 };
      if (!res.ok) continue;
      const rawRepo = await res.json();
      if (!rawRepo?.full_name) continue;
      const mappedRepo = mapGithubRepo(rawRepo);
      const ownerLogin = rawRepo?.owner?.login || rawRepo.full_name.split('/')[0];
      return {
        ok: true,
        user: {
          login: ownerLogin,
          name: rawRepo?.owner?.name || null,
          avatar_url: rawRepo?.owner?.avatar_url || '',
          inferred: true
        },
        repos: [mappedRepo],
        source: 'detected-repo'
      };
    } catch (_) {}
  }

  if (restStatus === 403) {
    return {
      ok: false,
      status: 403,
      error: candidates.length
        ? 'Token reconhecido, mas não conseguiu acessar o repositório detectado. Verifique a permissão Contents/Metadata deste repositório.'
        : 'Token reconhecido, mas a conta não pôde ser lida e ainda não há um repositório detectado para validar.'
    };
  }

  return { ok: false, status: restStatus || 0, error: 'Não foi possível validar esta credencial do GitHub' };
}

async function handleGitHubConnect(token, sendResponse) {
  try {
    const cleanToken = normalizeGithubToken(token);
    if (!cleanToken) throw new Error('Informe o token do GitHub');

    const identity = await identifyGithubAccount(cleanToken);
    if (!identity.ok) {
      if (identity.invalid || identity.status === 401) throw new Error('Token inválido ou expirado');
      throw new Error(identity.error || `Falha ao validar GitHub (${identity.status || 'desconhecido'})`);
    }

    const seedRepos = Array.isArray(identity.repos) ? identity.repos : [];
    const previousLogin = String(state.github?.user?.login || '').toLowerCase();
    const nextLogin = String(identity.user?.login || '').toLowerCase();
    if (!previousLogin || (nextLogin && previousLogin !== nextLogin)) clearCachedGithubBindings();

    // CONEXÃO IMEDIATA: qualquer identidade autenticada OU acesso autenticado ao
    // repositório detectado é suficiente para fechar o botão. A listagem completa
    // e a reconciliação rodam depois e não podem desfazer o estado conectado.
    state.github = {
      connected: true,
      token: cleanToken,
      user: identity.user,
      repos: seedRepos,
      repoListWarning: '',
      authSource: identity.source || 'unknown'
    };
    await persistGithubState();

    const initialPublicGithub = publicGithubState();
    broadcast({ type: 'GITHUB_STATUS', ...initialPublicGithub });
    sendResponse({ ok: true, user: state.github.user, repos: seedRepos, github: initialPublicGithub, supabase: state.supabase });

    // O trabalho pesado roda depois do painel já estar em "Conectado".
    (async () => {
      if (seedRepos.length) state.github.repos = seedRepos;
      await refreshGithubRepositoryInventory();
      if (!state.detectedProject?.id) return;

      const reconciled = await reconcileProjectGithub(state.detectedProject);
      if (reconciled) {
        state.detectedProject = normalizeProject(reconciled);
        await chrome.storage.local.set({ detectedProject: state.detectedProject });
        if (state.detectedProject.platform === 'bolt') mergeBoltProjects([state.detectedProject]);
        else if (state.detectedProject.platform === 'replit') mergeReplitProjects([state.detectedProject]);
        else mergeLovableProjects([state.detectedProject]);
        broadcast({ type: 'PROJECT_DETECTED', project: state.detectedProject });
      }

      if ((state.detectedProject?.platform || 'lovable') === 'lovable') {
        const resolved = await resolveProjectConnections(state.detectedProject);
        if (resolved?.project) {
          state.detectedProject = normalizeLovableProject(resolved.project);
          await chrome.storage.local.set({ detectedProject: state.detectedProject });
          mergeLovableProjects([state.detectedProject]);
          broadcast({ type: 'PROJECT_DETECTED', project: state.detectedProject });
        }
      }
    })().catch((error) => {
      console.warn('[GitHub] Credencial conectada; atualização/reconciliação em segundo plano falhou:', error);
    });
  } catch (e) {
    sendResponse({ ok: false, error: e.message });
  }
}


function readmeProjectName(readme, fallback) {
  const firstHeading = String(readme || '').match(/^#\s+(.+)$/m)?.[1]?.replace(/[`*_]/g, '').trim();
  return usefulProjectName(firstHeading) ? firstHeading : String(fallback || '').trim();
}

async function discoverBuilderProjectsFromGithubRepos() {
  if (!state.github?.token) return;
  const lovables = [], bolts = [], replits = [], gpts = [];
  const repos = (state.github?.repos || []).filter(r => r?.full_name).slice(0, 60);
  for (const repo of repos) {
    if (repo.empty === true) continue;
    const branch = repo.default_branch || 'main';

    // GPT Studio: primeiro leia o marcador persistente. Ele é a fonte de identidade
    // mais forte porque contém o ID GPT e não depende do navegador manter storage local.
    const gptMetadataText = (await githubTextFile(repo.full_name, GPT_PROJECT_METADATA_PATH, branch)) || (await githubTextFile(repo.full_name, LEGACY_GPT_PROJECT_METADATA_PATH, branch));
    if (gptMetadataText) {
      try {
        const meta = JSON.parse(gptMetadataText);
        const platform = String(meta?.platform || meta?.projectSource || '').toLowerCase();
        const id = String(meta?.id || meta?.projectId || '').trim();
        if (platform === 'gpt' && id) {
          gpts.push({
            ...meta,
            id,
            name: String(meta?.name || repo.name || id).trim(),
            repo: repo.full_name,
            defaultBranch: String(meta?.defaultBranch || meta?.branch || branch).trim() || branch,
            platform: 'gpt', platformLabel: 'GPT Studio', projectSource: 'gpt',
            themePreset: 'light', ledPreset: 'black', githubVerified: true, githubConfidence: 100,
            githubBindingSource: 'gpt-project-metadata',
            githubReason: 'Projeto GPT Studio recuperado pelo marcador persistente do GitHub',
            source: 'gpt-project-metadata'
          });
        }
      } catch (_) {}
    }

    const readme = await githubTextFile(repo.full_name, 'README.md', branch);
    const text = String(readme || '');
    const name = readmeProjectName(text, repo.name);

    if (text) {
      const lovableIds = new Set();
      for (const m of text.matchAll(/lovable\.dev\/projects\/([a-f0-9-]{20,})/ig)) lovableIds.add(m[1]);
      for (const m of text.matchAll(/id-preview--([a-f0-9-]{20,})\.lovable\.app/ig)) lovableIds.add(m[1]);
      for (const id of lovableIds) lovables.push({ id, name, repo: repo.full_name, defaultBranch: branch, platform: 'lovable', platformLabel: 'Lovable', githubVerified: true, githubConfidence: 100, githubBindingSource: 'github-readme-discovery', githubReason: 'Projeto Lovable identificado pelo README do repositório', source: 'github-readme-discovery' });

      const boltIds = new Set();
      for (const m of text.matchAll(/bolt\.new\/~\/([A-Za-z0-9_-]+)/ig)) boltIds.add(m[1]);
      for (const m of text.matchAll(/bolt\.new\/project\/([A-Za-z0-9_-]+)/ig)) boltIds.add(m[1]);
      for (const id of boltIds) bolts.push({ id, name, repo: repo.full_name, defaultBranch: branch, platform: 'bolt', platformLabel: 'Bolt.new', githubVerified: true, githubConfidence: 100, githubBindingSource: 'bolt-readme-id', githubReason: 'Projeto Bolt.new identificado pelo README do repositório', source: 'github-readme-discovery' });

      for (const m of text.matchAll(/replit\.com\/@([^/\s)]+)\/([^\s)#?]+)/ig)) {
        const id = `@${m[1]}/${m[2]}`;
        replits.push({ id, name, slug: m[2], repo: repo.full_name, defaultBranch: branch, platform: 'replit', platformLabel: 'Replit', editorUrl: `https://replit.com/${id}`, githubVerified: true, githubConfidence: 98, githubBindingSource: 'github-readme-discovery', githubReason: 'Projeto Replit identificado pelo README do repositório', source: 'github-readme-discovery' });
      }
      for (const m of text.matchAll(/replit\.com\/(?:repl|project|workspace|app)\/([A-Za-z0-9_-]{6,})/ig)) {
        const id = m[1];
        replits.push({ id, name, repo: repo.full_name, defaultBranch: branch, platform: 'replit', platformLabel: 'Replit', githubVerified: true, githubConfidence: 98, githubBindingSource: 'github-readme-discovery', githubReason: 'Projeto Replit identificado pelo README do repositório', source: 'github-readme-discovery' });
      }

      // Compatibilidade com projetos GPT legados que documentaram o ID no README,
      // mesmo antes de existir o arquivo .crcell/project.json.
      if (/GPT\s*Studio/i.test(text)) {
        const gptIds = new Set();
        for (const m of text.matchAll(/\bgpt-[a-z0-9][a-z0-9-]{6,}\b/ig)) gptIds.add(m[0]);
        for (const id of gptIds) gpts.push({
          id, name, repo: repo.full_name, defaultBranch: branch, platform: 'gpt', platformLabel: 'GPT Studio',
          projectSource: 'gpt', themePreset: 'light', ledPreset: 'black',
          githubVerified: true, githubConfidence: 99, githubBindingSource: 'gpt-readme-id',
          githubReason: 'Projeto GPT Studio identificado pelo README do repositório', source: 'github-readme-discovery'
        });
      }
    }
  }
  if (lovables.length) mergeLovableProjects(lovables);
  if (bolts.length) mergeBoltProjects(bolts);
  if (replits.length) mergeReplitProjects(replits);
  if (gpts.length) mergeGptProjects(gpts);
}

async function refreshGithubRepositoryInventory() {
  if (!state.github?.token) return [];
  let repos = [];
  let warning = '';
  try { repos = await fetchAllGithubRepos(state.github.token); }
  catch (e) { warning = e?.message || 'Listagem GitHub parcial'; }
  repos = await hydrateDetectedRepoCandidates(state.github.token, repos, [
    ...VERIFIED_LOVABLE_PROJECTS,
    ...VERIFIED_BOLT_PROJECTS,
    ...VERIFIED_REPLIT_PROJECTS,
    ...VERIFIED_GPT_PROJECTS,
    state.detectedProject
  ].filter(Boolean));
  state.github = { ...state.github, connected: true, repos, repoListWarning: warning };
  await persistGithubState();
  broadcast({ type: 'GITHUB_STATUS', connected: true, user: state.github.user, repos, repoListWarning: warning, authSource: state.github.authSource });
  await discoverBuilderProjectsFromGithubRepos();
  await reconcileAllProjectGithub();
  return repos;
}


function projectPool(platform) {
  const p = String(platform || '').toLowerCase();
  if (p === 'bolt') return state.boltProjects;
  if (p === 'replit') return state.replitProjects;
  if (p === 'gpt') return state.gptProjects;
  return state.lovableProjects;
}

function mergeProjectByPlatform(project) {
  const p = String(project?.platform || 'lovable').toLowerCase();
  if (p === 'bolt') mergeBoltProjects([project]);
  else if (p === 'replit') mergeReplitProjects([project]);
  else if (p === 'gpt') mergeGptProjects([project]);
  else mergeLovableProjects([project]);
}

function projectIdentityFromInput(identity, platform) {
  const value = String(identity || '').trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) return value;
  return projectIdFromBuilderUrl(value, platform) || '';
}

async function registerBuilderProject(msg, sendResponse) {
  try {
    const platformRaw = String(msg.platform || '').toLowerCase();
    const platform = ['bolt','replit','gpt'].includes(platformRaw) ? platformRaw : 'lovable';
    const id = projectIdentityFromInput(msg.identity || msg.projectId || msg.url, platform);
    if (!id) throw new Error(`Não foi possível identificar o ID do projeto ${platform === 'bolt' ? 'Bolt.new' : platform === 'replit' ? 'Replit' : 'Lovable'} nessa URL/ID.`);
    const raw = {
      id,
      name: String(msg.name || '').trim() || id,
      platform,
      platformLabel: platform === 'bolt' ? 'Bolt.new' : platform === 'replit' ? 'Replit' : platform === 'gpt' ? 'GPT Studio' : 'Lovable',
      source: 'extension-registration',
      detectedAt: new Date().toISOString()
    };
    if (/^https?:\/\//i.test(String(msg.identity || ''))) raw.editorUrl = String(msg.identity).trim();
    let project = normalizeProject(raw);
    if (!project) throw new Error('Projeto inválido.');
    if (state.github?.connected) project = await reconcileProjectGithub(project);
    mergeProjectByPlatform(project);
    state.detectedProject = project;
    await chrome.storage.local.set({ detectedProject: project });
    broadcast({ type: 'PROJECT_DETECTED', project });
    const cached = state.supabaseByProject[project.id];
    if (cached?.url) activateSupabase({ ...cached, connected: true, status: 'connected', projectId: project.id }, project.id, false);
    sendResponse({ ok: true, project, supabase: state.supabase });
  } catch (error) {
    sendResponse({ ok: false, error: error?.message || String(error) });
  }
}

async function createGithubRepositoryForProject(msg, sendResponse) {
  try {
    if (!state.github?.connected || !state.github?.token) throw new Error('Conecte o GitHub antes de criar o repositório.');
    const name = String(msg.name || '').trim();
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(name)) throw new Error('Nome de repositório inválido. Use apenas letras, números, ponto, hífen ou underline.');
    const platformRaw = String(msg.platform || '').toLowerCase();
    const platform = ['bolt','replit','gpt'].includes(platformRaw) ? platformRaw : 'lovable';
    const projectId = String(msg.projectId || '').trim();
    const current = projectPool(platform).find(p => String(p.id) === projectId)
      || (state.detectedProject?.id === projectId && String(state.detectedProject?.platform || 'lovable').toLowerCase() === platform ? state.detectedProject : null);
    if (!current) throw new Error('Projeto selecionado não encontrado.');

    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: { ...githubAuthHeaders(state.github.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: String(msg.description || '').trim().slice(0, 160),
        private: msg.private !== false,
        auto_init: true
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = Array.isArray(payload?.errors) ? payload.errors.map(e => e?.message || e?.code).filter(Boolean).join(', ') : '';
      throw new Error(payload?.message ? `GitHub: ${payload.message}${detail ? ` (${detail})` : ''}` : `Falha ao criar repositório (${response.status}).`);
    }
    const repo = mapGithubRepo(payload);
    state.github.repos = [...(state.github.repos || []).filter(r => String(r.full_name || '').toLowerCase() !== String(repo.full_name || '').toLowerCase()), repo];
    await persistGithubState();

    const project = normalizeProject({
      ...current,
      repo: repo.full_name,
      githubRepo: repo.full_name,
      defaultBranch: repo.default_branch || 'main',
      githubVerified: true,
      githubManual: false,
      githubBindingSource: 'extension-created-repository',
      githubConfidence: 100,
      githubReason: platform === 'gpt' ? 'Repositório criado e vinculado pelo GPT Studio' : 'Repositório criado e vinculado pela extensão para este ID de projeto',
      source: current.source || 'extension'
    });
    mergeProjectByPlatform(project);
    state.detectedProject = project;
    await chrome.storage.local.set({ detectedProject: project });
    let gptMetadata = null;
    if (platform === 'gpt') {
      try { gptMetadata = await writeGptProjectMetadata(project, repo.full_name, repo.default_branch || 'main'); }
      catch (error) { console.warn('[GPT Studio] Repositório criado, mas o marcador persistente não pôde ser gravado:', error); }
    }
    broadcast({ type: 'PROJECT_DETECTED', project });
    broadcast({ type: 'GITHUB_STATUS', ...publicGithubState() });
    sendResponse({ ok: true, repo, project, gptMetadata, supabase: state.supabase });
  } catch (error) {
    sendResponse({ ok: false, error: error?.message || String(error) });
  }
}

async function syncGitHub(sendResponse) {
  if (!state.github.token) { sendResponse({ ok: false, error: 'Não conectado' }); return; }
  try {
    await refreshGithubRepositoryInventory();
    sendResponse({ ok: true, repos: state.github.repos, lovableProjects: projectsVisibleForCurrentGithub(state.lovableProjects), boltProjects: projectsVisibleForCurrentGithub(state.boltProjects), replitProjects: projectsVisibleForCurrentGithub(state.replitProjects), gptProjects: projectsVisibleForCurrentGithub(state.gptProjects) });
  } catch (e) { sendResponse({ ok: false, error: e.message }); }
}

function builderPlatformFromUrl(url) {
  const value = String(url || '');
  if (/^https:\/\/(?:[^/]+\.)?lovable\.dev\//i.test(value)) return 'lovable';
  if (/^https:\/\/(?:[^/]+\.)?bolt\.new\//i.test(value)) return 'bolt';
  if (/^https:\/\/(?:[^/]+\.)?replit\.com\//i.test(value)) return 'replit';
  return '';
}

function projectIdFromBuilderUrl(url, platform) {
  const value = String(url || '');
  if (platform === 'lovable') return value.match(/\/projects\/([a-f0-9-]{20,})/i)?.[1] || '';
  if (platform === 'bolt') return value.match(/bolt\.new\/(?:~|project)\/([A-Za-z0-9_-]+)/i)?.[1] || '';
  if (platform === 'replit') {
    const byId = value.match(/replit\.com\/(?:repl|project|workspace|app)\/([A-Za-z0-9_-]{6,})/i)?.[1];
    if (byId) return byId;
    const bySlug = value.match(/replit\.com\/@([^/?#]+)\/([^/?#]+)/i);
    return bySlug ? `@${bySlug[1]}/${bySlug[2]}` : '';
  }
  return '';
}

function scanBuilderMessage(platform) {
  if (platform === 'lovable') return { type: 'SCAN_LOVABLE_PROJECTS', file: 'lovable-detect.js' };
  if (platform === 'bolt') return { type: 'SCAN_BOLT_PROJECTS', file: 'bolt-detect.js' };
  if (platform === 'replit') return { type: 'SCAN_REPLIT_PROJECTS', file: 'replit-detect.js' };
  return null;
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message || 'Content script indisponível' });
      else resolve({ ok: true, response: response || null });
    });
  });
}

async function scanBuilderTabWithRecovery(tab) {
  if (!tab?.id) return { ok: false, reason: 'A aba do projeto não possui um identificador utilizável.' };
  const platform = builderPlatformFromUrl(tab.url);
  const scan = scanBuilderMessage(platform);
  if (!scan) return { ok: false, reason: 'A aba ativa não é Lovable, Bolt.new ou Replit.' };

  let result = await sendTabMessage(tab.id, { type: scan.type });
  if (!result.ok) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [scan.file] });
      result = await sendTabMessage(tab.id, { type: scan.type });
    } catch (error) {
      return { ok: false, platform, reason: `Não foi possível ler a página do ${platform}: ${error?.message || result.error || 'falha ao injetar detector'}` };
    }
  }
  if (!result.ok) return { ok: false, platform, reason: result.error || 'Detector da plataforma não respondeu.' };

  const payload = result.response || {};
  const projects = Array.isArray(payload.projects) ? payload.projects : [];
  const urlId = projectIdFromBuilderUrl(tab.url, platform);
  let current = payload.current || null;
  if (!current && urlId) current = projects.find((item) => String(item?.id || '') === String(urlId)) || null;
  if (!current && projects.length === 1) current = projects[0];
  if (!current && state.detectedProject?.id) current = projects.find((item) => String(item?.id || '') === String(state.detectedProject.id)) || null;
  if (!current && urlId) current = { id: urlId, platform, source: 'active-builder-url' };

  return { ok: true, platform, current: current ? normalizeProject({ ...current, platform }) : null, projects, tabUrl: tab.url || '' };
}

async function detectProjectFromOpenBuilder() {
  const allTabs = await chrome.tabs.query({});
  const active = allTabs.find((tab) => tab.active && builderPlatformFromUrl(tab.url));
  const knownId = String(state.detectedProject?.id || '');
  const builders = allTabs.filter((tab) => builderPlatformFromUrl(tab.url));
  const matchingKnown = knownId ? builders.find((tab) => projectIdFromBuilderUrl(tab.url, builderPlatformFromUrl(tab.url)) === knownId) : null;
  const ordered = [active, matchingKnown, ...builders].filter((tab, index, arr) => tab && arr.findIndex((other) => other.id === tab.id) === index);
  const attempts = [];
  for (const tab of ordered) {
    const scanned = await scanBuilderTabWithRecovery(tab);
    attempts.push({ platform: scanned.platform || builderPlatformFromUrl(tab.url), ok: scanned.ok, reason: scanned.reason || '', url: tab.url || '' });
    if (scanned.ok && scanned.current?.id) return { ...scanned, attempts };
  }
  return { ok: false, current: null, attempts, reason: builders.length ? 'As páginas do builder responderam, mas nenhum projeto atual pôde ser identificado.' : 'Nenhuma aba aberta do Lovable, Bolt.new ou Replit foi encontrada.' };
}

async function probeGithubCandidate(fullName, branch) {
  const repo = repoFullName(fullName);
  if (!repo || !state.github?.token) return { repo, ok: false, status: 0, reason: '' };
  try {
    const headers = githubAuthHeaders(state.github.token);
    const metaResponse = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (!metaResponse.ok) {
      const status = metaResponse.status;
      const reason = status === 401
        ? 'Token GitHub inválido ou expirado.'
        : status === 403
          ? 'O token não tem permissão suficiente ou atingiu um limite da API para este repositório.'
          : status === 404
            ? 'O repositório não existe para esta credencial, é privado sem acesso, foi renomeado ou pertence a outra conta.'
            : `GitHub respondeu HTTP ${status} ao consultar o repositório.`;
      return { repo, ok: false, status, reason };
    }
    const meta = await metaResponse.json();
    const resolvedBranch = branch || meta?.default_branch || 'main';
    const branchResponse = await fetch(`https://api.github.com/repos/${repo}/branches/${encodeURIComponent(resolvedBranch)}`, { headers });
    if (!branchResponse.ok) {
      return { repo, ok: false, status: branchResponse.status, branch: resolvedBranch, reason: branchResponse.status === 404 ? `O repositório existe, mas a branch ${resolvedBranch} não foi encontrada.` : `Não foi possível validar a branch ${resolvedBranch} (HTTP ${branchResponse.status}).` };
    }
    return { repo, ok: true, status: 200, branch: resolvedBranch, private: !!meta?.private, defaultBranch: meta?.default_branch || resolvedBranch };
  } catch (error) {
    return { repo, ok: false, status: 0, reason: `Falha de rede ao consultar GitHub: ${error?.message || 'erro desconhecido'}` };
  }
}

function forceDiagnosticStatus(project, probe, repoListWarning, pageScan) {
  if (!state.github?.connected || !state.github?.token) return { code: 'GITHUB_NOT_CONNECTED', label: 'GitHub desconectado', reason: 'Conecte novamente a conta GitHub para permitir a leitura dos repositórios.' };
  if (!project?.id) return { code: 'PROJECT_NOT_DETECTED', label: 'Projeto não detectado', reason: pageScan?.reason || 'Abra o projeto no Lovable, Bolt.new ou Replit e tente novamente.' };
  if (project.repo && probe?.ok && project.githubRepoEmpty) return { code: 'REPOSITORY_EMPTY', label: 'Repo confirmado · sem código', reason: project.githubReason || 'O repositório foi confirmado, mas a branch consultada ainda não contém código.' };
  if (project.repo && probe?.ok) return { code: 'REPOSITORY_CONFIRMED', label: 'Repositório confirmado', reason: project.githubReason || `Repositório ${project.repo} validado na conta GitHub conectada.` };
  if (project.repo && probe && !probe.ok) return { code: probe.status === 404 ? 'REPOSITORY_NO_ACCESS' : 'REPOSITORY_PROBE_FAILED', label: 'Repo detectado · acesso falhou', reason: probe.reason || project.githubReason || 'O projeto aponta para um repositório que a credencial atual não conseguiu validar.' };
  if (project.suggestedRepo) return { code: 'CANDIDATE_UNVERIFIED', label: 'Candidato sem confirmação', reason: project.githubReason || `Foi encontrado o candidato ${project.suggestedRepo}, mas faltou evidência forte para vincular automaticamente.` };
  if (repoListWarning) return { code: 'GITHUB_INVENTORY_FAILED', label: 'Falha ao listar GitHub', reason: repoListWarning };
  if (!(state.github?.repos || []).length) return { code: 'NO_ACCESSIBLE_REPOSITORIES', label: 'Nenhum repo acessível', reason: 'A credencial foi aceita, mas nenhum repositório ficou acessível para a extensão. Verifique acesso a repositórios privados e permissões Contents/Metadata.' };
  return { code: 'NO_STRONG_MATCH', label: 'Repo não identificado', reason: project.githubReason || 'O projeto foi detectado, os repositórios foram lidos, mas não apareceu uma correspondência forte por ID, URL, README, slug, Supabase ou nome único.' };
}

async function forceRepositoryDiscovery(sendResponse) {
  const diagnostic = { startedAt: new Date().toISOString(), steps: [] };
  try {
    if (!state.github?.connected || !state.github?.token) {
      const status = forceDiagnosticStatus(null, null, '', null);
      sendResponse({ ok: false, diagnostic: { ...diagnostic, ...status }, github: publicGithubState(), project: state.detectedProject || null });
      return;
    }

    diagnostic.steps.push('Validando projeto aberto na plataforma');
    const pageScan = await detectProjectFromOpenBuilder();
    let current = pageScan.current || state.detectedProject || null;
    diagnostic.page = { ok: !!pageScan.current, platform: pageScan.platform || current?.platform || '', url: pageScan.tabUrl || '', reason: pageScan.reason || '', attempts: pageScan.attempts || [] };

    if (pageScan.current?.id) {
      current = normalizeProject({ ...(state.detectedProject?.id === pageScan.current.id ? state.detectedProject : {}), ...pageScan.current });
      if (current.platform === 'bolt') mergeBoltProjects([current]);
      else if (current.platform === 'replit') mergeReplitProjects([current]);
      else mergeLovableProjects([current]);
      state.detectedProject = current;
      await chrome.storage.local.set({ detectedProject: current });
    }

    if (!current?.id) {
      const status = forceDiagnosticStatus(null, null, '', pageScan);
      sendResponse({ ok: false, project: null, github: publicGithubState(), diagnostic: { ...diagnostic, ...status, finishedAt: new Date().toISOString() } });
      return;
    }

    diagnostic.steps.push('Atualizando inventário real do GitHub');
    let inventoryError = '';
    try { await refreshGithubRepositoryInventory(); }
    catch (error) { inventoryError = error?.message || 'Falha ao atualizar repositórios'; }

    // refreshGithubRepositoryInventory reconcilia todas as listas. Reconcile de novo o projeto
    // ativo para garantir que evidências recém-lidas da página tenham prioridade.
    diagnostic.steps.push('Cruzando projeto aberto com os repositórios acessíveis');
    current = normalizeProject(await reconcileProjectGithub({ ...(state.detectedProject?.id === current.id ? state.detectedProject : {}), ...current })) || current;
    state.detectedProject = current;
    await chrome.storage.local.set({ detectedProject: current });
    if (current.platform === 'bolt') mergeBoltProjects([current]);
    else if (current.platform === 'replit') mergeReplitProjects([current]);
    else mergeLovableProjects([current]);

    const directCandidates = [...new Set([
      current.repo, current.githubRepo, current.github_repo, current.suggestedRepo,
      ...(Array.isArray(current.repoCandidates) ? current.repoCandidates.map((item) => item?.repo || item?.full_name || item) : [])
    ].map(repoFullName).filter(Boolean))];

    diagnostic.steps.push('Validando acesso e branch do melhor candidato');
    const probeTarget = current.repo || current.suggestedRepo || directCandidates[0] || '';
    const probe = probeTarget ? await probeGithubCandidate(probeTarget, current.defaultBranch) : null;
    const warning = inventoryError || state.github?.repoListWarning || '';
    const status = forceDiagnosticStatus(current, probe, warning, pageScan);

    const resultDiagnostic = {
      ...diagnostic, ...status,
      finishedAt: new Date().toISOString(),
      githubUser: state.github?.user?.login || '',
      accessibleRepoCount: (state.github?.repos || []).length,
      repoListWarning: warning,
      project: { id: current.id, name: current.name || '', platform: current.platform || 'lovable' },
      repository: current.repo || '',
      suggestedRepo: current.suggestedRepo || '',
      branch: current.defaultBranch || probe?.branch || '',
      source: current.githubBindingSource || current.githubBinding?.source || '',
      confidence: Number(current.githubConfidence || current.githubBinding?.confidence || 0),
      verified: current.githubVerified === true || current.githubBinding?.verified === true,
      directCandidates,
      probe
    };

    broadcast({ type: 'PROJECT_DETECTED', project: current });
    broadcast({ type: 'FORCE_REPOSITORY_DISCOVERY_RESULT', project: current, diagnostic: resultDiagnostic });
    sendResponse({ ok: status.code === 'REPOSITORY_CONFIRMED' || status.code === 'REPOSITORY_EMPTY', project: current, github: publicGithubState(), diagnostic: resultDiagnostic });
  } catch (error) {
    sendResponse({ ok: false, project: state.detectedProject || null, github: publicGithubState(), diagnostic: { ...diagnostic, code: 'UNEXPECTED_ERROR', label: 'Erro inesperado', reason: error?.message || 'Falha inesperada durante a detecção', finishedAt: new Date().toISOString() } });
  }
}

// ── Lovable projects ──
function repoFullName(repo) {
  if (!repo) return '';
  let raw = '';
  if (typeof repo === 'string') raw = repo;
  else raw = repo.fullName || repo.full_name || (repo.owner && repo.name ? `${repo.owner}/${repo.name}` : '');
  raw = String(raw || '').trim();
  if (!raw) return '';

  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      if (!/(^|\.)github\.com$/i.test(u.hostname)) return '';
      raw = u.pathname.replace(/^\/+/, '');
    }
  } catch (_) { return ''; }

  raw = raw.replace(/^github\.com\//i, '').replace(/[?#].*$/, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  const parts = raw.split('/').filter(Boolean);
  if (parts.length !== 2) return '';
  const [owner, name] = parts;
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) return '';
  if (GITHUB_RESERVED_OWNERS.has(owner.toLowerCase())) return '';
  if (/^(settings|apps|marketplace|features|pricing|login|join|new)$/i.test(name) && GITHUB_RESERVED_OWNERS.has(owner.toLowerCase())) return '';
  return `${owner}/${name}`;
}

function findAccessibleGithubRepo(candidate) {
  const fullName = repoFullName(candidate);
  if (!fullName) return null;
  const repos = state.github?.repos || [];
  return repos.find(r => String(r.full_name).toLowerCase() === fullName.toLowerCase())
    || repos.find(r => String(r.name).toLowerCase() === fullName.toLowerCase())
    || null;
}

function projectIsBackedByConnectedGithub(project) {
  if (!state.github?.connected) return true;

  // 1) Projeto já reconciliado: basta confirmar que o repo continua acessível.
  const repo = repoFullName(project?.repo || project?.matchedRepo || project?.githubRepo || project?.github_repo);
  if (repo && findAccessibleGithubRepo(repo)) return true;

  // 2) Para projetos novos, aceite somente correspondência EXATA e única de slug/nome
  // dentro da conta GitHub autenticada. Isso permite mostrar o projeto durante a etapa
  // de confirmação sem trazer de volta projetos antigos de outras contas.
  const details = repoSuggestionDetails(project);
  if (details?.unique && Number(details.score || 0) >= 0.99) {
    const candidate = findAccessibleGithubRepo(details.repo);
    if (candidate) {
      const login = String(state.github?.user?.login || '').toLowerCase();
      const owner = String(candidate.full_name || '').split('/')[0].toLowerCase();
      return !login || owner === login;
    }
  }

  return false;
}

function projectsVisibleForCurrentGithub(projects) {
  const list = Array.isArray(projects) ? projects.filter(Boolean) : [];
  if (!state.github?.connected) return list;
  const repos = Array.isArray(state.github?.repos) ? state.github.repos : [];
  // Nunca zere a lista enquanto o inventário GitHub está carregando ou quando um token
  // fine-grained não permite /user/repos. Projetos descobertos continuam visíveis; apenas
  // operações de escrita exigem que reconcileProjectGithub confirme o repositório.
  if (!repos.length) return list;
  const login = String(state.github?.user?.login || '').toLowerCase();
  return list.filter(project => {
    // GPT Studio é uma origem persistente. Não esconda o projeto
    // apenas porque o token GitHub atual pertence a outra conta ou não lista o repo privado.
    // Isso afeta somente a VISIBILIDADE; leitura/escrita continuam passando pelas validações
    // reais de acesso GitHub quando o usuário abrir/publicar/editar o projeto.
    const platform = String(project?.platform || project?.projectSource || '').toLowerCase();
    if (platform === 'gpt' && project?.projectSource === 'gpt') return true;
    if (projectIsBackedByConnectedGithub(project)) return true;
    if (state.detectedProject?.id === project?.id) return true;
    const repo = repoFullName(project?.repo || project?.githubRepo || project?.suggestedRepo);
    if (!repo) return true;
    const owner = repo.split('/')[0].toLowerCase();
    return !!(project?.githubVerified && (!login || owner === login));
  });
}

// A trusted builder/repository binding must survive temporary GitHub inventory failures.
// Chat GitHub only needs a reliable repo identity to route the request to ChatGPT; it must
// not erase a verified binding merely because /user/repos is unavailable for a restricted token.
function trustedGithubBinding(project) {
  if (!project) return null;

  const explicit = repoFullName(project?.repo || project?.githubRepo || project?.github_repo || project?.matchedRepo?.full_name || project?.matchedRepo);
  if (explicit && state.github?.connected) {
    const accessible = !!findAccessibleGithubRepo(explicit);
    const login = String(state.github?.user?.login || '').toLowerCase();
    const owner = explicit.split('/')[0].toLowerCase();
    // Never let a snapshot from another GitHub account override the account that is currently connected.
    // If /user/repos is temporarily restricted, owner equality still allows the user's own verified snapshot.
    if (!accessible && login && owner !== login) return null;
  }
  const source = String(project?.githubBindingSource || project?.source || '').toLowerCase();
  const confidence = Number(project?.githubConfidence || 0);
  const trustedSource = /verified-snapshot|readme-id|repo-confirmed|builder|github-integration|serialized-github|lovable.*page|bolt.*page|replit.*page|exact-slug|project-id/.test(source);
  if (explicit && (project?.githubVerified === true || confidence >= 88 || trustedSource)) {
    return {
      repo: explicit,
      defaultBranch: project?.defaultBranch || project?.default_branch || 'main',
      verified: project?.githubVerified === true || confidence >= 88 || trustedSource,
      source: project?.githubBindingSource || project?.source || 'builder',
      confidence: confidence || (trustedSource ? 92 : 88),
      reason: project?.githubReason || 'Vínculo detectado diretamente no builder'
    };
  }

  const candidates = Array.isArray(project?.repoCandidates) ? project.repoCandidates.slice() : [];
  candidates.sort((a,b) => Number(b?.score || 0) - Number(a?.score || 0));
  const strong = candidates.find(c => Number(c?.score || 0) >= 96 && repoFullName(c?.repo || c?.full_name || c));
  if (strong) {
    return {
      repo: repoFullName(strong?.repo || strong?.full_name || strong),
      defaultBranch: project?.defaultBranch || project?.default_branch || 'main',
      verified: true,
      source: strong?.source || 'builder-candidate',
      confidence: Number(strong?.score || 96),
      reason: 'Repositório detectado com evidência forte diretamente na página do builder'
    };
  }
  return null;
}

function usefulProjectName(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim();
  if (!n || n.length < 2 || n.length > 160) return false;
  const normalized = n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (/^(lovable|bolt(?:\.new)?|project|projeto|projects|projetos|open|abrir|recent|recents|recent apps|recent projects|apps|app|chats|chat|workspace|home|dashboard|create|new|templates|search|agent|history|integrations|integracoes|github|git|tools|files|preview|console|shell|settings|configuracoes)$/i.test(normalized)) return false;
  if (/^[a-z0-9_-]{24,}$/i.test(n)) return false;
  return true;
}

function projectNameQuality(project) {
  if (!project || !usefulProjectName(project.name)) return 0;
  const explicit = Number(project.nameConfidence || 0);
  if (explicit) return explicit;
  const source = String(project.nameSource || project.source || '');
  if (/serialized|project-name|repl-name|validated|api/i.test(source)) return 90;
  if (/title|dom/i.test(source)) return 65;
  return 50;
}


function withCanonicalGithubBinding(project) {
  if (!project) return project;
  const repository = repoFullName(project.repo || project.githubRepo || project.github_repo || project.matchedRepo?.full_name || project.matchedRepo);
  const branch = String(project.defaultBranch || project.default_branch || project.matchedRepo?.default_branch || '').trim();
  const source = String(project.githubBindingSource || '').trim();
  const confidence = Math.max(0, Math.min(100, Number(project.githubConfidence || 0)));
  const verified = project.githubVerified === true;
  const reason = String(project.githubReason || '').trim();
  const previous = project.githubBinding && typeof project.githubBinding === 'object' ? project.githubBinding : {};
  return {
    ...project,
    githubBinding: {
      repository,
      branch,
      source,
      confidence,
      verified,
      reason,
      account: verified ? String(state?.github?.user?.login || previous.account || '').trim() : String(previous.account || '').trim(),
      verifiedAt: verified ? (previous.verifiedAt || project.detectedAt || new Date().toISOString()) : ''
    }
  };
}

function lovableEditorUrl(projectId) {
  return `https://lovable.dev/projects/${projectId}`;
}

function lovableFullPreviewUrl(projectId) {
  return `https://id-preview--${projectId}.lovable.app/`;
}

function normalizeLovableProject(project) {
  if (!project) return null;
  const possibleUrls = [project.editorUrl, project.previewUrl, project.preview_url, project.url].filter(Boolean).map(String);
  const idFromUrl = possibleUrls.map((value) =>
    value.match(/lovable\.dev\/projects\/([a-f0-9-]+)/i)?.[1]
      || value.match(/id-preview--([a-f0-9-]+)\.lovable\.app/i)?.[1]
      || ''
  ).find(Boolean) || '';
  const id = project.id || idFromUrl;
  if (!id) return null;
  const knownMeta = VERIFIED_LOVABLE_PROJECTS.find(p => String(p.id) === String(id)) || null;
  const legacySource = String(project.githubBindingSource || '').toLowerCase();
  const legacyManual = legacySource === 'manual' || !!project.githubManual;
  const repoCandidate = repoFullName(legacyManual ? '' : (project.repo || project.githubRepo || project.github_repo || project.matchedRepo || knownMeta?.repo));
  const matched = repoCandidate ? findAccessibleGithubRepo(repoCandidate) : null;
  const repo = matched?.full_name || repoCandidate;
  const explicitPreview = String(project.previewUrl || project.preview_url || '').trim();
  const previewUrl = /^https?:\/\//i.test(explicitPreview)
    ? explicitPreview
    : lovableFullPreviewUrl(id);
  const explicitEditor = String(project.editorUrl || '').trim();
  const legacyEditor = String(project.url || '').match(/^https:\/\/lovable\.dev\/projects\/[a-f0-9-]+/i)?.[0] || '';
  const editorUrl = explicitEditor || legacyEditor || lovableEditorUrl(id);

  return withCanonicalGithubBinding({
    ...project,
    id,
    platform: 'lovable',
    platformLabel: 'Lovable',
    name: usefulProjectName(project.name) ? String(project.name).trim() : id,
    editorUrl,
    previewUrl,
    // Backward-compatible user-facing URL: ALWAYS the full normal preview.
    url: previewUrl,
    repo,
    defaultBranch: project.defaultBranch || project.default_branch || matched?.default_branch || knownMeta?.defaultBranch || '',
    githubManual: false,
    githubBindingSource: legacyManual ? '' : String(project.githubBindingSource || knownMeta?.githubBindingSource || '').trim(),
    githubVerified: legacyManual ? false : (!!project.githubVerified || !!knownMeta?.githubVerified),
    githubConfidence: legacyManual ? 0 : Number(project.githubConfidence || knownMeta?.githubConfidence || 0),
    githubReason: legacyManual ? '' : String(project.githubReason || knownMeta?.githubReason || '').trim(),
    detectedAt: project.detectedAt || new Date().toISOString()
  });
}


function normalizeBoltProject(project) {
  if (!project) return null;
  const possibleUrls = [project.editorUrl, project.url, project.previewUrl, project.preview_url].filter(Boolean).map(String);
  const idFromUrl = possibleUrls.map((value) => {
    try {
      const u = new URL(value);
      if (!/(^|\.)bolt\.new$/i.test(u.hostname)) return '';
      return u.pathname.match(/^\/~\/([^/?#]+)/i)?.[1] || u.pathname.match(/^\/project\/([^/?#]+)/i)?.[1] || '';
    } catch (_) { return ''; }
  }).find(Boolean) || '';
  const id = String(project.id || idFromUrl || '').trim();
  if (!id) return null;
  const knownMeta = VERIFIED_BOLT_PROJECTS.find(p => String(p.id) === id) || null;
  const legacySource = String(project.githubBindingSource || '').toLowerCase();
  const legacyManual = legacySource === 'manual' || !!project.githubManual;
  const repoCandidate = repoFullName(legacyManual ? '' : (project.repo || project.githubRepo || project.github_repo || project.matchedRepo || knownMeta?.repo));
  const matched = repoCandidate ? findAccessibleGithubRepo(repoCandidate) : null;
  const repo = matched?.full_name || repoCandidate;
  const explicitEditor = String(project.editorUrl || project.url || '').trim();
  const editorUrl = /^https:\/\/(?:[^/]+\.)?bolt\.new\//i.test(explicitEditor)
    ? explicitEditor
    : `https://bolt.new/~/${encodeURIComponent(id)}`;
  return withCanonicalGithubBinding({
    ...project,
    id,
    platform: 'bolt',
    platformLabel: 'Bolt.new',
    name: usefulProjectName(project.name) ? String(project.name).trim() : id,
    editorUrl,
    url: editorUrl,
    previewUrl: String(project.previewUrl || project.preview_url || '').trim(),
    repo,
    defaultBranch: project.defaultBranch || project.default_branch || matched?.default_branch || knownMeta?.defaultBranch || '',
    githubManual: false,
    githubBindingSource: legacyManual ? '' : String(project.githubBindingSource || knownMeta?.githubBindingSource || '').trim(),
    githubVerified: legacyManual ? false : (!!project.githubVerified || !!knownMeta?.githubVerified),
    githubConfidence: legacyManual ? 0 : Number(project.githubConfidence || knownMeta?.githubConfidence || 0),
    githubReason: legacyManual ? '' : String(project.githubReason || knownMeta?.githubReason || '').trim(),
    detectedAt: project.detectedAt || new Date().toISOString()
  });
}

function normalizeReplitProject(project) {
  if (!project) return null;
  const possibleUrls = [project.editorUrl, project.url, project.previewUrl, project.preview_url].filter(Boolean).map(String);
  let idFromUrl = '';
  for (const value of possibleUrls) {
    try {
      const u = new URL(value);
      if (!/(^|\.)replit\.com$/i.test(u.hostname)) continue;
      const at = u.pathname.match(/^\/@([^/]+)\/([^/?#]+)/i);
      if (at) { idFromUrl = `@${decodeURIComponent(at[1])}/${decodeURIComponent(at[2])}`; break; }
      const named = u.pathname.match(/^\/(?:repl|project|workspace|app)\/([^/?#]+)/i);
      if (named) { idFromUrl = decodeURIComponent(named[1]); break; }
      idFromUrl = u.searchParams.get('replId') || u.searchParams.get('repl') || u.searchParams.get('project') || '';
      if (idFromUrl) break;
    } catch (_) {}
  }
  const id = String(project.id || project.replId || project.uuid || idFromUrl || '').trim();
  if (!id) return null;
  const knownMeta = VERIFIED_REPLIT_PROJECTS.find(p => String(p.id) === id) || null;
  const legacySource = String(project.githubBindingSource || '').toLowerCase();
  const legacyManual = legacySource === 'manual' || !!project.githubManual;
  const repoCandidate = repoFullName(legacyManual ? '' : (project.repo || project.githubRepo || project.github_repo || project.matchedRepo || knownMeta?.repo));
  const matched = repoCandidate ? findAccessibleGithubRepo(repoCandidate) : null;
  const repo = matched?.full_name || repoCandidate;
  let editorUrl = String(project.editorUrl || project.url || '').trim();
  if (!/^https:\/\/(?:[^/]+\.)?replit\.com\//i.test(editorUrl)) {
    editorUrl = String(project.slugUrl || '').trim();
    if (!editorUrl && id.startsWith('@')) editorUrl = `https://replit.com/${id}`;
    else if (!editorUrl) editorUrl = 'https://replit.com/';
  }
  return withCanonicalGithubBinding({
    ...project, id, platform: 'replit', platformLabel: 'Replit',
    name: usefulProjectName(project.name) ? String(project.name).trim() : (String(project.slug || '').trim() || id),
    editorUrl, url: editorUrl, previewUrl: String(project.previewUrl || project.preview_url || '').trim(),
    repo, defaultBranch: project.defaultBranch || project.default_branch || matched?.default_branch || knownMeta?.defaultBranch || '',
    githubManual: false, githubBindingSource: legacyManual ? '' : String(project.githubBindingSource || knownMeta?.githubBindingSource || '').trim(),
    githubVerified: legacyManual ? false : (!!project.githubVerified || !!knownMeta?.githubVerified), githubConfidence: legacyManual ? 0 : Number(project.githubConfidence || knownMeta?.githubConfidence || 0),
    githubReason: legacyManual ? '' : String(project.githubReason || knownMeta?.githubReason || '').trim(), detectedAt: project.detectedAt || new Date().toISOString()
  });
}

function mergeReplitProjectArrays(base, incoming) {
  const map = new Map();
  for (const raw of [...(base || []), ...(incoming || [])]) {
    const p = normalizeReplitProject(raw);
    if (!p) continue;
    const old = map.get(p.id) || {};
    const next = { ...old, ...p };
    if (usefulProjectName(old.name) && !usefulProjectName(p.name)) next.name = old.name;
    if (!p.repo && old.repo) next.repo = old.repo;
    if (!p.defaultBranch && old.defaultBranch) next.defaultBranch = old.defaultBranch;
    if (!p.previewUrl && old.previewUrl) next.previewUrl = old.previewUrl;
    if (!p.supabase && old.supabase) next.supabase = old.supabase;
    map.set(p.id, next);
  }
  return [...map.values()].sort((a,b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
}


function normalizeGptProject(project) {
  if (!project) return null;
  const id = String(project.id || project.projectId || '').trim();
  if (!id) return null;
  const repoCandidate = repoFullName(project.repo || project.githubRepo || project.github_repo || project.matchedRepo);
  const matched = repoCandidate ? findAccessibleGithubRepo(repoCandidate) : null;
  const repo = matched?.full_name || repoCandidate;
  return withCanonicalGithubBinding({
    ...project,
    id,
    platform: 'gpt',
    platformLabel: 'GPT Studio',
    name: usefulProjectName(project.name) ? String(project.name).trim() : id,
    source: project.source || 'gpt-studio',
    projectSource: 'gpt',
    themePreset: 'light',
    ledPreset: 'black',
    editorUrl: String(project.editorUrl || '').trim(),
    url: String(project.editorUrl || project.url || '').trim(),
    repo,
    defaultBranch: project.defaultBranch || project.default_branch || matched?.default_branch || '',
    githubManual: false,
    githubBindingSource: String(project.githubBindingSource || '').trim(),
    githubVerified: !!project.githubVerified,
    githubConfidence: Number(project.githubConfidence || 0),
    githubReason: String(project.githubReason || '').trim(),
    detectedAt: project.detectedAt || new Date().toISOString()
  });
}

function mergeGptProjectArrays(base, incoming) {
  const map = new Map();
  for (const raw of [...(base || []), ...(incoming || [])]) {
    const p = normalizeGptProject(raw);
    if (!p) continue;
    const old = map.get(p.id) || {};
    const next = { ...old, ...p };
    if (usefulProjectName(old.name) && !usefulProjectName(p.name)) next.name = old.name;
    if (!p.repo && old.repo) next.repo = old.repo;
    if (!p.defaultBranch && old.defaultBranch) next.defaultBranch = old.defaultBranch;
    if (!p.previewUrl && old.previewUrl) next.previewUrl = old.previewUrl;
    if (!p.supabase && old.supabase) next.supabase = old.supabase;
    map.set(p.id, next);
  }
  return [...map.values()].sort((a,b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
}

function normalizeProject(project) {
  if (!project) return null;
  const p = String(project.platform || '').toLowerCase();
  const urls = [project.editorUrl, project.url, project.previewUrl, project.preview_url].filter(Boolean).join(' ');
  if (p === 'bolt' || /https:\/\/(?:[^/]+\.)?bolt\.new\//i.test(urls)) return normalizeBoltProject(project);
  if (p === 'replit' || /https:\/\/(?:[^/]+\.)?replit\.com\//i.test(urls)) return normalizeReplitProject(project);
  if (p === 'gpt') return normalizeGptProject(project);
  if (p === 'lovable' || /https:\/\/(?:[^/]+\.)?lovable\.dev\//i.test(urls) || !p) return normalizeLovableProject(project);
  return null;
}

function mergeBoltProjectArrays(base, incoming) {
  const map = new Map();
  for (const raw of [...(base || []), ...(incoming || [])]) {
    const p = normalizeBoltProject(raw);
    if (!p) continue;
    const old = map.get(p.id) || {};
    const next = { ...old, ...p };
    if (usefulProjectName(old.name) && !usefulProjectName(p.name)) next.name = old.name;
    if (!p.repo && old.repo) next.repo = old.repo;
    if (!p.defaultBranch && old.defaultBranch) next.defaultBranch = old.defaultBranch;
    if (!p.previewUrl && old.previewUrl) next.previewUrl = old.previewUrl;
    if (!p.supabase && old.supabase) next.supabase = old.supabase;
    map.set(p.id, next);
  }
  return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
}

function mergeProjectArrays(base, incoming) {
  const map = new Map();
  for (const raw of [...(base || []), ...(incoming || [])]) {
    const p = normalizeLovableProject(raw);
    if (!p) continue;
    const old = map.get(p.id) || {};
    const next = { ...old, ...p };
    if (usefulProjectName(old.name) && !usefulProjectName(p.name)) next.name = old.name;
    if (!p.repo && old.repo) next.repo = old.repo;
    if (!p.defaultBranch && old.defaultBranch) next.defaultBranch = old.defaultBranch;
    if (!p.previewUrl && old.previewUrl) next.previewUrl = old.previewUrl;
    if (!p.supabase && old.supabase) next.supabase = old.supabase;
    map.set(p.id, next);
  }
  return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
}

function mergeLovableProjects(projects) {
  state.lovableProjects = mergeProjectArrays(state.lovableProjects, projects);
  chrome.storage.local.set({ lovableProjects: state.lovableProjects });
  broadcast({ type: 'LOVABLE_PROJECTS_UPDATED', projects: projectsVisibleForCurrentGithub(state.lovableProjects) });
  broadcast({ type: 'BUILDER_PROJECTS_UPDATED', projects: [
    ...projectsVisibleForCurrentGithub(state.lovableProjects),
    ...projectsVisibleForCurrentGithub(state.boltProjects),
    ...projectsVisibleForCurrentGithub(state.replitProjects),
    ...projectsVisibleForCurrentGithub(state.gptProjects)
  ] });
  return state.lovableProjects;
}

function scanLovableTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'SCAN_LOVABLE_PROJECTS' }, (res) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      resolve(res || null);
    });
  });
}

async function syncLovableProjects(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://lovable.dev/*' });
    let found = [];
    for (const tab of tabs) {
      if (!tab.id) continue;
      const res = await scanLovableTab(tab.id);
      if (Array.isArray(res?.projects)) found.push(...res.projects);
    }
    if (found.length) mergeLovableProjects(found);
    if (state.github?.connected) await reconcileAllProjectGithub();
    sendResponse({ ok: true, projects: projectsVisibleForCurrentGithub(state.lovableProjects), discovered: found.length, openLovableTabs: tabs.length });
  } catch (e) {
    sendResponse({ ok: false, error: e.message, projects: projectsVisibleForCurrentGithub(state.lovableProjects) });
  }
}


function mergeBoltProjects(projects) {
  state.boltProjects = mergeBoltProjectArrays(state.boltProjects, projects);
  chrome.storage.local.set({ boltProjects: state.boltProjects });
  broadcast({ type: 'BOLT_PROJECTS_UPDATED', projects: projectsVisibleForCurrentGithub(state.boltProjects) });
  broadcast({ type: 'BUILDER_PROJECTS_UPDATED', projects: [
    ...projectsVisibleForCurrentGithub(state.lovableProjects),
    ...projectsVisibleForCurrentGithub(state.boltProjects),
    ...projectsVisibleForCurrentGithub(state.replitProjects),
    ...projectsVisibleForCurrentGithub(state.gptProjects)
  ] });
  return state.boltProjects;
}

function scanBoltTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'SCAN_BOLT_PROJECTS' }, (res) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      resolve(res || null);
    });
  });
}

async function syncBoltProjects(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ url: ['https://bolt.new/*', 'https://*.bolt.new/*'] });
    let found = [];
    for (const tab of tabs) {
      if (!tab.id) continue;
      const res = await scanBoltTab(tab.id);
      if (Array.isArray(res?.projects)) found.push(...res.projects);
    }
    if (found.length) mergeBoltProjects(found);
    if (state.github?.connected) await reconcileAllProjectGithub();
    sendResponse({ ok: true, projects: projectsVisibleForCurrentGithub(state.boltProjects), discovered: found.length, openBoltTabs: tabs.length });
  } catch (e) {
    sendResponse({ ok: false, error: e.message, projects: projectsVisibleForCurrentGithub(state.boltProjects) });
  }
}

function mergeReplitProjects(projects) {
  state.replitProjects = mergeReplitProjectArrays(state.replitProjects, projects);
  chrome.storage.local.set({ replitProjects: state.replitProjects });
  broadcast({ type: 'REPLIT_PROJECTS_UPDATED', projects: projectsVisibleForCurrentGithub(state.replitProjects) });
  broadcast({ type: 'GPT_PROJECTS_UPDATED', projects: projectsVisibleForCurrentGithub(state.gptProjects) });
  broadcast({ type: 'BUILDER_PROJECTS_UPDATED', projects: [
    ...projectsVisibleForCurrentGithub(state.lovableProjects),
    ...projectsVisibleForCurrentGithub(state.boltProjects),
    ...projectsVisibleForCurrentGithub(state.replitProjects),
    ...projectsVisibleForCurrentGithub(state.gptProjects)
  ] });
  return state.replitProjects;
}


function mergeGptProjects(projects) {
  state.gptProjects = mergeGptProjectArrays(state.gptProjects, projects);
  chrome.storage.local.set({ gptProjects: state.gptProjects });
  broadcast({ type: 'GPT_PROJECTS_UPDATED', projects: projectsVisibleForCurrentGithub(state.gptProjects) });
  broadcast({ type: 'BUILDER_PROJECTS_UPDATED', projects: [
    ...projectsVisibleForCurrentGithub(state.lovableProjects),
    ...projectsVisibleForCurrentGithub(state.boltProjects),
    ...projectsVisibleForCurrentGithub(state.replitProjects),
    ...projectsVisibleForCurrentGithub(state.gptProjects)
  ] });
  return state.gptProjects;
}

function scanReplitTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'SCAN_REPLIT_PROJECTS' }, (res) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      resolve(res || null);
    });
  });
}

async function syncReplitProjects(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ url: ['https://replit.com/*', 'https://*.replit.com/*'] });
    let found = [];
    for (const tab of tabs) {
      if (!tab.id) continue;
      const res = await scanReplitTab(tab.id);
      if (Array.isArray(res?.projects)) found.push(...res.projects);
    }
    if (found.length) mergeReplitProjects(found);
    if (state.github?.connected) await reconcileAllProjectGithub();
    sendResponse({ ok: true, projects: projectsVisibleForCurrentGithub(state.replitProjects), discovered: found.length, openReplitTabs: tabs.length });
  } catch (e) {
    sendResponse({ ok: false, error: e.message, projects: projectsVisibleForCurrentGithub(state.replitProjects) });
  }
}


async function syncGptProjects(sendResponse) {
  try {
    // GPT não tem uma aba builder para escanear. A fonte autoritativa é GitHub +
    // marcador persistente do GitHub. Se o inventário ainda não existe, carregue-o agora.
    if (state.github?.connected && state.github?.token) {
      if (!(state.github?.repos || []).length) await refreshGithubRepositoryInventory();
      else {
        await discoverBuilderProjectsFromGithubRepos();
        await reconcileAllProjectGithub();
      }
    } else {
      state.gptProjects = mergeGptProjectArrays(VERIFIED_GPT_PROJECTS, state.gptProjects);
      await chrome.storage.local.set({ gptProjects: state.gptProjects });
    }
    sendResponse({ ok: true, projects: projectsVisibleForCurrentGithub(state.gptProjects), discovered: state.gptProjects.length });
  } catch (e) {
    sendResponse({ ok: false, error: e?.message || String(e), projects: projectsVisibleForCurrentGithub(state.gptProjects) });
  }
}


async function createGptProject(msg, sendResponse) {
  try {
    const name = String(msg.name || '').trim() || 'Novo projeto GPT';
    const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'projeto';
    const id = `gpt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    const project = normalizeGptProject({
      id,
      name,
      slug,
      source: 'gpt-studio',
      projectSource: 'gpt',
        themePreset: 'light',
      ledPreset: 'black',
      githubBindingSource: '',
      githubVerified: false,
      githubConfidence: 0,
      githubReason: 'Projeto criado diretamente pelo GPT Studio'
    });
    mergeGptProjects([project]);
    state.detectedProject = project;
    await chrome.storage.local.set({ detectedProject: project });
    broadcast({ type: 'PROJECT_DETECTED', project });
    activateSupabase(supabasePlaceholder(project, 'idle'), project.id, false);
    sendResponse({ ok: true, project, supabase: state.supabase });
  } catch (error) {
    sendResponse({ ok: false, error: error?.message || String(error) });
  }
}

async function selectGptProject(projectId, sendResponse) {
  const selected = state.gptProjects.find(p => p.id === projectId);
  if (!selected) { sendResponse({ ok: false, error: 'Projeto GPT Studio não encontrado' }); return; }
  const reconciled = state.github?.connected ? await reconcileProjectGithub(selected) : selected;
  state.detectedProject = normalizeGptProject(reconciled);
  mergeGptProjects([state.detectedProject]);
  chrome.storage.local.set({ detectedProject: state.detectedProject });
  broadcast({ type: 'PROJECT_DETECTED', project: state.detectedProject });
  await activateSupabaseForSelectedProject(state.detectedProject, 'gpt-studio');
  sendResponse({ ok: true, project: state.detectedProject, supabase: state.supabase });
}

function openGptProject(projectOrId, sendResponse) {
  const id = typeof projectOrId === 'string' ? projectOrId : projectOrId?.id;
  const source = state.gptProjects.find(p => p.id === id)
    || (state.detectedProject?.id === id && state.detectedProject?.platform === 'gpt' ? state.detectedProject : null)
    || (typeof projectOrId === 'object' ? projectOrId : null);
  const normalized = normalizeGptProject(source || null);
  if (!normalized?.id) { sendResponse?.({ ok: false, error: 'Projeto GPT Studio inválido' }); return; }
  sendResponse?.({ ok: true, project: normalized, local: true });
}

function openReplitProject(projectOrId, sendResponse) {
  const id = typeof projectOrId === 'string' ? projectOrId : projectOrId?.id;
  const source = state.replitProjects.find(p => p.id === id)
    || (state.detectedProject?.id === id && state.detectedProject?.platform === 'replit' ? state.detectedProject : null)
    || (typeof projectOrId === 'object' ? projectOrId : null);
  const normalized = normalizeReplitProject(source || (id ? { id, platform: 'replit' } : null));
  if (!normalized?.id) { sendResponse?.({ ok: false, error: 'Projeto Replit inválido' }); return; }
  chrome.tabs.create({ url: normalized.editorUrl, active: true }, (tab) => {
    if (chrome.runtime.lastError) { sendResponse?.({ ok: false, error: chrome.runtime.lastError.message }); return; }
    sendResponse?.({ ok: true, url: normalized.editorUrl, tabId: tab?.id || null });
  });
}

async function activateSupabaseForSelectedProject(project, source = 'builder') {
  if (!project?.id) return state.supabase;
  const projectId = project.id;
  const cached = state.supabaseByProject[projectId];
  if (cached?.url && cached?.anonKey) {
    activateSupabase({ ...cached, connected: true, status: 'connected', projectId }, projectId, false);
    return state.supabase;
  }
  if (project.supabase?.url && project.supabase?.anonKey) {
    const db = {
      connected: true, url: project.supabase.url, anonKey: project.supabase.anonKey,
      pendingUrl: null, status: 'connected', projectId,
      projectRef: project.supabase.projectRef || projectRefFromUrl(project.supabase.url),
      databaseEnabled: true, stack: 'supabase', source: project.supabase.source || `${source}-page`
    };
    cacheSupabaseForProject(projectId, db);
    activateSupabase(db, projectId, false);
    return state.supabase;
  }
  if (project.repo && state.github?.connected) {
    try {
      const discovered = await discoverSupabaseFromRepo(project.repo, project.defaultBranch || 'main');
      if (discovered?.url && discovered?.anonKey) {
        const db = { ...discovered, connected: true, status: 'connected', projectId };
        cacheSupabaseForProject(projectId, db);
        activateSupabase(db, projectId, false);
        return state.supabase;
      }
      if (discovered?.url) {
        activateSupabase({ ...discovered, connected: false, url: null, pendingUrl: discovered.url, status: 'needs-key', projectId }, projectId, false);
        return state.supabase;
      }
    } catch (_) {}
  }
  activateSupabase({ connected: false, url: null, anonKey: null, pendingUrl: project.supabase?.url || null, status: project.supabase?.url ? 'needs-key' : 'idle', projectId, projectRef: project.supabase?.projectRef || '', databaseEnabled: !!project.supabase?.url, stack: project.supabase?.url ? 'supabase' : null, source }, projectId, false);
  return state.supabase;
}

async function selectReplitProject(projectId, sendResponse) {
  const selected = state.replitProjects.find(p => p.id === projectId);
  if (!selected) { sendResponse({ ok: false, error: 'Projeto Replit não encontrado' }); return; }
  const reconciled = state.github?.connected ? await reconcileProjectGithub(selected) : selected;
  state.detectedProject = normalizeReplitProject(reconciled);
  mergeReplitProjects([state.detectedProject]);
  chrome.storage.local.set({ detectedProject: state.detectedProject });
  broadcast({ type: 'PROJECT_DETECTED', project: state.detectedProject });
  await activateSupabaseForSelectedProject(state.detectedProject, 'replit');
  sendResponse({ ok: true, project: state.detectedProject, supabase: state.supabase });
}

function openBoltProject(projectOrId, sendResponse) {
  const id = typeof projectOrId === 'string' ? projectOrId : projectOrId?.id;
  const source = state.boltProjects.find(p => p.id === id)
    || (state.detectedProject?.id === id && state.detectedProject?.platform === 'bolt' ? state.detectedProject : null)
    || (typeof projectOrId === 'object' ? projectOrId : null);
  const normalized = normalizeBoltProject(source || (id ? { id, platform: 'bolt' } : null));
  if (!normalized?.id) {
    sendResponse?.({ ok: false, error: 'Projeto Bolt.new inválido' });
    return;
  }
  chrome.tabs.create({ url: normalized.editorUrl, active: true }, (tab) => {
    if (chrome.runtime.lastError) {
      sendResponse?.({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }
    sendResponse?.({ ok: true, url: normalized.editorUrl, tabId: tab?.id || null });
  });
}

async function selectBoltProject(projectId, sendResponse) {
  const selected = state.boltProjects.find(p => p.id === projectId);
  if (!selected) { sendResponse({ ok: false, error: 'Projeto Bolt.new não encontrado' }); return; }
  const reconciled = state.github?.connected ? await reconcileProjectGithub(selected) : selected;
  state.detectedProject = normalizeBoltProject(reconciled);
  mergeBoltProjects([state.detectedProject]);
  chrome.storage.local.set({ detectedProject: state.detectedProject });
  broadcast({ type: 'PROJECT_DETECTED', project: state.detectedProject });

  await activateSupabaseForSelectedProject(state.detectedProject, 'bolt');
  sendResponse({ ok: true, project: state.detectedProject, supabase: state.supabase });
}

function openLovableProject(projectOrId, sendResponse) {
  const id = typeof projectOrId === 'string' ? projectOrId : projectOrId?.id;
  const source = state.lovableProjects.find(p => p.id === id)
    || (state.detectedProject?.id === id ? state.detectedProject : null)
    || (typeof projectOrId === 'object' ? projectOrId : null);
  const normalized = normalizeLovableProject(source || (id ? { id } : null));
  if (!normalized?.id) {
    sendResponse?.({ ok: false, error: 'Projeto Lovable inválido' });
    return;
  }

  chrome.tabs.create({ url: normalized.editorUrl, active: true }, (tab) => {
    if (chrome.runtime.lastError) {
      sendResponse?.({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }
    sendResponse?.({ ok: true, url: normalized.editorUrl, tabId: tab?.id || null });
  });
}

async function selectLovableProject(projectId, sendResponse) {
  const selected = state.lovableProjects.find(p => p.id === projectId);
  if (!selected) { sendResponse({ ok: false, error: 'Projeto Lovable não encontrado' }); return; }

  state.detectedProject = normalizeLovableProject(selected);
  chrome.storage.local.set({ detectedProject: state.detectedProject });
  broadcast({ type: 'PROJECT_DETECTED', project: state.detectedProject });

  // Change the active DB immediately so one project's Supabase is never reused for another project.
  const cached = state.supabaseByProject[projectId];
  if (cached?.url && cached?.anonKey) {
    activateSupabase({ ...cached, connected: true, status: 'connected', projectId }, projectId, false);
  } else {
    activateSupabase(supabasePlaceholder(state.detectedProject, 'detecting'), projectId, false);
  }

  try {
    const resolved = await resolveProjectConnections(state.detectedProject);
    if (resolved?.project) {
      state.detectedProject = normalizeLovableProject(resolved.project);
      chrome.storage.local.set({ detectedProject: state.detectedProject });
      mergeLovableProjects([state.detectedProject]);
      broadcast({ type: 'PROJECT_DETECTED', project: state.detectedProject });
    }
    sendResponse({ ok: true, project: state.detectedProject, supabase: state.supabase });
  } catch (e) {
    const fallback = supabasePlaceholder(state.detectedProject, 'error', e.message);
    activateSupabase(fallback, projectId, false);
    sendResponse({ ok: true, project: state.detectedProject, supabase: state.supabase, warning: e.message });
  }
}

// ── Project-aware Supabase auto connection ──
function projectRefFromUrl(url) {
  return String(url || '').match(/https?:\/\/([a-z0-9-]+)\.supabase\.(?:co|in)/i)?.[1] || String(url || '').match(/https?:\/\/([^/]+)\.lovable\.cloud/i)?.[1] || '';
}

function publicSupabaseMeta(db) {
  if (!db) return null;
  return {
    connected: !!db.connected,
    url: db.url || db.pendingUrl || null,
    projectRef: db.projectRef || projectRefFromUrl(db.url || db.pendingUrl),
    status: db.status || (db.connected ? 'connected' : 'available'),
    databaseEnabled: db.databaseEnabled !== false,
    stack: db.stack || 'supabase',
    source: db.source || ''
  };
}

function supabasePlaceholder(project, status = 'available', message = '') {
  const enabled = project?.databaseEnabled !== false && (project?.databaseEnabled === true || project?.databaseStack === 'supabase' || project?.supabase);
  return {
    connected: false,
    url: null,
    anonKey: null,
    pendingUrl: project?.supabase?.url || null,
    status: enabled ? status : 'not-enabled',
    projectId: project?.id || null,
    projectRef: project?.supabase?.projectRef || '',
    databaseEnabled: !!enabled,
    stack: project?.databaseStack || (enabled ? 'supabase' : null),
    source: project?.supabase?.source || 'lovable',
    message
  };
}

function cacheSupabaseForProject(projectId, db) {
  if (!projectId || !db?.url || !db?.anonKey) return;
  state.supabaseByProject[projectId] = { ...db, projectId, connected: true, status: 'connected' };
  chrome.storage.local.set({ supabaseByProject: state.supabaseByProject });
}

function activateSupabase(db, projectId, persistCredentials = true) {
  const next = {
    connected: !!db?.connected,
    url: db?.url || null,
    anonKey: db?.anonKey || null,
    pendingUrl: db?.pendingUrl || null,
    status: db?.status || (db?.connected ? 'connected' : 'idle'),
    projectId: projectId || db?.projectId || null,
    projectRef: db?.projectRef || projectRefFromUrl(db?.url || db?.pendingUrl),
    databaseEnabled: db?.databaseEnabled ?? !!(db?.url || db?.pendingUrl),
    stack: db?.stack || (db?.databaseEnabled ? 'supabase' : null),
    source: db?.source || '',
    message: db?.message || ''
  };
  state.supabase = next;
  if (persistCredentials && next.projectId && next.connected && next.url && next.anonKey) cacheSupabaseForProject(next.projectId, next);
  chrome.storage.local.set({ supabase: state.supabase });
  broadcast({ type: 'SUPABASE_STATUS', ...state.supabase });
  return next;
}

function normalizedName(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
}

async function githubJson(url) {
  if (!state.github?.token) return null;
  const res = await fetch(url, {
    headers: githubAuthHeaders(state.github.token)
  });
  if (!res.ok) return null;
  return res.json();
}

async function githubTextFile(repo, path, branch) {
  if (!state.github?.token || !repo) return '';
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch || 'main')}`;
  const json = await githubJson(url);
  if (!json?.content) return '';
  try {
    const binary = atob(String(json.content).replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch (e) { return ''; }
}

async function githubRepositoryContentState(repo, branch) {
  const result = { checked: false, hasCode: false, empty: false, reason: '' };
  if (!state.github?.token || !repo) return result;
  const ref = branch || findAccessibleGithubRepo(repo)?.default_branch || 'main';

  // The root contents endpoint is the authoritative check. It works for private
  // repositories with the same token used to list the repository.
  try {
    const root = await githubJson(`https://api.github.com/repos/${repo}/contents?ref=${encodeURIComponent(ref)}`);
    if (Array.isArray(root)) {
      if (root.length > 0) {
        return { checked: true, hasCode: true, empty: false, reason: `Conteúdo GitHub confirmado na branch ${ref}` };
      }
      return { checked: true, hasCode: false, empty: true, reason: `A raiz do repositório está vazia na branch ${ref}` };
    }
  } catch (_) {}

  // Fallback for transient contents-list failures: any known project marker is
  // sufficient to prove there is code. Do not infer emptiness from repo.size.
  const markerPaths = ['package.json', '.lovable/project.json', 'vite.config.ts', 'README.md'];
  for (const path of markerPaths) {
    const text = await githubTextFile(repo, path, ref);
    if (text) {
      return { checked: true, hasCode: true, empty: false, reason: `Arquivo ${path} confirmado no GitHub` };
    }
  }
  return result;
}

function parseSupabaseConfig(text) {
  const c = String(text || '');
  const url = c.match(/(?:VITE_)?SUPABASE_URL\s*[=:]\s*["'`]?((?:https?:\/\/)?[^\s"'`]+)/i)?.[1]
    || c.match(/https:\/\/[a-z0-9-]+\.supabase\.(?:co|in)/i)?.[0]
    || c.match(/https:\/\/[^\s"'`]+\.lovable\.cloud/i)?.[0]
    || '';
  const key = c.match(/(?:VITE_)?SUPABASE_(?:PUBLISHABLE|ANON)_KEY\s*[=:]\s*["'`]?([^\s"'`]+)/i)?.[1]
    || c.match(/(?:publishableKey|anonKey|supabaseKey)\s*[=:]\s*["'`]([^"'`]+)["'`]/i)?.[1]
    || c.match(/sb_publishable_[A-Za-z0-9_-]{20,}/)?.[0]
    || c.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]{10,})?/)?.[0]
    || '';
  const explicitRef = c.match(/(?:VITE_)?SUPABASE_PROJECT_ID\s*[=:]\s*["'`]?([^\s"'`]+)/i)?.[1] || '';
  const cleanUrl = url && !/^https?:\/\//i.test(url) ? `https://${url}` : url;
  if (!cleanUrl && !key) return null;
  return { url: cleanUrl, anonKey: key, projectRef: explicitRef || projectRefFromUrl(cleanUrl) };
}

function repoSuggestionDetails(project) {
  const repos = state.github?.repos || [];
  if (!repos.length) return null;
  const platform = String(project?.platform || 'lovable').toLowerCase();
  const knownPool = platform === 'bolt'
    ? VERIFIED_BOLT_PROJECTS
    : (platform === 'lovable' ? VERIFIED_LOVABLE_PROJECTS : []);
  const knownMeta = knownPool.find(p => String(p.id || '') === String(project?.id || '')) || null;
  const candidates = [project?.slug, project?.projectSlug, knownMeta?.slug, project?.name]
    .map(normalizedName)
    .filter(Boolean);
  const exactMatches = repos.filter(r => candidates.includes(normalizedName(r.name)));
  if (exactMatches.length) {
    const login = String(state.github?.user?.login || '').toLowerCase();
    const owned = exactMatches.filter(r => String(r.full_name || '').split('/')[0].toLowerCase() === login);
    const chosen = owned.length === 1 ? owned[0] : (exactMatches.length === 1 ? exactMatches[0] : null);
    if (chosen) return {
      repo: chosen.full_name, score: 1, coverage: 1, common: 99, unique: true,
      reason: owned.length === 1
        ? 'Slug/nome do projeto corresponde exatamente a um repositório da conta GitHub conectada'
        : 'Nome do repositório corresponde exatamente ao projeto'
    };
  }

  const generic = new Set(['app','apps','project','projeto','site','web','pwa','remix','of','de','da','do','the','lovable','bolt','new','replit','gestao','profissional','para']);
  const tokens = (value) => String(value || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/)
    .filter(t => t && !generic.has(t) && t.length > 1);
  const projectTokens = new Set(tokens([project?.name, project?.projectSlug, project?.slug].filter(Boolean).join(' ')));
  const ranked = [];
  if (projectTokens.size >= 2) {
    for (const r of repos) {
      const nameTokens = new Set(tokens(r.name));
      const allRepoTokens = new Set(tokens(`${r.name || ''} ${r.description || ''}`));
      let commonName = 0, commonAll = 0;
      for (const t of projectTokens) {
        if (nameTokens.has(t)) commonName++;
        if (allRepoTokens.has(t)) commonAll++;
      }
      const coverage = commonAll / projectTokens.size;
      const score = (coverage * 0.8) + ((commonName / projectTokens.size) * 0.2);
      if (commonAll >= 2 && coverage >= 0.66) ranked.push({ repo: r.full_name, score, coverage, common: commonAll });
    }
  }
  ranked.sort((a,b) => b.score - a.score || b.coverage - a.coverage || b.common - a.common);
  if (!ranked.length) return null;
  const best = ranked[0];
  const second = ranked[1];
  const unique = !second || (best.score - second.score >= 0.18) || (best.coverage >= 0.99 && second.coverage < 0.80);
  return { ...best, unique, reason: 'Nome/descrição do repositório correspondem fortemente ao projeto' };
}

function repoSuggestionByName(project) {
  return repoSuggestionDetails(project)?.repo || '';
}

function uniqueRepoFromGithubMetadata(project) {
  const repos = state.github?.repos || [];
  if (!state.github?.connected || !repos.length) return null;
  const ids = [...new Set([
    project?.id, project?.replId, project?.uuid, project?.slug, project?.projectSlug
  ].map(v => String(v || '').trim()).filter(v => v && v.length >= 4))];
  const editor = String(project?.editorUrl || project?.url || '').trim().toLowerCase();
  const platform = String(project?.platform || 'lovable').toLowerCase();
  const platformHost = platform === 'bolt' ? 'bolt.new' : (platform === 'replit' ? 'replit.com' : 'lovable.dev');
  const matches = [];
  for (const repo of repos) {
    const meta = `${repo.homepage || ''} ${repo.description || ''}`.toLowerCase();
    if (!meta.trim()) continue;
    const exactId = ids.some(id => meta.includes(String(id).toLowerCase()));
    const editorHit = editor && editor.length >= 12 && meta.includes(editor);
    const builderHit = meta.includes(platformHost) && ids.some(id => meta.includes(String(id).toLowerCase()));
    if (exactId || editorHit || builderHit) matches.push(repo);
  }
  if (matches.length !== 1) return null;
  return {
    repo: matches[0].full_name,
    verified: true,
    source: 'github-repository-metadata',
    confidence: 97,
    reason: 'ID/URL do projeto encontrado nos metadados do repositório GitHub'
  };
}

async function uniqueRepoFromExactProjectSlug(project) {
  const repos = state.github?.repos || [];
  if (!state.github?.connected || !repos.length) return null;

  const platform = String(project?.platform || 'lovable').toLowerCase();
  const pool = platform === 'bolt' ? VERIFIED_BOLT_PROJECTS : (platform === 'replit' ? VERIFIED_REPLIT_PROJECTS : (platform === 'lovable' ? VERIFIED_LOVABLE_PROJECTS : []));
  const knownMeta = pool.find(p => String(p.id || '') === String(project?.id || '')) || null;
  const slugs = [...new Set([project?.slug, project?.projectSlug, knownMeta?.slug]
    .map(v => String(v || '').trim())
    .filter(Boolean))];
  if (!slugs.length) return null;

  const normalizedSlugs = new Set(slugs.map(normalizedName).filter(Boolean));
  const matches = repos.filter(r => normalizedSlugs.has(normalizedName(r.name)));
  if (!matches.length) return null;

  const login = String(state.github?.user?.login || '').toLowerCase();
  const owned = matches.filter(r => String(r.full_name || '').split('/')[0].toLowerCase() === login);
  const repo = owned.length === 1 ? owned[0] : (matches.length === 1 ? matches[0] : null);
  if (!repo) return null;

  const compatibility = await validateProjectRepoCompatibility(project, repo);
  const slugConfidence = knownMeta?.slug ? 100 : 98;
  const emptyReplitLink = compatibility.empty && canAutoLinkEmptyReplitRepo(project, repo, slugConfidence);
  if (!compatibility.ok && !emptyReplitLink) return null;

  return {
    repo: repo.full_name,
    verified: true,
    source: emptyReplitLink ? 'replit-exact-slug-empty-repo' : (knownMeta?.slug ? 'project-id-exact-slug' : 'exact-project-slug'),
    confidence: slugConfidence,
    repoEmpty: !!emptyReplitLink,
    reason: emptyReplitLink
      ? 'Slug do projeto Replit corresponde exatamente a um repositório da conta conectada; aguardando o primeiro push de código'
      : (knownMeta?.slug
        ? `ID do projeto + slug conhecido (${knownMeta.slug}) correspondem exatamente ao repositório da conta GitHub conectada`
        : `Slug do projeto corresponde exatamente ao repositório da conta GitHub conectada`)
  };
}

async function repositoryBuilderFingerprint(repo, branch) {
  const result = { platform: '', confidence: 0, reason: '', empty: false };
  if (!repo) return result;
  const meta = findAccessibleGithubRepo(repo);
  const contentState = await githubRepositoryContentState(repo, branch || meta?.default_branch || 'main');
  if (contentState.checked && contentState.empty) {
    return { ...result, empty: true, reason: 'O repositório está realmente vazio na branch consultada.' };
  }


  const [readme, pkg] = await Promise.all([
    githubTextFile(repo, 'README.md', branch || meta?.default_branch || 'main'),
    githubTextFile(repo, 'package.json', branch || meta?.default_branch || 'main')
  ]);
  const text = `${readme || ''}
${pkg || ''}`.toLowerCase();
  if (/open in bolt|bolt\.new\/~\/|bolt\.new\/project\/|bolt\.new\/static\/open-in-bolt/.test(text)) {
    return { platform: 'bolt', confidence: 99, reason: 'O repositório contém identificação explícita do Bolt.new.', empty: false };
  }
  if (/lovable\.dev\/projects\/|id-preview--[a-f0-9-]+\.lovable\.app|made with lovable|lovable project/.test(text)) {
    return { platform: 'lovable', confidence: 98, reason: 'O repositório contém identificação explícita do Lovable.', empty: false };
  }
  if (/replit\.com\/@|replit\.com\/(?:repl|project|workspace)\/|run on replit|made with replit|replit project|replid/.test(text)) {
    return { platform: 'replit', confidence: 96, reason: 'O repositório contém identificação explícita do Replit.', empty: false };
  }
  return result;
}

function canAutoLinkEmptyReplitRepo(project, repoObj, confidence) {
  const platform = String(project?.platform || '').toLowerCase();
  if (platform !== 'replit') return false;
  const fullName = repoObj?.full_name || repoFullName(repoObj);
  if (!fullName) return false;
  const login = String(state.github?.user?.login || '').toLowerCase();
  const owner = String(fullName).split('/')[0].toLowerCase();
  if (!login || owner !== login) return false;

  // No Replit, repo vazio só pode ser vinculado com evidência direta muito forte (>=95).
  // Para repo vazio, exigir conteúdo seria impossível antes do 1º push; por isso o owner
  // precisa ser exatamente a conta autenticada e a evidência precisa vir do próprio builder.
  const explicit = repoFullName(project?.repo || project?.githubRepo || project?.github_repo);
  const sameExplicit = !explicit || explicit.toLowerCase() === String(fullName).toLowerCase();
  return sameExplicit && Number(confidence || 0) >= GITHUB_BINDING_MIN_CONFIDENCE;
}

async function validateProjectRepoCompatibility(project, repoObj) {
  const platform = String(project?.platform || 'lovable').toLowerCase();
  const repo = repoObj?.full_name || repoFullName(repoObj);
  if (!repo) return { ok: false, reason: 'Repositório inválido.' };
  const fingerprint = await repositoryBuilderFingerprint(repo, repoObj?.default_branch || project?.defaultBranch || 'main');
  if (fingerprint.empty) {
    return { ok: false, empty: true, fingerprint, reason: fingerprint.reason };
  }
  if (fingerprint.platform && fingerprint.platform !== platform && fingerprint.confidence >= 90) {
    const labels = { lovable: 'Lovable', bolt: 'Bolt.new', replit: 'Replit' };
    return {
      ok: false,
      fingerprint,
      reason: `Este repositório parece pertencer ao ${labels[fingerprint.platform] || fingerprint.platform}, não ao ${labels[platform] || platform}. ${fingerprint.reason}`
    };
  }
  return { ok: true, fingerprint };
}

async function uniqueRepoFromBuilderReadme(project) {
  if (!state.github?.token) return null;
  const platform = String(project?.platform || '').toLowerCase();
  if (platform !== 'bolt') return null;
  const id = String(project?.id || '').trim();
  if (!id || id.length < 6) return null;

  const matches = [];
  for (const repo of (state.github?.repos || [])) {
    if (!repo?.full_name || repo?.empty === true) continue;
    const readme = await githubTextFile(repo.full_name, 'README.md', repo.default_branch || 'main');
    if (!readme) continue;
    const text = String(readme);
    const exactUrl = `bolt.new/~/${id}`;
    const legacyUrl = `bolt.new/project/${id}`;
    if (text.includes(exactUrl) || text.includes(legacyUrl) || text.includes(id)) {
      matches.push(repo);
    }
  }

  if (matches.length !== 1) return null;
  const repo = matches[0];
  const compatibility = await validateProjectRepoCompatibility(project, repo);
  if (!compatibility.ok) return null;
  return {
    repo: repo.full_name,
    verified: true,
    source: 'bolt-readme-id',
    confidence: 100,
    reason: `ID do projeto Bolt.new encontrado no README do repositório (${id})`
  };
}

async function uniqueRepoFromGithubCodeIdentifiers(project) {
  if (!state.github?.token || !state.github?.user?.login) return null;
  const repos = state.github?.repos || [];
  const identifiers = [...new Set([
    project?.id,
    project?.slug,
    project?.projectSlug
  ].map(v => String(v || '').trim()).filter(v => v && v.length >= 8))];

  for (const identifier of identifiers) {
    try {
      const q = encodeURIComponent(`${identifier} user:${state.github.user.login}`);
      const found = await githubJson(`https://api.github.com/search/code?q=${q}&per_page=20`);
      const unique = [...new Set((found?.items || []).map(item => item?.repository?.full_name).filter(Boolean))]
        .filter(repo => repos.some(r => r.full_name === repo));
      if (unique.length === 1) {
        return {
          repo: unique[0], verified: true, source: 'project-id-code', confidence: 96,
          reason: `ID do projeto encontrado no código GitHub (${identifier})`
        };
      }
    } catch (_) {}
  }
  return null;
}


async function uniqueRepoFromLovableProjectId(project) {
  if (!state.github?.token || String(project?.platform || 'lovable').toLowerCase() !== 'lovable') return null;
  const id = String(project?.id || '').trim();
  if (!id || id.length < 8) return null;

  const matches = [];
  const paths = ['README.md', 'package.json', 'lovable.json', '.lovable/project.json'];
  for (const repo of (state.github?.repos || [])) {
    if (!repo?.full_name || repo?.empty === true) continue;
    let hit = false;
    for (const path of paths) {
      const text = await githubTextFile(repo.full_name, path, repo.default_branch || 'main');
      if (!text) continue;
      if (String(text).includes(id)
        || String(text).includes(`lovable.dev/projects/${id}`)
        || String(text).includes(`id-preview--${id}.lovable.app`)) {
        hit = true;
        break;
      }
    }
    if (hit) matches.push(repo);
  }
  if (matches.length !== 1) return null;
  const repo = matches[0];
  const compatibility = await validateProjectRepoCompatibility(project, repo);
  if (!compatibility.ok) return null;
  return {
    repo: repo.full_name,
    verified: true,
    source: 'lovable-project-id',
    confidence: 100,
    reason: `ID exato do projeto Lovable encontrado no repositório (${id})`
  };
}

async function uniqueRepoFromReplitIdentity(project) {
  if (!state.github?.token || String(project?.platform || '').toLowerCase() !== 'replit') return null;
  const id = String(project?.id || project?.replId || project?.uuid || '').trim();
  const slug = String(project?.projectSlug || project?.slug || '').trim();
  const editorUrl = String(project?.editorUrl || project?.url || '').trim();
  const strongIds = [...new Set([id, project?.replId, project?.uuid].map(v => String(v || '').trim()).filter(v => v && v.length >= 8))];
  const paths = ['README.md', 'package.json', '.replit', 'replit.nix', 'pyproject.toml'];
  const matches = [];
  for (const repo of (state.github?.repos || [])) {
    if (!repo?.full_name || repo?.empty === true) continue;
    let hit = false;
    for (const path of paths) {
      const text = await githubTextFile(repo.full_name, path, repo.default_branch || 'main');
      if (!text) continue;
      const raw = String(text);
      const lower = raw.toLowerCase();
      const hasReplitMarker = /replit\.com|run on replit|made with replit|replit project|replid|\[deployment\]|modules\s*=/.test(lower);
      if (strongIds.some(value => raw.includes(value))) { hit = true; break; }
      if (editorUrl && editorUrl.length >= 12 && raw.includes(editorUrl)) { hit = true; break; }
      if (slug && slug.length >= 3 && hasReplitMarker && normalizedName(repo.name) === normalizedName(slug)) { hit = true; break; }
    }
    if (hit) matches.push(repo);
  }
  if (matches.length !== 1) return null;
  const repo = matches[0];
  const compatibility = await validateProjectRepoCompatibility(project, repo);
  if (!compatibility.ok) return null;
  return {
    repo: repo.full_name,
    verified: true,
    source: 'replit-project-identity',
    confidence: 99,
    reason: `Identidade do projeto Replit encontrada no repositório${id ? ` (${id})` : ''}`
  };
}

async function uniqueRepoFromSupabaseIdentity(project) {
  if (!state.github?.token) return null;
  const refs = [...new Set([
    project?.supabase?.projectRef,
    projectRefFromUrl(project?.supabase?.url),
    projectRefFromUrl(project?.supabase?.pendingUrl)
  ].map(v => String(v || '').trim()).filter(v => v && v.length >= 6))];
  if (!refs.length) return null;

  const paths = [
    '.env', '.env.local', '.env.production',
    'src/integrations/supabase/client.ts', 'src/integrations/supabase/client.js',
    'src/lib/supabase.ts', 'src/lib/supabase.js',
    'supabase/config.toml'
  ];
  const matches = [];
  for (const repo of (state.github?.repos || [])) {
    if (!repo?.full_name || repo?.empty === true) continue;
    let hit = false;
    for (const path of paths) {
      const text = await githubTextFile(repo.full_name, path, repo.default_branch || 'main');
      if (!text) continue;
      if (refs.some(ref => String(text).includes(ref))) {
        hit = true;
        break;
      }
    }
    if (hit) matches.push(repo);
  }
  if (matches.length !== 1) return null;
  const repo = matches[0];
  const compatibility = await validateProjectRepoCompatibility(project, repo);
  if (!compatibility.ok) return null;
  return {
    repo: repo.full_name,
    verified: true,
    source: 'supabase-project-ref',
    confidence: 99,
    reason: `Projeto Supabase do Lovable corresponde exclusivamente a este repositório (${refs[0]})`
  };
}

async function resolveRepoMatchForProject(project) {
  const repos = state.github?.repos || [];
  if (!state.github?.connected || !repos.length) {
    const explicit = repoFullName(project?.repo || project?.githubRepo || project?.github_repo || project?.matchedRepo);
    return explicit
      ? { repo: explicit, verified: false, source: project?.githubBindingSource || 'unverified', confidence: 20, reason: 'GitHub não conectado para validar' }
      : { repo: '', verified: false, source: '', confidence: 0, reason: '' };
  }

  // 0) Evidência direta do builder: URL/remoto GitHub no contexto do projeto.
  const pageCandidates = Array.isArray(project?.repoCandidates) ? project.repoCandidates : [];
  for (const candidate of pageCandidates.slice().sort((a,b) => Number(b?.score || 0) - Number(a?.score || 0))) {
    const score = Number(candidate?.score || 0);
    const candidateSource = String(candidate?.source || '').toLowerCase();
    const directEvidence = /(data-github-repo|integration|serialized.*(?:repo|github|remote)|git-remote|repository-url|repo-url)/i.test(candidateSource);
    // Generic links/page text are suggestions only, never authority.
    if (score < GITHUB_BINDING_MIN_CONFIDENCE || !directEvidence) continue;
    const exact = findAccessibleGithubRepo(candidate?.repo || candidate);
    if (!exact) continue;
    const compatibility = await validateProjectRepoCompatibility(project, exact);
    const emptyReplitLink = compatibility.empty && canAutoLinkEmptyReplitRepo(project, exact, score);
    if (!compatibility.ok && !emptyReplitLink) continue;
    return {
      repo: exact.full_name,
      verified: true,
      source: emptyReplitLink ? 'replit-builder-empty-repo' : 'builder',
      confidence: Math.min(100, score || 92),
      repoEmpty: !!emptyReplitLink,
      reason: emptyReplitLink
        ? 'Repositório Replit confirmado pela integração da página e pela conta GitHub conectada; aguardando o primeiro push de código'
        : `Repositório detectado automaticamente na integração do ${project?.platformLabel || project?.platform || 'builder'}`
    };
  }

  // 1) Vínculo explícito já fornecido pelo builder ou snapshot verificado.
  const explicit = repoFullName(project?.repo || project?.githubRepo || project?.github_repo || project?.matchedRepo);
  const bindingSource = String(project?.githubBindingSource || '').toLowerCase();
  const isManual = !!project?.githubManual || bindingSource === 'manual';
  if (explicit && !isManual) {
    const exact = findAccessibleGithubRepo(explicit);
    const projectSource = String(project?.source || '').toLowerCase();
    const isTrustedExplicit = bindingSource === 'builder'
      || bindingSource === 'verified-snapshot'
      || /verified-snapshot|lovable.*page|bolt.*page|builder.*page/.test(projectSource);
    if (exact && isTrustedExplicit) {
      const compatibility = await validateProjectRepoCompatibility(project, exact);
      const explicitConfidence = Number(project?.githubConfidence || 92);
      const emptyReplitLink = compatibility.empty && canAutoLinkEmptyReplitRepo(project, exact, explicitConfidence);
      if (compatibility.ok || emptyReplitLink) {
        return {
          repo: exact.full_name,
          verified: true,
          source: emptyReplitLink ? 'replit-builder-empty-repo' : (bindingSource || 'builder'),
          confidence: explicitConfidence,
          repoEmpty: !!emptyReplitLink,
          reason: emptyReplitLink
            ? 'Repositório Replit informado pelo builder, pertence à conta GitHub conectada e está aguardando o primeiro push de código'
            : (project?.githubReason || 'Vínculo informado pelo builder')
        };
      }
    }
  }

  // 2) Para projetos já conhecidos pelo ID, um slug exato na conta GitHub autenticada
  // é evidência forte o bastante para fechar o vínculo automaticamente. Isso evita
  // ficar preso em "Candidato encontrado" quando o nome exibido no Lovable difere
  // do nome técnico do repositório (ex.: PAINEL EXTENÇAO -> licenseengine).
  const byExactSlug = await uniqueRepoFromExactProjectSlug(project);
  if (byExactSlug) return byExactSlug;

  const byMetadata = uniqueRepoFromGithubMetadata(project);
  if (byMetadata) return byMetadata;

  // 3) IDs exatos gravados nos arquivos do builder são evidência forte e não dependem
  // do índice de busca do GitHub (importante para repositórios privados).
  const byReadme = await uniqueRepoFromBuilderReadme(project);
  if (byReadme) return byReadme;
  const byLovableId = await uniqueRepoFromLovableProjectId(project);
  if (byLovableId) return byLovableId;
  const byReplitIdentity = await uniqueRepoFromReplitIdentity(project);
  if (byReplitIdentity) return byReplitIdentity;

  // 4) O mesmo projeto Supabase usado pelo Lovable é uma identidade muito forte do repo.
  const bySupabase = await uniqueRepoFromSupabaseIdentity(project);
  if (bySupabase) return bySupabase;

  // 5) ID do projeto encontrado pelo índice de código do GitHub.
  const byId = await uniqueRepoFromGithubCodeIdentifiers(project);
  if (byId) return byId;

  // 6) ID do projeto encontrado em .env.
  const projectIds = [...new Set([project?.id, project?.slug, project?.projectSlug].map(v => String(v || '').trim()).filter(v => v && v.length >= 8))];
  if (projectIds.length) {
    for (const r of repos.slice(0, 30)) {
      try {
        const env = await githubTextFile(r.full_name, '.env', r.default_branch || 'main');
        if (env && projectIds.some(id => env.includes(id))) {
          return {
            repo: r.full_name,
            verified: true,
            source: 'project-id-env',
            confidence: 94,
            reason: 'ID do projeto encontrado no .env do repositório'
          };
        }
      } catch (_) {}
    }
  }

  const suggestionDetails = repoSuggestionDetails(project);
  const suggestion = suggestionDetails?.repo || '';
  if (suggestionDetails?.unique && suggestionDetails.score >= 0.92) {
    const exact = findAccessibleGithubRepo(suggestion);
    if (exact) {
      const compatibility = await validateProjectRepoCompatibility(project, exact);
      const suggestionConfidence = Math.round(Math.min(1, suggestionDetails.score) * 100);
      const emptyReplitLink = compatibility.empty && canAutoLinkEmptyReplitRepo(project, exact, suggestionConfidence);
      if (compatibility.ok || emptyReplitLink) {
        return {
          repo: exact.full_name,
          verified: true,
          source: emptyReplitLink ? 'replit-unique-empty-repo' : 'unique-name-match',
          confidence: suggestionConfidence,
          repoEmpty: !!emptyReplitLink,
          reason: emptyReplitLink
            ? 'Único repositório Replit compatível pertence à conta GitHub conectada; vínculo confirmado e aguardando o primeiro push de código'
            : (suggestionDetails.reason || 'Correspondência única e forte entre projeto e repositório')
        };
      }
    }
  }
  return {
    repo: '', verified: false, source: '', confidence: 0,
    suggestedRepo: suggestion,
    reason: suggestion ? 'Há um repositório com nome compatível, mas a evidência ainda não é suficiente para vínculo automático' : 'Nenhum vínculo GitHub forte encontrado'
  };
}

async function resolveRepoForProject(project) {
  return (await resolveRepoMatchForProject(project)).repo || '';
}

async function reconcileProjectGithub(project) {
  let normalized = normalizeProject(project);
  if (!normalized) return null;
  if (!state.github?.connected) return normalized;

  // A listagem geral do token pode ser parcial. Antes de resolver, consulte diretamente
  // os candidatos do próprio projeto para que Replit/Lovable/Bolt não dependam de /user/repos.
  if (state.github?.token) {
    const hydrated = await hydrateDetectedRepoCandidates(state.github.token, state.github.repos || [], [normalized]);
    if (hydrated.length !== (state.github.repos || []).length) {
      state.github.repos = hydrated;
      persistGithubState().catch(() => {});
      broadcast({ type: 'GITHUB_STATUS', connected: true, user: state.github.user, repos: hydrated, repoListWarning: state.github.repoListWarning || '' });
    }
  }

  const trustedBeforeResolution = trustedGithubBinding(normalized);
  const resolution = await resolveRepoMatchForProject(normalized);
  if (!resolution.repo) {
    if (trustedBeforeResolution?.repo) {
      return withCanonicalGithubBinding({
        ...normalized,
        repo: trustedBeforeResolution.repo,
        defaultBranch: normalized.defaultBranch || trustedBeforeResolution.defaultBranch || 'main',
        githubVerified: !!trustedBeforeResolution.verified,
        githubManual: false,
        githubBindingSource: trustedBeforeResolution.source || normalized.githubBindingSource || 'trusted-builder-binding',
        githubConfidence: Number(trustedBeforeResolution.confidence || normalized.githubConfidence || 92),
        githubReason: `${trustedBeforeResolution.reason || 'Vínculo GitHub confiável preservado'}; inventário do token indisponível no momento`,
        suggestedRepo: resolution.suggestedRepo || normalized.suggestedRepo || ''
      });
    }
    return withCanonicalGithubBinding({
      ...normalized,
      repo: '', matchedRepo: null, defaultBranch: '',
      githubVerified: false,
      githubManual: false,
      githubBindingSource: '',
      githubConfidence: 0,
      githubReason: resolution.reason || '',
      suggestedRepo: resolution.suggestedRepo || normalized.suggestedRepo || ''
    });
  }
  const match = findAccessibleGithubRepo(resolution.repo);
  if (!match) {
    const trustedResolution = trustedGithubBinding({
      ...normalized,
      repo: resolution.repo,
      githubVerified: resolution.verified || normalized.githubVerified,
      githubBindingSource: resolution.source || normalized.githubBindingSource,
      githubConfidence: resolution.confidence || normalized.githubConfidence,
      githubReason: resolution.reason || normalized.githubReason
    }) || trustedBeforeResolution;
    if (trustedResolution?.repo && trustedResolution.repo.toLowerCase() === String(resolution.repo).toLowerCase()) {
      return withCanonicalGithubBinding({
        ...normalized,
        repo: trustedResolution.repo,
        defaultBranch: normalized.defaultBranch || trustedResolution.defaultBranch || 'main',
        githubVerified: !!trustedResolution.verified,
        githubManual: false,
        githubBindingSource: trustedResolution.source || resolution.source || 'trusted-builder-binding',
        githubConfidence: Number(trustedResolution.confidence || resolution.confidence || 92),
        githubReason: `${trustedResolution.reason || resolution.reason || 'Vínculo GitHub confiável preservado'}; listagem geral do token não confirmou o inventário`,
        suggestedRepo: resolution.suggestedRepo || normalized.suggestedRepo || ''
      });
    }
    return withCanonicalGithubBinding({
      ...normalized, repo: '', matchedRepo: null, defaultBranch: '', githubVerified: false,
      githubBindingSource: '', githubConfidence: 0, githubReason: 'Repositório não acessível pela conta GitHub conectada'
    });
  }
  const branch = normalized.defaultBranch || match.default_branch || 'main';
  const contentState = await githubRepositoryContentState(match.full_name, branch);
  if (contentState.checked) {
    match.empty = !!contentState.empty;
    match.contentChecked = true;
    match.hasCode = !!contentState.hasCode;
  }
  return withCanonicalGithubBinding({
    ...normalized,
    repo: match.full_name,
    matchedRepo: match,
    defaultBranch: branch,
    githubVerified: !!resolution.verified,
    githubManual: resolution.source === 'manual',
    githubBindingSource: resolution.source || '',
    githubConfidence: Number(resolution.confidence || 0),
    githubReason: resolution.reason || contentState.reason || '',
    // Only show "aguardando código" after a real contents check proves emptiness.
    githubRepoEmpty: contentState.checked ? !!contentState.empty : !!resolution.repoEmpty,
    githubHasCode: contentState.checked ? !!contentState.hasCode : undefined,
    suggestedRepo: resolution.suggestedRepo || ''
  });
}

async function reconcileAllProjectGithub() {
  if (!state.github?.connected) return;
  const lovables = [];
  for (const p of state.lovableProjects) lovables.push(await reconcileProjectGithub(p));
  const bolts = [];
  for (const p of state.boltProjects) bolts.push(await reconcileProjectGithub(p));
  const replits = [];
  for (const p of state.replitProjects) replits.push(await reconcileProjectGithub(p));
  const gpts = [];
  for (const p of state.gptProjects) gpts.push(await reconcileProjectGithub(p));
  state.lovableProjects = lovables.filter(Boolean).map(p => normalizeLovableProject(p));
  state.boltProjects = bolts.filter(Boolean).map(p => normalizeBoltProject(p));
  state.replitProjects = replits.filter(Boolean).map(p => normalizeReplitProject(p));
  state.gptProjects = gpts.filter(Boolean).map(p => normalizeGptProject(p));

  if (state.detectedProject?.id) {
    const platform = String(state.detectedProject.platform || 'lovable').toLowerCase();
    const pool = platform === 'bolt' ? state.boltProjects : (platform === 'replit' ? state.replitProjects : (platform === 'gpt' ? state.gptProjects : state.lovableProjects));
    const mapped = pool.find(p => p.id === state.detectedProject.id);
    if (mapped) state.detectedProject = mapped;
  }

  chrome.storage.local.set({
    lovableProjects: state.lovableProjects,
    boltProjects: state.boltProjects,
    replitProjects: state.replitProjects,
    gptProjects: state.gptProjects,
    detectedProject: state.detectedProject
  });
  broadcast({ type: 'LOVABLE_PROJECTS_UPDATED', projects: projectsVisibleForCurrentGithub(state.lovableProjects) });
  broadcast({ type: 'BOLT_PROJECTS_UPDATED', projects: projectsVisibleForCurrentGithub(state.boltProjects) });
  broadcast({ type: 'REPLIT_PROJECTS_UPDATED', projects: projectsVisibleForCurrentGithub(state.replitProjects) });
  broadcast({ type: 'GPT_PROJECTS_UPDATED', projects: projectsVisibleForCurrentGithub(state.gptProjects) });
  broadcast({ type: 'BUILDER_PROJECTS_UPDATED', projects: [
    ...projectsVisibleForCurrentGithub(state.lovableProjects),
    ...projectsVisibleForCurrentGithub(state.boltProjects),
    ...projectsVisibleForCurrentGithub(state.replitProjects),
    ...projectsVisibleForCurrentGithub(state.gptProjects)
  ] });
  if (state.detectedProject) broadcast({ type: 'PROJECT_DETECTED', project: state.detectedProject });
}

async function discoverSupabaseFromRepo(repo, branch) {
  if (!repo) return null;
  const paths = [
    '.env', '.env.local', '.env.production',
    'src/integrations/supabase/client.ts', 'src/integrations/supabase/client.js',
    'src/lib/supabase.ts', 'src/lib/supabase.js',
    'src/supabase.ts', 'src/supabase.js'
  ];
  let partial = {};
  for (const path of paths) {
    const text = await githubTextFile(repo, path, branch || 'main');
    if (!text) continue;
    const cfg = parseSupabaseConfig(text);
    if (!cfg) continue;
    partial = { ...partial, ...Object.fromEntries(Object.entries(cfg).filter(([,v]) => !!v)) };
    if (partial.url && partial.anonKey) {
      return { ...partial, connected: true, status: 'connected', databaseEnabled: true, stack: 'supabase', source: `github:${path}` };
    }
  }
  return partial.url ? { ...partial, connected: false, status: 'needs-key', databaseEnabled: true, stack: 'supabase', source: 'github' } : null;
}

async function fetchText(url) {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return '';
    return await res.text();
  } catch (e) { return ''; }
}

function mergeSupabasePartial(target, text) {
  const cfg = parseSupabaseConfig(text);
  if (!cfg) return target;
  return { ...target, ...Object.fromEntries(Object.entries(cfg).filter(([,v]) => !!v)) };
}

async function discoverSupabaseFromLovablePreview(project) {
  if (!project?.id) return null;
  const previewUrl = project.previewUrl || project.preview_url || `https://id-preview--${project.id}.lovable.app/`;
  const html = await fetchText(previewUrl);
  if (!html) return null;

  let partial = mergeSupabasePartial({}, html);
  if (partial.url && partial.anonKey) {
    return { ...partial, connected: true, status: 'connected', databaseEnabled: true, stack: 'supabase', source: 'lovable-preview' };
  }

  const assetUrls = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|mjs)(?:\?[^"']*)?)["']/gi)) {
    try { assetUrls.add(new URL(match[1], previewUrl).href); } catch (e) {}
    if (assetUrls.size >= 12) break;
  }
  for (const assetUrl of assetUrls) {
    const text = await fetchText(assetUrl);
    if (!text) continue;
    partial = mergeSupabasePartial(partial, text);
    if (partial.url && partial.anonKey) {
      return { ...partial, connected: true, status: 'connected', databaseEnabled: true, stack: 'supabase', source: 'lovable-preview-bundle' };
    }
  }
  return partial.url ? { ...partial, connected: false, status: 'needs-key', databaseEnabled: true, stack: 'supabase', source: 'lovable-preview' } : null;
}

async function scanOpenLovablePagesForProject(projectId) {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://lovable.dev/*' });
    for (const tab of tabs) {
      if (!tab.id) continue;
      const res = await scanLovableTab(tab.id);
      const project = res?.projects?.find?.(p => p.id === projectId);
      if (project) return normalizeLovableProject(project);
    }
  } catch (e) {}
  return null;
}

async function resolveProjectConnections(project) {
  if (!project?.id) return { project };
  const cached = state.supabaseByProject[project.id];
  if (cached?.url && cached?.anonKey) {
    activateSupabase({ ...cached, connected: true, status: 'connected' }, project.id, false);
    return { project: { ...project, supabase: publicSupabaseMeta(cached) } };
  }

  activateSupabase(supabasePlaceholder(project, 'detecting'), project.id, false);

  // A currently open authenticated Lovable page may expose both repo and public Supabase config.
  const pageProject = await scanOpenLovablePagesForProject(project.id);
  if (pageProject) project = normalizeLovableProject({ ...project, ...pageProject });
  if (pageProject?.supabase?.url && pageProject?.supabase?.anonKey) {
    const db = {
      connected: true, url: pageProject.supabase.url, anonKey: pageProject.supabase.anonKey,
      pendingUrl: null, status: 'connected', projectId: project.id,
      projectRef: pageProject.supabase.projectRef || projectRefFromUrl(pageProject.supabase.url),
      databaseEnabled: true, stack: 'supabase', source: 'lovable-page'
    };
    activateSupabase(db, project.id);
    return { project: { ...project, supabase: publicSupabaseMeta(db) } };
  }

  const previewDb = await discoverSupabaseFromLovablePreview(project);
  if (previewDb?.url && previewDb?.anonKey) {
    const db = { ...previewDb, projectId: project.id, projectRef: previewDb.projectRef || projectRefFromUrl(previewDb.url) };
    activateSupabase(db, project.id);
    return { project: { ...project, supabase: publicSupabaseMeta(db) } };
  }

  if (state.github?.connected) {
    const repo = await resolveRepoForProject(project);
    if (repo) {
      const repoInfo = state.github.repos.find(r => r.full_name === repo);
      project = { ...project, repo, defaultBranch: project.defaultBranch || repoInfo?.default_branch || 'main' };
      const db = await discoverSupabaseFromRepo(repo, project.defaultBranch);
      if (db?.url && db?.anonKey) {
        const connectedDb = { ...db, projectId: project.id, projectRef: db.projectRef || projectRefFromUrl(db.url) };
        activateSupabase(connectedDb, project.id);
        return { project: { ...project, supabase: publicSupabaseMeta(connectedDb) } };
      }
      if (db?.url) {
        const pending = { ...db, connected: false, pendingUrl: db.url, url: null, projectId: project.id };
        activateSupabase(pending, project.id, false);
        return { project: { ...project, supabase: publicSupabaseMeta(pending) } };
      }
    }
  }

  // We still know from Lovable that the project has a Supabase database, even if credentials are not exposed to the extension.
  const status = project.databaseEnabled ? 'available' : 'not-enabled';
  activateSupabase(supabasePlaceholder(project, status), project.id, false);
  return { project: { ...project, supabase: publicSupabaseMeta(state.supabase) } };
}


async function handleSupabaseQuery(table, action, data, sendResponse) {
  if (!state.supabase.connected || !state.supabase.url || !state.supabase.anonKey) {
    sendResponse({ ok: false, error: 'Supabase não conectado' }); return;
  }
  const baseUrl = state.supabase.url.replace(/\/$/, '');
  const headers = { apikey: state.supabase.anonKey, Authorization: `Bearer ${state.supabase.anonKey}`, 'Content-Type': 'application/json' };
  if (action === 'insert') headers.Prefer = 'return=representation';
  let url = `${baseUrl}/rest/v1/${table}`;
  const opts = { headers };
  switch (action) {
    case 'select': opts.method = 'GET'; if (data?.query) url += `?${data.query}`; break;
    case 'insert': opts.method = 'POST'; opts.body = JSON.stringify(data); break;
    case 'update': opts.method = 'PATCH'; opts.body = JSON.stringify(data.values); if (data?.query) url += `?${data.query}`; break;
    case 'delete': opts.method = 'DELETE'; if (data?.query) url += `?${data.query}`; break;
    default: sendResponse({ ok: false, error: 'Ação desconhecida' }); return;
  }
  try { const res = await fetch(url, opts); const json = await res.json(); sendResponse({ ok: res.ok, data: json, status: res.status }); }
  catch (e) { sendResponse({ ok: false, error: e.message }); }
}

// ── Project Detection ──
async function handleProjectDetected(project, sendResponse) {
  const known = state.lovableProjects.find(p => p.id === project?.id) || {};
  let normalized = normalizeLovableProject({ ...known, ...project });
  if (!normalized) { sendResponse({ ok: false, error: 'Projeto Lovable inválido' }); return; }

  if (state.github.connected) {
    normalized = normalizeLovableProject(await reconcileProjectGithub(normalized));
  }

  state.detectedProject = normalized;
  chrome.storage.local.set({ detectedProject: normalized });
  mergeLovableProjects([normalized]);

  if (normalized.supabase?.url && normalized.supabase?.anonKey) {
    const detectedDb = {
      connected: true,
      url: normalized.supabase.url,
      anonKey: normalized.supabase.anonKey,
      pendingUrl: null,
      status: 'connected',
      projectId: normalized.id,
      projectRef: normalized.supabase.projectRef || projectRefFromUrl(normalized.supabase.url),
      databaseEnabled: true,
      stack: 'supabase',
      source: normalized.supabase.source || 'lovable-page'
    };
    cacheSupabaseForProject(normalized.id, detectedDb);
    if (state.detectedProject?.id === normalized.id) activateSupabase(detectedDb, normalized.id, false);
  } else if (normalized.supabase?.url) {
    const pendingDb = {
      connected: false,
      url: null,
      anonKey: null,
      pendingUrl: normalized.supabase.url,
      status: 'needs-key',
      projectId: normalized.id,
      projectRef: normalized.supabase.projectRef || projectRefFromUrl(normalized.supabase.url),
      databaseEnabled: true,
      stack: 'supabase',
      source: 'lovable-page'
    };
    if (state.detectedProject?.id === normalized.id) activateSupabase(pendingDb, normalized.id, false);
  }

  if ((!normalized.supabase?.url || !normalized.supabase?.anonKey) && state.github?.connected) {
    try {
      const resolved = await resolveProjectConnections(normalized);
      if (resolved?.project) {
        normalized = normalizeLovableProject(resolved.project);
        state.detectedProject = normalized;
        chrome.storage.local.set({ detectedProject: normalized });
        mergeLovableProjects([normalized]);
      }
    } catch (e) {}
  } else if (!state.supabase.connected && normalized.databaseEnabled && state.detectedProject?.id === normalized.id) {
    activateSupabase(supabasePlaceholder(normalized, 'available'), normalized.id, false);
  }

  broadcast({ type: 'PROJECT_DETECTED', project: normalized });
  sendResponse({ ok: true, project: normalized, supabase: state.supabase });
}


async function handleBoltProjectDetected(project, sendResponse) {
  const known = state.boltProjects.find(p => p.id === project?.id) || {};
  let normalized = normalizeBoltProject({ ...known, ...project, platform: 'bolt' });
  if (!normalized) { sendResponse({ ok: false, error: 'Projeto Bolt.new inválido' }); return; }

  if (state.github.connected) {
    normalized = normalizeBoltProject(await reconcileProjectGithub(normalized));
  }

  state.detectedProject = normalized;
  chrome.storage.local.set({ detectedProject: normalized });
  mergeBoltProjects([normalized]);

  if (normalized.supabase?.url && normalized.supabase?.anonKey) {
    const detectedDb = {
      connected: true,
      url: normalized.supabase.url,
      anonKey: normalized.supabase.anonKey,
      pendingUrl: null,
      status: 'connected',
      projectId: normalized.id,
      projectRef: normalized.supabase.projectRef || projectRefFromUrl(normalized.supabase.url),
      databaseEnabled: true,
      stack: 'supabase',
      source: normalized.supabase.source || 'bolt-page'
    };
    cacheSupabaseForProject(normalized.id, detectedDb);
    activateSupabase(detectedDb, normalized.id, false);
  } else if (normalized.supabase?.url) {
    activateSupabase({
      connected: false,
      url: null,
      anonKey: null,
      pendingUrl: normalized.supabase.url,
      status: 'needs-key',
      projectId: normalized.id,
      projectRef: normalized.supabase.projectRef || projectRefFromUrl(normalized.supabase.url),
      databaseEnabled: true,
      stack: 'supabase',
      source: 'bolt-page'
    }, normalized.id, false);
  } else {
    activateSupabase({ connected: false, url: null, anonKey: null, pendingUrl: null, status: 'idle', projectId: normalized.id, projectRef: '', databaseEnabled: false, stack: null, source: 'bolt' }, normalized.id, false);
  }

  broadcast({ type: 'PROJECT_DETECTED', project: normalized });
  sendResponse({ ok: true, project: normalized, supabase: state.supabase });
}

async function handleReplitProjectDetected(project, sendResponse) {
  const known = state.replitProjects.find(p => p.id === project?.id) || {};
  let normalized = normalizeReplitProject({ ...known, ...project, platform: 'replit' });
  if (!normalized) { sendResponse({ ok: false, error: 'Projeto Replit inválido' }); return; }
  if (state.github.connected) normalized = normalizeReplitProject(await reconcileProjectGithub(normalized));
  state.detectedProject = normalized;
  chrome.storage.local.set({ detectedProject: normalized });
  mergeReplitProjects([normalized]);
  if (normalized.supabase?.url && normalized.supabase?.anonKey) {
    const detectedDb = { connected: true, url: normalized.supabase.url, anonKey: normalized.supabase.anonKey, pendingUrl: null, status: 'connected', projectId: normalized.id, projectRef: normalized.supabase.projectRef || projectRefFromUrl(normalized.supabase.url), databaseEnabled: true, stack: 'supabase', source: normalized.supabase.source || 'replit-page' };
    cacheSupabaseForProject(normalized.id, detectedDb);
    activateSupabase(detectedDb, normalized.id, false);
  } else {
    activateSupabase({ connected: false, url: null, anonKey: null, pendingUrl: null, status: 'idle', projectId: normalized.id, projectRef: '', databaseEnabled: false, stack: null, source: 'replit' }, normalized.id, false);
  }
  broadcast({ type: 'PROJECT_DETECTED', project: normalized });
  sendResponse({ ok: true, project: normalized, supabase: state.supabase });
}

// ── Explicit project publication: creates a no-file-change commit to trigger connected deploy/sync ──
function encodeGitRefPath(branch) {
  return String(branch || 'main').split('/').map(part => encodeURIComponent(part)).join('/');
}

async function githubWriteJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...githubAuthHeaders(state.github.token), 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  let json = null;
  try { json = await res.json(); } catch (_) {}
  if (!res.ok) {
    const error = new Error(json?.message || `GitHub respondeu ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return json || {};
}

function gptProjectMetadata(project, repo, branch) {
  return JSON.stringify({
    schemaVersion: 2,
    platform: 'gpt',
    projectSource: 'gpt',
    id: String(project?.id || '').trim(),
    name: String(project?.name || project?.id || '').trim(),
    repo: repoFullName(repo || project?.repo),
    defaultBranch: String(branch || project?.defaultBranch || 'main').trim() || 'main',
    themePreset: 'light',
    ledPreset: 'black',
    updatedAt: new Date().toISOString()
  }, null, 2) + '\n';
}

async function writeGptProjectMetadata(project, repo, branch) {
  if (!project?.id || !repo) return { changed: false, skipped: true, commit: null };
  return putGithubTextFile(
    repo,
    GPT_PROJECT_METADATA_PATH,
    branch || project.defaultBranch || 'main',
    gptProjectMetadata(project, repo, branch),
    'chore: registrar projeto GPT Studio'
  );
}

// ── Explicit Push Code to GitHub (never triggered automatically) ──
async function handleAutoPushCode(code, language, source, sendResponse) {
  if (!state.github.connected || !state.github.token) {
    sendResponse({ ok: false, error: 'GitHub não conectado' }); return;
  }

  const project = state.detectedProject;
  if (!project || !project.repo) {
    sendResponse({ ok: false, error: 'Nenhum projeto detectado' }); return;
  }

  try {
    const repo = project.repo;
    const branch = project.defaultBranch || 'main';
    const filePath = getSmartFilePath(code, language);
    const commitMessage = `feat: ${language || 'code'} update via ChatGPT [auto]`;

    let sha = null;
    try {
      const existing = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`, {
        headers: githubAuthHeaders(state.github.token)
      });
      if (existing.ok) { const d = await existing.json(); sha = d.sha; }
    } catch (e) {}

    const body = { message: commitMessage, content: btoa(unescape(encodeURIComponent(code))), branch };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: { ...githubAuthHeaders(state.github.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const json = await res.json();
    if (res.ok) {
      broadcast({ type: 'PUSH_SUCCESS', file: filePath, repo, commit: json.commit?.sha, language });
      sendResponse({ ok: true, commit: json.commit?.sha, file: filePath, repo });
    } else {
      sendResponse({ ok: false, error: json.message });
    }
  } catch (e) { sendResponse({ ok: false, error: e.message }); }
}

function broadcast(msg) { chrome.runtime.sendMessage(msg).catch(() => {}); }

chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});

// Periodic ChatGPT tab check
setInterval(() => {
  if (state.chatgptTabId) {
    chrome.tabs.get(state.chatgptTabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        state.chatgptTabId = null;
        state.chatConnected = false;
        broadcast({ type: 'CHAT_DISCONNECTED' });
      }
    });
  }
}, 15000);

console.log(`[BG] LoveBoltReplit service worker loaded (v${chrome.runtime.getManifest().version} — deterministic repo resolver + safe attachments)`);
