(() => {
  const safe = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  function getSetting(key, fallback = '') {
    try {
      const raw = window.EDMFinalSettings?.[key];
      if (raw == null) return fallback;
      if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
      return String(raw.value ?? fallback);
    } catch (_) {
      return fallback;
    }
  }

  function installStyles() {
    if (document.getElementById('edm-contact-footer-style')) return;
    const style = document.createElement('style');
    style.id = 'edm-contact-footer-style';
    style.textContent = `
      .contact-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:18px}
      .contact-card{padding:20px;border:1px solid var(--border);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018))}
      .contact-card h3{margin-bottom:8px}.contact-card a{color:#e5a77d;font-weight:900;text-decoration:none}.contact-card a:hover{text-decoration:underline}
      .site-footer{margin-top:18px;padding:22px;border:1px solid var(--border);border-radius:22px;background:linear-gradient(145deg,#171f24,#0e1519);display:flex;justify-content:space-between;gap:18px;align-items:center}
      .site-footer img{width:54px;height:54px;border-radius:14px;object-fit:cover}.site-footer-brand{display:flex;align-items:center;gap:14px}.site-footer p{margin:3px 0 0}.site-footer-links{display:flex;flex-wrap:wrap;gap:12px}.site-footer button{background:none;border:0;color:#e2a77f;font-weight:900;cursor:pointer}
      @media(max-width:850px){.contact-grid{grid-template-columns:1fr}.site-footer{align-items:flex-start;flex-direction:column}.site-footer-links{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function addContactPage() {
    const main = document.querySelector('main.main');
    if (!main || document.getElementById('contact')) return;
    const section = document.createElement('section');
    section.id = 'contact';
    section.className = 'page';
    section.innerHTML = `
      <div class="panel">
        <div class="section-title"><div><span class="pill orange">Contact</span><h2 style="margin-top:12px">Échanger avec EDM</h2><p>Utilisez les coordonnées officielles ci-dessous. Les informations non encore validées ne sont pas affichées.</p></div></div>
        <div class="contact-grid" id="edmContactGrid"></div>
        <div class="notice" style="margin-top:18px">Les demandes envoyées depuis le site restent soumises à une validation manuelle avant confirmation définitive.</div>
      </div>`;
    main.appendChild(section);
  }

  function addNavigation() {
    const nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('[data-page="contact"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.page = 'contact';
    button.textContent = '✉️ Contact';
    button.addEventListener('click', () => typeof window.showPage === 'function' && window.showPage('contact'));
    nav.appendChild(button);
  }

  function renderContact() {
    const grid = document.getElementById('edmContactGrid');
    if (!grid) return;
    const email = getSetting('business_email', getSetting('email', 'edm28.contact@gmail.com'));
    const phone = getSetting('business_phone', getSetting('phone', ''));
    const address = [getSetting('address_line1', ''), getSetting('postal_code', ''), getSetting('city', '')].filter(Boolean).join(' ');
    const cards = [
      `<article class="contact-card"><h3>Email</h3><p>Pour une question générale ou le suivi d’une demande.</p><a href="mailto:${safe(email)}">${safe(email)}</a></article>`,
      phone ? `<article class="contact-card"><h3>Téléphone</h3><p>Coordonnée téléphonique officielle.</p><a href="tel:${safe(phone.replace(/\s+/g,''))}">${safe(phone)}</a></article>` : `<article class="contact-card"><h3>Téléphone</h3><p>Le numéro officiel sera affiché dès validation.</p></article>`,
      address ? `<article class="contact-card"><h3>Adresse</h3><p>${safe(address)}</p></article>` : `<article class="contact-card"><h3>Adresse</h3><p>L’adresse professionnelle sera affichée dès validation.</p></article>`
    ];
    grid.innerHTML = cards.join('');
  }

  function addFooter() {
    const main = document.querySelector('main.main');
    if (!main || document.querySelector('.site-footer')) return;
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="site-footer-brand"><img src="/logo-edm.svg" alt="Logo EDM"><div><strong>EDM · Spécialiste du freinage</strong><p>Estimation indicative et validation humaine.</p></div></div>
      <div class="site-footer-links"><button type="button" data-footer-page="about">À propos</button><button type="button" data-footer-page="contact">Contact</button><button type="button" data-footer-page="account">Mon compte</button></div>`;
    footer.querySelectorAll('[data-footer-page]').forEach((button) => button.addEventListener('click', () => {
      if (typeof window.showPage === 'function') window.showPage(button.dataset.footerPage);
    }));
    main.appendChild(footer);
  }

  function init() {
    installStyles();
    addContactPage();
    addNavigation();
    renderContact();
    addFooter();
  }

  window.EDMRefreshPublicContact = renderContact;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('load', () => setTimeout(init, 200));
})();
