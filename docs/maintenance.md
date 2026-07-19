# Maintenance EDM28

## Fréquence

### Chaque semaine

- contrôler les erreurs Vercel et les échecs d'envoi Resend ;
- vérifier les demandes bloquées, brouillons administrateur et synchronisations en erreur ;
- contrôler les journaux d'audit sensibles.

### Chaque mois

- lancer les advisors sécurité et performance Supabase ;
- vérifier les index, politiques RLS et permissions des fonctions ;
- tester la création de compte, la connexion, une demande client et le parcours administrateur ;
- vérifier les dépendances, les clés expirantes et les variables d'environnement ;
- restaurer un export ou une sauvegarde dans un environnement isolé.

### À chaque publication

- créer une branche de sauvegarde et un tag ;
- vérifier la CI ;
- appliquer les migrations dans l'ordre ;
- tester immédiatement les parcours critiques ;
- surveiller les journaux pendant la période de stabilisation ;
- documenter les changements et le rollback.

## Responsabilités

- GitHub : code, migrations, PR, tags et notes de version ;
- Supabase : Auth, base de données, RLS, Storage, sauvegardes et audits ;
- Vercel : déploiements, domaines, variables et journaux ;
- Resend : domaine d'envoi, délivrabilité et incidents email.

## Incidents

1. stopper toute nouvelle publication ;
2. qualifier l'incident et préserver les journaux ;
3. restaurer le déploiement précédent si le site est affecté ;
4. ne revenir sur une migration qu'avec un script de rollback vérifié ;
5. consigner la cause, la correction et les actions préventives.
