-- Keep repository migration history aligned with production migration 20260924084427.
-- Prevent direct API writes from recording a supplier purchase before the parts order exists.

create or replace function private.guard_disbursement_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.no_margin is not true then
    raise exception 'Un débours ne peut comporter aucune marge.';
  end if;

  if new.status = 'awaiting_reapproval' then
    if new.requested_limit is null or new.authorized_limit is null or new.requested_limit <= new.authorized_limit then
      raise exception 'Le nouveau plafond doit être supérieur au plafond déjà autorisé.';
    end if;
  end if;

  if new.status in ('authorized', 'awaiting_reapproval', 'eligible', 'reimbursed') then
    if new.client_choice <> 'edm_disbursement' or new.mandate_signed is not true or new.mandate_accepted_at is null then
      raise exception 'Mandat client préalable obligatoire.';
    end if;
    if new.authorized_limit is null or new.authorized_limit <= 0 then
      raise exception 'Plafond autorisé obligatoire.';
    end if;
  end if;

  if new.client_choice = 'edm_disbursement'
     and new.status in ('authorized', 'eligible', 'reimbursed')
     and (new.provision_required is null or new.provision_required is distinct from new.authorized_limit) then
    new.provision_required := new.authorized_limit;
  end if;

  if new.parts_status in ('ready_to_order', 'ordered', 'shipped', 'received')
     and new.client_choice = 'edm_disbursement' then
    if new.provision_required is null or new.provision_received < new.provision_required then
      raise exception 'Provision client insuffisante : aucune commande de pièce ne peut être engagée.';
    end if;
  end if;

  if new.status in ('eligible', 'reimbursed')
     and new.client_choice = 'edm_disbursement'
     and new.parts_status not in ('ordered', 'shipped', 'received') then
    raise exception 'Aucun achat fournisseur ne peut être enregistré avant la commande des pièces.';
  end if;

  if tg_op = 'UPDATE' and new.parts_status is distinct from old.parts_status then
    if not (
      (old.parts_status = 'not_ordered' and new.parts_status in ('ready_to_order', 'cancelled'))
      or (old.parts_status = 'ready_to_order' and new.parts_status in ('ordered', 'cancelled'))
      or (old.parts_status = 'ordered' and new.parts_status in ('shipped', 'received', 'cancelled'))
      or (old.parts_status = 'shipped' and new.parts_status in ('received', 'cancelled'))
      or (old.parts_status = new.parts_status)
    ) then
      raise exception 'Transition de statut pièces invalide : % -> %', old.parts_status, new.parts_status;
    end if;
  end if;

  if new.parts_status = 'ordered' then
    new.ordered_at := coalesce(new.ordered_at, timezone('utc', now()));
  elsif new.parts_status = 'shipped' then
    new.ordered_at := coalesce(new.ordered_at, timezone('utc', now()));
    new.shipped_at := coalesce(new.shipped_at, timezone('utc', now()));
  elsif new.parts_status = 'received' then
    new.ordered_at := coalesce(new.ordered_at, timezone('utc', now()));
    new.received_at := coalesce(new.received_at, timezone('utc', now()));
  end if;

  if new.status in ('eligible', 'reimbursed') then
    if new.amount is null or new.amount <= 0 then
      raise exception 'Montant réel du débours obligatoire.';
    end if;
    if new.amount > new.authorized_limit then
      raise exception 'Le montant réel dépasse le plafond autorisé.';
    end if;
    if new.supplier_invoice_in_customer_name is not true then
      raise exception 'Le justificatif fournisseur doit être établi au nom du client.';
    end if;
    if nullif(btrim(coalesce(new.proof_path, '')), '') is null then
      raise exception 'Justificatif fournisseur obligatoire.';
    end if;
    if nullif(btrim(coalesce(new.supplier, '')), '') is null then
      raise exception 'Fournisseur obligatoire.';
    end if;
  end if;

  if new.status = 'reimbursed' then
    if new.exact_reimbursement is not true or new.reimbursed_at is null then
      raise exception 'Le remboursement exact doit être constaté avant archivage du débours.';
    end if;
  end if;

  if new.status = 'client_direct' and new.client_choice <> 'client_direct' then
    raise exception 'Le mode achat direct client est incohérent.';
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;
