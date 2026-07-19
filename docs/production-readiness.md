# Préparation production EDM28

## Supabase

Projet production : `ojjbnwpkfvzjfukgqddz`.

Avant déploiement :

- activer la protection contre les mots de passe compromis dans Auth > Password Security ;
- vérifier les migrations et les politiques RLS ;
- conserver `SUPABASE_SERVICE_ROLE_KEY` uniquement côté serveur ;
- vérifier les comptes administrateurs et leur rôle dans `profiles` ;
- appliquer les nouvelles migrations uniquement après sauvegarde et autorisation explicite.

## E-mails Resend

Variables serveur requises :

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_TO_EMAIL`

Le code n'utilise aucune adresse d'expéditeur codée en dur. `RESEND_FROM_EMAIL` doit appartenir à un domaine ou sous-domaine vérifié dans Resend. Configurer les enregistrements DNS demandés, puis contrôler SPF, DKIM et DMARC. Tester une demande complète, la réponse à l'adresse client, la réception EDM28 et les dossiers indésirables.

Toute clé communiquée dans une conversation, une capture ou un journal doit être révoquée immédiatement, remplacée dans Vercel, puis validée sur un nouveau déploiement Preview.

## Vercel

Projet canonique : `edm-28` (`prj_ZfCxVKKx7pnyACgbIcbT854m50sU`).

Projet doublon à déconnecter de Git sans le supprimer : `project-3btqr` (`prj_NF1PhikXnOung11mySoM15dw7xJZ`).

Vérifier séparément les variables Production et Preview :

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_TO_EMAIL`

Aucune variable secrète ne doit être exposée avec un préfixe public.

Pour valider une branche de PR, créer un nouveau déploiement Preview depuis le dernier SHA de la branche. Ne pas utiliser l'action Redeploy sur un ancien déploiement et ne pas sélectionner Production sans autorisation explicite.

## GitHub Pages

Vercel est l'hébergement canonique recommandé. GitHub Pages doit rester désactivé pour éviter un second site public non synchronisé. Aucun workflow `deploy-pages` ou `github-pages` n'est nécessaire.

## Validation

Après chaque modification de configuration : nouvelle Preview unique, parcours client, parcours administrateur, envoi d'e-mail, consultation des logs, puis maintien de la PR en brouillon tant que tous les contrôles ne sont pas validés.
