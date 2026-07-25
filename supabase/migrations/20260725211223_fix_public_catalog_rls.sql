-- Keep the public catalogue readable without granting anonymous callers access
-- to the private administrator predicate.

drop policy if exists settings_public_select on public.site_settings;
drop policy if exists settings_authenticated_select on public.site_settings;

create policy settings_public_select
on public.site_settings
for select
to anon
using (is_public);

create policy settings_authenticated_select
on public.site_settings
for select
to authenticated
using (is_public or private.is_admin());

drop policy if exists services_public_select on public.site_services;
drop policy if exists services_authenticated_select on public.site_services;

create policy services_public_select
on public.site_services
for select
to anon
using (active and published_at is not null);

create policy services_authenticated_select
on public.site_services
for select
to authenticated
using ((active and published_at is not null) or private.is_admin());

drop policy if exists options_public_select on public.service_options;
drop policy if exists options_authenticated_select on public.service_options;

create policy options_public_select
on public.service_options
for select
to anon
using (active);

create policy options_authenticated_select
on public.service_options
for select
to authenticated
using (active or private.is_admin());

-- RLS remains the row-level boundary. Table grants only expose the operations
-- required by the public catalogue and the authenticated administration UI.
revoke all on table public.site_settings from public, anon, authenticated;
revoke all on table public.site_services from public, anon, authenticated;
revoke all on table public.service_options from public, anon, authenticated;

grant select on table public.site_settings to anon;
grant select on table public.site_services to anon;
grant select on table public.service_options to anon;

grant select, insert, update, delete on table public.site_settings to authenticated;
grant select, insert, update, delete on table public.site_services to authenticated;
grant select, insert, update, delete on table public.service_options to authenticated;
