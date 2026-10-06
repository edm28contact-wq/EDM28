-- Keep one public, read-only projection synchronized with the private business configuration.
-- This removes the SECURITY DEFINER view while preserving the same public API name.

drop view if exists public.public_business_profile;

create table public.public_business_profile (
  id boolean primary key default true check (id),
  business_name text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text,
  phone text,
  email text,
  website text,
  logo_url text,
  timezone text,
  booking_url text,
  updated_at timestamptz
);

insert into public.public_business_profile (
  id, business_name, address_line1, address_line2, postal_code, city, country,
  phone, email, website, logo_url, timezone, booking_url, updated_at
)
select
  true, business_name, address_line1, address_line2, postal_code, city, country,
  phone, email, website, logo_url, timezone, booking_url, updated_at
from public.business_configuration
where id = true
on conflict (id) do update set
  business_name = excluded.business_name,
  address_line1 = excluded.address_line1,
  address_line2 = excluded.address_line2,
  postal_code = excluded.postal_code,
  city = excluded.city,
  country = excluded.country,
  phone = excluded.phone,
  email = excluded.email,
  website = excluded.website,
  logo_url = excluded.logo_url,
  timezone = excluded.timezone,
  booking_url = excluded.booking_url,
  updated_at = excluded.updated_at;

alter table public.public_business_profile enable row level security;
revoke all on public.public_business_profile from public, anon, authenticated;
grant select on public.public_business_profile to anon, authenticated;

create policy public_business_profile_read
on public.public_business_profile
for select
to anon, authenticated
using (id = true);

create or replace function private.sync_public_business_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.public_business_profile (
    id, business_name, address_line1, address_line2, postal_code, city, country,
    phone, email, website, logo_url, timezone, booking_url, updated_at
  )
  values (
    true, new.business_name, new.address_line1, new.address_line2, new.postal_code, new.city, new.country,
    new.phone, new.email, new.website, new.logo_url, new.timezone, new.booking_url, new.updated_at
  )
  on conflict (id) do update set
    business_name = excluded.business_name,
    address_line1 = excluded.address_line1,
    address_line2 = excluded.address_line2,
    postal_code = excluded.postal_code,
    city = excluded.city,
    country = excluded.country,
    phone = excluded.phone,
    email = excluded.email,
    website = excluded.website,
    logo_url = excluded.logo_url,
    timezone = excluded.timezone,
    booking_url = excluded.booking_url,
    updated_at = excluded.updated_at;
  return new;
end;
$$;

revoke all on function private.sync_public_business_profile() from public, anon, authenticated;

drop trigger if exists sync_public_business_profile on public.business_configuration;
create trigger sync_public_business_profile
after insert or update of
  business_name, address_line1, address_line2, postal_code, city, country,
  phone, email, website, logo_url, timezone, booking_url, updated_at
on public.business_configuration
for each row
when (new.id = true)
execute function private.sync_public_business_profile();

-- Journey emails must use the current back-office contact information, never a hardcoded address.
create or replace function private.queue_journey_email(
  p_reservation uuid,
  p_kind text,
  p_suffix text default ''::text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.booking_reservations%rowtype;
  q public.quotes%rowtype;
  b public.quote_parts_baskets%rowtype;
  cfg public.business_configuration%rowtype;
  recipient text;
  settings public.automation_settings%rowtype;
  payload jsonb;
begin
  select * into r from public.booking_reservations where id = p_reservation;
  if not found then return; end if;

  select * into q from public.quotes where id = r.quote_id;
  select * into b from public.quote_parts_baskets where quote_id = q.id;
  select * into settings from public.automation_settings where id = true;
  select * into cfg from public.business_configuration where id = true;
  select email into recipient from public.profiles where id = r.user_id;

  if settings.test_mode is true then
    recipient := settings.test_recipient;
  end if;

  payload := jsonb_build_object(
    'recipient', recipient,
    'kind', p_kind,
    'quote_id', q.id,
    'quote_number', q.quote_number,
    'title', q.title,
    'starts_at', r.starts_at,
    'expires_at', r.expires_at,
    'review_deadline', r.review_deadline,
    'review_note', r.review_note,
    'requires_parts', coalesce(b.requires_parts, false),
    'supplier_url', b.supplier_url,
    'recommended_parts', b.recommended_parts,
    'price_details', b.price_details,
    'price_observed_at', b.price_observed_at,
    'repair_order_id', r.repair_order_id,
    'business_name', coalesce(nullif(cfg.business_name, ''), 'EDM28'),
    'contact_email', cfg.email,
    'contact_phone', cfg.phone,
    'website', cfg.website,
    'address', concat_ws(', ',
      nullif(cfg.address_line1, ''),
      nullif(cfg.address_line2, ''),
      nullif(concat_ws(' ', cfg.postal_code, cfg.city), '')
    )
  );

  insert into public.journey_email_deliveries(reservation_id, kind, dedupe_key, payload)
  values(r.id, p_kind, r.id::text || '/' || p_kind || '/' || p_suffix, payload)
  on conflict(dedupe_key) do nothing;
end;
$$;

revoke all on function private.queue_journey_email(uuid, text, text) from public, anon, authenticated;
