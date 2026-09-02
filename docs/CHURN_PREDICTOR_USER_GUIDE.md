# 🛡️ Guide utilisateur — Prédiction de churn

## À quoi ça sert
Détecter automatiquement les **comptes clients à risque de désabonnement** avant qu'ils ne partent, pour permettre au CSM/Direction d'agir à temps.

## Accès
Menu Direction → **Risque de churn** (`/churn`).

## Comment c'est calculé
Score 0–100 basé sur 4 facteurs (poids cumulé) :
- **Tickets support ouverts** (30 pts max) — ≥ 5 tickets actifs = signal fort
- **Engagement email 30j** (25 pts max) — 0 échange = compte « silencieux »
- **Factures impayées > 30j** (25 pts max) — ≥ 2 impayées = signal critique
- **Dernière interaction CRM** (20 pts max) — > 60j sans contact

## Niveaux de risque
- 🔴 **Critique (75+)** : intervention urgente, escalade direction
- 🟠 **Élevé (50–74)** : plan d'action CSM cette semaine
- 🟡 **Modéré (25–49)** : surveiller, recontacter sous 15 j
- 🟢 **Faible (<25)** : compte sain

## Recalcul
- **Automatique** : tous les jours à 02:00 (Paris) via cron
- **Manuel** : bouton « Recalculer » sur la page

## Recommandations
Chaque compte à risque affiche des actions concrètes générées automatiquement (ex : « Traiter les 7 tickets support ouverts », « Aucun échange email depuis 30 jours - reprendre contact »). Cliquer sur le nom du compte ouvre la fiche établissement pour agir.

## Bonnes pratiques
1. Consulter la page **chaque lundi matin** (revue hebdo CSM).
2. Convertir un compte 🔴 en tâche prioritaire dans `/todos`.
3. Documenter chaque action dans la timeline d'interactions de la fiche.
