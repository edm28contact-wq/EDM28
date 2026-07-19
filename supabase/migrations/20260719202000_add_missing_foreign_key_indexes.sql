do $$
declare
  r record;
  idx_name text;
  cols text;
begin
  for r in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      con.conname as constraint_name,
      string_agg(quote_ident(a.attname), ', ' order by u.ordinality) as columns_sql,
      array_agg(a.attnum order by u.ordinality) as attnums,
      c.oid as table_oid
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join unnest(con.conkey) with ordinality as u(attnum, ordinality) on true
    join pg_attribute a on a.attrelid = c.oid and a.attnum = u.attnum
    where con.contype = 'f' and n.nspname = 'public'
    group by n.nspname, c.relname, con.conname, c.oid
  loop
    if not exists (
      select 1
      from pg_index i
      where i.indrelid = r.table_oid
        and i.indisvalid
        and i.indpred is null
        and (i.indkey::smallint[])[1:cardinality(r.attnums)] = r.attnums
    ) then
      idx_name := left('idx_' || r.table_name || '_' || regexp_replace(r.constraint_name, '_fkey$', ''), 63);
      execute format('create index if not exists %I on %I.%I (%s)', idx_name, r.schema_name, r.table_name, r.columns_sql);
    end if;
  end loop;
end
$$;