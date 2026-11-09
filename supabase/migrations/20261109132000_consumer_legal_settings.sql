CREATE TABLE IF NOT EXISTS public.consumer_legal_settings(
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 mediator_name text,
 mediator_postal_address text,
 mediator_website text,
 publication_director text,
 host_name text,
 host_postal_address text,
 host_website text,
 privacy_contact_email text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.consumer_legal_settings(id) VALUES(true) ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.consumer_legal_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.consumer_legal_settings TO anon,authenticated;
GRANT UPDATE ON public.consumer_legal_settings TO authenticated;
DROP POLICY IF EXISTS consumer_legal_settings_public_read ON public.consumer_legal_settings;
CREATE POLICY consumer_legal_settings_public_read ON public.consumer_legal_settings
FOR SELECT TO anon,authenticated USING(id=true);
DROP POLICY IF EXISTS consumer_legal_settings_admin_update ON public.consumer_legal_settings;
CREATE POLICY consumer_legal_settings_admin_update ON public.consumer_legal_settings
FOR UPDATE TO authenticated USING((SELECT private.is_admin()))
WITH CHECK((SELECT private.is_admin()));
