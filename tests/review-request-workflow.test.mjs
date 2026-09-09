import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(join(root, path), 'utf8');

test('le lien avis Google est configurable mais absent par défaut', async () => {
  const migration = await read('supabase/migrations/20260909143000_add_google_review_url.sql');
  assert.match(migration, /google_review_url text/);
  assert.match(migration, /Keep null until the verified profile exists/);
});

test('le modèle demande avis est désactivé par défaut', async () => {
  const migration = await read('supabase/migrations/20260909143200_seed_review_request_template.sql');
  assert.match(migration, /'review_request'/);
  assert.match(migration, /'Demande d’avis client'/);
  assert.match(migration, /\{\{review_url\}\}/);
  assert.match(migration, /false/);
});

test('la base empêche deux demandes avis actives pour une facture', async () => {
  const migration = await read('supabase/migrations/20260909143100_dedupe_review_requests.sql');
  assert.match(migration, /create unique index/i);
  assert.match(migration, /template_key = 'review_request'/);
  assert.match(migration, /related_type = 'invoice'/);
  assert.match(migration, /status in \('pending','sent'\)/);
});

test('le serveur impose le lien configuré et refuse les doublons', async () => {
  const source = await read('lib/send-notification.js');
  assert.match(source, /google_review_url/);
  assert.match(source, /templateKey !== 'review_request'/);
  assert.match(source, /relatedType !== 'invoice'/);
  assert.match(source, /Lien d’avis Google non configuré/);
  assert.match(source, /Une demande d’avis a déjà été envoyée pour cette facture/);
  assert.match(source, /review_url: reviewUrl/);
});

test('le back-office n’active les demandes avis que si le lien et le modèle sont prêts', async () => {
  const source = await read('admin-notifications.js');
  assert.match(source, /reviewReady/);
  assert.match(source, /google_review_url/);
  assert.match(source, /reviewTemplate\.data\?\.enabled === true/);
  assert.match(source, /data-template="review_request"/);
  assert.match(source, /Avis déjà demandé/);
});
