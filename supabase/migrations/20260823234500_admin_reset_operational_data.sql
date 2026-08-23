begin;

create or replace function public.admin_reset_storage_paths()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paths text[];
begin
  if not private.is_admin() then
    raise exception 'Acces administrateur requis.' using errcode = '42501';
  end if;

  select coalesce(array_agg(object.name order by object.name), array[]::text[])
    into v_paths
  from storage.objects object
  where object.bucket_id = 'repair-documents';

  return v_paths;
end;
$$;

revoke all on function public.admin_reset_storage_paths() from public, anon;
grant execute on function public.admin_reset_storage_paths() to authenticated;

create or replace function public.admin_reset_operational_data(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_ids uuid[] := array[]::uuid[];
  v_deleted_auth_users integer := 0;
  v_deleted_profiles integer := 0;
begin
  if not private.is_admin() then
    raise exception 'Acces administrateur requis.' using errcode = '42501';
  end if;

  if btrim(coalesce(p_confirmation, '')) <> 'REINITIALISER EDM28' then
    raise exception 'Confirmation de reinitialisation invalide.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('edm28-admin-operational-reset'));

  select coalesce(array_agg(profile.id), array[]::uuid[])
    into v_customer_ids
  from public.profiles profile
  where coalesce(profile.role, 'customer') <> 'admin';

  delete from public.client_messages;
  delete from public.ai_drafts;
  delete from public.client_documents;
  delete from public.outbound_notifications;
  delete from public.admin_drafts;
  delete from public.sync_jobs;

  delete from public.checkup_items;
  delete from public.intervention_checkups;
  delete from public.inspection_reports;
  delete from public.interventions;

  delete from public.payments;
  delete from public.invoice_items;
  delete from public.disbursements;
  delete from public.purchases;

  delete from public.repair_documents;
  delete from public.stock_movements;
  delete from public.invoices;
  delete from public.repair_orders;
  delete from public.repairs;
  delete from public.appointments;
  delete from public.quote_items;
  delete from public.quotes;
  delete from public.service_requests;
  delete from public.vehicles;

  delete from public.audit_log;
  delete from public.document_sequences;

  if cardinality(v_customer_ids) > 0 then
    delete from public.profiles profile
    where profile.id = any(v_customer_ids);
    get diagnostics v_deleted_profiles = row_count;

    delete from auth.users auth_user
    where auth_user.id = any(v_customer_ids);
    get diagnostics v_deleted_auth_users = row_count;
  end if;

  return jsonb_build_object(
    'deleted_profiles', v_deleted_profiles,
    'deleted_auth_users', v_deleted_auth_users,
    'document_sequences_reset', true,
    'admins_preserved', (select count(*) from public.profiles profile where profile.role = 'admin')
  );
end;
$$;

revoke all on function public.admin_reset_operational_data(text) from public, anon;
grant execute on function public.admin_reset_operational_data(text) to authenticated;

commit;
