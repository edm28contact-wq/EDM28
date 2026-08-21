alter table public.repair_orders
  add column if not exists internal_saved_at timestamptz,
  add column if not exists workshop_checks jsonb not null default '{}'::jsonb;

comment on column public.repair_orders.internal_saved_at is 'Date à laquelle l''ordre de réparation a été enregistré en interne.';
comment on column public.repair_orders.workshop_checks is 'Checklist interne de préparation atelier (liquides, pneus, essuie-glaces, feux et clignotants).';
