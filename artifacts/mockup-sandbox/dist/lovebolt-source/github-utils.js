/** GitHub transport helpers — isolated from background orchestration. */
function mapGithubRepo(r) {
  return {
    id: r.id,
    full_name: r.full_name,
    name: r.name,
    default_branch: r.default_branch,
    private: !!r.private,
    html_url: r.html_url || `https://github.com/${r.full_name}`,
    description: r.description || '',
    homepage: r.homepage || '',
    topics: Array.isArray(r.topics) ? r.topics : [],
    owner_login: r.owner?.login || String(r.full_name || '').split('/')[0] || '',
    pushed_at: r.pushed_at || '',
    updated_at: r.updated_at || '',
    created_at: r.created_at || '',
    size: Number(r.size || 0),
    empty: null,
    contentChecked: false,
    hasCode: null
  };
}

function githubAuthHeaders(token) {
  return {
    Authorization: `Bearer ${String(token || '').trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function normalizeGithubToken(raw) {
  let token = String(raw || '').trim();
  token = token.replace(/^`+|`+$/g, '').trim();
  token = token.replace(/^authorization\s*:\s*/i, '').trim();
  token = token.replace(/^(?:bearer|token)\s+/i, '').trim();
  token = token.replace(/^['"]|['"]$/g, '').trim();
  return token;
}
