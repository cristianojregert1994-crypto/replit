/**
 * LoveBoltReplit GPT Connector — Responsive Sidepanel Layout (v3.48.0)
 * Mantém todo o painel utilizável ao redimensionar a sidebar do Chrome.
 */
(() => {
  const root = document.documentElement;
  const body = document.body;
  let raf = 0;

  const HEIGHT_CLASSES = ['lb-h-comfy', 'lb-h-compact', 'lb-h-tight', 'lb-h-micro'];
  const WIDTH_CLASSES = ['lb-w-wide', 'lb-w-compact', 'lb-w-narrow'];

  function classifyHeight(height) {
    if (height < 500) return 'lb-h-micro';
    if (height < 620) return 'lb-h-tight';
    if (height < 760) return 'lb-h-compact';
    return 'lb-h-comfy';
  }

  function classifyWidth(width) {
    if (width < 300) return 'lb-w-narrow';
    if (width < 380) return 'lb-w-compact';
    return 'lb-w-wide';
  }

  function applyLayout() {
    raf = 0;
    const width = Math.max(1, window.innerWidth || root.clientWidth || 1);
    const height = Math.max(1, window.innerHeight || root.clientHeight || 1);

    HEIGHT_CLASSES.forEach((name) => body.classList.remove(name));
    WIDTH_CLASSES.forEach((name) => body.classList.remove(name));
    body.classList.add(classifyHeight(height), classifyWidth(width));
    body.style.setProperty('--lb-vw', `${width}px`);
    body.style.setProperty('--lb-vh', `${height}px`);

    // Disponibiliza a altura útil real para o CSS do chat.
    const header = document.querySelector('.header');
    const footer = document.querySelector('.footer');
    const headerH = header?.getBoundingClientRect().height || 0;
    const footerH = footer?.getBoundingClientRect().height || 0;
    body.style.setProperty('--lb-content-h', `${Math.max(120, height - headerH - footerH)}px`);
  }

  function scheduleLayout() {
    if (raf) return;
    raf = requestAnimationFrame(applyLayout);
  }

  window.addEventListener('resize', scheduleLayout, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleLayout, { passive: true });

  const observer = typeof ResizeObserver === 'function'
    ? new ResizeObserver(scheduleLayout)
    : null;
  observer?.observe(root);
  observer?.observe(body);

  document.addEventListener('DOMContentLoaded', scheduleLayout, { once: true });
  const initialEmpty = document.querySelector('#chatMessages .chat-empty');
  if (initialEmpty) initialEmpty.remove();
  scheduleLayout();

  console.log('[ResponsiveLayout] Loaded v3.48.0');
})();
