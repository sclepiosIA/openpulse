import { TutorielModule } from '@/types/tutoriel'

export const crmModule: TutorielModule = {
  id: 'crm',
  title: 'CRM & Établissements',
  description: 'Gérez efficacement vos prospects, clients et leurs informations',
  icon: 'Building2',
  category: 'crm',
  estimatedTime: '25 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'gestion-prospects',
      title: 'Gestion des prospects',
      description: 'Créez et suivez vos prospects commerciaux',
      steps: [
        {
          id: 'creation-prospect',
          title: 'Créer un prospect',
          content: 'Cliquez sur "Nouvel établissement" et remplissez les informations de base : nom, ville, région, type d\'établissement. Le statut par défaut sera "Prospect".',
          tip: 'Ajoutez un logo pour une meilleure identification visuelle dans les listes.'
        },
        {
          id: 'import-masse',
          title: 'Import en masse (Excel)',
          content: 'Pour importer plusieurs prospects simultanément, utilisez la fonction d\'import Excel. Téléchargez le modèle fourni, remplissez-le et importez-le.',
          warning: 'Vérifiez que les colonnes correspondent exactement au modèle pour éviter les erreurs d\'import.'
        },
        {
          id: 'pipeline-commercial',
          title: 'Suivi dans le pipeline',
          content: 'Le pipeline commercial visualise vos prospects par statut : Prospect → RDV pris → Négociation → Contractualisation. Glissez-déposez les cartes pour mettre à jour les statuts.'
        }
      ]
    },
    {
      id: 'fiche-etablissement',
      title: 'Fiche établissement',
      description: 'Exploitez toutes les informations d\'un établissement',
      steps: [
        {
          id: 'informations-generales',
          title: 'Informations générales',
          content: 'La fiche établissement contient les coordonnées, le type d\'établissement, l\'outil métier du client utilisé, les modules proposés, et les informations contractuelles (modèle économique, palliers, dates).'
        },
        {
          id: 'contacts',
          title: 'Contacts et interlocuteurs',
          content: 'Ajoutez les contacts clés de l\'établissement : directeur, DSI, médecin chef, etc. Définissez le contact principal pour faciliter la communication.',
          tip: 'Les contacts sont automatiquement associés aux emails reçus de leurs domaines.'
        },
        {
          id: 'documents',
          title: 'Documents attachés',
          content: 'Attachez les documents importants : contrats, présentations, rapports. Ils sont stockés de manière sécurisée et accessibles par l\'équipe.'
        },
        {
          id: 'qr-code',
          title: 'QR Code d\'accès',
          content: 'Générez un QR code unique pour chaque établissement, permettant aux utilisateurs d\'accéder rapidement à l\'espace formation sans authentification.',
          tip: 'Imprimez le QR code et affichez-le dans l\'établissement pour faciliter l\'émargement.'
        }
      ]
    },
    {
      id: 'taches-suivi',
      title: 'Tâches et suivi',
      description: 'Organisez les actions à réaliser pour chaque établissement',
      steps: [
        {
          id: 'creer-tache',
          title: 'Créer une tâche',
          content: 'Depuis la fiche établissement, créez des tâches avec titre, description, échéance, priorité et catégorie. Assignez-les à un membre de l\'équipe.'
        },
        {
          id: 'modeles-taches',
          title: 'Modèles de tâches',
          content: 'Des modèles de tâches prédéfinis sont générés automatiquement selon la phase de l\'établissement : prospection, déploiement ou production.',
          tip: 'Les tâches sont générées automatiquement lors du changement de statut.'
        },
        {
          id: 'workflow-validation',
          title: 'Workflow de validation',
          content: 'Certaines tâches nécessitent une validation hiérarchique. Le système de workflow gère les approbations et les escalades automatiques.'
        }
      ]
    },
    {
      id: 'vues-disponibles',
      title: 'Vues disponibles',
      description: 'Choisissez la vue adaptée à votre besoin',
      steps: [
        {
          id: 'vue-grille',
          title: 'Vue Grille (cartes)',
          content: 'Affiche les établissements sous forme de cartes avec les informations essentielles. Idéale pour une vue d\'ensemble rapide.'
        },
        {
          id: 'vue-tableau',
          title: 'Vue Tableau',
          content: 'Affichage tabulaire avec tri et filtres avancés. Parfait pour l\'analyse et l\'export de données.'
        },
        {
          id: 'vue-liste',
          title: 'Vue Liste',
          content: 'Liste compacte pour parcourir rapidement un grand nombre d\'établissements.'
        },
        {
          id: 'vue-kanban',
          title: 'Vue Kanban',
          content: 'Colonnes par statut avec drag & drop. Idéale pour le suivi commercial et la gestion de pipeline.'
        },
        {
          id: 'vue-timeline',
          title: 'Vue Timeline',
          content: 'Chronologie des événements et actions par établissement. Visualisez l\'historique des interactions.'
        },
        {
          id: 'vue-gantt',
          title: 'Vue Gantt',
          content: 'Diagramme de Gantt des tâches par établissement. Idéal pour la planification et le suivi des projets.'
        }
      ]
    },
    {
      id: 'filtres-recherche',
      title: 'Filtres et recherche',
      description: 'Trouvez rapidement les établissements recherchés',
      steps: [
        {
          id: 'filtres-rapides',
          title: 'Filtres rapides',
          content: 'Utilisez les filtres rapides en haut de page pour filtrer par statut, région, type d\'établissement ou responsable.'
        },
        {
          id: 'filtres-avances',
          title: 'Filtres avancés',
          content: 'Cliquez sur "Filtres avancés" pour combiner plusieurs critères : plage de dates, modules, outil métier du client, volume d\'activité, etc.'
        },
        {
          id: 'sauvegarde-filtres',
          title: 'Persistance des filtres',
          content: 'Vos filtres sont sauvegardés automatiquement. Vous les retrouverez lors de votre prochaine visite sur la page.',
          tip: 'Utilisez "Réinitialiser" pour effacer tous les filtres.'
        }
      ]
    },
    {
      id: 'actions-masse',
      title: 'Actions en masse',
      description: 'Effectuez des actions sur plusieurs établissements simultanément',
      steps: [
        {
          id: 'selection-multiple',
          title: 'Sélection multiple',
          content: 'Cochez les cases à côté des établissements pour les sélectionner. Une barre d\'actions en masse apparaît.'
        },
        {
          id: 'changement-statut',
          title: 'Changement de statut groupé',
          content: 'Modifiez le statut de plusieurs établissements en une seule action. Utile pour les mises à jour post-réunion commerciale.'
        },
        {
          id: 'export',
          title: 'Export CSV/Excel/PDF',
          content: 'Exportez la sélection au format CSV, Excel ou PDF pour vos rapports et présentations.',
          tip: 'L\'export inclut tous les champs visibles dans la vue actuelle.'
        }
      ]
    }
  ]
}
