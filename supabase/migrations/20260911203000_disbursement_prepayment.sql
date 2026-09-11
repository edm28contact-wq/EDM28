-- EDM28 - provision payee avant commande des pieces en debours.
-- Le debours final reste le montant exact du justificatif fournisseur, sans marge.

alter table public.service_requests
  add column if not exists disbursement_billing jsonb;

alter table public.disbursements
  add column if not exists prepayment_required boolean not null default true,
  add column if not exists payment_status text not null default 'to_pay',
  add column if not exists prepaid_amount numeric not null default 0,
  add column if not exists payment_currency text not null default 'eur',
  add column if not exists paid_at timestamptz;

alter table public.disbursements drop constraint if exists disbursements_payment_status_check;
alter table public.disbursements add constraint disbursements_payment_status_check check (
  payment_status = any (array['to_pay'::text, 'paid'::text, 'not_required'::text, 'refunded'::text])
);

alter table public.disbursements drop constraint if exists disbursements_prepaid_amount_check;
alter table public.disbursements add constraint disbursements_prepaid_amount_check check (prepaid_amount >= 0);

alter table public.disbursements drop constraint if exists disbursements_payment_currency_check;
alter table public.disbursements add constraint disbursements_payment_currency_check check (payment_currency = lower(payment_currency) and length(payment_currency) = 3);

-- Les dossiers deja finalises avant ce changement restent dans l'ancien flux.
update public.disbursements
set prepayment_required = false,
    payment_status = 'not_required'
where status in ('eligible', 'reimbursed', 'client_direct', 'cancelled', 'rejected');

create table if not exists public.disbursement_payments (
  id uuid primary key default gen_random_uuid(),
  disbursement_id uuid not null references public.disbursements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'stripe',
  checkout_session_id text unique,
  payment_intent_id text,
  amount numeric not null check (amount > 0),
  currency text not null default 'eur' check (currency = lower(currency) and length(currency) = 3),
  status text not null default 'creating' check (status in ('creating','created','paid','partially_refunded','refunded','expired','failed')),
  refunded_amount numeric not null default 0 check (refunded_amount >= 0 and refunded_amount <= amount),
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists disbursement_payments_disbursement_id_idx on public.disbursement_payments(disbursement_id);
create index if not exists disbursement_payments_user_id_idx on public.disbursement_payments(user_id);
create index if not exists disbursement_payments_payment_intent_id_idx on public.disbursement_payments(payment_intent_id);
create unique index if not exists disbursement_payments_one_active_uidx
  on public.disbursement_payments(disbursement_id)
  where status in ('creating','created');

alter table public.disbursement_payments enable row level security;

drop policy if exists disbursement_payments_select_own_or_admin on public.disbursement_payments;
create policy disbursement_payments_select_own_or_admin
on public.disbursement_payments for select
to authenticated
using (user_id = (select auth.uid()) or private.is_admin());

revoke all on table public.disbursement_payments from anon;
revoke insert, update, delete on table public.disbursement_payments from authenticated;
grant select on table public.disbursement_payments to authenticated;

create or replace function private.sync_disbursement_prepayment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_net numeric := 0;
  v_paid_at timestamptz;
  v_required numeric := 0;
  v_workflow_status text;
  v_prepayment_required boolean;
begin
  v_id := coalesce(new.disbursement_id, old.disbursement_id);

  select d.status,
         d.prepayment_required,
         case
           when d.status in ('eligible','reimbursed') and d.amount is not null then d.amount
           else coalesce(d.authorized_limit, 0)
         end
    into v_workflow_status, v_prepayment_required, v_required
  from public.disbursements d
  where d.id = v_id
  for update;

  if not found then return coalesce(new, old); end if;

  select coalesce(sum(greatest(0, p.amount - p.refunded_amount)), 0), max(p.paid_at)
    into v_net, v_paid_at
  from public.disbursement_payments p
  where p.disbursement_id = v_id
    and p.status in ('paid','partially_refunded','refunded');

  update public.disbursements
  set prepaid_amount = v_net,
      paid_at = v_paid_at,
      payment_status = case
        when not v_prepayment_required or v_workflow_status in ('client_direct','cancelled','rejected') then 'not_required'
        when v_required > 0 and v_net + 0.005 >= v_required then 'paid'
        when v_net <= 0 and exists (
          select 1 from public.disbursement_payments p
          where p.disbursement_id = v_id and p.refunded_amount > 0
        ) then 'refunded'
        else 'to_pay'
      end,
      updated_at = timezone('utc', now())
  where id = v_id;

  return coalesce(new, old);
end;
$$;

revoke all on function private.sync_disbursement_prepayment() from public, anon, authenticated;
grant execute on function private.sync_disbursement_prepayment() to service_role;

drop trigger if exists sync_disbursement_prepayment on public.disbursement_payments;
create trigger sync_disbursement_prepayment
after insert or update or delete on public.disbursement_payments
for each row execute function private.sync_disbursement_prepayment();

create or replace function private.guard_disbursement_payment_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role')
     and (
       new.payment_status is distinct from old.payment_status
       or new.prepaid_amount is distinct from old.prepaid_amount
       or new.paid_at is distinct from old.paid_at
       or new.payment_currency is distinct from old.payment_currency
       or new.prepayment_required is distinct from old.prepayment_required
     ) then
    raise exception 'Le statut de paiement du debours est gere cote serveur.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_disbursement_payment_fields on public.disbursements;
create trigger guard_disbursement_payment_fields
before update on public.disbursements
for each row execute function private.guard_disbursement_payment_fields();

create or replace function private.guard_disbursement_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.no_margin is not true then
    raise exception 'Un debours ne peut comporter aucune marge.';
  end if;

  if new.prepayment_required and new.status = 'awaiting_mandate' then
    new.mandate_text := 'Je mandate EDM28 pour acheter la piece decrite dans ce dossier, en mon nom et pour mon compte, dans la limite de '
      || trim(to_char(coalesce(new.requested_limit, new.authorized_limit, 0), 'FM999999990D00'))
      || ' EUR. Avant toute commande, je verse a EDM28 une provision correspondant au montant autorise restant a financer. Le debours final sera limite au montant exact du justificatif fournisseur, sans marge ni commission. Tout trop-percu devra etre rembourse.';
    new.mandate_version := 'edm28-debours-prepayment-v1';
  end if;

  if new.status = 'awaiting_reapproval' then
    if new.requested_limit is null or new.authorized_limit is null or new.requested_limit <= new.authorized_limit then
      raise exception 'Le nouveau plafond doit etre superieur au plafond deja autorise.';
    end if;
  end if;

  if new.status in ('authorized', 'awaiting_reapproval', 'eligible', 'reimbursed') then
    if new.client_choice <> 'edm_disbursement' or new.mandate_signed is not true or new.mandate_accepted_at is null then
      raise exception 'Mandat client prealable obligatoire.';
    end if;
    if new.authorized_limit is null or new.authorized_limit <= 0 then
      raise exception 'Plafond autorise obligatoire.';
    end if;
  end if;

  if new.prepayment_required
     and (new.purchase_recorded_at is not null or new.status in ('purchased','eligible','reimbursed')) then
    if new.payment_status <> 'paid' then
      raise exception 'Paiement du debours obligatoire avant toute commande de piece.';
    end if;
  end if;

  if new.status in ('eligible', 'reimbursed') then
    if new.amount is null or new.amount <= 0 then
      raise exception 'Montant reel du debours obligatoire.';
    end if;
    if new.amount > new.authorized_limit then
      raise exception 'Le montant reel depasse le plafond autorise.';
    end if;
    if new.prepayment_required and new.prepaid_amount + 0.005 < new.amount then
      raise exception 'La provision payee est insuffisante pour ce debours.';
    end if;
    if new.supplier_invoice_in_customer_name is not true then
      raise exception 'Le justificatif fournisseur doit etre etabli au nom du client.';
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
      raise exception 'Le debours exact doit etre constate avant archivage.';
    end if;
  end if;

  if new.status = 'client_direct' and new.client_choice <> 'client_direct' then
    raise exception 'Le mode achat direct client est incoherent.';
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
    raise exception 'Choix de pieces invalide.';
  end if;

  select * into v_row
  from public.disbursements
  where id = p_disbursement_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Debours introuvable.' using errcode = '42501';
  end if;
  if v_row.status not in ('awaiting_mandate', 'awaiting_reapproval') then
    raise exception 'Ce choix a deja ete traite.';
  end if;

  select status into v_quote_status
  from public.quotes
  where id = v_row.quote_id
    and user_id = auth.uid();

  if v_quote_status is distinct from 'accepted' then
    raise exception 'Acceptez d abord le devis avant de choisir le mode d achat des pieces.';
  end if;

  if p_choice = 'client_direct' then
    update public.disbursements
    set client_choice = 'client_direct',
        status = 'client_direct',
        mandate_signed = false,
        requested_limit = null,
        mandate_accepted_at = null,
        prepayment_required = false,
        payment_status = 'not_required'
    where id = v_row.id;

    if v_row.quote_item_id is not null then
      update public.quote_items
      set purchase_mode = 'client_direct'
      where id = v_row.quote_item_id
        and quote_id = v_row.quote_id;
    end if;

    return jsonb_build_object('id', v_row.id, 'status', 'client_direct', 'payment_status', 'not_required');
  end if;

  v_limit := coalesce(v_row.requested_limit, v_row.authorized_limit);
  if v_limit is null or v_limit <= 0 then
    raise exception 'Plafond de debours invalide.';
  end if;
  if nullif(btrim(coalesce(v_row.mandate_text, '')), '') is null then
    raise exception 'Le texte du mandat est absent.';
  end if;

  v_entry := jsonb_build_object(
    'accepted_at', v_now,
    'amount_limit', v_limit,
    'prepayment_required', true,
    'mandate_version', coalesce(v_row.mandate_version, 'edm28-debours-prepayment-v1'),
    'mandate_text', v_row.mandate_text
  );

  update public.disbursements
  set client_choice = 'edm_disbursement',
      authorized_limit = v_limit,
      requested_limit = null,
      mandate_signed = true,
      mandate_accepted_at = v_now,
      mandate_history = coalesce(mandate_history, '[]'::jsonb) || jsonb_build_array(v_entry),
      prepayment_required = true,
      payment_status = case when coalesce(prepaid_amount, 0) + 0.005 >= v_limit then 'paid' else 'to_pay' end,
      status = 'authorized'
  where id = v_row.id;

  if v_row.quote_item_id is not null then
    update public.quote_items
    set purchase_mode = 'disbursement'
    where id = v_row.quote_item_id
      and quote_id = v_row.quote_id;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'status', 'authorized',
    'payment_status', case when coalesce(v_row.prepaid_amount, 0) + 0.005 >= v_limit then 'paid' else 'to_pay' end,
    'authorized_limit', v_limit
  );
end;
$$;

revoke all on function public.client_choose_disbursement(uuid, text) from public;
revoke all on function public.client_choose_disbursement(uuid, text) from anon;
grant execute on function public.client_choose_disbursement(uuid, text) to authenticated;

-- Une facture finale ne peut etre emise avec un trop-percu de provision non rembourse.
create or replace function private.guard_invoice_disbursement_prepayments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'issued' and old.status is distinct from 'issued' then
    if exists (
      select 1
      from public.disbursements d
      where d.invoice_id = new.id
        and d.prepayment_required
        and d.status in ('eligible','reimbursed')
        and (
          d.payment_status <> 'paid'
          or d.amount is null
          or abs(coalesce(d.prepaid_amount, 0) - d.amount) > 0.005
        )
    ) then
      raise exception 'Facture non emissible : la provision du debours doit correspondre exactement au justificatif apres remboursement de tout trop-percu.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_invoice_disbursement_prepayments on public.invoices;
create trigger guard_invoice_disbursement_prepayments
before update of status on public.invoices
for each row execute function private.guard_invoice_disbursement_prepayments();

create unique index if not exists payments_disbursement_prepayment_reference_uidx
  on public.payments(reference)
  where reference like 'disbursement-prepayment/%';

-- Au moment ou la facture finale est emise, la provision deja encaissee est imputee
-- comme paiement afin de ne jamais reclamer une seconde fois le meme debours.
create or replace function private.apply_disbursement_prepayments_to_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'issued' and old.status is distinct from 'issued' then
    insert into public.payments(invoice_id, user_id, amount, payment_method, reference, paid_at)
    select d.invoice_id,
           d.user_id,
           d.amount,
           'stripe_disbursement',
           'disbursement-prepayment/' || d.id::text,
           coalesce(d.paid_at, timezone('utc', now()))
    from public.disbursements d
    where d.invoice_id = new.id
      and d.prepayment_required
      and d.payment_status = 'paid'
      and d.amount is not null
      and d.amount > 0
      and abs(coalesce(d.prepaid_amount, 0) - d.amount) <= 0.005
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_disbursement_prepayments_to_invoice on public.invoices;
create trigger apply_disbursement_prepayments_to_invoice
after update of status on public.invoices
for each row execute function private.apply_disbursement_prepayments_to_invoice();