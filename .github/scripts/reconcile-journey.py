from pathlib import Path
import re,hashlib
root=Path.cwd()
source=(root/'supabase/migrations/20260929210843_client_journey_reservations.sql').read_text()
path='supabase/migrations/20260929222543_journey_schema_reconciliation.sql'
prefix='''-- Reconcile the pre-activation schema with the exact reviewed journey definitions.
-- No quote, invoice, appointment, reservation, proof or email row is deleted.
select pg_advisory_xact_lock(hashtext('edm28-journey-worker'));
select pg_advisory_xact_lock(hashtext('edm28-booking'));
update private.journey_settings set enabled=false where id=true;
do $$
begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='journey_email_deliveries' and column_name='capability_hash') then
   alter table public.journey_email_deliveries rename column capability_hash to dispatch_hash;
   alter table public.journey_email_deliveries rename column next_attempt_at to available_at;
   alter table public.journey_email_deliveries rename column error_code to last_error;
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.quote_parts_baskets'::regclass and conname='basket_prices_without_parts') then
   alter table public.quote_parts_baskets add constraint basket_prices_without_parts check(requires_parts or (price_details='' and price_observed_at is null));
 end if;
end; $$;
alter table public.journey_email_deliveries drop constraint if exists journey_email_deliveries_status_check;
alter table public.journey_email_deliveries add constraint journey_email_deliveries_status_check check(status in ('pending','dispatching','sending','sent','failed','cancelled'));
-- Reset only this new delivery table's grants, including column-level grants.
do $$ declare cols text; begin
 select string_agg(quote_ident(attname),',') into cols from pg_attribute where attrelid='public.journey_email_deliveries'::regclass and attnum>0 and not attisdropped;
 execute 'revoke select('||cols||'),insert('||cols||'),update('||cols||'),references('||cols||') on public.journey_email_deliveries from public,anon,authenticated';
end; $$;
revoke all on public.journey_email_deliveries from public,anon,authenticated;
drop policy if exists delivery_capability_read on public.journey_email_deliveries;
drop policy if exists delivery_capability_ack on public.journey_email_deliveries;
drop policy if exists delivery_admin_read on public.journey_email_deliveries;
drop trigger if exists guard_reserved_appointment on public.appointments;
drop trigger if exists stamp_repair_completion on public.repair_orders;
drop trigger if exists guard_basket_price_publication on public.quotes;
drop trigger if exists guard_reservation_order_visibility on public.repair_orders;
'''
functions=re.findall(r'create (?:or replace )?function\s+[\s\S]*?\$\$[\s\S]*?\$\$;',source,re.I)
assert hashlib.sha256(source.encode()).hexdigest() == '5f7868061b9151a57199d50c695c0ea09c12cb79463706c4496683cc5d5e2d1c'
assert len(functions)==20,len(functions)
functions=[re.sub(r'^create (?:or replace )?function','create or replace function',s,flags=re.I) for s in functions]
policies=re.findall(r'create policy delivery_[\s\S]*?;',source,re.I)
assert len(policies)==3
permissions=re.findall(r'(?:revoke all on function|grant execute on function|grant select\(id,payload|grant select\(id,reservation_id|grant all on public.journey_email_deliveries)[\s\S]*?;',source,re.I)
triggers=re.findall(r'create trigger[\s\S]*?;',source,re.I)
setup=[]
for s in triggers:
 m=re.search(r'create trigger\s+(\w+)[\s\S]*? on (public\.\w+)',s,re.I);assert m,s
 setup.append(f'drop trigger if exists {m[1]} on {m[2]};\n'+s)
suffix='''
-- Public wrappers now invoke the reviewed private implementation. Remove old aliases.
drop function if exists private.admin_prepare_reservation(uuid);
drop function if exists private.admin_confirm_reservation(uuid,text);
drop function if exists private.admin_reject_reservation(uuid,text);
drop function if exists private.stamp_repair_completion();
drop function if exists private.guard_basket_price_publication();
drop function if exists private.guard_reservation_order_visibility();
notify pgrst,'reload schema';
'''
out=prefix+'\n\n'+'\n\n'.join(functions+permissions+policies+setup)+suffix
(root/path).write_text(out)
assert hashlib.sha256(out.encode()).hexdigest()=='666b910c47ba7b0ed71634074d3753ac7562fbb6cc0f81cbbc47a8c656c86d32'
print(path,len(out),'sha256',hashlib.sha256(out.encode()).hexdigest(), 'functions',len(functions))
