begin;

alter table public.client_messages
  add column if not exists read_by_admin boolean not null default false,
  add column if not exists ai_draft_id uuid references public.ai_drafts(id) on delete set null;

update public.client_messages
set read_by_admin = true
where direction in ('outbound', 'system')
  and read_by_admin = false;

create index if not exists client_messages_user_created_idx
  on public.client_messages(user_id, created_at desc);

create index if not exists client_messages_request_created_idx
  on public.client_messages(service_request_id, created_at)
  where service_request_id is not null;

create index if not exists client_messages_admin_unread_idx
  on public.client_messages(user_id, created_at desc)
  where direction = 'inbound' and read_by_admin = false;

drop policy if exists messages_own_update on public.client_messages;
drop policy if exists messages_admin_update on public.client_messages;

create policy messages_admin_update
on public.client_messages
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create or replace function public.client_send_message(
  p_body text,
  p_service_request_id uuid default null,
  p_subject text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_message_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_subject text := nullif(left(btrim(coalesce(p_subject, '')), 160), '');
begin
  if v_user_id is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 4000 then
    raise exception 'Le message doit contenir entre 1 et 4000 caracteres.';
  end if;

  if p_service_request_id is not null and not exists (
    select 1
    from public.service_requests request
    where request.id = p_service_request_id
      and request.user_id = v_user_id
  ) then
    raise exception 'Demande introuvable ou non autorisee.' using errcode = '42501';
  end if;

  insert into public.client_messages (
    user_id,
    service_request_id,
    direction,
    subject,
    body,
    channel,
    visible_to_client,
    read_by_client,
    read_by_admin
  ) values (
    v_user_id,
    p_service_request_id,
    'inbound',
    v_subject,
    v_body,
    'site',
    true,
    true,
    false
  ) returning id into v_message_id;

  return v_message_id;
end;
$$;

revoke all on function public.client_send_message(text, uuid, text) from public, anon;
grant execute on function public.client_send_message(text, uuid, text) to authenticated;

create or replace function public.client_mark_messages_read(p_message_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;

  update public.client_messages
  set read_by_client = true
  where user_id = v_user_id
    and direction in ('outbound', 'system')
    and visible_to_client = true
    and read_by_client = false
    and id = any(coalesce(p_message_ids, array[]::uuid[]));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.client_mark_messages_read(uuid[]) from public, anon;
grant execute on function public.client_mark_messages_read(uuid[]) to authenticated;

create or replace function public.admin_send_message(
  p_user_id uuid,
  p_body text,
  p_service_request_id uuid default null,
  p_subject text default null,
  p_ai_draft_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_subject text := nullif(left(btrim(coalesce(p_subject, '')), 160), '');
begin
  if not private.is_admin() then
    raise exception 'Acces administrateur requis.' using errcode = '42501';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 4000 then
    raise exception 'Le message doit contenir entre 1 et 4000 caracteres.';
  end if;

  if not exists (select 1 from public.profiles profile where profile.id = p_user_id) then
    raise exception 'Client introuvable.';
  end if;

  if p_service_request_id is not null and not exists (
    select 1
    from public.service_requests request
    where request.id = p_service_request_id
      and request.user_id = p_user_id
  ) then
    raise exception 'La demande ne correspond pas au client.';
  end if;

  if p_ai_draft_id is not null and not exists (
    select 1
    from public.ai_drafts draft
    where draft.id = p_ai_draft_id
      and draft.user_id = p_user_id
      and draft.document_type = 'message'
      and draft.status in ('draft', 'reviewed')
  ) then
    raise exception 'Brouillon IA introuvable ou deja utilise.';
  end if;

  insert into public.client_messages (
    user_id,
    service_request_id,
    direction,
    subject,
    body,
    channel,
    visible_to_client,
    read_by_client,
    read_by_admin,
    ai_draft_id
  ) values (
    p_user_id,
    p_service_request_id,
    'outbound',
    v_subject,
    v_body,
    'site',
    true,
    false,
    true,
    p_ai_draft_id
  ) returning id into v_message_id;

  if p_ai_draft_id is not null then
    update public.ai_drafts
    set status = 'published',
        approved_by = auth.uid(),
        approved_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    where id = p_ai_draft_id;
  end if;

  insert into public.audit_log (
    actor_id,
    entity_type,
    entity_id,
    action,
    new_value,
    metadata
  ) values (
    auth.uid(),
    'client_message',
    v_message_id::text,
    'message.sent',
    jsonb_build_object('user_id', p_user_id, 'service_request_id', p_service_request_id),
    jsonb_build_object('ai_draft_id', p_ai_draft_id)
  );

  return v_message_id;
end;
$$;

revoke all on function public.admin_send_message(uuid, text, uuid, text, uuid) from public, anon;
grant execute on function public.admin_send_message(uuid, text, uuid, text, uuid) to authenticated;

create or replace function public.admin_mark_conversation_read(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  if not private.is_admin() then
    raise exception 'Acces administrateur requis.' using errcode = '42501';
  end if;

  update public.client_messages
  set read_by_admin = true
  where user_id = p_user_id
    and direction = 'inbound'
    and read_by_admin = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_mark_conversation_read(uuid) from public, anon;
grant execute on function public.admin_mark_conversation_read(uuid) to authenticated;

commit;
