# EDM28 Pilotage Android

Application Expo Go réservée à l'administrateur EDM28.

## Périmètre V1

- connexion par code email Supabase ;
- vérification stricte du rôle `admin` ;
- accueil avec CA, encaissements, dépenses, trésorerie et graphique 6 mois ;
- comptabilité synthétique avec camembert ;
- demandes à traiter avec action `Marquer étudiée` ;
- connexion exclusive au projet Supabase staging `edm28-staging`.

## Test local

```bash
cd mobile
npm install
npx expo start --tunnel
```

Scanner ensuite le QR avec Expo Go sur Android.

Aucune configuration Production n'est incluse.
