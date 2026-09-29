(function (root) {
  const terms = 'Tarifs par prestation, consommables d\u2019atelier inclus, hors pi\u00e8ces de remplacement. Le client ach\u00e8te les pi\u00e8ces directement au fournisseur et les apporte au rendez-vous.';
  const partsAdvice = 'Apportez les r\u00e9f\u00e9rences pr\u00e9conis\u00e9es dans ce devis. Toute autre r\u00e9f\u00e9rence doit \u00eatre valid\u00e9e par EDM28 avant le rendez-vous. Une incompatibilit\u00e9 peut emp\u00eacher ou interrompre l\u2019intervention ; son origine est examin\u00e9e avec le client.';
  function safeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 2000 || /[\u0000-\u0020\u007f\\]/.test(raw)) throw new Error('Lien de panier invalide.');
    let url;
    try { url = new URL(raw); } catch (_) { throw new Error('Lien de panier invalide.'); }
    if (url.protocol !== 'https:' || url.port || url.username || url.password || !url.hostname.includes('.') || url.hostname.endsWith('.local') || url.hostname === '127.0.0.1') {
      throw new Error('Utilisez le lien HTTPS partageable du panier fournisseur, sans identifiants de connexion.');
    }
    return url.href;
  }
  function basket(value, complete = false) {
    if (!value || typeof value.requires_parts !== 'boolean') throw new Error('Pr\u00e9cisez si des pi\u00e8ces sont n\u00e9cessaires.');
    const references = String(value.recommended_parts || '').trim();
    const rawUrl = String(value.supplier_url || '').trim();
    const prices = String(value.price_details || '').trim();
    const observed = value.price_observed_at || null;
    if (prices.length > 6000 || (observed && (!/^\d{4}-\d{2}-\d{2}$/.test(observed) || !Number.isFinite(Date.parse(observed))))) throw new Error('Prix indicatifs ou date invalides.');
    if (references.length > 6000) throw new Error('La liste des pi\u00e8ces est trop longue (6000 caract\u00e8res maximum).');
    if (!value.requires_parts) {
      if (rawUrl || references || prices || observed) throw new Error('Retirez les pi\u00e8ces et le panier si la prestation ne n\u00e9cessite pas de pi\u00e8ces de remplacement.');
      return { requires_parts: false, supplier_url: null, recommended_parts: '' };
    }
    const supplierUrl = rawUrl ? safeUrl(rawUrl) : null;
    if (complete && (!supplierUrl || !references)) throw new Error('Ajoutez le lien du panier et les r\u00e9f\u00e9rences des pi\u00e8ces avant publication.');
    return { requires_parts: true, supplier_url: supplierUrl, recommended_parts: references, ...(prices || observed ? { price_details: prices, price_observed_at: observed } : {}) };
  }
  function serviceItems(values) {
    if (!Array.isArray(values) || !values.length || values.length > 100) throw new Error('Pr\u00e9voyez de 1 \u00e0 100 lignes de prestation.');
    return values.map((item, index) => {
      if (!['labor', 'other'].includes(item.item_type)) throw new Error('Le devis EDM28 facture les prestations, pas les pi\u00e8ces du panier fournisseur.');
      const designation = String(item.designation || item.description || '').trim();
      const description = String(item.description || designation).trim();
      const quantity = Number(item.quantity), unitPrice = Number(item.unit_price), vatRate = Number(item.vat_rate || 0);
      if (!designation || designation.length > 300 || description.length > 1200) throw new Error('D\u00e9signation ou description de prestation invalide.');
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000 || Math.round(quantity * 100) / 100 !== quantity) throw new Error('Quantit\u00e9 invalide.');
      if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1000000 || Math.round(unitPrice * 100) / 100 !== unitPrice) throw new Error('Prix de prestation invalide.');
      if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) throw new Error('Taux de TVA invalide.');
      return { item_type: item.item_type, designation, description, quantity, unit_price: unitPrice, vat_rate: vatRate, purchase_total: 0, purchase_mode: 'customer_supplied', display_order: index };
    });
  }
  function defaultItems(quote) {
    const request = quote.service_requests || {};
    const services = Array.isArray(request.services) ? request.services : [];
    if (services.length) return services.map((service, index) => ({
      item_type: 'labor', designation: service.name || 'Prestation \u00e0 pr\u00e9ciser',
      description: 'Forfait de prestation - consommables d\u2019atelier inclus, hors pi\u00e8ces.',
      quantity: 1, unit_price: Number(service.labor ?? service.labor_price ?? service.displayed_price ?? 0),
      vat_rate: 0, purchase_total: 0, display_order: index
    }));
    return [{ item_type: 'labor', designation: 'Prestation \u00e0 pr\u00e9ciser', description: 'Consommables d\u2019atelier inclus, hors pi\u00e8ces.', quantity: 1, unit_price: 0, vat_rate: 0, purchase_total: 0 }];
  }
  function quoteMessage({ quote, basket: value, clientName, businessName = 'EDM28' }) {
    const parts = basket(value, true);
    const total = Number(quote.total).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    return [
      `Bonjour ${clientName || 'Client'},`, '',
      `Votre devis ${quote.quote_number || 'EDM28'} est joint \u00e0 cet email.`,
      `Montant des prestations \u00e0 r\u00e9gler \u00e0 EDM28 : ${total}. Validit\u00e9 : ${quote.valid_until || ''}.`, terms, '',
      ...(parts.requires_parts ? ['Votre panier fournisseur pr\u00e9par\u00e9 par EDM28 :', parts.supplier_url, '', 'Pi\u00e8ces pr\u00e9conis\u00e9es :', parts.recommended_parts, '', ...(parts.price_details ? ['Prix indicatifs TTC' + (parts.price_observed_at ? ' relev\u00e9s le ' + parts.price_observed_at : '') + ' :', parts.price_details, 'Vous pouvez acheter ces m\u00eames r\u00e9f\u00e9rences ailleurs. Le prix et la livraison d\u00e9pendent du vendeur.', ''] : []), partsAdvice] : ['Cette prestation ne pr\u00e9voit pas de pi\u00e8ces de remplacement \u00e0 acheter.']),
      '', 'Consultez le PDF, puis acceptez ou refusez le devis dans votre espace client : https://edm28.fr/mes-interventions' + (quote.id ? '?devis=' + encodeURIComponent(quote.id) : ''),
      '', 'Cordialement,', businessName
    ].join('\n');
  }
  const api = { terms, partsAdvice, safeUrl, basket, serviceItems, defaultItems, quoteMessage };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EDMSupplierBasketPolicy = api;
})(globalThis);
