(() => {
  const needsGeometry = (service) => /(train avant|liaison au sol|suspension|direction|triangle|rotule|biellette|amortisseur)/i.test(`${service?.category || ''} ${service?.name || ''}`);

  function apply() {
    document.querySelectorAll('.service-card').forEach((card) => {
      const id = card.querySelector('.service-check')?.value;
      const service = Array.isArray(window.SERVICES) ? window.SERVICES.find((item) => String(item.id) === String(id)) : null;
      if (!service) return;

      const button = card.querySelector('[data-more]');
      if (button) button.textContent = 'Informations sur ce service';

      const details = card.querySelector('.service-details');
      if (!details || details.dataset.serviceInfoReady) return;
      details.dataset.serviceInfoReady = '1';
      details.insertAdjacentHTML('afterbegin', '<strong>Informations sur la prestation</strong>');
      if (needsGeometry(service)) {
        details.insertAdjacentHTML('beforeend', '<div class="notice" style="margin-top:12px"><strong>Parallélisme nécessaire</strong><br>Après cette intervention sur la liaison au sol, un contrôle de géométrie et un parallélisme devront être réalisés.</div>');
      }
    });
  }

  document.addEventListener('click', () => setTimeout(apply, 0));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
