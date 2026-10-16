-- EDM28: check identity collisions beyond RLS and reject invalid identity edits.
-- Do not change existing profile rows.
CREATE OR REPLACE FUNCTION private.edm28_guard_profile_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  new_first text := private.edm28_identity_name(new.first_name);
  new_last text := private.edm28_identity_name(new.last_name);
  new_phone text := private.edm28_identity_phone(new.phone);
  new_email text := lower(btrim(coalesce(new.email, '')));
  changed boolean;
BEGIN
  IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL AND new.role <> 'customer' THEN
    RAISE EXCEPTION 'Inscription administrateur non autorisée.' USING ERRCODE = '42501';
  END IF;

  changed := TG_OP = 'INSERT'
    OR new.first_name IS DISTINCT FROM old.first_name
    OR new.last_name IS DISTINCT FROM old.last_name
    OR new.phone IS DISTINCT FROM old.phone
    OR new.email IS DISTINCT FROM old.email;
  IF NOT changed THEN RETURN new; END IF;

  IF (TG_OP = 'INSERT' OR new.first_name IS DISTINCT FROM old.first_name) AND new_first = '' THEN
    RAISE EXCEPTION 'Prénom obligatoire.' USING ERRCODE = '23514';
  END IF;
  IF (TG_OP = 'INSERT' OR new.last_name IS DISTINCT FROM old.last_name) AND new_last = '' THEN
    RAISE EXCEPTION 'Nom obligatoire.' USING ERRCODE = '23514';
  END IF;
  IF (TG_OP = 'INSERT' OR new.phone IS DISTINCT FROM old.phone)
     AND new_phone !~ '^[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'Numéro de téléphone invalide.' USING ERRCODE = '23514';
  END IF;
  IF (TG_OP = 'INSERT' OR new.email IS DISTINCT FROM old.email) AND new_email = '' THEN
    RAISE EXCEPTION 'Adresse email obligatoire.' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(2042816);

  IF new_first <> '' AND new_last <> ''
     AND (TG_OP = 'INSERT'
       OR new.first_name IS DISTINCT FROM old.first_name
       OR new.last_name IS DISTINCT FROM old.last_name)
     AND EXISTS (
       SELECT 1 FROM public.profiles p WHERE p.id <> new.id
         AND private.edm28_identity_name(p.first_name) = new_first
         AND private.edm28_identity_name(p.last_name) = new_last
     ) THEN
    RAISE EXCEPTION 'Identité client déjà enregistrée.'
      USING ERRCODE = '23505', CONSTRAINT = 'edm28_identity_duplicate_name';
  END IF;

  IF new_phone <> ''
     AND (TG_OP = 'INSERT' OR new.phone IS DISTINCT FROM old.phone)
     AND EXISTS (
       SELECT 1 FROM public.profiles p WHERE p.id <> new.id
         AND private.edm28_identity_phone(p.phone) = new_phone
     ) THEN
    RAISE EXCEPTION 'Numéro de téléphone déjà enregistré.'
      USING ERRCODE = '23505', CONSTRAINT = 'edm28_identity_duplicate_phone';
  END IF;

  IF new_email <> ''
     AND (TG_OP = 'INSERT' OR new.email IS DISTINCT FROM old.email)
     AND EXISTS (
       SELECT 1 FROM public.profiles p WHERE p.id <> new.id
         AND lower(btrim(coalesce(p.email, ''))) = new_email
     ) THEN
    RAISE EXCEPTION 'Adresse email déjà enregistrée.'
      USING ERRCODE = '23505', CONSTRAINT = 'edm28_identity_duplicate_email';
  END IF;
  RETURN new;
END;
$function$


REVOKE ALL ON FUNCTION private.edm28_guard_profile_identity() FROM PUBLIC, anon, authenticated;
