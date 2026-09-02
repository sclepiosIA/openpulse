// Configuration centralisée des labels d'onglets pour le fil d'Ariane

export const TAB_LABELS = {
  people: {
    pageLabel: "Ressources Humaines",
    tabs: {
      analyses: "Analyses RH",
      equipe: "Équipe",
      salaires: "Salaires",
      planning: "Planning",
      conges: "Congés",
      fiches: "Dossiers RH",
      temps: "Temps de travail"
    },
    subViews: {
      cards: "Vue Cartes",
      table: "Vue Tableau",
      calendar: "Vue Calendrier"
    }
  },
  tresorerie: {
    pageLabel: "Trésorerie",
    tabs: {
      dashboard: "Dashboard",
      revenus: "Revenus",
      depenses: "Dépenses",
      previsions: "Prévisions",
      journal: "Journal",
      factures: "Factures",
      admin: "Administration"
    },
    previsionnelSubTabs: {
      resume: "Résumé",
      jour: "Trésorerie jour",
      previsionnel: "Trésorerie prévisionnelle"
    },
    
  },
  emails: {
    pageLabel: "Emails",
    tabs: {
      inbox: "Boîte de réception",
      classification: "Classification",
      etablissements: "Par établissement",
      drafts: "Brouillons",
      settings: "Paramètres"
    }
  },
  etablissementDetail: {
    pageLabel: "Établissement",
    categories: {
      informations: "Informations",
      contacts: "Contacts",
      communication: "Communication",
      facturation: "Facturation",
      gestion: "Gestion",
      documents: "Documents",
      customer_success: "Customer Success",
      statistiques: "Statistiques",
      equipe: "Équipe"
    },
    tabs: {
      infos: "Infos",
      contacts: "Contacts",
      equipe: "Équipe",
      taches: "Tâches",
      kanban: "Kanban",
      agenda: "Agenda",
      gantt: "Gantt",
      documents: "Documents",
      
      emails: "Emails",
      interactions: "Interactions",
      'activite-unifiee': "Activité unifiée",
      'synthese-ia': "Synthèse IA",
      facturation: "Facturation",
      'health-dashboard': "Santé Client",
      activities: "Historique",
      'stats-utilisation': "Utilisation",
      'stats-urgences': "Urgences",
      'csm-playbooks': "Playbooks"
    }
  }
} as const

export type TabLabelsConfig = typeof TAB_LABELS
