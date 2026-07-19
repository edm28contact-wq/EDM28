create extension if not exists pgcrypto;
create schema if not exists private;

create table public.admin_email_allowlist (
  email text primary key,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  external_client_id text unique,
  email text
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plate text not null,
  plate_normalized text not null,
  brand text,
  model text,
  year integer,
  energy text,
  engine text,
  emissions text,
  mileage integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  external_vehicle_id text unique,
  unique(user_id, plate_normalized)
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','submitted','reviewed','quoted','confirmed','cancelled')),
  selected_basket text not null default 'standard' check (selected_basket in ('eco','standard','premium')),
  services jsonb not null default '[]'::jsonb,
  notes text,
  ai_recommendation jsonb,
  totals jsonb not null default '{}'::jsonb,
  j7_accepted boolean not null default false,
  refuse_control boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.repairs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete set null,
  repair_date date not null,
  repair_type text not null,
  title text,
  description text,
  status text not null default 'completed' check (status in ('planned','in_progress','completed','cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.repair_documents (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repairs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null check (document_type in ('invoice','photo','repair_order')),
  file_path text not null,
  file_name text not null,
  mime_type text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  external_quote_id text unique,
  quote_number text unique,
  status text not null default 'draft' check (status in ('draft','sent','accepted','refused','expired','cancelled')),
  title text,
  description text,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  total numeric not null default 0,
  valid_until date,
  pdf_path text,
  visible_to_client boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  item_type text not null check (item_type in ('labor','part','delivery','discount','other')),
  description text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit_price numeric not null default 0,
  total numeric generated always as (quantity * unit_price) stored,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  external_appointment_id text unique,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'proposed' check (status in ('proposed','confirmed','completed','cancelled','rescheduled')),
  notes text,
  visible_to_client boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.repair_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete set null,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,
  order_number text unique,
  status text not null default 'draft' check (status in ('draft','ready','signed','in_progress','completed','invoiced','cancelled')),
  mileage_in integer,
  visible_condition text,
  customer_items text,
  authorized_work jsonb not null default '[]'::jsonb,
  signed_at timestamptz,
  pdf_path text,
  visible_to_client boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  status text not null default 'planned' check (status in ('planned','preparing','in_progress','paused','completed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  exit_mileage integer check (exit_mileage is null or exit_mileage >= 0),
  requested_work text,
  performed_work text,
  technician_notes text,
  client_summary text,
  extra_work jsonb not null default '[]'::jsonb,
  preparation_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  repair_id uuid references public.repairs(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  external_invoice_id text unique,
  invoice_number text unique,
  status text not null default 'draft' check (status in ('draft','issued','partially_paid','paid','cancelled','overdue')),
  title text,
  description text,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  total numeric not null default 0,
  amount_paid numeric not null default 0,
  payment_method text,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  pdf_path text,
  visible_to_client boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  item_type text not null check (item_type in ('labor','part','delivery','discount','disbursement','other')),
  description text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit_price numeric not null default 0 check (unit_price >= 0),
  line_total numeric generated always as (quantity * unit_price) stored,
  source_quote_item_id uuid references public.quote_items(id) on delete set null,
  supplier_reference text,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_method text,
  reference text,
  paid_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.client_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete set null,
  direction text not null check (direction in ('inbound','outbound','system')),
  subject text,
  body text not null,
  channel text not null default 'email' check (channel in ('email','site','phone','system')),
  visible_to_client boolean not null default true,
  read_by_client boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id text,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.site_services (
  id uuid primary key default gen_random_uuid(),
  external_service_id text unique,
  category text not null,
  name text not null,
  slug text unique,
  client_description text,
  technical_description text,
  pricing_type text not null default 'fixed' check (pricing_type in ('fixed','from','quote')),
  displayed_price numeric not null default 0 check (displayed_price >= 0),
  labor_price numeric not null default 0 check (labor_price >= 0),
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  online_booking_enabled boolean not null default false,
  active boolean not null default true,
  display_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.service_options (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.site_services(id) on delete cascade,
  option_code text not null check (option_code in ('eco','standard','premium')),
  label text not null,
  description text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(service_id, option_code)
);

create table public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  document_type text not null check (document_type in ('quote','repair_order','invoice','paid_invoice','message')),
  source_snapshot jsonb not null default '{}'::jsonb,
  draft_payload jsonb not null default '{}'::jsonb,
  model text,
  status text not null default 'draft' check (status in ('draft','reviewed','approved','rejected','published')),
  validation_errors jsonb not null default '[]'::jsonb,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.business_configuration (
  id boolean primary key default true check (id),
  business_name text,
  legal_name text,
  siret text,
  siren text,
  vat_status text,
  vat_number text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text default 'France',
  phone text,
  email text,
  website text,
  bank_name text,
  iban text,
  bic text,
  payment_terms text,
  late_penalty_text text,
  recovery_fee_text text,
  insurance_name text,
  insurance_policy text,
  logo_url text,
  calendar_id text default 'primary',
  timezone text default 'Europe/Paris',
  ai_provider text,
  ai_model text,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.automation_settings (
  id boolean primary key default true check (id),
  automations_enabled boolean not null default false,
  messages_enabled boolean not null default false,
  booking_enabled boolean not null default false,
  reminders_enabled boolean not null default false,
  ai_enabled boolean not null default false,
  test_mode boolean not null default true,
  test_recipient text,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id) on delete set null
);

create or replace function private.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, first_name, last_name, phone, email, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'phone',
    new.email,
    case when exists(
      select 1 from public.admin_email_allowlist a
      where lower(a.email)=lower(new.email) and a.active
    ) then 'admin' else 'customer' end
  ) on conflict (id) do update
    set email = excluded.email, updated_at = timezone('utc', now());
  return new;
end;
$$;

insert into public.business_configuration(id, business_name, legal_name, country, timezone)
values (true, 'EDM AUTO CI', 'EDM AUTO CI', 'France', 'Europe/Paris');

insert into public.automation_settings(id, test_mode)
values (true, true);
