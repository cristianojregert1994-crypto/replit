/**
 * LoveBoltReplit GPT Connector - Popup Script v3
 * 
 * Fluxo simples:
 * - GitHub: Abre página de token → Usuário copia → Cola na extensão
 * - Supabase: Abre dashboard → Usuário copia URL/Key → Cola
 */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  
  const els = {
    settingsBtn: $('settingsBtn'),
    // GitHub
    githubConnect: $('githubConnect'),
    githubTokenForm: $('githubTokenForm'),
    githubConnected: $('githubConnected'),
    githubOpenTokenBtn: $('githubOpenTokenBtn'),
    githubTokenInput: $('githubTokenInput'),
    pasteTokenBtn: $('pasteTokenBtn'),
    githubConnectBtn: $('githubConnectBtn'),
    githubCancelBtn: $('githubCancelBtn'),
    githubDisconnect: $('githubDisconnect'),
    githubStatus: $('githubStatus'),
    githubAvatar: $('githubAvatar'),
    githubUsername: $('githubUsername'),
    githubRepoCount: $('githubRepoCount'),
    githubDesc: $('githubDesc'),
    // Supabase
    supabaseConnect: $('supabaseConnect'),
    supabaseSetup: $('supabaseSetup'),
    supabaseConnected: $('supabaseConnected'),
    supabaseOpenDashBtn: $('supabaseOpenDashBtn'),
    supabaseUrlInput: $('supabaseUrlInput'),
    supabaseKeyInput: $('supabaseKeyInput'),
    supabaseSaveBtn: $('supabaseSaveBtn'),
    supabaseCancelBtn: $('supabaseCancelBtn'),
    supabaseDisconnect: $('supabaseDisconnect'),
    supabaseStatus: $('supabaseStatus'),
    supabaseProjectRef: $('supabaseProjectRef'),
    supabaseUrlText: $('supabaseUrlText'),
    supabaseDesc: $('supabaseDesc'),
    // Others
    lovableStatus: $('lovableStatus'),
    chatgptStatus: $('chatgptStatus'),
    projectSection: $('projectSection'),
    projectSelect: $('projectSelect'),
    refreshProjects: $('refreshProjects'),
    actionsSection: $('actionsSection'),
    syncBtn: $('syncBtn'),
    pushBtn: $('pushBtn'),
    dbBtn: $('dbBtn'),
    logContainer: $('logContainer'),
    clearLog: $('clearLog'),
  };

  // Settings
  els.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // ==================== GITHUB ====================
  
  // 1. Open token page
  els.githubOpenTokenBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'OPEN_GITHUB_TOKEN' });
    // Show token form after a delay
    setTimeout(() => {
      els.githubConnect.style.display = 'none';
      els.githubTokenForm.style.display = 'block';
      els.githubTokenInput.focus();
    }, 1000);
  });

  // Paste from clipboard
  els.pasteTokenBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      els.githubTokenInput.value = text.trim();
    } catch (e) {
      // Clipboard API might not work
    }
  });

  // 2. Connect with token
  els.githubConnectBtn.addEventListener('click', async () => {
    const token = els.githubTokenInput.value.trim();
    if (!token) {
      els.githubTokenInput.style.borderColor = '#ef4444';
      return;
    }
    
    els.githubConnectBtn.disabled = true;
    els.githubConnectBtn.innerHTML = `<span class="spinner"></span> Conectando...`;
    
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GITHUB_CONNECT', token });
      if (result.error) throw new Error(result.error);
      
      showGitHubConnected(result.user);
      addLogEntry(`GitHub conectado: ${result.user.login}`, 'success');
    } catch (error) {
      addLogEntry(`Erro: ${error.message}`, 'error');
      els.githubTokenInput.style.borderColor = '#ef4444';
    }
    
    els.githubConnectBtn.disabled = false;
    els.githubConnectBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> 2. Conectar`;
  });

  // Enter to connect
  els.githubTokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.githubConnectBtn.click();
  });

  // Cancel
  els.githubCancelBtn.addEventListener('click', () => {
    els.githubConnect.style.display = 'block';
    els.githubTokenForm.style.display = 'none';
    els.githubTokenInput.value = '';
    els.githubTokenInput.style.borderColor = '';
  });

  // Disconnect
  els.githubDisconnect.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'GITHUB_DISCONNECT' });
    showGitHubDisconnected();
    addLogEntry('GitHub desconectado', 'info');
  });

  function showGitHubConnected(user) {
    els.githubConnect.style.display = 'none';
    els.githubTokenForm.style.display = 'none';
    els.githubConnected.style.display = 'flex';
    els.githubAvatar.src = user.avatar_url;
    els.githubUsername.textContent = user.login;
    els.githubRepoCount.textContent = `${user.public_repos} repositórios`;
    els.githubDesc.textContent = 'Conectado ✓';
    
    setStatus(els.githubStatus, true, user.login);
    els.syncBtn.disabled = false;
    els.projectSection.style.display = 'block';
    els.actionsSection.style.display = 'block';
  }

  function showGitHubDisconnected() {
    els.githubConnect.style.display = 'block';
    els.githubTokenForm.style.display = 'none';
    els.githubConnected.style.display = 'none';
    els.githubTokenInput.value = '';
    els.githubDesc.textContent = 'Acesse seus repositórios';
    
    setStatus(els.githubStatus, false, 'Offline');
    els.syncBtn.disabled = true;
    els.projectSection.style.display = 'none';
    els.actionsSection.style.display = 'none';
  }

  // ==================== SUPABASE ====================
  
  // 1. Open dashboard
  els.supabaseOpenDashBtn.addEventListener('click', async () => {
    chrome.tabs.create({ url: 'https://supabase.com/dashboard' });
    setTimeout(() => {
      els.supabaseConnect.style.display = 'none';
      els.supabaseSetup.style.display = 'block';
    }, 500);
  });

  // Cancel
  els.supabaseCancelBtn.addEventListener('click', () => {
    els.supabaseConnect.style.display = 'block';
    els.supabaseSetup.style.display = 'none';
  });

  // 4. Connect
  els.supabaseSaveBtn.addEventListener('click', async () => {
    const url = els.supabaseUrlInput.value.trim();
    const key = els.supabaseKeyInput.value.trim();
    
    if (!url || !key) {
      if (!url) els.supabaseUrlInput.style.borderColor = '#ef4444';
      if (!key) els.supabaseKeyInput.style.borderColor = '#ef4444';
      return;
    }
    
    els.supabaseSaveBtn.disabled = true;
    
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'SETUP_SUPABASE',
        projectUrl: url,
        anonKey: key,
      });
      
      if (result.error) throw new Error(result.error);
      
      showSupabaseConnected(result.projectRef, result.url);
      addLogEntry(`Supabase conectado: ${result.projectRef}`, 'success');
    } catch (error) {
      addLogEntry(`Erro: ${error.message}`, 'error');
    }
    
    els.supabaseSaveBtn.disabled = false;
  });

  // Disconnect
  els.supabaseDisconnect.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'DISCONNECT_SUPABASE' });
    showSupabaseDisconnected();
    addLogEntry('Supabase desconectado', 'info');
  });

  function showSupabaseConnected(projectRef, url) {
    els.supabaseConnect.style.display = 'none';
    els.supabaseSetup.style.display = 'none';
    els.supabaseConnected.style.display = 'flex';
    els.supabaseProjectRef.textContent = projectRef;
    els.supabaseUrlText.textContent = url;
    els.supabaseDesc.textContent = 'Conectado ✓';
    
    setStatus(els.supabaseStatus, true, projectRef);
    els.dbBtn.disabled = false;
  }

  function showSupabaseDisconnected() {
    els.supabaseConnect.style.display = 'block';
    els.supabaseSetup.style.display = 'none';
    els.supabaseConnected.style.display = 'none';
    els.supabaseUrlInput.value = '';
    els.supabaseKeyInput.value = '';
    els.supabaseDesc.textContent = 'Banco de dados dos seus apps';
    
    setStatus(els.supabaseStatus, false, 'Offline');
    els.dbBtn.disabled = true;
  }

  // ==================== HELPERS ====================
  
  function setStatus(container, online, text) {
    container.querySelector('.status-dot').className = `status-dot ${online ? 'online' : 'offline'}`;
    container.querySelector('.status-text').textContent = text;
  }

  // ChatGPT
  async function checkChatGPT() {
    const result = await chrome.runtime.sendMessage({ type: 'DETECT_CHATGPT' });
    els.chatgptStatus.textContent = result.detected ? 'Ativo' : 'Fechado';
    els.chatgptStatus.style.color = result.detected ? '#22c55e' : '';
  }

  // Projects
  async function loadProjects() {
    const config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    const projects = config.lovableProjects || [];
    
    els.projectSelect.innerHTML = '<option value="">Selecione um projeto...</option>';
    
    if (projects.length > 0) {
      projects.sort((a, b) => {
        if (a.hasLovable && !b.hasLovable) return -1;
        if (!a.hasLovable && b.hasLovable) return 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
      
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.fullName;
        opt.textContent = `${p.hasLovable ? '💜 ' : ''}${p.name} ${p.private ? '🔒' : ''}`;
        opt.dataset.project = JSON.stringify(p);
        els.projectSelect.appendChild(opt);
      });
      
      if (config.selectedProject?.fullName) {
        els.projectSelect.value = config.selectedProject.fullName;
      }
      
      els.lovableStatus.textContent = `${projects.filter(p => p.hasLovable).length} detectados`;
    } else {
      els.lovableStatus.textContent = 'Sincronize';
    }
  }

  els.projectSelect.addEventListener('change', async (e) => {
    const opt = e.target.options[e.target.selectedIndex];
    const project = opt.dataset.project ? JSON.parse(opt.dataset.project) : null;
    if (project) {
      await chrome.runtime.sendMessage({ type: 'SELECT_PROJECT', projectId: project });
      els.pushBtn.disabled = false;
    }
  });

  // Sync
  els.refreshProjects.addEventListener('click', async () => {
    els.refreshProjects.querySelector('svg').classList.add('spinning');
    try {
      const result = await chrome.runtime.sendMessage({ type: 'SYNC_PROJECTS' });
      if (!result.error) {
        await loadProjects();
        addLogEntry(`${result.lovable} projetos Lovable`, 'success');
      }
    } catch (e) {
      addLogEntry(`Erro: ${e.message}`, 'error');
    }
    els.refreshProjects.querySelector('svg').classList.remove('spinning');
  });

  els.syncBtn.addEventListener('click', () => els.refreshProjects.click());

  // Push
  els.pushBtn.addEventListener('click', async () => {
    const config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    if (!config.selectedProject) {
      addLogEntry('Selecione um projeto', 'error');
      return;
    }
    const tab = await chrome.runtime.sendMessage({ type: 'DETECT_CHATGPT' });
    if (tab.detected) {
      chrome.tabs.sendMessage(tab.tab.id, { type: 'TRIGGER_PUSH' });
      addLogEntry(`Push → ${config.selectedProject.fullName}`, 'info');
    } else {
      addLogEntry('Abra o ChatGPT', 'error');
    }
  });

  // DB
  els.dbBtn.addEventListener('click', async () => {
    const config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    if (config.supabaseProjectRef) {
      chrome.tabs.create({ url: `https://supabase.com/dashboard/project/${config.supabaseProjectRef}` });
    }
  });

  // Logs
  function addLogEntry(message, type = 'info') {
    const empty = els.logContainer.querySelector('.log-empty');
    if (empty) empty.remove();
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    entry.innerHTML = `<span class="log-time">${time}</span><span class="log-message">${message}</span>`;
    els.logContainer.insertBefore(entry, els.logContainer.firstChild);
    
    while (els.logContainer.children.length > 15) {
      els.logContainer.removeChild(els.logContainer.lastChild);
    }
  }

  els.clearLog.addEventListener('click', () => {
    els.logContainer.innerHTML = '<div class="log-empty">Nenhuma atividade</div>';
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'LOG_UPDATE') addLogEntry(msg.log.message, msg.log.type);
  });

  // ==================== INIT ====================
  async function init() {
    const config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    
    if (config.connected.github && config.githubUser) {
      showGitHubConnected(config.githubUser);
    }
    
    if (config.connected.supabase && config.supabaseProjectRef) {
      showSupabaseConnected(config.supabaseProjectRef, config.supabaseUrl);
    }
    
    await checkChatGPT();
    if (config.connected.github) await loadProjects();
    
    // Load logs
    const logs = await chrome.runtime.sendMessage({ type: 'GET_LOGS' });
    if (logs?.length) {
      els.logContainer.innerHTML = '';
      logs.slice(0, 15).forEach(l => addLogEntry(l.message, l.type));
    }
  }

  init();
});
