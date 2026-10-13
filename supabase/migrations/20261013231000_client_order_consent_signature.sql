-- Basic authenticated electronic acknowledgment of an already-published order.
-- The client must actively tick the acceptance box and type the matching profile name.
-- Store which immutable PDF path was approved; keep issued documents unchanged.
alter table public.repair_orders
  add column if not exists client_signature_name text,
  add column if not exists client_signature_pdf_path text,
  add column if not exists client_signature_method text;

alter table public.business_configuration
  add column if not exists workshop_signer_name text not null default 'Enguerrand D’Anglade',
  add column if not exists workshop_signature_path text;

create or replace function private.client_sign_repair_order(
  p_order_id uuid, p_name text, p_accept boolean
) returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.repair_orders%rowtype;
  v_expected_name text;
  v_signed_at timestamptz;
begin
  if v_user is null then
    raise exception 'Connexion requise.' using errcode='42501';
  end if;
  if p_accept is distinct from true then
    raise exception 'Votre accord explicite est obligatoire.' using errcode='22023';
  end if;
  select * into v_order from public.repair_orders
  where id=p_order_id and user_id=v_user for update;
  if not found or v_order.visible_to_client is not true
    or v_order.pdf_path is null then
    raise exception 'Ordre de réparation publié introuvable.' using errcode='42501';
  end if;
  if v_order.signed_at is not null then return v_order.signed_at; end if;
  if v_order.status not in ('ready','signed') then
    raise exception 'Cet ordre ne peut plus être signé.' using errcode='22023';
  end if;
  select nullif(btrim(concat_ws(' ',nullif(btrim(first_name),''),nullif(btrim(last_name),''))),'')
    into v_expected_name
    from public.profiles where id=v_user;
  if v_expected_name is null then
    raise exception 'Complétez votre prénom et nom dans votre profil avant de signer.' using errcode='22023';
  end if;
  if lower(btrim(coalesce(p_name,''))) <> lower(v_expected_name) then
    raise exception 'Saisissez le prénom et le nom de votre compte pour signer.' using errcode='22023';
  end if;
  update public.repair_orders
  set signed_at=now(), status='signed', client_signature_name=v_expected_name,
      client_signature_pdf_path=v_order.pdf_path,
      client_signature_method='authenticated_explicit_acceptance',
      updated_at=now()
  where id=p_order_id and user_id=v_user and signed_at is null
  returning signed_at into v_signed_at;
  if v_signed_at is null then raise exception 'La signature n’a pas été enregistrée.'; end if;
  return v_signed_at;
end; $$;
revoke all on function private.client_sign_repair_order(uuid,text,boolean) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.client_sign_repair_order(uuid,text,boolean) to authenticated;

create or replace function public.client_sign_repair_order(
  p_order_id uuid, p_name text, p_accept boolean
) returns timestamptz
language sql set search_path = ''
as $$ select private.client_sign_repair_order(p_order_id,p_name,p_accept) $$;
revoke all on function public.client_sign_repair_order(uuid,text,boolean) from public,anon;
grant execute on function public.client_sign_repair_order(uuid,text,boolean) to authenticated;

-- Existing signatures must remain bound to their original customer-facing document.
create or replace function private.protect_signed_order_document()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.signed_at is not null and (
    new.pdf_path is distinct from old.pdf_path
    or new.authorized_work is distinct from old.authorized_work
    or new.quote_id is distinct from old.quote_id
    or new.user_id is distinct from old.user_id
    or new.signed_at is distinct from old.signed_at
    or new.client_signature_pdf_path is distinct from old.client_signature_pdf_path
  ) then
    raise exception 'Document signé : une nouvelle version nécessite un nouvel accord client.';
  end if;
  return new;
end; $$;
drop trigger if exists protect_signed_order_document on public.repair_orders;
create trigger protect_signed_order_document
before update on public.repair_orders
for each row execute function private.protect_signed_order_document();

insert into public.message_templates(template_key,label,subject,body,enabled)
values(
 'repair_order_published','Ordre de réparation client',
 'Votre ordre de réparation EDM28 {{order_number}}',
 E'Bonjour {{client_name}},\n\nVotre ordre de réparation {{order_number}} est disponible. Le PDF est joint à cet email.\n\nPour le consulter et confirmer votre accord par signature électronique simple, connectez-vous à votre espace Mes interventions : https://edm28.fr/mes-interventions\n\nCordialement,\n{{business_name}}',
 true
)
on conflict (template_key) do nothing;
