-- Index the foreign keys used by the active EDM28 customer/workshop journey.
-- These indexes improve joins, ownership lookups and referential checks as data grows.

create index if not exists idx_quotes_service_request_id
  on public.quotes(service_request_id);
create index if not exists idx_quotes_vehicle_id
  on public.quotes(vehicle_id);

create index if not exists idx_quote_items_quote_id
  on public.quote_items(quote_id);
create index if not exists idx_quote_items_service_id
  on public.quote_items(service_id);

create index if not exists idx_appointments_service_request_id
  on public.appointments(service_request_id);
create index if not exists idx_appointments_vehicle_id
  on public.appointments(vehicle_id);

create index if not exists idx_repair_orders_appointment_id
  on public.repair_orders(appointment_id);
create index if not exists idx_repair_orders_quote_id
  on public.repair_orders(quote_id);
create index if not exists idx_repair_orders_service_request_id
  on public.repair_orders(service_request_id);
create index if not exists idx_repair_orders_user_id
  on public.repair_orders(user_id);
create index if not exists idx_repair_orders_vehicle_id
  on public.repair_orders(vehicle_id);

create index if not exists idx_inspection_reports_appointment_id
  on public.inspection_reports(appointment_id);
create index if not exists idx_inspection_reports_repair_order_id
  on public.inspection_reports(repair_order_id);
create index if not exists idx_inspection_reports_user_id
  on public.inspection_reports(user_id);
create index if not exists idx_inspection_reports_vehicle_id
  on public.inspection_reports(vehicle_id);

create index if not exists idx_invoices_quote_id
  on public.invoices(quote_id);
create index if not exists idx_invoices_repair_id
  on public.invoices(repair_id);
create index if not exists idx_invoices_vehicle_id
  on public.invoices(vehicle_id);

create index if not exists idx_payments_invoice_id
  on public.payments(invoice_id);

create index if not exists idx_client_documents_invoice_id
  on public.client_documents(invoice_id);
create index if not exists idx_client_documents_quote_id
  on public.client_documents(quote_id);
create index if not exists idx_client_documents_repair_id
  on public.client_documents(repair_id);
create index if not exists idx_client_documents_vehicle_id
  on public.client_documents(vehicle_id);

create index if not exists idx_repair_documents_user_id
  on public.repair_documents(user_id);
