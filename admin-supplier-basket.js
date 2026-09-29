(() => {
  const A = () => window.EDMAdmin;
  const P = () => window.EDMSupplierBasketPolicy;
  const field = (root, key) => root.querySelector(`[data-field="${key}"]`);
  const rowBasket = (quote) => Array.isArray(quote.quote_parts_baskets) ? quote.quote_parts_baskets[0] : quote.quote_parts_baskets;

  function editor(quote) {
    const saved = rowBasket(quote);
    if (quote.status !== 'draft' && !saved) return '';
    const parts = saved || { requires_parts: true };
    const locked = quote.status !== 'draft' ? ' disabled' : '';
    const esc = A().esc;
    return `<section class="card" data-supplier-basket data-basket-revision="${esc(parts.revision || '')}" style="margin:14px 0">
      <h4>Panier fournisseur et pi\u00e8ces apport\u00e9es par le client</h4>
      <p>${esc(P().terms)}</p>
      <label><input type="checkbox" data-field="requiresParts" ${parts.requires_parts ? 'checked' : ''}${locked}> Des pi\u00e8ces de remplacement sont n\u00e9cessaires</label>
      <label>Lien partageable du panier fournisseur<input type="url" data-field="supplierUrl" maxlength="2000" placeholder="https://..." value="${esc(parts.supplier_url || '')}"${locked}></label>
      <label>Pi\u00e8ces pr\u00e9conis\u00e9es : marque, r\u00e9f\u00e9rence, d\u00e9signation et quantit\u00e9<textarea data-field="recommendedParts" rows="5" maxlength="6000"${locked}>${esc(parts.recommended_parts || '')}</textarea></label>
      <label>Prix indicatifs TTC par r\u00e9f\u00e9rence<textarea data-field="priceDetails" rows="4" maxlength="6000" placeholder="R\u00e9f\u00e9rence - quantit\u00e9 - prix TTC"${locked}>${esc(parts.price_details || '')}</textarea></label>
      <label>Date du relev\u00e9 de prix<input type="date" data-field="priceObservedAt" value="${esc(parts.price_observed_at || '')}"${locked}></label>
      <p class="muted">Le lien et ces r\u00e9f\u00e9rences accompagnent le devis. Aucun montant de pi\u00e8ce n\u2019est ajout\u00e9 au total EDM28. Sans pi\u00e8ces de remplacement, d\u00e9cochez la case et laissez les deux champs vides.</p>
    </section>`;
  }

  function read(root, complete = false) {
    if (!P() || !root?.querySelector('[data-supplier-basket]')) throw new Error('Rechargez le back-office : le formulaire de panier est indisponible.');
    const parts = P().basket({
      requires_parts: field(root, 'requiresParts').checked,
      supplier_url: field(root, 'supplierUrl').value,
      recommended_parts: field(root, 'recommendedParts').value,
      price_details: field(root, 'priceDetails')?.value || '',
      price_observed_at: field(root, 'priceObservedAt')?.value || null
    }, complete);
    if (complete && parts.requires_parts && (!parts.price_details || !parts.price_observed_at)) throw new Error('Indiquez les prix TTC des pi\u00e8ces et la date du relev\u00e9 avant envoi.');
    const items = P().serviceItems([...root.querySelectorAll('[data-quote-line]')].map((line) => {
      const get = (key) => line.querySelector(`[data-line="${key}"]`)?.value;
      return { item_type: get('type'), designation: get('designation'), description: get('description'), quantity: get('quantity'), unit_price: get('unit_price'), vat_rate: get('vat_rate') };
    }));
    const quote = {
      quote_number: field(root, 'number').value.trim() || null,
      title: field(root, 'title').value.trim() || 'Devis EDM28',
      description: field(root, 'description').value.trim() || null,
      discount: Number(field(root, 'discount').value || 0),
      valid_until: field(root, 'validUntil').value || null
    };
    if (!Number.isFinite(quote.discount) || quote.discount < 0) throw new Error('Remise invalide.');
    if (complete && !quote.valid_until) throw new Error('Date de validit\u00e9 obligatoire.');
    return { parts, items, quote };
  }

  async function saveDraft(root, complete = false) {
    const payload = read(root, complete);
    const meta = root.querySelector('[data-supplier-basket]');
    const { data, error } = await A().db.rpc('admin_save_service_quote', {
      p_quote_id: root.dataset.quoteId,
      p_quote: payload.quote,
      p_items: payload.items,
      p_basket: payload.parts,
      p_expected_revision: meta.dataset.basketRevision || null
    });
    if (error) throw error;
    if (!data?.revision) throw new Error('Enregistrement du panier non confirm\u00e9.');
    meta.dataset.basketRevision = data.revision;
    field(root, 'number').value = data.quote_number;
    return data;
  }

  async function publish(button) {
    const root = button.closest('[data-quote-id]');
    if (!root) throw new Error('Devis introuvable.');
    read(root, true);
    const saved = await saveDraft(root, true);
    const complete = await A().db.from('quotes').select('*').eq('id', root.dataset.quoteId).single();
    if (complete.error) throw complete.error;
    if (!window.EDMAdminDocumentPdf?.generateFor) throw new Error('Le g\u00e9n\u00e9rateur PDF est indisponible.');
    const pdfPath = await window.EDMAdminDocumentPdf.generateFor('quote', complete.data);
    const result = await A().db.rpc('admin_publish_service_quote', {
      p_quote_id: complete.data.id,
      p_revision: saved.revision,
      p_pdf_path: pdfPath
    });
    if (result.error) throw result.error;

    let warning = '';
    try {
      const { data, error } = await A().db.auth.getSession();
      if (error || !data?.session?.access_token) throw error || new Error('Session administrateur expir\u00e9e.');
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({
          userId: complete.data.user_id, templateKey: 'quote_sent', relatedType: 'quote', relatedId: complete.data.id,
          attachmentPath: pdfPath, attachmentName: `devis-${saved.quote_number}.pdf`
        })
      });
      const outcome = await response.json().catch(() => ({}));
      if (!response.ok || outcome.success !== true) throw new Error(outcome.error || 'Envoi non confirm\u00e9.');
    } catch (error) {
      warning = `Devis et panier publi\u00e9s, mais email non envoy\u00e9 : ${error.message}. R\u00e9essayez depuis Notifications.`;
    }
    A().status('quoteStatus', warning || 'Devis PDF et informations de pi\u00e8ces envoy\u00e9s ensemble au client.', Boolean(warning));
    await window.EDMAdminQuotes?.load();
    await A().overview();
  }
  window.EDMAdminSupplierBasket = { editor, saveDraft, publish };
})();
