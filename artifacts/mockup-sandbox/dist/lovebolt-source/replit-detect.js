/**
 * LoveBoltReplit GPT Connector - Replit detector v3.48.0
 * Deterministic identity + repository evidence resolver.
 */
(function () {
  'use strict';
  if (window.__LOVEBOLT_REPLIT_DETECT_INJECTED__) return;
  window.__LOVEBOLT_REPLIT_DETECT_INJECTED__ = true;

  const LOG = '[Replit Detect]';
  const BAD_NAMES = /^(replit|recent|recents|home|workspace|workspaces|apps?|projects?|project|create|new|agent|chat|console|shell|tools|files|preview|settings|deployments?|secrets?)$/i;
  const RESERVED_GITHUB = new Set(['settings','apps','marketplace','features','pricing','login','join','new','notifications','issues','pulls','codespaces','sponsors','explore','topics','collections','events','search','orgs','organizations','users','account']);

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const usefulName = (value) => {
    const name = clean(value);
    if (!name || name.length < 2 || name.length > 160 || BAD_NAMES.test(name)) return '';
    if (/^[a-f0-9-]{24,}$/i.test(name)) return '';
    return name;
  };

  function slugIdentity() {
    const match = location.pathname.match(/^\/@([^/]+)\/([^/?#]+)/i);
    if (!match) return null;
    return {
      owner: decodeURIComponent(match[1]),
      slug: decodeURIComponent(match[2]),
      id: `@${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`
    };
  }

  function scriptTextSnapshot(limit = 2_000_000) {
    let text = '';
    for (const script of document.scripts) {
      if (script.src) continue;
      const chunk = script.textContent || '';
      if (!chunk) continue;
      text += `\n${chunk}`;
      if (text.length >= limit) break;
    }
    return text.slice(0, limit);
  }

  function domHtmlSnapshot(limit = 1_250_000) {
    try { return String(document.documentElement?.innerHTML || '').slice(0, limit); }
    catch (_) { return ''; }
  }

  function firstAttribute(selectors, attrs) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      for (const attr of attrs) {
        const value = clean(el.getAttribute?.(attr));
        if (value) return value;
      }
    }
    return '';
  }

  function uuidFromPage() {
    const direct = firstAttribute(
      ['[data-repl-id]','[data-replid]','[data-repl-uuid]','[data-project-id]','[data-workspace-id]','[data-repl]'],
      ['data-repl-id','data-replid','data-repl-uuid','data-project-id','data-workspace-id','data-repl']
    );
    if (direct) return direct;

    const query = new URLSearchParams(location.search);
    for (const key of ['replId','repl_id','replUuid','repl_uuid','projectId','project','workspaceId','workspace']) {
      const value = clean(query.get(key));
      if (value) return value;
    }

    const serialized = `${scriptTextSnapshot()}\n${domHtmlSnapshot(550_000)}`;
    const patterns = [
      /["'](?:replId|repl_id|replUuid|repl_uuid|workspaceId|projectId)["']\s*:\s*["']([a-f0-9-]{24,})["']/i,
      /(?:replId|repl_id|replUuid|repl_uuid|workspaceId|projectId)[=:\s"']+([a-f0-9-]{24,})/i,
      /["']id["']\s*:\s*["']([a-f0-9]{8}-[a-f0-9-]{20,})["'][^{}]{0,260}["'](?:repl|workspace|project)/i
    ];
    for (const pattern of patterns) {
      const match = serialized.match(pattern);
      if (match?.[1]) return match[1];
    }
    return '';
  }

  function identity() {
    const uuid = uuidFromPage();
    if (uuid) return { id: uuid, replId: uuid, source: 'replit-uuid' };
    const slug = slugIdentity();
    if (slug) return { id: slug.id, replId: '', source: 'replit-slug', ...slug };
    const named = location.pathname.match(/^\/(?:repl|project|workspace|app)\/([^/?#]+)/i);
    if (named) return { id: decodeURIComponent(named[1]), replId: '', source: 'replit-url-id' };
    return null;
  }

  function projectName(slug) {
    const selectors = [
      '[data-repl-name]','[data-project-name]','[data-workspace-name]','[data-testid*="repl-name"]',
      '[data-testid*="project-name"]','header h1','header h2','[class*="repl-name"]','[class*="project-name"]','[class*="workspace-name"]'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const value = usefulName(el.getAttribute?.('data-repl-name') || el.getAttribute?.('data-project-name') || el.getAttribute?.('data-workspace-name') || el.textContent);
      if (value) return { name: value, source: `dom:${selector}`, confidence: 92 };
    }

    const metaCandidates = [
      document.querySelector('meta[property="og:title"]')?.content,
      document.querySelector('meta[name="twitter:title"]')?.content,
      document.title
    ];
    for (const raw of metaCandidates) {
      const value = usefulName(clean(raw).replace(/\s*[-–|]\s*Replit\s*$/i, '').replace(/^Replit\s*[-–|]\s*/i, ''));
      if (value) return { name: value, source: 'document-title', confidence: 78 };
    }

    if (slug) return { name: usefulName(slug.replace(/[-_]+/g, ' ')) || slug, source: 'replit-slug', confidence: 70 };
    return { name: '', source: '', confidence: 0 };
  }

  function parseGithubRepo(raw) {
    try {
      const value = String(raw || '').trim().replace(/^git\+/, '');
      const ssh = value.match(/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i);
      if (ssh) return { owner: ssh[1], repo: ssh[2] };
      if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
        const [owner, repo] = value.split('/');
        return { owner, repo };
      }
      const url = new URL(value, location.href);
      if (!/(^|\.)github\.com$/i.test(url.hostname)) return null;
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return null;
      return { owner: parts[0], repo: parts[1].replace(/\.git$/i, '') };
    } catch (_) { return null; }
  }

  function repoCandidates() {
    const map = new Map();
    const add = (raw, score, source, evidence = '') => {
      const parsed = parseGithubRepo(raw);
      if (!parsed) return;
      const owner = parsed.owner;
      const repo = parsed.repo;
      if (RESERVED_GITHUB.has(owner.toLowerCase())) return;
      if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return;
      const full = `${owner}/${repo}`;
      const current = map.get(full.toLowerCase());
      const item = { repo: full, score: Number(score || 0), source, evidence: clean(evidence).slice(0, 180) };
      if (!current || item.score > current.score) map.set(full.toLowerCase(), item);
    };

    const dataAttrs = [
      ['data-github-repo', 100], ['data-repository-url', 100], ['data-repo-url', 100],
      ['data-git-remote', 99], ['data-github-url', 99]
    ];
    for (const [attr, score] of dataAttrs) {
      document.querySelectorAll(`[${attr}]`).forEach((el) => add(el.getAttribute(attr), score, `replit-${attr}`, el.outerHTML.slice(0, 180)));
    }

    document.querySelectorAll('a[href*="github.com/"]').forEach((anchor) => {
      const context = clean([
        anchor.textContent,
        anchor.getAttribute('aria-label'),
        anchor.getAttribute('title'),
        anchor.closest('button,[role="button"],li,section,[role="dialog"],div')?.textContent
      ].filter(Boolean).join(' ')).toLowerCase();
      const integration = /github|repository|reposit[oó]rio|repo|connected|conectado|remote|version control|source control|git\b/i.test(context);
      add(anchor.href, integration ? 98 : 72, integration ? 'replit-github-integration-link' : 'replit-github-link', context);
    });

    const serialized = `${scriptTextSnapshot()}\n${domHtmlSnapshot(650_000)}`;
    const keyed = [
      [/(?:githubRepo|githubRepository|repositoryUrl|repoUrl|remoteUrl|gitRemote|gitUrl)["']?\s*[:=]\s*["'](https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?)["']/gi, 99, 'replit-serialized-github-field'],
      [/(?:githubRepo|githubRepository|repository|repo)["']?\s*[:=]\s*["']([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)["']/gi, 98, 'replit-serialized-repo-field'],
      [/(?:origin|remote)["']?\s*[:=]\s*["'](?:git@github\.com:|https:\/\/github\.com\/)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\.git)?["']/gi, 98, 'replit-serialized-git-remote']
    ];
    for (const [pattern, score, source] of keyed) {
      for (const match of serialized.matchAll(pattern)) add(match[1], score, source, match[0]);
    }

    // Raw URLs are candidates only; they can be docs/issues links unrelated to the project.
    for (const match of serialized.matchAll(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?/g)) {
      add(match[0], 76, 'replit-serialized-github-url', match[0]);
    }

    return [...map.values()].sort((a, b) => b.score - a.score || a.repo.localeCompare(b.repo));
  }

  function previewUrlFromPage() {
    const ranked = [];
    const add = (raw, score, source) => {
      try {
        const url = new URL(String(raw || ''), location.href);
        if (!/^https?:$/.test(url.protocol)) return;
        if (/(^|\.)replit\.com$/i.test(url.hostname)) return;
        if (/(^|\.)github\.com$|(^|\.)supabase\.(?:co|in)$/i.test(url.hostname)) return;
        let boost = 0;
        if (/\.replit\.dev$/i.test(url.hostname)) boost = 30;
        else if (/\.replit\.app$/i.test(url.hostname)) boost = 28;
        else if (/\.repl\.co$/i.test(url.hostname)) boost = 22;
        ranked.push({ url: url.href, score: score + boost, source });
      } catch (_) {}
    };
    document.querySelectorAll('[data-preview-url],[data-development-url],[data-deployment-url]').forEach((el) => {
      for (const attr of ['data-preview-url','data-development-url','data-deployment-url']) if (el.hasAttribute(attr)) add(el.getAttribute(attr), 100, `replit-${attr}`);
    });
    document.querySelectorAll('iframe[src]').forEach((frame) => add(frame.src, 94, 'replit-preview-iframe'));
    document.querySelectorAll('a[href]').forEach((anchor) => {
      const context = clean([anchor.textContent, anchor.getAttribute('aria-label'), anchor.getAttribute('title')].filter(Boolean).join(' '));
      if (/preview|webview|development url|open app|published|deployment|website/i.test(context) || /\.replit\.(?:dev|app)(?:\/|$)/i.test(anchor.href)) add(anchor.href, 90, 'replit-preview-link');
    });
    ranked.sort((a,b) => b.score - a.score);
    return ranked[0]?.url || '';
  }

  function detect() {
    const ident = identity();
    if (!ident?.id) return null;
    const slugData = slugIdentity();
    const nameData = projectName(slugData?.slug || '');
    const candidates = repoCandidates();
    const top = candidates[0] || null;
    // Binding requires direct integration/serialized field evidence. Generic page links never bind automatically.
    const canBind = !!top && Number(top.score || 0) >= 95;
    const repo = canBind ? top.repo : '';
    const confidence = canBind ? Math.min(100, Number(top.score || 0)) : 0;

    return {
      id: ident.id,
      replId: ident.replId || '',
      uuid: ident.replId || '',
      slug: slugData?.slug || '',
      projectSlug: slugData?.slug || '',
      owner: slugData?.owner || '',
      name: nameData.name || slugData?.slug || ident.id,
      nameSource: nameData.source,
      nameConfidence: nameData.confidence,
      platform: 'replit',
      platformLabel: 'Replit',
      editorUrl: location.href,
      url: location.href,
      previewUrl: previewUrlFromPage(),
      repo,
      repoCandidates: candidates,
      githubBindingSource: repo ? top.source : '',
      githubVerified: false,
      githubConfidence: confidence,
      githubReason: repo ? `Evidência direta encontrada no Replit: ${top.source}` : '',
      source: repo ? 'replit-page-evidence' : ident.source,
      detectedAt: new Date().toISOString()
    };
  }

  function collect() {
    const map = new Map();
    const add = (project) => {
      if (!project?.id) return;
      const old = map.get(project.id) || {};
      map.set(project.id, { ...old, ...project });
    };

    document.querySelectorAll('a[href]').forEach((anchor) => {
      try {
        const url = new URL(anchor.href, location.href);
        if (!/(^|\.)replit\.com$/i.test(url.hostname)) return;
        const match = url.pathname.match(/^\/@([^/]+)\/([^/?#]+)/i);
        if (!match) return;
        const owner = decodeURIComponent(match[1]);
        const slug = decodeURIComponent(match[2]);
        add({
          id: `@${owner}/${slug}`,
          name: usefulName(anchor.textContent) || slug.replace(/[-_]+/g, ' '),
          platform: 'replit', platformLabel: 'Replit',
          editorUrl: url.href, url: url.href,
          slug, projectSlug: slug, owner,
          source: 'replit-dom-list'
        });
      } catch (_) {}
    });

    const current = detect();
    if (current) add(current);
    return [...map.values()];
  }

  let lastKey = '';
  let reportTimer = null;
  function report() {
    const project = detect();
    if (!project) return;
    const key = `${project.id}|${project.repo}|${project.name}|${project.githubBindingSource}`;
    if (key === lastKey) return;
    lastKey = key;
    chrome.runtime.sendMessage({ type: 'REPLIT_PROJECT_DETECTED', project }, () => void chrome.runtime.lastError);
  }
  function reportList() {
    const projects = collect();
    if (projects.length) chrome.runtime.sendMessage({ type: 'REPLIT_PROJECTS_DISCOVERED', projects }, () => void chrome.runtime.lastError);
  }
  function scheduleReport(delay = 450) {
    clearTimeout(reportTimer);
    reportTimer = setTimeout(() => { report(); reportList(); }, delay);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'SCAN_REPLIT_PROJECTS') {
      sendResponse({ ok: true, projects: collect(), current: detect() });
      return true;
    }
    return false;
  });

  const observer = new MutationObserver(() => scheduleReport());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href','src','data-repl-id','data-repl-name','data-project-id','data-workspace-id','data-github-repo','data-repository-url','data-preview-url','data-development-url','data-deployment-url']
  });

  report();
  reportList();
  // Slow heartbeat only. MutationObserver handles normal SPA navigation/rendering.
  setInterval(report, 10_000);
  console.log(`${LOG} v3.48.0 loaded`);
})();
