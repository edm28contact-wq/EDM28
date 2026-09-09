insert into public.message_templates (template_key,label,subject,body,enabled,updated_at)
values (
  'review_request',
  'Demande d’avis client',
  'Votre avis sur votre expérience avec EDM28',
  'Bonjour {{client_name}},\n\nMerci d’avoir confié votre véhicule à EDM28. Si vous souhaitez partager votre expérience, vous pouvez laisser un avis ici :\n{{review_url}}\n\nVotre retour aide les futurs clients à mieux connaître le garage.\n\nCordialement,\n{{business_name}}',
  false,
  now()
)
on conflict (template_key) do update
set label = excluded.label,
    subject = excluded.subject,
    body = excluded.body,
    enabled = false,
    updated_at = now();
