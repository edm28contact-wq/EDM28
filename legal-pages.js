// Version des informations contractuelles destinées aux consommateurs (EDM28, 09-11-2026).
// Les CGP complètes ne peuvent être déclarées définitives avant renseignement du SIRET,
// du statut TVA et de l'identité/coordonnées du médiateur de consommation.
export const EDM28_LEGAL_VERSION = 'edm28-cgp-2026-11-09';

export const legalPages = {
  'conditions-generales': {
    path: '/conditions-generales',
    title: 'Conditions générales de prestations et responsabilités | EDM28',
    description: 'Conditions des prestations EDM28, pièces achetées par le client, devis, rendez-vous, garanties, rétractation et réclamations.',
    h1: 'Conditions générales de prestations EDM28',
    lede: 'Version du 9 novembre 2026. Ces informations concernent les consommateurs particuliers. Les données d’immatriculation, d’assurance et de médiation doivent être complétées avant validation définitive des conditions contractuelles.',
    breadcrumbs: [['/', 'Accueil'], ['/conditions-generales', 'Conditions générales']],
    sections: [
      ['1. Parties et champ d’application', 'EDM28 est le nom commercial utilisé pour les prestations de mécanique proposées par EDM AUTO. Le contrat de réparation est conclu avec l’exploitant identifié sur le devis, et le client qui l’accepte. Les informations légales complètes, dont le numéro SIREN/SIRET et le régime fiscal, doivent figurer dans les mentions légales et dans les documents remis. Les présentes dispositions s’adressent aux consommateurs ; les règles impératives du Code de la consommation prévalent sur toute clause contraire.'],
      ['2. Prestations et prix', 'EDM28 propose des prestations ciblées de freinage et de liaison au sol, à prix forfaitaire par prestation lorsque le devis le prévoit, avec consommables d’atelier compris. Les pièces de remplacement ne sont pas vendues par EDM28 dans le parcours actuel. Le devis précise la nature, le périmètre, le prix total dû à EDM28, le régime de TVA applicable, le délai prévu et la date de validité. Les prix présentés aux consommateurs sont exprimés toutes taxes comprises selon le régime réellement applicable. Aucun supplément ni travail supplémentaire n’est exécuté ou facturé sans accord préalable du client.'],
      ['3. Demande et formation du contrat', 'La saisie de la plaque, une demande de devis ou la création d’un compte ne constituent pas une commande payante. Le garage étudie la demande et établit un devis individualisé avec les références de pièces conseillées. Le client prend connaissance du PDF et accepte expressément le devis. Le processus de signature électronique avec code de confirmation est en cours de validation opérationnelle ; l’existence de cette interface ne constitue pas une garantie de signature qualifiée eIDAS. Une confirmation contractuelle doit être remise au client sur support durable.'],
      ['4. Pièces achetées directement au fournisseur', 'EDM28 propose des références et peut préparer un lien de panier. Le client choisit librement son vendeur et commande, règle et fait livrer les pièces directement auprès de ce vendeur. Le contrat de vente des pièces est distinct du contrat de réparation EDM28 : lorsque le vendeur est professionnel, il répond notamment des garanties légales de conformité, des délais et obligations de livraison et des retours prévus par la loi. Pour une vente entre particuliers, le régime juridique est différent. EDM28 reste responsable de ses propres conseils professionnels, des vérifications qui lui incombent et de la bonne réalisation de son intervention. Le client doit communiquer les références exactes et signaler toute modification envisagée avant la prestation.'],
      ['5. Compatibilité et sécurité', 'Les références proposées par EDM28 sont établies d’après les informations disponibles ; les caractéristiques effectives du véhicule et les vérifications techniques priment. Le client apporte les pièces préconisées ou expressément validées. EDM28 peut refuser de monter une pièce inadaptée, de provenance incertaine, endommagée ou présentant un risque de sécurité ; le véhicule ne doit pas être remis en circulation dans un état dangereux. Si l’erreur de préconisation est imputable à EDM28, les frais et conséquences qui lui sont légalement imputables restent à sa charge. La fourniture de pièces par le client ne décharge pas le garage de sa responsabilité pour faute de conseil, de contrôle ou de montage.'],
      ['6. Rendez-vous et créneaux provisoires', 'Le créneau demandé n’est pas automatiquement un rendez-vous confirmé. Selon la prestation, une pré-réservation de 48 heures peut être proposée pour laisser le temps de transmettre une preuve de commande des pièces. Le créneau provisoire non confirmé peut être libéré à l’expiration du délai annoncé. Le garage examine le justificatif et envoie une confirmation du rendez-vous et de ses conditions. Le délai estimatif d’intervention et les règles de report sont rappelés sur les documents contractuels.'],
      ['7. Frais de vérification et annulations', 'Lorsqu’un client présente des pièces différentes de celles qui ont été convenues et que les opérations ne peuvent pas commencer, un forfait de vérification/préparation de 15 € ne peut être réclamé que s’il a été clairement annoncé et accepté avant l’engagement et correspond à une prestation ou à des frais contractuellement justifiés. Aucun pourcentage automatique de 60 % du prix de la réparation n’est dû de ce seul fait. Aucune somme ne peut être exigée au titre d’une erreur imputable au garage. L’application des droits légaux de rétractation et de remboursement prévaut sur les conditions de report ou d’annulation. Un versement préalable doit être clairement qualifié (arrhes, acompte ou prestation distincte) et traité selon les textes applicables.'],
      ['8. Droit de rétractation', 'Lorsque le devis est accepté dans le cadre d’un contrat à distance conclu avec un consommateur, celui-ci bénéficie en principe de quatorze jours à compter de la conclusion pour exercer son droit de rétractation, sauf exception légale. Il peut envoyer une déclaration claire à contact@edm28.fr, utiliser le formulaire type ou la fonctionnalité « Renoncer au contrat ici » du site. Le consommateur peut demander expressément une exécution avant la fin de ce délai. S’il se rétracte après le début de la prestation à sa demande expresse, la somme éventuellement due est limitée à la part du service effectivement exécutée selon les conditions légales. Si la prestation a été intégralement exécutée avec les accords et informations exigés par la loi, le droit peut être perdu. La simple réservation d’un créneau n’entraîne pas, à elle seule, la perte du droit de rétractation.'],
      ['9. Ordre de réparation, véhicule et travaux', 'Avant les travaux, le garage formalise l’ordre de réparation avec l’identité du client, le véhicule, le kilométrage, les symptômes ou l’état visible, les prestations autorisées, le montant convenu ou la méthode de calcul et le délai d’immobilisation. Le client doit permettre un examen sûr du véhicule et signaler les informations connues susceptibles d’influer sur la sécurité ou la compatibilité. Toute découverte nécessitant un travail additionnel entraîne une nouvelle demande d’accord, sans facturation automatique. Le garage assume ses obligations de conservation et de garde du véhicule confié.'],
      ['10. Qualité des travaux et responsabilité du garage', 'EDM28 répond de l’exécution correcte des prestations commandées et des dommages qui lui sont imputables selon le droit français. Il doit informer le client d’une intervention techniquement impossible, dangereuse ou impropre au résultat recherché et ne pas réaliser de réparation non autorisée. La garantie du vendeur sur les pièces achetées directement par le client ne se substitue pas à la responsabilité du garage en cas de mauvais conseil, de mauvais contrôle ou de pose défectueuse. Aucune clause ne limite les droits légaux du consommateur.'],
      ['11. Restitution, facture et suivi', 'Après intervention, EDM28 réalise les contrôles de fin d’opération prévus, remet le véhicule et communique les réserves éventuelles. Une facture ou note détaillée est délivrée conformément aux règles applicables, notamment pour les prestations supérieures à 25 € TTC. Les documents contractuels du dossier (devis, ordre de réparation, contrôles et facture) sont consultables dans l’espace client, sous réserve des exigences de remise sur support durable. Le règlement porte sur les prestations et montants effectivement convenus.'],
      ['12. Réclamation et médiation de consommation', 'Pour toute contestation, le client peut adresser une réclamation documentée à contact@edm28.fr. À défaut de résolution amiable, un consommateur peut accéder gratuitement au médiateur de consommation désigné par EDM28, conformément aux articles L.612-1 et L.616-1 du Code de la consommation. Attention : le nom, l’adresse postale et le site internet du médiateur conventionné doivent encore être renseignés par l’entreprise sur cette page, les CGP et les documents de commande. Aucune identité de médiateur n’est supposée ou inventée. Les juridictions légalement compétentes restent accessibles.'],
      ['13. Données et preuves', 'Les données nécessaires au devis, à la sécurité des opérations, aux documents, aux factures et à la preuve du consentement doivent être limitées à ces finalités et conservées pour des durées définies selon les obligations légales. Les informations relatives au traitement des données et aux droits des personnes sont disponibles dans la politique de confidentialité. La création d’un compte ou la signature d’un devis ne constitue pas un accord général à recevoir des messages publicitaires.'],
      ['14. Droit applicable et évolution', 'Le droit français s’applique dans le respect des dispositions impératives protégeant les consommateurs. La version des conditions présentée au client lors de son engagement doit être conservée avec son dossier. Les mises à jour ultérieures ne modifient pas rétroactivement le contenu d’un devis ou d’un ordre de réparation accepté.']
    ],
    links: [['/retractation', 'Exercer mon droit de rétractation'], ['/mentions-legales', 'Identité et mentions légales'], ['/confidentialite', 'Confidentialité'], ['/fonctionnement', 'Parcours client'], ['/contact', 'Contacter EDM28']]
  },
  'mentions-legales': {
    path: '/mentions-legales',
    title: 'Mentions légales | EDM28',
    description: 'Identification de l’exploitant EDM28 et informations légales à finaliser.',
    h1: 'Mentions légales',
    lede: 'Identification du professionnel. Les informations non renseignées doivent être complétées dans la fiche entreprise avant validation juridique définitive.',
    breadcrumbs: [['/', 'Accueil'], ['/mentions-legales', 'Mentions légales']],
    sections: [
      ['Exploitant', 'Nom commercial : EDM28. Exploitant déclaré dans le back-office : EDM AUTO. Les dénominations et informations d’immatriculation doivent être confrontées à l’extrait officiel d’immatriculation (SIREN/SIRET) avant publication définitive.'],
      ['Immatriculation et TVA', 'Numéro SIREN/SIRET : non renseigné dans la configuration. Régime de TVA : non renseigné. Ne pas utiliser automatiquement « TVA non applicable, article 293 B du CGI » sans vérifier que l’entreprise bénéficie effectivement de la franchise en base.'],
      ['Assurance de responsabilité professionnelle', 'Nom de l’assureur, garanties professionnelles, coordonnées de contact et couverture du risque automobile (garde et intervention) : renseignements non fournis à ce stade.'],
      ['Médiateur de la consommation', 'Coordonnées du médiateur conventionné : à renseigner (organisme, adresse postale et site internet). L’entreprise doit choisir un médiateur inscrit sur la liste officielle avant la commercialisation conforme.'],
      ['Contact', 'Pour les questions contractuelles, les réclamations et l’exercice des droits : contact@edm28.fr. L’adresse de l’établissement est affichée sur la page Contact. Les coordonnées du responsable de publication et de l’hébergeur doivent être complétées conformément à la législation applicable.']
    ],
    links: [['/conditions-generales', 'Conditions générales'], ['/retractation', 'Rétractation'], ['/contact', 'Contact']]
  },
  confidentialite: {
    path: '/confidentialite',
    title: 'Confidentialité et données personnelles | EDM28',
    description: 'Information sur les données des clients EDM28 et leurs droits.',
    h1: 'Confidentialité et données personnelles',
    lede: 'Information destinée aux clients sur le traitement de leurs données. Les durées précises et la liste des sous-traitants doivent être vérifiées avant validation juridique définitive.',
    breadcrumbs: [['/', 'Accueil'], ['/confidentialite', 'Confidentialité']],
    sections: [
      ['Finalités et fondements', 'Les informations de compte, coordonnées, plaques, véhicules, demandes, devis, achats déclarés, rendez-vous, ordres de réparation, factures et preuves de signature sont traitées pour gérer les mesures précontractuelles, exécuter les contrats, assurer le suivi et respecter les obligations légales. Les justificatifs fournis doivent exclure, autant que possible, les coordonnées bancaires et données inutiles.'],
      ['Destinataires', 'Les données sont accessibles aux personnes habilitées du garage et aux prestataires techniques nécessaires au service, notamment les hébergeurs, le service d’authentification, les outils d’envoi d’emails et les services de stockage, sous réserve de leurs rôles et contrats. Les vendeurs de pièces restent responsables des données que le consommateur leur remet directement pour ses achats.'],
      ['Conservation et sécurité', 'Les durées de conservation doivent être documentées selon la nature du dossier, les obligations comptables et les délais de prescription, sans promettre une suppression immédiate des factures ou des preuves contractuelles soumises à conservation légale. Les documents sont hébergés dans des espaces privés avec des contrôles d’accès.'],
      ['Vos droits', 'Vous pouvez demander l’accès, la rectification, la limitation, l’effacement lorsque ce droit est applicable et, selon le fondement du traitement, l’opposition ou la portabilité. Écrivez à contact@edm28.fr en précisant votre demande. Vous pouvez également saisir la CNIL si nécessaire.'],
      ['Points à compléter', 'Le responsable de traitement identifié, les durées précises, l’inventaire des sous-traitants et, le cas échéant, les transferts de données hors EEE doivent être documentés dans le registre RGPD et la version définitive de cette politique.']
    ],
    links: [['/conditions-generales', 'Conditions générales'], ['/mentions-legales', 'Mentions légales'], ['/contact', 'Contact']]
  },
  cookies: {
    path: '/cookies',
    title: 'Cookies et stockage local | EDM28',
    description: 'Informations sur les cookies de session, le stockage local et les services tiers utilisés sur EDM28.',
    h1: 'Cookies et stockage local',
    lede: 'EDM28 utilise des données techniques nécessaires au fonctionnement du compte, des rendez-vous et de la sécurité. Cette page précise ce qui peut être stocké sur votre appareil.',
    breadcrumbs: [['/', 'Accueil'], ['/cookies', 'Cookies']],
    sections: [
      ['Stockage strictement nécessaire', 'Le site utilise le stockage du navigateur pour maintenir la session Supabase, mémoriser le choix « rester connecté » et protéger la reprise de certaines demandes ou confirmations. Ces mécanismes servent à l’authentification, à la sécurité ou à une fonction explicitement demandée. Ils ne sont pas employés à eux seuls pour un ciblage publicitaire.'],
      ['Mesures d’audience et publicité', 'L’audit du code actuel n’a pas identifié de balise Google Analytics, Google Tag Manager, Meta Pixel ou autre traceur publicitaire. Cette déclaration devra être révisée avant toute installation d’un outil de mesure d’audience ou de publicité. Les traceurs non essentiels nécessitant un consentement ne doivent pas être déposés avant un choix libre et une possibilité de refus équivalente.'],
      ['Services techniques externes', 'Les ressources de programmation peuvent être chargées depuis un réseau de diffusion de fichiers, notamment jsDelivr, ce qui implique des requêtes techniques à un tiers. L’assistant de FAQ peut transmettre le contenu de la question à un fournisseur d’IA lorsque vous l’utilisez. Ne transmettez aucune information médicale, bancaire ou personnelle dans les questions de FAQ.'],
      ['Vos contrôles', 'Vous pouvez vous déconnecter, décocher la conservation de session sur cet appareil et supprimer les données du site depuis les paramètres de votre navigateur. Effacer une session locale ne supprime pas les documents contractuels ou les factures conservés conformément à la réglementation.'],
      ['Évolution de cette politique', 'Avant l’activation de nouveaux services d’analyse, publicité ou marketing, EDM28 devra documenter leurs finalités, fournisseurs, durées, transferts éventuels et, le cas échéant, recueillir un consentement préalable et révocable.']
    ],
    links: [['/confidentialite','Données personnelles'],['/mentions-legales','Mentions légales'],['/contact','Contact']]
  },
  retractation: {
    path: '/retractation',
    title: 'Renoncer à un contrat en ligne | EDM28',
    description: 'Exercer gratuitement le droit de rétractation sur un devis EDM28 conclu à distance.',
    h1: 'Renoncer au contrat ici',
    lede: 'Si vous avez accepté un devis en ligne et souhaitez exercer votre droit de rétractation, utilisez cette fonctionnalité gratuite. Aucun motif n’est demandé. Vous pourrez confirmer votre déclaration avant son envoi.',
    breadcrumbs: [['/', 'Accueil'], ['/retractation', 'Rétractation']],
    sections: [
      ['Vos droits', 'Le délai est en principe de 14 jours à partir de la conclusion du contrat de service à distance, sauf exception. Le début anticipé des travaux ne met pas automatiquement fin au droit de rétractation ; des règles particulières régissent la prestation commencée à la demande expresse du consommateur. La déclaration sera enregistrée et examinée sans supprimer automatiquement votre réservation, votre facture ou vos documents.'],
      ['Autres moyens', 'Vous pouvez également adresser une déclaration claire, ou le formulaire légal type, par email à contact@edm28.fr ou par courrier à l’adresse de l’établissement. Le site ne peut pas imposer l’utilisation exclusive de ce formulaire en ligne.']
    ],
    links: [['/conditions-generales', 'Conditions générales'], ['/contact', 'Contact']],
    showWithdrawalForm: true
  }
};
