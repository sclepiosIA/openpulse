// Registre des modules du shell Gestion Desktop.
// Chaque module déclare son libellé sidebar, son icône et — s'il existe —
// le chemin correspondant dans Gestion web (« ouvrir dans Gestion web »).

export type AppId =
  | 'drive'
  | 'pulse'
  | 'mail'
  | 'todo'
  | 'calendar'
  | 'documents'
  | 'preferences'
  | 'notifications'

export interface AppDefinition {
  id: AppId
  label: string
  icon: string
  /** Chemin du module dans Gestion web (null si module purement desktop). */
  webPath: string | null
  description: string
}

export const APP_DEFINITIONS: AppDefinition[] = [
  {
    id: 'drive',
    label: 'Drive',
    icon: '📁',
    webPath: null,
    description: 'Synchronisation documentaire locale des espaces Gestion.',
  },
  {
    id: 'pulse',
    label: 'Pulse',
    icon: '💬',
    webPath: '/pulse',
    description: "Conversations d'équipe et messagerie instantanée Gestion.",
  },
  {
    id: 'mail',
    label: 'Mail',
    icon: '✉️',
    webPath: '/emails',
    description: 'Boîte mail professionnelle connectée à Gestion.',
  },
  {
    id: 'todo',
    label: 'Todo',
    icon: '✅',
    webPath: '/todos',
    description: 'Tâches, rappels et listes partagées.',
  },
  {
    id: 'calendar',
    label: 'Calendrier',
    icon: '📅',
    webPath: '/calendrier',
    description: 'Agenda, rendez-vous et visioconférences.',
  },
  {
    id: 'documents',
    label: 'Documents IA',
    icon: '✨',
    webPath: '/documents',
    description: 'Documents, résumés et génération assistée par IA.',
  },
]

/** Entrée épinglée en bas de la sidebar (hors liste des modules). */
export const PREFERENCES_APP: AppDefinition = {
  id: 'preferences',
  label: 'Préférences',
  icon: '⚙️',
  webPath: null,
  description: 'Réglages de Gestion Desktop : compte, notifications, démarrage.',
}

/** Centre de notifications accessible via le panneau natif (menu/tray). */
export const NOTIFICATIONS_APP: AppDefinition = {
  id: 'notifications',
  label: 'Notifications',
  icon: '🔔',
  webPath: null,
  description: 'Historique des notifications de Gestion Desktop (Pulse, Mail, Todo, Drive).',
}

export function getAppDefinition(id: AppId): AppDefinition {
  if (id === PREFERENCES_APP.id) return PREFERENCES_APP
  if (id === NOTIFICATIONS_APP.id) return NOTIFICATIONS_APP
  const def = APP_DEFINITIONS.find((a) => a.id === id)
  if (!def) throw new Error(`Module inconnu : ${id}`)
  return def
}

/**
 * Modules natifs affichables dans le panneau du shell PWA plein écran
 * (pas de sidebar : Drive/Préférences/Notifications vivent dans un tiroir
 * au-dessus de la PWA).
 */
export const PANEL_APP_IDS = ['drive', 'preferences', 'notifications'] as const
export type PanelAppId = (typeof PANEL_APP_IDS)[number]

/**
 * Valide un payload de navigation reçu du shell natif (menu tray).
 * Retourne l'id du module panneau ou null si inconnu (payload non fiable).
 */
export function resolveNavigateTarget(payload: unknown): PanelAppId | null {
  return typeof payload === 'string' && (PANEL_APP_IDS as readonly string[]).includes(payload)
    ? (payload as PanelAppId)
    : null
}
