-- EDM28 security and performance hardening.
-- Keeps public RPC signatures stable while moving SECURITY DEFINER bodies to private schema.
-- Also optimizes RLS helper calls, removes exact duplicate policies and indexes foreign keys.

-- RLS initPlan optimizations and explicit authenticated roles.
alter policy profiles_select_own on public.profiles
  to authenticated
  using ((select auth.uid()) = id);

alter policy profiles_insert_own on public.profiles
  to authenticated
  with check ((select auth.uid()) = id);

alter policy profiles_update_own on public.profiles
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy vehicles_select_own on public.vehicles
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy vehicles_insert_own on public.vehicles
  to authenticated
  with check ((select auth.uid()) = user_id);

alter policy vehicles_update_own on public.vehicles
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy vehicles_delete_own on public.vehicles
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy service_requests_select_own on public.service_requests
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy service_requests_insert_own on public.service_requests
  to authenticated
  with check ((select auth.uid()) = user_id);

alter policy service_requests_update_own on public.service_requests
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy service_requests_delete_own on public.service_requests
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy repairs_select_own on public.repairs
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy repair_documents_select_own on public.repair_documents
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy inspection_reports_client_read on public.inspection_reports
  to authenticated
  using ((select auth.uid()) = user_id and visible_to_client = true);

alter policy admins_manage_admin_drafts on public.admin_drafts
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

alter policy admins_manage_sync_jobs on public.sync_jobs
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

alter policy delivery_capability_read on public.journey_email_deliveries
  to anon
  using (
    lease_until > now()
    and status = any (array['dispatching'::text,'sending'::text,'sent'::text,'pending'::text,'failed'::text])
    and dispatch_hash = encode(
      extensions.digest(
        coalesce(
          (
            nullif((select current_setting('request.headers', true)), '')::jsonb
            ->> 'x-edm-delivery-token'
          ),
          ''
        ),
        'sha256'
      ),
      'hex'
    )
  );

alter policy delivery_capability_ack on public.journey_email_deliveries
  to anon
  using (
    lease_until > now()
    and status = any (array['dispatching'::text,'sending'::text])
    and dispatch_hash = encode(
      extensions.digest(
        coalesce(
          (
            nullif((select current_setting('request.headers', true)), '')::jsonb
            ->> 'x-edm-delivery-token'
          ),
          ''
        ),
        'sha256'
      ),
      'hex'
    )
  )
  with check (
    lease_until > now()
    and status = any (array['sending'::text,'sent'::text,'pending'::text,'failed'::text])
    and dispatch_hash = encode(
      extensions.digest(
        coalesce(
          (
            nullif((select current_setting('request.headers', true)), '')::jsonb
            ->> 'x-edm-delivery-token'
          ),
          ''
        ),
        'sha256'
      ),
      'hex'
    )
  );

-- Exact duplicate policies from legacy migrations. Dropping only duplicates preserves access.
drop policy if exists ai_drafts_admin_all on public.ai_drafts;
drop policy if exists automation_settings_admin_all on public.automation_settings;
drop policy if exists disbursements_admin_all on public.disbursements;
drop policy if exists quote_items_admin_all on public.quote_items;
drop policy if exists quote_items_select_own on public.quote_items;
drop policy if exists repair_orders_admin_all on public.repair_orders;
drop policy if exists repair_orders_select_own on public.repair_orders;
drop policy if exists stock_movements_admin_all on public.stock_movements;

-- Cover foreign keys used by deletes, joins and ownership/history lookups.
create index if not exists idx_admin_drafts_created_by_fk on public.admin_drafts(created_by);
create index if not exists idx_admin_drafts_published_by_fk on public.admin_drafts(published_by);
create index if not exists idx_admin_drafts_rejected_by_fk on public.admin_drafts(rejected_by);
create index if not exists idx_ai_drafts_approved_by_fk on public.ai_drafts(approved_by);
create index if not exists idx_ai_drafts_service_request_id_fk on public.ai_drafts(service_request_id);
create index if not exists idx_ai_drafts_user_id_fk on public.ai_drafts(user_id);
create index if not exists idx_ai_drafts_vehicle_id_fk on public.ai_drafts(vehicle_id);
create index if not exists idx_automation_settings_updated_by_fk on public.automation_settings(updated_by);
create index if not exists idx_booking_reservations_fee_invoice_fk on public.booking_reservations(reservation_fee_invoice_id);
create index if not exists idx_booking_reservations_resolved_by_fk on public.booking_reservations(resolved_by);
create index if not exists idx_business_configuration_updated_by_fk on public.business_configuration(updated_by);
create index if not exists idx_business_profile_updated_by_fk on public.business_profile(updated_by);
create index if not exists idx_checkup_items_intervention_id_fk on public.checkup_items(intervention_id);
create index if not exists idx_client_messages_service_request_id_fk on public.client_messages(service_request_id);
create index if not exists idx_document_templates_updated_by_fk on public.document_templates(updated_by);
create index if not exists idx_intervention_checkups_repair_id_fk on public.intervention_checkups(repair_id);
create index if not exists idx_intervention_checkups_repair_order_id_fk on public.intervention_checkups(repair_order_id);
create index if not exists idx_intervention_checkups_user_id_fk on public.intervention_checkups(user_id);
create index if not exists idx_intervention_checkups_vehicle_id_fk on public.intervention_checkups(vehicle_id);
create index if not exists idx_interventions_repair_order_id_fk on public.interventions(repair_order_id);
create index if not exists idx_interventions_user_id_fk on public.interventions(user_id);
create index if not exists idx_interventions_vehicle_id_fk on public.interventions(vehicle_id);
create index if not exists idx_message_templates_updated_by_fk on public.message_templates(updated_by);
create index if not exists idx_purchases_invoice_id_fk on public.purchases(invoice_id);
create index if not exists idx_purchases_service_request_id_fk on public.purchases(service_request_id);
create index if not exists idx_repairs_service_request_id_fk on public.repairs(service_request_id);
create index if not exists idx_repairs_vehicle_id_fk on public.repairs(vehicle_id);
create index if not exists idx_service_price_history_changed_by_fk on public.service_price_history(changed_by);
create index if not exists idx_service_price_history_service_id_fk on public.service_price_history(service_id);
create index if not exists idx_site_settings_updated_by_fk on public.site_settings(updated_by);
create index if not exists idx_stock_movements_consumable_id_fk on public.stock_movements(consumable_id);
create index if not exists idx_stock_movements_created_by_fk on public.stock_movements(created_by);
create index if not exists idx_stock_movements_repair_id_fk on public.stock_movements(repair_id);
create index if not exists idx_sync_jobs_requested_by_fk on public.sync_jobs(requested_by);

-- Keep privileged implementations out of the exposed public schema.
alter function public.admin_create_quote_from_request(uuid) set schema private;
alter function public.admin_finalize_repair_order(uuid,text,integer) set schema private;
alter function public.admin_mark_conversation_read(uuid) set schema private;
alter function public.admin_prepare_quote(uuid,timestamptz,integer,text) set schema private;
alter function public.admin_reschedule_appointment(uuid,timestamptz,integer,text,text) set schema private;
alter function public.admin_reset_operational_data(text) set schema private;
alter function public.admin_reset_storage_paths() set schema private;
alter function public.admin_send_message(uuid,text,uuid,text,uuid) set schema private;
alter function public.book_quote_appointment(uuid,timestamptz) set schema private;
alter function public.client_cancel_request(uuid) set schema private;
alter function public.client_choose_disbursement(uuid,text) set schema private;
alter function public.client_delete_message(uuid) set schema private;
alter function public.client_mark_messages_read(uuid[]) set schema private;
alter function public.client_respond_quote(uuid,text) set schema private;
alter function public.client_send_message(text,uuid,text) set schema private;
alter function public.get_available_booking_slots(uuid,date,integer) set schema private;
alter function public.next_document_number(text) set schema private;

-- Public API wrappers are SECURITY INVOKER. The private functions keep all existing
-- authorization/ownership checks and are not exposed by PostgREST.
create function public.admin_create_quote_from_request(p_request_id uuid)
returns uuid
language sql security invoker set search_path=''
as $$ select private.admin_create_quote_from_request(p_request_id) $$;

create function public.admin_finalize_repair_order(
  p_order_id uuid,
  p_invoice_number text,
  p_due_days integer default 30
)
returns uuid
language sql security invoker set search_path=''
as $$ select private.admin_finalize_repair_order(p_order_id,p_invoice_number,p_due_days) $$;

create function public.admin_mark_conversation_read(p_user_id uuid)
returns integer
language sql security invoker set search_path=''
as $$ select private.admin_mark_conversation_read(p_user_id) $$;

create function public.admin_prepare_quote(
  p_quote_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_order_number text
)
returns jsonb
language sql security invoker set search_path=''
as $$ select private.admin_prepare_quote(p_quote_id,p_starts_at,p_duration_minutes,p_order_number) $$;

create function public.admin_reschedule_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_status text,
  p_notes text
)
returns jsonb
language sql security invoker set search_path=''
as $$ select private.admin_reschedule_appointment(p_appointment_id,p_starts_at,p_duration_minutes,p_status,p_notes) $$;

create function public.admin_reset_operational_data(p_confirmation text)
returns jsonb
language sql security invoker set search_path=''
as $$ select private.admin_reset_operational_data(p_confirmation) $$;

create function public.admin_reset_storage_paths()
returns text[]
language sql security invoker set search_path=''
as $$ select private.admin_reset_storage_paths() $$;

create function public.admin_send_message(
  p_user_id uuid,
  p_body text,
  p_service_request_id uuid default null,
  p_subject text default null,
  p_ai_draft_id uuid default null
)
returns uuid
language sql security invoker set search_path=''
as $$ select private.admin_send_message(p_user_id,p_body,p_service_request_id,p_subject,p_ai_draft_id) $$;

create function public.book_quote_appointment(p_quote_id uuid,p_starts_at timestamptz)
returns uuid
language sql security invoker set search_path=''
as $$ select private.book_quote_appointment(p_quote_id,p_starts_at) $$;

create function public.client_cancel_request(p_service_request_id uuid)
returns jsonb
language sql security invoker set search_path=''
as $$ select private.client_cancel_request(p_service_request_id) $$;

create function public.client_choose_disbursement(p_disbursement_id uuid,p_choice text)
returns jsonb
language sql security invoker set search_path=''
as $$ select private.client_choose_disbursement(p_disbursement_id,p_choice) $$;

create function public.client_delete_message(p_message_id uuid)
returns boolean
language sql security invoker set search_path=''
as $$ select private.client_delete_message(p_message_id) $$;

create function public.client_mark_messages_read(p_message_ids uuid[])
returns integer
language sql security invoker set search_path=''
as $$ select private.client_mark_messages_read(p_message_ids) $$;

create function public.client_respond_quote(p_quote_id uuid,p_response text)
returns text
language sql security invoker set search_path=''
as $$ select private.client_respond_quote(p_quote_id,p_response) $$;

create function public.client_send_message(
  p_body text,
  p_service_request_id uuid default null,
  p_subject text default null
)
returns uuid
language sql security invoker set search_path=''
as $$ select private.client_send_message(p_body,p_service_request_id,p_subject) $$;

create function public.get_available_booking_slots(
  p_quote_id uuid,
  p_from date default current_date,
  p_days integer default 21
)
returns table(starts_at timestamptz,ends_at timestamptz)
language sql security invoker set search_path=''
as $$ select * from private.get_available_booking_slots(p_quote_id,p_from,p_days) $$;

create function public.next_document_number(p_type text)
returns text
language sql security invoker set search_path=''
as $$ select private.next_document_number(p_type) $$;

-- Public wrappers are available to signed-in users only; private implementations are
-- executable by authenticated/service_role but remain outside the exposed API schema.
revoke all on function public.admin_create_quote_from_request(uuid) from public, anon;
revoke all on function public.admin_finalize_repair_order(uuid,text,integer) from public, anon;
revoke all on function public.admin_mark_conversation_read(uuid) from public, anon;
revoke all on function public.admin_prepare_quote(uuid,timestamptz,integer,text) from public, anon;
revoke all on function public.admin_reschedule_appointment(uuid,timestamptz,integer,text,text) from public, anon;
revoke all on function public.admin_reset_operational_data(text) from public, anon;
revoke all on function public.admin_reset_storage_paths() from public, anon;
revoke all on function public.admin_send_message(uuid,text,uuid,text,uuid) from public, anon;
revoke all on function public.book_quote_appointment(uuid,timestamptz) from public, anon;
revoke all on function public.client_cancel_request(uuid) from public, anon;
revoke all on function public.client_choose_disbursement(uuid,text) from public, anon;
revoke all on function public.client_delete_message(uuid) from public, anon;
revoke all on function public.client_mark_messages_read(uuid[]) from public, anon;
revoke all on function public.client_respond_quote(uuid,text) from public, anon;
revoke all on function public.client_send_message(text,uuid,text) from public, anon;
revoke all on function public.get_available_booking_slots(uuid,date,integer) from public, anon;
revoke all on function public.next_document_number(text) from public, anon;

grant execute on function public.admin_create_quote_from_request(uuid) to authenticated, service_role;
grant execute on function public.admin_finalize_repair_order(uuid,text,integer) to authenticated, service_role;
grant execute on function public.admin_mark_conversation_read(uuid) to authenticated, service_role;
grant execute on function public.admin_prepare_quote(uuid,timestamptz,integer,text) to authenticated, service_role;
grant execute on function public.admin_reschedule_appointment(uuid,timestamptz,integer,text,text) to authenticated, service_role;
grant execute on function public.admin_reset_operational_data(text) to authenticated, service_role;
grant execute on function public.admin_reset_storage_paths() to authenticated, service_role;
grant execute on function public.admin_send_message(uuid,text,uuid,text,uuid) to authenticated, service_role;
grant execute on function public.book_quote_appointment(uuid,timestamptz) to authenticated, service_role;
grant execute on function public.client_cancel_request(uuid) to authenticated, service_role;
grant execute on function public.client_choose_disbursement(uuid,text) to authenticated, service_role;
grant execute on function public.client_delete_message(uuid) to authenticated, service_role;
grant execute on function public.client_mark_messages_read(uuid[]) to authenticated, service_role;
grant execute on function public.client_respond_quote(uuid,text) to authenticated, service_role;
grant execute on function public.client_send_message(text,uuid,text) to authenticated, service_role;
grant execute on function public.get_available_booking_slots(uuid,date,integer) to authenticated, service_role;
grant execute on function public.next_document_number(text) to authenticated, service_role;

revoke all on function private.admin_create_quote_from_request(uuid) from public, anon;
revoke all on function private.admin_finalize_repair_order(uuid,text,integer) from public, anon;
revoke all on function private.admin_mark_conversation_read(uuid) from public, anon;
revoke all on function private.admin_prepare_quote(uuid,timestamptz,integer,text) from public, anon;
revoke all on function private.admin_reschedule_appointment(uuid,timestamptz,integer,text,text) from public, anon;
revoke all on function private.admin_reset_operational_data(text) from public, anon;
revoke all on function private.admin_reset_storage_paths() from public, anon;
revoke all on function private.admin_send_message(uuid,text,uuid,text,uuid) from public, anon;
revoke all on function private.book_quote_appointment(uuid,timestamptz) from public, anon;
revoke all on function private.client_cancel_request(uuid) from public, anon;
revoke all on function private.client_choose_disbursement(uuid,text) from public, anon;
revoke all on function private.client_delete_message(uuid) from public, anon;
revoke all on function private.client_mark_messages_read(uuid[]) from public, anon;
revoke all on function private.client_respond_quote(uuid,text) from public, anon;
revoke all on function private.client_send_message(text,uuid,text) from public, anon;
revoke all on function private.get_available_booking_slots(uuid,date,integer) from public, anon;
revoke all on function private.next_document_number(text) from public, anon;

grant execute on function private.admin_create_quote_from_request(uuid) to authenticated, service_role;
grant execute on function private.admin_finalize_repair_order(uuid,text,integer) to authenticated, service_role;
grant execute on function private.admin_mark_conversation_read(uuid) to authenticated, service_role;
grant execute on function private.admin_prepare_quote(uuid,timestamptz,integer,text) to authenticated, service_role;
grant execute on function private.admin_reschedule_appointment(uuid,timestamptz,integer,text,text) to authenticated, service_role;
grant execute on function private.admin_reset_operational_data(text) to authenticated, service_role;
grant execute on function private.admin_reset_storage_paths() to authenticated, service_role;
grant execute on function private.admin_send_message(uuid,text,uuid,text,uuid) to authenticated, service_role;
grant execute on function private.book_quote_appointment(uuid,timestamptz) to authenticated, service_role;
grant execute on function private.client_cancel_request(uuid) to authenticated, service_role;
grant execute on function private.client_choose_disbursement(uuid,text) to authenticated, service_role;
grant execute on function private.client_delete_message(uuid) to authenticated, service_role;
grant execute on function private.client_mark_messages_read(uuid[]) to authenticated, service_role;
grant execute on function private.client_respond_quote(uuid,text) to authenticated, service_role;
grant execute on function private.client_send_message(text,uuid,text) to authenticated, service_role;
grant execute on function private.get_available_booking_slots(uuid,date,integer) to authenticated, service_role;
grant execute on function private.next_document_number(text) to authenticated, service_role;

notify pgrst, 'reload schema';
