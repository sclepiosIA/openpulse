import { TutorielModule } from '@/types/tutoriel'

export const calendrierModule: TutorielModule = {
  id: 'calendrier',
  title: 'Calendrier',
  description: 'Planifiez et visualisez vos tâches dans le temps',
  icon: 'Calendar',
  category: 'principal',
  estimatedTime: '10 min',
  level: 'debutant',
  sections: [
    {
      id: 'vues-calendrier',
      title: 'Vues disponibles',
      description: 'Choisissez la vue adaptée à votre besoin',
      steps: [
        {
          id: 'vue-jour',
          title: 'Vue Jour',
          content: 'Affiche toutes les tâches et événements d\'une journée avec les créneaux horaires. Idéale pour la planification quotidienne détaillée.'
        },
        {
          id: 'vue-semaine',
          title: 'Vue Semaine',
          content: 'Vue sur 7 jours avec colonnes par jour. Parfaite pour planifier votre semaine de travail.'
        },
        {
          id: 'vue-mois',
          title: 'Vue Mois',
          content: 'Grille mensuelle montrant tous les événements du mois. Vue d\'ensemble pour la planification à moyen terme.',
          tip: 'Utilisez la vue mois pour repérer les périodes chargées et anticiper.'
        },
        {
          id: 'vue-agenda',
          title: 'Vue Agenda (liste)',
          content: 'Liste chronologique de tous les événements à venir. Pratique pour un aperçu rapide des prochaines échéances.'
        }
      ]
    },
    {
      id: 'gestion-taches-calendrier',
      title: 'Gestion des tâches',
      description: 'Créez et modifiez vos tâches depuis le calendrier',
      steps: [
        {
          id: 'creer-depuis-calendrier',
          title: 'Créer depuis le calendrier',
          content: 'Cliquez sur une date ou un créneau vide pour créer une nouvelle tâche. La date et l\'heure sont pré-remplies automatiquement.'
        },
        {
          id: 'drag-drop',
          title: 'Drag & drop',
          content: 'Glissez-déposez une tâche pour la déplacer à une autre date ou horaire. Les modifications sont sauvegardées automatiquement.',
          tip: 'Le drag & drop fonctionne dans toutes les vues sauf la vue Mois.'
        },
        {
          id: 'redimensionnement',
          title: 'Redimensionnement',
          content: 'Tirez sur le bord inférieur d\'une tâche pour modifier sa durée. Utile pour ajuster les estimations de temps.'
        }
      ]
    },
    {
      id: 'filtres-calendrier',
      title: 'Filtres',
      description: 'Filtrez les événements affichés',
      steps: [
        {
          id: 'filtre-etablissement',
          title: 'Par établissement',
          content: 'Affichez uniquement les tâches liées à un établissement spécifique pour vous concentrer sur un projet.'
        },
        {
          id: 'filtre-responsable',
          title: 'Par responsable',
          content: 'Visualisez les tâches d\'un membre spécifique de l\'équipe. Utile pour les réunions de suivi individuel.'
        },
        {
          id: 'filtre-categorie',
          title: 'Par catégorie',
          content: 'Filtrez par type de tâche : Commercial, Déploiement, Support, Formation. Un code couleur distingue chaque catégorie.'
        },
        {
          id: 'filtre-priorite',
          title: 'Par priorité',
          content: 'Affichez uniquement les tâches urgentes ou haute priorité pour vous concentrer sur l\'essentiel.'
        }
      ]
    },
    {
      id: 'export-calendrier',
      title: 'Export',
      description: 'Exportez votre calendrier',
      steps: [
        {
          id: 'export-ics',
          title: 'Export ICS',
          content: 'Exportez les événements au format ICS pour les importer dans votre application de calendrier préférée (Outlook, Google Calendar, Apple Calendar).'
        },
        {
          id: 'sync-externe',
          title: 'Synchronisation externe',
          content: 'Configurez un flux de calendrier pour synchroniser automatiquement vos tâches avec un calendrier externe.',
          tip: 'La synchronisation est unidirectionnelle : de OpenPulse vers votre calendrier externe.'
        }
      ]
    }
  ]
}
