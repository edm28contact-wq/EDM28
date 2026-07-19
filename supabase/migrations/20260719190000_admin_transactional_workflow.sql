begin;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

create or replace function private.sync_invoice_payment_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid;
  paid numeric;
  total_due numeric;
begin
  target := coalesce(new.invoice_id, old.invoice_id);

  select coalesce(sum(amount), 0)
  into paid
  from public.payments
  where invoice_id = target;

  select total
  into total_due
  from public.invoices
  where id = target
  for update;

  update public.invoices
  set amount_paid = paid,
      status = case
        when paid <= 0 then case when status = 'partially_paid' then 'issued' else status end
        when paid < total_due then 'partially_paid'
        else 'paid'
      end,
      paid_at = case
        when paid >= total_due and total_due > 0 then timezone('utc', now())
        else null
      end,
      updated_at = timezone('utc', now())
  where id = target;

  return coalesce(new, old);
end;
$$;

revoke all on function private.sync_invoice_payment_totals() from public, anon, authenticated;
grant execute on function private.sync_invoice_payment_totals() to service_role;

drop trigger if exists sync_invoice_payment_totals on public.payments;
create trigger sync_invoice_payment_totals
after insert or update or delete on public.payments
for each row execute function private.sync_invoice_payment_totals();

create or replace function public.admin_create_quote_from_request(p_request_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.service_requests%rowtype;
  v_quote_id uuid;
  v_min numeric := 0;
  v_max numeric := 0;
  v_discount numeric := 0;
  v_description text := '';
begin
  if not private.is_admin() then
    raise exception 'Acces administrateur requis.' using errcode = '42501';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Demande introuvable.';
  end if;

  select id into v_quote_id
  from public.quotes
  where service_request_id = p_request_id
  order by created_at
  limit 1;

  if v_request.status = 'quoted' and v_quote_id is not null then
    return v_quote_id;
  end if;

  if v_request.status <> 'reviewed' then
    raise exception 'La demande doit etre etudiee avant creation du devis.';
  end if;

  if v_quote_id is null then
    v_min := coalesce(
      nullif(v_request.totals ->> 'totalAllMin', '')::numeric,
      nullif(v_request.totals ->> 'laborAfter', '')::numeric,
      0
    );
    v_max := coalesce(nullif(v_request.totals ->> 'totalAllMax', '')::numeric, v_min);
    v_discount := coalesce(nullif(v_request.totals ->> 'comboSaving', '')::numeric, 0);

    select coalesce(string_agg(coalesce(item ->> 'name', item ->> 'id', 'Prestation'), ', '), '')
    into v_description
    from jsonb_array_elements(coalesce(v_request.services, '[]'::jsonb)) as item;

    insert into public.quotes (
      user_id,
      vehicle_id,
      service_request_id,
      external_quote_id,
      status,
      title,
      description,
      subtotal,
      discount,
      total,
      visible_to_client
    ) values (
      v_request.user_id,
      v_request.vehicle_id,
      v_request.id,
      'request/' || v_request.id::text,
      'draft',
      'Devis EDM AUTO',
      v_description || case
        when nullif(v_request.notes, '') is not null then E'\nNotes client : ' || v_request.notes
        else ''
      end,
      v_max + v_discount,
      v_discount,
      v_max,
      false
    )
    returning id into v_quote_id;
  end if;

  update public.service_requests
  set status = 'quoted',
      updated_at = timezone('utc', now())
  where id = v_request.id
    and status = 'reviewed';

  if not found then
    raise exception 'Le statut de la demande a change.';
  end if;

  return v_quote_id;
end;
$$;

create or replace function public.admin_prepare_quote(
  p_quote_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_order_number text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quote public.quotes%rowtype;
  v_appointment_id uuid;
  v_order_id uuid;
  v_authorized_work jsonb := '[]'::jsonb;
  v_external_id text;
begin
  if not private.is_admin() then
    raise exception 'Acces administrateur requis.' using errcode = '42501';
  end if;
  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'Une date future est obligatoire.';
  end if;
  if p_duration_minutes is null or p_duration_minutes < 15 or p_duration_minutes > 480 then
    raise exception 'Duree comprise entre 15 et 480 minutes.';
  end if;
  if nullif(btrim(p_order_number), '') is null then
    raise exception 'Numero ordre obligatoire.';
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'Devis introuvable.';
  end if;
  if v_quote.status <> 'accepted' then
    raise exception 'Le devis doit etre accepte.';
  end if;

  v_external_id := 'quote/' || v_quote.id::text;

  select id into v_appointment_id
  from public.appointments
  where external_appointment_id = v_external_id
  limit 1;

  if v_appointment_id is null then
    insert into public.appointments (
      user_id,
      vehicle_id,
      service_request_id,
      external_appointment_id,
      starts_at,
      ends_at,
      status,
      notes,
      visible_to_client
    ) values (
      v_quote.user_id,
      v_quote.vehicle_id,
      v_quote.service_request_id,
      v_external_id,
      p_starts_at,
      p_starts_at + make_interval(mins => p_duration_minutes),
      'confirmed',
      'Intervention liee au devis ' || coalesce(v_quote.quote_number, v_quote.id::text),
      true
    )
    returning id into v_appointment_id;
  end if;

  select id into v_order_id
  from public.repair_orders
  where quote_id = v_quote.id
  order by created_at
  limit 1;

  if v_order_id is null then
    select coalesce(services, '[]'::jsonb)
    into v_authorized_work
    from public.service_requests
    where id = v_quote.service_request_id;

    insert into public.repair_orders (
      user_id,
      vehicle_id,
      service_request_id,
      quote_id,
      appointment_id,
      order_number,
      status,
      authorized_work,
      visible_to_client
    ) values (
      v_quote.user_id,
      v_quote.vehicle_id,
      v_quote.service_request_id,
      v_quote.id,
      v_appointment_id,
      btrim(p_order_number),
      'ready',
      coalesce(v_authorized_work, '[]'::jsonb),
      true
    )
    returning id into v_order_id;
  end if;

  return jsonb_build_object(
    'appointment_id', v_appointment_id,
    'repair_order_id', v_order_id
  );
end;
$$;

create or replace function public.admin_finalize_repair_order(
  p_order_id uuid,
  p_invoice_number text,
  p_due_days integer default 30
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.repair_orders%rowtype;
  v_quote public.quotes%rowtype;
  v_invoice_id uuid;
  v_item_count integer := 0;
begin
  if not private.is_admin() then
    raise exception 'Acces administrateur requis.' using errcode = '42501';
  end if;
  if nullif(btrim(p_invoice_number), '') is null then
    raise exception 'Numero de facture obligatoire.';
  end if;
  if p_due_days is null or p_due_days < 0 or p_due_days > 365 then
    raise exception 'Echeance comprise entre 0 et 365 jours.';
  end if;

  select * into v_order
  from public.repair_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Ordre de reparation introuvable.';
  end if;
  if v_order.status not in ('ready', 'signed', 'in_progress', 'completed', 'invoiced') then
    raise exception 'Ordre non cloturable.';
  end if;

  select * into v_quote
  from public.quotes
  where id = v_order.quote_id;

  if not found then
    raise exception 'Devis associe introuvable.';
  end if;

  select id into v_invoice_id
  from public.invoices
  where external_invoice_id = 'repair-order/' || v_order.id::text
  limit 1;

  if v_order.status = 'invoiced' and v_invoice_id is not null then
    return v_invoice_id;
  end if;

  if v_order.status <> 'completed' then
    update public.repair_orders
    set status = 'completed',
        updated_at = timezone('utc', now())
    where id = v_order.id;
  end if;

  if v_invoice_id is null then
    insert into public.invoices (
      user_id,
      vehicle_id,
      quote_id,
      external_invoice_id,
      invoice_number,
      status,
      title,
      description,
      subtotal,
      discount,
      total,
      issued_at,
      due_at,
      visible_to_client
    ) values (
      v_order.user_id,
      v_order.vehicle_id,
      v_order.quote_id,
      'repair-order/' || v_order.id::text,
      btrim(p_invoice_number),
      'draft',
      coalesce(v_quote.title, 'Facture EDM AUTO'),
      v_quote.description,
      coalesce(v_quote.subtotal, 0),
      coalesce(v_quote.discount, 0),
      coalesce(v_quote.total, 0),
      now(),
      now() + make_interval(days => p_due_days),
      false
    )
    returning id into v_invoice_id;
  end if;

  select count(*) into v_item_count
  from public.invoice_items
  where invoice_id = v_invoice_id;

  if v_item_count = 0 then
    insert into public.invoice_items (
      invoice_id,
      item_type,
      description,
      quantity,
      unit_price,
      source_quote_item_id,
      display_order
    )
    select
      v_invoice_id,
      case
        when qi.item_type in ('labor', 'part', 'delivery', 'discount', 'disbursement', 'other') then qi.item_type
        else 'other'
      end,
      qi.description,
      coalesce(qi.quantity, 1),
      coalesce(qi.unit_price, 0),
      qi.id,
      coalesce(qi.display_order, 0)
    from public.quote_items qi
    where qi.quote_id = v_order.quote_id
    order by qi.display_order;

    get diagnostics v_item_count = row_count;

    if v_item_count = 0 then
      insert into public.invoice_items (
        invoice_id,
        item_type,
        description,
        quantity,
        unit_price,
        display_order
      ) values (
        v_invoice_id,
        'labor',
        'Prestations selon devis accepte',
        1,
        coalesce(v_quote.total, 0),
        0
      );
    end if;
  end if;

  update public.repair_orders
  set status = 'invoiced',
      updated_at = timezone('utc', now())
  where id = v_order.id
    and status = 'completed';

  if not found then
    raise exception 'Le statut atelier a change.';
  end if;

  return v_invoice_id;
end;
$$;

create or replace function public.admin_record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_payment_id uuid;
  v_balance numeric;
begin
  if not private.is_admin() then
    raise exception 'Acces administrateur requis.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant de paiement invalide.';
  end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Facture introuvable.';
  end if;
  if v_invoice.status not in ('issued', 'partially_paid') then
    raise exception 'Facture non encaissable.';
  end if;

  v_balance := greatest(0, coalesce(v_invoice.total, 0) - coalesce(v_invoice.amount_paid, 0));
  if p_amount > v_balance then
    raise exception 'Montant superieur au solde.';
  end if;

  insert into public.payments (
    invoice_id,
    user_id,
    amount,
    payment_method,
    reference
  ) values (
    v_invoice.id,
    v_invoice.user_id,
    p_amount,
    nullif(btrim(p_payment_method), ''),
    nullif(btrim(p_reference), '')
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all on function public.admin_create_quote_from_request(uuid) from public, anon;
revoke all on function public.admin_prepare_quote(uuid, timestamptz, integer, text) from public, anon;
revoke all on function public.admin_finalize_repair_order(uuid, text, integer) from public, anon;
revoke all on function public.admin_record_payment(uuid, numeric, text, text) from public, anon;

grant execute on function public.admin_create_quote_from_request(uuid) to authenticated, service_role;
grant execute on function public.admin_prepare_quote(uuid, timestamptz, integer, text) to authenticated, service_role;
grant execute on function public.admin_finalize_repair_order(uuid, text, integer) to authenticated, service_role;
grant execute on function public.admin_record_payment(uuid, numeric, text, text) to authenticated, service_role;

commit;
