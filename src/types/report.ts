/**
 * Types pour le module Custom Dashboards (Rapports personnalisables)
 */

export type ReportSourceKey =
  | 'pipeline_by_status'
  | 'mrr_evolution'
  | 'won_deals_by_commercial'
  | 'tasks_by_assignee'
  | 'support_tickets_by_priority'
  | 'revenue_by_month'
  | 'prospects_by_score'
  | 'etablissements_by_offer'
  | 'conversion_funnel'
  | 'deals_per_week'
  | 'top_etablissements_value'
  | 'pending_invoices'
  | 'etablissements_by_csm'
  | 'new_etablissements_by_month'
  | 'overdue_tasks';

export type WidgetType =
  | 'kpi'
  | 'bar_chart'
  | 'line_chart'
  | 'donut_chart'
  | 'table'
  | 'funnel'
  | 'markdown';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  source?: ReportSourceKey;
  /** Champ utilisé comme dimension principale (axe X / labels) */
  dimension?: string;
  /** Champ utilisé comme mesure (valeur numérique) */
  measure?: string;
  /** Comparer avec la période précédente (KPI) */
  compareWithPrevious?: boolean;
  /** Format d'affichage : currency, number, percent */
  format?: 'currency' | 'number' | 'percent';
  /** Couleur du widget */
  color?: string;
  /** Texte markdown libre (pour widget markdown) */
  markdown?: string;
  /** Filtres locaux (override les filtres globaux) */
  localFilters?: Record<string, unknown>;
}

export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface DashboardFilters {
  date_start?: string;
  date_end?: string;
  user_id?: string;
  statut?: string;
  [key: string]: unknown;
}

export interface CustomDashboard {
  id: string;
  nom: string;
  description: string | null;
  owner_id: string;
  is_shared: boolean;
  shared_with: string[];
  filters_schema: DashboardFilters;
  layout: GridLayoutItem[];
  widgets: WidgetConfig[];
  is_template: boolean;
  icon: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportDataResponse {
  source: ReportSourceKey;
  rows: Array<Record<string, unknown>>;
  generated_at: string;
}

export interface ReportSourceMeta {
  key: ReportSourceKey;
  label: string;
  description: string;
  category: 'commercial' | 'finance' | 'production' | 'support' | 'rh';
  /** Suggestion de widget par défaut */
  defaultWidget: WidgetType;
  /** Champs dimension/mesure */
  dimensions: string[];
  measures: string[];
}

export const REPORT_SOURCES: ReportSourceMeta[] = [
  { key: 'pipeline_by_status', label: 'Pipeline par statut', description: 'Répartition des établissements par statut commercial', category: 'commercial', defaultWidget: 'bar_chart', dimensions: ['statut'], measures: ['count', 'valeur'] },
  { key: 'mrr_evolution', label: 'Évolution MRR', description: 'Revenus mensuels récurrents (réservé direction)', category: 'finance', defaultWidget: 'line_chart', dimensions: ['mois'], measures: ['mrr'] },
  { key: 'won_deals_by_commercial', label: 'Deals gagnés par commercial', description: 'Performance commerciale individuelle', category: 'commercial', defaultWidget: 'bar_chart', dimensions: ['commercial_nom'], measures: ['deals', 'valeur'] },
  { key: 'tasks_by_assignee', label: 'Tâches par responsable', description: 'Charge de travail par utilisateur', category: 'production', defaultWidget: 'table', dimensions: ['user_nom'], measures: ['total', 'terminees', 'en_cours'] },
  { key: 'support_tickets_by_priority', label: 'Tickets support par priorité', description: 'Répartition des tickets en cours', category: 'support', defaultWidget: 'donut_chart', dimensions: ['priorite'], measures: ['count'] },
  { key: 'revenue_by_month', label: 'Revenus mensuels', description: 'Chiffre d\'affaires par mois', category: 'finance', defaultWidget: 'line_chart', dimensions: ['mois'], measures: ['revenue'] },
  { key: 'prospects_by_score', label: 'Prospects par score', description: 'Tranches de probabilité de conversion', category: 'commercial', defaultWidget: 'donut_chart', dimensions: ['tranche'], measures: ['count'] },
  { key: 'etablissements_by_offer', label: 'Établissements par offre', description: 'Répartition par type d\'offre', category: 'commercial', defaultWidget: 'donut_chart', dimensions: ['type_offre'], measures: ['count'] },
  { key: 'conversion_funnel', label: 'Funnel de conversion', description: 'Prospect → Production', category: 'commercial', defaultWidget: 'funnel', dimensions: ['etape'], measures: ['count'] },
  { key: 'deals_per_week', label: 'Deals par semaine', description: 'Activité commerciale hebdomadaire', category: 'commercial', defaultWidget: 'line_chart', dimensions: ['semaine'], measures: ['deals'] },
  { key: 'top_etablissements_value', label: 'Top établissements par valeur', description: 'Classement des plus gros comptes', category: 'commercial', defaultWidget: 'table', dimensions: ['nom'], measures: ['valeur'] },
  { key: 'pending_invoices', label: 'Factures à encaisser', description: 'Factures envoyées non payées', category: 'finance', defaultWidget: 'table', dimensions: ['client_nom'], measures: ['montant_ttc'] },
  { key: 'etablissements_by_csm', label: 'Comptes par CSM', description: 'Portefeuille des Customer Success Managers', category: 'production', defaultWidget: 'bar_chart', dimensions: ['csm_nom'], measures: ['count'] },
  { key: 'new_etablissements_by_month', label: 'Nouveaux établissements / mois', description: 'Acquisition mensuelle', category: 'commercial', defaultWidget: 'line_chart', dimensions: ['mois'], measures: ['count'] },
  { key: 'overdue_tasks', label: 'Tâches en retard', description: 'Liste des tâches dont l\'échéance est dépassée', category: 'production', defaultWidget: 'table', dimensions: ['title'], measures: ['due_date'] },
];

export const WIDGET_DEFAULT_SIZE: Record<WidgetType, { w: number; h: number; minW: number; minH: number }> = {
  kpi: { w: 3, h: 3, minW: 2, minH: 2 },
  bar_chart: { w: 6, h: 6, minW: 3, minH: 4 },
  line_chart: { w: 6, h: 6, minW: 3, minH: 4 },
  donut_chart: { w: 4, h: 6, minW: 3, minH: 4 },
  table: { w: 6, h: 8, minW: 4, minH: 4 },
  funnel: { w: 4, h: 6, minW: 3, minH: 4 },
  markdown: { w: 6, h: 4, minW: 2, minH: 2 },
};

export const MAX_WIDGETS_PER_DASHBOARD = 30;
export const MAX_DASHBOARDS_PER_USER = 50;
