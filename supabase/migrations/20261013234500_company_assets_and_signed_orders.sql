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
