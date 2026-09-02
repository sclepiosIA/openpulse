// Mapping centralisé des couleurs par rôle
// Utilisé pour le Gantt, les cartes d'équipe, etc.

export const ROLE_COLORS = {
  admin: { bg: 'bg-red-500', border: 'border-red-500', hex: '#ef4444', text: 'text-red-500' },
  direction: { bg: 'bg-amber-600', border: 'border-amber-600', hex: '#d97706', text: 'text-amber-600' },
  copil: { bg: 'bg-teal-500', border: 'border-teal-500', hex: '#14b8a6', text: 'text-teal-500' },
  commercial: { bg: 'bg-blue-500', border: 'border-blue-500', hex: '#3b82f6', text: 'text-blue-500' },
  chef_projet: { bg: 'bg-green-500', border: 'border-green-500', hex: '#22c55e', text: 'text-green-500' },
  csm: { bg: 'bg-purple-500', border: 'border-purple-500', hex: '#a855f7', text: 'text-purple-500' },
  rh: { bg: 'bg-orange-500', border: 'border-orange-500', hex: '#f97316', text: 'text-orange-500' },
  manager: { bg: 'bg-indigo-500', border: 'border-indigo-500', hex: '#6366f1', text: 'text-indigo-500' },
} as const

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  direction: 'Direction',
  copil: 'Copil',
  commercial: 'Commercial',
  chef_projet: 'Chef de projet',
  csm: 'CSM',
  rh: 'RH',
  manager: 'Manager',
}

export type RoleKey = keyof typeof ROLE_COLORS

const DEFAULT_COLOR = { bg: 'bg-muted', border: 'border-muted-foreground/30', hex: '#9ca3af', text: 'text-muted-foreground' }

export function getRoleColor(role?: string | null) {
  if (!role) return DEFAULT_COLOR
  return ROLE_COLORS[role as RoleKey] || DEFAULT_COLOR
}

export function getRoleLabel(role?: string | null): string {
  if (!role) return 'Non assigné'
  return ROLE_LABELS[role] || role
}

// Pour la légende du Gantt - retourne les rôles actifs
export function getActiveRoles() {
  return Object.entries(ROLE_COLORS).map(([key, colors]) => ({
    key,
    label: ROLE_LABELS[key] || key,
    ...colors
  }))
}
