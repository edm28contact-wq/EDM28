-- Isolated PostgreSQL fixture. Never execute this file against a hosted project.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema private;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;
create table public.profiles(id uuid primary key, role text);
insert into public.profiles values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin'),
 ('11111111-1111-4111-8111-111111111111','customer'),
 ('33333333-3333-4333-8333-333333333333','customer');
create function private.is_admin() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin')
$$;
create table public.quotes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles,
 vehicle_id uuid, service_request_id uuid, external_quote_id text unique,
 quote_number text unique, status text not null default 'draft' check(status in ('draft','sent','accepted','refused','expired','cancelled')),
 title text, description text, subtotal numeric not null default 0, discount numeric not null default 0,
 total numeric not null default 0, valid_until date, pdf_path text, visible_to_client boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), labor_duration_minutes integer
);
create table public.quote_items(
 id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quotes on delete cascade,
 item_type text not null check(item_type in ('labor','part','delivery','discount','other')),
 service_id uuid, description text, quantity numeric not null default 1 check(quantity>0), unit_price numeric not null default 0,
 option_code text, supplier text, supplier_reference text,
 purchase_mode text not null default 'resale' check(purchase_mode in ('resale','disbursement','customer_supplied')),
 total numeric generated always as (quantity*unit_price) stored, display_order integer not null default 0,
 created_at timestamptz not null default now(), designation text, vat_rate numeric not null default 0 check(vat_rate between 0 and 100),
 purchase_total numeric not null default 0 check(purchase_total>=0)
);
create table public.disbursements(id uuid primary key default gen_random_uuid(), quote_id uuid, status text default 'draft', amount numeric);
create table public.invoices(
 id uuid primary key default gen_random_uuid(), user_id uuid, vehicle_id uuid, quote_id uuid,
 repair_order_id uuid, external_invoice_id text unique, invoice_number text unique,
 status text default 'draft', title text, description text, subtotal numeric default 0,
 discount numeric default 0, total numeric default 0, disbursement_total numeric default 0,
 due_at timestamptz, visible_to_client boolean default false, created_at timestamptz default now(),
 updated_at timestamptz default now()
);
create table public.invoice_items(
 id uuid primary key default gen_random_uuid(), invoice_id uuid references public.invoices,
 item_type text, quantity numeric default 1, unit_price numeric default 0, description text,
 line_total numeric, display_order integer default 0, vat_rate numeric default 0,
 purchase_total numeric default 0, margin_amount numeric default 0
);
create function public.next_document_number(p_type text) returns text language sql as $$ select 'TEST-' || gen_random_uuid()::text $$;
grant usage on schema public,private,auth to authenticated;
grant usage on schema public,auth to anon;
grant select on public.profiles to authenticated;
grant all on public.quotes,public.quote_items,public.disbursements,public.invoices,public.invoice_items to authenticated;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
create policy admin_all on public.quotes for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy owner_read on public.quotes for select to authenticated using(user_id=auth.uid() and visible_to_client);
create policy owner_response on public.quotes for update to authenticated using(user_id=auth.uid() and visible_to_client and status='sent') with check(user_id=auth.uid() and status in ('accepted','refused'));
create policy admin_all on public.quote_items for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy owner_read on public.quote_items for select to authenticated using(exists(select 1 from public.quotes where id=quote_id and user_id=auth.uid() and visible_to_client));
-- Model an already issued document and freeze its pre-migration values for comparison.
insert into public.quotes(id,user_id,status,title,quote_number,total,subtotal,visible_to_client,pdf_path)
 values('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','accepted','Original historical quote','OLD-1',199,199,true,'original/quote.pdf');
insert into public.quote_items(quote_id,item_type,description,quantity,unit_price,purchase_mode)
 values('99999999-9999-4999-8999-999999999999','part','Original parts',1,100,'resale'),('99999999-9999-4999-8999-999999999999','labor','Original service',1,99,'resale');
create table public.fixture_snapshot as select to_jsonb(q) as original from public.quotes q;
