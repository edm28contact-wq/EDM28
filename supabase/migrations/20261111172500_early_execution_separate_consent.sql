ALTER TABLE public.quote_signature_challenges
 ADD COLUMN IF NOT EXISTS early_start_requested boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS full_performance_acknowledged boolean NOT NULL DEFAULT false;
ALTER TABLE public.quote_signatures
 ADD COLUMN IF NOT EXISTS early_start_requested boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS full_performance_acknowledged boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS early_start_recorded_at timestamptz;

ALTER TABLE public.quote_signature_challenges
 DROP CONSTRAINT IF EXISTS edm28_early_start_ack_required;
ALTER TABLE public.quote_signature_challenges
 ADD CONSTRAINT edm28_early_start_ack_required
 CHECK (NOT early_start_requested OR full_performance_acknowledged);
ALTER TABLE public.quote_signatures
 DROP CONSTRAINT IF EXISTS edm28_signed_early_start_ack_required;
ALTER TABLE public.quote_signatures
 ADD CONSTRAINT edm28_signed_early_start_ack_required
 CHECK (NOT early_start_requested OR (full_performance_acknowledged AND early_start_recorded_at IS NOT NULL));

CREATE OR REPLACE FUNCTION private.edm28_capture_early_start_proof()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE c public.quote_signature_challenges%rowtype;
BEGIN
 SELECT * INTO c FROM public.quote_signature_challenges
 WHERE quote_id=new.quote_id
  AND user_id=new.user_id
  AND state='pending'
  AND expires_at>now()
  AND code_hash IS NOT NULL
 ORDER BY created_at DESC LIMIT 1;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Demande de signature introuvable pour conserver le consentement.' USING ERRCODE='23514';
 END IF;
 new.early_start_requested := c.early_start_requested;
 new.full_performance_acknowledged := c.full_performance_acknowledged;
 new.early_start_recorded_at := CASE WHEN c.early_start_requested THEN now() ELSE NULL END;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION private.edm28_capture_early_start_proof() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS edm28_capture_early_start_proof ON public.quote_signatures;
CREATE TRIGGER edm28_capture_early_start_proof
BEFORE INSERT ON public.quote_signatures FOR EACH ROW
EXECUTE FUNCTION private.edm28_capture_early_start_proof();

COMMENT ON COLUMN public.quote_signatures.early_start_requested
 IS 'Express consumer request to begin performance during the statutory 14-day withdrawal period; it is not a blanket waiver.';
COMMENT ON COLUMN public.quote_signatures.full_performance_acknowledged
 IS 'Separate consumer acknowledgement that right to withdraw may be lost once the service is fully performed, subject to applicable law.';
