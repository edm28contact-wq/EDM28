REVOKE UPDATE ON public.consumer_withdrawal_requests FROM authenticated;
GRANT UPDATE(review_status,review_note,reviewed_at)
ON public.consumer_withdrawal_requests TO authenticated;
CREATE OR REPLACE FUNCTION private.edm28_preserve_withdrawal_statement()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF (new.id,new.submitted_at,new.contract_reference,new.consumer_name,
     new.consumer_email,new.consumer_address,new.statement,new.channel,
     new.legal_version,new.request_digest)
 IS DISTINCT FROM
    (old.id,old.submitted_at,old.contract_reference,old.consumer_name,
     old.consumer_email,old.consumer_address,old.statement,old.channel,
     old.legal_version,old.request_digest)
 THEN
  RAISE EXCEPTION 'La declaration originale de retractation est non modifiable.'
    USING ERRCODE='23514';
 END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION private.edm28_preserve_withdrawal_statement() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS edm28_preserve_withdrawal_statement
ON public.consumer_withdrawal_requests;
CREATE TRIGGER edm28_preserve_withdrawal_statement
BEFORE UPDATE ON public.consumer_withdrawal_requests FOR EACH ROW
EXECUTE FUNCTION private.edm28_preserve_withdrawal_statement();
