import { TutorielModule } from '@/types/tutoriel'

export const rapportsModule: TutorielModule = {
  id: 'rapports',
  title: 'Rapports',
  description: 'Générez des rapports d\'activité et de performance',
  icon: 'BarChart3',
  category: 'analyses',
  estimatedTime: '10 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'rapports-activite',
      title: 'Rapports d\'activité',
      description: 'Suivez l\'activité de votre équipe',
      steps: [
        {
          id: 'rapport-commercial',
          title: 'Rapport commercial',
          content: 'Le rapport commercial présente : nombre de prospects contactés, RDV effectués, propositions envoyées, contrats signés, et taux de conversion par étape.'
        },
        {
          id: 'rapport-deploiement',
          title: 'Rapport déploiement',
          content: 'Suivez l\'avancement des déploiements : établissements en cours, durée moyenne par phase, blocages identifiés, go-lives réalisés.'
        },
        {
          id: 'rapport-support',
          title: 'Rapport support',
          content: 'Analysez la qualité du support : tickets ouverts/fermés, temps de résolution moyen, satisfaction client, tickets par catégorie.'
        }
      ]
    },
    {
      id: 'rapports-performance',
      title: 'Rapports de performance',
      description: 'Mesurez les KPIs clés',
      steps: [
        {
          id: 'kpis-globaux',
          title: 'KPIs globaux',
          content: 'Dashboard des indicateurs clés : ARR (Annual Recurring Revenue), MRR (Monthly Recurring Revenue), churn rate, NPS global, customer lifetime value.'
        },
        {
          id: 'performance-equipe',
          title: 'Performance équipe',
          content: 'Analyse de la performance par membre de l\'équipe : tâches complétées, objectifs atteints, charge de travail, productivité.',
          tip: 'Utilisez ce rapport pour les entretiens individuels et la répartition de charge.'
        }
      ]
    },
    {
      id: 'generation-rapports',
      title: 'Génération de rapports',
      description: 'Créez et exportez vos rapports',
      steps: [
        {
          id: 'periode-analyse',
          title: 'Sélection de période',
          content: 'Choisissez la période d\'analyse : semaine, mois, trimestre, année, ou plage personnalisée. Les données sont calculées pour la période sélectionnée.'
        },
        {
          id: 'export-rapport',
          title: 'Export du rapport',
          content: 'Exportez vos rapports en PDF ou Excel. Le PDF est idéal pour les présentations, Excel pour les analyses complémentaires.',
          tip: 'Planifiez l\'envoi automatique de rapports par email à date régulière.'
        }
      ]
    }
  ]
}
