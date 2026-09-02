export interface TutorielStep {
  id: string
  title: string
  content: string
  // Contenu enrichi
  detailedContent?: string    // Explication approfondie en Markdown
  example?: string            // Exemple concret chiffré
  relatedLinks?: { label: string; href: string }[]  // Liens connexes
  // Champs existants
  tip?: string
  warning?: string
  screenshot?: string
  screenshotAlt?: string
}

export interface TutorielSection {
  id: string
  title: string
  description: string
  steps: TutorielStep[]
  videoUrl?: string
  videoTitle?: string
  screenshot?: string
  screenshotAlt?: string
}

export interface TutorielModule {
  id: string
  title: string
  description: string
  icon: string
  category: 'debutant' | 'principal' | 'crm' | 'operations' | 'finance' | 'formation' | 'analyses' | 'administration'
  sections: TutorielSection[]
  estimatedTime: string
  level: 'debutant' | 'intermediaire' | 'avance'
}

export interface TutorielCategory {
  id: string
  label: string
  description: string
  modules: string[]
}

export const TUTORIEL_CATEGORIES: TutorielCategory[] = [
  {
    id: 'debutant',
    label: 'Prise en main',
    description: 'Configurer votre instance, puis vos premiers pas',
    modules: ['premier-demarrage', 'prise-en-main']
  },
  {
    id: 'principal',
    label: 'Fonctions principales',
    description: 'Tableau de bord, calendrier, courriels, visioconférence et assistant',
    modules: ['dashboard', 'calendrier', 'emails', 'visio', 'jarvis']
  },
  {
    id: 'crm',
    label: 'CRM & Relation client',
    description: 'Gestion des établissements, groupes et partenaires',
    modules: ['crm', 'groupes-partenaires']
  },
  {
    id: 'operations',
    label: 'Opérations',
    description: 'Déploiement, production, projets, Gantt et R&D',
    modules: ['deploiement', 'production', 'projets', 'gantt', 'rd-agile', 'support', 'contrats']
  },
  {
    id: 'finance',
    label: 'Finance & RH',
    description: 'Trésorerie, facturation, RH et recrutement',
    modules: ['tresorerie', 'facturation', 'rh', 'recrutement']
  },
  {
    id: 'analyses',
    label: 'Analyses',
    description: 'Rapports et analyse géographique',
    modules: ['rapports', 'analyse-geographique']
  },
  {
    id: 'administration',
    label: 'Administration',
    description: 'Configuration de l\'instance et documents',
    modules: ['administration', 'documents']
  }
]
