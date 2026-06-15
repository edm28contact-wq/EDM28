# EDM AUTO V8 - Paniers pieces Motointegrator

Version sans API plaque obligatoire.

Objectif : le client renseigne le vehicule et les prestations, puis le site prepare des paniers ECO / STANDARD / PREMIUM avec :
- familles de pieces a chercher ;
- marques conseillees par gamme ;
- liens Motointegrator / categories ;
- requetes a copier ;
- validation obligatoire EDM AUTO avant achat.

## Structure Vercel

Mettre ces fichiers a la racine du projet :

```txt
index.html
package.json
vercel.json
README.md
api/
  _utils.cjs
  health.js
  plate.js
  vin.js
  ai-basket.js
  parts-basket.js
  submit-request.js
```

## Reglages Vercel

Build Command :

```txt
echo "No build needed"
```

Output Directory :

```txt
.
```

## Variables optionnelles

Pour l'envoi vers Google Sheets / Apps Script :

```txt
APPS_SCRIPT_WEBAPP_URL
APPS_SCRIPT_API_KEY
```

ou :

```txt
EDM28_BACKEND_URL
EDM28_API_KEY
EDM28_SUBMIT_MODE=auto
```

Aucune cle IA n'est obligatoire pour creer les paniers Motointegrator. La route `/api/ai-basket` utilise des regles EDM AUTO.

## Test

Apres redeploiement :

```txt
/api/health
```

Puis :

```txt
Prendre RDV -> remplir client -> remplir vehicule -> choisir prestations -> Creer les paniers pieces Motointegrator
```

Important : les liens Motointegrator sont des recherches preparees. Ce ne sont pas des references garanties. EDM AUTO doit verifier VIN/type mine, dimensions, cote et accessoires avant commande.
