begin;

create index if not exists backoffice_configuration_updated_by_idx on public.backoffice_configuration(updated_by);
create index if not exists accounting_parameters_updated_by_idx on public.accounting_parameters(updated_by);
create index if not exists suppliers_created_by_idx on public.suppliers(created_by);
create index if not exists purchases_created_by_idx on public.purchases(created_by);
create index if not exists purchase_items_vehicle_id_idx on public.purchase_items(vehicle_id);
create index if not exists purchase_items_repair_order_id_idx on public.purchase_items(repair_order_id);
create index if not exists business_expenses_created_by_idx on public.business_expenses(created_by);
create index if not exists tax_obligations_created_by_idx on public.tax_obligations(created_by);
create index if not exists cash_register_sessions_created_by_idx on public.cash_register_sessions(created_by);
create index if not exists cash_register_sessions_closed_by_idx on public.cash_register_sessions(closed_by);
create index if not exists cash_register_entries_created_by_idx on public.cash_register_entries(created_by);
create index if not exists invoice_items_source_purchase_item_id_idx on public.invoice_items(source_purchase_item_id);

create or replace function public.admin_save_purchase(p_purchase jsonb,p_items jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_item jsonb; v_total numeric:=0; v_status text:=coalesce(nullif(p_purchase->>'status',''),'draft'); v_supplier uuid:=nullif(p_purchase->>'supplier_id','')::uuid;
begin
 if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Au moins une ligne d achat est obligatoire'; end if;
 if nullif(p_purchase->>'purchase_date','') is null then raise exception 'Date d achat obligatoire'; end if;
 if v_status not in ('draft','validated','paid') then raise exception 'Statut d achat invalide'; end if;
 if v_status<>'draft' and (v_supplier is null or nullif(trim(p_purchase->>'purchase_number'),'') is null or nullif(trim(p_purchase->>'document_path'),'') is null) then raise exception 'Fournisseur, numéro et facture fournisseur obligatoires pour valider'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
   if nullif(trim(v_item->>'description'),'') is null then raise exception 'Description de ligne obligatoire'; end if;
   if coalesce((v_item->>'quantity')::numeric,0)<=0 or coalesce((v_item->>'unit_cost')::numeric,-1)<0 then raise exception 'Quantité ou coût invalide'; end if;
   v_total:=v_total+(v_item->>'quantity')::numeric*(v_item->>'unit_cost')::numeric;
 end loop;
 insert into public.purchases(supplier_id,purchase_number,purchase_date,invoice_date,status,payment_method,paid_at,total,document_path,notes,created_by)
 values(v_supplier,nullif(trim(p_purchase->>'purchase_number'),''),(p_purchase->>'purchase_date')::date,nullif(p_purchase->>'invoice_date','')::date,v_status,nullif(p_purchase->>'payment_method',''),nullif(p_purchase->>'paid_at','')::timestamptz,v_total,nullif(trim(p_purchase->>'document_path'),''),nullif(trim(p_purchase->>'notes'),''),auth.uid()) returning id into v_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
   insert into public.purchase_items(purchase_id,category,description,quantity,unit_cost,part_reference,supplier_reference,vehicle_id,repair_order_id)
   values(v_id,v_item->>'category',trim(v_item->>'description'),(v_item->>'quantity')::numeric,(v_item->>'unit_cost')::numeric,nullif(trim(v_item->>'part_reference'),''),nullif(trim(v_item->>'supplier_reference'),''),nullif(v_item->>'vehicle_id','')::uuid,nullif(v_item->>'repair_order_id','')::uuid);
 end loop;
 return v_id;
end $$;

create or replace function public.admin_validate_quote_for_publication(p_quote_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
 if exists(select 1 from public.quote_items qi where qi.quote_id=p_quote_id and qi.item_type='disbursement' and (qi.purchase_total is null or qi.purchase_total<>qi.quantity*qi.unit_price or qi.supplier_invoice_holder<>'customer' or nullif(trim(qi.customer_mandate_reference),'') is null or nullif(trim(qi.customer_mandate_path),'') is null or nullif(trim(qi.supplier_document_path),'') is null)) then raise exception 'Débours incomplet dans le devis'; end if;
 return true;
end $$;

create or replace function public.admin_validate_invoice_for_issue(p_invoice_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
 if exists(select 1 from public.invoice_items ii where ii.invoice_id=p_invoice_id and ((ii.item_type='part' and ii.part_handling_mode='resale' and (ii.purchase_total is null or ii.supplier_invoice_holder<>'business' or nullif(trim(ii.business_purchase_reference),'') is null or nullif(trim(ii.supplier_document_path),'') is null)) or (ii.item_type='disbursement' and (ii.purchase_total is null or ii.purchase_total<>ii.quantity*ii.unit_price or ii.supplier_invoice_holder<>'customer' or nullif(trim(ii.customer_mandate_reference),'') is null or nullif(trim(ii.customer_mandate_path),'') is null or nullif(trim(ii.supplier_document_path),'') is null)))) then raise exception 'Lignes de pièces ou débours incomplètes'; end if;
 return true;
end $$;

grant execute on function public.admin_save_purchase(jsonb,jsonb),public.admin_validate_quote_for_publication(uuid),public.admin_validate_invoice_for_issue(uuid) to authenticated;
revoke execute on function public.admin_save_purchase(jsonb,jsonb),public.admin_validate_quote_for_publication(uuid),public.admin_validate_invoice_for_issue(uuid) from anon,public;

commit;
