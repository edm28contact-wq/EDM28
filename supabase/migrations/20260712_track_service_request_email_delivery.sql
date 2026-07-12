begin;

create or replace function public.set_initial_service_request_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'submitted' then
    new.status := 'pending_email';
  end if;
  return new;
end;
$$;

revoke execute on function public.set_initial_service_request_status() from public, anon, authenticated;

drop trigger if exists set_initial_service_request_status on public.service_requests;
create trigger set_initial_service_request_status
before insert on public.service_requests
for each row execute function public.set_initial_service_request_status();

commit;
