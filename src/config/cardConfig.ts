/**
 * Configuration du contenu des cartes par phase
 * Définit les informations à afficher selon le contexte (prospect, déploiement, production)
 */

import { Building2, Calendar, DollarSign, Mail, Users, ListTodo, Columns, Eye, Activity, TrendingUp, Clock, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { EstablishmentPhase } from './statusConfig'

// Actions rapides disponibles
export interface QuickAction {
  id: string
  label: string
  shortLabel?: string
  icon: LucideIcon
  getUrl: (etablissementId: string) => string
}

// Métriques à afficher
export interface MetricConfig {
  id: string
  label: string
  icon?: LucideIcon
  format?: 'currency' | 'percent' | 'number' | 'date' | 'months'
}

// Configuration par phase
export interface PhaseCardConfig {
  // Métriques principales à afficher dans le body
  metrics: MetricConfig[]
  // Actions rapides (boutons en bas de carte)
  quickActions: QuickAction[]
  // Afficher l'équipe
  showTeam: boolean
  // Membres de l'équipe à afficher
  teamMembers: ('commercial' | 'chef_projet' | 'csm')[]
  // Afficher les dates clés
  showDates: boolean
  // Dates à afficher
  dates: ('signature' | 'go_live' | 'fin_contrat')[]
  // Afficher les alertes/raisons de santé
  showAlerts: boolean
  // Afficher la barre de progression
  showProgressBar: boolean
}

// Configuration des actions rapides partagées
const QUICK_ACTIONS: Record<string, QuickAction> = {
  details: {
    id: 'details',
    label: 'Voir détails',
    shortLabel: 'Détails',
    icon: Eye,
    getUrl: (id) => `/etablissements/${id}`
  },
  taches: {
    id: 'taches',
    label: 'Voir tâches',
    shortLabel: 'Tâches',
    icon: ListTodo,
    getUrl: (id) => `/etablissements/${id}?tab=taches`
  },
  kanban: {
    id: 'kanban',
    label: 'Voir kanban',
    shortLabel: 'Kanban',
    icon: Columns,
    getUrl: (id) => `/etablissements/${id}?tab=kanban`
  },
  emails: {
    id: 'emails',
    label: 'Voir emails',
    shortLabel: 'Emails',
    icon: Mail,
    getUrl: (id) => `/emails?etablissement=${id}`
  },
  health: {
    id: 'health',
    label: 'Tableau de bord santé',
    shortLabel: 'Santé',
    icon: Activity,
    getUrl: (id) => `/etablissements/${id}?tab=health-dashboard`
  }
}

// Configuration par phase
export const CARD_CONFIG: Record<EstablishmentPhase, PhaseCardConfig> = {
  prospect: {
    metrics: [
      { id: 'valeur_potentielle', label: 'CA potentiel', icon: DollarSign, format: 'currency' },
      { id: 'progression', label: 'Progression', icon: TrendingUp, format: 'percent' }
    ],
    quickActions: [
      QUICK_ACTIONS.taches,
      QUICK_ACTIONS.emails
    ],
    showTeam: true,
    teamMembers: ['commercial'],
    showDates: true,
    dates: ['signature'],
    showAlerts: false,
    showProgressBar: true
  },
  deploiement: {
    metrics: [
      { id: 'progression', label: 'Progression', icon: TrendingUp, format: 'percent' }
    ],
    quickActions: [
      QUICK_ACTIONS.details,
      QUICK_ACTIONS.taches,
      QUICK_ACTIONS.kanban
    ],
    showTeam: true,
    teamMembers: ['chef_projet', 'csm'],
    showDates: true,
    dates: ['signature', 'fin_contrat'],
    showAlerts: true,
    showProgressBar: true
  },
  production: {
    metrics: [
      { id: 'months_in_production', label: 'En production', icon: Clock, format: 'months' },
      { id: 'revenue', label: 'CA annuel', icon: DollarSign, format: 'currency' },
      { id: 'adoption_rate', label: 'Adoption', icon: Activity, format: 'percent' },
      { id: 'nps_score', label: 'NPS', icon: TrendingUp, format: 'number' }
    ],
    quickActions: [
      QUICK_ACTIONS.details,
      QUICK_ACTIONS.health
    ],
    showTeam: true,
    teamMembers: ['csm'],
    showDates: true,
    dates: ['go_live', 'fin_contrat'],
    showAlerts: true,
    showProgressBar: false
  }
}

/**
 * Récupère la configuration de carte pour une phase
 */
export function getCardConfig(phase: EstablishmentPhase): PhaseCardConfig {
  return CARD_CONFIG[phase]
}

/**
 * Récupère les actions rapides pour une phase
 */
export function getQuickActions(phase: EstablishmentPhase): QuickAction[] {
  return CARD_CONFIG[phase].quickActions
}
