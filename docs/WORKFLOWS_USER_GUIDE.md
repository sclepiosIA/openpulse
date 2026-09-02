# ⚡ Guide utilisateur — Automatisations (Workflows)

## À quoi ça sert
Créer des règles **« si X alors Y »** sans code : déclencher une tâche, un email ou une notification quand un événement se produit.

## Accès
Menu Direction → **Automatisations** (`/automatisations`).

## Créer un workflow en 3 étapes
1. **Trigger** : choisir l'événement déclencheur (ex : « Nouveau prospect créé »).
2. **Conditions** (optionnel) : filtrer (ex : ville = Paris).
3. **Actions** : ce qui se passe (créer tâche, envoyer email, notifier équipe…).

## Exemples utiles
- *Nouveau prospect → créer tâche « Premier appel » assignée au commercial*
- *Facture impayée > 30j → notifier la direction*
- *Établissement passé en Production → email de bienvenue*

## Suivi des exécutions
L'onglet **Historique** liste chaque run (succès/échec, données, durée).

## Bonnes pratiques
- Tester sur un cas isolé avant d'activer en masse.
- Désactiver (pas supprimer) un workflow obsolète pour garder l'historique.
