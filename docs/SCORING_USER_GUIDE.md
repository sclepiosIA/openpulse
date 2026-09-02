# 🎯 Guide utilisateur — Scoring comportemental

## À quoi ça sert
Prioriser les prospects les plus chauds en combinant **données statiques** (taille, secteur, budget) et **comportement** (emails ouverts, pages visitées, RDV pris).

## Accès
Menu CRM → **Scoring** (`/prospects/scoring`).

## Comprendre le score
- **Score total : 0–100**
- Statique (0–50) : 7 facteurs métier (effectif, secteur, ARR estimé…).
- Comportemental (0–50) : événements pondérés avec **décroissance exponentielle 30 jours** (un email ouvert hier vaut plus qu'il y a un mois).

## Couleurs
- 🟢 **80+** : prospect chaud, à contacter cette semaine.
- 🟡 **50-79** : à nourrir.
- 🔴 **< 50** : à mettre en pause ou exclure.

## Attribution
Chaque conversion est attribuée aux canaux qui ont contribué (modèle **time-decay**) : tu vois quels touchpoints ont vraiment converti.
