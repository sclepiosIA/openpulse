import type { Etablissement } from '@/hooks/crm/useEtablissements'
import type { CustomerHealthScore } from '@/hooks/crm/useCustomerHealth'
import { calculateEtablissementValue } from '@/lib/valueCalculations'

// Labels de santé en français
export const HEALTH_LABELS_FR: Record<string, string> = {
  'healthy': 'En bonne santé',
  'at-risk': 'À risque',
  'churn-risk': 'Risque de churn',
  'onboarding': 'Onboarding'
}

// Statuts de production
export const PRODUCTION_STATUSES = ['Production'] as const

// Options de santé pour les filtres
export const HEALTH_OPTIONS = [
  { value: 'healthy', label: 'En bonne santé', icon: '🟢' },
  { value: 'at-risk', label: 'À risque', icon: '🟡' },
  { value: 'churn-risk', label: 'Risque de churn', icon: '🔴' },
  { value: 'onboarding', label: 'Onboarding', icon: '🔵' }
] as const

// Options de durée
export const DURATION_OPTIONS = [
  { value: '0-3', label: '0-3 mois' },
  { value: '3-6', label: '3-6 mois' },
  { value: '6-12', label: '6-12 mois' },
  { value: '12-24', label: '1-2 ans' },
  { value: '24+', label: '2+ ans' }
] as const

// Options d'adoption
export const ADOPTION_OPTIONS = [
  { value: '<50', label: 'Faible (<50%)' },
  { value: '50-75', label: 'Moyenne (50-75%)' },
  { value: '75+', label: 'Élevée (>75%)' }
] as const

// Options NPS
export const NPS_OPTIONS = [
  { value: 'detractors', label: 'Détracteurs (0-6)' },
  { value: 'passives', label: 'Passifs (7-8)' },
  { value: 'promoters', label: 'Promoteurs (9-10)' }
] as const

// Options support
export const SUPPORT_OPTIONS = [
  { value: 'none', label: 'Aucun ticket' },
  { value: 'low', label: '1-3 tickets' },
  { value: 'high', label: '4+ tickets' }
] as const

// Options renouvellement
export const RENEWAL_OPTIONS = [
  { value: '<30', label: 'Sous 30 jours' },
  { value: '30-90', label: '30-90 jours' },
  { value: '90+', label: '+90 jours' },
  { value: 'expired', label: 'Expiré' }
] as const

// Fonction pour obtenir le label de santé en français
export function getHealthLabelFr(status: string): string {
  return HEALTH_LABELS_FR[status] || status
}

// Formatage monétaire
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

// Formatage de date
export function formatDateFr(date: string | Date | undefined): string {
  if (!date) return 'Non renseignée'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Export CSV générique pour Production
interface ProductionHealthMetrics {
  adoption_rate?: number | null
  nps_score?: number | null
  support_tickets_open?: number | null
  contract_end_date?: string | Date | null
}

interface ExportableProduction {
  etablissement: Etablissement
  health?: CustomerHealthScore
  healthMetrics?: ProductionHealthMetrics
}

export function exportProductionToCSV(
  items: ExportableProduction[],
  filename: string = 'production-export'
): void {
  const headers = [
    'Nom',
    'Type',
    'Région',
    'Ville',
    'Santé',
    'Score Santé',
    'CA Annuel',
    'Adoption (%)',
    'NPS',
    'Tickets Support',
    'CSM',
    'Chef de Projet',
    'Date Go-Live',
    'Date Renouvellement'
  ]

  const rows = items.map(({ etablissement, health, healthMetrics }) => {
    const revenue = calculateEtablissementValue(etablissement)
    return [
      etablissement.nom,
      etablissement.type,
      etablissement.region,
      etablissement.ville,
      health ? getHealthLabelFr(health.status) : '',
      health?.score?.toFixed(0) || '',
      revenue > 0 ? revenue.toString() : '',
      healthMetrics?.adoption_rate?.toFixed(0) || '',
      healthMetrics?.nps_score?.toFixed(1) || '',
      healthMetrics?.support_tickets_open?.toString() || '0',
      etablissement.csm ? `${etablissement.csm.prenom} ${etablissement.csm.nom}` : '',
      etablissement.chef_projet ? `${etablissement.chef_projet.prenom} ${etablissement.chef_projet.nom}` : '',
      etablissement.date_go_live ? formatDateFr(etablissement.date_go_live) : '',
      healthMetrics?.contract_end_date ? formatDateFr(healthMetrics.contract_end_date) : ''
    ]
  })

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
  ].join('\n')

  // Ajout BOM pour Excel
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Calcul du nombre de mois en production
export function getMonthsInProduction(goLiveDate: string | Date | undefined): number {
  if (!goLiveDate) return 0
  const date = typeof goLiveDate === 'string' ? new Date(goLiveDate) : goLiveDate
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30)))
}

// Calcul info renouvellement
export function getRenewalInfo(contractEndDate: string | undefined): {
  days: number
  label: string
  alert: boolean
} | null {
  if (!contractEndDate) return null
  
  const daysUntil = Math.floor((new Date(contractEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  
  if (daysUntil < 0) {
    return { days: daysUntil, label: 'Expiré', alert: true }
  } else if (daysUntil <= 30) {
    return { days: daysUntil, label: `Dans ${daysUntil} jours`, alert: true }
  } else if (daysUntil <= 90) {
    return { days: daysUntil, label: `Dans ${Math.round(daysUntil / 30)} mois`, alert: true }
  }
  
  return null
}
