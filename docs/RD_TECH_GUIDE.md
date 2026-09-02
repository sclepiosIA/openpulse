# Guide Technique - Module R&D

> **Version**: 1.9.0 | **Dernière mise à jour**: Mars 2026

Documentation technique complète du module de gestion de projet agile OpenPulse.

## Table des Matières

- [Vue d'Ensemble](#vue-densemble)
- [Schéma de Données](#schéma-de-données)
- [Composants React](#composants-react)
- [Hooks](#hooks)
- [Intégration IA](#intégration-ia)
- [Analytics](#analytics)

---

## Vue d'Ensemble

Le module R&D implémente une gestion de projet agile complète avec :

- **Projets** : Container principal
- **Epics** : Grandes fonctionnalités
- **User Stories** : Unités de travail avec points Fibonacci
- **Tasks** : Sous-tâches techniques
- **Sprints** : Itérations time-boxed

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PAGE /rd                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐            │
│  │Dashboard│ Backlog │  Sprint │  Gantt  │Analytics│            │
│  │         │         │  Board  │         │         │            │
│  └─────────┴─────────┴─────────┴─────────┴─────────┘            │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    CONTENU ONGLET                          │  │
│  │                                                            │  │
│  │  Dashboard: KPIs, Sprint Progress, Burndown                │  │
│  │  Backlog: Epics → Stories avec points                      │  │
│  │  Sprint Board: Kanban 5 colonnes                           │  │
│  │  Gantt: Timeline avec dépendances                          │  │
│  │  Analytics: Vélocité, CFD, Workload                        │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Schéma de Données

### `rd_projets`

Projets R&D.

```sql
CREATE TABLE rd_projets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT,
  statut TEXT DEFAULT 'active',  -- active, completed, on_hold, archived
  date_debut DATE,
  date_fin_prevue DATE,
  couleur TEXT DEFAULT '#3B82F6',
  responsable_id UUID REFERENCES profiles,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `rd_epics`

Grandes fonctionnalités.

```sql
CREATE TABLE rd_epics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id UUID REFERENCES rd_projets NOT NULL,
  titre TEXT NOT NULL,
  description TEXT,
  couleur TEXT DEFAULT '#8B5CF6',
  priorite INTEGER DEFAULT 0,
  statut TEXT DEFAULT 'open',  -- open, in_progress, done
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `rd_sprints`

Itérations.

```sql
CREATE TABLE rd_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id UUID REFERENCES rd_projets NOT NULL,
  nom TEXT NOT NULL,
  objectif TEXT,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  statut TEXT DEFAULT 'planned',  -- planned, active, completed
  velocity_committed INTEGER DEFAULT 0,
  velocity_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `rd_user_stories`

User Stories avec estimation.

```sql
CREATE TABLE rd_user_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id UUID REFERENCES rd_projets NOT NULL,
  epic_id UUID REFERENCES rd_epics,
  sprint_id UUID REFERENCES rd_sprints,
  
  titre TEXT NOT NULL,
  description TEXT,  -- HTML from RichTextEditor
  criteres_acceptation TEXT[],
  
  -- Estimation Fibonacci
  points INTEGER,  -- 1, 2, 3, 5, 8, 13, 21
  
  -- Workflow
  statut TEXT DEFAULT 'backlog',  -- backlog, todo, in_progress, review, done
  priorite TEXT DEFAULT 'medium',  -- low, medium, high, critical
  
  -- Assignation
  assignee_id UUID REFERENCES profiles,
  
  -- Dates
  date_debut DATE,
  date_fin DATE,
  
  -- Métadonnées
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `rd_tasks`

Sous-tâches techniques.

```sql
CREATE TABLE rd_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES rd_user_stories NOT NULL,
  titre TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false,
  estimated_hours NUMERIC,
  actual_hours NUMERIC,
  assignee_id UUID REFERENCES profiles,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `rd_attachments`

Pièces jointes.

```sql
CREATE TABLE rd_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,  -- 'story', 'task', 'epic'
  entity_id UUID NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  uploaded_by UUID REFERENCES profiles,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Composants React

### Structure des Fichiers

```
src/components/rd/
├── RDDashboard.tsx           # Vue d'ensemble avec KPIs
├── RDBacklog.tsx             # Gestion backlog + epics
├── RDSprintBoard.tsx         # Kanban 5 colonnes
├── RDGanttView.tsx           # Timeline Gantt
├── RDAnalytics.tsx           # Graphiques et métriques
├── cards/
│   ├── RDStoryCard.tsx       # Card story sur Kanban
│   └── RDEpicCard.tsx        # Card epic dans backlog
├── dialogs/
│   ├── CreateStoryDialog.tsx
│   ├── StoryDetailDialog.tsx # Vue détaillée story
│   ├── CreateEpicDialog.tsx
│   ├── CreateSprintDialog.tsx
│   ├── EditProjetDialog.tsx
│   └── DeleteProjetDialog.tsx
└── sections/
    ├── AttachmentsSection.tsx
    └── TasksSection.tsx
```

### Composants Clés

#### `RDSprintBoard`

Kanban board flat avec 5 colonnes.

```typescript
interface KanbanColumn {
  id: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  title: string;
  color: string;
}

const columns: KanbanColumn[] = [
  { id: 'backlog', title: 'Backlog', color: 'bg-gray-100' },
  { id: 'todo', title: 'À faire', color: 'bg-blue-50' },
  { id: 'in_progress', title: 'En cours', color: 'bg-yellow-50' },
  { id: 'review', title: 'Review', color: 'bg-purple-50' },
  { id: 'done', title: 'Terminé', color: 'bg-green-50' },
];
```

#### `StoryDetailDialog`

Vue complète d'une user story.

```typescript
interface StoryDetailDialogProps {
  story: UserStory;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<UserStory>) => void;
}

// Sections:
// - Titre et description (RichTextEditor)
// - Points et priorité
// - Epic et assignee
// - Tasks checklist
// - Critères d'acceptation
// - Attachments
// - Bouton "Gérer par IA"
```

---

## Hooks

### `useRDProjets`

CRUD projets.

```typescript
const {
  projets,
  isLoading,
  createProjet,
  updateProjet,
  deleteProjet,
} = useRDProjets();
```

### `useRDSprints`

Gestion sprints.

```typescript
const {
  sprints,
  activeSprint,
  createSprint,
  startSprint,
  completeSprint,
} = useRDSprints(projetId);
```

### `useRDUserStories`

CRUD user stories.

```typescript
const {
  stories,
  storiesBySprint,
  storiesByStatus,
  createStory,
  updateStory,
  moveToColumn,
  assignToSprint,
} = useRDUserStories(projetId);
```

### `useRDTasks`

Gestion tasks.

```typescript
const {
  tasks,
  createTask,
  toggleTask,
  updateTask,
  deleteTask,
} = useRDTasks(storyId);
```

### `useRDAnalytics`

Métriques et graphiques.

```typescript
const {
  velocity,
  burndownData,
  cumulativeFlowData,
  storyDistribution,
  teamWorkload,
} = useRDAnalytics(projetId, sprintId);
```

---

## Intégration IA

### Edge Function `rd-ai-assist`

Améliore les user stories avec GPT-5.

```typescript
// supabase/functions/rd-ai-assist/index.ts

const systemPrompt = `Tu es un assistant Scrum Master expert.
Tu améliores les user stories en:
1. Restructurant la description pour plus de clarté (format HTML)
2. Générant des tasks techniques appropriées
3. Suggérant des critères d'acceptation

IMPORTANT: Tu NE DOIS JAMAIS inventer de fonctionnalités.
Tu restructures et clarifie UNIQUEMENT ce qui est décrit.
Toute task doit être déductible du contenu existant.

Retourne un JSON:
{
  "improvedDescription": "<p>Description améliorée en HTML</p>",
  "suggestedTasks": [
    {"title": "...", "estimated_hours": 4}
  ],
  "acceptanceCriteria": ["Critère 1", "Critère 2"]
}`;

// Paramètres GPT-5
const body = {
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: storyDescription }
  ],
  max_completion_tokens: 2000,
  reasoning_effort: 'low',
  verbosity: 'low',
  response_format: { type: 'json_object' }
};
```

### Utilisation dans le Frontend

```typescript
// Dans StoryDetailDialog
const handleAIAssist = async () => {
  setIsAILoading(true);
  
  const { data, error } = await supabase.functions.invoke('rd-ai-assist', {
    body: { storyId: story.id, description: story.description }
  });
  
  if (data) {
    // Mettre à jour la description
    await updateStory({ description: data.improvedDescription });
    
    // Créer les tasks suggérées
    for (const task of data.suggestedTasks) {
      await createTask({
        story_id: story.id,
        titre: task.title,
        estimated_hours: task.estimated_hours
      });
    }
    
    // Ajouter les critères
    await updateStory({
      criteres_acceptation: data.acceptanceCriteria
    });
  }
  
  setIsAILoading(false);
};
```

---

## Analytics

### Burndown Chart

Progression du sprint.

```typescript
interface BurndownData {
  date: string;
  ideal: number;      // Points idéaux restants
  actual: number;     // Points réels restants
  completed: number;  // Points terminés
}

// Calcul
function calculateBurndown(sprint: Sprint, stories: Story[]): BurndownData[] {
  const totalPoints = stories.reduce((sum, s) => sum + (s.points || 0), 0);
  const sprintDays = differenceInDays(sprint.date_fin, sprint.date_debut);
  const pointsPerDay = totalPoints / sprintDays;
  
  return eachDayOfInterval({
    start: sprint.date_debut,
    end: sprint.date_fin
  }).map((date, index) => ({
    date: format(date, 'dd/MM'),
    ideal: totalPoints - (pointsPerDay * index),
    actual: calculateActualRemaining(stories, date),
    completed: calculateCompleted(stories, date)
  }));
}
```

### Velocity Chart

Vélocité par sprint.

```typescript
interface VelocityData {
  sprint: string;
  committed: number;
  completed: number;
  average: number;
}

// Calcul moyenne glissante sur 3 sprints
function calculateVelocity(sprints: Sprint[]): VelocityData[] {
  return sprints.map((sprint, index) => {
    const recentSprints = sprints.slice(Math.max(0, index - 2), index + 1);
    const average = recentSprints.reduce((sum, s) => 
      sum + s.velocity_completed, 0) / recentSprints.length;
    
    return {
      sprint: sprint.nom,
      committed: sprint.velocity_committed,
      completed: sprint.velocity_completed,
      average: Math.round(average)
    };
  });
}
```

### Cumulative Flow Diagram

Distribution des statuts dans le temps.

```typescript
interface CFDData {
  date: string;
  backlog: number;
  todo: number;
  in_progress: number;
  review: number;
  done: number;
}
```

---

## Bonnes Pratiques

### Points Fibonacci

| Points | Complexité | Durée Estimée |
|--------|------------|---------------|
| 1 | Trivial | < 2h |
| 2 | Simple | 2-4h |
| 3 | Moyen | 4-8h |
| 5 | Complexe | 1-2 jours |
| 8 | Très complexe | 2-3 jours |
| 13 | Epic à découper | 3-5 jours |
| 21 | Trop gros | À redécouper |

### Definition of Done

```typescript
const definitionOfDone = [
  'Code revu et approuvé',
  'Tests unitaires passent',
  'Documentation à jour',
  'Déployé en staging',
  'Validé par PO',
];
```

### Workflow Kanban

```
Backlog → Todo → In Progress → Review → Done
   │                              │
   │  Max 3 stories en WIP        │  Peer review obligatoire
   │  par développeur             │  avant passage en Done
```

---

*Guide mis à jour le 07/12/2025*
