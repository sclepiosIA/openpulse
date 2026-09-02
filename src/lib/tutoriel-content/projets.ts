import { TutorielModule } from '@/types/tutoriel'

export const projetsModule: TutorielModule = {
  id: 'projets',
  title: 'Projets & Tâches',
  description: 'Gérez les tâches et projets de toute l\'équipe',
  icon: 'Boxes',
  category: 'operations',
  estimatedTime: '15 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'liste-taches',
      title: 'Liste des tâches',
      description: 'Créez et gérez vos tâches quotidiennes',
      steps: [
        {
          id: 'creer-tache',
          title: 'Créer une tâche',
          content: 'Cliquez sur "Nouvelle tâche" pour créer une tâche. Remplissez le titre, la description, sélectionnez l\'établissement concerné, la catégorie et l\'échéance.'
        },
        {
          id: 'assigner-responsable',
          title: 'Assigner un responsable',
          content: 'Chaque tâche doit avoir un responsable. Sélectionnez un membre de l\'équipe dans la liste déroulante.',
          tip: 'Assignez-vous la tâche si vous êtes responsable, ou déléguez à un collègue.'
        },
        {
          id: 'definir-echeance',
          title: 'Définir l\'échéance',
          content: 'L\'échéance définit la date limite de la tâche. Les tâches en retard sont signalées en rouge dans les listes.',
          warning: 'Les tâches sans échéance peuvent être oubliées. Définissez toujours une date réaliste.'
        },
        {
          id: 'priorite-statut',
          title: 'Priorité et statut',
          content: 'La priorité (Basse, Moyenne, Haute, Urgente) indique l\'importance. Le statut (À faire, En cours, En revue, Terminé) suit l\'avancement.'
        }
      ]
    },
    {
      id: 'filtres-tri',
      title: 'Filtres et tri',
      description: 'Trouvez rapidement vos tâches',
      steps: [
        {
          id: 'filtre-etablissement',
          title: 'Par établissement',
          content: 'Filtrez les tâches d\'un établissement spécifique pour vous concentrer sur un projet.'
        },
        {
          id: 'filtre-categorie',
          title: 'Par catégorie',
          content: 'Les catégories (Commercial, Déploiement, Support, Formation) permettent de regrouper les tâches par type d\'activité.'
        },
        {
          id: 'filtre-responsable',
          title: 'Par responsable',
          content: 'Visualisez uniquement vos tâches ou celles d\'un collègue spécifique.',
          tip: 'Utilisez ce filtre pour les réunions d\'équipe et le suivi individuel.'
        },
        {
          id: 'filtre-statut-priorite',
          title: 'Par statut/priorité',
          content: 'Filtrez par statut pour voir les tâches à faire, ou par priorité pour les tâches urgentes.'
        }
      ]
    },
    {
      id: 'analytics-projets',
      title: 'Analytics',
      description: 'Analysez la productivité de l\'équipe',
      steps: [
        {
          id: 'statistiques-globales',
          title: 'Statistiques globales',
          content: 'Les KPIs affichent : total des tâches, tâches complétées cette semaine, tâches en retard, temps moyen de complétion.'
        },
        {
          id: 'taches-retard',
          title: 'Tâches en retard',
          content: 'La liste des tâches dépassant leur échéance. Identifiez les blocages et réassignez si nécessaire.',
          warning: 'Les tâches en retard depuis plus de 7 jours impactent les indicateurs de performance.'
        },
        {
          id: 'productivite-equipe',
          title: 'Productivité équipe',
          content: 'Graphiques de répartition par membre de l\'équipe : tâches assignées vs complétées, charge de travail.'
        }
      ]
    },
    {
      id: 'actions-masse-projets',
      title: 'Actions en masse',
      description: 'Gérez plusieurs tâches simultanément',
      steps: [
        {
          id: 'changer-statut',
          title: 'Changer le statut',
          content: 'Sélectionnez plusieurs tâches et changez leur statut en une action. Pratique après une réunion de revue.'
        },
        {
          id: 'reassigner',
          title: 'Réassigner',
          content: 'Transférez des tâches à un autre membre de l\'équipe en cas d\'absence ou de redistribution de charge.'
        },
        {
          id: 'archiver',
          title: 'Archiver',
          content: 'Archivez les tâches terminées pour nettoyer les listes tout en conservant l\'historique.',
          tip: 'L\'archivage n\'est pas une suppression, les tâches restent consultables.'
        }
      ]
    }
  ]
}
