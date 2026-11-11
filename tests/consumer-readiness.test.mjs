import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('missing identity and mediator details remain editable and are not invented',async()=>{
  const admin=await read('admin-legal.js');
  const publicSite=await read('public-seo.js');
  const schema=await read('supabase/migrations/20261109140000_legal_business_public_disclosures.sql');
  for(const field of ['legal_name','siren','siret','vat_status','insurance_name','insurance_policy','mediator_name','professional_qualification_reference']){
    assert.ok(admin.includes(field),field);
  }
  for(const field of ['siren','siret','vat_status','insurance_name']){
    assert.ok(schema.includes(field),field);
    assert.ok(publicSite.includes(field),field);
  }
  assert.match(admin,/missing=required\.filter/);
  assert.ok(admin.includes("fields.siret && !/^[0-9]{14}$/"));
  assert.match(publicSite,/business\.siret\|\|business\.siren\|\|'à compléter'/);
});

test('PDF issued to consumer embeds the versioned terms and withdrawal form',async()=>{
  const source=await read('pdf-lite.js');
  const admin=await read('admin-document-pdf.js');
  assert.match(source,/function drawConsumerTermsAnnex/);
  assert.match(source,/MODÈLE DE FORMULAIRE DE RÉTRACTATION/);
  assert.match(source,/drawConsumerTermsAnnex\(doc, cfg, row\)/);
  assert.match(admin,/import\('\/legal-pages\.js\?v=1'\)/);
  assert.match(admin,/legal_sections/);
  assert.match(admin,/legal_version/);
  assert.match(admin,/mediator_name/);
  assert.match(admin,/SIRET : /);
});

test('early commencement requires distinct choice and is recorded in signature evidence',async()=>{
  const ui=await read('quote-signature.js');
  const api=await read('api/sign-quote.js');
  const edge=await read('supabase/functions/client-sign-quote/index.ts');
  const sql=await read('supabase/migrations/20261111172500_early_execution_separate_consent.sql');
  assert.match(ui,/data-qs-early/);
  assert.match(ui,/data-qs-waiver/);
  assert.match(api,/early_start_requested:earlyStart/);
  assert.match(api,/earlyStart && !lossAcknowledged/);
  assert.match(edge,/c\.early_start_requested/);
  assert.match(edge,/c\.full_performance_acknowledged/);
  assert.match(sql,/edm28_capture_early_start_proof/);
  assert.match(sql,/BEFORE INSERT ON public\.quote_signatures/);
  assert.match(sql,/CHECK \(NOT early_start_requested OR full_performance_acknowledged\)/);
});
