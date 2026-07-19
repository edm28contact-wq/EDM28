do $$
declare
  t text;
  old_name text;
begin
  foreach t in array array[
    'appointments','interventions','invoice_items','invoices','payments',
    'quote_items','quotes','repair_orders','service_options','site_services','site_settings'
  ] loop
    old_name := case t
      when 'repair_orders' then 'orders_admin_all'
      when 'service_options' then 'options_admin_all'
      when 'site_services' then 'services_admin_all'
      when 'site_settings' then 'settings_admin_all'
      else t || '_admin_all'
    end;

    execute format('drop policy if exists %I on public.%I', old_name, t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.is_admin())',
      t || '_admin_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.is_admin()) with check (private.is_admin())',
      t || '_admin_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.is_admin())',
      t || '_admin_delete', t
    );
  end loop;
end
$$;