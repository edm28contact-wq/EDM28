import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL(
  '../supabase/migrations/20260725211223_fix_public_catalog_rls.sql',
  import.meta.url
);

test('anonymous catalogue policies never evaluate the private admin predicate', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  for (const table of ['site_settings', 'site_services', 'service_options']) {
    assert.match(sql, new RegExp(`on public\\.${table}[\\s\\S]*?to anon[\\s\\S]*?using \\(`));
  }
  for (const policy of ['settings_public_select', 'services_public_select', 'options_public_select']) {
    const block = sql.match(new RegExp(`create policy ${policy}[\\s\\S]*?;`, 'i'))?.[0] || '';
    assert.ok(block, `${policy} missing`);
    assert.doesNotMatch(block, /private\.is_admin\(\)/);
  }
});

test('catalogue grants exclude anonymous writes and authenticated table ownership powers', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.doesNotMatch(sql, /grant\s+(?:insert|update|delete|all)[^;]*\bto anon\b/i);
  assert.doesNotMatch(sql, /grant\s+all[^;]*\bto authenticated\b/i);
  assert.match(sql, /grant select on table public\.site_settings to anon/);
  assert.match(sql, /grant select, insert, update, delete on table public\.site_settings to authenticated/);
});
