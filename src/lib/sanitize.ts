/**
 * PostgREST Filter Sanitization Utilities
 * Prevents SQL injection through .or() and other filter methods
 * 
 * @see https://postgrest.org/en/stable/api.html#operators
 */

/**
 * Characters that have special meaning in PostgREST filters
 */
const POSTGREST_CONTROL_CHARS = /[(),."\\]/g;

/**
 * Sanitize a value for use in PostgREST filters
 * Removes control characters that could modify query structure
 * 
 * @param value - The raw user input
 * @param maxLength - Maximum allowed length (default 200)
 * @returns Sanitized string safe for PostgREST filters
 * 
 * @example
 * // Safe for .or() filters
 * const query = `nom.ilike.%${sanitizePostgrestValue(userInput)}%`;
 */
export function sanitizePostgrestValue(value: string, maxLength: number = 200): string {
  if (!value || typeof value !== 'string') return '';
  
  return value
    .replace(POSTGREST_CONTROL_CHARS, '') // Remove control characters
    .replace(/\s+/g, ' ')                  // Normalize whitespace
    .trim()
    .substring(0, maxLength);
}

/**
 * Sanitize a search query for ilike patterns
 * Escapes SQL LIKE wildcards in user input
 * 
 * @param value - The raw search query
 * @returns Escaped string safe for ilike patterns
 */
export function sanitizeSearchQuery(value: string): string {
  if (!value || typeof value !== 'string') return '';
  
  // First apply PostgREST sanitization
  const sanitized = sanitizePostgrestValue(value);
  
  // Escape SQL LIKE special characters (% and _)
  return sanitized
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * UUID v4 regex pattern
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a valid UUID v4
 * 
 * @param value - The string to validate
 * @returns true if valid UUID, false otherwise
 * 
 * @example
 * if (isValidUUID(id)) {
 *   // Safe to use in .in() clause
 * }
 */
export function isValidUUID(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return UUID_REGEX.test(value);
}

/**
 * Filter an array to only valid UUIDs
 * Useful before building .in() clauses
 * 
 * @param values - Array of potential UUIDs
 * @returns Array of validated UUIDs only
 * 
 * @example
 * const safeIds = filterValidUUIDs(userProvidedIds);
 * query.in('id', safeIds);
 */
export function filterValidUUIDs(values: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter(isValidUUID);
}

/**
 * Build a safe .or() filter string for ilike searches
 * 
 * @param columns - Array of column names to search
 * @param searchTerm - The sanitized search term
 * @returns PostgREST .or() filter string
 * 
 * @example
 * const filter = buildIlikeOrFilter(['nom', 'prenom'], sanitizedSearch);
 * query.or(filter);
 */
export function buildIlikeOrFilter(columns: string[], searchTerm: string): string {
  const sanitized = sanitizePostgrestValue(searchTerm);
  if (!sanitized || columns.length === 0) return '';
  
  return columns
    .map(col => `${col}.ilike.%${sanitized}%`)
    .join(',');
}

/**
 * Build a safe .in() clause string from UUIDs
 * Validates all UUIDs before joining
 * 
 * @param columnName - The column name
 * @param ids - Array of UUIDs
 * @returns PostgREST filter string or null if no valid IDs
 */
export function buildSafeInClause(columnName: string, ids: string[]): string | null {
  const validIds = filterValidUUIDs(ids);
  if (validIds.length === 0) return null;
  
  return `${columnName}.in.(${validIds.join(',')})`;
}

/**
 * Validate and sanitize email address format
 * 
 * @param email - The email to validate
 * @returns Sanitized lowercase email or null if invalid
 */
export function sanitizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') return null;
  
  const trimmed = email.trim().toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return null;
  
  // Apply PostgREST sanitization (excluding @ and .)
  const sanitized = trimmed.replace(/[(),"\\\s]/g, '');
  
  return sanitized.length > 0 && sanitized.length <= 255 ? sanitized : null;
}
