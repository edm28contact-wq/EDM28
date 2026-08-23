(() => {
  if (window.__edmInvoiceArchiveInstalled) return;
  window.__edmInvoiceArchiveInstalled = true;

  const PUBLISHED = new Set(['issued', 'partially_paid', 'paid', 'overdue']);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  let rendering = false;
  let queued = false;
  let observer = null;

  async function user() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }

  async function openPath(path) {
    if (!path) return;
    const { data, error } = await supabaseClient.storage.from('repair-documents').createSignedUrl(path, 180);
    if (error || !data?.signedUrl) throw error || new Error('Document indisponible.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  function doc(label, number, path) {
    return `<div class="edm-doc"><strong>${esc(label)}</strong><p class="small">${esc(number || 'Sans numéro')}</p>${path ? `<button class="btn btn-ghost" type="button" data-invoice-archive-doc="${esc(path)}">Ouvrir le PDF</button>` : '<span class="pill red">PDF indisponible</span>'}</div>`;
  }

  async function render() {
    const page = document.getElementById('history');
    const host = document.getElementById('edmVehicleHistory');
    if (!page?.classList.contains('active') || !host || rendering) return;
    rendering = true;
    try {
      const current = await user();
      if (!current) {
        host.innerHTML = '<div data-edm-invoice-archive><div class="empty">Connectez-vous pour consulter votre historique.</div></div>';
        return;
      }

      const [vehicles, orders, quotes, invoices, inspections] = await Promise.all([
        supabaseClient.from('vehicles').select('id,plate,brand,model,year,energy,mileage').eq('user_id', current.id).order('created_at', { ascending:false }),
        supabaseClient.from('repair_orders').select('id,vehicle_id,service_request_id,quote_id,order_number,status,visible_to_client,pdf_path,created_at').eq('user_id', current.id).order('created_at', { ascending:false }),
        supabaseClient.from('quotes').select('id,vehicle_id,service_request_id,quote_number,status,visible_to_client,pdf_path,created_at').eq('user_id', current.id),
        supabaseClient.from('invoices').select('id,vehicle_id,quote_id,repair_order_id,invoice_number,status,visible_to_client,pdf_path,issued_at,created_at').eq('user_id', current.id),
        supabaseClient.from('inspection_reports').select('id,vehicle_id,repair_order_id,report_number,status,visible_to_client,pdf_path,created_at').eq('user_id', current.id)
      ]);
      const error = [vehicles, orders, quotes, invoices, inspections].find((result) => result.error)?.error;
      if (error) throw error;

      const orderById = new Map((orders.data || []).map((row) => [row.id, row]));
      const quoteById = new Map((quotes.data || []).map((row) => [row.id, row]));
      const inspectionByOrder = new Map((inspections.data || []).filter((row) => row.repair_order_id && row.visible_to_client).map((row) => [row.repair_order_id, row]));
      const jobs = (invoices.data || [])
        .filter((invoice) => invoice.visible_to_client && invoice.pdf_path && PUBLISHED.has(invoice.status))
        .map((invoice) => {
          let order = invoice.repair_order_id ? orderById.get(invoice.repair_order_id) : null;
          if (!order && invoice.quote_id) order = (orders.data || []).find((candidate) => candidate.quote_id === invoice.quote_id) || null;
          const quote = quoteById.get(invoice.quote_id) || (order?.quote_id ? quoteById.get(order.quote_id) : null) || null;
          const vehicleId = invoice.vehicle_id || order?.vehicle_id || quote?.vehicle_id || '';
          return { invoice, order, quote, inspection: order ? inspectionByOrder.get(order.id) || null : null, vehicleId };
        })
        .filter((job) => job.vehicleId)
        .sort((a, b) => new Date(b.invoice.issued_at || b.invoice.created_at || 0) - new Date(a.invoice.issued_at || a.invoice.created_at || 0));

      const jobsByVehicle = new Map();
      jobs.forEach((job) => {
        if (!jobsByVehicle.has(job.vehicleId)) jobsByVehicle.set(job.vehicleId, []);
        jobsByVehicle.get(job.vehicleId).push(job);
      });

      const html = (vehicles.data || []).map((vehicle) => {
        const vehicleJobs = jobsByVehicle.get(vehicle.id) || [];
        if (!vehicleJobs.length) return '';
        const title = [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Véhicule';
        return `<article class="edm-history-vehicle" data-invoice-archive-vehicle="${esc(vehicle.id)}">
          <button class="edm-full-button" type="button" data-invoice-archive-vehicle-toggle="${esc(vehicle.id)}"><div class="section-title" style="margin:0"><div><span class="pill blue">${esc(vehicle.plate || 'Sans plaque')}</span><h3 style="margin-top:9px">${esc(title)}</h3><p class="small">${esc([vehicle.year, vehicle.energy, vehicle.mileage ? `${vehicle.mileage} km` : ''].filter(Boolean).join(' · '))}</p></div><strong>${vehicleJobs.length} intervention${vehicleJobs.length > 1 ? 's' : ''}</strong></div></button>
          <div class="hidden" data-invoice-archive-jobs="${esc(vehicle.id)}" style="padding:0 14px 14px">${vehicleJobs.map((job) => {
            const orderLabel = job.order?.order_number || `Intervention ${job.invoice.invoice_number || ''}`.trim();
            const orderPath = job.order?.visible_to_client ? job.order.pdf_path : null;
            return `<article class="edm-history-job" data-invoice-archive-order="${esc(job.order?.id || job.invoice.id)}" style="padding:14px;margin-top:10px"><button class="edm-full-button" type="button" data-invoice-archive-order-toggle="${esc(job.order?.id || job.invoice.id)}"><div class="section-title" style="margin:0"><div><span class="pill green">Intervention clôturée</span><h3 style="margin-top:9px">${esc(orderLabel)}</h3></div><strong>${esc(new Date(job.invoice.issued_at || job.invoice.created_at).toLocaleDateString('fr-FR'))}</strong></div></button><div class="hidden" data-invoice-archive-order-details="${esc(job.order?.id || job.invoice.id)}"><div class="edm-doc-grid">${doc('Devis', job.quote?.quote_number, job.quote?.visible_to_client ? job.quote.pdf_path : null)}${doc('Ordre de réparation', job.order?.order_number, orderPath)}${doc('Fiche de contrôle', job.inspection?.report_number, job.inspection?.pdf_path)}${doc('Facture', job.invoice.invoice_number, job.invoice.pdf_path)}</div></div></article>`;
          }).join('')}</div>
        </article>`;
      }).join('');

      host.innerHTML = `<div data-edm-invoice-archive>${html || '<div class="empty">Aucune intervention clôturée.</div>'}</div>`;

      host.querySelectorAll('[data-invoice-archive-vehicle-toggle]').forEach((button) => button.addEventListener('click', () => {
        host.querySelector(`[data-invoice-archive-jobs="${CSS.escape(button.dataset.invoiceArchiveVehicleToggle)}"]`)?.classList.toggle('hidden');
      }));
      host.querySelectorAll('[data-invoice-archive-order-toggle]').forEach((button) => button.addEventListener('click', () => {
        host.querySelector(`[data-invoice-archive-order-details="${CSS.escape(button.dataset.invoiceArchiveOrderToggle)}"]`)?.classList.toggle('hidden');
      }));
      host.querySelectorAll('[data-invoice-archive-doc]').forEach((button) => button.addEventListener('click', () => openPath(button.dataset.invoiceArchiveDoc).catch((error) => alert(error.message || 'Document indisponible.'))));

      const focus = window.__edmHistoryFocus;
      if (focus?.vehicleId) {
        host.querySelector(`[data-invoice-archive-jobs="${CSS.escape(focus.vehicleId)}"]`)?.classList.remove('hidden');
        if (focus.orderId) host.querySelector(`[data-invoice-archive-order-details="${CSS.escape(focus.orderId)}"]`)?.classList.remove('hidden');
        window.__edmHistoryFocus = null;
      }
    } finally {
      rendering = false;
    }
  }

  function queueRender() {
    if (queued) return;
    queued = true;
    window.setTimeout(() => {
      queued = false;
      render().catch((error) => console.warn('EDM invoice archive unavailable', error));
    }, 80);
  }

  function installObserver() {
    const host = document.getElementById('edmVehicleHistory');
    if (!host || observer) return;
    observer = new MutationObserver(() => {
      if (!document.getElementById('history')?.classList.contains('active')) return;
      if (!host.querySelector('[data-edm-invoice-archive]')) queueRender();
    });
    observer.observe(host, { childList:true, subtree:false });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-page="history"]')) return;
    window.setTimeout(() => { installObserver(); queueRender(); }, 60);
  });

  supabaseClient?.auth?.onAuthStateChange?.((_event, session) => {
    if (session?.user && document.getElementById('history')?.classList.contains('active')) queueRender();
  });

  const boot = () => {
    installObserver();
    if (document.getElementById('history')?.classList.contains('active')) queueRender();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
