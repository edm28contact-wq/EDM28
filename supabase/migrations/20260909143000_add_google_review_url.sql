alter table public.business_configuration
  add column if not exists google_review_url text;

comment on column public.business_configuration.google_review_url is
  'Official Google Business Profile review URL. Keep null until the verified profile exists.';
