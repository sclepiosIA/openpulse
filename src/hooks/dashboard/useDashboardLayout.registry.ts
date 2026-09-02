import {
  Building2,
  TrendingUp,
  Users,
  Target,
  FileText,
  Calendar,
  ListTodo,
  Mail,
  Wallet,
  Clock,
  Brain,
  AlertTriangle,
  BarChart3,
  Heart,
  GraduationCap,
  Lightbulb,
  Package,
  MessageSquare,
  UserCheck,
  Inbox,
  StickyNote,
  Activity,
  type LucideIcon,
} from 'lucide-react';

// ============= Types =============

export type WidgetId = 
  | 'etablissements_overview'
  | 'pipeline_stats'
  | 'team_activity'
  | 'objectives_progress'
  | 'recent_tasks'
  | 'upcoming_events'
  | 'email_summary'
  | 'treasury_summary'
  | 'pending_actions'
  | 'ai_insights'
  | 'alerts'
  | 'contracts_expiring'
  | 'revenue_chart'
  | 'customer_health'
  | 'suggestions_ai'
  | 'stock_levels'
  | 'support_tickets'
  | 'onboarding_progress'
  | 'notes'
  // Widget IDs used by specialized dashboards
  | 'tasks_panel'
  | 'email_intel'
  | 'agenda_widget'
  | 'pulse_widget'
  | 'email_inbox_widget'
  | 'notes_widget'
  | 'jarvis_assistant'
  // Direction dashboard specific widgets  
  | 'hero_metrics'
  | 'pipeline'
  | 'tresorerie_ai'
  | 'rh_ai'
  | 'activity_feed'
  | 'global_activity_feed'
  | 'prospect_stats'
  | 'blocked_etablissements'
  | 'mrr_dashboard'
  | 'follow_up_relances';

// Widget settings type
export type WidgetSettings = Record<string, unknown>;

export type WidgetSize = 'S' | 'L' | 'small' | 'medium' | 'large' | 'full';

export interface WidgetConfig {
  id: WidgetId;
  visible: boolean;
  enabled?: boolean; // Alias for visible (backward compat)
  order: number;
  size: WidgetSize;
  settings?: Record<string, unknown>;
}

export interface DashboardLayout {
  widgets: WidgetConfig[];
  columns: 1 | 2 | 3 | 4;
  theme?: 'compact' | 'comfortable' | 'spacious';
}

export interface WidgetDefinition {
  id: WidgetId;
  name: string;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultSize: WidgetSize;
  availableSizes: WidgetSize[];
  allowedSizes: WidgetSize[];
  category: 'overview' | 'crm' | 'operations' | 'finance' | 'team' | 'ai';
  minRole?: string;
  configurable?: boolean;
}

// ============= Widget Registry =============

export const WIDGET_REGISTRY: Record<WidgetId, WidgetDefinition> = {
  // Overview
  etablissements_overview: {
    id: 'etablissements_overview',
    name: 'Établissements',
    label: 'Établissements',
    description: 'Vue d\'ensemble des établissements par statut',
    icon: Building2,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'overview',
  },
  pipeline_stats: {
    id: 'pipeline_stats',
    name: 'Pipeline Commercial',
    label: 'Pipeline',
    description: 'Statistiques du pipeline de vente',
    icon: TrendingUp,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'crm',
  },
  team_activity: {
    id: 'team_activity',
    name: 'Activité Équipe',
    label: 'Activité',
    description: 'Dernières activités de l\'équipe',
    icon: Users,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'team',
  },
  objectives_progress: {
    id: 'objectives_progress',
    name: 'Objectifs',
    label: 'Objectifs',
    description: 'Progression vers les objectifs',
    icon: Target,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'overview',
  },
  // Operations
  recent_tasks: {
    id: 'recent_tasks',
    name: 'Tâches Récentes',
    label: 'Tâches',
    description: 'Vos tâches à accomplir',
    icon: ListTodo,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'operations',
  },
  upcoming_events: {
    id: 'upcoming_events',
    name: 'Événements',
    label: 'Événements',
    description: 'Prochains événements du calendrier',
    icon: Calendar,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'operations',
  },
  email_summary: {
    id: 'email_summary',
    name: 'Emails',
    label: 'Emails',
    description: 'Résumé des emails non lus',
    icon: Mail,
    defaultSize: 'S',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'operations',
  },
  pending_actions: {
    id: 'pending_actions',
    name: 'Actions en attente',
    label: 'Actions',
    description: 'Actions nécessitant votre attention',
    icon: Clock,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'operations',
  },
  // Finance
  treasury_summary: {
    id: 'treasury_summary',
    name: 'Trésorerie',
    label: 'Trésorerie',
    description: 'Aperçu de la trésorerie',
    icon: Wallet,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'finance',
  },
  revenue_chart: {
    id: 'revenue_chart',
    name: 'Chiffre d\'affaires',
    label: 'CA',
    description: 'Évolution du CA',
    icon: BarChart3,
    defaultSize: 'L',
    availableSizes: ['L'],
    allowedSizes: ['L'],
    category: 'finance',
  },
  contracts_expiring: {
    id: 'contracts_expiring',
    name: 'Contrats à renouveler',
    label: 'Contrats',
    description: 'Contrats arrivant à échéance',
    icon: FileText,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'finance',
  },
  // CRM
  customer_health: {
    id: 'customer_health',
    name: 'Santé Clients',
    label: 'Santé',
    description: 'Indicateurs de santé client',
    icon: Heart,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'crm',
  },
  support_tickets: {
    id: 'support_tickets',
    name: 'Tickets Support',
    label: 'Support',
    description: 'Tickets en attente',
    icon: MessageSquare,
    defaultSize: 'S',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'crm',
  },
  onboarding_progress: {
    id: 'onboarding_progress',
    name: 'Onboarding',
    label: 'Onboarding',
    description: 'Progression des déploiements',
    icon: UserCheck,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'crm',
  },
  // Team
  stock_levels: {
    id: 'stock_levels',
    name: 'Stocks',
    label: 'Stocks',
    description: 'Niveaux de stock',
    icon: Package,
    defaultSize: 'S',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'operations',
  },
  // AI
  ai_insights: {
    id: 'ai_insights',
    name: 'Insights IA',
    label: 'Insights',
    description: 'Analyses et recommandations IA',
    icon: Brain,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'ai',
  },
  suggestions_ai: {
    id: 'suggestions_ai',
    name: 'Suggestions IA',
    label: 'Suggestions',
    description: 'Actions suggérées par l\'IA',
    icon: Lightbulb,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'ai',
  },
  alerts: {
    id: 'alerts',
    name: 'Alertes',
    label: 'Alertes',
    description: 'Alertes et notifications importantes',
    icon: AlertTriangle,
    defaultSize: 'S',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'overview',
  },
  // Notes
  notes: {
    id: 'notes',
    name: 'Notes',
    label: 'Notes',
    description: 'Vos notes personnelles avec onglets',
    icon: StickyNote,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'overview',
  },
  // Specialized dashboard widgets
  tasks_panel: {
    id: 'tasks_panel',
    name: 'Panel Tâches',
    label: 'Panel Tâches',
    description: 'Panel de gestion des tâches',
    icon: ListTodo,
    defaultSize: 'L',
    availableSizes: ['L'],
    allowedSizes: ['L'],
    category: 'operations',
  },
  email_intel: {
    id: 'email_intel',
    name: 'Intelligence Email',
    label: 'Email Intel',
    description: 'Hub d\'intelligence email',
    icon: Mail,
    defaultSize: 'L',
    availableSizes: ['L'],
    allowedSizes: ['L'],
    category: 'ai',
  },
  agenda_widget: {
    id: 'agenda_widget',
    name: 'Agenda',
    label: 'Agenda',
    description: 'Événements du calendrier',
    icon: Calendar,
    defaultSize: 'S',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'operations',
    configurable: true,
  },
  pulse_widget: {
    id: 'pulse_widget',
    name: 'Pulse',
    label: 'Pulse',
    description: 'Messages Pulse récents',
    icon: MessageSquare,
    defaultSize: 'S',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'team',
    configurable: true,
  },
  email_inbox_widget: {
    id: 'email_inbox_widget',
    name: 'Inbox',
    label: 'Inbox',
    description: 'Derniers emails reçus',
    icon: Inbox,
    defaultSize: 'S',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'operations',
    configurable: true,
  },
  notes_widget: {
    id: 'notes_widget',
    name: 'Notes Widget',
    label: 'Notes',
    description: 'Notes personnelles',
    icon: StickyNote,
    defaultSize: 'S',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'overview',
  },
  jarvis_assistant: {
    id: 'jarvis_assistant',
    name: 'Jarvis Assistant',
    label: 'Jarvis',
    description: 'Assistant IA avec suggestions proactives',
    icon: Brain,
    defaultSize: 'S',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'ai',
    configurable: true,
  },
  // Direction dashboard specific widgets
  hero_metrics: {
    id: 'hero_metrics',
    name: 'Métriques Hero',
    label: 'Métriques',
    description: 'KPIs principaux en bannière',
    icon: TrendingUp,
    defaultSize: 'L',
    availableSizes: ['L'],
    allowedSizes: ['L'],
    category: 'overview',
  },
  pipeline: {
    id: 'pipeline',
    name: 'Pipeline',
    label: 'Pipeline',
    description: 'Vue pipeline commercial',
    icon: TrendingUp,
    defaultSize: 'L',
    availableSizes: ['L'],
    allowedSizes: ['L'],
    category: 'crm',
  },
  tresorerie_ai: {
    id: 'tresorerie_ai',
    name: 'Trésorerie IA',
    label: 'Trésorerie IA',
    description: 'Widget trésorerie avec insights IA',
    icon: Wallet,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'finance',
  },
  rh_ai: {
    id: 'rh_ai',
    name: 'RH IA',
    label: 'RH IA',
    description: 'Widget RH avec insights IA',
    icon: Users,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'team',
  },
  activity_feed: {
    id: 'activity_feed',
    name: 'Fil d\'activité',
    label: 'Activité',
    description: 'Historique des activités récentes',
    icon: Clock,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'overview',
  },
  prospect_stats: {
    id: 'prospect_stats',
    name: 'Stats Prospects',
    label: 'Prospects',
    description: 'Statistiques détaillées des prospects',
    icon: Target,
    defaultSize: 'L',
    availableSizes: ['L'],
    allowedSizes: ['L'],
    category: 'crm',
  },
  blocked_etablissements: {
    id: 'blocked_etablissements',
    name: 'Établissements bloqués',
    label: 'Bloqués',
    description: 'Établissements nécessitant une action',
    icon: AlertTriangle,
    defaultSize: 'L',
    availableSizes: ['L'],
    allowedSizes: ['L'],
    category: 'crm',
  },
  mrr_dashboard: {
    id: 'mrr_dashboard',
    name: 'MRR / ARR',
    label: 'MRR/ARR',
    description: 'Dashboard du revenu mensuel et annuel récurrent',
    icon: TrendingUp,
    defaultSize: 'L',
    availableSizes: ['L'],
    allowedSizes: ['L'],
    category: 'finance',
  },
  follow_up_relances: {
    id: 'follow_up_relances',
    name: 'Relances',
    label: 'Relances',
    description: 'Prospects et comptes à relancer, triés par urgence',
    icon: Clock,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'crm',
  },
  global_activity_feed: {
    id: 'global_activity_feed',
    name: 'Fil d\'activité global',
    label: 'Activité globale',
    description: 'Toutes les actions récentes (interactions, tâches, événements)',
    icon: Activity,
    defaultSize: 'L',
    availableSizes: ['S', 'L'],
    allowedSizes: ['S', 'L'],
    category: 'overview',
  },
};

// ============= Dashboard Templates =============

export interface DashboardTemplate {
  name: string;
  description: string;
  widgets: WidgetId[];
}

export const DASHBOARD_TEMPLATES: Record<string, DashboardTemplate> = {
  compact: {
    name: 'Compact',
    description: 'Vue minimaliste avec les essentiels',
    widgets: ['agenda_widget', 'email_inbox_widget', 'notes_widget'],
  },
  strategic: {
    name: 'Stratégique',
    description: 'Pour la direction et le pilotage',
    widgets: ['pipeline_stats', 'revenue_chart', 'mrr_dashboard', 'customer_health', 'ai_insights', 'follow_up_relances'],
  },
  operational: {
    name: 'Opérationnel',
    description: 'Pour les équipes terrain',
    widgets: ['tasks_panel', 'agenda_widget', 'pulse_widget', 'email_inbox_widget'],
  },
  complete: {
    name: 'Complet',
    description: 'Tous les widgets disponibles',
    widgets: Object.keys(WIDGET_REGISTRY) as WidgetId[],
  },
};

// ============= Default Layouts =============

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'tasks_panel', visible: true, order: 0, size: 'L' },
  { id: 'email_intel', visible: true, order: 1, size: 'L' },
  { id: 'agenda_widget', visible: true, order: 2, size: 'S' },
  { id: 'pulse_widget', visible: true, order: 3, size: 'S' },
  { id: 'email_inbox_widget', visible: true, order: 4, size: 'S' },
  { id: 'notes_widget', visible: true, order: 5, size: 'S' },
];

export const DEFAULT_LAYOUT: DashboardLayout = {
  widgets: DEFAULT_WIDGETS,
  columns: 2,
  theme: 'comfortable',
};

// Layout templates (legacy)
export const LAYOUT_TEMPLATES: Record<string, DashboardLayout> = {
  commercial: {
    widgets: [
      { id: 'pipeline_stats', visible: true, order: 0, size: 'L' },
      { id: 'etablissements_overview', visible: true, order: 1, size: 'L' },
      { id: 'customer_health', visible: true, order: 2, size: 'L' },
      { id: 'objectives_progress', visible: true, order: 3, size: 'L' },
      { id: 'recent_tasks', visible: true, order: 4, size: 'L' },
      { id: 'contracts_expiring', visible: true, order: 5, size: 'L' },
      { id: 'ai_insights', visible: true, order: 6, size: 'L' },
    ],
    columns: 3,
    theme: 'comfortable',
  },
  operations: {
    widgets: [
      { id: 'recent_tasks', visible: true, order: 0, size: 'L' },
      { id: 'upcoming_events', visible: true, order: 1, size: 'L' },
      { id: 'pending_actions', visible: true, order: 2, size: 'L' },
      { id: 'support_tickets', visible: true, order: 3, size: 'L' },
      { id: 'onboarding_progress', visible: true, order: 4, size: 'L' },
      { id: 'email_summary', visible: true, order: 6, size: 'S' },
    ],
    columns: 3,
    theme: 'comfortable',
  },
  finance: {
    widgets: [
      { id: 'treasury_summary', visible: true, order: 0, size: 'L' },
      { id: 'revenue_chart', visible: true, order: 1, size: 'L' },
      { id: 'contracts_expiring', visible: true, order: 2, size: 'L' },
      { id: 'pipeline_stats', visible: true, order: 3, size: 'L' },
      { id: 'objectives_progress', visible: true, order: 4, size: 'L' },
      { id: 'alerts', visible: true, order: 5, size: 'S' },
    ],
    columns: 3,
    theme: 'comfortable',
  },
  minimal: {
    widgets: [
      { id: 'recent_tasks', visible: true, order: 0, size: 'L' },
      { id: 'upcoming_events', visible: true, order: 1, size: 'L' },
      { id: 'alerts', visible: true, order: 2, size: 'S' },
      { id: 'email_summary', visible: true, order: 3, size: 'S' },
    ],
    columns: 2,
    theme: 'compact',
  },
};

// ============= Utility Functions =============

export function getWidgetDefinition(id: WidgetId): WidgetDefinition | undefined {
  return WIDGET_REGISTRY[id];
}

export function getWidgetsByCategory(category: WidgetDefinition['category']): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY).filter(w => w.category === category);
}

/**
 * Normalize widget config to use 'visible' consistently
 */
export function normalizeWidgetConfig(widget: WidgetConfig): WidgetConfig {
  return {
    ...widget,
    visible: widget.visible ?? widget.enabled ?? false,
  };
}

/**
 * Fusionne le registre de widgets avec un layout existant pour s'assurer
 * que tous les widgets du registre sont présents (nouveaux widgets ajoutés
 * après la sauvegarde du layout)
 */
export function mergeRegistryWithLayout(layout: DashboardLayout | null): DashboardLayout {
  if (!layout) return DEFAULT_LAYOUT;

  const normalizedWidgets = layout.widgets.map(normalizeWidgetConfig);
  const existingIds = new Set(normalizedWidgets.map(w => w.id));
  const maxOrder = Math.max(...normalizedWidgets.map(w => w.order), -1);
  
  // Ajouter les widgets manquants du registre
  const registryIds = Object.keys(WIDGET_REGISTRY) as WidgetId[];
  const missingWidgets: WidgetConfig[] = registryIds
    .filter(id => !existingIds.has(id))
    .map((id, index) => ({
      id,
      visible: false, // Nouveaux widgets désactivés par défaut
      order: maxOrder + 1 + index,
      size: WIDGET_REGISTRY[id].defaultSize,
    }));

  // Filtrer les widgets qui n'existent plus dans le registre
  const validWidgets = normalizedWidgets.filter(w => 
    registryIds.includes(w.id)
  );

  return {
    ...layout,
    widgets: [...validWidgets, ...missingWidgets],
  };
}
