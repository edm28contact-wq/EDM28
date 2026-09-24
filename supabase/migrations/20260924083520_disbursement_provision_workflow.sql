-- EDM28 provision-first disbursement workflow.
-- Applied in production as Supabase migration 20260924083520.

alter table public.disbursements
  add column if not exists provision_required numeric,
  add column if not exists provision_received numeric not null default 0,
  add column if not exists provision_received_at timestamptz,
  add column if not exists refunded_amount numeric not null default 0,
  add column if not exists parts_status text not null default 'not_ordered',
  add column if not exists ordered_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists received_at timestamptz;

alter table public.disbursements drop constraint if exists disbursements_provision_required_check;
alter table public.disbursements add constraint disbursements_provision_required_check
  check (provision_required is null or provision_required > 0);
alter table public.disbursements drop constraint if exists disbursements_provision_received_check;
alter table public.disbursements add constraint disbursements_provision_received_check
  check (provision_received >= 0);
alter table public.disbursements drop constraint if exists disbursements_refunded_amount_check;
alter table public.disbursements add constraint disbursements_refunded_amount_check
  check (refunded_amount >= 0 and refunded_amount <= provision_received);
alter table public.disbursements drop constraint if exists disbursements_parts_status_check;
alter table public.disbursements add constraint disbursements_parts_status_check
  check (parts_status = any (array[
    'not_ordered'::text,
    'ready_to_order'::text,
    'ordered'::text,
    'shipped'::text,
    'received'::text,
    'cancelled'::text
  ]));

create table if not exists public.disbursement_transactions (
  id uuid primary key default gen_random_uuid(),
  disbursement_id uuid not null references public.disbursements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type = any (array['provision'::text, 'complement'::text, 'refund'::text])),
  direction text not null check (direction = any (array['in'::text, 'out'::text])),
  amount numeric not null check (amount > 0),
  payment_method text,
  reference text,
  recorded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists disbursement_transactions_disbursement_idx
  on public.disbursement_transactions(disbursement_id, recorded_at desc);
create index if not exists disbursement_transactions_user_idx
  on public.disbursement_transactions(user_id, recorded_at desc);

alter table public.disbursement_transactions enable row level security;
revoke all on table public.disbursement_transactions from anon, authenticated;
grant select, insert on table public.disbursement_transactions to authenticated;

drop policy if exists disbursement_transactions_select_own on public.disbursement_transactions;
create policy disbursement_transactions_select_own
on public.disbursement_transactions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists disbursement_transactions_admin_insert on public.disbursement_transactions;
create policy disbursement_transactions_admin_insert
on public.disbursement_transactions
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

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

  if new.client_choice = 'edm_disbursement'
     and new.status in ('authorized', 'eligible', 'reimbursed')
     and (new.provision_required is null or new.provision_required is distinct from new.authorized_limit) then
    new.provision_required := new.authorized_limit;
  end if;

  if new.parts_status in ('ready_to_order', 'ordered', 'shipped', 'received')
     and new.client_choice = 'edm_disbursement' then
    if new.provision_required is null or new.provision_received < new.provision_required then
      raise exception 'Provision client insuffisante : aucune commande de pièce ne peut être engagée.';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.parts_status is distinct from old.parts_status then
    if not (
      (old.parts_status = 'not_ordered' and new.parts_status in ('ready_to_order', 'cancelled'))
      or (old.parts_status = 'ready_to_order' and new.parts_status in ('ordered', 'cancelled'))
      or (old.parts_status = 'ordered' and new.parts_status in ('shipped', 'received', 'cancelled'))
      or (old.parts_status = 'shipped' and new.parts_status in ('received', 'cancelled'))
      or (old.parts_status = new.parts_status)
    ) then
      raise exception 'Transition de statut pièces invalide : % -> %', old.parts_status, new.parts_status;
    end if;
  end if;

  if new.parts_status = 'ordered' then
    new.ordered_at := coalesce(new.ordered_at, timezone('utc', now()));
  elsif new.parts_status = 'shipped' then
    new.ordered_at := coalesce(new.ordered_at, timezone('utc', now()));
    new.shipped_at := coalesce(new.shipped_at, timezone('utc', now()));
  elsif new.parts_status = 'received' then
    new.ordered_at := coalesce(new.ordered_at, timezone('utc', now()));
    new.received_at := coalesce(new.received_at, timezone('utc', now()));
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

create or replace function private.guard_appointment_parts_ready()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.service_request_id is not null and exists (
    select 1
    from public.disbursements d
    where d.service_request_id = new.service_request_id
      and d.client_choice = 'edm_disbursement'
      and d.status not in ('cancelled', 'rejected')
      and d.parts_status <> 'received'
  ) then
    raise exception 'Les pièces en débours doivent être reçues avant de confirmer le rendez-vous.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_appointment_parts_ready on public.appointments;
create trigger guard_appointment_parts_ready
before insert or update of service_request_id, status on public.appointments
for each row execute function private.guard_appointment_parts_ready();

create or replace function public.admin_record_disbursement_transaction(
  p_disbursement_id uuid,
  p_transaction_type text,
  p_amount numeric,
  p_payment_method text default null,
  p_reference text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.disbursements%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_due numeric;
  v_received numeric;
  v_refunded numeric;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ) then
    raise exception 'Accès administrateur requis.' using errcode = '42501';
  end if;
  if p_transaction_type not in ('provision', 'complement', 'refund') then
    raise exception 'Type de mouvement invalide.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant positif obligatoire.';
  end if;

  select * into v_row
  from public.disbursements
  where id = p_disbursement_id
  for update;

  if not found then raise exception 'Débours introuvable.'; end if;
  if v_row.client_choice <> 'edm_disbursement' or v_row.mandate_signed is not true then
    raise exception 'Mandat de débours accepté obligatoire.';
  end if;

  if p_transaction_type in ('provision', 'complement') then
    if v_row.status not in ('authorized', 'eligible', 'reimbursed') then
      raise exception 'Le débours ne peut pas recevoir de provision à ce stade.';
    end if;
    v_received := coalesce(v_row.provision_received, 0) + p_amount;
    update public.disbursements
      set provision_received = v_received,
          provision_received_at = case
            when v_received >= coalesce(v_row.provision_required, v_row.authorized_limit)
              then coalesce(provision_received_at, v_now)
            else provision_received_at
          end,
          parts_status = case
            when parts_status = 'not_ordered'
             and v_received >= coalesce(v_row.provision_required, v_row.authorized_limit)
              then 'ready_to_order'
            else parts_status
          end
      where id = v_row.id;
  else
    if v_row.amount is null then
      raise exception 'Le montant réel fournisseur doit être enregistré avant un remboursement.';
    end if;
    v_due := coalesce(v_row.provision_received, 0) - v_row.amount - coalesce(v_row.refunded_amount, 0);
    if v_due <= 0 or p_amount > v_due then
      raise exception 'Le remboursement dépasse le solde réellement dû au client.';
    end if;
    v_refunded := coalesce(v_row.refunded_amount, 0) + p_amount;
    update public.disbursements set refunded_amount = v_refunded where id = v_row.id;
  end if;

  insert into public.disbursement_transactions(
    disbursement_id, user_id, transaction_type, direction, amount, payment_method, reference, recorded_at
  ) values (
    v_row.id, v_row.user_id, p_transaction_type,
    case when p_transaction_type = 'refund' then 'out' else 'in' end,
    p_amount, nullif(btrim(coalesce(p_payment_method, '')), ''),
    nullif(btrim(coalesce(p_reference, '')), ''), v_now
  );

  return jsonb_build_object('id', v_row.id, 'transaction_type', p_transaction_type, 'amount', p_amount);
end;
$$;

revoke all on function public.admin_record_disbursement_transaction(uuid, text, numeric, text, text) from public;
revoke all on function public.admin_record_disbursement_transaction(uuid, text, numeric, text, text) from anon;
grant execute on function public.admin_record_disbursement_transaction(uuid, text, numeric, text, text) to authenticated;

create or replace function public.admin_set_disbursement_parts_status(
  p_disbursement_id uuid,
  p_parts_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.disbursements%rowtype;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ) then
    raise exception 'Accès administrateur requis.' using errcode = '42501';
  end if;
  if p_parts_status not in ('ready_to_order', 'ordered', 'shipped', 'received', 'cancelled') then
    raise exception 'Statut pièces invalide.';
  end if;

  select * into v_row
  from public.disbursements
  where id = p_disbursement_id
  for update;
  if not found then raise exception 'Débours introuvable.'; end if;

  update public.disbursements set parts_status = p_parts_status where id = v_row.id;
  return jsonb_build_object('id', v_row.id, 'parts_status', p_parts_status);
end;
$$;

revoke all on function public.admin_set_disbursement_parts_status(uuid, text) from public;
revoke all on function public.admin_set_disbursement_parts_status(uuid, text) from anon;
grant execute on function public.admin_set_disbursement_parts_status(uuid, text) to authenticated;
