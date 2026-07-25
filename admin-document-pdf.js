(() => {
  const A = () => window.EDMAdmin;
  const types = {
    quote: {
      table: 'quotes',
      fields: 'id,user_id,vehicle_id,quote_number,status,title,description,subtotal,discount,total,valid_until,created_at,pdf_path',
      statuses: ['sent', 'accepted', 'refused'],
      itemTable: 'quote_items',
      itemForeignKey: 'quote_id'
    },
    order: {
      table: 'repair_orders',
      fields: 'id,user_id,vehicle_id,appointment_id,quote_id,order_number,status,mileage_in,visible_condition,customer_items,authorized_work,created_at,pdf_path',
      statuses: ['ready', 'signed', 'in_progress', 'completed', 'invoiced']
    },
    invoice: {
      table: 'invoices',
      fields: 'id,user_id,vehicle_id,quote_id,invoice_number,status,title,description,subtotal,discount,total,amount_paid,issued_at,due_at,created_at,pdf_path',
      statuses: ['issued', 'partially_paid', 'paid', 'overdue'],
      itemTable: 'invoice_items',
      itemForeignKey: 'invoice_id'
    }
  };

  const number = (row) => row.quote_number || row.order_number || row.invoice_number || row.id;
  const typeLabel = (type) => type === 'quote' ? 'Devis' : type === 'order' ? 'Ordre de réparation' : 'Facture';

  async function maybeSingle(table, fields, id) {
    if (!id) return null;
    const result = await A().db.from(table).select(fields).eq('id', id).maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  async function loadItems(config, row) {
    if (!config.itemTable) return [];
    const result = await A().db
      .from(config.itemTable)
      .select('id,item_type,description,quantity,unit_price,display_order,part_handling_mode')
      .eq(config.itemForeignKey, row.id)
      .order('display_order');
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function context(type, row) {
    const config = types[type];
    const [business, customer, vehicle, items, appointment] = await Promise.all([
      maybeSingle('business_configuration', '*', true),
      maybeSingle('profiles', 'id,first_name,last_name,email,phone,role', row.user_id),
      maybeSingle('vehicles', 'id,plate,brand,model,year,energy,mileage', row.vehicle_id),
      loadItems(config, row),
      type === 'order' ? maybeSingle('appointments', 'id,starts_at,ends_at,status', row.appointment_id) : Promise.resolve(null)
    ]);
    return { business: business || {}, customer: customer || {}, vehicle: vehicle || {}, items, appointment: appointment || {}, document: row };
  }

  async function generate(type, row) {
    if (!window.EDMDocumentTemplates || !window.EDMPdfLite) throw new Error('Moteur de document indisponible. Actualisez la page.');
    const lines = window.EDMDocumentTemplates.build(type, await context(type, row));
    const path = `${row.user_id}/${type}/${row.id}-${Date.now()}.pdf`;
    const upload = await A().db.storage.from('repair-documents').upload(path, window.EDMPdfLite.build(lines), {
      contentType: 'application/pdf',
      upsert: false
    });
    if (upload.error) throw upload.error;

    const saved = await A().db.from(types[type].table).update({ pdf_path: path }).eq('id', row.id).select('id');
    if (saved.error || !saved.data?.length) {
      await A().db.storage.from('repair-documents').remove([path]);
      throw saved.error || new Error('Le document a changé pendant la génération.');
    }
    return path;
  }

  async function load() {
    const host = A()?.$('documentPdfList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement...</p>';
    const results = await Promise.all(Object.entries(types).map(async ([type, config]) => {
      const query = await A().db.from(config.table).select(config.fields).in('status', config.statuses).order('created_at', { ascending: false });
      if (query.error) throw query.error;
      return (query.data || []).map((row) => ({ type, row }));
    }));
    const rows = results.flat().sort((left, right) => String(right.row.created_at || '').localeCompare(String(left.row.created_at || '')));
    host.innerHTML = rows.map(({ type, row }) => `
      <article class="card" style="margin:12px 0">
        <div class="top">
          <div><span class="pill">${A().esc(typeLabel(type))}</span><h3>${A().esc(number(row))}</h3><p class="muted">${A().esc(row.status)}</p></div>
          <button class="btn primary" data-type="${type}" data-id="${row.id}">${row.pdf_path ? 'Régénérer' : 'Générer'} le PDF</button>
        </div>
      </article>`).join('') || '<p class="muted">Aucun document publiable.</p>';

    host.querySelectorAll('[data-id]').forEach((button) => {
      button.onclick = async () => {
        button.disabled = true;
        const oldText = button.textContent;
        button.textContent = 'Génération...';
        try {
          const selected = rows.find((entry) => entry.type === button.dataset.type && entry.row.id === button.dataset.id);
          await generate(selected.type, selected.row);
          A().status('documentPdfStatus', `${typeLabel(selected.type)} PDF privé généré.`);
          await load();
        } catch (error) {
          A().status('documentPdfStatus', error.message || 'Génération impossible.', true);
          button.textContent = oldText;
        } finally {
          button.disabled = false;
        }
      };
    });
  }

  function bind() {
    document.querySelector('[data-page="document-pdf"]')?.addEventListener('click', () => load().catch((error) => A().status('documentPdfStatus', error.message, true)));
    document.getElementById('documentPdfRefresh')?.addEventListener('click', () => load().catch((error) => A().status('documentPdfStatus', error.message, true)));
  }

  window.EDMAdminDocumentPdf = { load, generate };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
