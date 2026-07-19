# Base de données EDM28

## Environnements

- `edm28-staging` (`vbfklmcjrdlqismewmly`) : validation des migrations et parcours métier.
- Production (`ojjbnwpkfvzjfukgqddz`) : aucune migration ne doit être appliquée avant autorisation explicite.

## Source de vérité

Supabase PostgreSQL est la source de vérité. Google Sheets et Apps Script ne doivent pas dupliquer les données métier ; ils sont limités aux intégrations Google et aux exports compatibles.

## Domaines principaux

- Identité : `profiles`, utilisateurs Supabase Auth.
- Parc client : `vehicles`, `service_requests`, `client_messages`.
- Catalogue : `site_services`, `service_options`, `site_settings`.
- Cycle atelier : `quotes`, `quote_items`, `appointments`, `repair_orders`, `interventions`, `repairs`.
- Facturation : `invoices`, `invoice_items`, `payments`.
- Documents : `repair_documents` et stockage privé.
- Administration : `business_configuration`, `automation_settings`, `audit_log`, `ai_drafts`.

## Opérations transactionnelles

Les fonctions suivantes sont `SECURITY INVOKER`, vérifient `private.is_admin()` et verrouillent les lignes concernées :

- `admin_create_quote_from_request(uuid)`
- `admin_prepare_quote(uuid, timestamptz, integer, text)`
- `admin_finalize_repair_order(uuid, text, integer)`
- `admin_record_payment(uuid, numeric, text, text)`

`anon` ne possède aucun droit d'exécution sur ces RPC.

## RLS

Toutes les tables exposées utilisent RLS. Les politiques de lecture combinent l'accès du propriétaire et l'accès administrateur dans une seule politique. Les écritures administrateur utilisent des politiques séparées `INSERT`, `UPDATE` et `DELETE` afin d'éviter plusieurs politiques permissives pour `SELECT`.

## Index

Chaque clé étrangère doit disposer d'un index couvrant ses colonnes dans le même ordre. La migration `20260719202000_add_missing_foreign_key_indexes.sql` crée uniquement les index manquants.

## Procédure de migration

1. Créer une migration versionnée sous `supabase/migrations/`.
2. Appliquer et tester d'abord sur staging.
3. Exécuter les audits Supabase sécurité et performance.
4. Vérifier les permissions `anon`, `authenticated` et `service_role`.
5. Valider le parcours métier concerné.
6. Ne jamais appliquer sur production sans sauvegarde, checklist et autorisation explicite.

## Rollback

Les changements de production doivent être précédés d'une sauvegarde et d'un plan de retour vers `production-stable-2026-07-19`. Les migrations destructives sont interdites sans script de restauration validé.