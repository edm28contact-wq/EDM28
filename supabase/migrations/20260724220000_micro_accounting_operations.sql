begin;

alter table public.quote_items
  add column if not exists customer_mandate_path text,
  add column if not exists vat_rate numeric;

alter table public.invoice_items
  add column if not exists customer_mandate_path text,
  add column if not exists vat_rate numeric,
  add column if not exists source_purchase_item_id uuid;

alter table public.quote_items
  add constraint quote_items_vat_rate_check
  check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100)) not valid;

alter table public.invoice_items
  add constraint invoice_items_vat_rate_check
  check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100)) not valid,
  add constraint invoice_items_part_document_integrity
  check (
    item_type not in ('part','disbursement')
    or (
      item_type = 'part'
      and part_handling_mode = 'resale'
      and nullif(trim(supplier_document_path), '') is not null
    )
    or (
      item_type = 'part'
      and part_handling_mode = 'customer_supplied'
    )
    or (
      item_type = 'disbursement'
      and part_handling_mode = 'disbursement'
      and nullif(trim(customer_mandate_path), '') is not null
      and nullif(trim(supplier_document_path), '') is not null
    )
  ) not valid;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (nullif(trim(name), '') is not null),
  contact_name text,
  email text,
  phone text,
  address text,
  vat_number text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id) on delete set null
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete restrict,
  purchase_number text,
  purchase_date date not null,
  invoice_date date,
  status text not null default 'draft' check (status in ('draft','validated','paid','cancelled')),
  payment_method text check (payment_method is null or payment_method in ('card','cash','bank_transfer','check','other')),
  paid_at timestamptz,
  total numeric not null default 0 check (total >= 0),
  document_path text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id) on delete set null,
  constraint purchases_validation_document check (
    status = 'draft' or status = 'cancelled' or (
      supplier_id is not null
      and nullif(trim(purchase_number), '') is not null
      and nullif(trim(document_path), '') is not null
    )
  )
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  category text not null check (category in ('part','consumable','tooling','fuel','travel','insurance','rent','software','bank_fee','subcontracting','other')),
  description text not null check (nullif(trim(description), '') is not null),
  quantity numeric not null default 1 check (quantity > 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  line_total numeric generated always as (quantity * unit_cost) stored,
  part_reference text,
  supplier_reference text,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  repair_order_id uuid references public.repair_orders(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.invoice_items
  add constraint invoice_items_source_purchase_item_fkey
  foreign key (source_purchase_item_id) references public.purchase_items(id) on delete set null not valid;

create table public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  category text not null check (category in ('consumable','tooling','fuel','travel','insurance','rent','software','bank_fee','subcontracting','cfe','tax','other')),
  description text not null check (nullif(trim(description), '') is not null),
  amount numeric not null check (amount > 0),
  expense_date date not null,
  payment_method text check (payment_method is null or payment_method in ('card','cash','bank_transfer','check','other')),
  document_path text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id) on delete set null
);

create table public.accounting_parameters (
  id boolean primary key default true check (id),
  social_rate_services numeric check (social_rate_services is null or (social_rate_services >= 0 and social_rate_services <= 100)),
  social_rate_sales numeric check (social_rate_sales is null or (social_rate_sales >= 0 and social_rate_sales <= 100)),
  liberatory_rate_services numeric check (liberatory_rate_services is null or (liberatory_rate_services >= 0 and liberatory_rate_services <= 100)),
  liberatory_rate_sales numeric check (liberatory_rate_sales is null or (liberatory_rate_sales >= 0 and liberatory_rate_sales <= 100)),
  reserve_extra_rate numeric check (reserve_extra_rate is null or (reserve_extra_rate >= 0 and reserve_extra_rate <= 100)),
  default_vat_rate numeric check (default_vat_rate is null or (default_vat_rate >= 0 and default_vat_rate <= 100)),
  cfe_expected_amount numeric check (cfe_expected_amount is null or cfe_expected_amount >= 0),
  cfe_due_date date,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.accounting_parameters(id)
values (true)
on conflict (id) do nothing;

create table public.tax_obligations (
  id uuid primary key default gen_random_uuid(),
  obligation_type text not null check (obligation_type in ('urssaf','cfe','vat','income_tax','other')),
  label text not null check (nullif(trim(label), '') is not null),
  period_start date,
  period_end date,
  due_date date,
  expected_amount numeric check (expected_amount is null or expected_amount >= 0),
  paid_amount numeric check (paid_amount is null or paid_amount >= 0),
  status text not null default 'planned' check (status in ('planned','prepared','submitted','paid','cancelled')),
  submitted_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id) on delete set null
);

create table public.cash_register_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default timezone('utc', now()),
  opening_balance numeric not null default 0 check (opening_balance >= 0),
  closed_at timestamptz,
  expected_closing_balance numeric check (expected_closing_balance is null or expected_closing_balance >= 0),
  actual_closing_balance numeric check (actual_closing_balance is null or actual_closing_balance >= 0),
  difference numeric,
  status text not null default 'open' check (status in ('open','closed')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  constraint cash_register_session_close_integrity check (
    (status = 'open' and closed_at is null and actual_closing_balance is null)
    or (status = 'closed' and closed_at is not null and actual_closing_balance is not null)
  )
);

create unique index cash_register_one_open_session
on public.cash_register_sessions ((status))
where status = 'open';

create table public.cash_register_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cash_register_sessions(id) on delete restrict,
  direction text not null check (direction in ('in','out')),
  amount numeric not null check (amount > 0),
  occurred_at timestamptz not null default timezone('utc', now()),
  source_type text not null check (source_type in ('payment','expense','purchase','adjustment')),
  payment_id uuid references public.payments(id) on delete set null,
  expense_id uuid references public.business_expenses(id) on delete set null,
  purchase_id uuid references public.purchases(id) on delete set null,
  reference text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  constraint cash_register_entry_source check (
    (source_type = 'payment' and payment_id is not null)
    or (source_type = 'expense' and expense_id is not null)
    or (source_type = 'purchase' and purchase_id is not null)
    or (source_type = 'adjustment' and payment_id is null and expense_id is null and purchase_id is null)
  )
);

create index purchases_supplier_id_idx on public.purchases(supplier_id);
create index purchases_purchase_date_idx on public.purchases(purchase_date desc);
create index purchase_items_purchase_id_idx on public.purchase_items(purchase_id);
create index business_expenses_expense_date_idx on public.business_expenses(expense_date desc);
create index business_expenses_supplier_id_idx on public.business_expenses(supplier_id);
create index tax_obligations_due_date_idx on public.tax_obligations(due_date);
create index cash_register_entries_session_id_idx on public.cash_register_entries(session_id);

alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.business_expenses enable row level security;
alter table public.accounting_parameters enable row level security;
alter table public.tax_obligations enable row level security;
alter table public.cash_register_sessions enable row level security;
alter table public.cash_register_entries enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'suppliers','purchases','purchase_items','business_expenses',
    'accounting_parameters','tax_obligations','cash_register_sessions','cash_register_entries'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'admins manage ' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',
      'admins manage ' || table_name,
      table_name
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end
$$;

create or replace view public.admin_revenue_book
with (security_invoker = true)
as
with line_totals as (
  select
    ii.invoice_id,
    coalesce(sum(case when ii.item_type in ('labor','delivery','other') then ii.quantity * ii.unit_price else 0 end), 0) as service_total,
    coalesce(sum(case when ii.item_type = 'part' and ii.part_handling_mode = 'resale' then ii.quantity * ii.unit_price else 0 end), 0) as sales_total,
    coalesce(sum(case when ii.item_type = 'disbursement' then ii.quantity * ii.unit_price else 0 end), 0) as disbursement_total
  from public.invoice_items ii
  group by ii.invoice_id
)
select
  p.id as payment_id,
  p.paid_at,
  p.paid_at::date as collection_date,
  p.payment_method,
  p.reference,
  p.amount,
  i.id as invoice_id,
  i.invoice_number,
  i.user_id,
  i.vehicle_id,
  round(p.amount * coalesce(lt.service_total, 0) / nullif(i.total, 0), 2) as service_collected,
  round(p.amount * coalesce(lt.sales_total, 0) / nullif(i.total, 0), 2) as sales_collected,
  round(p.amount * coalesce(lt.disbursement_total, 0) / nullif(i.total, 0), 2) as disbursement_collected,
  greatest(0, p.amount - round(p.amount * coalesce(lt.disbursement_total, 0) / nullif(i.total, 0), 2)) as ca_collected
from public.payments p
join public.invoices i on i.id = p.invoice_id
left join line_totals lt on lt.invoice_id = i.id;

create or replace view public.admin_purchase_register
with (security_invoker = true)
as
select
  p.id,
  p.purchase_number,
  p.purchase_date,
  p.invoice_date,
  p.status,
  p.payment_method,
  p.paid_at,
  p.total,
  p.document_path,
  p.notes,
  s.id as supplier_id,
  s.name as supplier_name,
  count(pi.id) as item_count,
  coalesce(sum(pi.line_total), 0) as item_total
from public.purchases p
left join public.suppliers s on s.id = p.supplier_id
left join public.purchase_items pi on pi.purchase_id = p.id
where p.status in ('validated','paid')
group by p.id, s.id, s.name;

create or replace view public.admin_part_margins
with (security_invoker = true)
as
select
  ii.id as invoice_item_id,
  ii.invoice_id,
  i.invoice_number,
  i.issued_at,
  i.user_id,
  i.vehicle_id,
  ii.description,
  ii.supplier_reference,
  ii.quantity,
  ii.unit_price,
  ii.purchase_total,
  ii.margin_amount,
  case when ii.quantity * ii.unit_price = 0 then 0
       else round((ii.margin_amount / (ii.quantity * ii.unit_price)) * 100, 2)
  end as margin_rate
from public.invoice_items ii
join public.invoices i on i.id = ii.invoice_id
where ii.item_type = 'part'
  and ii.part_handling_mode = 'resale';

create or replace view public.admin_job_management_margin
with (security_invoker = true)
as
select
  i.id as invoice_id,
  i.invoice_number,
  i.issued_at,
  i.user_id,
  i.vehicle_id,
  i.total,
  coalesce(sum(case when ii.item_type = 'disbursement' then ii.quantity * ii.unit_price else 0 end), 0) as disbursements,
  coalesce(sum(case when ii.item_type = 'part' and ii.part_handling_mode = 'resale' then ii.purchase_total else 0 end), 0) as part_purchase_cost,
  i.total
    - coalesce(sum(case when ii.item_type = 'disbursement' then ii.quantity * ii.unit_price else 0 end), 0)
    - coalesce(sum(case when ii.item_type = 'part' and ii.part_handling_mode = 'resale' then ii.purchase_total else 0 end), 0)
    as management_margin
from public.invoices i
left join public.invoice_items ii on ii.invoice_id = i.id
where i.status in ('issued','partially_paid','paid','overdue')
group by i.id;

create or replace view public.admin_cashflow
with (security_invoker = true)
as
select p.paid_at as occurred_at, 'in'::text as direction, p.amount, 'payment'::text as source_type, p.id as source_id, p.reference as label
from public.payments p
union all
select coalesce(x.paid_at, x.purchase_date::timestamptz), 'out', x.total, 'purchase', x.id, x.purchase_number
from public.purchases x
where x.status = 'paid'
union all
select e.expense_date::timestamptz, 'out', e.amount, 'expense', e.id, e.description
from public.business_expenses e;

grant select on public.admin_revenue_book to authenticated;
grant select on public.admin_purchase_register to authenticated;
grant select on public.admin_part_margins to authenticated;
grant select on public.admin_job_management_margin to authenticated;
grant select on public.admin_cashflow to authenticated;
revoke all on public.admin_revenue_book from anon;
revoke all on public.admin_purchase_register from anon;
revoke all on public.admin_part_margins from anon;
revoke all on public.admin_job_management_margin from anon;
revoke all on public.admin_cashflow from anon;

create or replace function public.admin_save_supplier(p_supplier jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_supplier ->> 'id', '')::uuid;
begin
  if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  if nullif(trim(p_supplier ->> 'name'), '') is null then raise exception 'Nom fournisseur obligatoire'; end if;

  if v_id is null then
    insert into public.suppliers(name, contact_name, email, phone, address, vat_number, notes, active, created_by)
    values (
      trim(p_supplier ->> 'name'), nullif(trim(p_supplier ->> 'contact_name'), ''),
      nullif(trim(p_supplier ->> 'email'), ''), nullif(trim(p_supplier ->> 'phone'), ''),
      nullif(trim(p_supplier ->> 'address'), ''), nullif(trim(p_supplier ->> 'vat_number'), ''),
      nullif(trim(p_supplier ->> 'notes'), ''), coalesce((p_supplier ->> 'active')::boolean, true), auth.uid()
    ) returning id into v_id;
  else
    update public.suppliers set
      name = trim(p_supplier ->> 'name'),
      contact_name = nullif(trim(p_supplier ->> 'contact_name'), ''),
      email = nullif(trim(p_supplier ->> 'email'), ''),
      phone = nullif(trim(p_supplier ->> 'phone'), ''),
      address = nullif(trim(p_supplier ->> 'address'), ''),
      vat_number = nullif(trim(p_supplier ->> 'vat_number'), ''),
      notes = nullif(trim(p_supplier ->> 'notes'), ''),
      active = coalesce((p_supplier ->> 'active')::boolean, true),
      updated_at = timezone('utc', now())
    where id = v_id;
    if not found then raise exception 'Fournisseur introuvable'; end if;
  end if;
  return v_id;
end
$$;

create or replace function public.admin_save_purchase(p_purchase jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_total numeric := 0;
  v_status text := coalesce(nullif(p_purchase ->> 'status', ''), 'draft');
  v_supplier_id uuid := nullif(p_purchase ->> 'supplier_id', '')::uuid;
begin
  if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Au moins une ligne d achat est obligatoire'; end if;
  if nullif(p_purchase ->> 'purchase_date', '') is null then raise exception 'Date d achat obligatoire'; end if;
  if v_status not in ('draft','validated','paid') then raise exception 'Statut d achat invalide'; end if;
  if v_status <> 'draft' and (
    v_supplier_id is null
    or nullif(trim(p_purchase ->> 'purchase_number'), '') is null
    or nullif(trim(p_purchase ->> 'document_path'), '') is null
  ) then raise exception 'Fournisseur, numéro et facture fournisseur obligatoires pour valider'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if nullif(trim(v_item ->> 'description'), '') is null then raise exception 'Description de ligne obligatoire'; end if;
    if coalesce((v_item ->> 'quantity')::numeric, 0) <= 0 then raise exception 'Quantité invalide'; end if;
    if coalesce((v_item ->> 'unit_cost')::numeric, -1) < 0 then raise exception 'Coût unitaire invalide'; end if;
    v_total := v_total + ((v_item ->> 'quantity')::numeric * (v_item ->> 'unit_cost')::numeric);
  end loop;

  insert into public.purchases(
    supplier_id, purchase_number, purchase_date, invoice_date, status,
    payment_method, paid_at, total, document_path, notes, created_by
  ) values (
    v_supplier_id, nullif(trim(p_purchase ->> 'purchase_number'), ''), (p_purchase ->> 'purchase_date')::date,
    nullif(p_purchase ->> 'invoice_date', '')::date, v_status,
    nullif(p_purchase ->> 'payment_method', ''), nullif(p_purchase ->> 'paid_at', '')::timestamptz,
    v_total, nullif(trim(p_purchase ->> 'document_path'), ''), nullif(trim(p_purchase ->> 'notes'), ''), auth.uid()
  ) returning id into v_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    insert into public.purchase_items(
      purchase_id, category, description, quantity, unit_cost, part_reference,
      supplier_reference, vehicle_id, repair_order_id
    ) values (
      v_id, v_item ->> 'category', trim(v_item ->> 'description'),
      (v_item ->> 'quantity')::numeric, (v_item ->> 'unit_cost')::numeric,
      nullif(trim(v_item ->> 'part_reference'), ''), nullif(trim(v_item ->> 'supplier_reference'), ''),
      nullif(v_item ->> 'vehicle_id', '')::uuid, nullif(v_item ->> 'repair_order_id', '')::uuid
    );
  end loop;

  return v_id;
end
$$;

create or replace function public.admin_save_expense(p_expense jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  if nullif(trim(p_expense ->> 'description'), '') is null then raise exception 'Description obligatoire'; end if;
  if coalesce((p_expense ->> 'amount')::numeric, 0) <= 0 then raise exception 'Montant invalide'; end if;
  if nullif(p_expense ->> 'expense_date', '') is null then raise exception 'Date obligatoire'; end if;

  insert into public.business_expenses(
    supplier_id, category, description, amount, expense_date, payment_method,
    document_path, notes, created_by
  ) values (
    nullif(p_expense ->> 'supplier_id', '')::uuid, p_expense ->> 'category', trim(p_expense ->> 'description'),
    (p_expense ->> 'amount')::numeric, (p_expense ->> 'expense_date')::date,
    nullif(p_expense ->> 'payment_method', ''), nullif(trim(p_expense ->> 'document_path'), ''),
    nullif(trim(p_expense ->> 'notes'), ''), auth.uid()
  ) returning id into v_id;
  return v_id;
end
$$;

create or replace function public.admin_save_document_item(
  p_document_type text,
  p_document_id uuid,
  p_item_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_mode text := p_payload ->> 'part_handling_mode';
  v_qty numeric := coalesce((p_payload ->> 'quantity')::numeric, 0);
  v_unit numeric := coalesce((p_payload ->> 'unit_price')::numeric, -1);
  v_purchase numeric := nullif(p_payload ->> 'purchase_total', '')::numeric;
  v_item_type text;
  v_config public.backoffice_configuration%rowtype;
begin
  if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  select * into v_config from public.backoffice_configuration where id = true;
  if coalesce((v_config.enabled_modules ->> 'parts')::boolean, false) is not true then raise exception 'Module pièces désactivé'; end if;
  if v_mode not in ('resale','customer_supplied','disbursement') then raise exception 'Mode de pièce invalide'; end if;
  if v_mode = 'resale' and not v_config.allow_part_resale then raise exception 'Revente désactivée'; end if;
  if v_mode = 'customer_supplied' and not v_config.allow_customer_supplied_parts then raise exception 'Pièces client désactivées'; end if;
  if v_mode = 'disbursement' and not v_config.allow_disbursements then raise exception 'Débours désactivés'; end if;
  if nullif(trim(p_payload ->> 'description'), '') is null or v_qty <= 0 or v_unit < 0 then raise exception 'Description, quantité et prix valides obligatoires'; end if;

  if v_mode = 'customer_supplied' and (v_unit <> 0 or coalesce(v_purchase, 0) <> 0) then
    raise exception 'Une pièce fournie par le client doit rester à 0 euro';
  end if;

  if v_mode = 'resale' and p_document_type = 'invoice' and (
    v_purchase is null
    or p_payload ->> 'supplier_invoice_holder' <> 'business'
    or nullif(trim(p_payload ->> 'business_purchase_reference'), '') is null
    or nullif(trim(p_payload ->> 'supplier_document_path'), '') is null
  ) then raise exception 'Coût, référence et facture fournisseur EDM28 obligatoires pour une revente'; end if;

  if v_mode = 'disbursement' and (
    v_purchase is null
    or v_purchase <> v_qty * v_unit
    or p_payload ->> 'supplier_invoice_holder' <> 'customer'
    or nullif(trim(p_payload ->> 'customer_mandate_reference'), '') is null
    or nullif(trim(p_payload ->> 'customer_mandate_path'), '') is null
    or nullif(trim(p_payload ->> 'supplier_document_path'), '') is null
  ) then raise exception 'Débours incomplet : mandat, facture client, justificatifs et remboursement exact obligatoires'; end if;

  v_item_type := case when v_mode = 'disbursement' then 'disbursement' else 'part' end;

  if p_document_type = 'quote' then
    if not exists(select 1 from public.quotes where id = p_document_id and status = 'draft') then raise exception 'Seul un devis brouillon peut être modifié'; end if;
    if p_item_id is null then
      insert into public.quote_items(
        quote_id, item_type, description, quantity, unit_price, display_order,
        part_handling_mode, purchase_total, supplier_invoice_holder,
        customer_mandate_reference, customer_mandate_path, supplier_document_path,
        business_purchase_reference, supplier_reference, vat_rate
      ) values (
        p_document_id, v_item_type, trim(p_payload ->> 'description'), v_qty, v_unit,
        coalesce((p_payload ->> 'display_order')::integer, 0), v_mode, v_purchase,
        nullif(p_payload ->> 'supplier_invoice_holder', ''), nullif(trim(p_payload ->> 'customer_mandate_reference'), ''),
        nullif(trim(p_payload ->> 'customer_mandate_path'), ''), nullif(trim(p_payload ->> 'supplier_document_path'), ''),
        nullif(trim(p_payload ->> 'business_purchase_reference'), ''), nullif(trim(p_payload ->> 'supplier_reference'), ''),
        nullif(p_payload ->> 'vat_rate', '')::numeric
      ) returning id into v_id;
    else
      update public.quote_items set
        item_type = v_item_type, description = trim(p_payload ->> 'description'), quantity = v_qty,
        unit_price = v_unit, part_handling_mode = v_mode, purchase_total = v_purchase,
        supplier_invoice_holder = nullif(p_payload ->> 'supplier_invoice_holder', ''),
        customer_mandate_reference = nullif(trim(p_payload ->> 'customer_mandate_reference'), ''),
        customer_mandate_path = nullif(trim(p_payload ->> 'customer_mandate_path'), ''),
        supplier_document_path = nullif(trim(p_payload ->> 'supplier_document_path'), ''),
        business_purchase_reference = nullif(trim(p_payload ->> 'business_purchase_reference'), ''),
        supplier_reference = nullif(trim(p_payload ->> 'supplier_reference'), ''),
        vat_rate = nullif(p_payload ->> 'vat_rate', '')::numeric
      where id = p_item_id and quote_id = p_document_id returning id into v_id;
    end if;
  elsif p_document_type = 'invoice' then
    if not exists(select 1 from public.invoices where id = p_document_id and status = 'draft') then raise exception 'Seule une facture brouillon peut être modifiée'; end if;
    if p_item_id is null then
      insert into public.invoice_items(
        invoice_id, item_type, description, quantity, unit_price, display_order,
        part_handling_mode, purchase_total, supplier_invoice_holder,
        customer_mandate_reference, customer_mandate_path, supplier_document_path,
        business_purchase_reference, supplier_reference, vat_rate, source_purchase_item_id
      ) values (
        p_document_id, v_item_type, trim(p_payload ->> 'description'), v_qty, v_unit,
        coalesce((p_payload ->> 'display_order')::integer, 0), v_mode, v_purchase,
        nullif(p_payload ->> 'supplier_invoice_holder', ''), nullif(trim(p_payload ->> 'customer_mandate_reference'), ''),
        nullif(trim(p_payload ->> 'customer_mandate_path'), ''), nullif(trim(p_payload ->> 'supplier_document_path'), ''),
        nullif(trim(p_payload ->> 'business_purchase_reference'), ''), nullif(trim(p_payload ->> 'supplier_reference'), ''),
        nullif(p_payload ->> 'vat_rate', '')::numeric, nullif(p_payload ->> 'source_purchase_item_id', '')::uuid
      ) returning id into v_id;
    else
      update public.invoice_items set
        item_type = v_item_type, description = trim(p_payload ->> 'description'), quantity = v_qty,
        unit_price = v_unit, part_handling_mode = v_mode, purchase_total = v_purchase,
        supplier_invoice_holder = nullif(p_payload ->> 'supplier_invoice_holder', ''),
        customer_mandate_reference = nullif(trim(p_payload ->> 'customer_mandate_reference'), ''),
        customer_mandate_path = nullif(trim(p_payload ->> 'customer_mandate_path'), ''),
        supplier_document_path = nullif(trim(p_payload ->> 'supplier_document_path'), ''),
        business_purchase_reference = nullif(trim(p_payload ->> 'business_purchase_reference'), ''),
        supplier_reference = nullif(trim(p_payload ->> 'supplier_reference'), ''),
        vat_rate = nullif(p_payload ->> 'vat_rate', '')::numeric,
        source_purchase_item_id = nullif(p_payload ->> 'source_purchase_item_id', '')::uuid
      where id = p_item_id and invoice_id = p_document_id returning id into v_id;
    end if;
  else
    raise exception 'Type de document invalide';
  end if;

  if v_id is null then raise exception 'Ligne introuvable'; end if;
  return v_id;
end
$$;

create or replace function public.admin_delete_document_item(p_document_type text, p_document_id uuid, p_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  if p_document_type = 'quote' then
    if not exists(select 1 from public.quotes where id = p_document_id and status = 'draft') then raise exception 'Devis verrouillé'; end if;
    delete from public.quote_items where id = p_item_id and quote_id = p_document_id;
  elsif p_document_type = 'invoice' then
    if not exists(select 1 from public.invoices where id = p_document_id and status = 'draft') then raise exception 'Facture verrouillée'; end if;
    delete from public.invoice_items where id = p_item_id and invoice_id = p_document_id;
  else
    raise exception 'Type de document invalide';
  end if;
end
$$;

create or replace function public.admin_validate_quote_for_publication(p_quote_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  if exists (
    select 1 from public.quote_items qi
    where qi.quote_id = p_quote_id
      and qi.item_type = 'disbursement'
      and (
        qi.purchase_total is null
        or qi.purchase_total <> qi.quantity * qi.unit_price
        or qi.supplier_invoice_holder <> 'customer'
        or nullif(trim(qi.customer_mandate_reference), '') is null
        or nullif(trim(qi.customer_mandate_path), '') is null
        or nullif(trim(qi.supplier_document_path), '') is null
      )
  ) then raise exception 'Débours incomplet dans le devis'; end if;
  return true;
end
$$;

create or replace function public.admin_validate_invoice_for_issue(p_invoice_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  if exists (
    select 1 from public.invoice_items ii
    where ii.invoice_id = p_invoice_id
      and (
        (ii.item_type = 'part' and ii.part_handling_mode = 'resale' and (
          ii.purchase_total is null
          or ii.supplier_invoice_holder <> 'business'
          or nullif(trim(ii.business_purchase_reference), '') is null
          or nullif(trim(ii.supplier_document_path), '') is null
        ))
        or (ii.item_type = 'disbursement' and (
          ii.purchase_total is null
          or ii.purchase_total <> ii.quantity * ii.unit_price
          or ii.supplier_invoice_holder <> 'customer'
          or nullif(trim(ii.customer_mandate_reference), '') is null
          or nullif(trim(ii.customer_mandate_path), '') is null
          or nullif(trim(ii.supplier_document_path), '') is null
        ))
      )
  ) then raise exception 'Lignes de pièces ou débours incomplètes'; end if;
  return true;
end
$$;

create or replace function public.admin_open_cash_session(p_opening_balance numeric, p_notes text default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_id uuid;
begin
  if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  if p_opening_balance < 0 then raise exception 'Fond de caisse invalide'; end if;
  if exists(select 1 from public.cash_register_sessions where status = 'open') then raise exception 'Une caisse est déjà ouverte'; end if;
  insert into public.cash_register_sessions(opening_balance, notes, created_by)
  values (p_opening_balance, nullif(trim(p_notes), ''), auth.uid()) returning id into v_id;
  return v_id;
end
$$;

create or replace function public.admin_record_cash_adjustment(
  p_session_id uuid,
  p_direction text,
  p_amount numeric,
  p_reference text,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_id uuid;
begin
  if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  if p_direction not in ('in','out') or p_amount <= 0 then raise exception 'Mouvement de caisse invalide'; end if;
  if not exists(select 1 from public.cash_register_sessions where id = p_session_id and status = 'open') then raise exception 'Caisse non ouverte'; end if;
  insert into public.cash_register_entries(session_id, direction, amount, source_type, reference, notes, created_by)
  values (p_session_id, p_direction, p_amount, 'adjustment', nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.admin_close_cash_session(p_session_id uuid, p_actual_balance numeric, p_notes text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected numeric;
begin
  if not (select private.is_admin()) then raise exception 'Accès administrateur requis'; end if;
  if p_actual_balance < 0 then raise exception 'Solde réel invalide'; end if;
  select s.opening_balance
    + coalesce(sum(case when e.direction = 'in' then e.amount else -e.amount end), 0)
  into v_expected
  from public.cash_register_sessions s
  left join public.cash_register_entries e on e.session_id = s.id
  where s.id = p_session_id and s.status = 'open'
  group by s.id;
  if v_expected is null then raise exception 'Caisse ouverte introuvable'; end if;
  update public.cash_register_sessions set
    status = 'closed', closed_at = timezone('utc', now()),
    expected_closing_balance = v_expected, actual_closing_balance = p_actual_balance,
    difference = p_actual_balance - v_expected,
    notes = coalesce(nullif(trim(p_notes), ''), notes), closed_by = auth.uid()
  where id = p_session_id and status = 'open';
end
$$;

grant execute on function public.admin_save_supplier(jsonb) to authenticated;
grant execute on function public.admin_save_purchase(jsonb, jsonb) to authenticated;
grant execute on function public.admin_save_expense(jsonb) to authenticated;
grant execute on function public.admin_save_document_item(text, uuid, uuid, jsonb) to authenticated;
grant execute on function public.admin_delete_document_item(text, uuid, uuid) to authenticated;
grant execute on function public.admin_validate_quote_for_publication(uuid) to authenticated;
grant execute on function public.admin_validate_invoice_for_issue(uuid) to authenticated;
grant execute on function public.admin_open_cash_session(numeric, text) to authenticated;
grant execute on function public.admin_record_cash_adjustment(uuid, text, numeric, text, text) to authenticated;
grant execute on function public.admin_close_cash_session(uuid, numeric, text) to authenticated;

revoke execute on function public.admin_save_supplier(jsonb) from anon, public;
revoke execute on function public.admin_save_purchase(jsonb, jsonb) from anon, public;
revoke execute on function public.admin_save_expense(jsonb) from anon, public;
revoke execute on function public.admin_save_document_item(text, uuid, uuid, jsonb) from anon, public;
revoke execute on function public.admin_delete_document_item(text, uuid, uuid) from anon, public;
revoke execute on function public.admin_validate_quote_for_publication(uuid) from anon, public;
revoke execute on function public.admin_validate_invoice_for_issue(uuid) from anon, public;
revoke execute on function public.admin_open_cash_session(numeric, text) from anon, public;
revoke execute on function public.admin_record_cash_adjustment(uuid, text, numeric, text, text) from anon, public;
revoke execute on function public.admin_close_cash_session(uuid, numeric, text) from anon, public;

commit;
