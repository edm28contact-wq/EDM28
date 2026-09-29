const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const vm = require('node:vm');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

(async () => {
  const source = await fs.readFile('admin-order-personalized-pdf.js', 'utf8');
  await fs.mkdir('journey-pdf-artifacts', { recursive: true });
  for (const count of [1, 18]) {
    const row = {
      id: '22222222-2222-4222-8222-222222222222', user_id: '11111111-1111-4111-8111-111111111111',
      quote_id: '44444444-4444-4444-8444-444444444444', order_number: 'EXEMPLE-OR', status: 'ready',
      profiles: { first_name: 'Client', last_name: 'Exemple', email: 'client@example.test' },
      vehicles: { plate: 'AA-123-BB', brand: 'Renault', model: 'Clio', mileage: 80000 },
      appointments: { starts_at: '2026-10-20T08:00:00Z' }, inspection_report: {},
      quotes: { commercial_model: 'customer_supplied_v1', quote_number: 'EXEMPLE-DEVIS', total: 99 * count,
        description: 'Exemple de contrôle de mise en page. Aucun document client réel.',
        quote_items: Array.from({ length: count }, (_, index) => ({ item_type: 'labor', designation: 'Prestation de freinage ' + (index + 1), description: 'Remplacement selon le devis accepté. Consommables compris, pièces apportées par le client.', quantity: 1, unit_price: 99 }))
      }
    };
    let captured;
    const app = { businessConfiguration: { business_name: 'EDM28 — DOCUMENT DE TEST', email: 'contact@example.test' }, db: {
      from(table) {
        const result = { data: table === 'repair_orders' ? row : [], error: null };
        const query = { select() { return query; }, eq() { return query; }, order() { return query; }, limit() { return query; },
          update() { result.data = [{ id: row.id }]; return query; }, maybeSingle() { return Promise.resolve(result); },
          then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
        };
        return query;
      },
      storage: { from() { return {
        async upload(path, blob) { captured = blob; return { error: null }; },
        async remove() { return { error: null }; }
      }; } }
    } };
    const module = { generateFor() { throw new Error('Expected real order generator'); } };
    vm.runInNewContext(source, { console, Blob, Uint8Array, window: { jspdf: { jsPDF }, EDMAdmin: app, EDMAdminDocumentPdf: module } });
    await module.generateFor('order', row);
    assert.ok(captured && captured.size > 2000);
    const bytes = Buffer.from(await captured.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    await fs.writeFile(`journey-pdf-artifacts/order-${count}-lines.pdf`, bytes);
  }
  console.log('Actual repair order PDFs generated; no network or business writes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
