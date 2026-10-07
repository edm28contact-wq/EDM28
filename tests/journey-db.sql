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
select public.fixture_assert((select count(id)=1 and bool_and(status='sent') from public.journey_email_deliveries),'acknowledgement remains readable only during its lease');
with replay as (update public.journey_email_deliveries set status='sending' where status='sent' returning id)
 select public.fixture_assert((select count(*)=0 from replay),'capability cannot replay sent delivery');
reset role;
update public.journey_email_deliveries set lease_until=now()-interval '1 second' where kind='confirmed';
set role anon;
select public.fixture_assert((select count(id)=0 from public.journey_email_deliveries),'expired capability cannot read acknowledged delivery');
reset role;
select public.fixture_assert((select sent_at is not null from public.journey_email_deliveries where kind='confirmed'),'sent timestamp recorded');

-- Check the 24 hour boundary using fixture times only.
update public.booking_reservations set starts_at=now()+interval '25 hours',ends_at=now()+interval '26 hours' where status='confirmed';
update public.appointments a set starts_at=b.starts_at,ends_at=b.ends_at from public.booking_reservations b where a.id=b.appointment_id;
select private.process_journey();
select public.fixture_assert((select count(*)=0 from public.journey_email_deliveries where kind='reminder'),'no reminder before the 24 hour window');
update public.booking_reservations set starts_at=now()+interval '23 hours',ends_at=now()+interval '24 hours' where status='confirmed';
update public.appointments a set starts_at=b.starts_at,ends_at=b.ends_at from public.booking_reservations b where a.id=b.appointment_id;
-- The scheduler uses a fixture HTTP sink, never the network.
update private.journey_settings set enabled=true;
select private.process_journey();
select public.fixture_assert((select count(*)>=1 from net.fixture_requests),'scheduled dispatch targets existing messages');
select private.process_journey();
select public.fixture_assert((select count(*)=1 from public.journey_email_deliveries where kind='reminder'),'one reminder inside 24 hours, deduplicated');
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

-- Wrong parts are resolved before work starts: client mismatch => 15 EUR reservation fee only.
reset role;
insert into public.quotes(id,user_id,vehicle_id,status,title,total,subtotal,labor_duration_minutes,commercial_model)
values
 ('70707070-7070-4070-8070-707070707070','11111111-1111-4111-8111-111111111111','12121212-1212-4212-8212-121212121212','draft','Wrong parts client',99,99,60,'customer_supplied_v1'),
 ('80808080-8080-4080-8080-808080808080','11111111-1111-4111-8111-111111111111','12121212-1212-4212-8212-121212121212','draft','Wrong recommendation EDM28',99,99,60,'customer_supplied_v1'),
 ('90909090-9090-4090-8090-909090909090','11111111-1111-4111-8111-111111111111','12121212-1212-4212-8212-121212121212','draft','Already started',99,99,60,'customer_supplied_v1');
insert into public.appointments(id,user_id,vehicle_id,starts_at,ends_at,status,visible_to_client)
values(
 '71717171-7171-4717-8717-717171717171',
 '11111111-1111-4111-8111-111111111111',
 '12121212-1212-4212-8212-121212121212',
 now()+interval '3 days',now()+interval '3 days 1 hour','confirmed',true
);
insert into public.repair_orders(id,user_id,vehicle_id,quote_id,appointment_id,order_number,status,visible_to_client)
values(
 '72727272-7272-4727-8727-727272727272',
 '11111111-1111-4111-8111-111111111111',
 '12121212-1212-4212-8212-121212121212',
 '70707070-7070-4070-8070-707070707070',
 '71717171-7171-4717-8717-717171717171',
 'OR-PARTS-CLIENT','ready',true
);
insert into public.booking_reservations(
 id,quote_id,user_id,vehicle_id,starts_at,ends_at,status,appointment_id,repair_order_id
) values(
 '73737373-7373-4737-8737-737373737373',
 '70707070-7070-4070-8070-707070707070',
 '11111111-1111-4111-8111-111111111111',
 '12121212-1212-4212-8212-121212121212',
 now()+interval '3 days',now()+interval '3 days 1 hour','confirmed',
 '71717171-7171-4717-8717-717171717171','72727272-7272-4727-8727-727272727272'
);

set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
set role authenticated;
do $$ begin
 begin
   perform public.admin_resolve_parts_issue(
     '71717171-7171-4717-8717-717171717171',
     'client_nonconforming_parts',
     'REF-WRONG apportee au lieu de REF-1'
   );
   raise exception 'FAIL: customer resolved parts issue';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;

set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role authenticated;
select public.admin_resolve_parts_issue(
 '71717171-7171-4717-8717-717171717171',
 'client_nonconforming_parts',
 'REF-WRONG apportee au lieu de REF-1'
);
select public.fixture_assert(
 (select status='cancelled'
      and parts_resolution='client_nonconforming_parts'
      and reservation_fee_amount=15
      and reservation_fee_invoice_id is not null
  from public.booking_reservations where id='73737373-7373-4737-8737-737373737373'),
 'client wrong parts stores a 15 EUR reservation fee'
);
select public.fixture_assert(
 (select status='cancelled' from public.appointments where id='71717171-7171-4717-8717-717171717171')
 and
 (select status='cancelled' from public.repair_orders where id='72727272-7272-4727-8727-727272727272'),
 'wrong-parts resolution cancels the booking before work'
);
select public.fixture_assert(
 (select count(*)=1 and bool_and(status='draft' and total=15 and visible_to_client=false)
  from public.invoices
  where id=(select reservation_fee_invoice_id from public.booking_reservations where id='73737373-7373-4737-8737-737373737373')),
 'client wrong parts creates one private 15 EUR draft invoice'
);
select public.fixture_assert(
 (select count(*)=1 and bool_and(item_type='other' and quantity=1 and unit_price=15 and line_total=15)
  from public.invoice_items
  where invoice_id=(select reservation_fee_invoice_id from public.booking_reservations where id='73737373-7373-4737-8737-737373737373')),
 'reservation invoice contains only the 15 EUR fee'
);
select public.fixture_assert(
 public.admin_resolve_parts_issue(
   '71717171-7171-4717-8717-717171717171',
   'client_nonconforming_parts',
   'retry'
 )=(select reservation_fee_invoice_id from public.booking_reservations where id='73737373-7373-4737-8737-737373737373'),
 'client wrong-parts resolution is idempotent'
);
reset role;

-- EDM28 recommendation error => no client invoice and zero fee.
insert into public.appointments(id,user_id,vehicle_id,starts_at,ends_at,status,visible_to_client)
values(
 '74747474-7474-4747-8747-747474747474',
 '11111111-1111-4111-8111-111111111111',
 '12121212-1212-4212-8212-121212121212',
 now()+interval '4 days',now()+interval '4 days 1 hour','confirmed',true
);
insert into public.repair_orders(id,user_id,vehicle_id,quote_id,appointment_id,order_number,status,visible_to_client)
values(
 '75757575-7575-4757-8757-757575757575',
 '11111111-1111-4111-8111-111111111111',
 '12121212-1212-4212-8212-121212121212',
 '80808080-8080-4080-8080-808080808080',
 '74747474-7474-4747-8747-747474747474',
 'OR-PARTS-EDM','ready',true
);
insert into public.booking_reservations(
 id,quote_id,user_id,vehicle_id,starts_at,ends_at,status,appointment_id,repair_order_id
) values(
 '76767676-7676-4767-8767-767676767676',
 '80808080-8080-4080-8080-808080808080',
 '11111111-1111-4111-8111-111111111111',
 '12121212-1212-4212-8212-121212121212',
 now()+interval '4 days',now()+interval '4 days 1 hour','confirmed',
 '74747474-7474-4747-8747-747474747474','75757575-7575-4757-8757-757575757575'
);
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role authenticated;
select public.admin_resolve_parts_issue(
 '74747474-7474-4747-8747-747474747474',
 'edm_recommendation_error',
 'REF-1 etait la reference EDM28 mais elle est incompatible'
);
select public.fixture_assert(
 (select status='cancelled'
      and parts_resolution='edm_recommendation_error'
      and reservation_fee_amount=0
      and reservation_fee_invoice_id is null
  from public.booking_reservations where id='76767676-7676-4767-8767-767676767676'),
 'EDM28 recommendation error charges the client zero'
);
select public.fixture_assert(
 not exists(select 1 from public.invoices where repair_order_id='75757575-7575-4757-8757-757575757575'),
 'EDM28 recommendation error creates no client invoice'
);
reset role;

-- Once work started, the 15 EUR shortcut is forbidden.
insert into public.appointments(id,user_id,vehicle_id,starts_at,ends_at,status,visible_to_client)
values(
 '77777777-7777-4777-8777-777777777777',
 '11111111-1111-4111-8111-111111111111',
 '12121212-1212-4212-8212-121212121212',
 now()+interval '5 days',now()+interval '5 days 1 hour','confirmed',true
);
insert into public.repair_orders(id,user_id,vehicle_id,quote_id,appointment_id,order_number,status,visible_to_client)
values(
 '78787878-7878-4787-8787-787878787878',
 '11111111-1111-4111-8111-111111111111',
 '12121212-1212-4212-8212-121212121212',
 '90909090-9090-4090-8090-909090909090',
 '77777777-7777-4777-8777-777777777777',
 'OR-PARTS-STARTED','in_progress',true
);
insert into public.booking_reservations(
 id,quote_id,user_id,vehicle_id,starts_at,ends_at,status,appointment_id,repair_order_id
) values(
 '79797979-7979-4797-8797-797979797979',
 '90909090-9090-4090-8090-909090909090',
 '11111111-1111-4111-8111-111111111111',
 '12121212-1212-4212-8212-121212121212',
 now()+interval '5 days',now()+interval '5 days 1 hour','confirmed',
 '77777777-7777-4777-8777-777777777777','78787878-7878-4787-8787-787878787878'
);
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role authenticated;
do $$ begin
 begin
   perform public.admin_resolve_parts_issue(
     '77777777-7777-4777-8777-777777777777',
     'client_nonconforming_parts',
     'Tentative apres demarrage'
   );
   raise exception 'FAIL: 15 EUR rule applied after intervention start';
 exception when others then
   if sqlerrm='FAIL: 15 EUR rule applied after intervention start' then raise; end if;
 end;
end $$;
select public.fixture_assert(
 (select status='in_progress' from public.repair_orders where id='78787878-7878-4787-8787-787878787878')
 and
 (select parts_resolution is null from public.booking_reservations where id='79797979-7979-4797-8797-797979797979'),
 'started intervention cannot use the 15 EUR reservation rule'
);
reset role;

select 'ALL JOURNEY DATABASE CHECKS PASSED';
