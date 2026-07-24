# Back-office EDM28 — architecture micro-entrepreneur sans salarié

## Décision de périmètre

EDM28 est exploité par une seule personne sous le régime de la micro-entreprise.

Le back-office ne doit donc pas contenir de gestion de salariés ou d'équipe :

- aucun dossier employé ;
- aucun rôle mécanicien, réceptionnaire, comptable ou manager ;
- aucune paie, DSN, congé, absence ou pointage salarié ;
- aucune affectation de travail à un membre d'équipe ;
- aucun planning multi-technicien ;
- aucune permission complexe par service.

Un seul compte propriétaire/administre l'activité. Une seconde authentification de secours pourra être prévue sans introduire un modèle RH.

## Architecture modulaire cible

```text
admin/
  core/
    auth
    navigation
    api
    validation
    audit
    settings
  modules/
    dashboard
    clients
    vehicles
    requests
    quotes
    agenda
    workshop
    parts
    suppliers
    purchases
    invoices
    payments
    micro-accounting
    messaging
    automations
    ai-assistant
    documents
    security
```

Chaque module doit séparer :

```text
domain      règles métier
repository  accès Supabase
service     cas d'utilisation
ui          écrans et formulaires
tests       tests unitaires, SQL et navigateur
```

Les écritures critiques doivent passer par des fonctions SQL transactionnelles ou des routes serveur, jamais par une suite d'écritures indépendantes depuis le navigateur.

## Modules fonctionnels

### Tableau de bord

- chiffre d'affaires encaissé du jour, du mois et de l'année ;
- ventilation prestations / vente de pièces ;
- encaissements par carte, espèces, virement et chèque ;
- factures à encaisser et retards ;
- demandes à traiter ;
- devis en attente ;
- rendez-vous à venir ;
- véhicules présents ;
- achats et marge de gestion ;
- alertes de seuils configurables.

### Clients et véhicules

- fiche client complète ;
- véhicules, kilométrage et historique ;
- notes internes ;
- consentements ;
- documents et photos ;
- chronologie des demandes, devis, travaux, factures et messages ;
- détection des doublons ;
- clients particuliers et professionnels, sans gestion de flotte avancée tant que le besoin n'est pas confirmé.

### Demandes et devis

- qualification de la demande ;
- priorité et échéance ;
- photos et pièces jointes ;
- devis détaillé par lignes ;
- séparation main-d'œuvre / pièces / autres frais ;
- coût d'achat, prix de vente et marge de gestion ;
- variantes ÉCO, STANDARD et PREMIUM ;
- versions de devis ;
- acompte facultatif ;
- acceptation et signature ;
- PDF professionnel.

### Agenda solo

- planning journalier, hebdomadaire et mensuel ;
- rendez-vous et blocages personnels ;
- durée estimée ;
- ressources matérielles facultatives : pont, diagnostic, parking ;
- détection des chevauchements ;
- rappels automatiques ;
- aucune affectation à un salarié.

### Atelier

- ordre de réparation ;
- kilométrage d'entrée et de sortie ;
- état visible du véhicule ;
- objets laissés par le client ;
- checklist ;
- photos avant / après ;
- travaux prévus et réalisés ;
- temps passé par l'entrepreneur ;
- demande d'autorisation pour travaux supplémentaires ;
- statut : à préparer, en cours, en attente, terminé, livré.

Le temps passé sert au pilotage et au calcul de rentabilité, pas à la paie.

### Pièces, fournisseurs et achats

- fournisseurs ;
- références et prix d'achat ;
- commandes et réceptions ;
- stock léger facultatif ;
- mouvements de pièces ;
- pièces affectées à un ordre de réparation ;
- registre des achats exportable ;
- conservation de la facture fournisseur.

### Facturation et encaissements

- factures, acomptes, avoirs et remboursements ;
- numérotation chronologique ;
- paiements partiels et complets ;
- modes de règlement ;
- suivi espèces et banque ;
- relances ;
- PDF et archivage ;
- préparation à la réception puis à l'émission de factures électroniques.

## Comptabilité adaptée à la micro-entreprise

Le logiciel doit distinguer deux visions.

### 1. Vision fiscale et sociale

Base principale : chiffre d'affaires réellement encaissé.

Pour chaque encaissement :

- date d'encaissement ;
- client ;
- facture ;
- montant ;
- mode de règlement ;
- catégorie `prestation` ou `vente` ;
- justificatif ;
- période de déclaration Urssaf.

Sorties attendues :

- livre des recettes chronologique ;
- ventilation vente / prestation ;
- total mensuel, trimestriel et annuel ;
- export Urssaf ;
- estimation configurable des cotisations ;
- suivi de la déclaration mensuelle ou trimestrielle ;
- suivi CFE ;
- suivi du versement libératoire si activé ;
- alertes de seuils micro et TVA.

Les taux et seuils ne doivent jamais être codés en dur. Ils doivent être versionnés par date d'effet et modifiables dans la configuration.

### 2. Vision de gestion

Même si les charges réelles ne sont pas déduites fiscalement dans le régime micro, elles doivent être suivies pour connaître la rentabilité réelle :

- achats de pièces ;
- consommables ;
- carburant et déplacements ;
- assurances ;
- loyer ou participation au local ;
- logiciels et abonnements ;
- frais bancaires ;
- matériel et outillage ;
- sous-traitance ;
- autres dépenses.

Indicateurs :

- marge sur pièces ;
- marge par intervention ;
- résultat de gestion estimé ;
- trésorerie disponible ;
- réserve recommandée pour cotisations et impôts ;
- seuil de rentabilité de gestion.

Ces indicateurs ne doivent pas être présentés comme un bénéfice fiscal officiel.

## TVA

Le back-office doit supporter deux modes :

```text
franchise_en_base
redevable_tva
```

En franchise en base :

- aucune TVA facturée ;
- aucune TVA récupérable sur les achats ;
- mention légale automatique sur les devis et factures ;
- montants présentés sans fausse ventilation HT/TVA/TTC.

En mode redevable :

- taux de TVA par ligne ;
- TVA collectée ;
- TVA déductible ;
- dates de changement de régime ;
- exports de contrôle.

Le changement de mode doit être daté et ne doit jamais réécrire les anciennes factures.

## Messagerie, automatisations et IA

- messages client / EDM28 ;
- pièces jointes ;
- modèles de réponse ;
- rappels de rendez-vous ;
- relances de devis ;
- relances d'impayés ;
- notifications sur ordinateur et Android ;
- brouillons IA uniquement ;
- validation humaine obligatoire avant envoi ;
- aucune décision comptable, tarifaire ou technique automatique.

## Sécurité

- compte propriétaire unique ;
- authentification forte ;
- appareils autorisés ;
- journal des opérations ;
- sauvegardes ;
- verrouillage des factures émises ;
- aucune donnée métier mise en cache hors ligne ;
- aucune clé privilégiée dans l'application.

## Informations nécessaires avant de construire la comptabilité

1. Activité déclarée : réparation automobile, entretien, diagnostic ou autre intitulé exact.
2. Vends-tu les pièces au client, ou factures-tu uniquement la main-d'œuvre avec remboursement des pièces ?
3. Ton activité est-elle déclarée comme mixte `vente + prestation` auprès de l'Urssaf ?
4. Es-tu actuellement en franchise en base de TVA ?
5. Déclaration Urssaf mensuelle ou trimestrielle ?
6. Versement libératoire de l'impôt sur le revenu activé ou non ?
7. ACRE active ou non, et jusqu'à quelle date ?
8. Modes de paiement acceptés.
9. Utilises-tu un compte bancaire dédié ?
10. Souhaites-tu gérer un stock réel ou commander les pièces pour chaque intervention ?
11. Souhaites-tu suivre les espèces avec ouverture et clôture de caisse ?
12. Logiciel ou plateforme de facturation électronique envisagé.

## Plan de livraison

```text
V1  noyau modulaire, configuration micro, livre des recettes, dépenses et exports
V2  CRM, véhicules, demandes et devis détaillés
V3  agenda solo, atelier, checklists et photos
V4  pièces, fournisseurs, achats et stock léger
V5  factures, avoirs, paiements, caisse et relances
V6  messagerie, notifications, automatisations et IA contrôlée
V7  facturation électronique et intégrations externes
```

La version stable reste `release/edm28-rc5`. Cette architecture doit être développée sur une branche séparée et ne doit pas modifier la production avant validation complète.
