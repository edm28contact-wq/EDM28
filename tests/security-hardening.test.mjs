import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/20261007230000_security_performance_hardening.sql', import.meta.url), 'utf8');

test('public sensitive RPCs are invoker wrappers over private implementations', () => {
  for (const name of [
    'admin_create_quote_from_request','admin_finalize_repair_order','admin_mark_conversation_read',
    'admin_prepare_quote','admin_reschedule_appointment','admin_reset_operational_data',
    'admin_reset_storage_paths','admin_send_message','book_quote_appointment',
    'client_cancel_request','client_choose_disbursement','client_delete_message',
    'client_mark_messages_read','client_respond_quote','client_send_message',
    'get_available_booking_slots','next_document_number'
  ]) {
    assert.match(migration, new RegExp(`alter function public\\.${name}\\(`));
    assert.match(migration, new RegExp(`create function public\\.${name}\\(`));
    const wrapper = migration.slice(migration.indexOf(`create function public.${name}(`));
    assert.match(wrapper.slice(0, 900), /security invoker/);
    assert.match(wrapper.slice(0, 900), new RegExp(`private\\.${name}\\(`));
  }
  assert.doesNotMatch(migration, /create function public\.[\s\S]{0,500}security definer/i);
});

test('RLS policies use initPlan-friendly auth lookups and authenticated roles', () => {
  for (const table of ['profiles','vehicles','service_requests']) {
    assert.match(migration, new RegExp(`alter policy [\\s\\S]*? on public\\.${table}[\\s\\S]*?to authenticated`));
  }
  assert.match(migration, /\(select auth\.uid\(\)\)/);
  assert.match(migration, /\(select current_setting\('request\.headers', true\)\)/);
});

test('duplicate RLS policies are removed without dropping tables or historical rows', () => {
  for (const policy of [
    'ai_drafts_admin_all','automation_settings_admin_all','disbursements_admin_all',
    'quote_items_admin_all','quote_items_select_own','repair_orders_admin_all',
    'repair_orders_select_own','stock_movements_admin_all'
  ]) assert.match(migration, new RegExp(`drop policy if exists ${policy}`));
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
});

test('new reservation audit foreign keys and active EDM28 foreign keys are indexed', () => {
  assert.match(migration, /idx_booking_reservations_fee_invoice_fk/);
  assert.match(migration, /idx_booking_reservations_resolved_by_fk/);
  assert.match(migration, /idx_interventions_repair_order_id_fk/);
  assert.match(migration, /idx_client_messages_service_request_id_fk/);
});
