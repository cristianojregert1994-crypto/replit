/**
 * LoveBoltReplit GPT Connector - Lovable detector v3.48.0
 * 
 * Injected into lovable.dev pages to:
 * - Auto-detect the current project ID, name, and GitHub repo
 * - Aggressively extract Supabase credentials from the page
 * - Intercept network requests to Supabase/Lovable Cloud to capture URL + public key
 * - Send all project info back to background for auto-configuration
 */

(function() {
  'use strict';

  if (window.__LOVABLE_DETECT_INJECTED__) return;
  window.__LOVABLE_DETECT_INJECTED__ = true;

  const LOG_PREFIX = '[Lovable Detect]';

  // ===== Supabase credential cache =====
  const _supabaseCache = {
    url: null,
    anonKey: null,
    projectRef: null,
  };

  // ===== 1. Intercept fetch/XHR to catch Supabase requests =====
  function interceptNetworkRequests() {
    // Intercept fetch
    const origFetch = window.fetch;
    window.fetch = function(...args) {
      try {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        captureSupabaseFromURL(url);
        captureSupabaseFromHeaders(args[1]?.headers);
      } catch (e) {}
      return origFetch.apply(this, args);
    };

    // Intercept XMLHttpRequest
    const origOpen = XMLHttpRequest.prototype.open;
    const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      try {
        captureSupabaseFromURL(url);
        this.__lcHeaders = {};
      } catch (e) {}
      return origOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
      try {
        captureSupabaseHeader(name, value);
        if (this.__lcHeaders) this.__lcHeaders[name] = value;
      } catch (e) {}
      return origSetHeader.call(this, name, value);
    };
  }

  function captureSupabaseFromURL(url) {
    if (!url || typeof url !== 'string') return;

    // Match classic Supabase hosts and Lovable Cloud's Supabase-compatible hosts.
    const supaMatch = url.match(/https:\/\/([a-z0-9-]+)\.supabase\.(co|in)/i);
    const lovableCloudMatch = url.match(/https:\/\/([^/]+)\.lovable\.cloud/i);
    if (supaMatch) {
      const projectRef = supaMatch[1];
      _supabaseCache.projectRef = _supabaseCache.projectRef || projectRef;
      _supabaseCache.url = _supabaseCache.url || `https://${projectRef}.supabase.${supaMatch[2]}`;
      console.log(LOG_PREFIX, 'Captured Supabase project ref:', projectRef);
    } else if (lovableCloudMatch) {
      _supabaseCache.projectRef = _supabaseCache.projectRef || lovableCloudMatch[1];
      _supabaseCache.url = _supabaseCache.url || `https://${lovableCloudMatch[1]}.lovable.cloud`;
      console.log(LOG_PREFIX, 'Captured Lovable Cloud database host:', lovableCloudMatch[1]);
    }
  }

  function captureSupabaseFromHeaders(headers) {
    if (!headers) return;

    // Check Headers object
    if (headers instanceof Headers) {
      const apikey = headers.get('apikey');
      const auth = headers.get('Authorization');
      if (apikey && apikey.length > 20) {
        _supabaseCache.anonKey = apikey;
        console.log(LOG_PREFIX, 'Captured Supabase anon key from Headers');
      }
    }

    // Check plain object
    if (typeof headers === 'object' && !(headers instanceof Headers)) {
      for (const [key, value] of Object.entries(headers)) {
        captureSupabaseHeader(key, value);
      }
    }
  }

  function captureSupabaseHeader(name, value) {
    if (!name || !value) return;
    const lower = name.toLowerCase();
    if (lower === 'apikey' && value.length > 20) {
      _supabaseCache.anonKey = value;
      console.log(LOG_PREFIX, 'Captured Supabase anon key from header');
    }
    if (lower === 'authorization' && value.startsWith('Bearer ') && value.length > 30) {
      const key = value.replace('Bearer ', '');
      if (key.length > 20 && !_supabaseCache.anonKey) {
        _supabaseCache.anonKey = key;
        console.log(LOG_PREFIX, 'Captured Supabase key from Authorization');
      }
    }
  }

  // ===== 2. Search page scripts for Supabase config =====
  function searchScriptsForSupabase() {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      if (text.length < 10) continue;

      // NEXT_PUBLIC_SUPABASE_URL
      const urlPatterns = [
        /(?:NEXT_PUBLIC_|VITE_)?SUPABASE_URL['"]?\s*[:=]\s*['"]([^'"]+)/,
        /supabaseUrl['"]?\s*[:=]\s*['"]([^'"]+)/,
        /supabase_url['"]?\s*[:=]\s*['"]([^'"]+)/,
        /(https:\/\/[a-z0-9-]+\.supabase\.(?:co|in))/i,
        /(https:\/\/[^\s'"]+\.lovable\.cloud)/i,
      ];

      for (const pattern of urlPatterns) {
        const match = text.match(pattern);
        if (match) {
          const candidate = match[1] || match[0];
          if (/^https?:\/\//i.test(candidate)) {
            _supabaseCache.url = candidate;
            _supabaseCache.projectRef = candidate.replace(/^https?:\/\//, '').split('.')[0];
            break;
          }
        }
      }

      // NEXT_PUBLIC_SUPABASE_ANON_KEY
      const keyPatterns = [
        /NEXT_PUBLIC_SUPABASE_ANON_KEY['"]\s*[:=]\s*['"]([^'"]+)/,
        /(?:VITE_)?SUPABASE_PUBLISHABLE_KEY['"]?\s*[:=]\s*['"]([^'"]+)/,
        /supabaseAnonKey['"]\s*[:=]\s*['"]([^'"]+)/,
        /supabase_anon_key['"]\s*[:=]\s*['"]([^'"]+)/,
        /"anonKey"\s*:\s*"([^'"]+)"/,
        /'anonKey'\s*:\s*'([^'"]+)'/,
        /"anon_key"\s*:\s*"([^'"]+)"/,
        /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
        /(sb_publishable_[A-Za-z0-9_-]{20,})/,
      ];

      for (const pattern of keyPatterns) {
        const match = text.match(pattern);
        if (match) {
          const key = match[1] || match[0];
          if (key.length > 20) {
            _supabaseCache.anonKey = key;
            break;
          }
        }
      }
    }
  }

  // ===== 3. Search localStorage/sessionStorage =====
  function searchStorageForSupabase() {
    try {
      for (const storage of [localStorage, sessionStorage]) {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          const value = storage.getItem(key);

          if (!value || typeof value !== 'string') continue;

          // Look for Supabase URLs in stored values
          const urlMatch = value.match(/https:\/\/([a-z0-9-]+)\.supabase\.(co|in)/i);
          const cloudMatch = value.match(/https:\/\/([^/]+)\.lovable\.cloud/i);
          if (urlMatch) {
            _supabaseCache.projectRef = urlMatch[1];
            _supabaseCache.url = `https://${urlMatch[1]}.supabase.${urlMatch[2]}`;
          } else if (cloudMatch) {
            _supabaseCache.projectRef = cloudMatch[1];
            _supabaseCache.url = `https://${cloudMatch[1]}.lovable.cloud`;
          }

          // Look for anon keys (JWT tokens starting with eyJ)
          if (key.toLowerCase().includes('supabase') || key.toLowerCase().includes('anon')) {
            const keyMatch = value.match(/eyJ[A-Za-z0-9_-]{20,}/) || value.match(/sb_publishable_[A-Za-z0-9_-]{20,}/);
            if (keyMatch) {
              _supabaseCache.anonKey = keyMatch[0];
            }
          }
        }
      }
    } catch (e) {
      // Storage access might be blocked
    }
  }

  // ===== 4. Search meta tags and links =====
  function searchMetaForSupabase() {
    // Check meta tags
    const metas = document.querySelectorAll('meta');
    for (const meta of metas) {
      const content = meta.content || '';
      const urlMatch = content.match(/https:\/\/([a-z0-9-]+)\.supabase\.(co|in)/i);
      const cloudMatch = content.match(/https:\/\/([^/]+)\.lovable\.cloud/i);
      if (urlMatch) {
        _supabaseCache.projectRef = urlMatch[1];
        _supabaseCache.url = `https://${urlMatch[1]}.supabase.${urlMatch[2]}`;
      } else if (cloudMatch) {
        _supabaseCache.projectRef = cloudMatch[1];
        _supabaseCache.url = `https://${cloudMatch[1]}.lovable.cloud`;
      }
    }

    // Check link tags
    const links = document.querySelectorAll('link[href*="supabase.co"], link[href*="lovable.cloud"]');
    for (const link of links) {
      const urlMatch = link.href.match(/https:\/\/([a-z0-9-]+)\.supabase\.(co|in)/i);
      const cloudMatch = link.href.match(/https:\/\/([^/]+)\.lovable\.cloud/i);
      if (urlMatch) {
        _supabaseCache.projectRef = urlMatch[1];
        _supabaseCache.url = `https://${urlMatch[1]}.supabase.${urlMatch[2]}`;
      } else if (cloudMatch) {
        _supabaseCache.projectRef = cloudMatch[1];
        _supabaseCache.url = `https://${cloudMatch[1]}.lovable.cloud`;
      }
    }
  }

  // ===== 5. Search page body text =====
  function searchPageTextForSupabase() {
    const bodyText = document.body?.innerText || '';

    const urlMatches = bodyText.match(/https:\/\/[a-z0-9-]+\.supabase\.(?:co|in)/gi) || bodyText.match(/https:\/\/[^\s]+\.lovable\.cloud/gi);
    if (urlMatches && urlMatches.length > 0) captureSupabaseFromURL(urlMatches[0]);
  }

  // ===== 6. Monitor iframes (Lovable preview) =====
  function checkIframesForSupabase() {
    try {
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const src = iframe.src || '';
          captureSupabaseFromURL(src);

          // Try to access iframe content (same-origin only)
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (doc) {
            const scripts = doc.querySelectorAll('script');
            for (const script of scripts) {
              const text = script.textContent || '';
              const urlM = text.match(/https:\/\/[a-z0-9-]+\.supabase\.(?:co|in)/i) || text.match(/https:\/\/[^\s"']+\.lovable\.cloud/i);
              if (urlM) captureSupabaseFromURL(urlM[0]);
              const keyM = text.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/) || text.match(/sb_publishable_[A-Za-z0-9_-]{20,}/);
              if (keyM && !_supabaseCache.anonKey) {
                _supabaseCache.anonKey = keyM[0];
              }
            }
          }
        } catch (e) {
          // Cross-origin iframe, can't access
        }
      }
    } catch (e) {}
  }

  // ===== 7. Run all Supabase detection methods =====
  function detectSupabase() {
    searchScriptsForSupabase();
    searchStorageForSupabase();
    searchMetaForSupabase();
    searchPageTextForSupabase();
    checkIframesForSupabase();

    if (_supabaseCache.url || _supabaseCache.projectRef) {
      console.log(LOG_PREFIX, 'Supabase detected:', {
        url: _supabaseCache.url,
        projectRef: _supabaseCache.projectRef,
        hasKey: !!_supabaseCache.anonKey,
      });
      return {
        url: _supabaseCache.url,
        anonKey: _supabaseCache.anonKey || '',
        projectRef: _supabaseCache.projectRef,
      };
    }

    return null;
  }

  // ===== Project Detection =====

  function extractProjectFromURL() {
    const url = window.location.href;
    const projectMatch = url.match(/lovable\.dev\/projects\/([a-f0-9-]+)/i);
    if (projectMatch) {
      return {
        id: projectMatch[1],
        url: window.location.origin + '/projects/' + projectMatch[1],
        source: 'url',
      };
    }
    return null;
  }

  function extractProjectFromDOM() {
    const metaProject = document.querySelector('meta[name="lovable-project-id"]');
    if (metaProject) return { id: metaProject.content, source: 'meta' };

    const appRoot = document.querySelector('[data-project-id]');
    if (appRoot) {
      return { id: appRoot.dataset.projectId, name: appRoot.dataset.projectName || '', source: 'data-attr' };
    }

    const titleMatch = document.title.match(/^(.+?)\s*[-–|]\s*Lovable/i);
    if (titleMatch) return { name: titleMatch[1].trim(), source: 'title' };

    return null;
  }

  function extractProjectFromGlobals() {
    try {
      if (window.__NEXT_DATA__?.props?.pageProps) {
        const pp = window.__NEXT_DATA__.props.pageProps;
        if (pp.projectId || pp.project?.id) {
          return {
            id: pp.projectId || pp.project.id,
            name: pp.projectName || pp.project?.name || '',
            githubRepo: pp.project?.githubRepo || '',
            source: 'next-data',
          };
        }
      }
      if (window.__lovable_project) {
        return {
          id: window.__lovable_project.id,
          name: window.__lovable_project.name || '',
          githubRepo: window.__lovable_project.githubRepo || '',
          source: 'window-global',
        };
      }
    } catch (e) {}
    return null;
  }

  function extractGithubRepos() {
    const reserved = new Set(['settings','apps','marketplace','features','pricing','login','join','new','notifications','issues','pulls','codespaces','sponsors','explore','topics','collections','events','search','orgs','organizations','users','account']);
    const parse = (value) => {
      try {
        const u = new URL(String(value || ''), location.href);
        if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length !== 2) return null;
        const owner = parts[0];
        const name = parts[1].replace(/\.git$/i, '');
        if (reserved.has(owner.toLowerCase())) return null;
        if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) return null;
        const fullName = `${owner}/${name}`;
        return { owner, name, fullName, url: `https://github.com/${fullName}` };
      } catch (_) { return null; }
    };

    const ranked = new Map();
    const add = (repo, score, source) => {
      if (!repo) return;
      const key = repo.fullName.toLowerCase();
      const prev = ranked.get(key);
      if (!prev || score > prev.score) ranked.set(key, { repo: repo.fullName, fullName: repo.fullName, url: repo.url, score, source });
    };

    document.querySelectorAll('[data-github-repo]').forEach((el) => {
      add(parse(`https://github.com/${el.dataset.githubRepo || ''}`), 100, 'data-github-repo');
    });

    document.querySelectorAll('a[href*="github.com"]').forEach((link) => {
      const repo = parse(link.href);
      if (!repo) return;
      const context = [
        link.textContent,
        link.getAttribute('aria-label'),
        link.getAttribute('title'),
        link.closest('button,[role="button"],li,section,div')?.textContent
      ].filter(Boolean).join(' ').toLowerCase();
      const integrationContext = /github|repository|reposit[oó]rio|repo|connected|conectado|sync|sincron/.test(context);
      add(repo, integrationContext ? 98 : 88, integrationContext ? 'github-integration-link' : 'github-link');
    });

    // Lovable frequently serializes integration metadata in script/application state
    // even when the GitHub card itself has not rendered yet.
    document.querySelectorAll('script').forEach((script) => {
      const text = script.textContent || '';
      if (!text || !/github/i.test(text)) return;
      const patterns = [
        /github(?:Repo|Repository|_repo|_repository)?[\"']?\s*[:=]\s*[\"'](?:https?:\/\/github\.com\/)?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\.git)?[\"']/gi,
        /https?:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\.git)?/gi
      ];
      for (const pattern of patterns) {
        for (const m of text.matchAll(pattern)) add(parse(`https://github.com/${m[1]}`), 96, 'serialized-github-state');
      }
    });

    const bodyText = document.body?.innerText || '';
    const matches = bodyText.match(/https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/gi) || [];
    for (const value of matches) add(parse(value), 90, 'page-text');

    return [...ranked.values()].sort((a, b) => b.score - a.score);
  }

  // ===== Main Detection =====
  function detectProject() {
    const urlData = extractProjectFromURL();
    const domData = extractProjectFromDOM();
    const globalData = extractProjectFromGlobals();
    const githubCandidates = extractGithubRepos();
    const github = githubCandidates[0] || null;
    const directGithub = github && Number(github.score || 0) >= 95 ? github : null;
    const serializedGlobalRepo = globalData?.githubRepo ? { repo: globalData.githubRepo, score: 99, source: 'lovable-global-project-repo' } : null;
    const strongGithub = directGithub || serializedGlobalRepo;
    const supabase = detectSupabase();

    const projectId = urlData?.id || domData?.id || globalData?.id || '';
    const editorUrl = urlData?.url || (projectId ? `https://lovable.dev/projects/${projectId}` : window.location.href);
    const previewUrl = projectId ? `https://id-preview--${projectId}.lovable.app/` : '';
    const project = {
      id: projectId,
      name: domData?.name || globalData?.name || document.title.split(' - ')[0].trim() || '',
      editorUrl,
      previewUrl,
      // User-facing project URL is always the full preview, never the editor Canvas.
      url: previewUrl || editorUrl,
      githubRepo: strongGithub?.repo || null,
      repo: strongGithub?.repo || '',
      repoCandidates: githubCandidates,
      githubBindingSource: strongGithub?.source || '',
      githubConfidence: Number(strongGithub?.score || 0),
      githubVerified: false,
      githubReason: strongGithub ? `Evidência direta encontrada no Lovable: ${strongGithub.source}` : '',
      supabase: supabase || null,
      detectedAt: new Date().toISOString(),
      source: strongGithub ? 'lovable-page-evidence' : (urlData?.source || domData?.source || globalData?.source || 'unknown'),
    };

    if (project.id || urlData) return project;
    return null;
  }


  // ===== Discover Lovable projects visible in the authenticated Lovable UI =====
  function cleanProjectName(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 2 || text.length > 120) return '';
    if (/^(lovable|projects|projetos|open|abrir|edit|editar)$/i.test(text)) return '';
    return text;
  }

  function nameFromProjectAnchor(anchor) {
    const candidates = [
      anchor.dataset?.projectName,
      anchor.getAttribute('aria-label'),
      anchor.getAttribute('title'),
      anchor.querySelector('[data-project-name]')?.getAttribute('data-project-name'),
      anchor.querySelector('h1,h2,h3,h4,[class*="project-name"],[class*="project-title"]')?.textContent,
      anchor.textContent
    ];
    for (const c of candidates) {
      const name = cleanProjectName(c);
      if (name && !/^[a-f0-9-]{20,}$/i.test(name)) return name;
    }
    return '';
  }

  function collectLovableProjectsFromDOM() {
    const map = new Map();
    const add = (raw) => {
      if (!raw?.id) return;
      const old = map.get(raw.id) || {};
      const name = cleanProjectName(raw.name);
      const editorUrl = raw.editorUrl || old.editorUrl || `${window.location.origin}/projects/${raw.id}`;
      const previewUrl = raw.previewUrl || old.previewUrl || `https://id-preview--${raw.id}.lovable.app/`;
      map.set(raw.id, {
        ...old,
        ...raw,
        name: name || old.name || raw.id,
        editorUrl,
        previewUrl,
        // Keep every discoverable/openable URL pointed at the normal full preview.
        url: previewUrl,
        detectedAt: new Date().toISOString()
      });
    };

    document.querySelectorAll('a[href*="/projects/"]').forEach((anchor) => {
      try {
        const url = new URL(anchor.href, window.location.origin);
        const match = url.pathname.match(/\/projects\/([a-f0-9-]+)/i);
        if (!match) return;
        add({
          id: match[1],
          name: nameFromProjectAnchor(anchor),
          editorUrl: `${url.origin}/projects/${match[1]}`,
          previewUrl: `https://id-preview--${match[1]}.lovable.app/`,
          source: 'lovable-dom-list'
        });
      } catch (e) {}
    });

    document.querySelectorAll('[data-project-id]').forEach((el) => {
      const id = el.dataset.projectId;
      if (!id) return;
      add({ id, name: el.dataset.projectName || cleanProjectName(el.textContent), source: 'lovable-data-attr' });
    });

    const current = detectProject();
    if (current) add(current);
    return [...map.values()];
  }

  function reportProjectList() {
    const projects = collectLovableProjectsFromDOM();
    if (!projects.length) return;
    chrome.runtime.sendMessage({ type: 'LOVABLE_PROJECTS_DISCOVERED', projects }).catch(() => {});
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'SCAN_LOVABLE_PROJECTS') {
      sendResponse({ ok: true, projects: collectLovableProjectsFromDOM() });
    }
  });

  function reportProject(project) {
    if (!project) return;
    console.log(LOG_PREFIX, 'Project detected:', project);

    chrome.runtime.sendMessage({
      type: 'LOVABLE_PROJECT_DETECTED',
      project,
    }).then(response => {
      console.log(LOG_PREFIX, 'Background response:', response);
    }).catch(err => {
      console.log(LOG_PREFIX, 'Could not send to background:', err);
    });
  }

  // ===== URL Change Observer =====
  function observeURLChanges() {
    let lastURL = window.location.href;

    const origPush = history.pushState;
    const origReplace = history.replaceState;

    history.pushState = function() {
      origPush.apply(this, arguments);
      handleURLChange();
    };

    history.replaceState = function() {
      origReplace.apply(this, arguments);
      handleURLChange();
    };

    window.addEventListener('popstate', handleURLChange);

    setInterval(() => {
      if (window.location.href !== lastURL) {
        lastURL = window.location.href;
        handleURLChange();
      }
    }, 1000);
  }

  function handleURLChange() {
    console.log(LOG_PREFIX, 'URL changed:', window.location.href);
    // Lovable is an SPA: project identity appears before all integration metadata.
    // Detect immediately, then re-detect in a burst so the GitHub remote is captured
    // as soon as the project/integration state finishes rendering.
    [0, 400, 1200, 3000, 7000].forEach((delay) => {
      setTimeout(() => {
        const project = detectProject();
        if (project) reportProject(project);
        if (delay === 1200 || delay === 7000) reportProjectList();
      }, delay);
    });
  }

  // ===== Detection Badge =====
  function addDetectionBadge(project) {
    if (document.querySelector('#lovable-detect-badge')) return;

    const hasSupabase = project.supabase?.url;
    const hasGithub = project.githubRepo;

    const badge = document.createElement('div');
    badge.id = 'lovable-detect-badge';
    badge.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 99999;
      background: rgba(15, 15, 23, 0.95);
      border: 1px solid #7c3aed;
      border-radius: 10px;
      padding: 8px 12px;
      color: #e8e8ed;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
      display: flex;
      align-items: center;
      gap: 8px;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s ease;
      pointer-events: none;
      max-width: 300px;
    `;

    const connections = [];
    if (hasGithub) connections.push('🐙 GitHub');
    if (hasSupabase) connections.push('🗄️ Supabase');
    const connText = connections.length > 0 ? connections.join(' · ') : '';

    badge.innerHTML = `
      <span style="font-size: 16px;">💜</span>
      <div>
        <div style="font-weight: 600; font-size: 11px; color: #a855f7;">Lovable Detectado</div>
        <div style="font-size: 10px; color: #e8e8ed; margin-top: 1px;">${project.name || project.id || 'Projeto'}</div>
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

  // ===== Repeated scanning for late-loading scripts =====
  function scheduleRescans() {
    // Re-scan at 2s, 5s, 10s, 20s after page load to catch late-loading bundles
    [2000, 5000, 10000, 20000].forEach(delay => {
      setTimeout(() => {
        const project = detectProject();
        if (project) {
          reportProject(project);
        }
      }, delay);
    });
  }

  // ===== Initialize =====
  function init() {
    console.log(LOG_PREFIX, 'Initialized on', window.location.href);

    // Start intercepting network requests immediately
    interceptNetworkRequests();

    // Initial detection
    const project = detectProject();
    if (project) {
      reportProject(project);
      addDetectionBadge(project);
    }

    // Discover the real Lovable project cards/links currently visible to the signed-in user.
    reportProjectList();
    [1500, 4000, 8000].forEach(delay => setTimeout(reportProjectList, delay));

    // Observe navigation
    observeURLChanges();

    // Rescan for late-loading content
    scheduleRescans();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
