-- EDM28 quote signatures: evidence records, OTP challenge and server-side finalization.
-- Activation stays off until live email delivery and signed-PDF verification are tested.
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS client_signed_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS client_signed_pdf_path text;

CREATE TABLE IF NOT EXISTS public.quote_signature_policy(
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 enforced boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.quote_signature_policy(id,enforced) VALUES(true,false) ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.quote_signature_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_signature_policy FROM anon,authenticated;

CREATE TABLE IF NOT EXISTS public.quote_signature_challenges(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 quote_id uuid NOT NULL UNIQUE REFERENCES public.quotes(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 signer_email text NOT NULL, source_path text NOT NULL,
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
 code_hash text NOT NULL CHECK(code_hash ~ '^[0-9a-f]{64}$'),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','used'))
);
ALTER TABLE public.quote_signature_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_signature_challenges FROM anon,authenticated;
CREATE INDEX IF NOT EXISTS idx_quote_signature_challenges_user ON public.quote_signature_challenges(user_id);

CREATE TABLE IF NOT EXISTS public.quote_signatures(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 quote_id uuid NOT NULL UNIQUE REFERENCES public.quotes(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 signer_name text NOT NULL, signer_email text NOT NULL,
 quote_number text, total numeric NOT NULL,
 source_path text NOT NULL,source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
 signed_path text NOT NULL UNIQUE, signed_sha256 text NOT NULL CHECK(signed_sha256 ~ '^[0-9a-f]{64}$'),
 signed_at timestamptz NOT NULL DEFAULT now(),otp_verified_at timestamptz NOT NULL DEFAULT now(),
 consent_version text NOT NULL DEFAULT 'edm28-devis-v1',
 mechanism text NOT NULL DEFAULT 'authenticated_account_email_code',
 network_digest text CHECK(network_digest ~ '^[0-9a-f]{64}$')
);
ALTER TABLE public.quote_signatures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_signatures FROM anon,authenticated;
CREATE INDEX IF NOT EXISTS idx_quote_signatures_user ON public.quote_signatures(user_id);

CREATE OR REPLACE FUNCTION private.edm28_quote_signature_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 RAISE EXCEPTION 'Le dossier de preuve ne peut pas etre modifie.' USING ERRCODE='23514';
END $function$;

CREATE OR REPLACE FUNCTION private.edm28_quote_signature_required()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF old.status='sent' AND new.status='accepted' AND
  EXISTS (SELECT 1 FROM public.quote_signature_policy WHERE id=true AND enforced)
  AND NOT EXISTS (
    SELECT 1 FROM public.quote_signatures s
    WHERE s.quote_id=new.id AND s.user_id=new.user_id
      AND s.source_path=old.pdf_path
      AND s.signed_path=new.client_signed_pdf_path
      AND s.signed_at=new.client_signed_at
  ) THEN
    RAISE EXCEPTION 'Ce devis doit etre signe avec le code de confirmation.'
      USING ERRCODE='23514';
 END IF;
 RETURN new;
END $function$;

CREATE OR REPLACE FUNCTION private.edm28_signed_quote_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF old.client_signed_at IS NOT NULL AND
  (new.status,new.user_id,new.quote_number,new.total,new.subtotal,new.discount,
   new.pdf_path,new.client_signed_at,new.client_signed_pdf_path,new.title,new.description)
  IS DISTINCT FROM
  (old.status,old.user_id,old.quote_number,old.total,old.subtotal,old.discount,
   old.pdf_path,old.client_signed_at,old.client_signed_pdf_path,old.title,old.description)
 THEN RAISE EXCEPTION 'Devis signe : modifications interdites.' USING ERRCODE='23514'; END IF;
 RETURN new;
END $function$;

CREATE OR REPLACE FUNCTION private.guard_client_quote_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
begin
  IF current_user <> 'postgres' AND (
      new.client_signed_at IS DISTINCT FROM old.client_signed_at OR
      new.client_signed_pdf_path IS DISTINCT FROM old.client_signed_pdf_path
    ) THEN
    RAISE EXCEPTION 'La preuve de signature ne peut pas etre modifiee par le client.' USING ERRCODE='42501';
  END IF;
  IF current_user = 'postgres' AND old.status = 'sent' AND new.status = 'accepted'
      AND new.client_signed_at IS NOT NULL AND new.client_signed_pdf_path IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.quote_signatures s WHERE s.quote_id=new.id
        AND s.user_id=new.user_id AND s.signed_path=new.client_signed_pdf_path
        AND s.signed_at=new.client_signed_at) THEN
    RETURN new;
  END IF;
  if (select private.is_admin()) then
    return new;
  end if;

  if auth.uid() is null or old.user_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;

  if old.status <> 'sent' or new.status not in ('accepted', 'refused') then
    raise exception 'Transition de devis interdite';
  end if;

  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.vehicle_id is distinct from old.vehicle_id
     or new.service_request_id is distinct from old.service_request_id
     or new.external_quote_id is distinct from old.external_quote_id
     or new.quote_number is distinct from old.quote_number
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.subtotal is distinct from old.subtotal
     or new.discount is distinct from old.discount
     or new.total is distinct from old.total
     or new.valid_until is distinct from old.valid_until
     or new.pdf_path is distinct from old.pdf_path
     or new.visible_to_client is distinct from old.visible_to_client
     or new.created_at is distinct from old.created_at then
    raise exception 'Seule la réponse au devis peut être modifiée';
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.edm28_finalize_signed_quote(p_quote_id uuid, p_challenge_id uuid, p_code_hash text, p_name text, p_signed_path text, p_signed_sha256 text, p_network_digest text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c public.quote_signature_challenges%rowtype;
 q public.quotes%rowtype;
 s public.quote_signatures%rowtype;
 v_name text := btrim(regexp_replace(coalesce(p_name,''),'[[:space:]]+',' ','g'));
BEGIN
 IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'Acces serveur uniquement.' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.quote_signature_challenges
 WHERE id=p_challenge_id AND quote_id=p_quote_id FOR UPDATE;
 IF NOT FOUND OR c.state<>'pending' OR c.expires_at<=now() OR c.attempts>=5 OR c.code_hash<>p_code_hash THEN
    RAISE EXCEPTION 'Code invalide ou expire.' USING ERRCODE='23514'; END IF;
 SELECT * INTO q FROM public.quotes WHERE id=p_quote_id AND user_id=c.user_id FOR UPDATE;
 IF NOT FOUND OR q.status<>'sent' OR NOT q.visible_to_client OR
   (q.valid_until IS NOT NULL AND q.valid_until<(now() AT TIME ZONE 'Europe/Paris')::date)
   OR q.pdf_path IS DISTINCT FROM c.source_path THEN
     RAISE EXCEPTION 'Devis modifie, traite ou expire.' USING ERRCODE='23514'; END IF;
 IF length(v_name)<3 OR length(v_name)>140 OR lower(v_name) IS DISTINCT FROM
  (SELECT lower(btrim(regexp_replace(concat_ws(' ',first_name,last_name),'[[:space:]]+',' ','g')))
   FROM public.profiles WHERE id=c.user_id)
 THEN RAISE EXCEPTION 'Identite du client non conforme.' USING ERRCODE='23514'; END IF;
 IF p_signed_sha256 !~ '^[0-9a-f]{64}$' OR p_network_digest !~ '^[0-9a-f]{64}$'
  OR p_signed_path !~ ('^'||c.user_id::text||'/signed-quotes/'||c.quote_id::text||'/[0-9a-f-]{36}[.]pdf$')
 THEN RAISE EXCEPTION 'Fichier signe invalide.' USING ERRCODE='23514'; END IF;
 INSERT INTO public.quote_signatures(quote_id,user_id,signer_name,signer_email,quote_number,total,
    source_path,source_sha256,signed_path,signed_sha256,network_digest)
 VALUES (q.id,q.user_id,v_name,c.signer_email,q.quote_number,q.total,c.source_path,c.source_sha256,
    p_signed_path,p_signed_sha256,p_network_digest) RETURNING * INTO s;
 UPDATE public.quote_signature_challenges SET state='used' WHERE id=c.id;
 UPDATE public.quotes SET status='accepted',client_signed_at=s.signed_at,
  client_signed_pdf_path=s.signed_path,updated_at=now() WHERE id=q.id;
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,new_value,metadata)
 VALUES (q.user_id,'quote',q.id::text,'quote.client_signed',
    jsonb_build_object('status','accepted','signed_pdf_path',s.signed_path),
    jsonb_build_object('signature_id',s.id,'source_sha256',s.source_sha256,
      'signed_sha256',s.signed_sha256,'method',s.mechanism));
 RETURN jsonb_build_object('quote_id',q.id,'signed_pdf_path',s.signed_path,'signed_at',s.signed_at);
END $function$;

CREATE OR REPLACE FUNCTION public.edm28_signature_wrong_code(p_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE n integer;
BEGIN
 IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
   RAISE EXCEPTION 'Acces serveur uniquement.' USING ERRCODE='42501'; END IF;
 UPDATE public.quote_signature_challenges SET attempts=least(5,attempts+1)
 WHERE id=p_id AND state='pending' AND expires_at>now() RETURNING attempts INTO n;
 RETURN coalesce(n,5);
END $function$;

REVOKE ALL ON FUNCTION private.edm28_quote_signature_required() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS edm28_quote_signature_required ON public.quotes;
CREATE TRIGGER edm28_quote_signature_required BEFORE UPDATE OF status ON public.quotes
FOR EACH ROW EXECUTE FUNCTION private.edm28_quote_signature_required();

REVOKE ALL ON FUNCTION private.edm28_quote_signature_immutable() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS edm28_quote_signature_immutable ON public.quote_signatures;
CREATE TRIGGER edm28_quote_signature_immutable BEFORE UPDATE OR DELETE ON public.quote_signatures
FOR EACH ROW EXECUTE FUNCTION private.edm28_quote_signature_immutable();

REVOKE ALL ON FUNCTION private.edm28_signed_quote_immutable() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS edm28_signed_quote_immutable ON public.quotes;
CREATE TRIGGER edm28_signed_quote_immutable BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION private.edm28_signed_quote_immutable();

REVOKE ALL ON FUNCTION public.edm28_finalize_signed_quote(uuid,uuid,text,text,text,text,text)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.edm28_finalize_signed_quote(uuid,uuid,text,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.edm28_signature_wrong_code(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.edm28_signature_wrong_code(uuid) TO service_role;

DROP POLICY IF EXISTS edm28_signed_quotes_no_update ON storage.objects;
CREATE POLICY edm28_signed_quotes_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE
TO authenticated USING(bucket_id<>'repair-documents' OR name !~ '^[0-9a-f-]{36}/signed-quotes/')
WITH CHECK(bucket_id<>'repair-documents' OR name !~ '^[0-9a-f-]{36}/signed-quotes/');
DROP POLICY IF EXISTS edm28_signed_quotes_no_delete ON storage.objects;
CREATE POLICY edm28_signed_quotes_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE
TO authenticated USING(bucket_id<>'repair-documents' OR name !~ '^[0-9a-f-]{36}/signed-quotes/');
