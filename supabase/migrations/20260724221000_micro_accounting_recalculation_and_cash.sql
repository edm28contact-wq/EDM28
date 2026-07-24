begin;

create or replace function public.recalculate_quote_totals(p_quote_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subtotal numeric;
  v_discount numeric;
begin
  select
    coalesce(sum(case when item_type <> 'discount' then quantity * unit_price else 0 end), 0),
    coalesce(sum(case when item_type = 'discount' then abs(quantity * unit_price) else 0 end), 0)
  into v_subtotal, v_discount
  from public.quote_items
  where quote_id = p_quote_id;

  update public.quotes
  set subtotal = v_subtotal,
      discount = v_discount,
      total = greatest(0, v_subtotal - v_discount),
      updated_at = timezone('utc', now())
  where id = p_quote_id and status = 'draft';
end
$$;

create or replace function public.recalculate_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subtotal numeric;
  v_discount numeric;
begin
  select
    coalesce(sum(case when item_type <> 'discount' then quantity * unit_price else 0 end), 0),
    coalesce(sum(case when item_type = 'discount' then abs(quantity * unit_price) else 0 end), 0)
  into v_subtotal, v_discount
  from public.invoice_items
  where invoice_id = p_invoice_id;

  update public.invoices
  set subtotal = v_subtotal,
      discount = v_discount,
      total = greatest(0, v_subtotal - v_discount),
      updated_at = timezone('utc', now())
  where id = p_invoice_id and status = 'draft';
end
$$;

grant execute on function public.recalculate_quote_totals(uuid) to authenticated;
grant execute on function public.recalculate_invoice_totals(uuid) to authenticated;
revoke execute on function public.recalculate_quote_totals(uuid) from anon, public;
revoke execute on function public.recalculate_invoice_totals(uuid) from anon, public;

create or replace function public.admin_save_document_item(
  p_document_type text,
  p_document_id uuid,
  p_item_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_mode text := p_payload ->> 'part_handling_mode';
  v_qty numeric := coalesce((p_payload ->> 'quantity')::numeric, 0);
  v_unit numeric := coalesce((p_payload ->> 'unit_price')::numeric, -1);
  v_purchase numeric := nullif(p_payload ->> 'purchase_total', '')::numeric;
  v_item_type text;
  v_config public.backoffice_configuration%rowtype;
begin
  if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  select * into v_config from public.backoffice_configuration where id = true;
  if coalesce((v_config.enabled_modules ->> 'parts')::boolean, false) is not true then raise exception 'Module pièces désactivé'; end if;
  if v_mode not in ('resale','customer_supplied','disbursement') then raise exception 'Mode de pièce invalide'; end if;
  if v_mode = 'resale' and not v_config.allow_part_resale then raise exception 'Revente désactivée'; end if;
  if v_mode = 'customer_supplied' and not v_config.allow_customer_supplied_parts then raise exception 'Pièces client désactivées'; end if;
  if v_mode = 'disbursement' and not v_config.allow_disbursements then raise exception 'Débours désactivés'; end if;
  if nullif(trim(p_payload ->> 'description'), '') is null or v_qty <= 0 or v_unit < 0 then raise exception 'Description, quantité et prix valides obligatoires'; end if;

  if v_mode = 'customer_supplied' and (v_unit <> 0 or coalesce(v_purchase, 0) <> 0) then
    raise exception 'Une pièce fournie par le client doit rester à 0 euro';
  end if;

  if v_mode = 'resale' and p_document_type = 'invoice' and (
    v_purchase is null
    or p_payload ->> 'supplier_invoice_holder' <> 'business'
    or nullif(trim(p_payload ->> 'business_purchase_reference'), '') is null
    or nullif(trim(p_payload ->> 'supplier_document_path'), '') is null
  ) then raise exception 'Coût, référence et facture fournisseur EDM28 obligatoires pour une revente'; end if;

  if v_mode = 'disbursement' and (
    v_purchase is null
    or v_purchase <> v_qty * v_unit
    or p_payload ->> 'supplier_invoice_holder' <> 'customer'
    or nullif(trim(p_payload ->> 'customer_mandate_reference'), '') is null
    or nullif(trim(p_payload ->> 'customer_mandate_path'), '') is null
    or nullif(trim(p_payload ->> 'supplier_document_path'), '') is null
  ) then raise exception 'Débours incomplet : mandat, facture client, justificatifs et remboursement exact obligatoires'; end if;

  v_item_type := case when v_mode = 'disbursement' then 'disbursement' else 'part' end;

  if p_document_type = 'quote' then
    if not exists(select 1 from public.quotes where id = p_document_id and status = 'draft') then raise exception 'Seul un devis brouillon peut être modifié'; end if;
    if p_item_id is null then
      insert into public.quote_items(
        quote_id, item_type, description, quantity, unit_price, display_order,
        part_handling_mode, purchase_total, supplier_invoice_holder,
        customer_mandate_reference, customer_mandate_path, supplier_document_path,
        business_purchase_reference, supplier_reference, vat_rate
      ) values (
        p_document_id, v_item_type, trim(p_payload ->> 'description'), v_qty, v_unit,
        coalesce((p_payload ->> 'display_order')::integer, 0), v_mode, v_purchase,
        nullif(p_payload ->> 'supplier_invoice_holder', ''), nullif(trim(p_payload ->> 'customer_mandate_reference'), ''),
        nullif(trim(p_payload ->> 'customer_mandate_path'), ''), nullif(trim(p_payload ->> 'supplier_document_path'), ''),
        nullif(trim(p_payload ->> 'business_purchase_reference'), ''), nullif(trim(p_payload ->> 'supplier_reference'), ''),
        nullif(p_payload ->> 'vat_rate', '')::numeric
      ) returning id into v_id;
    else
      update public.quote_items set
        item_type = v_item_type, description = trim(p_payload ->> 'description'), quantity = v_qty,
        unit_price = v_unit, part_handling_mode = v_mode, purchase_total = v_purchase,
        supplier_invoice_holder = nullif(p_payload ->> 'supplier_invoice_holder', ''),
        customer_mandate_reference = nullif(trim(p_payload ->> 'customer_mandate_reference'), ''),
        customer_mandate_path = nullif(trim(p_payload ->> 'customer_mandate_path'), ''),
        supplier_document_path = nullif(trim(p_payload ->> 'supplier_document_path'), ''),
        business_purchase_reference = nullif(trim(p_payload ->> 'business_purchase_reference'), ''),
        supplier_reference = nullif(trim(p_payload ->> 'supplier_reference'), ''),
        vat_rate = nullif(p_payload ->> 'vat_rate', '')::numeric
      where id = p_item_id and quote_id = p_document_id returning id into v_id;
    end if;
    perform public.recalculate_quote_totals(p_document_id);
  elsif p_document_type = 'invoice' then
    if not exists(select 1 from public.invoices where id = p_document_id and status = 'draft') then raise exception 'Seule une facture brouillon peut être modifiée'; end if;
    if p_item_id is null then
      insert into public.invoice_items(
        invoice_id, item_type, description, quantity, unit_price, display_order,
        part_handling_mode, purchase_total, supplier_invoice_holder,
        customer_mandate_reference, customer_mandate_path, supplier_document_path,
        business_purchase_reference, supplier_reference, vat_rate, source_purchase_item_id
      ) values (
        p_document_id, v_item_type, trim(p_payload ->> 'description'), v_qty, v_unit,
        coalesce((p_payload ->> 'display_order')::integer, 0), v_mode, v_purchase,
        nullif(p_payload ->> 'supplier_invoice_holder', ''), nullif(trim(p_payload ->> 'customer_mandate_reference'), ''),
        nullif(trim(p_payload ->> 'customer_mandate_path'), ''), nullif(trim(p_payload ->> 'supplier_document_path'), ''),
        nullif(trim(p_payload ->> 'business_purchase_reference'), ''), nullif(trim(p_payload ->> 'supplier_reference'), ''),
        nullif(p_payload ->> 'vat_rate', '')::numeric, nullif(p_payload ->> 'source_purchase_item_id', '')::uuid
      ) returning id into v_id;
    else
      update public.invoice_items set
        item_type = v_item_type, description = trim(p_payload ->> 'description'), quantity = v_qty,
        unit_price = v_unit, part_handling_mode = v_mode, purchase_total = v_purchase,
        supplier_invoice_holder = nullif(p_payload ->> 'supplier_invoice_holder', ''),
        customer_mandate_reference = nullif(trim(p_payload ->> 'customer_mandate_reference'), ''),
        customer_mandate_path = nullif(trim(p_payload ->> 'customer_mandate_path'), ''),
        supplier_document_path = nullif(trim(p_payload ->> 'supplier_document_path'), ''),
        business_purchase_reference = nullif(trim(p_payload ->> 'business_purchase_reference'), ''),
        supplier_reference = nullif(trim(p_payload ->> 'supplier_reference'), ''),
        vat_rate = nullif(p_payload ->> 'vat_rate', '')::numeric,
        source_purchase_item_id = nullif(p_payload ->> 'source_purchase_item_id', '')::uuid
      where id = p_item_id and invoice_id = p_document_id returning id into v_id;
    end if;
    perform public.recalculate_invoice_totals(p_document_id);
  else
    raise exception 'Type de document invalide';
  end if;

  if v_id is null then raise exception 'Ligne introuvable'; end if;
  return v_id;
end
$$;

create or replace function public.admin_delete_document_item(p_document_type text, p_document_id uuid, p_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  if p_document_type = 'quote' then
    if not exists(select 1 from public.quotes where id = p_document_id and status = 'draft') then raise exception 'Devis verrouillé'; end if;
    delete from public.quote_items where id = p_item_id and quote_id = p_document_id;
    perform public.recalculate_quote_totals(p_document_id);
  elsif p_document_type = 'invoice' then
    if not exists(select 1 from public.invoices where id = p_document_id and status = 'draft') then raise exception 'Facture verrouillée'; end if;
    delete from public.invoice_items where id = p_item_id and invoice_id = p_document_id;
    perform public.recalculate_invoice_totals(p_document_id);
  else
    raise exception 'Type de document invalide';
  end if;
end
$$;

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
  values(v_session,'in',new.amount,'payment',new.id,new.reference,auth.uid());
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
  values(v_session,'out',new.amount,'expense',new.id,new.description,auth.uid());
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
  values(v_session,'out',new.total,'purchase',new.id,new.purchase_number,auth.uid());
  return new;
end
$$;

drop trigger if exists payments_capture_cash on public.payments;
create trigger payments_capture_cash after insert on public.payments
for each row execute function public.capture_cash_payment();

drop trigger if exists expenses_capture_cash on public.business_expenses;
create trigger expenses_capture_cash after insert on public.business_expenses
for each row execute function public.capture_cash_expense();

drop trigger if exists purchases_capture_cash on public.purchases;
create trigger purchases_capture_cash after insert or update of status,payment_method on public.purchases
for each row when (new.status = 'paid' and new.payment_method = 'cash' and (tg_op = 'INSERT' or old.status is distinct from new.status or old.payment_method is distinct from new.payment_method))
execute function public.capture_cash_purchase();

commit;
