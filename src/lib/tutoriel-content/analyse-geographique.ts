import { TutorielModule } from '@/types/tutoriel'

export const analyseGeographiqueModule: TutorielModule = {
  id: 'analyse-geographique',
  title: 'Analyse géographique',
  description: 'Visualisez et analysez la répartition géographique de vos établissements',
  icon: 'MapPin',
  category: 'analyses',
  estimatedTime: '10 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'carte-interactive',
      title: 'Carte interactive',
      description: 'Explorez la carte de vos établissements',
      steps: [
        {
          id: 'visualisation-region',
          title: 'Visualisation par région',
          content: 'La carte affiche tous vos établissements positionnés géographiquement. Les marqueurs sont colorés selon le statut (prospect, contractuel, production).'
        },
        {
          id: 'filtres-carte',
          title: 'Filtres multiples',
          content: 'Filtrez les établissements affichés sur la carte par : statut, type, région, CSM responsable, ou plage de volume d\'activité.',
          tip: 'Combinez plusieurs filtres pour des analyses ciblées (ex: tous les groupes en production dans le Nord).'
        }
      ]
    },
    {
      id: 'tableau-donnees',
      title: 'Tableau de données',
      description: 'Analysez les données en format tabulaire',
      steps: [
        {
          id: 'liste-etablissements',
          title: 'Liste des établissements',
          content: 'Le tableau liste tous les établissements avec leurs informations clés : nom, ville, région, statut, type, volume d\'activité, responsable.'
        },
        {
          id: 'metriques-region',
          title: 'Métriques par région',
          content: 'Des agrégats par région sont disponibles : nombre d\'établissements, répartition par statut, potentiel total, progression moyenne.'
        }
      ]
    },
    {
      id: 'statistiques-geo',
      title: 'Statistiques',
      description: 'Analysez les tendances géographiques',
      steps: [
        {
          id: 'repartition-geo',
          title: 'Répartition géographique',
          content: 'Graphiques de répartition des établissements par région et par département. Identifiez les zones de forte présence et les zones blanches.'
        },
        {
          id: 'progression-zone',
          title: 'Progression par zone',
          content: 'Analysez la progression commerciale zone par zone : taux de pénétration, évolution temporelle, comparaison entre régions.',
          tip: 'Les zones à forte progression sont des candidats pour renforcer la présence commerciale.'
        }
      ]
    },
    {
      id: 'export-geo',
      title: 'Export',
      description: 'Exportez vos analyses géographiques',
      steps: [
        {
          id: 'export-csv-filtres',
          title: 'CSV avec filtres',
          content: 'Exportez les données filtrées au format CSV. Les filtres actifs sont appliqués à l\'export, vous permettant d\'obtenir exactement les données souhaitées.'
        }
      ]
    }
  ]
}
