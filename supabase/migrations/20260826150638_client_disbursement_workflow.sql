-- EDM28 client disbursement workflow.
-- A disbursement is kept separate from ordinary resale: prior mandate,
-- purchase for the customer's account, exact documented reimbursement and no margin.

alter table public.disbursements alter column amount drop not null;
alter table public.disbursements alter column supplier drop not null;

alter table public.disbursements
  add column if not exists quote_item_id uuid references public.quote_items(id) on delete set null,
  add column if not exists authorized_limit numeric,
  add column if not exists requested_limit numeric,
  add column if not exists client_choice text not null default 'pending',
  add column if not exists mandate_text text,
  add column if not exists mandate_version text,
  add column if not exists mandate_accepted_at timestamptz,
  add column if not exists mandate_history jsonb not null default '[]'::jsonb,
  add column if not exists purchase_recorded_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists internal_notes text;

alter table public.invoices
  add column if not exists disbursement_total numeric not null default 0;

alter table public.disbursements drop constraint if exists disbursements_status_check;
alter table public.disbursements add constraint disbursements_status_check check (
  status = any (array[
    'draft'::text,
    'awaiting_mandate'::text,
    'authorized'::text,
    'awaiting_reapproval'::text,
    'client_direct'::text,
    'purchased'::text,
    'eligible'::text,
    'reimbursed'::text,
    'rejected'::text,
    'cancelled'::text
  ])
);

alter table public.disbursements drop constraint if exists disbursements_client_choice_check;
alter table public.disbursements add constraint disbursements_client_choice_check check (
  client_choice = any (array['pending'::text, 'client_direct'::text, 'edm_disbursement'::text])
);

alter table public.disbursements drop constraint if exists disbursements_authorized_limit_check;
alter table public.disbursements add constraint disbursements_authorized_limit_check check (
  authorized_limit is null or authorized_limit > 0
);

alter table public.disbursements drop constraint if exists disbursements_requested_limit_check;
alter table public.disbursements add constraint disbursements_requested_limit_check check (
  requested_limit is null or requested_limit > 0
);

alter table public.invoices drop constraint if exists invoices_disbursement_total_check;
alter table public.invoices add constraint invoices_disbursement_total_check check (disbursement_total >= 0);

create unique index if not exists disbursements_quote_item_uidx
  on public.disbursements(quote_item_id)
  where quote_item_id is not null;

create or replace function private.guard_disbursement_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.no_margin is not true then
    raise exception 'Un débours ne peut comporter aucune marge.';
  end if;

  if new.status = 'awaiting_reapproval' then
    if new.requested_limit is null or new.authorized_limit is null or new.requested_limit <= new.authorized_limit then
      raise exception 'Le nouveau plafond doit être supérieur au plafond déjà autorisé.';
    end if;
  end if;

  if new.status in ('authorized', 'awaiting_reapproval', 'eligible', 'reimbursed') then
    if new.client_choice <> 'edm_disbursement' or new.mandate_signed is not true or new.mandate_accepted_at is null then
      raise exception 'Mandat client préalable obligatoire.';
    end if;
    if new.authorized_limit is null or new.authorized_limit <= 0 then
      raise exception 'Plafond autorisé obligatoire.';
    end if;
  end if;

  if new.status in ('eligible', 'reimbursed') then
    if new.amount is null or new.amount <= 0 then
      raise exception 'Montant réel du débours obligatoire.';
    end if;
    if new.amount > new.authorized_limit then
      raise exception 'Le montant réel dépasse le plafond autorisé.';
    end if;
    if new.supplier_invoice_in_customer_name is not true then
      raise exception 'Le justificatif fournisseur doit être établi au nom du client.';
    end if;
    if nullif(btrim(coalesce(new.proof_path, '')), '') is null then
      raise exception 'Justificatif fournisseur obligatoire.';
    end if;
    if nullif(btrim(coalesce(new.supplier, '')), '') is null then
      raise exception 'Fournisseur obligatoire.';
    end if;
  end if;

  if new.status = 'reimbursed' then
    if new.exact_reimbursement is not true or new.reimbursed_at is null then
      raise exception 'Le remboursement exact doit être constaté avant archivage du débours.';
    end if;
  end if;

  if new.status = 'client_direct' and new.client_choice <> 'client_direct' then
    raise exception 'Le mode achat direct client est incohérent.';
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists guard_disbursement_integrity on public.disbursements;
create trigger guard_disbursement_integrity
before insert or update on public.disbursements
for each row execute function private.guard_disbursement_integrity();

create or replace function public.client_choose_disbursement(
  p_disbursement_id uuid,
  p_choice text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.disbursements%rowtype;
  v_quote_status text;
  v_limit numeric;
  v_now timestamptz := timezone('utc', now());
  v_entry jsonb;
begin
  if auth.uid() is null then
    raise exception 'Connexion client requise.' using errcode = '42501';
  end if;
  if p_choice not in ('client_direct', 'edm_disbursement') then
    raise exception 'Choix de pièces invalide.';
  end if;

  select * into v_row
  from public.disbursements
  where id = p_disbursement_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Débours introuvable.' using errcode = '42501';
  end if;
  if v_row.status not in ('awaiting_mandate', 'awaiting_reapproval') then
    raise exception 'Ce choix a déjà été traité.';
  end if;

  select status into v_quote_status
  from public.quotes
  where id = v_row.quote_id
    and user_id = auth.uid();

  if v_quote_status is distinct from 'accepted' then
    raise exception 'Acceptez d’abord le devis avant de choisir le mode d’achat des pièces.';
  end if;

  if p_choice = 'client_direct' then
    update public.disbursements
    set client_choice = 'client_direct',
        status = 'client_direct',
        mandate_signed = false,
        requested_limit = null,
        mandate_accepted_at = null
    where id = v_row.id;

    if v_row.quote_item_id is not null then
      update public.quote_items
      set purchase_mode = 'client_direct'
      where id = v_row.quote_item_id
        and quote_id = v_row.quote_id;
    end if;

    return jsonb_build_object('id', v_row.id, 'status', 'client_direct');
  end if;

  v_limit := coalesce(v_row.requested_limit, v_row.authorized_limit);
  if v_limit is null or v_limit <= 0 then
    raise exception 'Plafond de débours invalide.';
  end if;
  if nullif(btrim(coalesce(v_row.mandate_text, '')), '') is null then
    raise exception 'Le texte du mandat est absent.';
  end if;

  v_entry := jsonb_build_object(
    'accepted_at', v_now,
    'amount_limit', v_limit,
    'mandate_version', coalesce(v_row.mandate_version, 'edm28-debours-v1'),
    'mandate_text', v_row.mandate_text
  );

  update public.disbursements
  set client_choice = 'edm_disbursement',
      authorized_limit = v_limit,
      requested_limit = null,
      mandate_signed = true,
      mandate_accepted_at = v_now,
      mandate_history = coalesce(mandate_history, '[]'::jsonb) || jsonb_build_array(v_entry),
      status = 'authorized'
  where id = v_row.id;

  if v_row.quote_item_id is not null then
    update public.quote_items
    set purchase_mode = 'disbursement'
    where id = v_row.quote_item_id
      and quote_id = v_row.quote_id;
  end if;

  return jsonb_build_object('id', v_row.id, 'status', 'authorized', 'authorized_limit', v_limit);
end;
$$;

revoke all on function public.client_choose_disbursement(uuid, text) from public;
revoke all on function public.client_choose_disbursement(uuid, text) from anon;
grant execute on function public.client_choose_disbursement(uuid, text) to authenticated;

create or replace function public.admin_prepare_quote(
  p_quote_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_order_number text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes%rowtype;
  v_appointment_id uuid;
  v_order_id uuid;
  v_authorized_work jsonb := '[]'::jsonb;
  v_duration integer;
  v_end timestamptz;
begin
  if not private.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = '42501';
  end if;
  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'Une date future est obligatoire.';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Devis introuvable.'; end if;
  if v_quote.status <> 'accepted' then raise exception 'Le devis doit être accepté.'; end if;
  if v_quote.vehicle_id is null then raise exception 'Aucun véhicule associé au devis.'; end if;

  if exists (
    select 1
    from public.quote_items qi
    left join public.disbursements d on d.quote_item_id = qi.id and d.quote_id = v_quote.id
    where qi.quote_id = v_quote.id
      and qi.purchase_mode = 'disbursement'
      and (d.id is null or d.status not in ('eligible', 'client_direct', 'reimbursed'))
  ) then
    raise exception 'Débours non finalisé : mandat, achat et justificatif doivent être terminés avant la préparation atelier.';
  end if;

  v_duration := coalesce(v_quote.labor_duration_minutes, p_duration_minutes);
  if v_duration is null or v_duration < 15 or v_duration > 480 then raise exception 'Durée invalide.'; end if;

  perform pg_advisory_xact_lock(hashtext('edm28-booking'));
  v_end := p_starts_at + make_interval(mins => v_duration);
  if exists (
    select 1 from public.appointments a
    where a.status <> 'cancelled'
      and a.starts_at < v_end + interval '30 minutes'
      and coalesce(a.ends_at, a.starts_at + interval '1 hour') + make_interval(mins => coalesce(a.buffer_minutes, 30)) > p_starts_at
  ) then
    raise exception 'Ce créneau chevauche un autre rendez-vous.';
  end if;

  insert into public.appointments(
    user_id, vehicle_id, service_request_id, external_appointment_id,
    starts_at, ends_at, status, notes, visible_to_client,
    labor_duration_minutes, buffer_minutes
  ) values (
    v_quote.user_id, v_quote.vehicle_id, v_quote.service_request_id,
    'quote/' || v_quote.id::text, p_starts_at, v_end, 'confirmed',
    'Intervention liée au devis ' || coalesce(v_quote.quote_number, v_quote.id::text),
    true, v_duration, 30
  ) returning id into v_appointment_id;

  select coalesce(services, '[]'::jsonb) into v_authorized_work
  from public.service_requests where id = v_quote.service_request_id;

  insert into public.repair_orders(
    user_id, vehicle_id, service_request_id, quote_id, appointment_id,
    order_number, status, authorized_work, visible_to_client
  ) values (
    v_quote.user_id, v_quote.vehicle_id, v_quote.service_request_id,
    v_quote.id, v_appointment_id,
    coalesce(nullif(btrim(p_order_number), ''), 'OR-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(v_appointment_id::text, '-', ''), 1, 6))),
    'ready', coalesce(v_authorized_work, '[]'::jsonb), true
  ) returning id into v_order_id;

  return jsonb_build_object(
    'appointment_id', v_appointment_id,
    'repair_order_id', v_order_id,
    'labor_duration_minutes', v_duration,
    'buffer_minutes', 30
  );
end;
$$;

revoke all on function public.admin_prepare_quote(uuid, timestamptz, integer, text) from public;
revoke all on function public.admin_prepare_quote(uuid, timestamptz, integer, text) from anon;
grant execute on function public.admin_prepare_quote(uuid, timestamptz, integer, text) to authenticated;

create or replace function public.admin_finalize_repair_order(
  p_order_id uuid,
  p_invoice_number text,
  p_due_days integer default 30
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.repair_orders%rowtype;
  v_quote public.quotes%rowtype;
  v_invoice_id uuid;
  v_item_count integer := 0;
  v_business_subtotal numeric := 0;
  v_business_vat numeric := 0;
  v_disbursement_total numeric := 0;
  v_discount numeric := 0;
  v_invoice_subtotal numeric := 0;
  v_invoice_total numeric := 0;
begin
  if not private.is_admin() then raise exception 'Accès administrateur requis.' using errcode = '42501'; end if;
  if nullif(btrim(p_invoice_number), '') is null then raise exception 'Numéro de facture obligatoire.'; end if;
  if p_due_days is null or p_due_days < 0 or p_due_days > 365 then raise exception 'Échéance comprise entre 0 et 365 jours.'; end if;

  select * into v_order from public.repair_orders where id = p_order_id for update;
  if not found then raise exception 'Ordre de réparation introuvable.'; end if;
  if v_order.status not in ('ready', 'signed', 'in_progress', 'completed', 'invoiced') then raise exception 'Ordre non clôturable.'; end if;

  select * into v_quote from public.quotes where id = v_order.quote_id;
  if not found then raise exception 'Devis associé introuvable.'; end if;

  if exists (
    select 1
    from public.quote_items qi
    left join public.disbursements d on d.quote_item_id = qi.id and d.quote_id = v_quote.id
    where qi.quote_id = v_quote.id
      and qi.purchase_mode = 'disbursement'
      and (d.id is null or d.status not in ('eligible', 'client_direct', 'reimbursed'))
  ) then
    raise exception 'Débours incomplet : impossible de clôturer avant mandat, justificatif et contrôle du montant exact.';
  end if;

  select id into v_invoice_id
  from public.invoices
  where repair_order_id = v_order.id or external_invoice_id = 'repair-order/' || v_order.id::text
  order by created_at limit 1;
  if v_order.status = 'invoiced' and v_invoice_id is not null then return v_invoice_id; end if;

  select
    coalesce(sum(coalesce(qi.quantity, 1) * coalesce(qi.unit_price, 0)), 0),
    coalesce(sum(coalesce(qi.quantity, 1) * coalesce(qi.unit_price, 0) * coalesce(qi.vat_rate, 0) / 100), 0)
  into v_business_subtotal, v_business_vat
  from public.quote_items qi
  where qi.quote_id = v_quote.id
    and coalesce(qi.purchase_mode, 'resale') not in ('client_direct', 'disbursement');

  select coalesce(sum(d.amount), 0) into v_disbursement_total
  from public.disbursements d
  where d.quote_id = v_quote.id and d.status in ('eligible', 'reimbursed');

  if not exists (select 1 from public.quote_items qi where qi.quote_id = v_quote.id) then
    v_business_subtotal := coalesce(v_quote.subtotal, v_quote.total, 0);
    v_business_vat := 0;
  end if;

  v_discount := least(coalesce(v_quote.discount, 0), greatest(0, v_business_subtotal + v_business_vat));
  v_invoice_subtotal := v_business_subtotal + v_disbursement_total;
  v_invoice_total := greatest(0, v_business_subtotal + v_business_vat - v_discount) + v_disbursement_total;

  if v_order.status <> 'completed' then
    update public.repair_orders set status = 'completed', updated_at = timezone('utc', now()) where id = v_order.id;
  end if;

  if v_invoice_id is null then
    insert into public.invoices(
      user_id, vehicle_id, quote_id, repair_order_id,
      external_invoice_id, invoice_number, status, title, description,
      subtotal, discount, total, disbursement_total, issued_at, due_at, visible_to_client
    ) values (
      v_order.user_id, v_order.vehicle_id, v_order.quote_id, v_order.id,
      'repair-order/' || v_order.id::text, btrim(p_invoice_number), 'draft',
      coalesce(v_quote.title, 'Facture EDM28'), v_quote.description,
      v_invoice_subtotal, v_discount, v_invoice_total, v_disbursement_total,
      now(), now() + make_interval(days => p_due_days), false
    ) returning id into v_invoice_id;
  else
    update public.invoices
    set repair_order_id = coalesce(repair_order_id, v_order.id),
        invoice_number = coalesce(nullif(invoice_number, ''), btrim(p_invoice_number)),
        subtotal = v_invoice_subtotal,
        discount = v_discount,
        total = v_invoice_total,
        disbursement_total = v_disbursement_total,
        updated_at = timezone('utc', now())
    where id = v_invoice_id;
  end if;

  select count(*) into v_item_count from public.invoice_items where invoice_id = v_invoice_id;
  if v_item_count = 0 then
    insert into public.invoice_items(
      invoice_id, item_type, description, quantity, unit_price,
      line_total, source_quote_item_id, supplier_reference,
      display_order, vat_rate, purchase_total, margin_amount
    )
    select
      v_invoice_id,
      case when qi.item_type in ('labor','part','delivery','discount','other') then qi.item_type else 'other' end,
      coalesce(nullif(qi.description, ''), nullif(qi.designation, ''), 'Prestation'),
      coalesce(qi.quantity, 1), coalesce(qi.unit_price, 0),
      coalesce(qi.quantity, 1) * coalesce(qi.unit_price, 0),
      qi.id, qi.supplier_reference, coalesce(qi.display_order, 0),
      coalesce(qi.vat_rate, 0), coalesce(qi.purchase_total, 0),
      (coalesce(qi.quantity, 1) * coalesce(qi.unit_price, 0)) - coalesce(qi.purchase_total, 0)
    from public.quote_items qi
    where qi.quote_id = v_order.quote_id
      and coalesce(qi.purchase_mode, 'resale') not in ('client_direct', 'disbursement')
    order by qi.display_order;

    insert into public.invoice_items(
      invoice_id, item_type, description, quantity, unit_price,
      line_total, source_quote_item_id, supplier_reference,
      display_order, vat_rate, purchase_total, margin_amount
    )
    select
      v_invoice_id,
      'disbursement',
      'Débours client — ' || coalesce(nullif(d.description, ''), nullif(qi.designation, ''), 'Achat pour compte du client'),
      1, d.amount, d.amount, qi.id, qi.supplier_reference,
      coalesce(qi.display_order, 0) + 1000, 0, d.amount, 0
    from public.disbursements d
    join public.quote_items qi on qi.id = d.quote_item_id
    where d.quote_id = v_order.quote_id and d.status in ('eligible', 'reimbursed')
    order by qi.display_order;

    select count(*) into v_item_count from public.invoice_items where invoice_id = v_invoice_id;
    if v_item_count = 0 then
      insert into public.invoice_items(
        invoice_id, item_type, description, quantity, unit_price, line_total,
        display_order, vat_rate, purchase_total, margin_amount
      ) values (
        v_invoice_id, 'labor', 'Prestations selon devis accepté', 1,
        coalesce(v_quote.total, 0), coalesce(v_quote.total, 0), 0, 0, 0, coalesce(v_quote.total, 0)
      );
    end if;
  end if;

  update public.disbursements set invoice_id = v_invoice_id
  where quote_id = v_order.quote_id and status in ('eligible', 'reimbursed');

  update public.repair_orders set status = 'invoiced', updated_at = timezone('utc', now())
  where id = v_order.id and status = 'completed';
  if not found and v_order.status <> 'invoiced' then raise exception 'Le statut atelier a changé.'; end if;

  return v_invoice_id;
end;
$$;

revoke all on function public.admin_finalize_repair_order(uuid, text, integer) from public;
revoke all on function public.admin_finalize_repair_order(uuid, text, integer) from anon;
grant execute on function public.admin_finalize_repair_order(uuid, text, integer) to authenticated;

create or replace function private.guard_invoice_disbursements()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_expected numeric := 0;
  v_lines numeric := 0;
begin
  if new.status = 'issued' and old.status is distinct from 'issued' then
    if exists (
      select 1 from public.disbursements d
      where d.invoice_id = new.id and d.status not in ('eligible', 'reimbursed')
    ) then
      raise exception 'Facture non émissible : un débours associé n’est pas éligible.';
    end if;

    select coalesce(sum(d.amount), 0) into v_expected
    from public.disbursements d
    where d.invoice_id = new.id and d.status in ('eligible', 'reimbursed');

    select coalesce(sum(ii.line_total), 0) into v_lines
    from public.invoice_items ii
    where ii.invoice_id = new.id and ii.item_type = 'disbursement';

    if abs(v_expected - coalesce(new.disbursement_total, 0)) > 0.005
       or abs(v_expected - v_lines) > 0.005 then
      raise exception 'Facture non émissible : le montant des débours ne correspond pas aux justificatifs.';
    end if;

    if exists (
      select 1 from public.invoice_items ii
      where ii.invoice_id = new.id
        and ii.item_type = 'disbursement'
        and (coalesce(ii.vat_rate, 0) <> 0
          or abs(coalesce(ii.purchase_total, 0) - coalesce(ii.line_total, 0)) > 0.005
          or abs(coalesce(ii.margin_amount, 0)) > 0.005)
    ) then
      raise exception 'Facture non émissible : une ligne de débours comporte une TVA, une marge ou un montant incohérent.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_invoice_disbursements on public.invoices;
create trigger guard_invoice_disbursements
before update of status on public.invoices
for each row execute function private.guard_invoice_disbursements();

create or replace function private.sync_invoice_payment_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_invoice_id uuid;
  paid_total numeric;
  invoice_total numeric;
begin
  target_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select total into invoice_total
  from public.invoices
  where id = target_invoice_id
  for update;
  if not found then return coalesce(new, old); end if;

  select coalesce(sum(amount), 0) into paid_total
  from public.payments
  where invoice_id = target_invoice_id;

  update public.invoices
  set amount_paid = paid_total,
      status = case
        when paid_total <= 0 then 'issued'
        when paid_total < invoice_total then 'partially_paid'
        else 'paid'
      end,
      paid_at = case when paid_total >= invoice_total then coalesce(paid_at, timezone('utc', now())) else null end,
      updated_at = timezone('utc', now())
  where id = target_invoice_id and status <> 'cancelled';

  if paid_total >= invoice_total then
    update public.disbursements
    set status = 'reimbursed', exact_reimbursement = true,
        reimbursed_at = coalesce(reimbursed_at, timezone('utc', now()))
    where invoice_id = target_invoice_id and status = 'eligible';
  else
    update public.disbursements
    set status = 'eligible', exact_reimbursement = false, reimbursed_at = null
    where invoice_id = target_invoice_id and status = 'reimbursed';
  end if;

  return coalesce(new, old);
end;
$$;
