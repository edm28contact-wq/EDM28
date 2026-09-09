create unique index if not exists outbound_notifications_review_once_idx
  on public.outbound_notifications (template_key, related_type, related_id)
  where template_key = 'review_request'
    and related_type = 'invoice'
    and related_id is not null
    and status in ('pending','sent');
