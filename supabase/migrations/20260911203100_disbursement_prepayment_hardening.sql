-- Correctifs de securite et saisie des coordonnees de debours.

create or replace function private.guard_disbursement_payment_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and (
       new.payment_status is distinct from old.payment_status
       or new.prepaid_amount is distinct from old.prepaid_amount
       or new.paid_at is distinct from old.paid_at
       or new.payment_currency is distinct from old.payment_currency
       or new.prepayment_required is distinct from old.prepayment_required
     ) then
    raise exception 'Le statut de paiement du debours est gere cote serveur.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.client_save_disbursement_billing(
  p_request_id uuid,
  p_billing jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_billing jsonb;
  v_address text;
  v_postal text;
  v_city text;
  v_country text;
begin
  if auth.uid() is null then
    raise exception 'Connexion client requise.' using errcode = '42501';
  end if;

  v_address := left(btrim(coalesce(p_billing ->> 'address', '')), 180);
  v_postal := left(btrim(coalesce(p_billing ->> 'postal_code', '')), 20);
  v_city := left(btrim(coalesce(p_billing ->> 'city', '')), 100);
  v_country := left(btrim(coalesce(p_billing ->> 'country', 'France')), 80);

  if v_address = '' or v_postal = '' or v_city = '' or v_country = '' then
    raise exception 'Adresse, code postal, ville et pays sont obligatoires.';
  end if;

  v_billing := jsonb_build_object(
    'address', v_address,
    'postal_code', v_postal,
    'city', v_city,
    'country', v_country,
    'updated_at', timezone('utc', now())
  );

  update public.service_requests
  set disbursement_billing = v_billing,
      updated_at = timezone('utc', now())
  where id = p_request_id
    and user_id = auth.uid()
    and parts_purchase_mode = 'edm_disbursement'
    and status <> 'cancelled';

  if not found then
    raise exception 'Demande de debours introuvable.' using errcode = '42501';
  end if;

  return v_billing;
end;
$$;

revoke all on function public.client_save_disbursement_billing(uuid, jsonb) from public, anon;
grant execute on function public.client_save_disbursement_billing(uuid, jsonb) to authenticated;