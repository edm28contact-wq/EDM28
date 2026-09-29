\set ON_ERROR_STOP on
-- Isolated fixture identities only. No production client information.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
insert into public.quotes(id,user_id,title) values
 ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Prestation'),
 ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','Other client'),
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','No parts');
create function pg_temp.expect_failure(command text, expected text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then
    if sqlerrm not like '%' || expected || '%' then raise exception 'Unexpected failure: %',sqlerrm; end if;
    return;
  end;
  raise exception 'Expected failure was not raised: %',expected;
end $$;
select pg_temp.expect_failure($q$insert into public.quote_items(quote_id,item_type,description,unit_price) values('22222222-2222-4222-8222-222222222222','part','Parts',100)$q$,'pas les pieces');
select pg_temp.expect_failure($q$insert into public.disbursements(amount) values(50)$q$,'Ancien parcours desactive');
select public.admin_save_service_quote(
 '22222222-2222-4222-8222-222222222222',
 jsonb_build_object('title','Prestation freinage','description','Consommables inclus','discount',0,'valid_until',current_date+30),
 '[{"item_type":"labor","designation":"Prestation freinage","quantity":1,"unit_price":99,"vat_rate":0}]',
 '{"requires_parts":true,"supplier_url":"https://supplier.example/basket/1","recommended_parts":"REF-123 x 2, REF-456 x 1"}',null
) as result \gset
select (:'result'::jsonb->>'revision') as revision \gset
select pg_temp.expect_failure($q$select public.admin_save_service_quote('22222222-2222-4222-8222-222222222222','{}','[]','{}',null)$q$,'Le devis a change');
select pg_temp.expect_failure(format($q$select public.admin_publish_service_quote('22222222-2222-4222-8222-222222222222',%L,'missing.pdf')$q$,:'revision'),'PDF non confirme');
-- A failed save must roll back the basket revision and all line replacement.
select pg_temp.expect_failure(format($q$select public.admin_save_service_quote('22222222-2222-4222-8222-222222222222','{"title":"New","valid_until":"invalid-date"}', '[{"item_type":"labor","designation":"Other","quantity":1,"unit_price":200}]','{"requires_parts":false}',%L)$q$,:'revision'),'invalid input syntax');
do $$begin
 assert (select total=99 and visible_to_client=false from public.quotes where id='22222222-2222-4222-8222-222222222222');
 assert (select count(*)=1 from public.quote_items where quote_id='22222222-2222-4222-8222-222222222222');
end$$;
update public.quotes set pdf_path='11111111-1111-4111-8111-111111111111/quote/22222222-2222-4222-8222-222222222222.pdf' where id='22222222-2222-4222-8222-222222222222';
select public.admin_publish_service_quote('22222222-2222-4222-8222-222222222222',:'revision','11111111-1111-4111-8111-111111111111/quote/22222222-2222-4222-8222-222222222222.pdf');
select pg_temp.expect_failure($q$update public.quote_parts_baskets set recommended_parts='CHANGED' where quote_id='22222222-2222-4222-8222-222222222222'$q$,'brouillon');
select pg_temp.expect_failure($q$update public.quote_items set unit_price=500 where quote_id='22222222-2222-4222-8222-222222222222'$q$,'verrouillees');
select pg_temp.expect_failure($q$update public.quotes set status='draft' where id='22222222-2222-4222-8222-222222222222'$q$,'ne redevient pas');
select pg_temp.expect_failure($q$update public.quotes set total=500 where id='22222222-2222-4222-8222-222222222222'$q$,'verrouille');
insert into public.invoices(id,quote_id,user_id) values('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
select pg_temp.expect_failure($q$insert into public.invoice_items(invoice_id,item_type,unit_price) values('66666666-6666-4666-8666-666666666666','part',100)$q$,'Seules les prestations');
insert into public.invoice_items(invoice_id,item_type,unit_price) values('66666666-6666-4666-8666-666666666666','labor',99);
-- No-parts service is legal without fabricated basket details.
select public.admin_save_service_quote('55555555-5555-4555-8555-555555555555',jsonb_build_object('title','Prestation sans pieces','valid_until',current_date+30), '[{"item_type":"labor","designation":"Prestation","quantity":1,"unit_price":55}]','{"requires_parts":false}',null) as no_parts \gset
select pg_temp.expect_failure(format($q$select public.admin_save_service_quote('55555555-5555-4555-8555-555555555555','{"title":"Bad URL"}', '[{"item_type":"labor","designation":"Prestation","quantity":1,"unit_price":55}]','{"requires_parts":true,"supplier_url":"javascript:alert(1)","recommended_parts":"REF"}',%L)$q$,:'no_parts'::jsonb->>'revision'),'basket_url_safe');
-- Visibility and authorization use client identity, never knowledge of a UUID.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$begin assert (select count(*)=0 from public.quote_parts_baskets); end$$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$begin
 assert (select count(*)=1 from public.quote_parts_baskets);
 assert (select recommended_parts='REF-123 x 2, REF-456 x 1' from public.quote_parts_baskets where quote_id='22222222-2222-4222-8222-222222222222');
end$$;
select pg_temp.expect_failure($q$select public.admin_save_service_quote('22222222-2222-4222-8222-222222222222','{}','[]','{}')$q$,'Acces administrateur');
select pg_temp.expect_failure($q$insert into public.quote_parts_baskets(quote_id) values('44444444-4444-4444-8444-444444444444')$q$,'Acces administrateur');
select pg_temp.expect_failure($q$update public.quotes set commercial_model='legacy',status='accepted' where id='22222222-2222-4222-8222-222222222222'$q$,'immuable');
update public.quotes set status='accepted' where id='22222222-2222-4222-8222-222222222222';
reset role;
do $$begin
 assert (select (to_jsonb(q)-'commercial_model')=s.original from public.quotes q cross join public.fixture_snapshot s where q.id='99999999-9999-4999-8999-999999999999');
 assert (select commercial_model='legacy' from public.quotes where id='99999999-9999-4999-8999-999999999999');
 assert (select count(*)=2 and sum(total)=199 from public.quote_items where quote_id='99999999-9999-4999-8999-999999999999');
 assert not has_table_privilege('anon','public.quote_parts_baskets','SELECT');
 assert not has_function_privilege('anon','public.admin_save_service_quote(uuid,jsonb,jsonb,jsonb,uuid)','EXECUTE');
end$$;
select 'PASS: atomic service totals, immutable publication, isolated basket access, no resale, legacy preservation' as result;
