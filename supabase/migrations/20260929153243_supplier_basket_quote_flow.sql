-- Existing documents keep their original model; only new quotes use service pricing.
alter table public.quotes add column commercial_model text not null default 'legacy'
  check (commercial_model in ('legacy', 'customer_supplied_v1'));
alter table public.quotes alter column commercial_model set default 'customer_supplied_v1';

create table public.quote_parts_baskets (
  quote_id uuid primary key references public.quotes(id) on delete cascade,
  requires_parts boolean not null default true,
  supplier_url text,
  recommended_parts text not null default '',
  revision uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint basket_reference_length check (length(recommended_parts) <= 6000),
  constraint basket_url_safe check (supplier_url is null or (
    length(supplier_url) <= 2000 and supplier_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*[.][A-Za-z0-9-]+(:443)?([/?#][^[:space:]\\]*)?$'
  )),
  constraint basket_without_parts check (requires_parts or (supplier_url is null and recommended_parts = ''))
);
alter table public.quote_parts_baskets enable row level security;
revoke all on public.quote_parts_baskets from public, anon, authenticated;
grant select, insert, update, delete on public.quote_parts_baskets to authenticated;
grant all on public.quote_parts_baskets to service_role;
create policy basket_admin on public.quote_parts_baskets for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy basket_owner_read on public.quote_parts_baskets for select to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id
    and q.user_id = (select auth.uid()) and q.visible_to_client and q.status <> 'draft'));

create function private.guard_quote_parts_basket() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare q public.quotes%rowtype;
begin
  if auth.uid() is null or private.is_admin() is not true then
    raise exception 'Acces administrateur requis.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.quote_id <> old.quote_id then
    raise exception 'Le panier ne peut pas changer de devis.';
  end if;
  select * into q from public.quotes where id = case when tg_op = 'DELETE' then old.quote_id else new.quote_id end for update;
  if not found and tg_op = 'DELETE' then return old; end if;
  if not found or q.status <> 'draft' or q.commercial_model <> 'customer_supplied_v1' then
    raise exception 'Seul le panier d un nouveau devis brouillon est modifiable.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.revision := gen_random_uuid();
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.guard_quote_parts_basket() from public, anon, authenticated;
create trigger guard_quote_parts_basket before insert or update or delete on public.quote_parts_baskets
  for each row execute function private.guard_quote_parts_basket();

create function private.guard_service_quote_line() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare q public.quotes%rowtype;
begin
  if tg_op = 'UPDATE' and new.quote_id <> old.quote_id then raise exception 'Une ligne ne peut pas changer de devis.'; end if;
  select * into q from public.quotes where id = case when tg_op = 'DELETE' then old.quote_id else new.quote_id end for update;
  if found and q.commercial_model = 'customer_supplied_v1' then
    if q.status <> 'draft' then raise exception 'Les lignes du devis publie sont verrouillees.'; end if;
    if tg_op <> 'DELETE' and (new.item_type not in ('labor','other') or new.purchase_mode <> 'customer_supplied') then
      raise exception 'Le devis EDM28 facture les prestations, pas les pieces du fournisseur.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.guard_service_quote_line() from public, anon, authenticated;
create trigger guard_service_quote_line before insert or update or delete on public.quote_items
  for each row execute function private.guard_service_quote_line();

create function private.guard_service_quote_publication() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare b public.quote_parts_baskets%rowtype; expected_subtotal numeric; expected_total numeric;
begin
  if tg_op = 'INSERT' then
    if new.commercial_model <> 'customer_supplied_v1' or new.status <> 'draft' then raise exception 'Un nouveau devis doit etre un brouillon de prestations.'; end if;
    new.visible_to_client := false;
    return new;
  end if;
  if new.commercial_model is distinct from old.commercial_model then raise exception 'Le modele du devis est immuable.'; end if;
  if new.commercial_model <> 'customer_supplied_v1' then return new; end if;
  if old.status <> 'draft' and new.status = 'draft' then raise exception 'Un devis publie ne redevient pas brouillon.'; end if;
  if old.status = 'draft' and new.status not in ('draft','sent','cancelled') then raise exception 'Publication prealable obligatoire.'; end if;
  if new.status = 'draft' then new.visible_to_client := false; end if;
  if old.status <> 'draft' and (new.title, new.description, new.subtotal, new.discount, new.total, new.valid_until, new.user_id, new.vehicle_id, new.quote_number)
    is distinct from (old.title, old.description, old.subtotal, old.discount, old.total, old.valid_until, old.user_id, old.vehicle_id, old.quote_number) then
    raise exception 'Le contenu du devis publie est verrouille.';
  end if;
  if old.status = 'draft' and new.status = 'sent' then
    select * into b from public.quote_parts_baskets where quote_id = new.id;
    if not found or (b.requires_parts and (b.supplier_url is null or btrim(b.recommended_parts) = '')) then
      raise exception 'Panier et references des pieces obligatoires avant publication.';
    end if;
    if new.pdf_path is null or new.pdf_path not like new.user_id::text || '/quote/%' then raise exception 'PDF du devis obligatoire avant publication.'; end if;
    if new.total is null or new.total <= 0 or new.total > 2000000000000 or new.valid_until is null or new.valid_until < current_date or nullif(btrim(new.quote_number), '') is null then
      raise exception 'Montant, numero et validite du devis obligatoires.';
    end if;
    if not exists (select 1 from public.quote_items where quote_id = new.id)
      or exists (select 1 from public.quote_items where quote_id = new.id and (item_type not in ('labor','other') or purchase_mode <> 'customer_supplied')) then
      raise exception 'Le devis doit contenir uniquement les prestations EDM28.';
    end if;
    select round(sum(quantity*unit_price),2), round(sum(quantity*unit_price*(1+vat_rate/100)),2)-new.discount
      into expected_subtotal, expected_total from public.quote_items where quote_id=new.id;
    if new.subtotal is distinct from expected_subtotal or new.total is distinct from expected_total then
      raise exception 'Le total doit correspondre aux seules prestations enregistrees.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_service_quote_publication() from public, anon, authenticated;
create trigger guard_service_quote_publication before insert or update on public.quotes
  for each row execute function private.guard_service_quote_publication();

create function public.admin_save_service_quote(
  p_quote_id uuid, p_quote jsonb, p_items jsonb, p_basket jsonb, p_expected_revision uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  q public.quotes%rowtype; b public.quote_parts_baskets%rowtype; i jsonb;
  qty numeric; price numeric; rate numeric; v_discount numeric;
  v_subtotal numeric := 0; vat numeric := 0; gross numeric; revision uuid; num text; idx integer := 0;
begin
  if auth.uid() is null or private.is_admin() is not true then raise exception 'Acces administrateur requis.' using errcode = '42501'; end if;
  select * into q from public.quotes where id = p_quote_id for update;
  if not found or q.status <> 'draft' or q.commercial_model <> 'customer_supplied_v1' then raise exception 'Seul un nouveau devis brouillon peut etre modifie.'; end if;
  select * into b from public.quote_parts_baskets where quote_id = q.id;
  if b.revision is distinct from p_expected_revision then raise exception 'Le devis a change. Rechargez avant de modifier.' using errcode = '40001'; end if;
  if jsonb_typeof(p_quote) is distinct from 'object' or jsonb_typeof(p_basket) is distinct from 'object'
    or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Donnees de devis invalides.'; end if;
  if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'De 1 a 100 lignes de prestation sont requises.'; end if;
  if jsonb_typeof(p_basket->'requires_parts') is distinct from 'boolean' then raise exception 'Precisez les pieces necessaires.'; end if;
  if coalesce(length(p_quote->>'title'),0) not between 1 and 300 or coalesce(length(p_quote->>'description'),0) > 6000 then raise exception 'Titre ou description invalide.'; end if;
  v_discount := coalesce((p_quote->>'discount')::numeric,0);
  if v_discount < 0 or v_discount > 100000000 or v_discount <> round(v_discount,2) then raise exception 'Remise invalide.'; end if;
  for i in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(i) <> 'object' or coalesce(i->>'item_type','') not in ('labor','other') then raise exception 'Pieces non facturables par EDM28.'; end if;
    if coalesce(length(btrim(i->>'designation')),0) not between 1 and 300 or coalesce(length(i->>'description'),0) > 1200 then raise exception 'Designation invalide.'; end if;
    qty := (i->>'quantity')::numeric; price := (i->>'unit_price')::numeric; rate := coalesce((i->>'vat_rate')::numeric,0);
    if qty is null or qty <= 0 or qty > 10000 or qty <> round(qty,2)
      or price is null or price < 0 or price > 1000000 or price <> round(price,2)
      or rate < 0 or rate > 100 then raise exception 'Quantite, prix ou TVA invalide.'; end if;
    v_subtotal := v_subtotal + qty * price;
    vat := vat + qty * price * rate / 100;
  end loop;
  gross := round(v_subtotal + vat,2);
  if v_discount >= gross then raise exception 'Le total des prestations doit etre positif.'; end if;
  num := coalesce(nullif(btrim(p_quote->>'quote_number'),''), q.quote_number);
  if num is null then num := public.next_document_number('quote'); end if;
  if length(num)>80 then raise exception 'Numero de devis invalide.'; end if;
  insert into public.quote_parts_baskets(quote_id,requires_parts,supplier_url,recommended_parts)
    values(q.id,(p_basket->>'requires_parts')::boolean,nullif(btrim(p_basket->>'supplier_url'),''),coalesce(btrim(p_basket->>'recommended_parts'),''))
    on conflict(quote_id) do update set requires_parts=excluded.requires_parts,supplier_url=excluded.supplier_url,recommended_parts=excluded.recommended_parts
    returning quote_parts_baskets.revision into revision;
  delete from public.quote_items where quote_id = q.id;
  for i in select value from jsonb_array_elements(p_items) loop
    insert into public.quote_items(quote_id,item_type,designation,description,quantity,unit_price,vat_rate,purchase_total,purchase_mode,display_order)
      values(q.id,i->>'item_type',btrim(i->>'designation'),coalesce(nullif(btrim(i->>'description'),''),btrim(i->>'designation')),
        (i->>'quantity')::numeric,(i->>'unit_price')::numeric,coalesce((i->>'vat_rate')::numeric,0),0,'customer_supplied',idx);
    idx := idx + 1;
  end loop;
  update public.quotes set quote_number=num,title=btrim(p_quote->>'title'),description=nullif(btrim(p_quote->>'description'),''),
    subtotal=round(v_subtotal,2),discount=v_discount,total=gross-v_discount,valid_until=nullif(p_quote->>'valid_until','')::date,
    visible_to_client=false,pdf_path=null,updated_at=now() where id=q.id;
  return jsonb_build_object('id',q.id,'revision',revision,'quote_number',num,'total',gross-v_discount);
end;
$$;
revoke all on function public.admin_save_service_quote(uuid,jsonb,jsonb,jsonb,uuid) from public, anon;
grant execute on function public.admin_save_service_quote(uuid,jsonb,jsonb,jsonb,uuid) to authenticated;

create function public.admin_publish_service_quote(p_quote_id uuid,p_revision uuid,p_pdf_path text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare q public.quotes%rowtype; b public.quote_parts_baskets%rowtype;
begin
  if auth.uid() is null or private.is_admin() is not true then raise exception 'Acces administrateur requis.' using errcode = '42501'; end if;
  select * into q from public.quotes where id=p_quote_id for update;
  if not found or q.status <> 'draft' or q.commercial_model <> 'customer_supplied_v1' then raise exception 'Seul un nouveau devis brouillon peut etre publie.'; end if;
  select * into b from public.quote_parts_baskets where quote_id=q.id;
  if not found or b.revision is distinct from p_revision then raise exception 'Le devis a change pendant la generation du PDF.' using errcode = '40001'; end if;
  if p_pdf_path is null or q.pdf_path is distinct from p_pdf_path then raise exception 'PDF non confirme.'; end if;
  update public.quotes set status='sent',visible_to_client=true,updated_at=now() where id=q.id;
  return jsonb_build_object('id',q.id,'status','sent');
end;
$$;
revoke all on function public.admin_publish_service_quote(uuid,uuid,text) from public, anon;
grant execute on function public.admin_publish_service_quote(uuid,uuid,text) to authenticated;

create function private.guard_service_invoice_line() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare model text;
begin
  select q.commercial_model into model from public.invoices i join public.quotes q on q.id=i.quote_id
    where i.id=new.invoice_id;
  if model = 'customer_supplied_v1' and new.item_type not in ('labor','other') then
    raise exception 'Seules les prestations sont facturees par EDM28, les pieces sont payees au fournisseur.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_service_invoice_line() from public, anon, authenticated;
create trigger guard_service_invoice_line before insert or update on public.invoice_items
  for each row execute function private.guard_service_invoice_line();

-- Retire new mandates without altering existing records or historical settlement guards.
create function private.reject_new_disbursement() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Ancien parcours desactive : le client achete et apporte les pieces du panier joint au devis.';
end;
$$;
revoke all on function private.reject_new_disbursement() from public, anon, authenticated;
create trigger reject_new_disbursement before insert on public.disbursements
  for each row execute function private.reject_new_disbursement();
notify pgrst, 'reload schema';
