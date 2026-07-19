# EDM28 v1.0.0 — Notes de version candidates

Date de préparation : 19 juillet 2026
Statut : candidate, non publiée

## Contenu

- nouveau parcours public EDM AUTO ;
- création de compte, connexion, profil et véhicules ;
- demandes de service avec estimation et paniers ÉCO, STANDARD et PREMIUM ;
- espace client pour demandes, rendez-vous, messages, documents, devis et factures ;
- interface administrateur ;
- workflow transactionnel demande → devis → rendez-vous → ordre de réparation → facture → paiement ;
- génération et accès sécurisé aux documents privés ;
- contrôles RLS, audits et journal métier ;
- tests automatisés client, administrateur et syntaxe JavaScript ;
- documentation des migrations, de la production et du rollback.

## Migrations à appliquer avant publication

1. `20260719190000_admin_transactional_workflow.sql`
2. `20260719201000_consolidate_permissive_rls_policies.sql`
3. `20260719202000_add_missing_foreign_key_indexes.sql`

## Conditions de publication

La version ne doit pas être publiée avant :

- recette interactive desktop et mobile ;
- test client et administrateur complet ;
- configuration du domaine Resend et des variables Vercel ;
- déconnexion Git du projet Vercel doublon ;
- activation de la protection contre les mots de passe compromis ;
- autorisation explicite de fusion et de mise en production.

## Rollback

- branche de production de référence : `production-stable-2026-07-19` ;
- sauvegarde de la candidate : `release-candidate-backup-2026-07-19` ;
- en cas d'incident, restaurer le déploiement Vercel précédent et ne pas poursuivre les migrations suivantes tant que la cause n'est pas identifiée.
