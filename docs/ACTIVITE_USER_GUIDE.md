# 🌊 Guide utilisateur — Fil d'activité

## À quoi ça sert
Suivre en temps réel **tout ce qui se passe** dans OpenPulse : tâches, emails, événements calendrier, interactions CRM, devis, factures, signatures de contrats, exécutions de workflows. Une vraie timeline d'équipe façon blog/Slack.

## Accès
Menu Général → **Activité** (`/activite`).

## Interface

### En-tête
- **KPIs** : compteurs Aujourd'hui / Cette semaine / Ce mois.
- **Top contributeurs** (semaine) avec barre de progression.

### Filtres
- 🔍 **Recherche texte** : titre, description, établissement, auteur (debounce 300 ms, partagée via `?q=`).
- 👥 **Utilisateurs** : multi-sélection avec recherche.
- 🏥 **Établissements** : multi-sélection avec recherche.
- 📅 **Période** : sélecteur de plage de dates.
- 🏷️ **Types** : 8 sources cliquables (Interactions, Tâches, Événements, Emails, Devis, Factures, Signatures, Workflows).

### Onglets
1. **Toute l'équipe** — flux global.
2. **Mon activité** — uniquement vos actions.
3. **Épinglées** — vos activités marquées d'une épingle (par utilisateur).

## Carte d'activité
Chaque post affiche :
- Avatar + nom de l'auteur, badge type.
- Heure exacte + heure relative.
- Titre + description (cliquables → ouvre la fiche détaillée).
- Chips contextuelles : établissement, statut, priorité, montant…
- **Réactions** 👍 ❤️ 🎉 👀 🚀 (compteur + tap pour ajouter/retirer).
- Menu **⋯** : épingler, copier le lien partageable, ouvrir l'élément.

## Détail d'une activité
Cliquez sur une carte → un panneau latéral s'ouvre avec : auteur complet, description, établissement lié, métadonnées brutes, actions rapides.

## Temps réel
- Auto-détection des nouveautés sur les 8 sources.
- Pill **« X nouvelles activités »** apparaît en haut → cliquez pour rafraîchir sans perdre votre position.

## Partage
- Copiez le lien d'une activité (menu ⋯ → « Copier le lien ») : `…/activite?focus=<id>` ouvre la page avec scroll auto + surlignage.
- Recherche partageable via `?q=mon%20texte`.

## Cas d'usage
- **Manager** : suivre l'activité de son équipe le matin.
- **CSM** : voir tout ce qui s'est passé sur un compte client (filtre établissement).
- **Direction** : pulse global de l'entreprise + identification des contributeurs clés.
- **Équipe** : commenter via réactions emoji, épingler les jalons importants.
