begin;

create table if not exists public.backoffice_configuration (
  id boolean primary key default true check (id),
  declared_activity_label text,
  activity_kind text check (activity_kind is null or activity_kind in ('service','mixed','sales')),
  vat_mode text check (vat_mode is null or vat_mode in ('franchise_en_base','liable')),
  urssaf_frequency text check (urssaf_frequency is null or urssaf_frequency in ('monthly','quarterly')),
  liberatory_tax_enabled boolean not null default false,
  acre_enabled boolean not null default false,
  acre_end_date date,
  dedicated_bank_account boolean not null default false,
  payment_methods text[] not null default '{}'::text[],
  customer_segments text[] not null default '{}'::text[],
  stock_mode text not null default 'per_job' check (stock_mode in ('none','per_job','light_stock')),
  enabled_modules jsonb not null default '{"quotes":true,"agenda":true,"workshop":true,"parts":true,"suppliers":true,"purchases":true,"invoices":true,"payments":true,"micro_accounting":true,"messaging":true,"automations":true,"ai_assistant":false,"documents":true}'::jsonb,
  accounting_features jsonb not null default '{"revenue_book":true,"sales_services_split":true,"purchase_register":true,"expenses":true,"urssaf_preparation":true,"tax_reserve":true,"cfe_tracking":true,"vat_tracking":false,"cash_register":false,"part_margin":true,"job_profitability":true,"cashflow":true,"annual_archive":true}'::jsonb,
  part_default_mode text not null default 'resale' check (part_default_mode in ('resale','customer_supplied','disbursement')),
  allow_part_resale boolean not null default true,
  allow_customer_supplied_parts boolean not null default true,
  allow_disbursements boolean not null default false,
  strict_disbursement_controls boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint backoffice_configuration_json_objects check (
    jsonb_typeof(enabled_modules) = 'object'
    and jsonb_typeof(accounting_features) = 'object'
  ),
  constraint backoffice_configuration_disbursement_strict check (
    not allow_disbursements or strict_disbursement_controls
  ),
  constraint backoffice_configuration_default_part_mode_enabled check (
    (part_default_mode = 'resale' and allow_part_resale)
    or (part_default_mode = 'customer_supplied' and allow_customer_supplied_parts)
    or (part_default_mode = 'disbursement' and allow_disbursements)
  ),
  constraint backoffice_configuration_acre_date check (
    acre_enabled or acre_end_date is null
  )
);

insert into public.backoffice_configuration (id)
values (true)
on conflict (id) do nothing;

alter table public.backoffice_configuration enable row level security;

drop policy if exists "admins read backoffice configuration" on public.backoffice_configuration;
create policy "admins read backoffice configuration"
on public.backoffice_configuration
for select
to authenticated
using ((select private.is_admin()));

drop policy if exists "admins update backoffice configuration" on public.backoffice_configuration;
create policy "admins update backoffice configuration"
on public.backoffice_configuration
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

grant select, update on public.backoffice_configuration to authenticated;
revoke all on public.backoffice_configuration from anon;

alter table public.quote_items
  add column if not exists part_handling_mode text,
  add column if not exists purchase_total numeric,
  add column if not exists supplier_invoice_holder text,
  add column if not exists customer_mandate_reference text,
  add column if not exists supplier_document_path text,
  add column if not exists business_purchase_reference text;

alter table public.invoice_items
  add column if not exists part_handling_mode text,
  add column if not exists purchase_total numeric,
  add column if not exists supplier_invoice_holder text,
  add column if not exists customer_mandate_reference text,
  add column if not exists supplier_document_path text,
  add column if not exists business_purchase_reference text,
  add column if not exists margin_amount numeric generated always as ((quantity * unit_price) - coalesce(purchase_total, 0)) stored;

alter table public.quote_items drop constraint if exists quote_items_item_type_check;
alter table public.quote_items
  add constraint quote_items_item_type_check
  check (item_type in ('labor','part','delivery','discount','disbursement','other'));

alter table public.quote_items
  add constraint quote_items_part_handling_mode_check
  check (part_handling_mode is null or part_handling_mode in ('resale','customer_supplied','disbursement')) not valid,
  add constraint quote_items_purchase_total_check
  check (purchase_total is null or purchase_total >= 0) not valid,
  add constraint quote_items_part_mode_integrity
  check (
    (item_type not in ('part','disbursement') and part_handling_mode is null)
    or (item_type = 'part' and part_handling_mode = 'resale')
    or (item_type = 'part' and part_handling_mode = 'customer_supplied' and unit_price = 0 and coalesce(purchase_total, 0) = 0)
    or (
      item_type = 'disbursement'
      and part_handling_mode = 'disbursement'
      and purchase_total is not null
      and purchase_total = quantity * unit_price
      and nullif(trim(customer_mandate_reference), '') is not null
    )
  ) not valid;

alter table public.invoice_items drop constraint if exists invoice_items_item_type_check;
alter table public.invoice_items
  add constraint invoice_items_item_type_check
  check (item_type in ('labor','part','delivery','discount','disbursement','other'));

alter table public.invoice_items
  add constraint invoice_items_part_handling_mode_check
  check (part_handling_mode is null or part_handling_mode in ('resale','customer_supplied','disbursement')) not valid,
  add constraint invoice_items_purchase_total_check
  check (purchase_total is null or purchase_total >= 0) not valid,
  add constraint invoice_items_part_mode_integrity
  check (
    (item_type not in ('part','disbursement') and part_handling_mode is null)
    or (
      item_type = 'part'
      and part_handling_mode = 'resale'
      and purchase_total is not null
      and supplier_invoice_holder = 'business'
      and nullif(trim(business_purchase_reference), '') is not null
    )
    or (
      item_type = 'part'
      and part_handling_mode = 'customer_supplied'
      and unit_price = 0
      and coalesce(purchase_total, 0) = 0
    )
    or (
      item_type = 'disbursement'
      and part_handling_mode = 'disbursement'
      and purchase_total is not null
      and purchase_total = quantity * unit_price
      and supplier_invoice_holder = 'customer'
      and nullif(trim(customer_mandate_reference), '') is not null
      and nullif(trim(supplier_document_path), '') is not null
    )
  ) not valid;

comment on table public.backoffice_configuration is 'Choix fonctionnels du back-office solo, renseignés par le propriétaire depuis l onglet Gestion.';
comment on column public.invoice_items.part_handling_mode is 'resale: EDM28 revend la pièce; customer_supplied: pièce fournie par le client; disbursement: débours strict au nom du client.';
comment on column public.invoice_items.margin_amount is 'Indicateur de gestion interne, jamais présenté comme bénéfice fiscal officiel.';

commit;
