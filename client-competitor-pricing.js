(() => {
  if (window.__edmCompetitorPricingInstalled) return;
  window.__edmCompetitorPricingInstalled = true;

  const ROWS = Object.freeze([
    ['Plaquettes avant', 'Roady : 54 €', '40,50 €', '40 €', '69 €'],
    ['Plaquettes arrière', 'Roady : 64 €', '48 €', '48 €', '69 €'],
    ['Plaquettes avant + arrière', 'Roady : 118 €', '88,50 €', '88 €', '130 €'],
    ['Disques + plaquettes avant', 'Roady : 89 €', '66,75 €', '66 €', '99 €'],
    ['Disques + plaquettes arrière', 'Roady : 99 €', '74,25 €', '74 €', '99 €'],
    ['Disques + plaquettes avant + arrière', 'Roady : 188 €', '141 €', '140 €', '189 €'],
    ['Purge liquide de frein', 'Roady : 69,90 € liquide inclus', '52,43 €', '52 € au total', 'Environ 63 € avec 1 L'],
    ['Triangles de suspension, la paire', 'Norauto : 139,90 €', '104,93 €', '104 €', '120 €'],
    ['Rotules de direction extérieures, la paire', 'Norauto : 109,90 €', '82,43 €', '82 €', '70 €'],
    ['Biellettes / rotules intérieures, la paire', 'Norauto : 141,90 €', '106,43 €', '106 €', '70 €'],
    ['Biellettes stabilisatrices, la paire', 'Norauto : 73,90 €', '55,43 €', '55 €', '50 €'],
    ['Véhicule sportif ou montage spécial', 'Devis concurrent comparable', '75 % du devis', 'Sur devis', 'Sur devis']
  ]);

  const escape = (value) => typeof escapeHtml === 'function'
    ? escapeHtml(value)
    : String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

  function installStyles() {
    if (document.getElementById('edm-competitor-pricing-styles')) return;
    const style = document.createElement('style');
    style.id = 'edm-competitor-pricing-styles';
    style.textContent = `
      #edmCompetitorPricing { margin:16px 0 20px; border:1px solid var(--border); border-radius:18px; overflow:hidden; background:var(--surface-2, #fff); }
      #edmCompetitorPricing .competitor-pricing-head { padding:16px; border-bottom:1px solid var(--border); }
      #edmCompetitorPricing .competitor-pricing-head h4 { margin:0 0 6px; font-size:1.05rem; }
      #edmCompetitorPricing .competitor-pricing-head p { margin:0; }
      #edmCompetitorPricing .competitor-pricing-scroll { overflow-x:auto; }
      #edmCompetitorPricing table { width:100%; min-width:980px; border-collapse:collapse; }
      #edmCompetitorPricing th,
      #edmCompetitorPricing td { padding:12px 14px; border-bottom:1px solid var(--border); text-align:left; vertical-align:top; }
      #edmCompetitorPricing th { background:var(--surface-1, #f8f8f8); color:var(--muted); font-size:.86rem; }
      #edmCompetitorPricing th:not(:first-child),
      #edmCompetitorPricing td:not(:first-child) { text-align:right; }
      #edmCompetitorPricing td:nth-child(3),
      #edmCompetitorPricing td:nth-child(4) { font-weight:900; white-space:nowrap; }
      #edmCompetitorPricing tbody tr:last-child td { border-bottom:0; }
      #edmCompetitorPricing .competitor-pricing-foot { padding:13px 16px; border-top:1px solid var(--border); color:var(--muted); font-size:.9rem; }
      @media (max-width:700px) {
        #edmCompetitorPricing .competitor-pricing-head,
        #edmCompetitorPricing .competitor-pricing-foot { padding:14px; }
      }
    `;
    document.head.appendChild(style);
  }

  function render() {
    const anchor = document.getElementById('edmLaborPricing') || document.getElementById('serviceList');
    if (!anchor) return false;

    let block = document.getElementById('edmCompetitorPricing');
    if (!block) {
      block = document.createElement('section');
      block.id = 'edmCompetitorPricing';
      block.setAttribute('aria-labelledby', 'edmCompetitorPricingTitle');
      anchor.insertAdjacentElement('beforebegin', block);
    }

    block.innerHTML = `
      <div class="competitor-pricing-head">
        <h4 id="edmCompetitorPricingTitle">Comparatif des tarifs de main-d’œuvre</h4>
        <p>Objectif EDM : appliquer environ 75 % du tarif concurrent comparable, avec un arrondi simple pour le client.</p>
      </div>
      <div class="competitor-pricing-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Prestation EDM28</th>
              <th scope="col">Tarif concurrent comparable</th>
              <th scope="col">75 % exact</th>
              <th scope="col">Tarif EDM28 arrondi conseillé</th>
              <th scope="col">Ancien tarif EDM28</th>
            </tr>
          </thead>
          <tbody>
            ${ROWS.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="competitor-pricing-foot">Comparatif indicatif établi à partir des tarifs de référence communiqués. Les offres concurrentes, les conditions de montage et les prix peuvent évoluer. Le coût final client reste confirmé après étude du véhicule et des pièces compatibles.</div>
    `;

    return true;
  }

  installStyles();
  if (render()) return;

  const observer = new MutationObserver(() => {
    if (!render()) return;
    observer.disconnect();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 12000);
})();
