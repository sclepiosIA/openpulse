/**
 * Test helpers for timezone-sensitive assertions.
 * Addresses class-4 fails from the 2026-07 triage catalog:
 * tests using `new Date('YYYY-MM-DD')` (interpreted as UTC midnight) and
 * asserting on toISOString().slice(0,10) — which flips a day in CET/CEST.
 *
 * Rule of thumb enforced project-wide (see mem://architecture/gestion-dates-*):
 *   dates persisted in DB are LOCAL YYYY-MM-DD strings, never UTC ISO.
 */

/**
 * Build a Date at local midnight for the given YYYY-MM-DD.
 * Safe to compare with local-formatted strings, unlike `new Date('2026-07-06')`
 * which is UTC and shifts to July 5 22:00 or 23:00 in Europe/Paris.
 */
export function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Format a Date as local YYYY-MM-DD (no TZ conversion). */
export function toLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Freeze the runtime clock at a fixed local instant for the duration of a
 * test. Callers must `vi.useFakeTimers()` beforehand.
 *
 * Example:
 *   beforeEach(() => { vi.useFakeTimers(); setTestNow('2026-07-06T09:00:00'); });
 *   afterEach(() => vi.useRealTimers());
 */
export function setTestNow(localIso: string): Date {
  const d = new Date(localIso);
  // vitest fake timers pick this up via Date.now / new Date()
  // (we rely on vi.useFakeTimers being active in the caller).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__TEST_NOW__ = d.getTime();
  return d;
}
