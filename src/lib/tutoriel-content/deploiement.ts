import { TutorielModule } from '@/types/tutoriel'

export const deploiementModule: TutorielModule = {
  id: 'deploiement',
  title: 'Déploiement',
  description: 'Suivez le déploiement de vos clients de la signature au Go-Live',
  icon: 'Truck',
  category: 'operations',
  estimatedTime: '15 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'phases-deploiement',
      title: 'Suivi des phases',
      description: 'Comprenez les étapes du déploiement',
      steps: [
        {
          id: 'phases',
          title: 'Les 5 phases de déploiement',
          content: 'Le déploiement suit 5 phases séquentielles : Contractuel (signature effectuée) → Conformité (vérifications techniques) → Déploiement (installation) → Formation (formation utilisateurs) → Go-Live (mise en production).'
        },
        {
          id: 'progression',
          title: 'Indicateurs de progression',
          content: 'Chaque établissement affiche un pourcentage de progression calculé selon le nombre de tâches complétées dans chaque phase. Les KPIs globaux montrent la répartition par phase.',
          tip: 'Les établissements bloqués depuis plus de 30 jours sont signalés par une alerte rouge.'
        }
      ]
    },
    {
      id: 'actions-rapides',
      title: 'Actions rapides',
      description: 'Gérez efficacement vos établissements en déploiement',
      steps: [
        {
          id: 'ajouter-note',
          title: 'Ajouter une note',
          content: 'Cliquez sur le menu "Actions" d\'un établissement et sélectionnez "Ajouter une note" pour documenter les échanges, les blocages ou les décisions importantes.'
        },
        {
          id: 'voir-taches',
          title: 'Voir les tâches',
          content: 'Accédez rapidement aux tâches de déploiement d\'un établissement. Visualisez les tâches complétées, en cours et à venir.'
        },
        {
          id: 'voir-activites',
          title: 'Voir les activités',
          content: 'Consultez l\'historique des activités : emails échangés, tâches complétées, changements de statut, notes ajoutées.'
        }
      ]
    },
    {
      id: 'vues-filtres',
      title: 'Vues et filtres',
      description: 'Visualisez vos déploiements selon vos besoins',
      steps: [
        {
          id: 'vue-liste',
          title: 'Vue Liste',
          content: 'Affichage par défaut avec filtres par statut, CSM, chef de projet. Permet le tri et la sélection multiple.'
        },
        {
          id: 'calendrier-jalons',
          title: 'Calendrier des jalons',
          content: 'Visualisez les dates clés (go-live prévus, formations planifiées) sur un calendrier interactif.',
          tip: 'Cliquez sur une date pour voir tous les événements de ce jour.'
        },
        {
          id: 'diagramme-gantt',
          title: 'Diagramme Gantt',
          content: 'Vue Gantt des phases de déploiement avec possibilité de drag & drop pour ajuster les dates.'
        },
        {
          id: 'timeline',
          title: 'Timeline',
          content: 'Visualisation chronologique de tous les événements de déploiement pour un suivi temporel.'
        }
      ]
    },
    {
      id: 'export-rapports',
      title: 'Export et rapports',
      description: 'Exportez vos données de déploiement',
      steps: [
        {
          id: 'export-csv',
          title: 'Export CSV',
          content: 'Exportez la liste des établissements en déploiement au format CSV avec tous les champs : nom, statut, dates, progression, responsables.',
          tip: 'Appliquez des filtres avant l\'export pour n\'exporter que les données pertinentes.'
        },
        {
          id: 'selection-multiple',
          title: 'Sélection multiple',
          content: 'Sélectionnez plusieurs établissements et utilisez les actions en masse pour : changer de statut, réassigner, ou exporter uniquement la sélection.'
        }
      ]
    }
  ]
}
