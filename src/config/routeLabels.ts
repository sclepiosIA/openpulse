/**
 * Mapping des routes vers leurs labels lisibles
 * Pour les routes dynamiques, le label sera résolu par le composant GlobalBreadcrumb
 */

export const routeLabels: Record<string, string> = {
  // Routes principales
  '/': 'Tableau de bord',
  '/dashboard': 'Tableau de bord',
  '/pulse': 'Pulse',
  '/activite': "Fil d'activité",

  // Emails
  '/emails': 'Emails',
  '/email-templates': "Modèles d'emails",
  '/email-analytics': 'Analyses emails',
  '/email-classification-analytics': 'Classification emails',
  '/gestion-email-domains': 'Domaines emails',
  '/marketing/calendrier-editorial': 'Calendrier éditorial',
  '/marketing/statistiques': 'Statistiques marketing',

  // Établissements & Entités
  '/prospects': 'Prospects',
  '/prospects/scoring': 'Scoring prospects',
  '/apporteurs-affaires': "Apporteurs d'Affaires",
  '/etablissements': 'Établissements',
  '/groupes': 'Groupes',
  '/partenaires': 'Partenaires',

  // Gestion de projet
  '/deploiement': 'Déploiement',
  '/production': 'Production',
  '/projets': 'Projets',
  '/rd': 'R&D',
  '/calendrier': 'Calendrier',
  '/gantt': 'Gantt',

  // RH & People
  '/people': 'People',
  '/equipe': 'Équipe',
  '/rh': 'RH',

  // Analyses
  '/rapports': 'Rapports',
  '/analyse-geographique': 'Analyse géographique',
  '/attribution': 'Attribution',

  '/utilisateurs': 'Utilisateurs',
  '/forum-moderation': 'Modération forum',

  // Téléphonie
  '/appels': 'Appels',

  // Live Chat
  '/live-chat': 'Chat client',

  // Trésorerie
  '/finances': 'Finances',
  '/tresorerie': 'Trésorerie',
  '/facturation': 'Facturation',
  '/contrats': 'Contrats',
  '/catalogue-produits': 'Catalogue produits',

  // Documents
  '/documents': 'Documents',
  '/tutoriels': 'Tutoriels',
  '/formulaires': 'Formulaires',

  // Administration
  '/parametres': 'Paramètres',
  '/profil': 'Profil',
  '/gestion-utilisateurs': 'Utilisateurs',
  '/configuration-systeme': 'Configuration',
  '/gestion-base-donnees': 'Base de données',
  '/gestion-securite': 'Sécurité',
  '/logs-systeme': 'Logs',
  '/parametres/templates-taches': 'Templates de tâches',
  '/gestion-notifications': 'Notifications',

  // DPO / RGPD
  '/dpo-exemple': 'Données patients — établissement exemple',

  // Routes système
  '/__health': 'Santé système',
  '/__safe': 'Mode sécurisé',

  // Apps mobiles
  '/m/install': 'Apps mobiles',
  '/m/mail': 'Mail',
  '/m/todos': 'Todos',
  '/m/pulse': 'Pulse',
  '/m/calendrier': 'Calendrier',
}

/**
 * Récupère le label d'une route
 * Pour les routes dynamiques avec paramètres, retourne un label générique
 */
export function getRouteLabel(path: string): string {
  // Vérifier d'abord si c'est une route exacte
  if (routeLabels[path]) {
    return routeLabels[path]
  }

  // Gérer les routes dynamiques
  if (path.startsWith('/etablissements/')) {
    return 'Détail établissement'
  }

  if (path.startsWith('/groupes/')) {
    return 'Détail groupe'
  }

  if (path.startsWith('/partenaires/')) {
    return 'Détail partenaire'
  }

  if (path.startsWith('/forum/post/')) {
    return 'Post forum'
  }

  if (path.startsWith('/contrats/builder/')) {
    return 'Contract Builder'
  }

  if (path.startsWith('/contrats/')) {
    return 'Détail contrat'
  }

  // Valeur par défaut
  return 'Page'
}
