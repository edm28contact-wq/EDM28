-- Legal archive independent of a removable website account.
-- Keep signed evidence immutable while allowing Auth user account deletion.
ALTER TABLE public.quote_signatures DROP CONSTRAINT IF EXISTS quote_signatures_quote_id_fkey;
ALTER TABLE public.quote_signatures DROP CONSTRAINT IF EXISTS quote_signatures_user_id_fkey;
COMMENT ON TABLE public.quote_signatures IS
'Immutable contractual evidence archive, separate from deletable Auth accounts. Retention periods and lawful basis must be documented in EDM28 privacy policy.';
