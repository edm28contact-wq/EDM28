create index if not exists disbursements_user_id_idx on public.disbursements(user_id);
create index if not exists disbursements_vehicle_id_idx on public.disbursements(vehicle_id);
create index if not exists disbursements_service_request_id_idx on public.disbursements(service_request_id);
create index if not exists disbursements_quote_id_idx on public.disbursements(quote_id);
create index if not exists disbursements_invoice_id_idx on public.disbursements(invoice_id);
