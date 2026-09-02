# 📈 Guide utilisateur — Prévisions de ventes

## À quoi ça sert
Anticiper le chiffre d'affaires des prochains trimestres en pondérant chaque opportunité commerciale par sa probabilité de signature.

## Accès
Menu Direction → **Forecasting** (`/forecasting`).

## Lecture du dashboard
- **Pipeline pondéré** : somme des deals × probabilité statut (Prospect 10%, Négociation 50%, Contractuel 80%…).
- **Vue par trimestre** : prévision des 4 prochains trimestres glissants.
- **Vue par commercial** : performance individuelle attendue.
- **Vue par phase** : où se concentre le pipeline.

## Bonnes pratiques
1. Mettre à jour le **statut** de chaque prospect dès qu'il évolue (la pondération suit).
2. Renseigner le **montant prévisionnel** sur chaque fiche établissement.
3. Comparer chaque mois prévu vs réalisé pour calibrer.

## FAQ
- **Pourquoi mon deal n'apparaît pas ?** → Vérifie qu'il a un montant et un statut actif.
- **Les chiffres bougent en temps réel ?** → Recalcul à chaque ouverture de page (RPC `get_sales_forecast`).
