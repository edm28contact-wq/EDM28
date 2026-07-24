begin;

create unique index if not exists client_messages_ai_draft_unique_idx
  on public.client_messages(ai_draft_id)
  where ai_draft_id is not null;

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
  v_recent_count integer := 0;
  v_body text := btrim(coalesce(p_body, ''));
  v_subject text := nullif(left(btrim(coalesce(p_subject, '')), 160), '');
begin
  if v_user_id is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 4000 then
    raise exception 'Le message doit contenir entre 1 et 4000 caracteres.';
  end if;

  select count(*)
  into v_recent_count
  from public.client_messages message
  where message.user_id = v_user_id
    and message.direction = 'inbound'
    and message.channel = 'site'
    and message.created_at >= timezone('utc', now()) - interval '10 minutes';

  if v_recent_count >= 12 then
    raise exception 'Trop de messages envoyes. Reessayez dans quelques minutes.';
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

  insert into public.audit_log (
    actor_id,
    entity_type,
    entity_id,
    action,
    new_value
  ) values (
    v_user_id,
    'client_message',
    v_message_id::text,
    'message.client_sent',
    jsonb_build_object('service_request_id', p_service_request_id)
  );

  return v_message_id;
end;
$$;

revoke all on function public.client_send_message(text, uuid, text) from public, anon;
grant execute on function public.client_send_message(text, uuid, text) to authenticated;

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
  v_draft_payload jsonb;
  v_draft_request_id uuid;
  v_human_edited boolean := false;
begin
  if not private.is_admin() then
    raise exception 'Acces administrateur requis.' using errcode = '42501';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 4000 then
    raise exception 'Le message doit contenir entre 1 et 4000 caracteres.';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_user_id
      and profile.role = 'customer'
  ) then
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

  if p_ai_draft_id is not null then
    select draft.draft_payload, draft.service_request_id
    into v_draft_payload, v_draft_request_id
    from public.ai_drafts draft
    where draft.id = p_ai_draft_id
      and draft.user_id = p_user_id
      and draft.document_type = 'message'
      and draft.status in ('draft', 'reviewed')
    for update;

    if not found then
      raise exception 'Brouillon IA introuvable ou deja utilise.';
    end if;

    if v_draft_request_id is distinct from p_service_request_id then
      raise exception 'Le brouillon IA ne correspond pas a la demande selectionnee.';
    end if;

    v_human_edited :=
      coalesce(v_draft_payload ->> 'subject', '') is distinct from coalesce(v_subject, '')
      or coalesce(v_draft_payload ->> 'body', '') is distinct from v_body;
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
        draft_payload = draft_payload || jsonb_build_object(
          'approved_subject', v_subject,
          'approved_body', v_body,
          'human_edited', v_human_edited,
          'published_message_id', v_message_id
        ),
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
    'message.admin_sent',
    jsonb_build_object(
      'user_id', p_user_id,
      'service_request_id', p_service_request_id,
      'human_edited', v_human_edited
    ),
    jsonb_build_object('ai_draft_id', p_ai_draft_id)
  );

  return v_message_id;
end;
$$;

revoke all on function public.admin_send_message(uuid, text, uuid, text, uuid) from public, anon;
grant execute on function public.admin_send_message(uuid, text, uuid, text, uuid) to authenticated;

commit;
