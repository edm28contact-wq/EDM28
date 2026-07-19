do $$
declare
  t text;
  admin_policy text;
begin
  foreach t in array array[
    'appointments','interventions','invoice_items','invoices','payments',
    'quote_items','quotes','repair_orders','service_options','site_services','site_settings'
  ] loop
    admin_policy := case t
      when 'repair_orders' then 'orders_admin_all'
      when 'service_options' then 'options_admin_all'
      when 'site_services' then 'services_admin_all'
      when 'site