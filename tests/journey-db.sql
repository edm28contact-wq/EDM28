-- Isolated fixtures: no actual emails, users, bookings, documents or payments.
do $$ begin if current_database()<>'journey_test' then raise exception 'Isolated journey_test database required'; end if; end $$;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role authenticated;
insert into public.quotes(id,user_id,vehicle_id,status,title,total,subtotal,labor_duration_minutes)
 values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','12121212-1212-4212-8212-121212121212','draft','Test service',99,99,60),
 ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','34343434-3434-4434-8434-343434343434','draft','Other service',99,99,60);
select public.admin_save_service_quote('22222222-2222-4222-8222-222222222222',jsonb_build_object('title','Test service','quote_number','NEW-1','valid_until',current_date+60),
 '[{"item_type":"labor","designation":"Service","quantity":1,"unit_price":99}]',
 jsonb_build_object('requires_parts',true,'supplier_url','https://supplier.example/basket','recommended_parts','REF-1 x 2','price_details','REF-1: 20 EUR TTC x 2','price_observed_at',current_date),null);
select public.admin_save_service_quote('44444444-4444-4444-8444-444444444444',jsonb_build_object('title','Other service','quote_number','NEW-2','valid_until',current_date+60),
 '[{"item_type":"labor","designation":"Service","quantity":1,"unit_price":99}]',
 jsonb_build_object('requires_parts',false),null);
update public.quotes set pdf_path=user_id::text||'/quote/'||id::text||'.pdf' where commercial_model='customer_supplied_v1';
select public.admin_publish_service_quote(q.id,b.revision,q.pdf_path) from public.quotes q join public.quote_parts_baskets b on b.quote_id=q.id;
update public.quotes set status='accepted' where commercial_model='customer_supplied_v1';
reset role;
create table public.fixture_state(name text primary key,id uuid,slot timestamptz);
grant select,insert,update on public.fixture_state to authenticated;

set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
set role authenticated;
insert into public.fixture_state(name,slot) select 'client',starts_at from public.get_reservation_slots('22222222-2222-4222-8222-222222222222',current_date+10,1) limit 1;
update public.fixture_state set id=public.reserve_quote_slot('22222222-2222-4222-8222-222222222222',slot) where name='client';
select public.fixture_assert((select count(*)=1 and bool_and(status='held') and bool_and(expires_at-created_at=interval '48 hours') from public.booking_reservations),'48 hour hold created');
select public.fixture_assert(public.reserve_quote_slot('22222222-2222-4222-8222-222222222222',(select slot from public.fixture_state where name='client'))=(select id from public.fixture_state where name='client'),'reserve retry is idempotent');
do $$ begin
 begin update public.booking_reservations set status='confirmed'; raise exception 'FAIL: direct client update permitted'; exception when insufficient_privilege then null; end;
 begin perform public.admin_prepare_reservation((select id from public.fixture_state where name='client')); raise exception 'FAIL: customer approved booking'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
set role authenticated;
select public.fixture_assert((select count(*)=0 from public.booking_reservations),'other customer cannot read reservations');
select public.fixture_assert(not exists(select 1 from public.get_reservation_slots('44444444-4444-4444-8444-444444444444',current_date+10,1) where starts_at=(select slot from public.fixture_state where name='client')),'held slot absent for another customer');
do $$ begin
 begin perform public.reserve_quote_slot('44444444-4444-4444-8444-444444444444',(select slot from public.fixture_state where name='client')); raise exception 'FAIL: overlapping hold'; exception when others then if sqlerrm='FAIL: overlapping hold' then raise; end if; end;
 begin perform public.submit_reservation_proof((select id from public.fixture_state where name='client'),'fake'); raise exception 'FAIL: cross-customer proof'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
set role authenticated;
insert into storage.objects(bucket_id,name,metadata) select 'purchase-proofs','11111111-1111-4111-8111-111111111111/'||id||'/test.pdf','{"mimetype":"application/pdf","size":100}' from public.fixture_state where name='client';
select public.submit_reservation_proof(id,'11111111-1111-4111-8111-111111111111/'||id||'/test.pdf') from public.fixture_state where name='client';
select public.submit_reservation_proof(id,'11111111-1111-4111-8111-111111111111/'||id||'/test.pdf') from public.fixture_state where name='client';
select public.fixture_assert((select status='review_pending' and review_deadline-proof_received_at=interval '24 hours' from public.booking_reservations),'proof starts a separate 24 hour review deadline');
reset role;
update public.booking_reservations set review_deadline=now()-interval '1 hour';
select private.process_journey();
select public.fixture_assert((select status='review_pending' from public.booking_reservations),'late administrator review does not release paid parts reservation');

set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role authenticated;
select public.admin_prepare_reservation(id) from public.fixture_state where name='client';
reset role;
select public.fixture_assert((select count(*)=1 and bool_and(status='proposed') and not bool_or(visible_to_client) from public.appointments),'preparing OR does not prematurely confirm appointment');
select public.fixture_assert((select count(*)=1 and not bool_or(visible_to_client) from public.repair_orders),'OR private before approval');
set role authenticated;
do $$ begin
 begin perform public.admin_confirm_reservation((select id from public.fixture_state where name='client'),'missing.pdf'); raise exception 'FAIL: confirmation without PDF'; exception when others then if sqlerrm='FAIL: confirmation without PDF' then raise; end if; end;
end $$;
reset role;
update public.repair_orders set pdf_path=user_id::text||'/order/'||id::text||'-test.pdf';
insert into storage.objects(bucket_id,name,metadata) select 'repair-documents',pdf_path,'{"mimetype":"application/pdf","size":100}' from public.repair_orders;
set role authenticated;
select public.admin_confirm_reservation(s.id,o.pdf_path) from public.fixture_state s join public.booking_reservations b on b.id=s.id join public.repair_orders o on o.id=b.repair_order_id where s.name='client';
reset role;
select public.fixture_assert((select count(*)=1 and bool_and(status='confirmed' and visible_to_client) from public.appointments),'approval confirms appointment');
select public.fixture_assert((select count(*)=1 and bool_and(visible_to_client) from public.repair_orders),'approval releases OR');
select public.fixture_assert((select count(*)=1 from public.journey_email_deliveries where kind='confirmed'),'one confirmation email queued');
select public.fixture_assert((select count(*)=1 from public.journey_email_deliveries where kind='proof_received'),'proof retry did not duplicate email');

-- Separate capability authorization checks, no token ever belongs to a real user.
update public.journey_email_deliveries set status='dispatching',lease_until=now()+interval '2 minutes',dispatch_hash=encode(extensions.digest(repeat('a',64),'sha256'),'hex') where kind='confirmed';
set request.jwt.claim.sub='';
set role anon;
set request.headers='{}';
select public.fixture_assert((select count(id)=0 from public.journey_email_deliveries),'no capability exposes no delivery');
set request.headers='{"x-edm-delivery-token":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}';
select public.fixture_assert((select count(id)=0 from public.journey_email_deliveries),'forged capability exposes no delivery');
set request.headers='{"x-edm-delivery-token":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}';
select public.fixture_assert((select count(id)=1 from public.journey_email_deliveries),'valid capability is restricted to one delivery');
do $$ begin
 begin update public.journey_email_deliveries set payload='{}'; raise exception 'FAIL: delivery payload changed'; exception when insufficient_privilege then null; end;
 begin perform dispatch_hash from public.journey_email_deliveries; raise exception 'FAIL: hash exposed'; exception when insufficient_privilege then null; end;
end $$;
update public.journey_email_deliveries set status='sending' where status='dispatching' returning id;
update public.journey_email_deliveries set status='sent',provider_message_id='test-provider' where status='sending';
select public.fixture_assert((select count(id)=0 from public.journey_email_deliveries),'capability cannot replay sent delivery');
reset role;
select public.fixture_assert((select sent_at is not null from public.journey_email_deliveries where kind='confirmed'),'sent timestamp recorded');

-- The scheduler uses a fixture HTTP sink, never the network.
update private.journey_settings set enabled=true;
select private.process_journey();
select public.fixture_assert((select count(*)>=1 from net.fixture_requests),'scheduled dispatch targets existing messages');
select public.fixture_assert(not exists(select 1 from net.fixture_requests where url<>'https://edm28.fr/api/health?journey=dispatch'),'no attacker-controlled destination');
update public.repair_orders set status='completed';
select public.fixture_assert((select completed_at is not null from public.repair_orders),'completion is timestamped on server');
select private.process_journey();
select private.process_journey();
select public.fixture_assert((select count(*)=1 from public.journey_email_deliveries where kind='completed'),'one completion email');
select public.fixture_assert((select count(*)=1 from public.quotes where id='99999999-9999-4999-8999-999999999999' and commercial_model='legacy' and total=199),'legacy quote unchanged');
select public.fixture_assert((select to_jsonb(q)-'commercial_model'=s.original from public.quotes q join public.fixture_snapshot s on s.original->>'id'=q.id::text),'entire legacy quote snapshot is unchanged');

-- A new no-parts service enters review directly, never requests a fake proof.
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
set role authenticated;
insert into public.fixture_state(name,slot) select 'other',starts_at from public.get_reservation_slots('44444444-4444-4444-8444-444444444444',current_date+12,1) limit 1;
update public.fixture_state set id=public.reserve_quote_slot('44444444-4444-4444-8444-444444444444',slot) where name='other';
select public.fixture_assert((select status='review_pending' and proof_path is null and review_deadline-created_at=interval '24 hours' from public.booking_reservations),'no-parts review bypasses proof requirement');
reset role;
-- Expiry is based on server time, and never deletes the reservation or documents.
update public.booking_reservations set status='held',created_at=now()-interval '49 hours',expires_at=now()-interval '1 hour',review_deadline=null where id=(select id from public.fixture_state where name='other');
select private.process_journey();
select private.process_journey();
select public.fixture_assert((select status='expired' from public.booking_reservations where id=(select id from public.fixture_state where name='other')),'missing proof releases expired hold');
select public.fixture_assert((select count(*)=1 from public.journey_email_deliveries where kind='expired'),'expiry email deduplicated');
select public.fixture_assert((select count(*)=2 from public.booking_reservations),'expired reservations retained');
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
set role authenticated;
do $$ begin
 begin perform public.submit_reservation_proof((select id from public.fixture_state where name='other'),'fake'); raise exception 'FAIL: expired proof accepted'; exception when others then if sqlerrm='FAIL: expired proof accepted' then raise; end if; end;
end $$;
reset role;
select 'ALL JOURNEY DATABASE CHECKS PASSED';
