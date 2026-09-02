/**
 * Types for Database Adapters (PostgreSQL Direct, etc.)
 * Provides strict typing for query builders and filters
 */

/**
 * Filter operation types for query builders
 */
export type FilterType = 
  | 'eq' 
  | 'neq' 
  | 'gt' 
  | 'gte' 
  | 'lt' 
  | 'lte' 
  | 'like' 
  | 'ilike' 
  | 'is' 
  | 'in' 
  | 'contains' 
  | 'containedBy' 
  | 'or' 
  | 'not';

/**
 * Filter definition for query building
 */
export interface QueryFilter {
  type: FilterType;
  column: string;
  value: string | number | boolean | null | string[] | number[];
  operator?: string;
}

/**
 * Order by definition
 */
export interface OrderByClause {
  column: string;
  ascending: boolean;
}

/**
 * Request body for database queries
 */
export interface DatabaseQueryRequest {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  columns: string;
  filters: QueryFilter[];
  orderBy: OrderByClause[];
  limit: number | null;
  range: { from: number; to: number | null } | null;
  values?: Record<string, unknown> | Record<string, unknown>[];
  upsertOptions?: { onConflict?: string };
}

/**
 * Primitive value types accepted by query filters
 */
export type FilterValue = string | number | boolean | null | string[] | number[];

/**
 * Values for insert/update operations - partial record of unknown values
 */
export type MutationValues<T> = Partial<Record<keyof T, unknown>>;

/**
 * Sortable field extracted from a type
 */
export type SortableField<T> = keyof T & string;

/**
 * Sort configuration for any sortable entity
 */
export interface SortConfig<T> {
  field: SortableField<T>;
  direction: 'asc' | 'desc';
}

/**
 * Widget configuration options with known keys
 */
export interface WidgetConfigOptions {
  period?: { default: string };
  showTrend?: { default: boolean };
  alertThreshold?: { min?: number; max?: number };
  autoRefresh?: { default: number };
  compactMode?: { default: boolean };
  maxItems?: { max?: number };
}

/**
 * OnlyOffice DocEditor instance type
 */
export interface OnlyOfficeDocEditor {
  destroyEditor: () => void;
}

/**
 * OnlyOffice error event
 */
export interface OnlyOfficeErrorEvent {
  data?: {
    errorCode?: number;
    errorDescription?: string;
  };
}

/**
 * OnlyOffice document state change event
 */
export interface OnlyOfficeStateChangeEvent {
  data?: boolean;
}

/**
 * Global DocsAPI interface for OnlyOffice
 */
export interface DocsAPI {
  DocEditor: new (
    elementId: string, 
    config: Record<string, unknown>
  ) => OnlyOfficeDocEditor;
}
