(() => {
  const moneyFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const dateFormatter = new Intl.DateTimeFormat('fr-FR');
  const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

  const clean = (value) => String(value ?? '').trim();
  const money = (value) => moneyFormatter.format(Number(value || 0));
  const date = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? clean(value) : dateFormatter.format(parsed);
  };
  const dateTime = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? clean(value) : dateTimeFormatter.format(parsed);
  };
  const row = (text = '', options = {}) => ({ text: clean(text), size: options.size || 9, bold: Boolean(options.bold), gapBefore: options.gapBefore || 0 });
  const blank = (gapBefore = 4) => row('', { gapBefore });
  const heading = (text) => row(text, { size: 12, bold: true, gapBefore: 8 });
  const title = (text) => row(text, { size: 18, bold: true });
  const label = (name, value) => row(`${name} : ${clean(value) || '-'}`);

  function businessLines(business = {}) {
    const identity = clean(business.business_name || business.legal_name || 'EDM28');
    const legal = clean(business.legal_name);
    const address = [business.address_line1, business.postal_code, business.city, business.country].map(clean).filter(Boolean).join(' · ');
    const registrations = [business.siren ? `SIREN ${business.siren}` : '', business.siret ? `SIRET ${business.siret}` : '', business.vat_number ? `TVA ${business.vat_number}` : ''].filter(Boolean).join(' · ');
    const contact = [business.phone, business.email, business.website].map(clean).filter(Boolean).join(' · ');
    return [
      title(identity),
      legal && legal !== identity ? row(legal, { bold: true }) : null,
      address ? row(address) : null,
      registrations ? row(registrations) : null,
      contact ? row(contact) : null
    ].filter(Boolean);
  }

  function customerLines(customer = {}) {
    const name = clean(`${customer.first_name || ''} ${customer.last_name || ''}`) || clean(customer.email) || 'Client';
    const contact = [customer.email, customer.phone].map(clean).filter(Boolean).join(' · ');
    const address = [customer.address_line1, customer.postal_code, customer.city].map(clean).filter(Boolean).join(' · ');
    return [
      heading('CLIENT'),
      row(name, { bold: true }),
      contact ? row(contact) : null,
      address ? row(address) : null,
      customer.siren ? row(`SIREN client : ${clean(customer.siren)}`) : null
    ].filter(Boolean);
  }

  function vehicleLines(vehicle = {}, document = {}) {
    const identity = [vehicle.brand, vehicle.model, vehicle.year].map(clean).filter(Boolean).join(' ');
    const mileage = document.mileage_in ?? document.mileage ?? vehicle.mileage;
    const lines = [heading('VÉHICULE')];
    if (vehicle.plate) lines.push(label('Immatriculation', vehicle.plate));
    if (identity) lines.push(label('Véhicule', identity));
    if (vehicle.energy) lines.push(label('Énergie', vehicle.energy));
    if (vehicle.vin) lines.push(label('VIN', vehicle.vin));
    if (mileage != null && mileage !== '') lines.push(label('Kilométrage', `${Number(mileage).toLocaleString('fr-FR')} km`));
    if (lines.length === 1) lines.push(row('Non renseigné'));
    return lines;
  }

  function itemCategory(items = []) {
    const hasGoods = items.some((item) => ['part', 'delivery', 'sale'].includes(item.item_type));
    const hasServices = items.some((item) => ['labor', 'service', 'other'].includes(item.item_type));
    if (hasGoods && hasServices) return 'Livraisons de biens et prestations de services';
    if (hasGoods) return 'Livraisons de biens';
    return 'Prestations de services';
  }

  function itemLines(items = [], fallback = []) {
    const rows = [heading('DÉTAIL')];
    if (items.length) {
      rows.push(row('Désignation | Qté | Prix unitaire | Montant', { bold: true }));
      items.forEach((item, index) => {
        const quantity = Number(item.quantity || 1);
        const unitPrice = Number(item.unit_price || 0);
        const amount = quantity * unitPrice;
        const type = clean(item.item_type).toUpperCase();
        const designation = clean(item.description || item.name || `Ligne ${index + 1}`);
        rows.push(row(`${type ? `[${type}] ` : ''}${designation} | ${quantity.toLocaleString('fr-FR')} | ${money(unitPrice)} | ${money(amount)}`));
        if (item.part_handling_mode === 'customer_supplied') rows.push(row('  Pièce fournie par le client.'));
        if (item.part_handling_mode === 'strict_disbursement') rows.push(row('  Débours effectué au nom et pour le compte du client.'));
      });
    } else if (fallback.length) {
      fallback.forEach((item, index) => rows.push(row(`- ${clean(item.name || item.description || item.id || item || `Opération ${index + 1}`)}`)));
    } else {
      rows.push(row('Aucune ligne détaillée disponible.'));
    }
    return rows;
  }

  function amountLines(document = {}, business = {}) {
    const subtotal = Number(document.subtotal || 0);
    const discount = Number(document.discount || 0);
    const total = Number(document.total || Math.max(0, subtotal - discount));
    const lines = [heading('MONTANTS')];
    if (subtotal) lines.push(label('Sous-total', money(subtotal)));
    if (discount) lines.push(label('Remise', money(discount)));
    lines.push(label('Total à payer', money(total)));
    if (document.amount_paid != null) {
      const paid = Number(document.amount_paid || 0);
      lines.push(label('Déjà réglé', money(paid)));
      lines.push(label('Reste à payer', money(Math.max(0, total - paid))));
    }
    const vatStatus = clean(business.vat_status).toLowerCase();
    if (vatStatus.includes('franchise') || vatStatus.includes('non applicable') || vatStatus.includes('293')) {
      lines.push(row('TVA non applicable, art. 293 B du CGI.'));
    } else if (business.vat_status) {
      lines.push(label('Régime de TVA', business.vat_status));
    }
    return lines;
  }

  function footerLines(business = {}) {
    return [
      business.payment_terms ? label('Conditions de paiement', business.payment_terms) : null,
      business.late_penalty_text ? label('Pénalités de retard', business.late_penalty_text) : null,
      business.recovery_fee_text ? label('Indemnité de recouvrement', business.recovery_fee_text) : null,
      business.iban ? label('IBAN', business.iban) : null,
      business.bic ? label('BIC', business.bic) : null,
      business.insurance_name ? label('Assurance professionnelle', [business.insurance_name, business.insurance_policy].map(clean).filter(Boolean).join(' · ')) : null
    ].filter(Boolean);
  }

  function quoteTemplate(context) {
    const { business = {}, customer = {}, vehicle = {}, document = {}, items = [] } = context;
    return [
      ...businessLines(business),
      blank(),
      title('DEVIS'),
      label('Numéro', document.quote_number || document.number || document.id),
      label('Date', date(document.created_at || new Date())),
      label('Valable jusqu’au', date(document.valid_until)),
      ...customerLines(customer),
      ...vehicleLines(vehicle, document),
      document.title ? heading(document.title) : null,
      document.description ? row(document.description) : null,
      ...itemLines(items),
      ...amountLines(document, business),
      heading('CONDITIONS ET ACCEPTATION'),
      row('Le présent devis décrit les travaux, pièces et prestations proposés. Tout travail complémentaire fera l’objet d’un accord préalable du client.'),
      row('Bon pour accord, date et signature du client :'),
      row('Nom : ____________________  Date : ____/____/________  Signature : ____________________'),
      ...footerLines(business)
    ].filter(Boolean);
  }

  function orderTemplate(context) {
    const { business = {}, customer = {}, vehicle = {}, document = {}, items = [], appointment = {} } = context;
    const authorized = Array.isArray(document.authorized_work) ? document.authorized_work : [];
    return [
      ...businessLines(business),
      blank(),
      title('ORDRE DE RÉPARATION'),
      label('Numéro', document.order_number || document.number || document.id),
      label('Date de dépôt', dateTime(document.created_at || new Date())),
      appointment.starts_at ? label('Intervention prévue', dateTime(appointment.starts_at)) : null,
      appointment.ends_at ? label('Fin prévisionnelle / immobilisation', dateTime(appointment.ends_at)) : null,
      ...customerLines(customer),
      ...vehicleLines(vehicle, document),
      heading('ÉTAT ET OBJETS CONFIÉS'),
      label('État visible du véhicule', document.visible_condition || 'À compléter lors de la réception'),
      label('Objets / pièces laissés par le client', document.customer_items || 'Néant déclaré'),
      ...itemLines(items, authorized),
      heading('AUTORISATION DU CLIENT'),
      row('Le client autorise uniquement les travaux décrits ci-dessus. Tout travail ou coût complémentaire nécessite son accord préalable.'),
      row('Le client reconnaît avoir signalé les défauts connus et confirme les informations de kilométrage et d’état apparent.'),
      row('Client : nom, date, mention « Bon pour travaux » et signature'),
      row('Nom : ____________________  Date : ____/____/________  Signature : ____________________'),
      row('EDM28 : nom, date et signature'),
      row('Nom : ____________________  Date : ____/____/________  Signature : ____________________'),
      ...footerLines(business)
    ].filter(Boolean);
  }

  function invoiceTemplate(context) {
    const { business = {}, customer = {}, vehicle = {}, document = {}, items = [] } = context;
    return [
      ...businessLines(business),
      blank(),
      title('FACTURE'),
      label('Numéro', document.invoice_number || document.number || document.id),
      label('Date d’émission', date(document.issued_at || document.created_at || new Date())),
      label('Date d’échéance', date(document.due_at)),
      label('Nature des opérations', itemCategory(items)),
      ...customerLines(customer),
      ...vehicleLines(vehicle, document),
      document.title ? heading(document.title) : null,
      document.description ? row(document.description) : null,
      ...itemLines(items),
      ...amountLines(document, business),
      heading('RÈGLEMENT'),
      row(document.status === 'paid' ? 'Facture acquittée.' : 'Merci d’indiquer le numéro de facture lors du règlement.'),
      ...footerLines(business)
    ].filter(Boolean);
  }

  function build(type, context = {}) {
    if (type === 'quote') return quoteTemplate(context);
    if (type === 'order') return orderTemplate(context);
    if (type === 'invoice') return invoiceTemplate(context);
    throw new Error('Type de document inconnu.');
  }

  window.EDMDocumentTemplates = { build, money, date, dateTime };
})();
