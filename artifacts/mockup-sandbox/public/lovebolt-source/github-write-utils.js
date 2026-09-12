/** Explicit/manual GitHub write path helpers. */
function getSmartFilePath(code, language) {
  const lang = (language || '').toLowerCase();
  const c = String(code || '').toLowerCase();
  const name = detectComponentName(code);
  if (lang === 'css') return name ? `src/styles/${name}.css` : 'src/styles/styles.css';
  if (lang === 'html') return 'src/index.html';
  if (lang === 'json') return 'src/config.json';
  if (lang === 'tsx' || lang === 'jsx' || c.includes('react') || c.includes('export default function')) return name ? `src/components/${name}.tsx` : 'src/components/Component.tsx';
  if (lang === 'ts' || lang === 'js' || c.includes('export')) {
    if (c.includes('supabase')) return 'src/integrations/supabase/client.ts';
    return name ? `src/utils/${name}.ts` : 'src/utils/utils.ts';
  }
  return `src/generated/output_${Date.now().toString(36)}.${lang || 'txt'}`;
}

function detectComponentName(code) {
  const text = String(code || '');
  const patterns = [/export\s+default\s+(?:function|class|const)\s+(\w+)/, /export\s+(?:function|class|const)\s+(\w+)/, /(?:function|class)\s+(\w+)/, /const\s+(\w+)\s*=/];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length > 2 && match[1] !== 'default' && /^[A-Z]/.test(match[1])) return match[1].replace(/Props$/, '');
  }
  return null;
}
