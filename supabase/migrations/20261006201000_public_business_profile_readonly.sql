-- public_business_profile is the intentional public projection of business_configuration.
-- Keep it readable by the public/client app, but never writable through the auto-updatable view.
revoke all on public.public_business_profile from public, anon, authenticated;
grant select on public.public_business_profile to anon, authenticated;
