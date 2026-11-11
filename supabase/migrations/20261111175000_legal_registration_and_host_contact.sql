ALTER TABLE public.consumer_legal_settings
ADD COLUMN IF NOT EXISTS registered_business_address text,
ADD COLUMN IF NOT EXISTS host_phone text;
COMMENT ON COLUMN public.consumer_legal_settings.registered_business_address IS 'Adresse de domiciliation figurant sur le justificatif de l entrepreneur individuel, potentiellement differente de l atelier.';
COMMENT ON COLUMN public.consumer_legal_settings.host_phone IS 'Telephone officiel de l hebergeur, a confirmer sur ses informations contractuelles.';
