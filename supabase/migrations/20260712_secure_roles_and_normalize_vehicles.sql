begin;

-- Customers may edit only their contact details. The role remains server-managed.
revoke update on table public.profiles from authenticated;
grant update (first_name, last_name, phone) on table public.profiles to authenticated;

-- Trigger-only functions must not be callable through the Data API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Pin function search paths.
alter function public.set_updated_at() set search_path = public;

-- Normalize plates before constraints and lookups.
update public.vehicles
set plate_normalized = upper(regexp_replace(coalesce(plate, ''), '[^A-Za-z0-9]', '', 'g'))
where plate_normalized is distinct from upper(regexp_replace(coalesce(plate, ''), '[^A-Za-z0-9]', '', 'g'));

alter table public.vehicles
  alter column plate_normalized set not null;

drop index if exists public.vehicles_user_plate_key;
create unique index if not exists vehicles_user_plate_normalized_key
  on public.vehicles (user_id, plate_normalized);

-- Keep repair timestamps consistent with the other editable entities.
drop trigger if exists set_repairs_updated_at on public.repairs;
create trigger set_repairs_updated_at
before update on public.repairs
for each row execute function public.set_updated_at();

commit;
