/**
 * Classifie les erreurs pour adapter le rendu UI.
 * Used by <PageDataState> to differentiate unauthorized / network / generic errors.
 */
export type ErrorKind = 'unauthorized' | 'network' | 'notfound' | 'generic';

export function classifyError(err: unknown): ErrorKind {
  if (!err) return 'generic';
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const code = (err as { code?: string; status?: number })?.code;
  const status = (err as { status?: number })?.status;

  if (status === 401 || status === 403 || code === '42501' || code === 'PGRST301') return 'unauthorized';
  if (/permission denied|not authorized|rls|row-level|forbidden|unauthori[sz]ed/i.test(msg)) return 'unauthorized';
  if (status === 404 || /not found|pgrst116/i.test(msg)) return 'notfound';
  if (/network|failed to fetch|timeout|abort/i.test(msg)) return 'network';
  return 'generic';
}

export function isUnauthorizedError(err: unknown): boolean {
  return classifyError(err) === 'unauthorized';
}
