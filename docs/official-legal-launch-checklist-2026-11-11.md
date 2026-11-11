# EDM28 — Vérification obligatoire avant publication juridiquement conforme
Révision : 11 novembre 2026. Statut : **PRÉPARÉ, NON CERTIFIÉ**.

Ce dossier recense les points vérifiables dans le code et les pièces officielles qui ne peuvent être générées par l'application.

## Informations à saisir dans Back-office → Juridique

- Identité de l'entrepreneur individuel, nom/prénom et mention EI lorsque applicable.
- SIREN (9 chiffres) et SIRET (14 chiffres), correspondants au justificatif RNE.
- Adresse de domiciliation légale, différente de l'adresse de l'atelier si nécessaire.
- Adresse et téléphone professionnel ; coordonnées de l'assureur et numéro de police.
- Régime de TVA prouvé, et numéro de TVA uniquement si applicable.
- Nom, adresse, site et preuve de conventionnement du médiateur de la consommation.
- Directeur de publication ; nom, adresse et téléphone de l'hébergeur.
- Référence du diplôme, titre ou expérience attestant la qualification pour la réparation automobile.
- Contact RGPD et inventaire des sous-traitants, hébergements, transferts et durées de conservation.

## Pages du site à vérifier après déploiement

- /mentions-legales : identité et coordonnées complètes, sans donnée inventée.
- /conditions-generales : prestations par forfait, client acheteur des pièces, responsabilités réelles du garage, garantie, délai, prix, médiateur.
- /confidentialite : données, finalités, bases légales, prestataires, sécurité, droits et durées.
- /cookies : stockage de session, services techniques, absence de publicité selon l'audit actuel.
- /pieces-economie-circulaire : information des consommateurs, exclusions freinage/direction/trains roulants du R.224-25.
- /retractation : déclaration accessible sans compte, étape de confirmation, accusé de dépôt sur support durable.
- /fonctionnement : cohérence avec le devis, le paiement des pièces chez le vendeur, la réservation et le suivi.

## Conditions bloquantes pour une conformité vérifiée

1. Identité, assurance, qualification et médiateur vérifiés auprès de sources officielles.
2. CGV et politique de conservation relues au regard de l'activité exacte, de la localisation, des prestataires et du traitement des pièces.
3. Devis envoyé avec version PDF pérenne et modalités légales ; affichage des prix consommateurs correctement configuré selon TVA.
4. Signature électronique testée de bout en bout (email, identité, empreinte, conservation du PDF) et non déclarée « qualifiée ».
5. Demande distincte de début anticipé des travaux documentée, lorsque applicable.
6. Rétractation testée avec accusé de réception email effectivement reçu.
7. Déploiement de la branche pwa-edm28 et vérification du site réel en navigation anonyme et authentifiée.
8. Vérifier qu'aucun traceur publicitaire ou d'audience non essentiel n'est activé sans mécanisme de consentement adapté.
9. Afficher l'information PIEC à la réception si elle est applicable ; vérifier les pièces de sécurité exclues et l'achat direct par le client.
10. Les procédures de suppression, export et conservation des données personnelles, factures et preuves doivent être documentées et testées.

## Références

- https://entreprendre.service-public.gouv.fr/ — création, réglementation et mentions légales de l'entreprise
- https://www.legifrance.gouv.fr/codes/id/LEGITEXT000006069565/ — Code de la consommation
- https://www.legifrance.gouv.fr/codes/id/LEGITEXT000006070719/ — Code civil, article 1367
- https://www.cnil.fr — RGPD et traceurs
- https://www.economie.gouv.fr/mediation-conso — médiateur de la consommation

Cette liste ne constitue pas une certification juridique. Ne pas annoncer « 100 % légal » tant que les conditions bloquantes n'ont pas été vérifiées.
