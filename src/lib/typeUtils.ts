/**
 * Type utilities for handling strict TypeScript mode with Supabase types
 * Helps normalize null ↔ undefined conversions required by exactOptionalPropertyTypes
 */

// Type pour les valeurs de base de données
type DbValue = string | number | boolean | null | undefined | object | unknown[];

// Type strict pour les lignes de base de données
type DbRow = Record<string, DbValue>;

// Convert null to undefined for exact optional property types
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

// Convert undefined to null for database operations
export function undefinedToNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

// Normalize database row to use undefined instead of null for optional properties
export function normalizeDbRow<T extends DbRow>(row: T): T {
  const normalized = {} as T;
  for (const [key, value] of Object.entries(row)) {
    // Type-safe assignment using keyof
    (normalized as DbRow)[key] = nullToUndefined(value);
  }
  return normalized;
}

// Utility type to convert all null properties to undefined
export type NullToUndefined<T> = {
  [K in keyof T]: T[K] extends null ? undefined : T[K] extends null | infer U ? U | undefined : T[K];
};

// Helper for strict type checking with casting - typed input
export function strictCast<T>(value: unknown): T {
  return value as T;
}