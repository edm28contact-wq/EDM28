import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('quote invoice and repair order use separate complete templates', async () => {
  const [templates, generator, loader] = await Promise.all([
    read('document-templates.js'),
    read('admin-document-pdf.js'),
    read('admin-quotes.js')
  ]);

  assert.match(templates, /function quoteTemplate/);
  assert.match(templates, /function orderTemplate/);
  assert.match(templates, /function invoiceTemplate/);
  assert.match(templates, /DEVIS/);
  assert.match(templates, /ORDRE DE RÉPARATION/);
  assert.match(templates, /FACTURE/);
  assert.match(templates, /SIRET/);
  assert.match(templates, /TVA non applicable, art\. 293 B du CGI/);
  assert.match(templates, /Bon pour accord/);
  assert.match(templates, /Bon pour travaux/);
  assert.match(templates, /Date d’échéance/);
  assert.match(templates, /Pénalités de retard/);
  assert.match(templates, /Indemnité de recouvrement/);
  assert.match(templates, /Immatriculation/);
  assert.match(templates, /Kilométrage/);
  assert.match(templates, /Pièce fournie par le client/);
  assert.match(templates, /Débours effectué au nom et pour le compte du client/);

  assert.match(generator, /EDMDocumentTemplates\.build/);
  assert.match(generator, /quote_items/);
  assert.match(generator, /invoice_items/);
  assert.match(generator, /business_configuration/);
  assert.match(generator, /repair-documents/);
  assert.match(loader, /document-templates\.js\?v=1/);
});

test('automatic message assistance remains testable and human-approved', async () => {
  const [messages, api, settings, migration] = await Promise.all([
    read('admin-messages.js'),
    read('api/ai-message-draft.js'),
    read('admin-settings.js'),
    read('supabase/migrations/20260724193000_client_messaging_hardening.sql')
  ]);

  assert.match(settings, /messages_enabled/);
  assert.match(settings, /test_mode/);
  assert.match(settings, /test_recipient/);
  assert.match(messages, /Proposer avec l’IA/);
  assert.match(messages, /Envoyer après validation/);
  assert.match(messages, /Validation humaine obligatoire/);
  assert.match(api, /requiresHumanApproval:\s*true/);
  assert.match(api, /store:\s*false/);
  assert.match(migration, /approved_by = auth\.uid\(\)/);
  assert.match(migration, /status = 'published'/);
});
