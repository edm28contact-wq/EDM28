create or replace function private.guard_repair_order_control_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('completed', 'invoiced')
     and old.status not in ('completed', 'invoiced') then
    if nullif(new.workshop_checks->>'intervention_completed_at', '') is null then
      raise exception 'Terminez l intervention avant la checklist de controle.';
    end if;

    if not exists (
      select 1
      from public.inspection_reports report
      where report.repair_order_id = new.id
        and report.status = 'completed'
        and report.pdf_path is not null
        and report.visible_to_client is true
    ) then
      raise exception 'Checklist de controle terminee et PDF publie obligatoires avant cloture.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_repair_order_control_gate() from public, anon, authenticated;

drop trigger if exists guard_repair_order_control_gate on public.repair_orders;
create trigger guard_repair_order_control_gate
before update of status on public.repair_orders
for each row execute function private.guard_repair_order_control_gate();

notify pgrst, 'reload schema';
