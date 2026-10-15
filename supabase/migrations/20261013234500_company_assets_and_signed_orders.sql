-- EDM28: brand assets are privately uploaded by admins; customer signatures are separate.
ALTER TABLE public.business_configuration
  ADD COLUMN IF NOT EXISTS workshop_signer_name text NOT NULL DEFAULT 'Enguerrand D’Anglade',
  ADD COLUMN IF NOT EXISTS workshop_signature_path text,
  ADD COLUMN IF NOT EXISTS workshop_stamp_path text;

ALTER TABLE public.repair_orders
  ADD COLUMN IF NOT EXISTS client_signature_name text,
  ADD COLUMN IF NOT EXISTS client_signature_method text,
  ADD COLUMN IF NOT EXISTS client_signature_original_pdf_path text,
  ADD COLUMN IF NOT EXISTS client_signature_final_pdf_path text,
  ADD COLUMN IF NOT EXISTS client_signature_source_sha256 text,
  ADD COLUMN IF NOT EXISTS client_signature_image_sha256 text;

-- Prevent changes to an issued, signed document while permitting ordinary progress
-- (ready -> in_progress -> completed -> invoiced) and accounting updates.
CREATE OR REPLACE FUNCTION private.protect_signed_repair_order()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF OLD.signed_at IS NOT NULL AND (
    NEW.signed_at IS DISTINCT FROM OLD.signed_at
    OR NEW.pdf_path IS DISTINCT FROM OLD.pdf_path
    OR NEW.client_signature_name IS DISTINCT FROM OLD.client_signature_name
    OR NEW.client_signature_original_pdf_path IS DISTINCT FROM OLD.client_signature_original_pdf_path
    OR NEW.client_signature_final_pdf_path IS DISTINCT FROM OLD.client_signature_final_pdf_path
    OR NEW.client_signature_source_sha256 IS DISTINCT FROM OLD.client_signature_source_sha256
    OR NEW.client_signature_image_sha256 IS DISTINCT FROM OLD.client_signature_image_sha256
    OR NEW.authorized_work IS DISTINCT FROM OLD.authorized_work
    OR NEW.quote_id IS DISTINCT FROM OLD.quote_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
  ) THEN
    RAISE EXCEPTION 'Cet OR est signé : le document et ses conditions sont verrouillés.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_signed_repair_order ON public.repair_orders;
CREATE TRIGGER protect_signed_repair_order
BEFORE UPDATE ON public.repair_orders
FOR EACH ROW EXECUTE FUNCTION private.protect_signed_repair_order();

-- The signed original and final PDF remain in private repair-documents storage.
-- RLS already permits the owner to read user-ID-prefixed files and prevents
-- clients from overwriting documents. No public storage policies are added.

-- Signed document may only be uploaded under the authenticated customer's ID
-- for an actual published, unsigned repair order. No UPDATE or DELETE granted.
DROP POLICY IF EXISTS repair_documents_client_signed_or_insert ON storage.objects;
CREATE POLICY repair_documents_client_signed_or_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
 bucket_id='repair-documents'
 AND (storage.foldername(name))[1] = (select auth.uid())::text
 AND (storage.foldername(name))[2] = 'signed-orders'
 AND EXISTS(
   SELECT 1 FROM public.repair_orders r
   WHERE r.user_id=(select auth.uid()) AND r.id::text=(storage.foldername(name))[3]
     AND r.visible_to_client=true AND r.signed_at IS NULL
     AND r.status IN ('ready','in_progress')
 )
 AND name ~ '[.]pdf$'
);

CREATE OR REPLACE FUNCTION private.client_sign_repair_order(
 p_order_id uuid, p_name text, p_accepted boolean, p_signed_pdf_path text,
 p_source_sha256 text, p_signature_sha256 text
) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_uid uuid := auth.uid();
 v_order public.repair_orders%ROWTYPE;
 v_name text;
 v_at timestamptz;
BEGIN
 IF v_uid IS NULL OR p_accepted IS DISTINCT FROM true
    OR NOT (p_source_sha256 ~ '^[0-9a-f]{64}$' AND p_signature_sha256 ~ '^[0-9a-f]{64}$')
 THEN RAISE EXCEPTION 'Accord ou informations de signature invalides.' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_order FROM public.repair_orders
 WHERE id=p_order_id AND user_id=v_uid FOR UPDATE;
 IF NOT FOUND OR v_order.visible_to_client IS DISTINCT FROM true
    OR v_order.pdf_path IS NULL OR v_order.signed_at IS NOT NULL
    OR v_order.status NOT IN ('ready','in_progress')
 THEN RAISE EXCEPTION 'OR indisponible pour signature.' USING ERRCODE='42501'; END IF;
 SELECT nullif(btrim(concat_ws(' ', first_name, last_name)),'')
 INTO v_name FROM public.profiles WHERE id=v_uid;
 IF v_name IS NULL OR lower(btrim(coalesce(p_name,'')))<>lower(v_name)
 THEN RAISE EXCEPTION 'Le nom saisi doit correspondre à votre compte client.' USING ERRCODE='22023'; END IF;
 IF p_signed_pdf_path !~ ('^'||v_uid::text||'/signed-orders/'||p_order_id::text||'/[0-9a-f-]{36}[.]pdf$')
 THEN RAISE EXCEPTION 'Chemin du PDF signé incorrect.' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS (
 SELECT 1 FROM storage.objects
 WHERE bucket_id='repair-documents' AND name=p_signed_pdf_path
   AND (metadata->>'size')::bigint BETWEEN 1000 AND 10485760
 ) THEN RAISE EXCEPTION 'Fichier PDF signé introuvable ou invalide.' USING ERRCODE='22023'; END IF;
 v_at := clock_timestamp();
 UPDATE public.repair_orders SET
   pdf_path=p_signed_pdf_path,
   signed_at=v_at,
   client_signature_name=v_name,
   client_signature_method='authenticated_drawn_signature',
   client_signature_original_pdf_path=v_order.pdf_path,
   client_signature_final_pdf_path=p_signed_pdf_path,
   client_signature_source_sha256=p_source_sha256,
   client_signature_image_sha256=p_signature_sha256,
   updated_at=v_at
 WHERE id=p_order_id AND user_id=v_uid AND signed_at IS NULL;
 RETURN v_at;
END $$;

CREATE OR REPLACE FUNCTION public.client_sign_repair_order(
 p_order_id uuid, p_name text, p_accepted boolean, p_signed_pdf_path text,
 p_source_sha256 text, p_signature_sha256 text
) RETURNS timestamptz
LANGUAGE sql SET search_path=''
AS $$
 SELECT private.client_sign_repair_order(
   p_order_id,p_name,p_accepted,p_signed_pdf_path,p_source_sha256,p_signature_sha256
 )
$$;
REVOKE ALL ON FUNCTION public.client_sign_repair_order(uuid,text,boolean,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_sign_repair_order(uuid,text,boolean,text,text,text) TO authenticated;
