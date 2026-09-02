// Utilitaires centralisés pour la page Projets

import type { TaskForExport } from '@/types/taches-export';

export const TASK_STATUSES = ['A faire', 'En cours', 'Bloqué', 'Terminé'] as const
export const TASK_PRIORITIES = ['high', 'medium', 'low'] as const

export const STATUS_LABELS_FR: Record<string, string> = {
  'A faire': 'À faire',
  'En cours': 'En cours',
  'Bloqué': 'Bloqué',
  'Terminé': 'Terminé'
}

export const PRIORITY_LABELS_FR: Record<string, string> = {
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse'
}

export const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-warning/10 text-warning border-warning/30',
  low: 'bg-success/10 text-success border-success/30'
}

export const STATUS_COLORS: Record<string, string> = {
  'A faire': 'bg-muted text-muted-foreground',
  'En cours': 'bg-primary/10 text-primary',
  'Bloqué': 'bg-destructive/10 text-destructive',
  'Terminé': 'bg-success/10 text-success'
}

export function getStatusLabelFr(status: string): string {
  return STATUS_LABELS_FR[status] || status
}

export function getPriorityLabelFr(priority: string): string {
  return PRIORITY_LABELS_FR[priority] || priority
}

export function formatDateFr(date: string | Date | null | undefined): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export function isOverdue(echeance: string | null | undefined, statut: string): boolean {
  if (!echeance || statut === 'Terminé') return false
  return new Date(echeance) < new Date()
}

export function getDaysUntilDue(echeance: string | null | undefined): number | null {
  if (!echeance) return null
  const now = new Date()
  const due = new Date(echeance)
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function exportTasksToCSV(tasks: TaskForExport[], filename: string = 'taches'): void {
  const headers = [
    'Titre',
    'Établissement',
    'Catégorie',
    'Statut',
    'Priorité',
    'Responsable',
    'Date début',
    'Échéance',
    'Description'
  ]

  const rows = tasks.map(task => [
    task.titre || '',
    task.etablissements?.nom || '',
    task.categories_taches?.nom || '',
    getStatusLabelFr(task.statut),
    getPriorityLabelFr(task.priorite || ''),
    task.responsable_profile 
      ? `${task.responsable_profile.prenom || ''} ${task.responsable_profile.nom || ''}`.trim()
      : '',
    formatDateFr(task.date_debut),
    formatDateFr(task.echeance),
    (task.description || '').replace(/"/g, '""')
  ])

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

export function getEtablissementColor(etablissementId: string, etablissementNom: string): string {
  if (!etablissementId || !etablissementNom) {
    return 'hsl(var(--primary))'
  }
  
  const hash = etablissementId.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)
  
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 45%)`
}
