-- EDM28 legal disclosures: only publish the deliberately whitelisted fields.
ALTER TABLE public.public_business_profile
 ADD COLUMN IF NOT EXISTS legal_name text,
 ADD COLUMN IF NOT EXISTS siren text,
 ADD COLUMN IF NOT EXISTS siret text,
 ADD COLUMN IF NOT EXISTS vat_status text,
 ADD COLUMN IF NOT EXISTS vat_number text,
 ADD COLUMN IF NOT EXISTS insurance_name text;

ALTER TABLE public.consumer_legal_settings
 ADD COLUMN IF NOT EXISTS professional_qualification_reference text,
 ADD COLUMN IF NOT EXISTS compliance_reviewed_at timestamptz,
 ADD COLUMN IF NOT EXISTS privacy_retention_reviewed_at timestamptz;

CREATE OR REPLACE FUNCTION private.sync_public_business_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
BEGIN
 IF new.id IS NOT TRUE THEN RETURN new; END IF;
 INSERT INTO public.public_business_profile(
   id,business_name,address_line1,address_line2,postal_code,city,country,
   phone,email,website,logo_url,timezone,booking_url,updated_at,
   legal_name,siren,siret,vat_status,vat_number,insurance_name
 )
 VALUES (
   true,new.business_name,new.address_line1,new.address_line2,new.postal_code,new.city,new.country,
   new.phone,new.email,new.website,new.logo_url,new.timezone,new.booking_url,new.updated_at,
   new.legal_name,new.siren,new.siret,new.vat_status,new.vat_number,new.insurance_name
 )
 ON CONFLICT(id) DO UPDATE SET
   business_name=excluded.business_name,
   address_line1=excluded.address_line1,address_line2=excluded.address_line2,
   postal_code=excluded.postal_code,city=excluded.city,country=excluded.country,
   phone=excluded.phone,email=excluded.email,website=excluded.website,
   logo_url=excluded.logo_url,timezone=excluded.timezone,
   booking_url=excluded.booking_url,updated_at=excluded.updated_at,
   legal_name=excluded.legal_name,siren=excluded.siren,siret=excluded.siret,
   vat_status=excluded.vat_status,vat_number=excluded.vat_number,
   insurance_name=excluded.insurance_name;
 RETURN new;
END
$func$;
REVOKE ALL ON FUNCTION private.sync_public_business_profile() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS sync_public_business_profile ON public.business_configuration;
CREATE TRIGGER sync_public_business_profile
AFTER INSERT OR UPDATE OF
  business_name,legal_name,siren,siret,vat_status,vat_number,insurance_name,
  address_line1,address_line2,postal_code,city,country,
  phone,email,website,logo_url,timezone,booking_url,updated_at
ON public.business_configuration
FOR EACH ROW WHEN(new.id=true)
EXECUTE FUNCTION private.sync_public_business_profile();

-- Reconcile the public copy once, without modifying the confidential business record.
INSERT INTO public.public_business_profile(
  id,business_name,address_line1,address_line2,postal_code,city,country,
  phone,email,website,logo_url,timezone,booking_url,updated_at,
  legal_name,siren,siret,vat_status,vat_number,insurance_name
)
SELECT
 id,business_name,address_line1,address_line2,postal_code,city,country,
 phone,email,website,logo_url,timezone,booking_url,updated_at,
 legal_name,siren,siret,vat_status,vat_number,insurance_name
FROM public.business_configuration WHERE id=true
ON CONFLICT(id) DO UPDATE SET
  legal_name=excluded.legal_name,siren=excluded.siren,siret=excluded.siret,
  vat_status=excluded.vat_status,vat_number=excluded.vat_number,
  insurance_name=excluded.insurance_name;

COMMENT ON COLUMN public.consumer_legal_settings.professional_qualification_reference
 IS 'Admin-entered proof of the professional qualification/experience for the regulated vehicle repair activity; not automatically verified.';
