import { TutorielModule } from '@/types/tutoriel'

export const rdAgileModule: TutorielModule = {
  id: 'rd-agile',
  title: 'R&D Agile',
  description: 'Gérez vos projets de développement avec le framework Scrum intégré',
  icon: 'Rocket',
  category: 'operations',
  estimatedTime: '15 min',
  level: 'avance',
  sections: [
    {
      id: 'dashboard-rd',
      title: 'Dashboard R&D',
      description: 'Vue d\'ensemble de l\'activité R&D',
      steps: [
        {
          id: 'kpis-sprint',
          title: 'KPIs du sprint en cours',
          content: 'Le dashboard affiche la progression du sprint, la vélocité et les métriques clés.',
          detailedContent: `Métriques affichées:

- **Progression sprint**: % de points livrés vs planifiés
- **Burndown**: Courbe de reste à faire
- **Vélocité**: Moyenne des 3 derniers sprints
- **Cumulative Flow**: État des tickets par statut`,
          example: 'Sprint 24: 34/40 points livrés (85%) | Vélocité moyenne: 38 points'
        },
        {
          id: 'alertes-rd',
          title: 'Alertes et blocages',
          content: 'Les blocages et risques du sprint sont signalés en haut du dashboard.',
          tip: 'Cliquez sur une alerte pour accéder directement au ticket concerné.'
        }
      ]
    },
    {
      id: 'backlog',
      title: 'Backlog et User Stories',
      description: 'Gérer le backlog produit',
      steps: [
        {
          id: 'creation-stories',
          title: 'Créer une User Story',
          content: 'Rédigez vos User Stories au format "En tant que... je veux... afin de...".',
          detailedContent: `Structure d\'une User Story:

- **Titre**: Court et descriptif
- **Description**: Format "En tant que X, je veux Y, afin de Z"
- **Critères d\'acceptation**: Liste des conditions de validation
- **Points**: Estimation en points Fibonacci (1, 2, 3, 5, 8, 13)
- **Epic**: Rattachement à une Epic parent`,
          example: 'En tant qu\'utilisateur, je veux filtrer les emails par établissement afin de retrouver rapidement les échanges.'
        },
        {
          id: 'priorisation',
          title: 'Prioriser le backlog',
          content: 'Glissez-déposez les stories pour définir leur priorité.',
          detailedContent: `Critères de priorisation:

- Valeur métier (impact utilisateur)
- Effort technique (complexité)
- Dépendances avec d\'autres stories
- Risques identifiés`,
          tip: 'L\'IA peut suggérer un ordre de priorité basé sur l\'analyse des stories.'
        }
      ]
    },
    {
      id: 'sprint-board',
      title: 'Sprint Board',
      description: 'Suivre l\'avancement du sprint',
      steps: [
        {
          id: 'colonnes-kanban',
          title: 'Colonnes du Kanban',
          content: 'Le board est organisé en 5 colonnes: À faire, En cours, Review, Test, Terminé.',
          detailedContent: `Workflow des colonnes:

- **À faire**: Stories planifiées pour le sprint
- **En cours**: Développement actif
- **Review**: Code review par un pair
- **Test**: Validation QA
- **Terminé**: Story livrée et validée`,
          warning: 'Une story ne peut passer en "Terminé" que si tous les critères d\'acceptation sont validés.'
        },
        {
          id: 'wip-limits',
          title: 'Limites WIP',
          content: 'Les limites Work-In-Progress évitent la surcharge de travail en parallèle.',
          detailedContent: `Les limites WIP:

- Configurables par colonne
- Alerte visuelle quand dépassées
- Encouragent le "Stop starting, start finishing"`,
          example: 'Limite "En cours": 3 stories max par développeur'
        }
      ]
    },
    {
      id: 'burndown-velocite',
      title: 'Burndown et Vélocité',
      description: 'Analyser les métriques de performance',
      steps: [
        {
          id: 'lecture-burndown',
          title: 'Lire le Burndown Chart',
          content: 'Le burndown montre le reste à faire jour par jour comparé à la trajectoire idéale.',
          detailedContent: `Interprétation du burndown:

- **Courbe au-dessus de l\'idéal**: Sprint en retard
- **Courbe en-dessous**: En avance
- **Plateau**: Blocage ou absence de livraison
- **Remontée**: Ajout de scope en cours de sprint`,
          tip: 'Un burndown avec beaucoup de plateaux indique des stories trop grosses.'
        },
        {
          id: 'analyse-velocite',
          title: 'Analyser la vélocité',
          content: 'La vélocité moyenne sur 3 sprints prédit la capacité future de l\'équipe.',
          example: 'Sprints 21-23: 36, 42, 38 points → Vélocité moyenne: 39 points'
        }
      ]
    },
    {
      id: 'ai-assist',
      title: 'Assistant IA R&D',
      description: 'Utiliser l\'IA pour améliorer vos stories',
      steps: [
        {
          id: 'redaction-ia',
          title: 'Rédaction assistée',
          content: 'L\'IA peut reformuler vos User Stories et suggérer des critères d\'acceptation.',
          detailedContent: `Fonctionnalités IA:

- Reformulation au format standard
- Suggestion de critères d\'acceptation
- Détection de stories trop complexes
- Estimation de points basée sur l\'historique`,
          tip: 'L\'IA apprend de votre historique pour améliorer ses suggestions.'
        }
      ]
    }
  ]
}
