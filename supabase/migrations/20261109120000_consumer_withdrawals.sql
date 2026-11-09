-- EDM28: rights of withdrawal for consumers using contracts concluded online.
-- The declaration can be submitted without an account; only the server can create it.
CREATE TABLE IF NOT EXISTS public.consumer_withdrawal_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 contract_reference text NOT NULL CHECK(char_length(contract_reference) BETWEEN 1 AND 100),
 consumer_name text NOT NULL CHECK(char_length(consumer_name) BETWEEN 2 AND 160),
 consumer_email text NOT NULL CHECK(char_length(consumer_email) BETWEEN 5 AND 254),
 consumer_address text,
 statement text NOT NULL DEFAULT 'Je vous notifie ma retractation du contrat reference ci-dessus.',
 channel text NOT NULL DEFAULT 'website' CHECK(channel='website'),
 legal_version text NOT NULL DEFAULT 'edm28-cgp-2026-11-09',
 request_digest text NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
 receipt_status text NOT NULL DEFAULT 'pending' CHECK(receipt_status IN ('pending','sent','failed')),
 receipt_sent_at timestamptz,
 review_status text NOT NULL DEFAULT 'received' CHECK(review_status IN ('received','reviewing','processed')),
 review_note text,
 reviewed_at timestamptz,
 CHECK(consumer_email=lower(btrim(consumer_email)))
);
CREATE INDEX IF NOT EXISTS idx_consumer_withdrawal_submitted_at
 ON public.consumer_withdrawal_requests(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_consumer_withdrawal_reference
 ON public.consumer_withdrawal_requests(contract_reference);
ALTER TABLE public.consumer_withdrawal_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consumer_withdrawal_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.consumer_withdrawal_requests TO authenticated;
DROP POLICY IF EXISTS consumer_withdrawal_admin_read ON public.consumer_withdrawal_requests;
CREATE POLICY consumer_withdrawal_admin_read ON public.consumer_withdrawal_requests
FOR SELECT TO authenticated USING((SELECT private.is_admin()));
DROP POLICY IF EXISTS consumer_withdrawal_admin_update ON public.consumer_withdrawal_requests;
CREATE POLICY consumer_withdrawal_admin_update ON public.consumer_withdrawal_requests
FOR UPDATE TO authenticated USING((SELECT private.is_admin()))
WITH CHECK((SELECT private.is_admin()));
COMMENT ON TABLE public.consumer_withdrawal_requests IS
'Contract withdrawal submissions received through the public website; no immediate cancellation of appointments or invoices.';
