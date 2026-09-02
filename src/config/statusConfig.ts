/**
 * Configuration centralisée des statuts d'établissements
 * Utilisé pour assurer la cohérence des couleurs et styles sur toutes les pages
 */

// Types de phases
export type EstablishmentPhase = 'prospect' | 'deploiement' | 'production'

// Statuts par phase
export const PHASE_STATUTS = {
  prospect: [
    'Prospect',
    'Attente RDV',
    'RDV pris',
    'Dans les RDV',
    'Attente post RDV',
    'Etude émise',
    'Négociation',
    'Bloqué',
    'Autre compte / GHT'
  ],
  deploiement: [
    'Contractuel',
    'Contractualisation',
    'Vendu',
    'Conformité',
    'Déploiement',
    'Formation',
    'Go-Live'
  ],
  production: ['Production']
} as const

// Couleurs de statut pour les badges
export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive'

interface StatusStyle {
  badgeVariant: BadgeVariant
  borderColor: string
  bgColor: string
  textColor: string
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  // Production / Go-Live
  'Production': { badgeVariant: 'default', borderColor: 'border-l-success', bgColor: 'bg-success/10', textColor: 'text-success' },
  'Go-Live': { badgeVariant: 'default', borderColor: 'border-l-success', bgColor: 'bg-success/10', textColor: 'text-success' },
  
  // Déploiement
  'Déploiement': { badgeVariant: 'secondary', borderColor: 'border-l-primary', bgColor: 'bg-primary/10', textColor: 'text-primary' },
  'Formation': { badgeVariant: 'secondary', borderColor: 'border-l-primary', bgColor: 'bg-primary/10', textColor: 'text-primary' },
  'Contractuel': { badgeVariant: 'secondary', borderColor: 'border-l-chart-3', bgColor: 'bg-chart-3/10', textColor: 'text-chart-3' },
  'Contractualisation': { badgeVariant: 'secondary', borderColor: 'border-l-chart-3', bgColor: 'bg-chart-3/10', textColor: 'text-chart-3' },
  'Vendu': { badgeVariant: 'secondary', borderColor: 'border-l-chart-3', bgColor: 'bg-chart-3/10', textColor: 'text-chart-3' },
  'Conformité': { badgeVariant: 'secondary', borderColor: 'border-l-chart-4', bgColor: 'bg-chart-4/10', textColor: 'text-chart-4' },
  
  // Commercial
  'Négociation': { badgeVariant: 'outline', borderColor: 'border-l-warning', bgColor: 'bg-warning/10', textColor: 'text-warning' },
  'Etude émise': { badgeVariant: 'outline', borderColor: 'border-l-chart-1', bgColor: 'bg-chart-1/10', textColor: 'text-chart-1' },
  'Attente post RDV': { badgeVariant: 'outline', borderColor: 'border-l-chart-2', bgColor: 'bg-chart-2/10', textColor: 'text-chart-2' },
  'Dans les RDV': { badgeVariant: 'outline', borderColor: 'border-l-chart-2', bgColor: 'bg-chart-2/10', textColor: 'text-chart-2' },
  'RDV pris': { badgeVariant: 'outline', borderColor: 'border-l-chart-2', bgColor: 'bg-chart-2/10', textColor: 'text-chart-2' },
  'Attente RDV': { badgeVariant: 'outline', borderColor: 'border-l-muted', bgColor: 'bg-muted/50', textColor: 'text-muted-foreground' },
  'Prospect': { badgeVariant: 'outline', borderColor: 'border-l-muted-foreground', bgColor: 'bg-muted/50', textColor: 'text-muted-foreground' },
  
  // Bloqué
  'Bloqué': { badgeVariant: 'destructive', borderColor: 'border-l-destructive', bgColor: 'bg-destructive/10', textColor: 'text-destructive' },

  // Autre compte / GHT (rattachement à un compte parent ou groupement)
  'Autre compte / GHT': { badgeVariant: 'outline', borderColor: 'border-l-chart-5', bgColor: 'bg-chart-5/10', textColor: 'text-chart-5' },
}

const DEFAULT_STYLE: StatusStyle = {
  badgeVariant: 'outline',
  borderColor: 'border-l-muted',
  bgColor: 'bg-muted/50',
  textColor: 'text-muted-foreground'
}

/**
 * Récupère le style complet pour un statut
 */
export function getStatusStyle(statut: string): StatusStyle {
  return STATUS_STYLES[statut] || DEFAULT_STYLE
}

/**
 * Récupère la variante de badge pour un statut
 */
export function getStatusBadgeVariant(statut: string): BadgeVariant {
  return getStatusStyle(statut).badgeVariant
}

/**
 * Récupère la couleur de bordure pour un statut
 */
export function getStatusBorderColor(statut: string): string {
  return getStatusStyle(statut).borderColor
}

/**
 * Récupère la couleur de fond pour un statut
 */
export function getStatusBgColor(statut: string): string {
  return getStatusStyle(statut).bgColor
}

/**
 * Récupère la couleur de texte pour un statut
 */
export function getStatusTextColor(statut: string): string {
  return getStatusStyle(statut).textColor
}

/**
 * Détermine la phase d'un établissement en fonction de son statut
 */
export function getPhaseFromStatus(statut: string): EstablishmentPhase {
  if (PHASE_STATUTS.production.includes(statut as any)) return 'production'
  if (PHASE_STATUTS.deploiement.includes(statut as any)) return 'deploiement'
  return 'prospect'
}

// Couleurs de santé (health)
export const HEALTH_COLORS = {
  healthy: { bg: 'bg-success', text: 'text-success', border: 'border-success' },
  'at-risk': { bg: 'bg-warning', text: 'text-warning', border: 'border-warning' },
  'churn-risk': { bg: 'bg-destructive', text: 'text-destructive', border: 'border-destructive' },
  onboarding: { bg: 'bg-primary', text: 'text-primary', border: 'border-primary' },
  delayed: { bg: 'bg-warning', text: 'text-warning', border: 'border-warning' },
  blocked: { bg: 'bg-destructive', text: 'text-destructive', border: 'border-destructive' },
  'on-track': { bg: 'bg-success', text: 'text-success', border: 'border-success' },
} as const

export type HealthStatus = keyof typeof HEALTH_COLORS

/**
 * Récupère les couleurs de santé
 */
export function getHealthColors(status: HealthStatus) {
  return HEALTH_COLORS[status] || HEALTH_COLORS.healthy
}
