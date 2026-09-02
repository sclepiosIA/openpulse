// Constantes centralisées pour les statuts de tâches
export const TASK_STATUSES = {
  TODO: 'A faire',
  IN_PROGRESS: 'En cours',
  BLOCKED: 'Bloqué',
  DONE: 'Terminé',
} as const;

export type TaskStatus = typeof TASK_STATUSES[keyof typeof TASK_STATUSES];

// Mapping pour l'affichage
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  'A faire': 'À faire',
  'En cours': 'En cours',
  'Bloqué': 'Bloqué',
  'Terminé': 'Terminé',
};

// Couleurs par statut (utilisant les tokens du design system)
export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  'A faire': 'bg-muted text-muted-foreground',
  'En cours': 'bg-primary text-primary-foreground',
  'Bloqué': 'bg-destructive text-destructive-foreground',
  'Terminé': 'bg-success text-success-foreground',
};

// Icônes par statut
export const TASK_STATUS_ICONS: Record<TaskStatus, string> = {
  'A faire': 'Circle',
  'En cours': 'Clock',
  'Bloqué': 'AlertCircle',
  'Terminé': 'CheckCircle',
};

// Priorités
export const TASK_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type TaskPriority = typeof TASK_PRIORITIES[keyof typeof TASK_PRIORITIES];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning text-warning-foreground',
  high: 'bg-destructive text-destructive-foreground',
};
