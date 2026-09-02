import { TutorielModule } from '@/types/tutoriel'

export const supportModule: TutorielModule = {
  id: 'support',
  title: 'Gestion du Support',
  description: 'Apprenez à gérer les tickets de support, suivre les demandes clients et optimiser la résolution',
  icon: 'HeadphonesIcon',
  category: 'operations',
  estimatedTime: '12 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'creation-tickets',
      title: 'Création et réception de tickets',
      description: 'Comment les tickets sont créés et reçus dans le système',
      steps: [
        {
          id: 'tickets-automatiques',
          title: 'Tickets automatiques depuis les emails',
          content: 'Les emails envoyés à support@exploitant.example.org créent automatiquement un ticket dans le système.',
          detailedContent: `Le système de support est connecté à la boîte mail support. Chaque email reçu:

- Crée un nouveau ticket avec le sujet comme titre
- Extrait les informations de l'expéditeur
- Tente d'associer automatiquement à un établissement existant
- Conserve l'historique des échanges via le Message-ID`,
          tip: 'Les tickets créés par email conservent tout l\'historique de la conversation pour un suivi optimal.'
        },
        {
          id: 'creation-manuelle',
          title: 'Création manuelle d\'un ticket',
          content: 'Vous pouvez créer un ticket manuellement depuis l\'interface Support.',
          detailedContent: `Pour créer un ticket manuellement:

1. Cliquez sur "Nouveau ticket"
2. Renseignez le titre et la description
3. Sélectionnez l\'établissement concerné
4. Définissez la priorité (basse, normale, haute, urgente)
5. Assignez à un membre de l\'équipe si nécessaire`,
          example: 'Ticket: "Problème de connexion SSO" - Priorité haute - Assigné à Support Technique'
        }
      ]
    },
    {
      id: 'suivi-resolution',
      title: 'Suivi et résolution',
      description: 'Gérer le cycle de vie des tickets jusqu\'à leur résolution',
      steps: [
        {
          id: 'statuts-tickets',
          title: 'Comprendre les statuts',
          content: 'Chaque ticket passe par plusieurs statuts: Ouvert → En cours → En attente → Résolu → Fermé.',
          detailedContent: `Les statuts permettent de suivre l\'avancement:

- **Ouvert**: Nouveau ticket non traité
- **En cours**: Un agent travaille sur le ticket
- **En attente**: Attente de réponse client ou tiers
- **Résolu**: Solution apportée, en attente de confirmation
- **Fermé**: Ticket définitivement clôturé`,
          tip: 'Un ticket en "Résolu" depuis plus de 7 jours passe automatiquement en "Fermé".'
        },
        {
          id: 'liaison-taches',
          title: 'Liaison avec les tâches établissement',
          content: 'Liez un ticket à une tâche établissement pour un suivi transverse.',
          detailedContent: `La liaison bidirectionnelle ticket ↔ tâche permet:

- De créer une tâche depuis un ticket en un clic
- De voir le ticket associé dans la fiche établissement
- D\'avoir une vue unifiée du travail en cours`,
          example: 'Ticket "Formation non planifiée" → Tâche "Planifier session formation" sur l\'établissement'
        }
      ]
    },
    {
      id: 'kpis-support',
      title: 'KPIs et performance',
      description: 'Analyser les métriques de performance du support',
      steps: [
        {
          id: 'metriques-cles',
          title: 'Métriques clés à surveiller',
          content: 'Suivez le temps de première réponse, le temps de résolution moyen et le taux de satisfaction.',
          detailedContent: `Les KPIs essentiels du support:

- **Temps de première réponse**: Délai avant la première réponse (objectif < 4h)
- **Temps de résolution**: Durée moyenne de traitement complet
- **Taux de résolution au premier contact**: % de tickets résolus sans escalade
- **Score de satisfaction**: Note moyenne des clients post-résolution`,
          tip: 'Un bon temps de première réponse impacte fortement la satisfaction client.'
        }
      ]
    }
  ]
}
