-- Existing quotes, appointments and issued documents are preserved.
alter table public.quote_parts_baskets
  add column price_details text not null default '' check(length(price_details)<=6000),
  add column price_observed_at date;
alter table public.quote_parts_baskets add constraint basket_prices_without_parts
  check(requires_parts or (price_details='' and price_observed_at is null));
alter table public.repair_orders add column completed_at timestamptz;

create or replace function public.admin_save_service_quote(
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
  insert into public.quote_parts_baskets(quote_id,requires_parts,supplier_url,recommended_parts,price_details,price_observed_at)
    values(q.id,(p_basket->>'requires_parts')::boolean,nullif(btrim(p_basket->>'supplier_url'),''),coalesce(btrim(p_basket->>'recommended_parts'),''),coalesce(btrim(p_basket->>'price_details'),''),nullif(p_basket->>'price_observed_at','')::date)
    on conflict(quote_id) do update set requires_parts=excluded.requires_parts,supplier_url=excluded.supplier_url,recommended_parts=excluded.recommended_parts,price_details=excluded.price_details,price_observed_at=excluded.price_observed_at
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


create table public.booking_reservations (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id),
  user_id uuid not null references public.profiles(id),
  vehicle_id uuid not null references public.vehicles(id),
  starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null default 'held' check(status in ('held','review_pending','confirmed','expired','rejected','cancelled')),
  expires_at timestamptz not null default now()+interval '48 hours',
  proof_path text, proof_received_at timestamptz, review_deadline timestamptz,
  review_note text check(length(review_note)<=2000), reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
  appointment_id uuid references public.appointments(id), repair_order_id uuid references public.repair_orders(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(ends_at>starts_at), check(expires_at>created_at),
  check(status<>'review_pending' or review_deadline is not null),
  check(status<>'confirmed' or (appointment_id is not null and repair_order_id is not null))
);
create unique index booking_one_active_quote on public.booking_reservations(quote_id) where status in ('held','review_pending','confirmed');
create index booking_reservations_user on public.booking_reservations(user_id,created_at desc);
create index booking_reservations_slots on public.booking_reservations(starts_at,ends_at) where status in ('held','review_pending');
alter table public.booking_reservations enable row level security;
revoke all on public.booking_reservations from public,anon,authenticated;
grant select on public.booking_reservations to authenticated;
grant all on public.booking_reservations to service_role;
create policy reservation_read on public.booking_reservations for select to authenticated
 using(user_id=(select auth.uid()) or (select private.is_admin()));

-- Email delivery capabilities are generated only by the database scheduler.
-- A capability can read/acknowledge one immutable message during its short lease.
create table public.journey_email_deliveries (
 id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.booking_reservations(id),
 kind text not null check(kind in ('held','proof_received','confirmed','reminder','expired','rejected','completed')),
 dedupe_key text not null unique, payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','dispatching','sending','sent','failed','cancelled')),
 available_at timestamptz not null default now(), created_at timestamptz not null default now(),
 attempts integer not null default 0, dispatch_hash text, lease_until timestamptz,
 provider_message_id text, last_error text, sent_at timestamptz
);
alter table public.journey_email_deliveries enable row level security;
revoke all on public.journey_email_deliveries from public,anon,authenticated;
grant select(id,payload,status,lease_until),update(status,provider_message_id,last_error) on public.journey_email_deliveries to anon;
grant all on public.journey_email_deliveries to service_role;
create index journey_deliveries_pending on public.journey_email_deliveries(available_at) where status in ('pending','dispatching','sending');
create policy delivery_capability_read on public.journey_email_deliveries for select to anon using(
 lease_until>now() and status in ('dispatching','sending','sent','pending','failed') and
 dispatch_hash=encode(extensions.digest(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-edm-delivery-token',''),'sha256'),'hex')
);
create policy delivery_capability_ack on public.journey_email_deliveries for update to anon using(
 lease_until>now() and status in ('dispatching','sending') and
 dispatch_hash=encode(extensions.digest(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-edm-delivery-token',''),'sha256'),'hex')
) with check(
 lease_until>now() and status in ('sending','sent','pending','failed') and
 dispatch_hash=encode(extensions.digest(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-edm-delivery-token',''),'sha256'),'hex')
);

create table private.journey_settings(id boolean primary key default true check(id), enabled boolean not null default false);
insert into private.journey_settings(id,enabled) values(true,false);
revoke all on private.journey_settings from public,anon,authenticated;

create function private.queue_journey_email(p_reservation uuid,p_kind text,p_suffix text default '') returns void
language plpgsql security definer set search_path='' as $$
declare r public.booking_reservations%rowtype; q public.quotes%rowtype; b public.quote_parts_baskets%rowtype; recipient text; settings public.automation_settings%rowtype; payload jsonb;
begin
 select * into r from public.booking_reservations where id=p_reservation;
 if not found then return; end if;
 select * into q from public.quotes where id=r.quote_id;
 select * into b from public.quote_parts_baskets where quote_id=q.id;
 select * into settings from public.automation_settings where id=true;
 select email into recipient from public.profiles where id=r.user_id;
 if settings.test_mode is true then recipient:=settings.test_recipient; end if;
 payload:=jsonb_build_object('recipient',recipient,'kind',p_kind,'quote_id',q.id,'quote_number',q.quote_number,'title',q.title,
 'starts_at',r.starts_at,'expires_at',r.expires_at,'review_deadline',r.review_deadline,'review_note',r.review_note,
 'requires_parts',coalesce(b.requires_parts,false),'supplier_url',b.supplier_url,'recommended_parts',b.recommended_parts,
 'price_details',b.price_details,'price_observed_at',b.price_observed_at,'repair_order_id',r.repair_order_id,
 'contact_email','contact@edm28.fr','address',(select concat_ws(', ',nullif(address_line1,''),nullif(address_line2,''),nullif(concat_ws(' ',postal_code,city),'')) from public.business_configuration where id=true));
 insert into public.journey_email_deliveries(reservation_id,kind,dedupe_key,payload)
 values(r.id,p_kind,r.id::text||'/'||p_kind||'/'||p_suffix,payload) on conflict(dedupe_key) do nothing;
end; $$;
revoke all on function private.queue_journey_email(uuid,text,text) from public,anon,authenticated;

create function private.journey_slots(p_quote_id uuid,p_from date,p_days integer)
returns table(starts_at timestamptz,ends_at timestamptz) language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Connexion requise.' using errcode='42501'; end if;
 return query select s.starts_at,s.ends_at from public.get_available_booking_slots(p_quote_id,coalesce(p_from,current_date),greatest(1,least(coalesce(p_days,21),60))) s
 where not exists(select 1 from public.booking_reservations r where
 (r.status='review_pending' or (r.status='held' and r.expires_at>now()))
 and r.starts_at<s.ends_at+interval '30 minutes' and r.ends_at+interval '30 minutes'>s.starts_at);
end; $$;
revoke all on function private.journey_slots(uuid,date,integer) from public,anon;
grant execute on function private.journey_slots(uuid,date,integer) to authenticated;
create function public.get_reservation_slots(p_quote_id uuid,p_from date default current_date,p_days integer default 21)
returns table(starts_at timestamptz,ends_at timestamptz) language sql security invoker set search_path='' as $$ select * from private.journey_slots(p_quote_id,p_from,p_days) $$;
revoke all on function public.get_reservation_slots(uuid,date,integer) from public,anon;
grant execute on function public.get_reservation_slots(uuid,date,integer) to authenticated;

create function private.reserve_quote(p_quote_id uuid,p_starts_at timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype; r public.booking_reservations%rowtype; end_time timestamptz; needs_parts boolean;
begin
 if auth.uid() is null then raise exception 'Connexion requise.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('edm28-booking'));
 select * into q from public.quotes where id=p_quote_id and user_id=auth.uid() and visible_to_client for update;
 if not found or q.status<>'accepted' then raise exception 'Devis accepte introuvable.' using errcode='42501'; end if;
 if q.commercial_model<>'customer_supplied_v1' then raise exception 'Contactez EDM28 pour planifier cet ancien devis.'; end if;
 select * into r from public.booking_reservations where quote_id=q.id and status in ('held','review_pending','confirmed') for update;
 if found and not(r.status='held' and r.expires_at<=now()) then
   if r.starts_at=p_starts_at then return r.id; end if;
   raise exception 'Un creneau est deja reserve pour ce devis.';
 end if;
 if r.id is not null then
   update public.booking_reservations set status='expired',updated_at=now() where id=r.id;
   perform private.queue_journey_email(r.id,'expired');
 end if;
 select s.ends_at into end_time from public.get_reservation_slots(q.id,(p_starts_at at time zone 'Europe/Paris')::date,1) s where s.starts_at=p_starts_at;
 if end_time is null then raise exception 'Ce creneau n est plus disponible. Choisissez une autre date.'; end if;
 select requires_parts into needs_parts from public.quote_parts_baskets where quote_id=q.id;
 if not found then raise exception 'Le devis doit preciser les pieces necessaires.'; end if;
 insert into public.booking_reservations(quote_id,user_id,vehicle_id,starts_at,ends_at,status,review_deadline)
 values(q.id,q.user_id,q.vehicle_id,p_starts_at,end_time,case when needs_parts then 'held' else 'review_pending' end,
 case when needs_parts then null else now()+interval '24 hours' end) returning * into r;
 perform private.queue_journey_email(r.id,case when needs_parts then 'held' else 'proof_received' end);
 return r.id;
end; $$;
revoke all on function private.reserve_quote(uuid,timestamptz) from public,anon;
grant execute on function private.reserve_quote(uuid,timestamptz) to authenticated;
create function public.reserve_quote_slot(p_quote_id uuid,p_starts_at timestamptz) returns uuid
language sql security invoker set search_path='' as $$ select private.reserve_quote(p_quote_id,p_starts_at) $$;
revoke all on function public.reserve_quote_slot(uuid,timestamptz) from public,anon;
grant execute on function public.reserve_quote_slot(uuid,timestamptz) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('purchase-proofs','purchase-proofs',false,10485760,array['application/pdf','image/jpeg','image/png']);
create policy purchase_proof_insert on storage.objects for insert to authenticated with check(
 bucket_id='purchase-proofs' and (storage.foldername(name))[1]=auth.uid()::text and
 exists(select 1 from public.booking_reservations r where r.id::text=(storage.foldername(name))[2] and r.user_id=auth.uid() and r.status='held' and r.expires_at>now())
);
create policy purchase_proof_read on storage.objects for select to authenticated using(
 bucket_id='purchase-proofs' and ((storage.foldername(name))[1]=auth.uid()::text or (select private.is_admin()))
);

create function private.submit_purchase_proof(p_reservation_id uuid,p_path text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.booking_reservations%rowtype; obj storage.objects%rowtype;
begin
 if auth.uid() is null then raise exception 'Connexion requise.' using errcode='42501'; end if;
 select * into r from public.booking_reservations where id=p_reservation_id and user_id=auth.uid() for update;
 if not found then raise exception 'Reservation introuvable.' using errcode='42501'; end if;
 if r.status='review_pending' and r.proof_path=p_path then return; end if;
 if r.status<>'held' or r.expires_at<=now() then raise exception 'Le delai de 48 h est termine. Choisissez un nouveau creneau.'; end if;
 if p_path is null or split_part(p_path,'/',1)<>r.user_id::text or split_part(p_path,'/',2)<>r.id::text or length(p_path)>200 then raise exception 'Justificatif invalide.'; end if;
 select * into obj from storage.objects where bucket_id='purchase-proofs' and name=p_path;
 if not found or coalesce(obj.metadata->>'mimetype','') not in ('application/pdf','image/jpeg','image/png')
 or coalesce((obj.metadata->>'size')::bigint,0) not between 1 and 10485760 then raise exception 'Justificatif non recu ou format invalide.'; end if;
 update public.booking_reservations set proof_path=p_path,proof_received_at=now(),review_deadline=now()+interval '24 hours',status='review_pending',updated_at=now() where id=r.id;
 perform private.queue_journey_email(r.id,'proof_received');
end; $$;
revoke all on function private.submit_purchase_proof(uuid,text) from public,anon;
grant execute on function private.submit_purchase_proof(uuid,text) to authenticated;
create function public.submit_reservation_proof(p_reservation_id uuid,p_path text) returns void
language sql security invoker set search_path='' as $$ select private.submit_purchase_proof(p_reservation_id,p_path) $$;
revoke all on function public.submit_reservation_proof(uuid,text) from public,anon;
grant execute on function public.submit_reservation_proof(uuid,text) to authenticated;

create function private.guard_reserved_appointment() returns trigger
language plpgsql security definer set search_path='' as $$
declare model text; r public.booking_reservations%rowtype;
begin
 if new.status in ('cancelled','completed') then return new; end if;
 perform pg_advisory_xact_lock(hashtext('edm28-booking'));
 if new.external_appointment_id like 'quote/%' then
   select commercial_model into model from public.quotes where 'quote/'||id::text=new.external_appointment_id;
   if model='customer_supplied_v1' then raise exception 'Utilisez la pre-reservation et la validation du justificatif.'; end if;
 end if;
 if new.external_appointment_id like 'reservation/%' then
   select * into r from public.booking_reservations where 'reservation/'||id::text=new.external_appointment_id;
   if not found or r.status not in ('review_pending','confirmed') or (r.user_id,r.vehicle_id,r.starts_at,r.ends_at)
     is distinct from (new.user_id,new.vehicle_id,new.starts_at,new.ends_at) then raise exception 'Reservation non validee ou dates incoherentes.'; end if;
   if new.status='confirmed' and not exists(select 1 from public.repair_orders o join public.quotes q on q.id=o.quote_id where o.id=r.repair_order_id and q.status='accepted' and o.status in ('ready','signed','in_progress') and o.pdf_path like r.user_id::text||'/order/'||o.id::text||'-%' and exists(select 1 from storage.objects where bucket_id='repair-documents' and name=o.pdf_path)) then
     raise exception 'Le devis accepte et son ordre de reparation doivent etre verifies avant confirmation.';
   end if;
 end if;
 if exists(select 1 from public.booking_reservations b where b.id is distinct from r.id
   and (b.status='review_pending' or (b.status='held' and b.expires_at>now()))
   and b.starts_at<coalesce(new.ends_at,new.starts_at+interval '1 hour')+interval '30 minutes'
   and b.ends_at+interval '30 minutes'>new.starts_at) then raise exception 'Ce creneau est deja pre-reserve.'; end if;
 return new;
end; $$;
revoke all on function private.guard_reserved_appointment() from public,anon,authenticated;
create trigger guard_reserved_appointment before insert or update of starts_at,ends_at,status on public.appointments
 for each row execute function private.guard_reserved_appointment();

create function private.prepare_reservation(p_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.booking_reservations%rowtype; q public.quotes%rowtype; aid uuid; oid uuid; work jsonb;
begin
 if auth.uid() is null or private.is_admin() is not true then raise exception 'Acces administrateur requis.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('edm28-booking'));
 select * into r from public.booking_reservations where id=p_id for update;
 if not found or r.status<>'review_pending' or r.starts_at<=now() then raise exception 'Reservation non validable.'; end if;
 select * into q from public.quotes where id=r.quote_id;
 if q.status<>'accepted' then raise exception 'Le devis doit etre accepte.'; end if;
 if exists(select 1 from public.quote_parts_baskets where quote_id=q.id and requires_parts) and r.proof_path is null then raise exception 'Justificatif obligatoire.'; end if;
 if r.repair_order_id is not null then return r.repair_order_id; end if;
 if exists(select 1 from public.appointments a where a.status not in ('cancelled','completed')
   and a.starts_at<r.ends_at+interval '30 minutes' and coalesce(a.ends_at,a.starts_at+interval '1 hour')+make_interval(mins=>coalesce(a.buffer_minutes,30))>r.starts_at) then raise exception 'Le creneau chevauche un rendez-vous.'; end if;
 insert into public.appointments(user_id,vehicle_id,service_request_id,external_appointment_id,starts_at,ends_at,status,visible_to_client,labor_duration_minutes,buffer_minutes)
 values(r.user_id,r.vehicle_id,q.service_request_id,'reservation/'||r.id::text,r.starts_at,r.ends_at,'proposed',false,(extract(epoch from r.ends_at-r.starts_at)/60)::integer,30) returning id into aid;
 select coalesce(jsonb_agg(coalesce(designation,description) order by display_order),'[]'::jsonb) into work from public.quote_items where quote_id=q.id;
 insert into public.repair_orders(user_id,vehicle_id,service_request_id,quote_id,appointment_id,order_number,status,authorized_work,visible_to_client)
 values(r.user_id,r.vehicle_id,q.service_request_id,q.id,aid,public.next_document_number('order'),'ready',work,false) returning id into oid;
 update public.booking_reservations set appointment_id=aid,repair_order_id=oid,updated_at=now() where id=r.id;
 return oid;
end; $$;
revoke all on function private.prepare_reservation(uuid) from public,anon;
grant execute on function private.prepare_reservation(uuid) to authenticated;
create function public.admin_prepare_reservation(p_id uuid) returns uuid language sql security invoker set search_path='' as $$ select private.prepare_reservation(p_id) $$;
revoke all on function public.admin_prepare_reservation(uuid) from public,anon;
grant execute on function public.admin_prepare_reservation(uuid) to authenticated;

create function private.confirm_reservation(p_id uuid,p_pdf_path text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.booking_reservations%rowtype; o public.repair_orders%rowtype;
begin
 if auth.uid() is null or private.is_admin() is not true then raise exception 'Acces administrateur requis.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('edm28-booking'));
 select * into r from public.booking_reservations where id=p_id for update;
 if not found then raise exception 'Reservation introuvable.'; end if;
 if r.status='confirmed' then return; end if;
 if r.status<>'review_pending' or r.starts_at<=now() then raise exception 'Reservation non validable.'; end if;
 select * into o from public.repair_orders where id=r.repair_order_id;
 if not found or o.status not in ('ready','signed') or not exists(select 1 from public.quotes where id=r.quote_id and status='accepted') or p_pdf_path is null or o.pdf_path is distinct from p_pdf_path or p_pdf_path not like r.user_id::text||'/order/'||o.id::text||'-%'
 or not exists(select 1 from storage.objects where bucket_id='repair-documents' and name=p_pdf_path) then raise exception 'Generez l ordre de reparation avant de confirmer.'; end if;
 update public.appointments set status='confirmed',visible_to_client=true,updated_at=now() where id=r.appointment_id;
 update public.repair_orders set visible_to_client=true,updated_at=now() where id=r.repair_order_id;
 update public.booking_reservations set status='confirmed',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
 perform private.queue_journey_email(r.id,'confirmed');
end; $$;
revoke all on function private.confirm_reservation(uuid,text) from public,anon;
grant execute on function private.confirm_reservation(uuid,text) to authenticated;
create function public.admin_confirm_reservation(p_id uuid,p_pdf_path text) returns void language sql security invoker set search_path='' as $$ select private.confirm_reservation(p_id,p_pdf_path) $$;
revoke all on function public.admin_confirm_reservation(uuid,text) from public,anon;
grant execute on function public.admin_confirm_reservation(uuid,text) to authenticated;

create function private.reject_reservation(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.booking_reservations%rowtype;
begin
 if auth.uid() is null or private.is_admin() is not true then raise exception 'Acces administrateur requis.' using errcode='42501'; end if;
 if coalesce(length(btrim(p_reason)),0) not between 3 and 2000 then raise exception 'Expliquez au client pourquoi le rendez-vous ne peut pas etre confirme.'; end if;
 perform pg_advisory_xact_lock(hashtext('edm28-booking'));
 select * into r from public.booking_reservations where id=p_id for update;
 if not found or r.status not in ('held','review_pending') then raise exception 'Reservation non modifiable.'; end if;
 update public.booking_reservations set status='rejected',review_note=btrim(p_reason),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
 update public.appointments set status='cancelled',updated_at=now() where id=r.appointment_id;
 update public.repair_orders set status='cancelled',updated_at=now() where id=r.repair_order_id;
 perform private.queue_journey_email(r.id,'rejected');
end; $$;
revoke all on function private.reject_reservation(uuid,text) from public,anon;
grant execute on function private.reject_reservation(uuid,text) to authenticated;
create function public.admin_reject_reservation(p_id uuid,p_reason text) returns void language sql security invoker set search_path='' as $$ select private.reject_reservation(p_id,p_reason) $$;
revoke all on function public.admin_reject_reservation(uuid,text) from public,anon;
grant execute on function public.admin_reject_reservation(uuid,text) to authenticated;

create function private.stamp_journey_completion() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.completed_at is not null then new.completed_at:=old.completed_at;
 elsif new.status in ('completed','invoiced') and old.status not in ('completed','invoiced') then new.completed_at:=now();
 else new.completed_at:=null; end if;
 return new;
end; $$;
revoke all on function private.stamp_journey_completion() from public,anon,authenticated;
create trigger stamp_journey_completion before update on public.repair_orders for each row execute function private.stamp_journey_completion();

-- Scheduled processing does not depend on a customer leaving their browser open.
-- Network dispatch stays disabled until the matching application build is verified.
create function private.process_journey() returns void language plpgsql security definer set search_path='' as $$
declare r record; job public.journey_email_deliveries%rowtype; token text;
begin
 if not pg_try_advisory_xact_lock(hashtext('edm28-journey-worker')) then return; end if;
 perform pg_advisory_xact_lock(hashtext('edm28-booking'));
 for r in update public.booking_reservations set status='expired',updated_at=now() where status='held' and expires_at<=now() returning id loop
   perform private.queue_journey_email(r.id,'expired');
 end loop;
 for r in select b.id,a.starts_at from public.booking_reservations b join public.appointments a on a.id=b.appointment_id
   where b.status='confirmed' and a.status='confirmed' and a.starts_at>now() and a.starts_at<=now()+interval '24 hours' and not exists(select 1 from public.repair_orders o where o.id=b.repair_order_id and o.status in ('completed','invoiced','cancelled')) loop
   perform private.queue_journey_email(r.id,'reminder',r.starts_at::text);
 end loop;
 for r in select b.id from public.booking_reservations b join public.repair_orders o on o.id=b.repair_order_id
   where o.completed_at is not null and o.status in ('completed','invoiced') loop
   perform private.queue_journey_email(r.id,'completed');
 end loop;
 if not exists(select 1 from private.journey_settings where enabled) or not exists(select 1 from public.automation_settings where id=true and messages_enabled) then return; end if;
 update public.journey_email_deliveries set status='cancelled' where status in ('pending','dispatching','sending') and kind in ('held','proof_received','confirmed','reminder') and exists(
   select 1 from public.booking_reservations b left join public.appointments a on a.id=b.appointment_id where b.id=reservation_id and
   ((kind='held' and (b.status<>'held' or b.expires_at<=now())) or (kind='proof_received' and b.status<>'review_pending') or (kind='confirmed' and a.status is distinct from 'confirmed') or (kind='reminder' and (a.status is distinct from 'confirmed' or a.starts_at<=now() or a.starts_at is distinct from (payload->>'starts_at')::timestamptz)))
 );
 update public.journey_email_deliveries set status='failed',last_error='Delivery retry window ended; manual review required.'
   where status in ('pending','dispatching','sending') and (attempts>=5 or created_at<now()-interval '20 hours');
 for job in select * from public.journey_email_deliveries where status in ('pending','dispatching','sending')
   and available_at<=now() and (lease_until is null or lease_until<=now()) and attempts<5 and created_at>now()-interval '20 hours'
   order by created_at for update skip locked limit 20 loop
   token:=encode(extensions.gen_random_bytes(32),'hex');
   update public.journey_email_deliveries set status='dispatching',dispatch_hash=encode(extensions.digest(token,'sha256'),'hex'),
     lease_until=now()+interval '2 minutes',attempts=attempts+1,available_at=now()+interval '5 minutes' where id=job.id;
   perform net.http_post(url:='https://edm28.fr/api/health?journey=dispatch',body:=jsonb_build_object('id',job.id,'token',token),timeout_milliseconds:=15000);
 end loop;
end; $$;
revoke all on function private.process_journey() from public,anon,authenticated;
notify pgrst,'reload schema';

create function private.require_parts_prices() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.status='draft' and new.status='sent' and new.commercial_model='customer_supplied_v1'
 and exists(select 1 from public.quote_parts_baskets where quote_id=new.id and requires_parts and
   (btrim(price_details)='' or price_observed_at is null or price_observed_at>current_date)) then
   raise exception 'Indiquez les prix indicatifs TTC des pieces et la date du releve avant envoi.';
 end if;
 return new;
end; $$;
revoke all on function private.require_parts_prices() from public,anon,authenticated;
create trigger require_parts_prices before update of status on public.quotes for each row execute function private.require_parts_prices();

create function private.guard_delivery_ack() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user='anon' then
   if not ((old.status='dispatching' and new.status='sending') or (old.status='sending' and new.status in ('sent','pending','failed'))) then
     raise exception 'Delivery transition refused.' using errcode='42501';
   end if;
   if length(coalesce(new.last_error,''))>500 or length(coalesce(new.provider_message_id,''))>100 then raise exception 'Delivery metadata refused.'; end if;
   if new.status='sent' then new.sent_at:=now(); end if;
 end if;
 return new;
end; $$;
revoke all on function private.guard_delivery_ack() from public,anon,authenticated;
create trigger guard_delivery_ack before update on public.journey_email_deliveries for each row execute function private.guard_delivery_ack();

create function private.guard_reserved_order() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.visible_to_client or new.status in ('in_progress','completed','invoiced')) and exists(
 select 1 from public.booking_reservations b join public.appointments a on a.id=b.appointment_id
 where b.repair_order_id=new.id and a.status not in ('confirmed','completed')) then
   raise exception 'Validez le rendez-vous avant de publier ou commencer cette intervention.';
 end if;
 return new;
end; $$;
revoke all on function private.guard_reserved_order() from public,anon,authenticated;
create trigger guard_reserved_order before update on public.repair_orders for each row execute function private.guard_reserved_order();
grant select(id,reservation_id,kind,status,created_at,sent_at,last_error,attempts) on public.journey_email_deliveries to authenticated;
create policy delivery_admin_read on public.journey_email_deliveries for select to authenticated using((select private.is_admin()));

-- Standard PostgreSQL test containers exercise the worker through an HTTP sink.
-- On Supabase the installed scheduler calls the same function once per minute.
do $$
begin
 if exists(select 1 from pg_available_extensions where name='pg_cron')
    and exists(select 1 from pg_available_extensions where name='pg_net') then
   create extension if not exists pg_net with schema extensions;
   create extension if not exists pg_cron with schema pg_catalog;
   perform cron.schedule('edm28-journey-minute','* * * * *','select private.process_journey();');
 else
   raise notice 'Native scheduler extensions unavailable here; worker must be tested explicitly.';
 end if;
end;
$$;
