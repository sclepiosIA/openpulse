// Deployment utilities - centralized constants and functions

import { PHASE_GROUPS } from '@/config/phases'

// Re-export deployment phases from centralized config
export const DEPLOYMENT_PHASES = PHASE_GROUPS.deploiement.statuts

export type DeploymentPhase = typeof DEPLOYMENT_PHASES[number]

export const HEALTH_OPTIONS = [
  { value: 'healthy', label: '🟢 Dans les temps', color: 'text-success' },
  { value: 'at-risk', label: '🟠 À risque', color: 'text-warning' },
  { value: 'delayed', label: '🔴 En retard', color: 'text-destructive' },
  { value: 'blocked', label: '🚨 Bloqué', color: 'text-destructive' },
] as const

export function getStatutColor(statut: string): string {
  switch (statut) {
    case 'Contractuel': return 'bg-primary/10 text-primary border-primary/20'
    case 'Conformité': return 'bg-warning/10 text-warning border-warning/20'
    case 'Déploiement': return 'bg-secondary/10 text-secondary-foreground border-secondary/20'
    case 'Formation': return 'bg-accent/10 text-accent-foreground border-accent/20'
    case 'Go-Live': return 'bg-success/10 text-success border-success/20'
    default: return 'bg-muted text-muted-foreground border-muted/20'
  }
}

export function getStatutLabel(statut: string): string {
  return statut || 'Non défini'
}

export function getHealthLabel(health: string): string {
  return HEALTH_OPTIONS.find(h => h.value === health)?.label || health
}

export function formatDateFr(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('fr-FR')
}

// Export CSV helper
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string }[],
  filename: string
): void {
  const headers = columns.map(c => c.label).join(';')
  const rows = data.map(item => 
    columns.map(c => {
      const value = item[c.key]
      if (value === null || value === undefined) return ''
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value).replace(/;/g, ',')
    }).join(';')
  )
  
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}
