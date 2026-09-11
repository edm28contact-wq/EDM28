-- Parcours pièces / rendez-vous / OR EDM28

alter table public.service_requests
  add column if not exists parts_purchase_mode text;

alter table public.service_requests
  drop constraint if exists service_requests_parts_purchase_mode_check;

alter table public.service_requests
  add constraint service_requests_parts_purchase_mode_check
  check (parts_purchase_mode is null or parts_purchase_mode in ('client_direct','edm_disbursement'));

-- Durées validées après essais atelier.
update public.site_services
set duration_minutes = 120,
    updated_at = timezone('utc', now())
where slug = 'disques-plaquettes-avant';

update public.site_services
set duration_minutes = 60,
    updated_at = timezone('utc', now())
where slug = 'plaquettes-frein-avant';

-- Aucun rendez-vous client avant un délai minimal de sept jours.
create or replace function public.get_available_booking_slots(
  p_quote_id uuid,
  p_from date default current_date,
  p_days integer default 21
)
returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_quote public.quotes%rowtype;
  v_duration integer;
begin
  select * into v_quote
  from public.quotes
  where id = p_quote_id
    and user_id = auth.uid()
    and visible_to_client = true;

  if not found then raise exception 'Devis introuvable.'; end if;
  if v_quote.status <> 'accepted' then raise exception 'Le devis doit être accepté avant la prise de rendez-vous.'; end if;
  if exists(select 1 from public.repair_orders where quote_id = v_quote.id and status <> 'cancelled') then
    raise exception 'Ce devis possède déjà une intervention planifiée.';
  end if;

  v_duration := coalesce(v_quote.labor_duration_minutes, 0);
  if v_duration < 15 then raise exception 'La durée de main-d’œuvre du devis doit être renseignée.'; end if;

  return query
  with days as (
    select generate_series(p_from, p_from + greatest(1, least(p_days, 60)) - 1, interval '1 day')::date work_day
  ),
  day_rules as (
    select d.work_day,
           coalesce(ex.status, case when bh.is_open then 'open' else 'closed' end) rule_status,
           coalesce(ex.morning_start, bh.morning_start) morning_start,
           coalesce(ex.morning_end, bh.morning_end) morning_end,
           coalesce(ex.afternoon_start, bh.afternoon_start) afternoon_start,
           coalesce(ex.afternoon_end, bh.afternoon_end) afternoon_end
    from days d
    left join public.business_hours bh on bh.weekday = extract(isodow from d.work_day)::int - 1
    left join lateral (
      select e.*
      from public.business_schedule_exceptions e
      where d.work_day between e.starts_on and e.ends_on
      order by e.created_at desc
      limit 1
    ) ex on true
  ),
  periods as (
    select work_day, morning_start period_start, morning_end period_end
    from day_rules
    where rule_status = 'open' and morning_start is not null and morning_end is not null
    union all
    select work_day, afternoon_start, afternoon_end
    from day_rules
    where rule_status = 'open' and afternoon_start is not null and afternoon_end is not null
  ),
  candidates as (
    select gs slot_start, gs + make_interval(mins => v_duration) slot_end
    from periods p
    cross join lateral generate_series(
      (p.work_day + p.period_start) at time zone 'Europe/Paris',
      ((p.work_day + p.period_end) at time zone 'Europe/Paris') - make_interval(mins => v_duration),
      interval '15 minutes'
    ) gs
  )
  select c.slot_start, c.slot_end
  from candidates c
  where c.slot_start >= now() + interval '7 days'
    and not exists (
      select 1
      from public.appointments a
      where a.status <> 'cancelled'
        and a.starts_at < c.slot_end + interval '30 minutes'
        and coalesce(a.ends_at, a.starts_at + interval '1 hour') + make_interval(mins => coalesce(a.buffer_minutes, 30)) > c.slot_start
    )
  order by c.slot_start;
end
$function$;

-- Un OR déjà publié avec PDF ne doit jamais être dépublié lors d'un simple rechargement du back-office.
create or replace function public.preserve_published_repair_order_visibility()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if old.visible_to_client is true
     and old.pdf_path is not null
     and new.visible_to_client is false
     and coalesce(new.status, old.status) <> 'cancelled' then
    new.visible_to_client := true;
  end if;
  return new;
end
$function$;

drop trigger if exists preserve_published_repair_order_visibility on public.repair_orders;
create trigger preserve_published_repair_order_visibility
before update of visible_to_client on public.repair_orders
for each row
execute function public.preserve_published_repair_order_visibility();