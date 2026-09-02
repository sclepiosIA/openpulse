# Guide Utilisateur - Module R&D

## Introduction

Le module R&D de OpenPulse implémente une gestion de projet agile complète avec Scrum et Kanban, permettant de planifier, suivre et livrer les développements produit.

### Objectif

- Gérer le backlog produit avec Epics et User Stories
- Planifier et exécuter des sprints
- Suivre l'avancement avec des métriques agiles
- Collaborer efficacement sur le développement

### Prérequis

- Compte utilisateur OpenPulse actif
- Rôle R&D (développeur, product owner, scrum master)

---

## Premiers Pas

### Accès au Module

1. Dans la navigation, cliquez sur **R&D**
2. Le tableau de bord s'affiche par défaut

### Navigation

| Section | Description |
|---------|-------------|
| Dashboard | Vue d'ensemble avec KPIs et graphiques |
| Backlog | Gestion des Epics et User Stories |
| Sprint Board | Kanban du sprint en cours |
| Timeline | Vue Gantt des sprints et releases |
| Analytics | Métriques détaillées et rapports |

---

## Fonctionnalités

### 1. Dashboard

#### KPIs Affichés

| Métrique | Description |
|----------|-------------|
| Vélocité | Points livrés par sprint (moyenne) |
| Sprint actuel | Nom et dates du sprint en cours |
| Burndown | Progression du sprint |
| Bugs ouverts | Nombre de bugs non résolus |

#### Graphiques

- **Burndown Chart** : Points restants vs temps
- **Velocity Chart** : Évolution de la vélocité sur les sprints
- **CFD (Cumulative Flow)** : Flux des stories par statut

### 2. Backlog

#### Créer une Epic

Les Epics sont des fonctionnalités majeures regroupant plusieurs User Stories.

1. Cliquez sur **+ Nouvelle Epic**
2. Remplissez :
   - Titre
   - Description
   - Priorité (P0-P3)
   - Tags
3. Cliquez sur **Créer**

#### Créer une User Story

1. Dans une Epic, cliquez sur **+ User Story**
2. Remplissez :
   - Titre (format "En tant que... je veux... afin de...")
   - Critères d'acceptance
   - Points (Fibonacci : 1, 2, 3, 5, 8, 13, 21)
   - Assigné
3. Cliquez sur **Créer**

#### Points Fibonacci

| Points | Complexité |
|--------|------------|
| 1 | Trivial (< 1h) |
| 2 | Simple (1-2h) |
| 3 | Petit (demi-journée) |
| 5 | Moyen (1 jour) |
| 8 | Grand (2-3 jours) |
| 13 | Très grand (1 semaine) |
| 21 | Epic à découper |

#### Priorisation

Glissez-déposez les stories pour réordonner le backlog. Le haut = priorité maximale.

### 3. Sprint Planning

#### Démarrer un Sprint

1. Cliquez sur **+ Nouveau Sprint**
2. Définissez :
   - Nom du sprint (ex: "Sprint 42")
   - Date de début
   - Date de fin (généralement 2 semaines)
   - Objectif du sprint
3. Cliquez sur **Créer**

#### Ajouter des Stories au Sprint

1. Dans le backlog, sélectionnez les stories
2. Cliquez sur **Ajouter au sprint**
3. Ou glissez-déposez vers le sprint

#### Capacité

Le système calcule automatiquement :
- Points engagés vs capacité historique (vélocité)
- Alerte si sur-engagement

### 4. Sprint Board (Kanban)

#### Colonnes

| Colonne | Description |
|---------|-------------|
| À faire | Stories planifiées |
| En cours | Stories en développement |
| En revue | En attente de code review |
| En test | En validation QA |
| Terminé | Stories livrées |

#### Déplacer une Story

- **Drag & Drop** : Glissez vers la colonne suivante
- Les transitions mettent à jour automatiquement les métriques

#### Limites WIP

Chaque colonne peut avoir une limite Work In Progress :
- ⚠️ Orange : Approche de la limite
- 🔴 Rouge : Limite dépassée

#### Filtres

| Filtre | Usage |
|--------|-------|
| Assigné | Vos stories uniquement |
| Type | User Story, Bug, Tech Debt |
| Labels | Par tag |

### 5. Daily Stand-up

#### Mes Tâches

Vue rapide de vos stories assignées :
1. Cliquez sur **Daily**
2. Voyez ce que vous avez fait hier
3. Voyez ce qui est prévu aujourd'hui
4. Signalez les blocages

### 6. Assistance IA

#### Rédaction de User Stories

1. Dans le formulaire de création, cliquez sur **✨ Aide IA**
2. Décrivez la fonctionnalité en quelques mots
3. L'IA génère :
   - Un titre formaté "En tant que..."
   - Des critères d'acceptance
   - Une estimation de points suggérée
4. Modifiez et validez

#### Découpage d'Epic

1. Sur une Epic, cliquez sur **🔪 Découper**
2. L'IA propose un découpage en stories
3. Validez ou ajustez les suggestions

### 7. Timeline (Gantt)

#### Vue d'Ensemble

- Visualisez les sprints sur un calendrier
- Voyez les dépendances entre stories
- Identifiez les risques de retard

#### Créer une Dépendance

1. Cliquez sur une story
2. Faites glisser vers la story dépendante
3. La flèche de dépendance apparaît

### 8. Analytics

#### Métriques Disponibles

| Métrique | Description |
|----------|-------------|
| Burndown | Courbe de progression du sprint |
| Burnup | Points cumulés livrés |
| Vélocité | Points par sprint historique |
| Cycle Time | Temps moyen story → done |
| Lead Time | Temps backlog → production |

#### Rapports

- Vélocité moyenne sur 6 sprints
- Répartition par type (feature/bug/tech)
- Tendance de qualité (bugs trouvés)

---

## Workflow Scrum

### Cycle de Sprint (2 semaines)

```
Lundi S1     : Sprint Planning (2h)
Quotidien    : Daily Stand-up (15min)
Vendredi S2  : Sprint Review (1h)
Vendredi S2  : Rétrospective (1h)
```

### Rôles

| Rôle | Responsabilités |
|------|-----------------|
| Product Owner | Priorisation backlog, acceptance |
| Scrum Master | Facilitation, suppression blocages |
| Développeur | Développement, estimation |

---

## FAQ

### Comment estimer une story ?

1. L'équipe utilise le Planning Poker
2. Comparez à des stories passées
3. Tenez compte de la complexité, pas du temps
4. En cas de doute, prenez la valeur supérieure

### Comment gérer les bugs urgents en sprint ?

1. Évaluez l'urgence avec le PO
2. Si critique : ajoutez au sprint (et retirez une story équivalente)
3. Si non critique : mettez en haut du backlog pour le prochain sprint

### Comment signaler un blocage ?

1. Dans le Daily, marquez la story comme "Bloquée"
2. Ajoutez un commentaire décrivant le blocage
3. Le Scrum Master est notifié automatiquement

### Le burndown ne descend pas, pourquoi ?

1. Les stories ne sont pas découpées assez finement
2. Trop de stories en parallèle (augmentez le focus)
3. Des blocages non résolus

---

## Troubleshooting

### Stories disparues du board

1. Vérifiez le filtre actif
2. La story peut avoir été déplacée vers "Done"
3. Ou retirée du sprint par le PO

### Vélocité incohérente

1. Assurez-vous de marquer "Done" à la fin de chaque sprint
2. Les stories non terminées sont automatiquement reportées
3. Révisez les estimations si l'écart est constant

---

## Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| `N` | Nouvelle story |
| `E` | Modifier la story sélectionnée |
| `D` | Vue Daily |
| `B` | Vue Backlog |
| `S` | Vue Sprint Board |

---

## Bonnes Pratiques

1. **Stories INVEST** : Independent, Negotiable, Valuable, Estimable, Small, Testable
2. **Définition of Done** : Code review + tests + documentation
3. **Focus** : Limitez le WIP à 2 stories par développeur
4. **Rétrospective** : Implémentez au moins une amélioration par sprint
5. **Affinage** : Gardez 2 sprints de backlog affiné à l'avance

---

## Ressources Complémentaires

- [Guide Scrum](https://scrumguides.org/)
- [Guide CRM](./CRM_USER_GUIDE.md)
- [API Reference](./API_REFERENCE.md)
