-- EDM28: block duplicate customer identities at database boundary.
-- Existing collisions are kept untouched; the checks apply to new or changed identities.
CREATE OR REPLACE FUNCTION private.edm28_identity_name(value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=''
AS $$
  SELECT lower(btrim(regexp_replace(translate(coalesce(value,''), 'ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸàâäçéèêëîïôöùûüÿ', 'AAACEEEEIIOOUUUYaaaceeeeiioouuuy'), '[[:space:]]+', ' ', 'g')));
$$;
CREATE OR REPLACE FUNCTION private.edm28_identity_phone(value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=''
AS $$
  SELECT CASE
    WHEN regexp_replace(coalesce(value,''), '[^0-9]', '', 'g') ~ '^0[1-9][0-9]{8}$'
      THEN '33' || substr(regexp_replace(value,'[^0-9]','','g'),2)
    WHEN regexp_replace(coalesce(value,''), '[^0-9]', '', 'g') ~ '^0033[1-9][0-9]{8}$'
      THEN substr(regexp_replace(value,'[^0-9]','','g'),3)
    WHEN regexp_replace(coalesce(value,''), '[^0-9]', '', 'g') ~ '^33[1-9][0-9]{8}$'
      THEN regexp_replace(value,'[^0-9]','','g')
    ELSE regexp_replace(coalesce(value,''), '[^0-9]', '', 'g')
  END;
$$;

CREATE OR REPLACE FUNCTION private.edm28_guard_profile_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
DECLARE
 new_first text:=private.edm28_identity_name(new.first_name);
 new_last text:=private.edm28_identity_name(new.last_name);
 new_phone text:=private.edm28_identity_phone(new.phone);
 new_email text:=lower(btrim(coalesce(new.email,'')));
 changed boolean;
BEGIN
 IF TG_OP='INSERT' AND auth.uid() IS NOT NULL AND new.role <> 'customer' THEN
   RAISE EXCEPTION 'Inscription administrateur non autorisée.' USING ERRCODE='42501';
 END IF;
 changed:=TG_OP='INSERT'
   OR new.first_name IS DISTINCT FROM old.first_name
   OR new.last_name IS DISTINCT FROM old.last_name
   OR new.phone IS DISTINCT FROM old.phone
   OR new.email IS DISTINCT FROM old.email;
 IF NOT changed THEN RETURN new; END IF;
 IF (new_first='' OR new_last='' OR new_phone='' OR new_email='')
   AND TG_OP='INSERT' AND auth.uid() IS NOT NULL THEN
   RAISE EXCEPTION 'Prénom, nom, téléphone et email requis.' USING ERRCODE='23514';
 END IF;

 -- Serialize competing registrations, even when they arrive simultaneously.
 PERFORM pg_advisory_xact_lock(2042816);
 IF new_first<>'' AND new_last<>'' AND
   (TG_OP='INSERT' OR new.first_name IS DISTINCT FROM old.first_name OR new.last_name IS DISTINCT FROM old.last_name)
   AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id<>new.id
      AND private.edm28_identity_name(p.first_name)=new_first
      AND private.edm28_identity_name(p.last_name)=new_last
   ) THEN
    RAISE EXCEPTION 'Identité client déjà enregistrée.' USING ERRCODE='23505', CONSTRAINT='edm28_identity_duplicate_name';
 END IF;
 IF length(new_phone)>=9 AND
   (TG_OP='INSERT' OR new.phone IS DISTINCT FROM old.phone)
   AND EXISTS(
      SELECT 1 FROM public.profiles p WHERE p.id<>new.id
      AND private.edm28_identity_phone(p.phone)=new_phone
   ) THEN
    RAISE EXCEPTION 'Numéro de téléphone déjà enregistré.' USING ERRCODE='23505', CONSTRAINT='edm28_identity_duplicate_phone';
 END IF;
 IF new_email<>'' AND
   (TG_OP='INSERT' OR new.email IS DISTINCT FROM old.email)
   AND EXISTS(
     SELECT 1 FROM public.profiles p WHERE p.id<>new.id
     AND lower(btrim(coalesce(p.email,'')))=new_email
   ) THEN
    RAISE EXCEPTION 'Adresse email déjà enregistrée.' USING ERRCODE='23505', CONSTRAINT='edm28_identity_duplicate_email';
 END IF;
 RETURN new;
END $$;

DROP TRIGGER IF EXISTS edm28_guard_profile_identity ON public.profiles;
CREATE TRIGGER edm28_guard_profile_identity
BEFORE INSERT OR UPDATE OF first_name,last_name,phone,email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.edm28_guard_profile_identity();

COMMENT ON FUNCTION private.edm28_guard_profile_identity() IS
  'Customer identity duplication guard; does not expose or alter existing client records.';
