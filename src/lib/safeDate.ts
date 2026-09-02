/**
 * Safe date helpers — never throw "RangeError: Invalid time value"
 * (audit logs/monitoring May 2026, STAB-4).
 *
 * Use these wrappers wherever an external/optional source feeds a date
 * (Nextcloud, IMAP, scraped data, optional DB columns) before calling
 * date-fns `format` / `formatDistanceToNow`.
 */
import { format as fnsFormat, formatDistanceToNow as fnsFormatDistanceToNow, isValid } from 'date-fns';
import type { Locale } from 'date-fns';

type DateInput = Date | string | number | null | undefined;

const toDate = (value: DateInput): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return isValid(d) ? d : null;
};

export function safeFormat(
  value: DateInput,
  pattern: string,
  options?: { locale?: Locale },
  fallback = '—',
): string {
  const d = toDate(value);
  if (!d) return fallback;
  try {
    return fnsFormat(d, pattern, options);
  } catch {
    return fallback;
  }
}

export function safeFormatDistanceToNow(
  value: DateInput,
  options?: { locale?: Locale; addSuffix?: boolean },
  fallback = '—',
): string {
  const d = toDate(value);
  if (!d) return fallback;
  try {
    return fnsFormatDistanceToNow(d, options);
  } catch {
    return fallback;
  }
}
