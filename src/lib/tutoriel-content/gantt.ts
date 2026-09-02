import { TutorielModule } from '@/types/tutoriel'

export const ganttModule: TutorielModule = {
  id: 'gantt',
  title: 'Gantt Global',
  description: 'Visualisez et gérez les tâches de tous vos projets sur un diagramme de Gantt',
  icon: 'ChartGantt',
  category: 'operations',
  estimatedTime: '15 min',
  level: 'avance',
  sections: [
    {
      id: 'vue-globale',
      title: 'Vue globale',
      description: 'Visualisez tous les projets simultanément',
      steps: [
        {
          id: 'multi-etablissements',
          title: 'Multi-établissements',
          content: 'Le Gantt global affiche les tâches de tous les établissements sur un même diagramme. Chaque établissement est représenté par une ligne ou un groupe de lignes.'
        },
        {
          id: 'groupement-dynamique',
          title: 'Groupement dynamique',
          content: 'Choisissez le mode de groupement : par Établissement (défaut), par Catégorie de tâche, par Responsable, ou par Statut. Le groupement réorganise visuellement les tâches.',
          tip: 'Le groupement par Responsable est idéal pour les réunions d\'équipe.'
        }
      ]
    },
    {
      id: 'navigation-gantt',
      title: 'Navigation',
      description: 'Naviguez efficacement dans le diagramme',
      steps: [
        {
          id: 'zoom',
          title: 'Zoom (jour/semaine/mois)',
          content: 'Utilisez les boutons de zoom pour ajuster l\'échelle temporelle : Jour (détail maximal), Semaine (vue standard), Mois (vue d\'ensemble).'
        },
        {
          id: 'defilement',
          title: 'Défilement horizontal',
          content: 'Faites défiler horizontalement pour naviguer dans le temps. Utilisez la molette de la souris avec Shift enfoncé, ou glissez sur un écran tactile.'
        }
      ]
    },
    {
      id: 'interactions-gantt',
      title: 'Interactions',
      description: 'Modifiez les tâches directement sur le Gantt',
      steps: [
        {
          id: 'drag-drop-gantt',
          title: 'Drag & drop',
          content: 'Glissez-déposez une barre de tâche pour modifier sa date de début. La tâche conserve sa durée.'
        },
        {
          id: 'redimensionnement-gantt',
          title: 'Redimensionnement',
          content: 'Tirez sur le bord droit d\'une barre pour modifier l\'échéance (durée de la tâche). La date de début reste fixe.',
          warning: 'Le redimensionnement nécessite une précision au pixel. Zoomez si nécessaire.'
        },
        {
          id: 'creation-rapide',
          title: 'Création rapide',
          content: 'Double-cliquez sur une ligne vide pour créer une nouvelle tâche à cette date. Le formulaire de création s\'ouvre avec les valeurs pré-remplies.'
        }
      ]
    },
    {
      id: 'visualisation-gantt',
      title: 'Visualisation',
      description: 'Fonctionnalités de visualisation avancées',
      steps: [
        {
          id: 'heatmap',
          title: 'Heatmap de charge',
          content: 'Activez la heatmap pour visualiser la charge de travail par période. Les zones rouges indiquent une surcharge, les zones vertes une charge normale.',
          tip: 'Utilisez la heatmap pour identifier les périodes à risque et redistribuer les tâches.'
        },
        {
          id: 'jalons',
          title: 'Jalons',
          content: 'Les jalons (milestones) sont affichés comme des losanges sur le Gantt. Ils représentent les dates clés : go-live, fin de phase, livraison.'
        },
        {
          id: 'alertes-retards',
          title: 'Alertes retards',
          content: 'Les tâches en retard sont signalées en rouge. Un panneau d\'alertes liste toutes les tâches dépassant leur échéance.'
        }
      ]
    },
    {
      id: 'export-gantt',
      title: 'Export',
      description: 'Exportez votre diagramme Gantt',
      steps: [
        {
          id: 'export-png',
          title: 'Export PNG',
          content: 'Exportez le Gantt comme image PNG pour inclusion dans des présentations ou rapports.'
        },
        {
          id: 'export-pdf',
          title: 'Export PDF',
          content: 'Générez un PDF du Gantt avec en-tête et légende. Idéal pour l\'impression ou l\'archivage.',
          tip: 'L\'export PDF conserve la période actuellement affichée. Ajustez le zoom avant d\'exporter.'
        }
      ]
    }
  ]
}
