/**
 * LoveBoltReplit GPT Connector - Side Panel Logic (v3.48.0)
 * Handles connection UI, project detection.
 */
(function () {
  'use strict';

  // ── Elements ──
  const autoDetectSection = document.getElementById('autoDetectSection');
  const autoDetectProject = document.getElementById('autoDetectProject');

  const integrationStatus = document.getElementById('integrationStatus');
  const integrationConnect = document.getElementById('integrationConnect');
  const tokenForm = document.getElementById('tokenForm');
  const integrationConnected = document.getElementById('integrationConnected');

  const openTokenBtn = document.getElementById('openTokenBtn');
  const tokenInput = document.getElementById('tokenInput');
  const pasteTokenBtn = document.getElementById('pasteTokenBtn');
  const connectBtn = document.getElementById('connectBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const userAvatar = document.getElementById('userAvatar');
  const username = document.getElementById('username');
  const repoCount = document.getElementById('repoCount');
  const githubConnDetail = document.getElementById('githubConnDetail');
  const dbConnDetail = document.getElementById('dbConnDetail');
  const dbConnCheck = document.getElementById('dbConnCheck');
  const dbConnSpinner = document.getElementById('dbConnSpinner');
  const projectConnDetail = document.getElementById('projectConnDetail');
  const repoConnDetail = document.getElementById('repoConnDetail');
  const projectConnItem = document.getElementById('projectConnItem');
  const repoConnItem = document.getElementById('repoConnItem');
  const githubDiagnostic = document.getElementById('githubDiagnostic');
  const githubDiagnosticBadge = document.getElementById('githubDiagnosticBadge');
  const githubDiagnosticSource = document.getElementById('githubDiagnosticSource');
  const githubDiagnosticConfidence = document.getElementById('githubDiagnosticConfidence');
  const githubDiagnosticBranch = document.getElementById('githubDiagnosticBranch');
  const githubDiagnosticState = document.getElementById('githubDiagnosticState');
  const githubDiagnosticReason = document.getElementById('githubDiagnosticReason');
  const forceRepoDetectBtn = document.getElementById('forceRepoDetectBtn');
  const githubForceResult = document.getElementById('githubForceResult');

  const supabaseKeyForm = document.getElementById('supabaseKeyForm');
  const supabaseAutoUrl = document.getElementById('supabaseAutoUrl');
  const supabaseKeyInput = document.getElementById('supabaseKeyInput');
  const pasteKeyBtn = document.getElementById('pasteKeyBtn');
  const supabaseKeySaveBtn = document.getElementById('supabaseKeySaveBtn');
  const supabaseSkipBtn = document.getElementById('supabaseSkipBtn');
  const supabaseConnectedRow = document.getElementById('supabaseConnectedRow');
  const supabaseRef = document.getElementById('supabaseRef');
  const supabaseUrl = document.getElementById('supabaseUrl');

  const chatStatusDot = document.getElementById('chatStatusDot');
  const chatStatusText = document.getElementById('chatStatusText');
  const chatProjectLabel = document.getElementById('chatProjectLabel');

  const lovableStatus = document.getElementById('lovableStatus');
  const projectsCount = document.getElementById('projectsCount');
  const projectsRefreshBtn = document.getElementById('projectsRefreshBtn');
  const headerPullBtn = document.getElementById('headerPullBtn');
  const chatgptStatus = document.getElementById('chatgptStatus');

  const settingsBtn = document.getElementById('settingsBtn');
  const DUAL_THEME_STORAGE_KEY = 'crcellDualTheme';
  const overlayToggleBtn = document.getElementById('overlayToggleBtn');
  const overlayToggleIcon = document.getElementById('overlayToggleIcon');
  const overlayToggleLabel = document.getElementById('overlayToggleLabel');
  const OVERLAY_ENABLED_KEY = 'loveboltOverlayEnabled';

  let project = null;
  let lovableProjects = [];
  let boltProjects = [];
  let replitProjects = [];
  let gptProjects = [];
  let githubState = null;

  // ── Utility ──
  function setStatus(el, text, className) {
    if (!el) return;
    el.className = 'badge ' + className;
    el.innerHTML = '<span class="badge-dot"></span>' + text;
  }

  function applyOverlayToggleState(enabled) {
    const on = enabled !== false;
    if (!overlayToggleBtn) return;
    overlayToggleBtn.classList.toggle('is-on', on);
    overlayToggleBtn.classList.toggle('is-off', !on);
    overlayToggleBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    overlayToggleBtn.title = on ? 'Desativar bloqueio do chat oficial' : 'Reativar bloqueio do chat oficial';
    if (overlayToggleIcon) overlayToggleIcon.textContent = on ? '◉' : '○';
    if (overlayToggleLabel) overlayToggleLabel.textContent = on ? 'Bloqueio ON' : 'Bloqueio OFF';
  }

  function loadOverlayToggleState() {
    chrome.storage.local.get(OVERLAY_ENABLED_KEY, (data) => {
      applyOverlayToggleState(data?.[OVERLAY_ENABLED_KEY] !== false);
    });
  }


  function platformMeta(platform) {
    const p = String(platform || 'lovable').toLowerCase();
    if (p === 'bolt') return { id: 'bolt', label: 'Bolt.new', icon: '⚡', color: '#2563eb', placeholder: 'Como o Bolt pode ajudar você hoje?' };
    if (p === 'replit') return { id: 'replit', label: 'Replit', icon: '🟧', color: '#f97316', placeholder: 'Como o Replit pode ajudar você hoje?' };
    if (p === 'gpt') return { id: 'gpt', label: 'GPT Studio', icon: '◎', color: '#dc2626', placeholder: 'Qual projeto vamos criar pelo GPT Studio?' };
    return { id: 'lovable', label: 'Lovable', icon: '💜', color: '#c026d3', placeholder: 'Como o Lovable pode ajudar você hoje?' };
  }

  function applyPlatformIdentity(platform) {
    const meta = platformMeta(platform);
    document.body.classList.toggle('platform-lovable', meta.id === 'lovable');
    document.body.classList.toggle('platform-bolt', meta.id === 'bolt');
    document.body.classList.toggle('platform-replit', meta.id === 'replit');
    document.body.classList.toggle('platform-gpt', meta.id === 'gpt');
    document.querySelectorAll('[data-team-platform]').forEach((el) => el.classList.toggle('is-active', el.dataset.teamPlatform === meta.id));
    document.body.dataset.platform = meta.id;

    const integrationIcon = document.querySelector('#integrationCard .card-title-row .card-icon');
    if (integrationIcon) integrationIcon.textContent = meta.icon;
    const chatProjectIcon = chatProjectLabel?.querySelector(':scope > span:first-child');
    if (chatProjectIcon) chatProjectIcon.textContent = meta.icon;
    const officialRouteIcon = document.querySelector('#chatOfficialBtn .chat-route-icon');
    if (officialRouteIcon) officialRouteIcon.textContent = meta.icon;
    const heroSubtitle = document.getElementById('chatHeroSubtitle');
    if (heroSubtitle) heroSubtitle.textContent = `Converse com o ${meta.label} sem limites.`;
    const chatInput = document.getElementById('chatInput');
    if (chatInput) chatInput.placeholder = meta.placeholder;
  }

  // ── Load initial state ──
  function loadState() {
    chrome.storage.local.get(['github', 'supabase'], (data) => {
      // GitHub/Supabase podem ser hidratados diretamente do storage. Projetos NÃO:
      // o background é a fonte autoritativa e já aplica merge + reconciliação, evitando
      // que um snapshot antigo do storage apague temporariamente a lista da sidebar.
      if (data.github) updateGitHubUI(data.github);
      if (data.supabase) updateSupabaseUI(data.supabase);
    });

    chrome.runtime.sendMessage({ type: 'GET_DETECTED_PROJECT' }, (res) => {
      if (res?.project) updateProjectUI(res.project);
    });
    chrome.runtime.sendMessage({ type: 'GET_LOVABLE_PROJECTS' }, (res) => {
      if (Array.isArray(res?.projects)) { lovableProjects = res.projects; renderBuilderProjects(); }
    });
    chrome.runtime.sendMessage({ type: 'GET_BOLT_PROJECTS' }, (res) => {
      if (Array.isArray(res?.projects)) { boltProjects = res.projects; renderBuilderProjects(); }
    });
    chrome.runtime.sendMessage({ type: 'GET_REPLIT_PROJECTS' }, (res) => {
      if (Array.isArray(res?.projects)) { replitProjects = res.projects; renderBuilderProjects(); }
    });
    chrome.runtime.sendMessage({ type: 'GET_GPT_PROJECTS' }, (res) => {
      if (Array.isArray(res?.projects)) { gptProjects = res.projects; renderBuilderProjects(); }
    });

    // Check ChatGPT status
    chrome.runtime.sendMessage({ type: 'CHAT_GET_STATUS' }, (res) => {
      if (res) {
        if (chatStatusDot) chatStatusDot.className = 'chat-status-dot ' + (res.connected ? 'online' : 'offline');
        if (chatStatusText) chatStatusText.textContent = res.connected ? 'Conectado' : 'Aguardando ChatGPT...';
        if (chatgptStatus) chatgptStatus.textContent = res.connected ? '✓' : '—';
      }
    });
  }

  // ── GitHub UI ──
  function refreshIntegrationStatus() {
    const connected = !!githubState?.connected;
    if (connected) {
      const login = githubState?.user?.login ? '@' + githubState.user.login : 'GitHub conectado';
      setStatus(integrationStatus, login, 'badge-online');
      if (integrationConnect) integrationConnect.style.display = 'none';
      if (tokenForm) tokenForm.style.display = 'none';
      if (integrationConnected) integrationConnected.style.display = 'block';
      return;
    }

    setStatus(integrationStatus, 'Não conectado', 'badge-offline');
    if (integrationConnect) integrationConnect.style.display = 'block';
    if (tokenForm) tokenForm.style.display = 'none';
    if (integrationConnected) integrationConnected.style.display = 'none';
  }

  function updateGitHubUI(github) {
    githubState = github || null;
    refreshIntegrationStatus();

    if (githubState?.connected) {
      const repos = Array.isArray(githubState.repos) ? githubState.repos : [];
      if (userAvatar && githubState.user?.avatar_url) userAvatar.src = githubState.user.avatar_url;
      if (username) username.textContent = githubState.user?.login || 'GitHub';
      if (repoCount) repoCount.textContent = repos.length + ' repositórios';

      if (githubConnDetail) githubConnDetail.textContent = githubState.user?.login ? '@' + githubState.user.login : 'Conectado';
      if (repoConnDetail && !project?.repo) repoConnDetail.textContent = repos.length + ' disponíveis';
      if (!project?.id && githubDiagnostic) {
        githubDiagnostic.hidden = false;
        if (githubDiagnosticBadge) {
          githubDiagnosticBadge.textContent = 'Pronto para buscar';
          githubDiagnosticBadge.classList.remove('is-ok');
          githubDiagnosticBadge.classList.add('is-warning');
        }
        if (githubDiagnosticSource) githubDiagnosticSource.textContent = 'projeto aberto';
        if (githubDiagnosticConfidence) githubDiagnosticConfidence.textContent = '—';
        if (githubDiagnosticBranch) githubDiagnosticBranch.textContent = '—';
        if (githubDiagnosticState) githubDiagnosticState.textContent = 'Aguardando detecção';
        if (githubDiagnosticReason) githubDiagnosticReason.textContent = 'Abra um projeto no Lovable, Bolt.new ou Replit, ou selecione um projeto GPT Studio, e use “Forçar detecção do repositório”.';
      }
    }

    renderBuilderProjects();
  }

  // ── Supabase UI ──
  function updateSupabaseUI(supabase) {
    supabase = supabase || {};
    const status = supabase.status || (supabase.connected ? 'connected' : (supabase.pendingUrl ? 'needs-key' : 'idle'));

    if (dbConnCheck) dbConnCheck.style.display = 'none';
    if (dbConnSpinner) dbConnSpinner.style.display = 'none';
    if (supabaseKeyForm) supabaseKeyForm.style.display = 'none';
    if (supabaseConnectedRow) supabaseConnectedRow.style.display = 'none';

    if (status === 'connected' && supabase.connected) {
      if (dbConnDetail) dbConnDetail.textContent = 'Supabase conectado ✓';
      if (dbConnCheck) dbConnCheck.style.display = 'inline';
      if (supabaseConnectedRow) supabaseConnectedRow.style.display = 'flex';
      if (supabaseRef) supabaseRef.textContent = supabase.projectRef ? `Projeto ${supabase.projectRef}` : 'Conectado';
      if (supabaseUrl) supabaseUrl.textContent = supabase.url || '';
      return;
    }

    if (status === 'detecting') {
      if (dbConnDetail) dbConnDetail.textContent = 'Detectando banco do projeto...';
      if (dbConnSpinner) dbConnSpinner.style.display = 'inline';
      return;
    }

    if (status === 'needs-key' || supabase.pendingUrl) {
      if (dbConnDetail) dbConnDetail.textContent = 'Supabase encontrado · falta chave pública';
      if (supabaseKeyForm) supabaseKeyForm.style.display = 'block';
      if (supabaseAutoUrl) supabaseAutoUrl.value = supabase.pendingUrl || supabase.url || '';
      return;
    }

    if (status === 'available' || supabase.databaseEnabled) {
      if (dbConnDetail) dbConnDetail.textContent = project?.platform === 'replit' ? 'Supabase detectado no Replit' : (project?.platform === 'bolt' ? 'Supabase detectado no Bolt.new' : 'Supabase ativo na Lovable');
      if (dbConnCheck) dbConnCheck.style.display = 'inline';
      if (supabaseConnectedRow) supabaseConnectedRow.style.display = 'flex';
      if (supabaseRef) supabaseRef.textContent = 'Banco habilitado';
      if (supabaseUrl) supabaseUrl.textContent = 'Credenciais ainda não detectadas no navegador/GitHub';
      return;
    }

    if (status === 'error') {
      if (dbConnDetail) dbConnDetail.textContent = 'Erro ao detectar Supabase';
      if (supabaseConnectedRow) supabaseConnectedRow.style.display = 'flex';
      if (supabaseRef) supabaseRef.textContent = 'Falha de detecção';
      if (supabaseUrl) supabaseUrl.textContent = supabase.message || '';
      return;
    }

    if (status === 'not-enabled') {
      if (dbConnDetail) dbConnDetail.textContent = 'Projeto sem banco habilitado';
      return;
    }

    if (dbConnDetail) dbConnDetail.textContent = project ? 'Selecione o projeto novamente' : 'Aguardando projeto...';
  }

  // Repositórios são detectados e vinculados exclusivamente de forma automática.

  // ── Lovable + Bolt.new + Replit projects list ──
  function repoFullNameFromProject(proj) {
    const raw = typeof proj?.repo === 'string'
      ? proj.repo
      : (proj?.repo?.full_name || proj?.repo?.fullName || proj?.matchedRepo?.full_name || '');
    return String(raw || '').trim().toLowerCase();
  }

  function projectBelongsToConnectedGithub(proj) {
    // Projetos GPT Studio continuam visíveis mesmo
    // quando a conta/token GitHub atual não enumera o repositório privado. O acesso real
    // ao repo continua sendo validado pelo background antes de qualquer operação.
    const platform = String(proj?.platform || proj?.projectSource || '').toLowerCase();
    if (platform === 'gpt' && proj?.projectSource === 'gpt') return true;
    if (!githubState?.connected) return true;
    const repos = Array.isArray(githubState?.repos) ? githubState.repos : [];
    // Não esconda todos os projetos enquanto o inventário GitHub ainda está carregando
    // ou quando um token fine-grained só libera repositórios específicos.
    if (!repos.length) return true;

    const accessible = (value) => {
      const repoName = String(value || '').trim().toLowerCase();
      if (!repoName) return false;
      return repos.some(r => String(r?.full_name || '').trim().toLowerCase() === repoName);
    };

    // Projeto confirmado/reconciliado.
    if (accessible(repoFullNameFromProject(proj))) return true;

    // Durante a reconciliação assíncrona, não esconda um projeto que já recebeu um
    // candidato exato do background e cujo repositório está acessível neste token.
    if (accessible(proj?.suggestedRepo)) return true;
    if (project?.id === proj?.id) return true;
    const repoName = repoFullNameFromProject(proj);
    if (!repoName) return true;
    const login = String(githubState?.user?.login || '').toLowerCase();
    const owner = repoName.split('/')[0].toLowerCase();
    if (proj?.githubVerified && (!login || owner === login)) return true;

    return false;
  }

  function renderBuilderProjects() {
    const allProjects = [
      ...lovableProjects.map(p => ({ ...p, platform: 'lovable', platformLabel: 'Lovable' })),
      ...boltProjects.map(p => ({ ...p, platform: 'bolt', platformLabel: 'Bolt.new' })),
      ...replitProjects.map(p => ({ ...p, platform: 'replit', platformLabel: 'Replit' })),
      ...gptProjects.map(p => ({ ...p, platform: 'gpt', platformLabel: 'GPT Studio' }))
    ]
      // Quando o GitHub está conectado, a lista representa SOMENTE projetos que realmente
      // possuem repositório acessível pela conta/token atual. Projetos históricos da Lovable,
      // Bolt ou caches antigos deixam de aparecer até terem vínculo GitHub confirmado.
      .filter(projectBelongsToConnectedGithub)
      .sort((a,b) => String(a.name || a.id).localeCompare(String(b.name || b.id), 'pt-BR'));

    if (projectsCount) projectsCount.textContent = String(allProjects.length);
    if (lovableStatus) lovableStatus.textContent = allProjects.length ? String(allProjects.length) : '—';

    const dropdown = document.getElementById('projectsDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';

    if (!allProjects.length) {
      const empty = document.createElement('div');
      empty.className = 'projects-empty';
      empty.textContent = 'Abra um projeto no Lovable, Bolt.new ou Replit, ou crie um no GPT Studio, e clique em atualizar.';
      dropdown.appendChild(empty);
      return;
    }

    allProjects.forEach((proj) => {
      const item = document.createElement('div');
      item.className = 'project-item';
      item.dataset.projectId = proj.id;
      item.dataset.platform = proj.platform;
      if (project?.id === proj.id && (project?.platform || 'lovable') === proj.platform) item.classList.add('active');

      const icon = document.createElement('span');
      icon.className = 'project-item-icon';
      icon.textContent = platformMeta(proj.platform).icon;

      const main = document.createElement('div');
      main.className = 'project-item-main';

      const name = document.createElement('span');
      name.className = 'project-item-name';
      name.textContent = proj.name || proj.id;
      main.appendChild(name);

      const repoName = typeof proj.repo === 'string' ? proj.repo : '';
      const repoMatch = repoName && githubState?.repos?.find(r => r.full_name === repoName || r.name === repoName);
      const meta = document.createElement('span');
      meta.className = 'project-item-meta';
      const dbMeta = (proj.databaseEnabled || proj.databaseStack === 'supabase' || proj.supabase) ? ' · 🗄 Supabase' : '';
      const platformInfo = platformMeta(proj.platform);
      const platformMetaText = `${platformInfo.icon} ${platformInfo.label}`;
      const repoState = repoName ? (proj.githubVerified ? '✓ automático' : 'automático') : '';
      const identityMeta = `ID: ${proj.id}`;
      meta.textContent = `${platformMetaText} · ${repoName ? `🐙 ${repoName} · ${repoState}` : identityMeta}${dbMeta}`;
      main.appendChild(meta);

      const branch = document.createElement('span');
      branch.className = 'project-item-branch';
      branch.textContent = proj.defaultBranch || repoMatch?.default_branch || '';

      item.appendChild(icon);
      item.appendChild(main);
      item.appendChild(branch);
      item.title = `Selecionar e abrir projeto no ${platformMeta(proj.platform).label}`;
      item.addEventListener('click', () => {
        updateSupabaseUI({ status: proj.supabase?.url ? 'detecting' : 'idle', databaseEnabled: !!(proj.databaseEnabled || proj.supabase), projectId: proj.id });
        chrome.runtime.sendMessage({ type: 'SELECT_BUILDER_PROJECT', platform: proj.platform, projectId: proj.id }, (res) => {
          if (res?.ok && res.project) updateProjectUI(res.project);
          if (res?.supabase) updateSupabaseUI(res.supabase);
        });
        chrome.runtime.sendMessage({ type: 'OPEN_BUILDER_PROJECT', platform: proj.platform, projectId: proj.id }, () => {});
        dropdown.style.display = 'none';
        document.getElementById('projectsToggleBtn')?.classList.remove('open');
      });
      dropdown.appendChild(item);
    });
  }

  function renderForceRepositoryDiagnostic(diagnostic) {
    if (!githubForceResult) return;
    if (!diagnostic) { githubForceResult.hidden = true; githubForceResult.textContent = ''; return; }
    const lines = [];
    if (diagnostic.label) lines.push(diagnostic.label);
    if (diagnostic.reason) lines.push(diagnostic.reason);
    if (diagnostic.githubUser) lines.push(`GitHub: @${diagnostic.githubUser} · ${Number(diagnostic.accessibleRepoCount || 0)} repo(s) acessível(is)`);
    if (diagnostic.repository) lines.push(`Repo: ${diagnostic.repository}${diagnostic.branch ? ` · ${diagnostic.branch}` : ''}`);
    else if (diagnostic.suggestedRepo) lines.push(`Candidato: ${diagnostic.suggestedRepo}`);
    if (diagnostic.source) lines.push(`Fonte: ${diagnostic.source}${diagnostic.confidence ? ` · ${Math.round(diagnostic.confidence)}%` : ''}`);
    if (diagnostic.repoListWarning) lines.push(`Aviso GitHub: ${diagnostic.repoListWarning}`);
    githubForceResult.textContent = lines.join('\n');
    githubForceResult.hidden = false;
    githubForceResult.dataset.state = diagnostic.code || '';
  }

  function updateGithubDiagnostic(proj) {
    if (!githubDiagnostic) return;
    if (!proj?.id) {
      githubDiagnostic.hidden = false;
      if (githubDiagnosticBadge) {
        githubDiagnosticBadge.textContent = 'Pronto para buscar';
        githubDiagnosticBadge.classList.remove('is-ok');
        githubDiagnosticBadge.classList.add('is-warning');
      }
      if (githubDiagnosticSource) githubDiagnosticSource.textContent = 'projeto aberto';
      if (githubDiagnosticConfidence) githubDiagnosticConfidence.textContent = '—';
      if (githubDiagnosticBranch) githubDiagnosticBranch.textContent = '—';
      if (githubDiagnosticState) githubDiagnosticState.textContent = 'Aguardando detecção';
      if (githubDiagnosticReason) githubDiagnosticReason.textContent = 'Use o botão abaixo para reler a plataforma aberta e cruzar o projeto com o GitHub conectado.';
      return;
    }
    githubDiagnostic.hidden = false;
    const binding = proj.githubBinding || {};
    const source = binding.source || proj.githubBindingSource || 'aguardando evidência';
    const confidence = Number(binding.confidence ?? proj.githubConfidence ?? 0);
    const branch = binding.branch || proj.defaultBranch || '—';
    const repo = binding.repository || proj.repo || '';
    const verified = binding.verified === true || proj.githubVerified === true;
    const empty = proj.githubRepoEmpty === true;
    const hasCode = proj.githubHasCode === true;
    const stateLabel = repo
      ? (empty ? 'Repo confirmado · sem código' : (hasCode ? 'Repo confirmado · código encontrado' : (verified ? 'Repo verificado' : 'Repo detectado')))
      : (proj.suggestedRepo ? `Candidato: ${proj.suggestedRepo}` : 'Sem vínculo confirmado');
    if (githubDiagnosticSource) githubDiagnosticSource.textContent = source;
    if (githubDiagnosticConfidence) githubDiagnosticConfidence.textContent = confidence ? `${Math.round(confidence)}%` : '—';
    if (githubDiagnosticBranch) githubDiagnosticBranch.textContent = branch;
    if (githubDiagnosticState) githubDiagnosticState.textContent = stateLabel;
    if (githubDiagnosticReason) githubDiagnosticReason.textContent = binding.reason || proj.githubReason || (repo ? `Repositório: ${repo}` : 'A extensão continuará procurando evidência forte no builder e no GitHub.');
    if (githubDiagnosticBadge) {
      githubDiagnosticBadge.textContent = verified ? 'Verificado' : (repo ? 'Detectado' : 'Aguardando');
      githubDiagnosticBadge.classList.toggle('is-ok', verified);
      githubDiagnosticBadge.classList.toggle('is-warning', !verified);
    }
  }

  // ── Project UI ──
  function updateProjectUI(proj) {
    if (!proj) return;
    project = proj;
    applyPlatformIdentity(proj.platform || 'lovable');
    updateGithubDiagnostic(proj);

    if (autoDetectSection) autoDetectSection.style.display = 'block';
    const platformLabel = platformMeta(proj.platform).label;
    const identity = `ID ${proj.id}`;
    if (autoDetectProject) autoDetectProject.textContent = `${platformLabel} · ${proj.name || proj.id} · ${identity}`;
    if (projectConnDetail) projectConnDetail.textContent = `${platformLabel}: ${proj.name || proj.id}`;
    const projectIconEl = projectConnItem?.querySelector('.connection-icon');
    if (projectIconEl) projectIconEl.textContent = platformMeta(proj.platform).icon;

    if (repoConnDetail) {
      if (proj.repo && proj.githubRepoEmpty) repoConnDetail.textContent = `${proj.repo} · automático ✓ · aguardando código`;
      else if (proj.repo && proj.githubVerified) repoConnDetail.textContent = `${proj.repo} · verificado ✓`;
      else if (proj.repo) repoConnDetail.textContent = `${proj.repo} · detectado`;
      else repoConnDetail.textContent = 'Detectando automaticamente...';
    }
    if (repoConnItem) {
      repoConnItem.classList.toggle('connected', !!proj.repo);
      repoConnItem.title = proj.githubVerified
        ? `GitHub detectado automaticamente: ${proj.githubReason || proj.repo}`
        : 'Repositório do projeto ainda não confirmado automaticamente.';
    }
    if (projectConnItem) projectConnItem.classList.toggle('connected', !!proj.id);

    if (chatProjectLabel) {
      chatProjectLabel.style.display = 'flex';
      const nameEl = chatProjectLabel.querySelector('.chat-project-name');
      const repoEl = chatProjectLabel.querySelector('.chat-project-repo');
      if (nameEl) nameEl.textContent = `${platformLabel} · ${proj.name || proj.id}`;
      if (repoEl) {
        if (proj.repo) repoEl.textContent = `${proj.repo}${proj.githubRepoEmpty ? ' · ✓ automático · aguardando código' : (proj.githubVerified ? ' · ✓ automático' : ' · automático')}`;
        else repoEl.textContent = identity;
      }
    }
    renderBuilderProjects();
    refreshIntegrationStatus();
  }

  // ── Event: Open GitHub Token page ──
  if (openTokenBtn) {
    openTokenBtn.addEventListener('click', () => {
      const url = 'https://github.com/settings/tokens/new?description=LoveBoltReplit%20GPT%20Connector&scopes=read:user,repo,read:org,workflow';
      chrome.tabs.create({ url });
      integrationConnect.style.display = 'none';
      tokenForm.style.display = 'block';
    });
  }

  // ── Event: Paste token ──
  if (pasteTokenBtn) {
    pasteTokenBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (tokenInput) tokenInput.value = text;
      } catch (e) {}
    });
  }

  // ── Event: Connect GitHub ──
  if (connectBtn) {
    connectBtn.addEventListener('click', () => {
      const token = tokenInput.value.trim();
      if (!token) return;
      connectBtn.disabled = true;
      const originalText = connectBtn.textContent;
      connectBtn.textContent = 'Conectando GitHub...';

      chrome.runtime.sendMessage({ type: 'GITHUB_CONNECT', token }, (res) => {
        const runtimeError = chrome.runtime.lastError;
        connectBtn.disabled = false;
        connectBtn.textContent = originalText;

        if (res?.ok) {
          const nextGithub = res.github || { connected: true, user: res.user || null, repos: res.repos || [] };
          updateGitHubUI(nextGithub);
          if (tokenInput) tokenInput.value = '';
          if (integrationConnect) integrationConnect.style.display = 'none';
          if (tokenForm) tokenForm.style.display = 'none';
          if (integrationConnected) integrationConnected.style.display = 'block';
          return;
        }

        // Se o callback do service worker se perder durante uma reinicialização, o storage
        // é a fonte de verdade: um token já validado não deve deixar o botão aberto.
        chrome.storage.local.get('github', (data) => {
          if (data?.github?.connected) {
            updateGitHubUI(data.github);
            if (tokenInput) tokenInput.value = '';
            return;
          }
          const errorText = res?.error || runtimeError?.message || 'Erro ao conectar';
          if (githubState?.connected) {
            refreshIntegrationStatus();
          } else {
            if (integrationConnect) integrationConnect.style.display = 'none';
            if (tokenForm) tokenForm.style.display = 'block';
            setStatus(integrationStatus, errorText, 'badge-offline');
          }
        });
      });
    });
  }

  // ── Event: Cancel ──
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      tokenForm.style.display = 'none';
      integrationConnect.style.display = 'block';
    });
  }

  // ── Event: Toggle DB details ──
  const dbConnItem = document.getElementById('dbConnItem');
  const dbDetails = document.getElementById('dbDetails');
  const dbToggle = document.getElementById('dbToggle');

  if (dbConnItem && dbDetails) {
    dbConnItem.addEventListener('click', () => {
      const isOpen = dbDetails.style.display !== 'none';
      dbDetails.style.display = isOpen ? 'none' : 'block';
      dbConnItem.classList.toggle('open', !isOpen);
    });
  }

  // O bloco Projeto da integração abre o seletor sem ocupar uma linha extra no topo.
  if (projectConnItem) {
    projectConnItem.addEventListener('click', () => {
      const dropdown = document.getElementById('projectsDropdown');
      const toggle = document.getElementById('projectsToggleBtn');
      if (!dropdown) return;
      const isOpen = dropdown.style.display !== 'none';
      dropdown.style.display = isOpen ? 'none' : 'block';
      toggle?.classList.toggle('open', !isOpen);
    });
  }

  // ── Event: Toggle / refresh Lovable + Bolt.new + Replit projects ──
  const projectsToggleBtn = document.getElementById('projectsToggleBtn');
  const projectsDropdown = document.getElementById('projectsDropdown');

  if (projectsToggleBtn && projectsDropdown) {
    projectsToggleBtn.addEventListener('click', () => {
      const isOpen = projectsDropdown.style.display !== 'none';
      projectsDropdown.style.display = isOpen ? 'none' : 'block';
      projectsToggleBtn.classList.toggle('open', !isOpen);
    });
  }

  const refreshAllProjects = (triggerBtn) => {
    projectsRefreshBtn?.classList.add('spinning');
    headerPullBtn?.classList.add('spinning');
    triggerBtn?.setAttribute?.('aria-busy', 'true');
    const finishRefresh = () => {
      projectsRefreshBtn?.classList.remove('spinning');
      headerPullBtn?.classList.remove('spinning');
      triggerBtn?.removeAttribute?.('aria-busy');
      renderBuilderProjects();
    };
    const syncBuilders = () => {
      let pending = 3;
      const done = () => { if (--pending <= 0) finishRefresh(); };
      chrome.runtime.sendMessage({ type: 'LOVABLE_PROJECTS_SYNC' }, (res) => {
        if (Array.isArray(res?.projects)) lovableProjects = res.projects;
        done();
      });
      chrome.runtime.sendMessage({ type: 'BOLT_PROJECTS_SYNC' }, (res) => {
        if (Array.isArray(res?.projects)) boltProjects = res.projects;
        done();
      });
      chrome.runtime.sendMessage({ type: 'REPLIT_PROJECTS_SYNC' }, (res) => {
        if (Array.isArray(res?.projects)) replitProjects = res.projects;
        done();
      });
    };
    if (githubState?.connected) {
      chrome.runtime.sendMessage({ type: 'FORCE_REPOSITORY_DISCOVERY' }, (res) => {
        if (res?.github) updateGitHubUI(res.github);
        if (res?.project) updateProjectUI(res.project);
        if (res?.diagnostic) renderForceRepositoryDiagnostic(res.diagnostic);
        syncBuilders();
      });
    } else syncBuilders();
  };

  projectsRefreshBtn?.addEventListener('click', () => refreshAllProjects(projectsRefreshBtn));
  headerPullBtn?.addEventListener('click', () => refreshAllProjects(headerPullBtn));

  forceRepoDetectBtn?.addEventListener('click', () => {
    if (forceRepoDetectBtn.disabled) return;
    forceRepoDetectBtn.disabled = true;
    forceRepoDetectBtn.classList.add('spinning');
    forceRepoDetectBtn.setAttribute('aria-busy', 'true');
    const label = forceRepoDetectBtn.querySelector('.github-force-detect-label');
    const previousLabel = label?.textContent || 'Forçar detecção do repositório';
    if (label) label.textContent = 'Procurando repositório…';
    if (githubForceResult) { githubForceResult.hidden = false; githubForceResult.textContent = 'Relendo projeto aberto e consultando o GitHub conectado…'; githubForceResult.dataset.state = 'RUNNING'; }

    chrome.runtime.sendMessage({ type: 'FORCE_REPOSITORY_DISCOVERY' }, (res) => {
      forceRepoDetectBtn.disabled = false;
      forceRepoDetectBtn.classList.remove('spinning');
      forceRepoDetectBtn.removeAttribute('aria-busy');
      if (label) label.textContent = previousLabel;
      if (chrome.runtime.lastError) {
        renderForceRepositoryDiagnostic({ code: 'RUNTIME_ERROR', label: 'Falha ao executar detecção', reason: chrome.runtime.lastError.message });
        return;
      }
      if (res?.github) updateGitHubUI(res.github);
      if (res?.project) updateProjectUI(res.project);
      renderForceRepositoryDiagnostic(res?.diagnostic || { code: 'UNKNOWN', label: 'Sem diagnóstico', reason: res?.error || 'A extensão não retornou detalhes da detecção.' });
      renderBuilderProjects();
    });
  });

  // ── Event: Save Supabase key ──
  if (supabaseKeySaveBtn) {
    supabaseKeySaveBtn.addEventListener('click', () => {
      const key = supabaseKeyInput.value.trim();
      const url = supabaseAutoUrl?.value;
      if (!key) return;
      chrome.runtime.sendMessage({ type: 'SUPABASE_CONNECT', url, anonKey: key, projectId: project?.id || null, source: 'manual' }, (res) => {
        if (res?.ok) supabaseKeyForm.style.display = 'none';
      });
    });
  }

  // ── Event: Paste Supabase key ──
  if (pasteKeyBtn) {
    pasteKeyBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (supabaseKeyInput) supabaseKeyInput.value = text;
      } catch (e) {}
    });
  }

  // ── Event: Skip Supabase ──
  if (supabaseSkipBtn) {
    supabaseSkipBtn.addEventListener('click', () => {
      supabaseKeyForm.style.display = 'none';
      if (dbConnDetail) dbConnDetail.textContent = 'Pulado';
    });
  }

  // ── Event: bloqueio do chat oficial ON/OFF ──
  if (overlayToggleBtn) {
    overlayToggleBtn.addEventListener('click', () => {
      chrome.storage.local.get(OVERLAY_ENABLED_KEY, (data) => {
        const next = data?.[OVERLAY_ENABLED_KEY] === false;
        chrome.storage.local.set({ [OVERLAY_ENABLED_KEY]: next }, () => applyOverlayToggleState(next));
      });
    });
  }

  // ── Event: Settings ──
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // ── Listen for messages from background ──
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'GITHUB_STATUS':
        updateGitHubUI(msg);
        break;
      case 'SUPABASE_STATUS':
        updateSupabaseUI(msg);
        break;
      case 'SUPABASE_PENDING':
        updateSupabaseUI({ connected: false, pendingUrl: msg.url });
        break;
      case 'PROJECT_DETECTED':
        updateProjectUI(msg.project);
        break;
      case 'FORCE_REPOSITORY_DISCOVERY_RESULT':
        if (msg.project) updateProjectUI(msg.project);
        if (msg.diagnostic) renderForceRepositoryDiagnostic(msg.diagnostic);
        break;
      case 'LOVABLE_PROJECTS_UPDATED':
        lovableProjects = Array.isArray(msg.projects) ? msg.projects : [];
        renderBuilderProjects();
        break;
      case 'BOLT_PROJECTS_UPDATED':
        boltProjects = Array.isArray(msg.projects) ? msg.projects : [];
        renderBuilderProjects();
        break;
      case 'REPLIT_PROJECTS_UPDATED':
        replitProjects = Array.isArray(msg.projects) ? msg.projects : [];
        renderBuilderProjects();
        break;
      case 'GPT_PROJECTS_UPDATED':
        gptProjects = Array.isArray(msg.projects) ? msg.projects : [];
        renderBuilderProjects();
        break;
      case 'BUILDER_PROJECTS_UPDATED': {
        const projects = Array.isArray(msg.projects) ? msg.projects : [];
        lovableProjects = projects.filter(p => String(p?.platform || 'lovable').toLowerCase() === 'lovable');
        boltProjects = projects.filter(p => String(p?.platform || '').toLowerCase() === 'bolt');
        replitProjects = projects.filter(p => String(p?.platform || '').toLowerCase() === 'replit');
        gptProjects = projects.filter(p => String(p?.platform || '').toLowerCase() === 'gpt');
        renderBuilderProjects();
        break;
      }
      case 'CHAT_CONNECTED':
        if (chatStatusDot) chatStatusDot.className = 'chat-status-dot connected';
        if (chatStatusText) chatStatusText.textContent = 'Conectado';
        if (chatgptStatus) chatgptStatus.textContent = '✓';
        break;
      case 'CHAT_DISCONNECTED':
        if (chatStatusDot) chatStatusDot.className = 'chat-status-dot offline';
        if (chatStatusText) chatStatusText.textContent = 'Aguardando ChatGPT...';
        if (chatgptStatus) chatgptStatus.textContent = '—';
        break;
      case 'PUSH_SUCCESS':
        break;
    }
    if (sendResponse) sendResponse({ ok: true });
    return true;
  });

  // ── Storage change listener ──
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.detectedProject) updateProjectUI(changes.detectedProject.newValue);
    if (changes.github) updateGitHubUI(changes.github.newValue);
    if (changes.supabase) updateSupabaseUI(changes.supabase.newValue);
    if (changes.lovableProjects) { lovableProjects = changes.lovableProjects.newValue || []; renderBuilderProjects(); }
    if (changes.boltProjects) { boltProjects = changes.boltProjects.newValue || []; renderBuilderProjects(); }
    if (changes.replitProjects) { replitProjects = changes.replitProjects.newValue || []; renderBuilderProjects(); }
    if (changes[OVERLAY_ENABLED_KEY]) applyOverlayToggleState(changes[OVERLAY_ENABLED_KEY].newValue !== false);
    if (changes[DUAL_THEME_STORAGE_KEY]) applyTheme();
  });

  // ── v5.8.0: tema claro único em toda a extensão ──
  function applyTheme() {
    document.body.classList.add('light');
    document.documentElement.classList.add('light');
    document.documentElement.dataset.theme = 'light';
  }

  function enforceLightTheme() {
    applyTheme();
    localStorage.setItem('lgc-theme', 'light');
    chrome.storage.local.set({ [DUAL_THEME_STORAGE_KEY]: 'light' });
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'CRCELL_DUAL_THEME_CHANGED', theme: 'light' }, '*');
      }
    } catch (_) {}
  }

  enforceLightTheme();

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const data = event.data || {};
    if (data.type !== 'CRCELL_DUAL_THEME') return;
    applyTheme();
  });

  // ── Integração recolhível: mantém o estado e entrega espaço ao Chat ──
  function setupIntegrationToggle() {
    const toggleBtn = document.getElementById('integrationToggleBtn');
    const toggleLabel = document.getElementById('integrationToggleLabel');
    const integrationCard = document.getElementById('integrationCard');
    const chatMessages = document.getElementById('chatMessages');
    const STORAGE_KEY = 'lgc-integration-collapsed';

    if (!toggleBtn || !integrationCard) return;

    function applyIntegrationState(collapsed, persist = true) {
      integrationCard.classList.toggle('integration-collapsed', collapsed);
      toggleBtn.classList.toggle('is-collapsed', collapsed);
      toggleBtn.classList.toggle('open', !collapsed);
      toggleBtn.setAttribute('aria-expanded', String(!collapsed));
      toggleBtn.title = collapsed ? 'Mostrar integração' : 'Ocultar integração';
      if (toggleLabel) toggleLabel.textContent = collapsed ? 'Mostrar integração' : 'Ocultar integração';

      if (persist) localStorage.setItem(STORAGE_KEY, collapsed ? 'true' : 'false');

      // Após a mudança de altura, mantém o fim do histórico visível.
      requestAnimationFrame(() => {
        if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
      });
    }

    const savedCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
    applyIntegrationState(savedCollapsed, false);

    toggleBtn.addEventListener('click', () => {
      const collapsed = !integrationCard.classList.contains('integration-collapsed');
      applyIntegrationState(collapsed, true);
    });
  }

  // ── Prompt shortcuts / presets + universal application mode ──
  function setupPromptShortcuts() {
    const btn = document.getElementById('promptShortcutsBtn');
    const panel = document.getElementById('promptShortcutsPanel');
    const content = document.getElementById('promptShortcutsContent');
    const closeBtn = document.getElementById('promptShortcutsClose');
    const countEl = document.getElementById('promptShortcutsCount');
    const chatInput = document.getElementById('chatInput');
    const officialBtn = document.getElementById('chatOfficialBtn');
    const githubBtn = document.getElementById('chatGithubBtn');
    const categories = Array.isArray(window.LG_PROMPT_CATEGORIES) ? window.LG_PROMPT_CATEGORIES : [];
    const templates = Array.isArray(window.LG_PROMPT_TEMPLATES) ? window.LG_PROMPT_TEMPLATES : [];

    if (!btn || !panel || !content || !chatInput) return;
    if (countEl) countEl.textContent = String(templates.length);

    const MODE_DEFINITIONS = [
      {
        id: 'analyze',
        icon: '🔎',
        label: 'Somente analisar',
        description: 'Diagnostica e recomenda. Não altera arquivos, banco, migrations, configuração ou deploy.',
        instruction: `SOMENTE ANALISAR
Analise o estado atual do projeto em relação ao prompt selecionado. Identifique problemas, riscos, oportunidades e mudanças recomendadas, com prioridade e justificativa. NÃO altere arquivos, NÃO aplique patches, NÃO crie ou execute migrations, NÃO modifique banco/Supabase, NÃO faça commit, NÃO publique e NÃO execute mudanças. Entregue apenas o diagnóstico e o plano recomendado.`
      },
      {
        id: 'analyze-fix',
        icon: '🛠️',
        label: 'Analisar e corrigir',
        description: 'Diagnostica primeiro e depois aplica somente as correções necessárias.',
        instruction: `ANALISAR E CORRIGIR
Primeiro analise o estado atual do projeto e identifique o que realmente precisa ser corrigido em relação ao prompt selecionado. Depois aplique somente as mudanças necessárias, preserve funcionalidades não relacionadas, valide o resultado e evite alterações destrutivas desnecessárias. Em mudanças de banco, autenticação, RLS, migrations, exclusão, cobrança ou arquitetura, priorize menor privilégio, reversibilidade e integridade dos dados.`
      },
      {
        id: 'fix-no-visual',
        icon: '🔒',
        label: 'Corrigir sem alterar visual',
        description: 'Corrige código, segurança e estrutura preservando completamente a aparência atual.',
        instruction: `CORRIGIR SEM ALTERAR VISUAL
Analise o projeto e aplique somente correções técnicas relacionadas ao prompt selecionado. Preserve completamente a aparência atual: não altere layout, cores, tipografia, espaçamentos visíveis, ícones, tamanhos, animações, temas, ordem visual de componentes ou identidade gráfica. Pode corrigir código, lógica, segurança, performance, acessibilidade não visual, banco, APIs e manutenção desde que o resultado visual permaneça equivalente. Se o prompt for essencialmente visual, não execute redesign; limite-se às melhorias técnicas que não mudem a aparência.`
      }
    ];

    let selectedPreset = null;
    let modeOverlay = null;

    function normalizeLabel(preset) {
      const label = preset?.label || `Prompt ${preset?.id || ''}`;
      return /^\s*\d+\s*[·.\-–—]/.test(label) ? label : `${preset.id} · ${label}`;
    }

    function closePanel() {
      panel.style.display = 'none';
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }

    function openPanel() {
      panel.style.display = 'block';
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }

    function closeModeDialog() {
      if (modeOverlay) {
        modeOverlay.remove();
        modeOverlay = null;
      }
      selectedPreset = null;
    }

    function buildFinalPrompt(preset, mode) {
      const modeBlock = `[MODO DE APLICAÇÃO]\n${mode.instruction}\n\n[PROMPT SELECIONADO]\n${normalizeLabel(preset)}\n\n${preset.prompt}`;

      // Prompt 28: em qualquer modo de correção, o COMANDO ZERO precisa ser literalmente
      // a primeira instrução enviada ao GPT, antes inclusive do bloco de modo.
      if (preset.id === 28 && mode.id !== 'analyze') {
        return `${preset.prompt}\n\n[MODO DE APLICAÇÃO]\n${mode.instruction}\n\n[REGRA DE PRIORIDADE]\nO COMANDO ZERO acima é a primeira etapa obrigatória e deve ser executado antes de qualquer outra correção.`;
      }

      return modeBlock;
    }

    function sendPromptWithRoute(preset, mode, route) {
      const finalPrompt = buildFinalPrompt(preset, mode);
      const targetRoute = route === 'official' ? 'official' : 'github';

      if (typeof window.LG_SEND_CHAT_COMMAND === 'function') {
        window.LG_SEND_CHAT_COMMAND(finalPrompt, targetRoute);
      } else {
        chatInput.value = finalPrompt;
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        const targetButton = targetRoute === 'official' ? officialBtn : githubBtn;
        targetButton?.click();
      }

      closeModeDialog();
      closePanel();
      chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function openModeDialog(preset) {
      closeModeDialog();
      selectedPreset = preset;

      const overlay = document.createElement('div');
      overlay.className = 'prompt-mode-overlay';
      overlay.setAttribute('role', 'presentation');

      const dialog = document.createElement('div');
      dialog.className = 'prompt-mode-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'promptModeTitle');

      const header = document.createElement('div');
      header.className = 'prompt-mode-header';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'prompt-mode-title-wrap';

      const eyebrow = document.createElement('span');
      eyebrow.className = 'prompt-mode-eyebrow';
      eyebrow.textContent = 'Prompt selecionado';

      const title = document.createElement('strong');
      title.className = 'prompt-mode-title';
      title.id = 'promptModeTitle';
      title.textContent = normalizeLabel(preset);

      titleWrap.appendChild(eyebrow);
      titleWrap.appendChild(title);

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'prompt-mode-close';
      close.setAttribute('aria-label', 'Fechar');
      close.textContent = '×';
      close.addEventListener('click', closeModeDialog);

      header.appendChild(titleWrap);
      header.appendChild(close);
      dialog.appendChild(header);

      if (preset.sensitive) {
        const warning = document.createElement('div');
        warning.className = 'prompt-sensitive-warning';
        const warningTitle = document.createElement('strong');
        warningTitle.textContent = '⚠️ Alteração sensível';
        const warningText = document.createElement('span');
        warningText.textContent = preset.sensitiveReason || 'Este prompt pode alterar uma parte sensível do projeto.';
        warning.appendChild(warningTitle);
        warning.appendChild(warningText);
        dialog.appendChild(warning);
      }

      const question = document.createElement('div');
      question.className = 'prompt-mode-question';
      question.textContent = 'Como deseja aplicar este prompt?';
      dialog.appendChild(question);

      const modes = document.createElement('div');
      modes.className = 'prompt-mode-options';

      MODE_DEFINITIONS.forEach((mode) => {
        const modeBtn = document.createElement('button');
        modeBtn.type = 'button';
        modeBtn.className = `prompt-mode-option prompt-mode-option--${mode.id}`;

        const modeIcon = document.createElement('span');
        modeIcon.className = 'prompt-mode-icon';
        modeIcon.textContent = mode.icon;

        const modeText = document.createElement('span');
        modeText.className = 'prompt-mode-copy';

        const modeLabel = document.createElement('strong');
        modeLabel.textContent = mode.label;

        const modeDescription = document.createElement('span');
        modeDescription.textContent = mode.description;

        modeText.appendChild(modeLabel);
        modeText.appendChild(modeDescription);
        modeBtn.appendChild(modeIcon);
        modeBtn.appendChild(modeText);
        modeBtn.addEventListener('click', () => {
          question.textContent = 'Onde deseja enviar este prompt?';
          modes.innerHTML = '';

          const routeOptions = [
            {
              id: 'official', icon: '💜⚡', label: 'Chat oficial',
              description: 'Envia diretamente ao agente do Lovable, Bolt.new ou Replit. Pode consumir tokens/créditos da plataforma.'
            },
            {
              id: 'github', icon: '🐙', label: 'Chat GitHub',
              description: 'Envia ao ChatGPT para trabalhar no repositório GitHub vinculado. Não dispara o agente oficial da plataforma.'
            }
          ];

          routeOptions.forEach((route) => {
            const routeBtn = document.createElement('button');
            routeBtn.type = 'button';
            routeBtn.className = `prompt-mode-option prompt-route-option prompt-route-option--${route.id}`;

            const routeIcon = document.createElement('span');
            routeIcon.className = 'prompt-mode-icon';
            routeIcon.textContent = route.icon;

            const routeText = document.createElement('span');
            routeText.className = 'prompt-mode-copy';
            const routeLabel = document.createElement('strong');
            routeLabel.textContent = route.label;
            const routeDescription = document.createElement('span');
            routeDescription.textContent = route.description;
            routeText.appendChild(routeLabel);
            routeText.appendChild(routeDescription);
            routeBtn.appendChild(routeIcon);
            routeBtn.appendChild(routeText);
            routeBtn.addEventListener('click', () => sendPromptWithRoute(preset, mode, route.id));
            modes.appendChild(routeBtn);
          });

          footer.textContent = 'Chat oficial usa o agente/créditos da plataforma. Chat GitHub não envia nada ao agente oficial.';
        });
        modes.appendChild(modeBtn);
      });

      dialog.appendChild(modes);

      const footer = document.createElement('div');
      footer.className = 'prompt-mode-footer';
      footer.textContent = '1) Escolha o modo de aplicação. 2) Escolha Chat oficial ou Chat GitHub antes do envio.';
      dialog.appendChild(footer);

      overlay.appendChild(dialog);
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeModeDialog();
      });

      document.body.appendChild(overlay);
      modeOverlay = overlay;
      close.focus();
    }

    content.innerHTML = '';
    categories.forEach((cat) => {
      const catTemplates = templates.filter((item) => item.category === cat.id);
      if (!catTemplates.length) return;

      const section = document.createElement('section');
      section.className = 'prompt-category';

      const header = document.createElement('div');
      header.className = 'prompt-category-header';

      const label = document.createElement('span');
      label.className = 'prompt-category-label';
      label.style.color = cat.color || 'var(--accent)';
      label.textContent = `${cat.label} (${catTemplates.length})`;

      const line = document.createElement('span');
      line.className = 'prompt-category-line';
      line.style.background = cat.color || 'var(--accent)';

      header.appendChild(label);
      header.appendChild(line);
      section.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'prompt-shortcuts-grid';

      catTemplates.forEach((preset) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'prompt-preset-chip';
        if (preset.sensitive) item.classList.add('prompt-preset-chip--sensitive');
        item.textContent = `${preset.sensitive ? '⚠️ ' : ''}${normalizeLabel(preset)}`;
        item.title = `${preset.sensitive ? '⚠️ Alteração sensível — ' : ''}${preset.prompt}`;
        item.style.setProperty('--prompt-cat-color', cat.color || '#7c3aed');

        item.addEventListener('click', () => openModeDialog(preset));
        grid.appendChild(item);
      });

      section.appendChild(grid);
      content.appendChild(section);
    });

    btn.addEventListener('click', () => {
      const isOpen = panel.style.display !== 'none';
      if (isOpen) closePanel();
      else openPanel();
    });

    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (modeOverlay) closeModeDialog();
        else if (panel.style.display !== 'none') closePanel();
      }
    });
  }

  setupPromptShortcuts();
  setupIntegrationToggle();

  // ── Init ──
  loadState();
  loadOverlayToggleState();

  console.log('[SidePanel] LoveBolt loaded v3.48.0');
})();
