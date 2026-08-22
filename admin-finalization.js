(() => {
  const A = () => window.EDMAdmin;

  async function generateInvoicePdf(invoiceId) {
    if (!window.EDMAdminDocumentPdf?.generateFor) {
      throw new Error('Le générateur PDF de facture n’est pas chargé. Rechargez le back-office.');
    }
    const invoiceResult = await A().db.from('invoices')
      .select('id,user_id,vehicle_id,quote_id,repair_order_id,invoice_number,status,title,description,subtotal,discount,total,amount_paid,issued_at,due_at,pdf_path,created_at')
      .eq('id', invoiceId)
      .single();
    if (invoiceResult.error) throw invoiceResult.error;
    return window.EDMAdminDocumentPdf.generateFor('invoice', invoiceResult.data);
  }

  async function finalize(order, root) {
    const invoiceNumber = root.querySelector('[data-field="invoiceNumber"]').value.trim();
    const dueDays = Number(root.querySelector('[data-field="dueDays"]').value || 30);
    if (!invoiceNumber) throw new Error('Numéro de facture obligatoire.');
    if (!Number.isFinite(dueDays) || dueDays < 0 || dueDays > 365) throw new Error('Échéance comprise entre 0 et 365 jours.');
    if (!['ready','signed','in_progress','completed','invoiced'].includes(order.status)) throw new Error('Ordre non clôturable.');

    const finalized = await A().db.rpc('admin_finalize_repair_order', {
      p_order_id: order.id,
      p_invoice_number: invoiceNumber,
      p_due_days: dueDays
    });
    if (finalized.error) throw finalized.error;
    const invoiceId = finalized.data;
    if (!invoiceId) throw new Error('La facture a été créée sans identifiant.');

    const pdfPath = await generateInvoicePdf(invoiceId);
    if (!pdfPath) throw new Error('La facture a été créée, mais son PDF n’a pas pu être généré.');
    return { invoiceId, pdfPath };
  }

  function render(rows) {
    const host = A().$('finalizationList');
    host.innerHTML = rows.length ? rows.map((o) => `<article class="card" data-finalization-id="${o.id}" style="margin:12px 0"><div class="top"><div><span class="pill">${A().esc(o.status)}</span><h3>${A().esc(o.order_number || 'Ordre de réparation')}</h3></div><strong>${A().money(o.quotes?.total || 0)}</strong></div><p>${A().esc(o.profiles?.email || 'Client')} · ${A().esc(o.vehicles?.plate || 'Véhicule')}</p><label>Numéro de facture<input data-field="invoiceNumber" value="FAC-${A().esc((o.order_number || o.id).replace(/[^a-z0-9-]/gi, '-'))}"></label><label>Échéance (jours)<input data-field="dueDays" type="number" min="0" max="365" value="30"></label><button class="btn primary" data-finalize="${o.id}">Clôturer et créer la facture</button></article>`).join('') : '<p class="muted">Aucun ordre à facturer.</p>';
    host.querySelectorAll('[data-finalize]').forEach((button) => button.onclick = async () => {
      button.disabled = true;
      const original = button.textContent;
      button.textContent = 'Clôture et génération PDF…';
      try {
        const order = rows.find((row) => row.id === button.dataset.finalize);
        await finalize(order, button.closest('article'));
        A().status('finalizationStatus', 'Intervention clôturée. Facture brouillon créée et PDF généré automatiquement.');
        await load();
        await A().overview();
        window.EDMAdminAccounting?.load();
        window.EDMAdminInvoiceActions?.load();
      } catch (error) {
        A().status('finalizationStatus', error.message || 'Clôture impossible.', true);
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    });
  }

  async function load() {
    const host = A()?.$('finalizationList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await A().db.from('repair_orders').select('id,user_id,vehicle_id,quote_id,order_number,status,profiles(email),vehicles(plate),quotes(total)').in('status', ['ready','signed','in_progress','completed']).order('updated_at', { ascending: false });
    if (error) throw error;
    render(data || []);
  }

  function bind() {
    document.querySelector('[data-page="finalization"]')?.addEventListener('click', () => load().catch((error) => A().status('finalizationStatus', error.message || 'Facturation indisponible.', true)));
    document.getElementById('finalizationRefresh')?.addEventListener('click', () => load().catch((error) => A().status('finalizationStatus', error.message || 'Actualisation impossible.', true)));
  }

  window.EDMAdminFinalization = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();