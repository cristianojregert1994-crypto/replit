/**
 * LoveBoltReplit GPT Connector - Bolt.new detector v3.48.0
 * Detecta projeto atual e projetos visíveis em bolt.new.
 */
(function () {
  'use strict';
  if (window.__LOVEBOLT_BOLT_DETECT_INJECTED__) return;
  window.__LOVEBOLT_BOLT_DETECT_INJECTED__ = true;

  const LOG_PREFIX = '[Bolt Detect]';
  const supabaseCache = { url: null, anonKey: null, projectRef: null };

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function cleanProjectName(value) {
    const text = cleanText(value);
    if (!text || text.length < 2 || text.length > 140) return '';
    if (/^(bolt|bolt\.new|projects?|project|open|abrir|edit|editar|home|dashboard)$/i.test(text)) return '';
    if (/^[a-z0-9_-]{18,}$/i.test(text)) return '';
    return text;
  }

  function projectIdFromUrl(value) {
    try {
      const u = new URL(String(value || ''), location.origin);
      if (!/(^|\.)bolt\.new$/i.test(u.hostname)) return '';
      let m = u.pathname.match(/^\/~\/([^/?#]+)/i);
      if (m) return decodeURIComponent(m[1]);
      m = u.pathname.match(/^\/project\/([^/?#]+)/i);
      if (m) return decodeURIComponent(m[1]);
      return '';
    } catch (_) { return ''; }
  }

  function captureSupabaseFromUrl(value) {
    const text = String(value || '');
    const m = text.match(/https:\/\/([a-z0-9-]+)\.supabase\.(co|in)/i);
    if (!m) return;
    supabaseCache.projectRef = supabaseCache.projectRef || m[1];
    supabaseCache.url = supabaseCache.url || `https://${m[1]}.supabase.${m[2]}`;
  }

  function captureHeaders(headers) {
    if (!headers) return;
    try {
      if (headers instanceof Headers) {
        const key = headers.get('apikey');
        if (key && key.length > 20) supabaseCache.anonKey = key;
        return;
      }
      if (typeof headers === 'object') {
        for (const [k,v] of Object.entries(headers)) {
          if (String(k).toLowerCase() === 'apikey' && String(v).length > 20) supabaseCache.anonKey = String(v);
        }
      }
    } catch (_) {}
  }

  function interceptNetwork() {
    try {
      const originalFetch = window.fetch;
      window.fetch = function (...args) {
        try {
          captureSupabaseFromUrl(typeof args[0] === 'string' ? args[0] : args[0]?.url);
          captureHeaders(args[1]?.headers);
        } catch (_) {}
        return originalFetch.apply(this, args);
      };
    } catch (_) {}

    try {
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        try { captureSupabaseFromUrl(url); } catch (_) {}
        return originalOpen.call(this, method, url, ...rest);
      };
      XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        try {
          if (String(name).toLowerCase() === 'apikey' && String(value).length > 20) supabaseCache.anonKey = String(value);
        } catch (_) {}
        return originalSetHeader.call(this, name, value);
      };
    } catch (_) {}
  }

  function scanSupabase() {
    try {
      const text = document.documentElement?.innerHTML || '';
      const url = text.match(/https:\/\/[a-z0-9-]+\.supabase\.(?:co|in)/i)?.[0];
      if (url) captureSupabaseFromUrl(url);
      const key = text.match(/(?:sb_publishable_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/)?.[0];
      if (key && key.length > 20) supabaseCache.anonKey = supabaseCache.anonKey || key;
    } catch (_) {}
    if (!supabaseCache.url) return null;
    return {
      url: supabaseCache.url,
      anonKey: supabaseCache.anonKey || '',
      projectRef: supabaseCache.projectRef || '',
      source: 'bolt-page'
    };
  }

  function githubRepoCandidatesFromPage() {
    const reserved = new Set(['settings','apps','marketplace','features','pricing','login','join','new','notifications','issues','pulls','codespaces','sponsors','explore','topics','collections','events','search','orgs','organizations','users','account']);
    const ranked = new Map();
    const parse = (raw) => {
      try {
        const value = String(raw || '').trim().replace(/^git\+/, '');
        const ssh = value.match(/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i);
        if (ssh) return `${ssh[1]}/${ssh[2]}`;
        if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) return value;
        const u = new URL(value, location.href);
        if (!/(^|\.)github\.com$/i.test(u.hostname)) return '';
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length < 2) return '';
        const owner = parts[0], repo = parts[1].replace(/\.git$/i, '');
        if (reserved.has(owner.toLowerCase())) return '';
        if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return '';
        return `${owner}/${repo}`;
      } catch (_) { return ''; }
    };
    const add = (raw, score, source, evidence = '') => {
      const repo = parse(raw);
      if (!repo) return;
      const key = repo.toLowerCase();
      const item = { repo, score, source, evidence: cleanText(evidence).slice(0, 160) };
      const old = ranked.get(key);
      if (!old || score > old.score) ranked.set(key, item);
    };

    document.querySelectorAll('[data-github-repo],[data-repository-url],[data-repo-url],[data-git-remote]').forEach((el) => {
      for (const attr of ['data-github-repo','data-repository-url','data-repo-url','data-git-remote']) {
        if (el.hasAttribute(attr)) add(el.getAttribute(attr), 100, `bolt-${attr}`, el.outerHTML);
      }
    });
    document.querySelectorAll('a[href*="github.com/"]').forEach((link) => {
      const context = [link.textContent, link.getAttribute('aria-label'), link.getAttribute('title'), link.closest('button,[role="button"],li,section,div')?.textContent].filter(Boolean).join(' ').toLowerCase();
      const integration = /github|repository|reposit[oó]rio|repo|connected|conectado|sync|remote|source control|version control|git\b/i.test(context);
      add(link.href, integration ? 98 : 72, integration ? 'bolt-github-integration-link' : 'bolt-github-link', context);
    });

    const serialized = Array.from(document.scripts).map(s => s.src ? '' : (s.textContent || '')).join('\n').slice(0, 1_750_000);
    const patterns = [
      [/(?:githubRepo|githubRepository|repositoryUrl|repoUrl|remoteUrl|gitRemote|gitUrl)["']?\s*[:=]\s*["'](https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?)["']/gi, 99, 'bolt-serialized-github-field'],
      [/(?:githubRepo|githubRepository|repository|repo)["']?\s*[:=]\s*["']([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)["']/gi, 98, 'bolt-serialized-repo-field']
    ];
    for (const [pattern, score, source] of patterns) for (const m of serialized.matchAll(pattern)) add(m[1], score, source, m[0]);
    return [...ranked.values()].sort((a,b) => b.score - a.score);
  }

  function nameFromDocument() {
    const title = cleanText(document.title)
      .replace(/\s*[-–|]\s*Bolt(?:\.new)?\s*$/i, '')
      .replace(/^Bolt(?:\.new)?\s*[-–|]\s*/i, '');
    if (cleanProjectName(title)) return cleanProjectName(title);

    const selectors = [
      '[data-project-name]',
      '[aria-label*="project" i]',
      'header h1', 'header h2',
      '[class*="project-title"]', '[class*="project-name"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const candidate = cleanProjectName(el?.getAttribute?.('data-project-name') || el?.textContent || el?.getAttribute?.('aria-label'));
      if (candidate) return candidate;
    }
    return '';
  }

  function previewUrlFromPage() {
    const ranked = [];
    const add = (raw, score, source) => {
      try {
        const url = new URL(String(raw || ''), location.href);
        if (!/^https?:$/.test(url.protocol)) return;
        if (/(^|\.)bolt\.new$/i.test(url.hostname)) return;
        if (/(^|\.)github\.com$|(^|\.)supabase\.(?:co|in)$|(^|\.)chatgpt\.com$/i.test(url.hostname)) return;
        let boost = 0;
        if (/\.bolt\.host$/i.test(url.hostname) || /(^|\.)bolt\.host$/i.test(url.hostname)) boost = 25;
        else if (/webcontainer-api\.io$/i.test(url.hostname) || /stackblitz\.(?:io|com)$/i.test(url.hostname)) boost = 18;
        ranked.push({ url: url.href, score: score + boost, source });
      } catch (_) {}
    };
    document.querySelectorAll('[data-preview-url],[data-deployment-url],[data-live-url]').forEach((el) => {
      for (const attr of ['data-preview-url','data-deployment-url','data-live-url']) if (el.hasAttribute(attr)) add(el.getAttribute(attr), 100, `bolt-${attr}`);
    });
    document.querySelectorAll('iframe[src]').forEach((frame) => add(frame.src, 94, 'bolt-preview-iframe'));
    document.querySelectorAll('a[href]').forEach((anchor) => {
      const context = cleanText([anchor.textContent, anchor.getAttribute('aria-label'), anchor.getAttribute('title')].filter(Boolean).join(' '));
      if (/preview|open app|website|deploy|published|production|live/i.test(context) || /\.bolt\.host(?:\/|$)/i.test(anchor.href)) add(anchor.href, 90, 'bolt-preview-link');
    });
    ranked.sort((a,b) => b.score - a.score);
    return ranked[0]?.url || '';
  }

  function detectCurrentProject() {
    const id = projectIdFromUrl(location.href);
    if (!id) return null;
    const editorUrl = `https://bolt.new/~/${encodeURIComponent(id)}`;
    const repoCandidates = githubRepoCandidatesFromPage();
    const topRepo = repoCandidates[0] || null;
    const repo = topRepo && Number(topRepo.score || 0) >= 95 ? topRepo.repo : '';
    return {
      id,
      name: nameFromDocument() || id,
      platform: 'bolt',
      platformLabel: 'Bolt.new',
      editorUrl,
      url: editorUrl,
      previewUrl: previewUrlFromPage(),
      repo,
      repoCandidates,
      githubBindingSource: repo ? topRepo.source : '',
      githubConfidence: repo ? Number(topRepo.score || 0) : 0,
      githubVerified: false,
      githubReason: repo ? `Evidência direta encontrada no Bolt.new: ${topRepo.source}` : '',
      supabase: scanSupabase(),
      detectedAt: new Date().toISOString(),
      source: repo ? 'bolt-page-evidence' : 'bolt-url'
    };
  }

  function nameFromAnchor(anchor) {
    const candidates = [
      anchor.dataset?.projectName,
      anchor.getAttribute('aria-label'),
      anchor.getAttribute('title'),
      anchor.querySelector('[data-project-name]')?.getAttribute('data-project-name'),
      anchor.querySelector('h1,h2,h3,h4,[class*="project-name"],[class*="project-title"]')?.textContent,
      anchor.textContent
    ];
    for (const c of candidates) {
      const n = cleanProjectName(c);
      if (n) return n;
    }
    return '';
  }

  function collectProjects() {
    const map = new Map();
    const add = (raw) => {
      if (!raw?.id) return;
      const old = map.get(raw.id) || {};
      const editorUrl = raw.editorUrl || old.editorUrl || `https://bolt.new/~/${encodeURIComponent(raw.id)}`;
      map.set(raw.id, {
        ...old,
        ...raw,
        platform: 'bolt',
        platformLabel: 'Bolt.new',
        name: cleanProjectName(raw.name) || old.name || raw.id,
        editorUrl,
        url: editorUrl,
        detectedAt: new Date().toISOString()
      });
    };

    document.querySelectorAll('a[href]').forEach(anchor => {
      const id = projectIdFromUrl(anchor.href);
      if (!id) return;
      add({ id, name: nameFromAnchor(anchor), editorUrl: `https://bolt.new/~/${encodeURIComponent(id)}`, source: 'bolt-dom-list' });
    });

    document.querySelectorAll('[data-project-id]').forEach(el => {
      const id = cleanText(el.dataset.projectId);
      if (!id) return;
      add({ id, name: el.dataset.projectName || cleanProjectName(el.textContent), source: 'bolt-data-attr' });
    });

    const current = detectCurrentProject();
    if (current) add(current);
    return [...map.values()];
  }

  let lastBadgedProjectId = '';

  function addDetectionBadge(project) {
    if (!project?.id || project.id === lastBadgedProjectId) return;
    if (document.querySelector('#lovebolt-bolt-detect-badge')) return;

    lastBadgedProjectId = project.id;
    const hasSupabase = !!project.supabase?.url;
    const hasGithub = !!project.repo;
    const connections = [];
    if (hasGithub) connections.push('🐙 GitHub');
    if (hasSupabase) connections.push('🗄️ Supabase');
    const connText = connections.join(' · ');

    const badge = document.createElement('div');
    badge.id = 'lovebolt-bolt-detect-badge';
    badge.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 99999;
      background: rgba(7, 18, 48, 0.96);
      border: 1px solid #2563eb;
      border-radius: 10px;
      padding: 8px 12px;
      color: #eff6ff;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: 0 4px 18px rgba(37, 99, 235, 0.34);
      display: flex;
      align-items: center;
      gap: 8px;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s ease;
      pointer-events: none;
      max-width: 300px;
    `;

    badge.innerHTML = `
      <span style="font-size: 16px;">⚡</span>
      <div>
        <div style="font-weight: 700; font-size: 11px; color: #60a5fa;">Bolt.new Detectado</div>
        <div style="font-size: 10px; color: #eff6ff; margin-top: 1px;">${project.name || project.id || 'Projeto'}</div>
        ${connText ? `<div style="font-size: 9px; color: #22c55e; margin-top: 2px;">${connText}</div>` : ''}
      </div>
    `;

    document.body.appendChild(badge);
    requestAnimationFrame(() => {
      badge.style.opacity = '1';
      badge.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      badge.style.opacity = '0';
      badge.style.transform = 'translateY(-10px)';
      setTimeout(() => badge.remove(), 300);
    }, 5000);
  }

  function reportCurrent() {
    const project = detectCurrentProject();
    if (!project) return;
    addDetectionBadge(project);
    chrome.runtime.sendMessage({ type: 'BOLT_PROJECT_DETECTED', project }).catch(() => {});
  }

  function reportList() {
    const projects = collectProjects();
    if (!projects.length) return;
    chrome.runtime.sendMessage({ type: 'BOLT_PROJECTS_DISCOVERED', projects }).catch(() => {});
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'SCAN_BOLT_PROJECTS') {
      sendResponse({ ok: true, projects: collectProjects(), current: detectCurrentProject() });
    }
  });

  function observeUrlChanges() {
    let last = location.href;
    const check = () => {
      if (location.href === last) return;
      last = location.href;
      setTimeout(() => { reportCurrent(); reportList(); }, 250);
    };
    const push = history.pushState;
    const replace = history.replaceState;
    history.pushState = function(...args) { const r = push.apply(this,args); check(); return r; };
    history.replaceState = function(...args) { const r = replace.apply(this,args); check(); return r; };
    addEventListener('popstate', check);
    setInterval(check, 1000);
  }

  interceptNetwork();
  observeUrlChanges();
  reportCurrent();
  reportList();
  [1200, 3000, 6500].forEach(ms => setTimeout(() => { reportCurrent(); reportList(); }, ms));
  console.log(LOG_PREFIX, 'Inicializado em', location.href);
})();
