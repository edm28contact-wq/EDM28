# EDM AUTO Site V7 - API plaque + IA estimation

Site Vite/React EDM AUTO.

## Fonctionnalités

- Accueil avec bouton Préparer mon RDV
- Voir les services : main-d'oeuvre uniquement
- Saisie client
- Recherche véhicule par plaque via `/api/vehicle`
- Fallback manuel si l'API plaque ne répond pas
- Choix freinage principal
- Vidange uniquement en annexe d'une réparation freinage
- Huile garage proposée seulement si compatibilité estimée avec stock
- Estimation IA via `/api/estimate`
- Fallback règles EDM AUTO si aucune clé OpenAI n'est configurée
- Envoi demande par mail à EDM AUTO

## Variables Vercel

À mettre dans Vercel > Settings > Environment Variables :

```txt
PLATE_API_TOKEN=ton_token_api_plaque
PLATE_API_COUNTRY=FR
OPENAI_API_KEY=ta_cle_openai
OPENAI_MODEL=gpt-4.1-mini
```

`PLATE_API_TOKEN` peut être laissé vide pour tester avec le token démo prévu dans le code, mais pour la production il faudra utiliser un vrai token.

## Déploiement Vercel

Framework : Vite
Install Command : npm install
Build Command : npm run build
Output Directory : dist
