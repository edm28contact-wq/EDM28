# EDM28 — conformité du parcours consommateur
Version de travail : 9 novembre 2026. Etat : validation juridique finale en attente.

## Répartition des responsabilités

| Etape | EDM28 (réparateur) | Client consommateur | Vendeur professionnel des pièces |
|---|---|---|---|
| Demande et devis | Vérifier les informations disponibles, conseiller, détailler les prestations, prix et délais | Donner les informations exactes connues et valider ou refuser le devis | N'est pas partie au contrat de réparation |
| Pièces | Recommander des références compatibles et vérifier avant démontage | Acheter chez le fournisseur de son choix, apporter les références convenues | Conformité, livraison, garanties et SAV de la vente des pièces |
| Rendez-vous | Distinguer une pré-réservation de la confirmation | Fournir le justificatif si requis et respecter le rendez-vous convenu | Tenir ses engagements de livraison |
| OR et intervention | Décrire et exécuter les seuls travaux autorisés; contrôler la sécurité; recueillir un nouvel accord avant supplément | Fournir les pièces et signaler les défauts connus | Ne répond pas d'une faute de montage du garage |
| Clôture | Contrôle final, restitution, facture, suivi et réponse aux réclamations | Payer les sommes convenues et légalement dues, signaler les anomalies | Répond de ses propres obligations de vendeur |

La fourniture de pièces par le client ne dispense jamais EDM28 de ses obligations professionnelles et de sa responsabilité pour une mauvaise préconisation, un contrôle fautif ou une pose incorrecte.

## Règles de conformité retenues

1. Le tarif est fixé par prestation, consommables inclus, hors pièces de remplacement, avec affichage selon le régime TVA réellement applicable.
2. Aucun forfait de réparation non exécuté n'est facturé. Des frais séparés de 15 euros ne peuvent être demandés que lorsqu'ils sont annoncés et acceptés, juridiquement justifiés et ne dérogent pas aux droits légaux.
3. La pénalité automatique de 60 % en cas de pièce inadéquate est exclue. Si l'erreur est imputable à EDM28, le client n'en supporte pas les coûts légalement imputables au garage.
4. Le devis et les travaux supplémentaires nécessitent un consentement exprès vérifiable; la version précise du document doit être conservée.
5. La commande payante par voie électronique doit signaler clairement l'obligation de paiement (article L221-14).
6. La rétractation du contrat de service conclu à distance est en principe possible pendant quatorze jours, hors exceptions légales. L'accès « Renoncer au contrat ici » doit être gratuit, visible et direct.
7. En cas d'exécution anticipée, la demande expresse du consommateur et les informations exigées par L221-25 doivent être recueillies et conservées. La seule signature du devis ne supprime pas ce droit.
8. Toute rétractation en ligne doit être horodatée et accusée sans délai sur support durable. Elle ne détruit pas automatiquement les factures ni les preuves contractuelles.
9. Les informations du médiateur conventionné doivent apparaître sur le site, les conditions et les documents de commande.
10. Les documents comptables, les preuves contractuelles et les données personnelles ont des durées légales de conservation différentes et doivent être gérés séparément.

## Implémentation

- Pages Conditions générales, Mentions légales, Confidentialité et Rétractation.
- Formulaire public en deux étapes, sans connexion, avec preuve horodatée, référence, email de réception lorsque le prestataire de courrier est opérationnel.
- Registre Supabase protégé par RLS, insertion réservée au serveur, immutabilité des déclarations originales.
- Suivi administratif dans le back-office, sans annulation automatique des rendez-vous ni des factures.
- Paramétrage dans le back-office du médiateur, de l'hébergeur, du directeur de publication et du contact RGPD.
- Liens vers les conditions et la rétractation depuis les devis et la signature.

## Eléments à compléter AVANT de déclarer la conformité finale

- SIREN/SIRET et identité officielle complète de l'entrepreneur, notamment la mention EI si applicable.
- Régime TVA réel, coordonnées et couverture de l'assureur, qualification professionnelle de l'exploitant.
- Médiateur de consommation officiellement conventionné et référencé à la CECMC.
- Hébergeur, directeur de publication, coordonnées RGPD, durées de conservation et contrats de sous-traitance.
- Envoi d'accusés par Resend et contrôle réel du parcours, notamment de la signature du devis et du consentement à l'exécution anticipée.
- Remise d'une version durable des conditions et des informations de rétractation lors de la conclusion du contrat.
- Relecture de la version définitive des conditions par un juriste compétent.

## Sources officielles

- Code de la consommation : https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032226844/
- DGCCRF, réparation automobile : https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques-et-les-faq/vehicule-automobile-lordre-de-reparation-decrit-la-nature
- Service-Public, réparateur d'automobiles : https://entreprendre.service-public.gouv.fr/vosdroits/F39056
- Médiation : https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/vos-principales-obligations-0
- Rétractation : https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/delais-de-reflexion-ou-de-retractation-comment-sappliquent-t-ils
