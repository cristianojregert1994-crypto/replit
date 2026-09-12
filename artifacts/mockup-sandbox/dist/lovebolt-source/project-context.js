/** Project → ChatGPT context serializer. */
function buildProjectContextMessage(message, projectContext) {
  const rawPlatform = String(projectContext.platform || '').toLowerCase();
  const platform = ['lovable','bolt','replit','gpt'].includes(rawPlatform) ? rawPlatform : 'lovable';
  const platformMeta = {
    lovable: { label: 'Lovable', icon: '💜' },
    bolt: { label: 'Bolt.new', icon: '⚡' },
    replit: { label: 'Replit', icon: '🟧' },
    gpt: { label: 'GPT Studio', icon: '◎' }
  }[platform];
  const identityLine = `🆔 ID: ${projectContext.id || 'N/A'}`;
  const sourceLines = platform === 'gpt' ? `
🤖 Fonte do projeto: GPT Studio · GitHub
🔴 Tema/LEDs: Vermelho` : '';
  const ctx = `[CONTEXTO DO PROJETO]
Plataforma: ${platformMeta.icon} ${platformMeta.label}
📦 Projeto: ${projectContext.name || 'N/A'}
${identityLine}${sourceLines}`;
  const repo = projectContext.repo ? `
🐙 Repositório GitHub: ${projectContext.repo}` : '';
  const branch = projectContext.repo && projectContext.defaultBranch ? `
🌿 Branch: ${projectContext.defaultBranch}` : '';
  const githubStatus = projectContext.repo
    ? `
${projectContext.githubVerified ? '✅' : '⏳'} Vínculo GitHub: ${projectContext.githubVerified ? 'verificado automaticamente' : 'detecção automática pendente'}${projectContext.githubBindingSource ? ` · fonte ${projectContext.githubBindingSource}` : ''}`
    : '';
  const supabase = projectContext.supabase ? `
🟩 Supabase: ${projectContext.supabase.url || projectContext.supabase}` : '';
  return `${ctx}${repo}${branch}${githubStatus}${supabase}
[FIM DO CONTEXTO]

${message}`;
}
