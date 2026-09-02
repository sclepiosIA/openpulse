import { TutorielModule } from '@/types/tutoriel'

export const productionModule: TutorielModule = {
  id: 'production',
  title: 'Production',
  description: 'Surveillez la santé de vos clients en production et optimisez leur satisfaction',
  icon: 'Factory',
  category: 'operations',
  estimatedTime: '15 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'metriques-sante',
      title: 'Métriques de santé client',
      description: 'Comprenez les indicateurs de santé de vos clients',
      steps: [
        {
          id: 'score-sante',
          title: 'Score de santé global',
          content: 'Le score de santé (0-100) est calculé à partir de plusieurs métriques : adoption, NPS, tickets support, engagement, et utilisation. Un score > 70 indique un client en bonne santé.',
          tip: 'Les établissements avec un score < 50 sont signalés en rouge et nécessitent une attention particulière.'
        },
        {
          id: 'adoption',
          title: 'Taux d\'adoption',
          content: 'Le pourcentage d\'utilisateurs actifs par rapport aux utilisateurs formés. Un taux d\'adoption élevé (> 80%) est un bon indicateur de succès.',
          warning: 'Un taux d\'adoption faible peut indiquer un besoin de formation complémentaire.'
        },
        {
          id: 'nps',
          title: 'NPS (Net Promoter Score)',
          content: 'Le NPS mesure la satisfaction et la recommandation. Score de -100 à +100. Promoteurs (9-10), Passifs (7-8), Détracteurs (0-6).'
        },
        {
          id: 'tickets-support',
          title: 'Tickets support',
          content: 'Le nombre de tickets ouverts et leur temps de résolution moyen. Un nombre élevé de tickets peut indiquer des problèmes récurrents.'
        }
      ]
    },
    {
      id: 'analytics',
      title: 'Analytics',
      description: 'Analysez les tendances et la répartition de vos clients',
      steps: [
        {
          id: 'repartition-sante',
          title: 'Répartition par santé',
          content: 'Visualisez la distribution de vos clients par niveau de santé : Excellent (> 80), Bon (60-80), À risque (40-60), Critique (< 40).'
        },
        {
          id: 'tendances',
          title: 'Tendances',
          content: 'Suivez l\'évolution des métriques dans le temps : adoption mensuelle, évolution du NPS, tickets par période.'
        }
      ]
    },
    {
      id: 'cohortes',
      title: 'Cohortes',
      description: 'Analysez vos clients par cohorte d\'entrée en production',
      steps: [
        {
          id: 'retention-mensuelle',
          title: 'Rétention mensuelle',
          content: 'Le tableau de cohortes affiche la rétention de chaque groupe de clients par mois depuis leur go-live. Identifiez les périodes critiques de churn.'
        },
        {
          id: 'analyse-cohorte',
          title: 'Analyse par cohorte',
          content: 'Comparez les performances des différentes cohortes pour identifier les best practices et les facteurs de succès.',
          tip: 'Les cohortes avec une meilleure rétention ont souvent reçu une formation plus approfondie.'
        }
      ]
    },
    {
      id: 'actions-csm',
      title: 'Actions CSM',
      description: 'Menez des actions proactives pour vos clients',
      steps: [
        {
          id: 'quick-notes',
          title: 'Quick notes',
          content: 'Ajoutez des notes rapides après chaque interaction client : appels, réunions, feedbacks. Ces notes alimentent l\'historique de la relation.'
        },
        {
          id: 'taches-suivi',
          title: 'Tâches de suivi',
          content: 'Créez des tâches de suivi : QBR (Quarterly Business Review), check-ins réguliers, formations de rappel.'
        },
        {
          id: 'alertes-renouvellement',
          title: 'Alertes renouvellement',
          content: 'Les contrats arrivant à échéance dans les 90 jours sont signalés. Planifiez vos actions de renouvellement à l\'avance.',
          warning: 'N\'attendez pas le dernier moment pour initier les discussions de renouvellement.'
        }
      ]
    }
  ]
}
