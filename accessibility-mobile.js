(() => {
  let pending = false;

  function addStyles() {
    if (document.getElementById('edm-a11y-style')) return;
    const style = document.createElement('style');
    style.id = 'edm-a11y-style';
    style.textContent = `
      .edm-skip{position:fixed;top:10px;left:10px;z-index:1000;padding:12px 16px;border-radius:12px;background:#e0a075;color:#11171a;font-weight:900;text-decoration:none;transform:translateY(-180%)}
      .edm-skip:focus{transform:translateY(0)}
      :where(button,a,input,select,textarea,[tabindex]):focus-visible{outline:3px solid #e0a075!important;outline-offset:3px!important}
      button,.btn,.nav button,.site-footer button{min-height:44px}
      .basket-card[role="button"]:focus-visible{border-color:#e0a075!important;box-shadow:0 0 0 4px rgba(224,160,117,.18)!important}
      .edm-table-scroll{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:16px}.edm-table-scroll .table{min-width:640px}
      .edm-menu-overlay{position:fixed;inset:0;z-index:19;display:none;border:0;background:rgba(0,0,0,.58)}.edm-menu-overlay.show{display:block}
      @media(max-width:980px){body.edm-menu-open{overflow:hidden}.topbar{top:8px!important}.panel{border-radius:22px!important}.hero h1{font-size:clamp(2.35rem,14vw,4.2rem)!important}}
      @media(max-width:520px){.main{padding-inline:10px!important}.topbar{border-radius:18px!important;padding:10px!important}.topbar-title span:last-child{display:none}.btn-row>.btn{width:100%}.service-toolbar .btn{flex:1 1 calc(50% - 8px)}.section-title{flex-direction:column}.toast{left:10px;right:10px;bottom:10px;max-width:none}}
      @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
    `;
    document.head.appendChild(style);
  }

  function addSkipLink() {
    const main = document.querySelector('main.main');
    if (!main || document.querySelector('.edm-skip')) return;
    main.id = 'edm-main';
    main.tabIndex = -1;
    const link = document.createElement('a');
    link.className = 'edm-skip';
    link.href = '#edm-main';
    link.textContent = 'Aller au contenu principal';
    document.body.prepend(link);
  }

  function setupMenu() {
    const sidebar = document.getElementById('sidebar');
    const opener = document.getElementById('openMenu');
    if (!sidebar || !opener) return;
    opener.setAttribute('aria-controls', 'sidebar');
    sidebar.setAttribute('aria-label', 'Menu principal');

    let overlay = document.querySelector('.edm-menu-overlay');
    if (!overlay) {
      overlay = document.createElement('button');
      overlay.type = 'button';
      overlay.className = 'edm-menu-overlay';
      overlay.setAttribute('aria-label', 'Fermer le menu');
      document.body.appendChild(overlay);
    }

    const sync = () => {
      const open = sidebar.classList.contains('open') && matchMedia('(max-width:980px)').matches;
      opener.setAttribute('aria-expanded', open ? 'true' : 'false');
      opener.setAttribute('aria-label', open ? 'Fermer le menu principal' : 'Ouvrir le menu principal');
      overlay.classList.toggle('show', open);
      document.body.classList.toggle('edm-menu-open', open);
    };
    const close = () => { sidebar.classList.remove('open'); sync(); };

    if (!opener.dataset.a11yReady) {
      opener.dataset.a11yReady = '1';
      opener.addEventListener('click', () => setTimeout(sync, 0));
      overlay.addEventListener('click', close);
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
      new MutationObserver(sync).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }
    sync();
  }

  function decorate() {
    document.querySelectorAll('button:not([type])').forEach((button) => { button.type = 'button'; });
    document.querySelectorAll('.page').forEach((page) => {
      page.setAttribute('role', 'region');
      page.setAttribute('aria-hidden', page.classList.contains('active') ? 'false' : 'true');
    });
    document.querySelectorAll('.nav [data-page]').forEach((button) => {
      if (button.classList.contains('active')) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    ['toast','authStatus','accountDeleteStatus'].forEach((id) => {
      const node = document.getElementById(id);
      if (node) { node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite'); }
    });
    document.querySelectorAll('.basket-card').forEach((card) => {
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.setAttribute('aria-pressed', card.classList.contains('selected') ? 'true' : 'false');
      if (card.dataset.keyboardReady) return;
      card.dataset.keyboardReady = '1';
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); }
      });
    });
    document.querySelectorAll('table.table').forEach((table) => {
      if (table.parentElement?.classList.contains('edm-table-scroll')) return;
      const wrap = document.createElement('div');
      wrap.className = 'edm-table-scroll';
      wrap.tabIndex = 0;
      wrap.setAttribute('aria-label', 'Tableau défilable horizontalement');
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  function queue() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; decorate(); });
  }

  function init() {
    addStyles();
    addSkipLink();
    setupMenu();
    decorate();
    document.addEventListener('click', () => setTimeout(decorate, 0));
    new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
