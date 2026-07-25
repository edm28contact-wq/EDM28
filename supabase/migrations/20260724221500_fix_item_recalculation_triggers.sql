begin;

create or replace function public.recalculate_quote_from_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_quote_totals(old.quote_id);
    return old;
  end if;
  perform public.recalculate_quote_totals(new.quote_id);
  return new;
end
$$;

create or replace function public.recalculate_invoice_from_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_invoice_totals(old.invoice_id);
    return old;
  end if;
  perform public.recalculate_invoice_totals(new.invoice_id);
  return new;
end
$$;

commit;
