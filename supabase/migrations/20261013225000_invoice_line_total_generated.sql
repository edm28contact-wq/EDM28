-- Compatible with public.invoice_items.line_total GENERATED ALWAYS AS (quantity * unit_price).
-- Update function definition only: no invoices, clients or accounting records are modified.
-- This preserves all existing authorization and accounting conditions in the deployed function.
CREATE OR REPLACE FUNCTION private.admin_finalize_repair_order(p_order_id uuid, p_invoice_number text, p_due_days integer DEFAULT 30)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not private.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = '42501';
  end if;
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
  where repair_order_id = v_order.id
     or external_invoice_id = 'repair-order/' || v_order.id::text
  order by created_at
  limit 1;

  if v_order.status = 'invoiced' and v_invoice_id is not null then return v_invoice_id; end if;

  select
    coalesce(sum(coalesce(qi.quantity, 1) * coalesce(qi.unit_price, 0)), 0),
    coalesce(sum(coalesce(qi.quantity, 1) * coalesce(qi.unit_price, 0) * coalesce(qi.vat_rate, 0) / 100), 0)
  into v_business_subtotal, v_business_vat
  from public.quote_items qi
  where qi.quote_id = v_quote.id
    and coalesce(qi.purchase_mode, 'resale') not in ('client_direct', 'disbursement');

  select coalesce(sum(d.amount), 0)
  into v_disbursement_total
  from public.disbursements d
  where d.quote_id = v_quote.id
    and d.status in ('eligible', 'reimbursed');

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
      source_quote_item_id, supplier_reference,
      display_order, vat_rate, purchase_total, margin_amount
    )
    select
      v_invoice_id,
      case when qi.item_type in ('labor','part','delivery','discount','other') then qi.item_type else 'other' end,
      coalesce(nullif(qi.description, ''), nullif(qi.designation, ''), 'Prestation'),
      coalesce(qi.quantity, 1),
      coalesce(qi.unit_price, 0),
      qi.id,
      qi.supplier_reference,
      coalesce(qi.display_order, 0),
      coalesce(qi.vat_rate, 0),
      coalesce(qi.purchase_total, 0),
      (coalesce(qi.quantity, 1) * coalesce(qi.unit_price, 0)) - coalesce(qi.purchase_total, 0)
    from public.quote_items qi
    where qi.quote_id = v_order.quote_id
      and coalesce(qi.purchase_mode, 'resale') not in ('client_direct', 'disbursement')
    order by qi.display_order;

    insert into public.invoice_items(
      invoice_id, item_type, description, quantity, unit_price,
      source_quote_item_id, supplier_reference,
      display_order, vat_rate, purchase_total, margin_amount
    )
    select
      v_invoice_id,
      'disbursement',
      'Débours client — ' || coalesce(nullif(d.description, ''), nullif(qi.designation, ''), 'Achat pour compte du client'),
      1,
      d.amount,
      qi.id,
      qi.supplier_reference,
      coalesce(qi.display_order, 0) + 1000,
      0,
      d.amount,
      0
    from public.disbursements d
    join public.quote_items qi on qi.id = d.quote_item_id
    where d.quote_id = v_order.quote_id
      and d.status in ('eligible', 'reimbursed')
    order by qi.display_order;

    select count(*) into v_item_count from public.invoice_items where invoice_id = v_invoice_id;
    if v_item_count = 0 then
      insert into public.invoice_items(
        invoice_id, item_type, description, quantity, unit_price, display_order, vat_rate, purchase_total, margin_amount
      ) values (
        v_invoice_id, 'labor', 'Prestations selon devis accepté', 1,
        coalesce(v_quote.total, 0), 0, 0, 0, coalesce(v_quote.total, 0)
      );
    end if;
  end if;

  update public.disbursements
  set invoice_id = v_invoice_id
  where quote_id = v_order.quote_id
    and status in ('eligible', 'reimbursed');

  update public.repair_orders
  set status = 'invoiced', updated_at = timezone('utc', now())
  where id = v_order.id and status = 'completed';

  if not found and v_order.status <> 'invoiced' then raise exception 'Le statut atelier a changé.'; end if;
  return v_invoice_id;
end;
$function$
;
