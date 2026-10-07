-- Supporting indexes for active EDM28 back-office modules.

create index if not exists idx_invoice_items_invoice_id
  on public.invoice_items(invoice_id);

create index if not exists idx_invoice_items_source_quote_item_id
  on public.invoice_items(source_quote_item_id);

create index if not exists idx_outbound_notifications_user_id
  on public.outbound_notifications(user_id);

create index if not exists idx_audit_log_actor_id
  on public.audit_log(actor_id);
