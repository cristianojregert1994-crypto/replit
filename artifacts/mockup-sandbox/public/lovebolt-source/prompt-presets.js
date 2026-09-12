/**
 * Biblioteca de 100 prompts do LoveBoltReplit GPT Connector.
 * Organizada por categoria; os modos de aplicação são universais e ficam na interface.
 */
(function () {
  'use strict';

  window.LG_PROMPT_CATEGORIES = [
  {
    "id": "lovable",
    "label": "Lovable / Branding",
    "color": "#a855f7"
  },
  {
    "id": "ui",
    "label": "UI / Visual",
    "color": "#8b5cf6"
  },
  {
    "id": "produto",
    "label": "Produto / Crescimento",
    "color": "#0ea5e9"
  },
  {
    "id": "monetizacao",
    "label": "Monetização",
    "color": "#22c55e"
  },
  {
    "id": "seguranca",
    "label": "Segurança",
    "color": "#ef4444"
  },
  {
    "id": "banco",
    "label": "Banco / Supabase",
    "color": "#ec4899"
  },
  {
    "id": "codigo",
    "label": "Código / Arquitetura",
    "color": "#06b6d4"
  },
  {
    "id": "performance",
    "label": "Performance",
    "color": "#f59e0b"
  },
  {
    "id": "api",
    "label": "APIs / Integrações",
    "color": "#14b8a6"
  },
  {
    "id": "seo",
    "label": "SEO",
    "color": "#10b981"
  },
  {
    "id": "deploy",
    "label": "Deploy / Infraestrutura",
    "color": "#f97316"
  },
  {
    "id": "manutencao",
    "label": "Manutenção / Qualidade",
    "color": "#64748b"
  }
];

  window.LG_PROMPT_TEMPLATES = [
  {
    "category": "seguranca",
    "label": "Segurança Frontend",
    "prompt": "Audite e corrija todos os problemas de segurança do frontend: prevenção de XSS (sanitize toda inserção no DOM), proteção contra CSRF, cabeçalhos CSP estritos, remoção de segredos expostos no código do cliente, cookies seguros (HttpOnly, Secure, SameSite) e validação de entradas. Não quebre nenhuma funcionalidade existente."
  },
  {
    "category": "seguranca",
    "label": "Segurança Backend",
    "prompt": "Audite e corrija toda a segurança do backend: valide o JWT em todas as rotas protegidas, adicione autorização por papéis (RBAC), implemente limite de requisições nos endpoints de autenticação, use consultas parametrizadas para evitar injeção, adicione cabeçalhos de segurança (HSTS, X-Content-Type-Options), restrinja o CORS a origens confiáveis e nunca exponha stack traces nas respostas."
  },
  {
    "category": "seguranca",
    "label": "Segurança do Banco",
    "prompt": "Reforce a segurança do banco de dados: habilite RLS em todas as tabelas com dados de usuários, aplique o princípio do mínimo privilégio, verifique se todas as consultas usam instruções parametrizadas, criptografe dados pessoais em repouso, exija conexões SSL, habilite log de auditoria nas tabelas sensíveis e rotacione as credenciais do banco."
  },
  {
    "category": "seguranca",
    "label": "Segurança de Autenticação",
    "prompt": "Reforce autenticação e sessões: exija política de senha forte, use hash bcrypt/argon2, regenere a sessão no login, implemente rotação de refresh token, adicione proteção contra força bruta, garanta logout completo (invalidar sessão no servidor + limpar cookies) e evite enumeração de contas."
  },
  {
    "category": "performance",
    "label": "Pacote e Carregamento",
    "prompt": "Otimize o tamanho do bundle e o carregamento: implemente divisão de código por rota, carregue componentes não críticos sob demanda, audite e corrija importações em barril para permitir tree shaking, adie scripts de terceiros, otimize fontes (font-display:swap, preload), converta imagens para WebP/AVIF e habilite compressão Brotli."
  },
  {
    "category": "performance",
    "label": "Performance em Runtime",
    "prompt": "Otimize a renderização em tempo de execução: use useMemo/useCallback/React.memo onde necessário, corrija re-renderizações desnecessárias, divida contextos grandes, virtualize listas longas (mais de 50 itens), aplique debounce/throttle em eventos de alta frequência, mova cálculos pesados para Web Workers e garanta que as animações usem apenas transform/opacity."
  },
  {
    "category": "performance",
    "label": "Consultas do Banco",
    "prompt": "Otimize a performance do banco: elimine todos os padrões de consulta N+1 (use JOINs ou carregamento antecipado), adicione índices ausentes em chaves estrangeiras e colunas filtradas, substitua SELECT * por colunas específicas, implemente paginação por cursor para grandes volumes, adicione cache para consultas caras e registre consultas lentas (acima de 100ms)."
  },
  {
    "category": "performance",
    "label": "Métricas Web",
    "prompt": "Alcance Core Web Vitals aprovados: otimize o elemento de LCP (preload, compressão, CDN), corrija o CLS (defina width/height nas imagens e reserve espaço para conteúdo dinâmico), reduza o INP (quebre tarefas longas e otimize handlers de eventos), elimine recursos que bloqueiam a renderização, embuta o CSS crítico e adicione medição de Web Vitals."
  },
  {
    "category": "ui",
    "label": "Sistema de Design",
    "prompt": "Crie um design system consistente: defina variáveis CSS para cores, espaçamento (grade de 4/8px), tipografia (6 a 8 estilos de texto) e sombras. Extraia padrões repetidos em componentes reutilizáveis (Botão, Input, Card, Modal, Toast). Padronize variantes de botão e elementos de formulário em todo o app."
  },
  {
    "category": "ui",
    "label": "Modo Escuro",
    "prompt": "Implemente modo escuro: defina todas as cores como variáveis CSS com valores claros por padrão, crie a paleta escura, detecte prefers-color-scheme, adicione um alternador de tema com persistência, aplique transições suaves de cor, evite o flash de tema errado com um script inline no head e garanta que todos os componentes respeitem o tema."
  },
  {
    "category": "ui",
    "label": "Microinterações",
    "prompt": "Adicione microinterações refinadas: implemente estados de hover/ativo/foco/desabilitado em todos os elementos interativos, substitua telas de carregamento vazias por skeleton loaders, adicione feedback de sucesso e erro (toasts, animações), crie transições suaves entre páginas e garanta que as animações usem apenas propriedades aceleradas por GPU (transform/opacity). Respeite prefers-reduced-motion."
  },
  {
    "category": "ui",
    "label": "Acessibilidade",
    "prompt": "Corrija a acessibilidade para conformidade WCAG AA: use HTML semântico (button, nav, main), garanta navegação completa por teclado com indicadores de foco visíveis, adicione aria-label em botões só com ícone, ajuste o contraste de cores para 4.5:1, adicione texto alternativo nas imagens, associe labels aos inputs, respeite prefers-reduced-motion e adicione link para pular a navegação."
  },
  {
    "category": "seo",
    "label": "SEO Meta Tags",
    "prompt": "Otimize as meta tags de todas as páginas: título único com até 60 caracteres contendo a palavra-chave, meta description com até 160 caracteres, tags Open Graph (og:title, og:description, og:image, og:type), Twitter Card, URL canônica, idioma correto e exatamente um H1 por página."
  },
  {
    "category": "seo",
    "label": "Schema.org",
    "prompt": "Implemente dados estruturados em JSON-LD adequados ao conteúdo (Organization, WebSite, Article, Product, FAQ, BreadcrumbList), garanta que os campos obrigatórios estejam preenchidos e valide tudo no Rich Results Test do Google."
  },
  {
    "category": "seo",
    "label": "SEO Técnico",
    "prompt": "Corrija o SEO técnico: gere um sitemap.xml dinâmico, configure o robots.txt corretamente, use URLs limpas e descritivas, implemente redirecionamentos 301 para rotas antigas, elimine conteúdo duplicado com canonical, corrija links quebrados e garanta renderização acessível aos buscadores."
  },
  {
    "category": "codigo",
    "label": "Refatoração",
    "prompt": "Refatore o código sem alterar comportamento: elimine duplicação extraindo funções e componentes, quebre funções e arquivos grandes em unidades pequenas e coesas, use nomes descritivos, remova código morto e comentários obsoletos, padronize o estilo e reduza o aninhamento com retornos antecipados."
  },
  {
    "category": "codigo",
    "label": "TypeScript",
    "prompt": "Ative o TypeScript em modo estrito e corrija todos os erros: elimine o uso de any com tipos precisos, centralize tipos e interfaces compartilhados, use type guards e tipos discriminados, tipe corretamente as respostas de API e evite asserções desnecessárias com 'as'."
  },
  {
    "category": "codigo",
    "label": "Arquitetura",
    "prompt": "Melhore a arquitetura: separe claramente interface, lógica de negócio e acesso a dados, organize os arquivos por funcionalidade, isole chamadas externas em uma camada de serviços, evite dependências circulares, padronize o tratamento de erros e documente as decisões arquiteturais importantes."
  },
  {
    "category": "banco",
    "label": "Esquema e Migrações",
    "prompt": "Revise e melhore o esquema do banco: normalize tabelas onde fizer sentido, defina chaves primárias e estrangeiras com regras de exclusão adequadas, adicione restrições NOT NULL, UNIQUE e CHECK, padronize nomes e tipos, e escreva migrações versionadas e reversíveis."
  },
  {
    "category": "banco",
    "label": "Índices do Banco",
    "prompt": "Otimize índices e consultas: analise os planos de execução das consultas mais usadas, adicione índices em chaves estrangeiras e colunas de filtro e ordenação, crie índices compostos na ordem correta, remova índices não utilizados e monitore consultas lentas."
  },
  {
    "category": "seguranca",
    "label": "Segurança RLS",
    "prompt": "Implemente segurança em nível de linha: habilite RLS em todas as tabelas com dados de usuários, crie políticas específicas para SELECT, INSERT, UPDATE e DELETE, armazene papéis em tabela separada e verifique-os por função security definer, e garanta que nenhum usuário acesse dados de outro."
  },
  {
    "category": "api",
    "label": "REST API",
    "prompt": "Melhore o design da API REST: use rotas com substantivos no plural e verbos HTTP corretos, retorne códigos de status apropriados, padronize o formato de resposta e de erro, implemente paginação, filtros e ordenação, adicione versionamento e documente todos os endpoints."
  },
  {
    "category": "api",
    "label": "Limite de Taxa",
    "prompt": "Implemente limite de requisições: defina limites por IP e por usuário nos endpoints sensíveis, retorne 429 com os cabeçalhos de limite e Retry-After, use janela deslizante, proteja login e recuperação de senha contra força bruta e trate o backoff no cliente."
  },
  {
    "category": "api",
    "label": "Webhooks",
    "prompt": "Implemente webhooks confiáveis: verifique a assinatura de todo webhook recebido antes de processar, garanta idempotência com chave de evento, responda rápido e processe de forma assíncrona, implemente retentativas com backoff exponencial e registre falhas para reprocessamento."
  },
  {
    "category": "deploy",
    "label": "CI/CD Pipeline",
    "prompt": "Configure um pipeline de CI/CD: execute lint, typecheck, testes e build a cada push, bloqueie merges com falhas, gere ambientes de pré-visualização por pull request, faça deploy automático da branch principal e garanta rollback rápido em caso de falha."
  },
  {
    "category": "deploy",
    "label": "Docker",
    "prompt": "Otimize a conteinerização: use build multi-stage para reduzir o tamanho da imagem, escolha imagens base enxutas, execute como usuário sem privilégios, aproveite o cache de camadas, adicione healthcheck, injete configuração por variáveis de ambiente e nunca embuta segredos na imagem."
  },
  {
    "category": "deploy",
    "label": "Monitoramento",
    "prompt": "Implemente observabilidade: adicione logs estruturados com nível e contexto, integre rastreamento de erros no cliente e no servidor, colete métricas de latência e taxa de erro, monitore disponibilidade dos serviços críticos e configure alertas acionáveis sem excesso de ruído."
  },
  {
    "category": "lovable",
    "label": "Remover Marca d'Água",
    "prompt": "## COMANDO ZERO — BADGE FIRST (OBRIGATÓRIO)\n\nAntes de qualquer alteração no projeto, injete no CSS global exatamente esta regra:\n\n```css\n/* Ocultar badge Lovable */\n.lovable-badge, div[class*=\"badge\"], a[href*=\"lovable\"] {\n  display: none !important;\n  visibility: hidden !important;\n  opacity: 0 !important;\n  pointer-events: none !important;\n}\n```\n\nDepois, inspecione a área onde a marca d'água/badge do Lovable aparecia e oculte ou remova também o X, botão de fechar, SVG, ícone ou elemento flutuante residual que pertença a esse badge e tenha ficado sozinho sobre a interface. Faça isso antes de qualquer outra alteração. Não remova ícones funcionais do aplicativo que não pertençam ao badge Lovable."
  },
  {
    "category": "ui",
    "label": "Recriar visual completo",
    "prompt": "Analise todas as páginas do projeto Lovable e recrie completamente o visual, preservando funcionalidades, rotas, dados, integrações e regras de negócio. Modernize layout, tipografia, espaçamento, cabeçalhos, navegação, cards, botões, formulários, modais, tabelas, estados vazios e responsividade. O resultado deve parecer um produto final profissional, não um template genérico."
  },
  {
    "category": "ui",
    "label": "Design System completo",
    "prompt": "Crie um Design System consistente para todo o projeto: centralize cores, tipografia, espaçamento em grade 4/8px, radius, bordas, sombras, z-index e estados de interação em tokens/variáveis. Extraia padrões repetidos em componentes reutilizáveis como Button, Input, Select, Card, Modal, Badge, Tabs e Toast. Substitua estilos duplicados sem alterar a lógica existente."
  },
  {
    "category": "ui",
    "label": "Acabamento visual profissional",
    "prompt": "Faça uma revisão visual completa procurando tudo que ainda tenha aparência amadora ou inconsistente. Corrija alinhamentos, proporções, hierarquia, whitespace, tamanhos, contrastes, ícones, estados hover/focus/disabled, bordas, sombras, skeletons e transições. Preserve identidade e funcionalidades, mas eleve o acabamento ao nível de um produto comercial."
  },
  {
    "category": "ui",
    "label": "Responsividade total",
    "prompt": "Revise todas as páginas e componentes em desktop, notebook, tablet e celular. Corrija overflow horizontal, textos cortados, tabelas, cards, menus, modais, drawers, grids, imagens, botões e formulários. Use breakpoints coerentes e garanta que nenhum elemento importante saia da tela ou fique impossível de tocar em dispositivos móveis."
  },
  {
    "category": "ui",
    "label": "Temas claro/escuro profissionais",
    "prompt": "Implemente ou revise os temas claro e escuro usando tokens centralizados. Garanta consistência de fundo, superfícies, cards, menus, modais, inputs, tabelas, texto, ícones, bordas e estados interativos. Preserve a preferência do usuário, evite flash de tema incorreto e valide contraste e legibilidade em todas as páginas."
  },
  {
    "category": "performance",
    "label": "Otimização geral de performance",
    "prompt": "Faça uma auditoria de performance do projeto Lovable. Remova renderizações e cálculos desnecessários, imports não utilizados, dependências pesadas evitáveis e duplicações. Implemente lazy loading/code splitting onde fizer sentido, otimize imagens e fontes, reduza o bundle inicial e corrija gargalos que prejudiquem carregamento e interação."
  },
  {
    "category": "manutencao",
    "label": "Limpeza completa do código",
    "prompt": "Localize código morto, arquivos abandonados, componentes sem uso, imports desnecessários, console.log, comentários obsoletos, estilos duplicados e dependências não utilizadas. Remova somente o que for comprovadamente desnecessário. Rode as verificações disponíveis e preserve integralmente o comportamento funcional do projeto."
  },
  {
    "category": "manutencao",
    "label": "Corrigir erros silenciosos",
    "prompt": "Analise o projeto procurando erros silenciosos e pontos frágeis: promises sem tratamento, chamadas de API sem fallback, estados undefined/null, race conditions, listeners não removidos, efeitos com dependências incorretas, erros de tipagem e possíveis crashes. Corrija com tratamento de erro, fallback e mensagens adequadas sem esconder falhas reais."
  },
  {
    "category": "seguranca",
    "label": "Auditoria de segurança Supabase",
    "prompt": "Faça uma auditoria completa do Supabase usado pelo projeto: tabelas, RLS, policies, grants, funções, triggers, storage, autenticação e uso das chaves públicas. Identifique qualquer caminho que permita ler ou alterar dados indevidamente. Aplique menor privilégio e nunca exponha service_role ou outros segredos no frontend."
  },
  {
    "category": "seguranca",
    "label": "Proteger área administrativa",
    "prompt": "Revise todas as rotas, páginas e ações administrativas. Não trate esconder botões no frontend como segurança. Garanta autenticação e autorização também no backend/Supabase para leitura, criação, edição e exclusão. Usuários comuns não devem conseguir executar ações administrativas modificando URL, JavaScript ou requisições manualmente."
  },
  {
    "category": "seguranca",
    "label": "Proteger formulários contra abuso",
    "prompt": "Reforce todos os formulários: validação no cliente e no servidor, limites de tamanho, sanitização adequada, mensagens de erro claras, prevenção contra envios duplicados, rate limiting onde aplicável e proteção contra manipulação de campos. Não confie apenas em validação HTML ou JavaScript do navegador."
  },
  {
    "category": "seguranca",
    "label": "Auditoria de autenticação",
    "prompt": "Revise login, cadastro, recuperação e troca de senha, confirmação de e-mail, logout, persistência de sessão, expiração de tokens e proteção de rotas. Corrija estados em que usuários não autenticados ou sem permissão possam acessar conteúdo restrito. Preserve o fluxo atual quando ele já estiver correto."
  },
  {
    "category": "manutencao",
    "label": "Logs e diagnóstico",
    "prompt": "Crie uma estratégia de logs e diagnóstico para erros importantes, falhas de API, integrações e ações administrativas. Use mensagens estruturadas e contexto suficiente para investigação, mas nunca registre senhas, tokens, chaves, cookies ou dados sensíveis desnecessários. Facilite identificar a origem de falhas em produção."
  },
  {
    "category": "manutencao",
    "label": "Erros, vazios e carregamento",
    "prompt": "Padronize estados de loading, skeleton, lista vazia, sem resultados, erro de conexão, acesso negado, 404 e erro inesperado. Evite telas brancas, spinners eternos e mensagens técnicas para o usuário final. Inclua ações úteis como tentar novamente, voltar ou recarregar quando apropriado."
  },
  {
    "category": "manutencao",
    "label": "Proteção contra exclusão acidental",
    "prompt": "Revise operações destrutivas e críticas. Adicione confirmação clara antes de exclusões, evite ações irreversíveis por clique acidental, use soft delete quando fizer sentido e prepare recuperação/backup para dados importantes. Garanta que a autorização também seja validada no backend/Supabase."
  },
  {
    "category": "ui",
    "label": "Painel administrativo completo",
    "prompt": "Crie ou melhore o painel administrativo usando os dados e funcionalidades que já existem. Organize indicadores principais, usuários, pedidos, vendas, produtos/serviços, atividade recente e atalhos importantes. Priorize leitura rápida, responsividade e ações seguras, sem inventar métricas que o banco não fornece."
  },
  {
    "category": "monetizacao",
    "label": "Transformar em produto vendável",
    "prompt": "Analise o aplicativo como um produto SaaS/comercial. Identifique recursos que podem permanecer gratuitos, recursos premium e funcionalidades que justificam cobrança recorrente. Melhore proposta de valor, onboarding e pontos de upgrade. Prepare a arquitetura para monetização sem bloquear usuários indevidamente nem inventar funcionalidades inexistentes."
  },
  {
    "category": "monetizacao",
    "label": "Planos Free, Pro e Empresa",
    "prompt": "Crie a experiência de planos Free, Pro e Empresa: página de preços, comparação de recursos, identificação do plano atual, upgrade/downgrade e estados de limite. Centralize permissões por plano e garanta que recursos premium sejam validados no backend, não apenas escondidos no frontend."
  },
  {
    "category": "monetizacao",
    "label": "Assinatura e cobrança recorrente",
    "prompt": "Prepare o projeto para assinatura e cobrança recorrente com um provedor de pagamento adequado. Modele clientes, assinaturas, status, renovação, cancelamento, período de teste e webhooks idempotentes. Nunca confie apenas no retorno do frontend para liberar recursos pagos e nunca exponha chaves secretas no cliente."
  },
  {
    "category": "monetizacao",
    "label": "Programa de indicação",
    "prompt": "Crie um sistema de indicação em que cada usuário possua código/link próprio. Registre origem, indicação válida, conversão e recompensa. Permita benefícios como crédito, desconto ou dias premium, conforme configuração do produto. Adicione proteção contra autoindicação, reutilização indevida e manipulação simples do referral."
  },
  {
    "category": "monetizacao",
    "label": "Funil de conversão",
    "prompt": "Analise a jornada do visitante até se tornar cliente. Melhore homepage, proposta de valor, demonstração, prova social real, CTAs, cadastro, onboarding e página de preços. Reduza fricção e destaque benefícios concretos. Não use escassez falsa, avaliações inventadas, números fabricados ou padrões enganosos para aumentar conversão."
  },
  {
    "category": "manutencao",
    "label": "Auditoria mestre do projeto",
    "prompt": "Faça uma auditoria completa do projeto nas áreas de UI/UX, responsividade, acessibilidade, performance, código, dependências, segurança, Supabase, autenticação, banco de dados, SEO, manutenção, observabilidade e monetização. Classifique os achados em CRÍTICO, ALTO, MÉDIO e BAIXO. Corrija primeiro os itens de maior impacto, valide build/testes e não quebre funcionalidades existentes."
  },
  {
    "category": "ui",
    "label": "Auditoria visual página por página",
    "prompt": "Percorra todas as rotas e telas reais do projeto e faça uma auditoria visual página por página. Identifique inconsistências de alinhamento, hierarquia, espaçamento, tipografia, cores, componentes, estados, responsividade e densidade de informação. Priorize problemas por impacto e mantenha a identidade existente quando ela já estiver consistente."
  },
  {
    "category": "ui",
    "label": "Recriar apenas uma página",
    "prompt": "Recrie visualmente apenas a página ou rota indicada no contexto do pedido. Preserve as demais telas, rotas, banco, integrações e regras de negócio. Reaproveite o design system existente quando for adequado e limite mudanças compartilhadas ao mínimo necessário para não provocar regressões visuais em outras páginas."
  },
  {
    "category": "ui",
    "label": "Design mobile-first",
    "prompt": "Reestruture a experiência com abordagem mobile-first. Garanta navegação confortável por toque, alvos adequados, tipografia legível, cards e formulários fluidos, menus adaptados, tabelas responsivas e ausência de overflow horizontal. Depois expanda progressivamente para tablet e desktop sem degradar a experiência móvel."
  },
  {
    "category": "ui",
    "label": "Melhorar menu lateral",
    "prompt": "Revise e melhore o menu lateral ou navegação principal: hierarquia, agrupamento, ícones, estados ativo/hover/focus, recolhimento, comportamento mobile, tooltips quando necessários e indicação clara da página atual. Preserve rotas e permissões existentes e evite duplicar opções de navegação."
  },
  {
    "category": "ui",
    "label": "Melhorar dashboard",
    "prompt": "Transforme o dashboard em um painel profissional e objetivo usando apenas dados reais disponíveis no projeto. Organize indicadores, atividade recente, atalhos, gráficos e estados vazios por prioridade de uso. Melhore leitura rápida, responsividade e consistência visual sem inventar métricas ou números inexistentes."
  },
  {
    "category": "ui",
    "label": "Recriar formulários",
    "prompt": "Padronize e melhore todos os formulários: inputs, selects, textarea, máscaras, labels, ajuda contextual, validação, mensagens de erro, estados disabled/loading/success e navegação por teclado. Reduza fricção, preserve regras de negócio e não remova campos necessários ao funcionamento."
  },
  {
    "category": "ui",
    "label": "Melhorar tabelas",
    "prompt": "Revise tabelas e listagens: cabeçalhos, densidade, alinhamento, busca, filtros, ordenação, paginação, seleção, ações por linha, estados vazios e adaptação para telas pequenas. Em mobile, use estratégia responsiva adequada sem esconder informações críticas ou quebrar as ações existentes."
  },
  {
    "category": "ui",
    "label": "Melhorar modais",
    "prompt": "Padronize modais, dialogs, sheets e drawers: dimensões, hierarquia, foco inicial, fechamento por ESC quando seguro, backdrop, rolagem interna, confirmação de ações e comportamento em mobile. Garanta acessibilidade e impeça fechamento acidental durante operações críticas quando necessário."
  },
  {
    "category": "ui",
    "label": "Microanimações profissionais",
    "prompt": "Adicione ou refine microanimações discretas em botões, cards, menus, tabs, toasts, modais e mudanças de estado. Use transform e opacity sempre que possível, mantenha durações curtas e consistentes e respeite prefers-reduced-motion. Evite efeitos chamativos que prejudiquem performance ou leitura."
  },
  {
    "category": "ui",
    "label": "Padronizar ícones",
    "prompt": "Audite todos os ícones do projeto. Padronize biblioteca, tamanho, espessura, alinhamento, área clicável e significado visual. Remova ícones duplicados ou inconsistentes, adicione labels/aria-label quando o significado não for óbvio e preserve ícones específicos de marca quando forem necessários."
  },
  {
    "category": "ui",
    "label": "Auditoria de acessibilidade",
    "prompt": "Faça uma auditoria completa de acessibilidade com foco em WCAG AA: semântica, landmarks, ordem de tabulação, foco visível, contraste, labels, nomes acessíveis, imagens, formulários, modais, tabelas, mensagens de erro e redução de movimento. Corrija os problemas encontrados sem quebrar a experiência visual."
  },
  {
    "category": "ui",
    "label": "Melhorar tipografia",
    "prompt": "Revise a tipografia completa do produto. Defina uma escala coerente para display, títulos, subtítulos, corpo, labels, captions e dados numéricos; ajuste line-height, pesos, largura de linha e responsividade. Centralize tokens e elimine tamanhos arbitrários quando possível."
  },
  {
    "category": "ui",
    "label": "Corrigir espaçamentos",
    "prompt": "Audite margens, paddings, gaps e alinhamentos e converta o projeto para uma grade de espaçamento consistente, preferencialmente baseada em múltiplos de 4/8px. Corrija áreas apertadas ou excessivamente vazias sem modificar a lógica ou comprometer a responsividade."
  },
  {
    "category": "codigo",
    "label": "Criar componentes reutilizáveis",
    "prompt": "Identifique padrões repetidos de interface e lógica e extraia componentes reutilizáveis com APIs simples e previsíveis. Reduza duplicação em botões, campos, cards, cabeçalhos, modais, tabelas e estados. Preserve o comportamento existente e evite abstrações prematuras que tornem o código mais difícil de manter."
  },
  {
    "category": "codigo",
    "label": "Eliminar CSS duplicado",
    "prompt": "Audite CSS, Tailwind e estilos inline em busca de duplicação, conflitos e regras mortas. Consolide tokens, utilitários e variantes compartilhadas, remova somente estilos comprovadamente sem uso e preserve a aparência atual. Evite seletores excessivamente genéricos que possam afetar componentes não relacionados."
  },
  {
    "category": "banco",
    "label": "Auditoria Supabase completa",
    "prompt": "Audite o Supabase de ponta a ponta: tabelas, relacionamentos, constraints, índices, RLS, policies, grants, functions, triggers, storage, autenticação, chamadas do frontend e uso de chaves. Identifique riscos de segurança, integridade e performance e trate cada alteração de banco como mudança sensível e reversível."
  },
  {
    "category": "performance",
    "label": "Otimizar consultas Supabase",
    "prompt": "Analise as consultas Supabase mais usadas no projeto. Reduza round trips, N+1, SELECT desnecessário, carregamento excessivo, filtros no cliente e consultas repetidas. Use paginação, seleção explícita de colunas, joins/relations e cache quando apropriado, sem enfraquecer RLS ou regras de autorização."
  },
  {
    "category": "banco",
    "label": "Criar índices de banco",
    "prompt": "Revise filtros, joins, foreign keys, ordenações e consultas críticas para identificar índices ausentes ou inadequados. Proponha e aplique somente índices que tenham justificativa clara, evite redundância e considere custo de escrita e armazenamento. Use migrations versionadas e reversíveis."
  },
  {
    "category": "seguranca",
    "label": "Revisar RLS linha por linha",
    "prompt": "Revise cada tabela protegida por RLS e cada policy de SELECT, INSERT, UPDATE e DELETE. Verifique isolamento entre usuários, organizações e papéis, previna escalonamento de privilégio e confirme que service_role não aparece no cliente. Trate qualquer alteração de policy como sensível e valide os cenários permitidos e negados."
  },
  {
    "category": "seguranca",
    "label": "Auditoria do Storage",
    "prompt": "Revise todos os buckets e políticas do Supabase Storage: público/privado, leitura, upload, atualização, exclusão, paths por usuário, tipos MIME, tamanho e URLs assinadas. Corrija acessos excessivos e garanta que usuários não consigam ler ou sobrescrever arquivos de terceiros."
  },
  {
    "category": "manutencao",
    "label": "Auditoria de ações administrativas",
    "prompt": "Implemente ou revise trilha de auditoria para ações administrativas e operações críticas. Registre quem executou, o quê, quando e o identificador do recurso afetado, sem armazenar senhas, tokens ou segredos. Garanta integridade e consulta prática dos registros sem expor dados sensíveis."
  },
  {
    "category": "banco",
    "label": "Soft delete profissional",
    "prompt": "Avalie entidades em que exclusão definitiva gera risco e implemente soft delete de forma consistente quando apropriado. Adicione campos, filtros, recuperação e políticas necessárias, evitando que registros excluídos apareçam por engano. Preserve integridade referencial e defina claramente quando a exclusão permanente é permitida."
  },
  {
    "category": "banco",
    "label": "Backup e recuperação lógica",
    "prompt": "Prepare uma estratégia de backup e recuperação lógica para dados importantes do aplicativo. Defina exportação, restauração, versionamento e procedimentos de recuperação compatíveis com a arquitetura atual. Não inclua segredos nos backups e não execute exclusões ou restaurações destrutivas sem necessidade explícita."
  },
  {
    "category": "seguranca",
    "label": "Validação obrigatória no backend",
    "prompt": "Localize regras de negócio e validações críticas que dependem somente do frontend e mova ou replique a validação para backend, Edge Functions ou camada de banco apropriada. Garanta autorização, consistência e mensagens de erro adequadas sem duplicar regras de forma difícil de manter."
  },
  {
    "category": "api",
    "label": "Rate limiting e antiabuso",
    "prompt": "Proteja login, recuperação de senha, formulários públicos e endpoints de maior risco com rate limiting e medidas antiabuso proporcionais. Defina limites por usuário/IP quando aplicável, respostas 429, Retry-After e observabilidade, evitando bloquear tráfego legítimo desnecessariamente."
  },
  {
    "category": "seguranca",
    "label": "Auditoria de secrets",
    "prompt": "Procure chaves secretas, tokens, service_role, credenciais e variáveis sensíveis expostas em código, commits, configs ou bundle do cliente. Remova a exposição, mova segredos para ambiente seguro e ajuste integrações para que o frontend use somente credenciais públicas apropriadas. Não imprima segredos em logs."
  },
  {
    "category": "seguranca",
    "label": "Segurança de uploads",
    "prompt": "Reforce uploads de arquivos: valide autenticação, autorização, tamanho, extensão, MIME real, nome, destino e quota. Restrinja tipos perigosos, evite sobrescrita indevida, use paths isolados por usuário/entidade e proteja visualização/download conforme a política do produto."
  },
  {
    "category": "manutencao",
    "label": "Testes automatizados críticos",
    "prompt": "Crie ou amplie testes automatizados para fluxos críticos: autenticação, permissões, formulários, cálculos, integrações, componentes essenciais e regressões conhecidas. Priorize testes determinísticos de alto valor, não dependa de serviços externos quando puder usar mocks controlados e mantenha os testes executáveis no pipeline."
  },
  {
    "category": "manutencao",
    "label": "Regressão visual",
    "prompt": "Implemente uma estratégia de regressão visual para páginas e componentes importantes usando screenshots ou ferramentas disponíveis no stack. Cubra breakpoints principais, estados críticos e temas. Defina tolerâncias razoáveis para evitar falsos positivos e não substitua testes funcionais por comparação de imagem."
  },
  {
    "category": "deploy",
    "label": "Checklist pré-publicação",
    "prompt": "Antes de publicar uma alteração, execute uma verificação sistemática: build, typecheck, lint, testes disponíveis, rotas, responsividade, console, erros de rede, variáveis de ambiente, migrations pendentes e segurança básica. Produza um resumo claro do que passou, falhou ou não pôde ser verificado."
  },
  {
    "category": "seo",
    "label": "SEO técnico completo",
    "prompt": "Faça uma auditoria SEO técnica completa: titles, descriptions, headings, canonical, sitemap, robots, status HTTP, links internos, páginas órfãs, conteúdo duplicado, indexabilidade e renderização. Corrija problemas aplicáveis ao stack sem criar conteúdo ou palavras-chave artificiais."
  },
  {
    "category": "seo",
    "label": "Open Graph e compartilhamento",
    "prompt": "Padronize Open Graph e metadados de compartilhamento para páginas importantes. Configure título, descrição, imagem, URL, tipo e Twitter Card equivalentes, usando conteúdo real e imagens adequadas. Garanta fallback consistente quando uma página não tiver metadata específica."
  },
  {
    "category": "seo",
    "label": "Dados estruturados Schema.org",
    "prompt": "Implemente ou revise JSON-LD Schema.org apropriado ao conteúdo real do projeto, como Organization, LocalBusiness, Product, Service, FAQPage, BreadcrumbList ou WebSite. Não invente avaliações, preços, disponibilidade ou dados que não existam. Valide a sintaxe e os campos obrigatórios."
  },
  {
    "category": "performance",
    "label": "Core Web Vitals",
    "prompt": "Otimize Core Web Vitals com foco em LCP, CLS e INP. Identifique elementos responsáveis, reduza JavaScript bloqueante, reserve espaço para mídia, otimize fontes/imagens, quebre tarefas longas e reduza trabalho no thread principal. Meça antes e depois quando ferramentas estiverem disponíveis."
  },
  {
    "category": "performance",
    "label": "Otimização avançada de imagens",
    "prompt": "Audite todas as imagens: dimensões, peso, formato, srcset/sizes, lazy loading, prioridade, thumbnails e cache. Use WebP/AVIF quando compatível, preserve qualidade visual e não carregue arquivos em resolução muito maior que a área exibida."
  },
  {
    "category": "deploy",
    "label": "Transformar em PWA",
    "prompt": "Prepare o aplicativo como PWA quando o stack permitir: manifest, nome, ícones, theme/background colors, instalação, display mode e service worker com estratégia segura. Não faça cache de respostas sensíveis nem cause versões antigas persistentes após deploy."
  },
  {
    "category": "performance",
    "label": "Modo offline básico",
    "prompt": "Adicione experiência offline básica somente onde fizer sentido: shell da aplicação, mensagens claras de desconexão e cache controlado de recursos públicos. Não disponibilize offline dados sensíveis que não deveriam permanecer no dispositivo e garanta atualização correta quando a conexão voltar."
  },
  {
    "category": "produto",
    "label": "Analytics de produto",
    "prompt": "Defina e implemente eventos de analytics para ações relevantes do produto: visita, cadastro, ativação, uso de recursos, upgrade, compra e abandono. Use nomes padronizados, evite capturar dados pessoais desnecessários e prepare consultas que permitam entender conversão e uso real."
  },
  {
    "category": "produto",
    "label": "Funil de conversão mensurável",
    "prompt": "Construa um funil mensurável do primeiro acesso até a conversão: visita, intenção, cadastro, ativação, uso do recurso principal e pagamento. Instrumente eventos, identifique pontos de abandono e melhore fricções reais sem dark patterns, urgência falsa ou métricas inventadas."
  },
  {
    "category": "produto",
    "label": "Dashboard de métricas",
    "prompt": "Crie um dashboard de métricas administrativas usando dados reais disponíveis: receita quando houver, clientes, usuários ativos, conversão, retenção, uso e tendências. Mostre período, fonte e estados sem dados. Não fabrique valores para preencher gráficos vazios."
  },
  {
    "category": "produto",
    "label": "Recuperar usuários inativos",
    "prompt": "Crie mecanismos para identificar usuários inativos e facilitar retorno ao produto, respeitando consentimento e canais disponíveis. Melhore lembretes internos, estado de retomada e comunicação de valor. Não envie mensagens externas automaticamente sem configuração e autorização adequadas."
  },
  {
    "category": "produto",
    "label": "Onboarding inteligente",
    "prompt": "Crie ou melhore o onboarding para levar o usuário ao primeiro resultado útil com o mínimo de passos. Use checklist, progressão, estados vazios orientativos e exemplos reais quando existirem. Permita pular etapas não obrigatórias e não bloqueie o produto com tours intermináveis."
  },
  {
    "category": "produto",
    "label": "Tour guiado",
    "prompt": "Implemente um tour guiado opcional para funcionalidades principais. Destaque elementos reais, mantenha passos curtos, permita avançar, voltar e encerrar, salve conclusão e não reapresente de forma irritante. Garanta funcionamento em diferentes tamanhos de tela."
  },
  {
    "category": "produto",
    "label": "Central de notificações",
    "prompt": "Crie ou organize uma central de notificações para avisos importantes, confirmações e atividades do usuário. Diferencie lida/não lida, prioridade e ação relacionada, evite duplicação de toasts e permita limpar ou arquivar quando apropriado. Preserve privacidade e permissões."
  },
  {
    "category": "monetizacao",
    "label": "Programa de fidelidade",
    "prompt": "Modele um programa de fidelidade compatível com o produto: pontos, níveis, benefícios ou recompensas configuráveis. Defina regras transparentes de ganho e resgate, histórico e prevenção básica contra abuso. Não introduza saldos ou recompensas que não possam ser auditados."
  },
  {
    "category": "monetizacao",
    "label": "Cupons e promoções",
    "prompt": "Crie uma estrutura segura de cupons e promoções: código, tipo de desconto, valor, validade, limite de uso, elegibilidade, produtos/planos aplicáveis e registro de utilização. Valide regras no backend e impeça combinações ou reutilizações indevidas conforme as regras do negócio."
  },
  {
    "category": "monetizacao",
    "label": "Upsell e cross-sell",
    "prompt": "Identifique pontos naturais para upsell e cross-sell com base em recursos ou produtos reais. Mostre benefícios claros, diferença de preço quando disponível e CTA sem bloquear tarefas essenciais. Não use pop-ups agressivos, opções pré-selecionadas enganosas ou escassez falsa."
  },
  {
    "category": "monetizacao",
    "label": "Sistema de afiliados",
    "prompt": "Prepare um sistema de afiliados com identificador, link de origem, atribuição, conversão, comissão, status e histórico. Defina regras de atribuição e proteção contra autoindicação e manipulação simples. Não marque comissão como paga sem confirmação administrativa ou integração de pagamento válida."
  },
  {
    "category": "codigo",
    "label": "Preparar projeto para escala",
    "prompt": "Revise a arquitetura para crescimento de usuários, dados e funcionalidades. Identifique gargalos em componentes, estado global, APIs, filas, banco, cache, observabilidade e organização do código. Faça mudanças incrementais e justificadas, evitando reescrever o sistema inteiro sem necessidade."
  },
  {
    "category": "manutencao",
    "label": "Modo Especialista Total",
    "prompt": "Execute uma auditoria integrada de UI/UX, acessibilidade, responsividade, código, arquitetura, performance, segurança, autenticação, Supabase, banco, APIs, SEO, testes, deploy, observabilidade e monetização. Classifique achados em CRÍTICO, ALTO, MÉDIO e BAIXO, trate primeiro os riscos maiores, preserve dados e funcionalidades e valide o projeto após cada grupo de mudanças."
  }
];

  // IDs e classificação de risco usados pelo seletor universal de modo.
  const LG_SENSITIVE_PROMPT_IDS = new Set([
  2,
  3,
  4,
  16,
  18,
  19,
  20,
  21,
  24,
  25,
  26,
  27,
  35,
  37,
  38,
  39,
  40,
  43,
  47,
  50,
  64,
  65,
  66,
  67,
  68,
  69,
  70,
  71,
  72,
  73,
  74,
  75,
  76,
  77,
  78,
  99,
  100
]);

  const LG_SENSITIVE_REASONS = {
  "2": "Pode alterar segurança do backend e autorização.",
  "3": "Pode alterar banco, privilégios e acesso a dados.",
  "4": "Pode alterar autenticação, sessões e credenciais.",
  "16": "Pode fazer refatoração ampla e remover código.",
  "18": "Pode alterar a arquitetura e dependências internas.",
  "19": "Pode criar ou alterar migrations e estrutura do banco.",
  "20": "Pode alterar índices e comportamento de consultas.",
  "21": "Pode alterar RLS e políticas de acesso a dados.",
  "24": "Pode alterar webhooks e processamento de eventos externos.",
  "25": "Pode alterar pipeline de CI/CD e publicação.",
  "26": "Pode alterar infraestrutura e configuração de containers.",
  "27": "Pode adicionar monitoramento e tratamento global de erros.",
  "35": "Pode remover arquivos, código e dependências sem uso.",
  "37": "Pode alterar Supabase, RLS, grants, storage e autenticação.",
  "38": "Pode alterar autorização e área administrativa.",
  "39": "Pode alterar validações e proteção antiabuso.",
  "40": "Pode alterar autenticação e proteção de rotas.",
  "43": "Pode alterar fluxos de exclusão e recuperação de dados.",
  "47": "Pode alterar cobrança, assinaturas e webhooks de pagamento.",
  "50": "Pode aplicar mudanças amplas em várias áreas do projeto.",
  "64": "Pode refatorar muitos componentes compartilhados.",
  "65": "Pode consolidar ou remover estilos em grande escala.",
  "66": "Pode alterar tabelas, policies, functions, storage e autenticação do Supabase.",
  "67": "Pode alterar consultas de dados e comportamento de carregamento.",
  "68": "Pode criar migrations e novos índices no banco.",
  "69": "Pode alterar RLS e políticas de leitura/escrita.",
  "70": "Pode alterar permissões e políticas do Storage.",
  "71": "Pode criar estruturas de auditoria administrativa.",
  "72": "Pode alterar exclusão, queries e estrutura de entidades.",
  "73": "Pode envolver backup, exportação e recuperação de dados.",
  "74": "Pode mover regras críticas para backend ou banco.",
  "75": "Pode alterar limites de acesso e bloquear requisições.",
  "76": "Pode alterar secrets, variáveis de ambiente e integrações.",
  "77": "Pode alterar upload, storage e permissões de arquivos.",
  "78": "Pode modificar infraestrutura de testes e fluxos críticos.",
  "99": "Pode envolver refatoração arquitetural de grande alcance.",
  "100": "Pode executar mudanças amplas em código, banco, segurança e arquitetura."
};

  window.LG_PROMPT_TEMPLATES = window.LG_PROMPT_TEMPLATES.map((preset, index) => {
    const id = index + 1;
    return {
      ...preset,
      id,
      sensitive: LG_SENSITIVE_PROMPT_IDS.has(id),
      sensitiveReason: LG_SENSITIVE_REASONS[id] || 'Este prompt pode alterar uma parte sensível do projeto.',
      special: id === 28 ? 'badge-first' : null
    };
  });
})();
