-- Customer-supplied parts: close a confirmed reservation before work starts.
-- Client mismatch => 15 EUR reservation fee. EDM28 recommendation error => 0 EUR client charge.

alter table public.booking_reservations
  add column if not exists parts_resolution text,
  add column if not exists reservation_fee_amount numeric(10,2) not null default 0,
  add column if not exists resolution_note text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id),
  add column if not exists reservation_fee_invoice_id uuid references public.invoices(id);

alter table public.booking_reservations
  drop constraint if exists booking_reservations_parts_resolution_check,
  drop constraint if exists booking_reservations_reservation_fee_amount_check,
  drop constraint if exists booking_reservations_resolution_note_check,
  drop constraint if exists booking_reservations_parts_resolution_state_check;

alter table public.booking_reservations
  add constraint booking_reservations_parts_resolution_check
    check (parts_resolution is null or parts_resolution in ('client_nonconforming_parts','edm_recommendation_error')),
  add constraint booking_reservations_reservation_fee_amount_check
    check (reservation_fee_amount in (0,15)),
  add constraint booking_reservations_resolution_note_check
    check (resolution_note is null or length(resolution_note) between 1 and 1000),
  add constraint booking_reservations_parts_resolution_state_check
    check (
      (
        parts_resolution is null
        and reservation_fee_amount = 0
        and reservation_fee_invoice_id is null
        and resolution_note is null
        and resolved_at is null
        and resolved_by is null
      )
      or
      (
        parts_resolution = 'client_nonconforming_parts'
        and reservation_fee_amount = 15
        and reservation_fee_invoice_id is not null
        and resolution_note is not null
        and resolved_at is not null
        and resolved_by is not null
      )
      or
      (
        parts_resolution = 'edm_recommendation_error'
        and reservation_fee_amount = 0
        and reservation_fee_invoice_id is null
        and resolution_note is not null
        and resolved_at is not null
        and resolved_by is not null
      )
    );

create or replace function private.resolve_parts_issue(
  p_appointment_id uuid,
  p_responsibility text,
  p_note text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.booking_reservations%rowtype;
  a public.appointments%rowtype;
  o public.repair_orders%rowtype;
  q public.quotes%rowtype;
  v_invoice_id uuid;
  v_invoice_number text;
  v_note text;
begin
  if (select auth.uid()) is null or (select private.is_admin()) is not true then
    raise exception 'Acces administrateur requis.' using errcode = '42501';
  end if;

  if p_responsibility not in ('client_nonconforming_parts','edm_recommendation_error') then
    raise exception 'Responsabilite pieces invalide.';
  end if;

  v_note := nullif(btrim(p_note), '');
  if v_note is null then
    raise exception 'Renseignez les references apportees et le constat avant de cloturer le rendez-vous.';
  end if;
  if length(v_note) > 1000 then
    raise exception 'Le constat pieces est limite a 1000 caracteres.';
  end if;

  select *
  into r
  from public.booking_reservations
  where appointment_id = p_appointment_id
  for update;

  if not found then
    raise exception 'Reservation liee au rendez-vous introuvable.';
  end if;

  if r.parts_resolution is not null then
    if r.parts_resolution <> p_responsibility then
      raise exception 'Ce rendez-vous a deja ete cloture avec une autre responsabilite.';
    end if;
    return r.reservation_fee_invoice_id;
  end if;

  if r.status <> 'confirmed' then
    raise exception 'Seul un rendez-vous confirme peut etre cloture pour incompatibilite de pieces.';
  end if;

  select * into a
  from public.appointments
  where id = r.appointment_id
  for update;

  if not found or a.status <> 'confirmed' then
    raise exception 'Le rendez-vous doit etre confirme et non demarre.';
  end if;

  select * into o
  from public.repair_orders
  where id = r.repair_order_id
  for update;

  if not found or o.appointment_id is distinct from a.id then
    raise exception 'Ordre de reparation incoherent avec la reservation.';
  end if;

  if o.status not in ('ready','signed') then
    if o.status in ('in_progress','completed','invoiced') then
      raise exception 'Intervention deja commencee : la regle des 15 EUR de reservation ne peut plus etre appliquee.';
    end if;
    raise exception 'Ordre de reparation non eligible a cette cloture.';
  end if;

  select * into q
  from public.quotes
  where id = r.quote_id;

  if not found or q.id is distinct from o.quote_id or q.commercial_model <> 'customer_supplied_v1' then
    raise exception 'Cette regle est reservee au parcours actuel avec pieces achetees par le client.';
  end if;

  if exists (
    select 1
    from public.invoices i
    where i.repair_order_id = o.id
      and i.status <> 'cancelled'
  ) then
    raise exception 'Une facture active existe deja pour ce dossier. Verifiez-la avant toute cloture.';
  end if;

  if p_responsibility = 'client_nonconforming_parts' then
    v_invoice_number := public.next_document_number('invoice');

    insert into public.invoices(
      user_id, vehicle_id, quote_id, repair_order_id,
      external_invoice_id, invoice_number, status, title, description,
      subtotal, discount, total, disbursement_total,
      due_at, visible_to_client
    ) values (
      r.user_id, r.vehicle_id, r.quote_id, o.id,
      'reservation-fee/' || r.id::text,
      v_invoice_number,
      'draft',
      'Frais de reservation EDM28',
      'Pieces apportees incompatibles avec les references preconisees ou validees. Aucune intervention mecanique n a ete commencee.',
      15, 0, 15, 0,
      now() + interval '30 days',
      false
    )
    returning id into v_invoice_id;

    insert into public.invoice_items(
      invoice_id, item_type, description, quantity, unit_price, line_total,
      display_order, vat_rate, purchase_total, margin_amount
    ) values (
      v_invoice_id,
      'other',
      'Frais de reservation - pieces apportees non conformes aux references preconisees ou validees',
      1, 15, 15,
      0, 0, 0, 15
    );
  end if;

  -- Order first: its reservation guard still requires the appointment to be confirmed.
  update public.repair_orders
  set status = 'cancelled',
      updated_at = timezone('utc', now())
  where id = o.id
    and status in ('ready','signed');

  if not found then
    raise exception 'Le statut atelier a change. Rechargez avant de recommencer.';
  end if;

  update public.appointments
  set status = 'cancelled',
      notes = concat_ws(E'\n', nullif(notes, ''), 'Cloture pieces : ' || v_note),
      updated_at = timezone('utc', now())
  where id = a.id
    and status = 'confirmed';

  if not found then
    raise exception 'Le rendez-vous a change. Rechargez avant de recommencer.';
  end if;

  update public.booking_reservations
  set status = 'cancelled',
      parts_resolution = p_responsibility,
      reservation_fee_amount = case when p_responsibility = 'client_nonconforming_parts' then 15 else 0 end,
      reservation_fee_invoice_id = v_invoice_id,
      resolution_note = v_note,
      resolved_at = now(),
      resolved_by = (select auth.uid()),
      updated_at = now()
  where id = r.id;

  return v_invoice_id;
end;
$$;

revoke all on function private.resolve_parts_issue(uuid,text,text) from public, anon, authenticated;
grant execute on function private.resolve_parts_issue(uuid,text,text) to authenticated;

create or replace function public.admin_resolve_parts_issue(
  p_appointment_id uuid,
  p_responsibility text,
  p_note text
) returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.resolve_parts_issue(p_appointment_id,p_responsibility,p_note)
$$;

revoke all on function public.admin_resolve_parts_issue(uuid,text,text) from public, anon;
grant execute on function public.admin_resolve_parts_issue(uuid,text,text) to authenticated;

comment on function public.admin_resolve_parts_issue(uuid,text,text) is
  'Cloture avant intervention pour incompatibilite de pieces : 15 EUR si pieces client non conformes, 0 EUR si erreur de preconisation EDM28.';

notify pgrst, 'reload schema';
