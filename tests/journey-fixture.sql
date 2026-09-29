-- TEST DATABASE ONLY. Never run on a hosted project.
do $$ begin if current_database()<>'journey_test' then raise exception 'Isolated journey_test database required'; end if; end $$;
create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema extensions to anon,authenticated;
alter table public.profiles add column email text;
update public.profiles set email='fixture-'||left(id::text,8)||'@example.test';
create table public.vehicles(id uuid primary key,user_id uuid references public.profiles,plate text);
insert into public.vehicles values('12121212-1212-4212-8212-121212121212','11111111-1111-4111-8111-111111111111','AA-123-BB'),('34343434-3434-4434-8434-343434343434','33333333-3333-4333-8333-333333333333','CC-456-DD');
create table public.appointments(id uuid primary key default gen_random_uuid(),user_id uuid,vehicle_id uuid,service_request_id uuid,external_appointment_id text,starts_at timestamptz not null,ends_at timestamptz,status text default 'proposed' check(status in ('proposed','confirmed','completed','cancelled','rescheduled')),notes text,visible_to_client boolean default true,labor_duration_minutes integer,buffer_minutes integer default 30,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.repair_orders(id uuid primary key default gen_random_uuid(),user_id uuid,vehicle_id uuid,service_request_id uuid,quote_id uuid references public.quotes,appointment_id uuid references public.appointments,order_number text,status text default 'draft' check(status in ('draft','ready','signed','in_progress','completed','invoiced','cancelled')),authorized_work jsonb default '[]',pdf_path text,visible_to_client boolean default true,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.automation_settings(id boolean primary key,messages_enabled boolean,test_mode boolean,test_recipient text);
insert into public.automation_settings values(true,true,true,'isolated@example.test');
create table public.business_configuration(id boolean primary key,address_line1 text,address_line2 text,postal_code text,city text);
insert into public.business_configuration values(true,'Isolated test','','00000','Test');
create table public.business_hours(weekday smallint,is_open boolean,morning_start time,morning_end time,afternoon_start time,afternoon_end time);
insert into public.business_hours select d,true,'08:00'::time,'12:00'::time,'14:00'::time,'18:00'::time from generate_series(0,6) d;
create table public.business_schedule_exceptions(starts_on date,ends_on date,status text,morning_start time,morning_end time,afternoon_start time,afternoon_end time,created_at timestamptz);
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
insert into storage.buckets values('repair-documents','repair-documents',false,10485760,array['application/pdf']);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert on storage.objects to authenticated;
create policy admin_storage on storage.objects for all to authenticated using(private.is_admin()) with check(private.is_admin());
create schema net;
create table net.fixture_requests(id bigserial primary key,url text,body jsonb);
create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 2000) returns bigint language plpgsql as $$ declare result bigint; begin insert into net.fixture_requests(url,body) values(url,body) returning id into result; return result; end; $$;
-- Existing calendar algorithm, using the same periods, exceptions, lead time and buffer.
create function public.get_available_booking_slots(p_quote_id uuid,p_from date default current_date,p_days integer default 21)
returns table(starts_at timestamptz,ends_at timestamptz) language plpgsql security definer set search_path='' as $$
declare v_quote public.quotes%rowtype; v_duration integer;
begin
 select * into v_quote from public.quotes where id=p_quote_id and user_id=auth.uid() and visible_to_client=true;
 if not found or v_quote.status<>'accepted' then raise exception 'Devis accepte introuvable.'; end if;
 if exists(select 1 from public.repair_orders where quote_id=v_quote.id and status<>'cancelled') then raise exception 'Devis deja planifie.'; end if;
 v_duration:=coalesce(v_quote.labor_duration_minutes,0); if v_duration<15 then raise exception 'Duree absente.'; end if;
 return query with days as(select generate_series(p_from,p_from+greatest(1,least(p_days,60))-1,interval '1 day')::date work_day),
 day_rules as(select d.work_day,coalesce(ex.status,case when bh.is_open then 'open' else 'closed' end) rule_status,coalesce(ex.morning_start,bh.morning_start) morning_start,coalesce(ex.morning_end,bh.morning_end) morning_end,coalesce(ex.afternoon_start,bh.afternoon_start) afternoon_start,coalesce(ex.afternoon_end,bh.afternoon_end) afternoon_end from days d left join public.business_hours bh on bh.weekday=extract(isodow from d.work_day)::int-1 left join lateral(select e.* from public.business_schedule_exceptions e where d.work_day between e.starts_on and e.ends_on order by e.created_at desc limit 1) ex on true),
 periods as(select work_day,morning_start period_start,morning_end period_end from day_rules where rule_status='open' and morning_start is not null and morning_end is not null union all select work_day,afternoon_start,afternoon_end from day_rules where rule_status='open' and afternoon_start is not null and afternoon_end is not null),
 candidates as(select gs slot_start,gs+make_interval(mins=>v_duration) slot_end from periods p cross join lateral generate_series((p.work_day+p.period_start) at time zone 'Europe/Paris',((p.work_day+p.period_end) at time zone 'Europe/Paris')-make_interval(mins=>v_duration),interval '15 minutes') gs)
 select c.slot_start,c.slot_end from candidates c where c.slot_start>=now()+interval '7 days' and not exists(select 1 from public.appointments a where a.status<>'cancelled' and a.starts_at<c.slot_end+interval '30 minutes' and coalesce(a.ends_at,a.starts_at+interval '1 hour')+make_interval(mins=>coalesce(a.buffer_minutes,30))>c.slot_start) order by c.slot_start;
end; $$;
create function public.fixture_assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is not true then raise exception 'FAIL: %',message; end if; end $$;
