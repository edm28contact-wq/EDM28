begin;

create or replace function public.recalculate_quote_totals(p_quote_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_subtotal numeric; v_discount numeric;
begin
  select
    coalesce(sum(case when item_type <> 'discount' then quantity * unit_price else 0 end), 0),
    coalesce(sum(case when item_type = 'discount' then abs(quantity * unit_price) else 0 end), 0)
  into v_subtotal, v_discount
  from public.quote_items where quote_id = p_quote_id;
  update public.quotes
  set subtotal = v_subtotal, discount = v_discount,
      total = greatest(0, v_subtotal - v_discount), updated_at = timezone('utc', now())
  where id = p_quote_id and status = 'draft';
end
$$;

create or replace function public.recalculate_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_subtotal numeric; v_discount numeric;
begin
  select
    coalesce(sum(case when item_type <> 'discount' then quantity * unit_price else 0 end), 0),
    coalesce(sum(case when item_type = 'discount' then abs(quantity * unit_price) else 0 end), 0)
  into v_subtotal, v_discount
  from public.invoice_items where invoice_id = p_invoice_id;
  update public.invoices
  set subtotal = v_subtotal, discount = v_discount,
      total = greatest(0, v_subtotal - v_discount), updated_at = timezone('utc', now())
  where id = p_invoice_id and status = 'draft';
end
$$;

create or replace function public.recalculate_quote_from_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.recalculate_quote_totals(coalesce(new.quote_id, old.quote_id));
  return coalesce(new, old);
end
$$;

create or replace function public.recalculate_invoice_from_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.recalculate_invoice_totals(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end
$$;

drop trigger if exists quote_items_recalculate_parent on public.quote_items;
create trigger quote_items_recalculate_parent
after insert or update or delete on public.quote_items
for each row execute function public.recalculate_quote_from_item();

drop trigger if exists invoice_items_recalculate_parent on public.invoice_items;
create trigger invoice_items_recalculate_parent
after insert or update or delete on public.invoice_items
for each row execute function public.recalculate_invoice_from_item();

grant execute on function public.recalculate_quote_totals(uuid) to authenticated;
grant execute on function public.recalculate_invoice_totals(uuid) to authenticated;
revoke execute on function public.recalculate_quote_totals(uuid) from anon, public;
revoke execute on function public.recalculate_invoice_totals(uuid) from anon, public;

create unique index if not exists cash_register_entries_payment_unique
on public.cash_register_entries(payment_id) where payment_id is not null;
create unique index if not exists cash_register_entries_expense_unique
on public.cash_register_entries(expense_id) where expense_id is not null;
create unique index if not exists cash_register_entries_purchase_unique
on public.cash_register_entries(purchase_id) where purchase_id is not null;

create or replace function public.capture_cash_payment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare v_session uuid;
begin
  if new.payment_method <> 'cash' then return new; end if;
  select id into v_session from public.cash_register_sessions where status = 'open' limit 1;
  if v_session is null then raise exception 'Ouvre la caisse avant d enregistrer un paiement en espèces'; end if;
  insert into public.cash_register_entries(session_id,direction,amount,source_type,payment_id,reference,created_by)
  values(v_session,'in',new.amount,'payment',new.id,new.reference,auth.uid())
  on conflict (payment_id) where payment_id is not null do nothing;
  return new;
end
$$;

create or replace function public.capture_cash_expense()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare v_session uuid;
begin
  if new.payment_method <> 'cash' then return new; end if;
  select id into v_session from public.cash_register_sessions where status = 'open' limit 1;
  if v_session is null then raise exception 'Ouvre la caisse avant d enregistrer une dépense en espèces'; end if;
  insert into public.cash_register_entries(session_id,direction,amount,source_type,expense_id,reference,created_by)
  values(v_session,'out',new.amount,'expense',new.id,new.description,auth.uid())
  on conflict (expense_id) where expense_id is not null do nothing;
  return new;
end
$$;

create or replace function public.capture_cash_purchase()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare v_session uuid;
begin
  if new.status <> 'paid' or new.payment_method <> 'cash' then return new; end if;
  select id into v_session from public.cash_register_sessions where status = 'open' limit 1;
  if v_session is null then raise exception 'Ouvre la caisse avant d enregistrer un achat payé en espèces'; end if;
  insert into public.cash_register_entries(session_id,direction,amount,source_type,purchase_id,reference,created_by)
  values(v_session,'out',new.total,'purchase',new.id,new.purchase_number,auth.uid())
  on conflict (purchase_id) where purchase_id is not null do nothing;
  return new;
end
$$;

drop trigger if exists payments_capture_cash on public.payments;
create trigger payments_capture_cash after insert on public.payments
for each row execute function public.capture_cash_payment();

drop trigger if exists expenses_capture_cash on public.business_expenses;
create trigger expenses_capture_cash after insert on public.business_expenses
for each row execute function public.capture_cash_expense();

drop trigger if exists purchases_capture_cash_insert on public.purchases;
create trigger purchases_capture_cash_insert after insert on public.purchases
for each row when (new.status = 'paid' and new.payment_method = 'cash')
execute function public.capture_cash_purchase();

drop trigger if exists purchases_capture_cash_update on public.purchases;
create trigger purchases_capture_cash_update after update of status,payment_method on public.purchases
for each row when (
  new.status = 'paid' and new.payment_method = 'cash'
  and (old.status is distinct from new.status or old.payment_method is distinct from new.payment_method)
)
execute function public.capture_cash_purchase();

commit;
