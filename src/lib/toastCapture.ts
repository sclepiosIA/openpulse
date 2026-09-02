/**
 * Toast Capture — Forwards every user-facing error/warning toast to the
 * frontend error monitor so we can fix what users actually see.
 *
 * Monkey-patches sonner's `toast.error` / `toast.warning` once at startup.
 * No need to refactor the 340+ files importing `toast` directly from "sonner".
 */
import { toast } from 'sonner';
import { frontendErrorCapture } from './frontendErrorCapture';

let installed = false;

type ToastFn = (message: unknown, data?: unknown) => string | number;

function extractText(message: unknown, data?: unknown): string {
  let text = '';
  if (typeof message === 'string') text = message;
  else if (message && typeof message === 'object') {
    const m = message as { message?: string; toString?: () => string };
    text = m.message || (m.toString ? m.toString() : '') || '';
  } else {
    text = String(message ?? '');
  }
  const desc = (data && typeof data === 'object' && 'description' in data)
    ? String((data as { description?: unknown }).description ?? '')
    : '';
  return desc ? `${text} — ${desc}` : text;
}

export function installToastCapture() {
  if (installed) return;
  installed = true;

  const t = toast as unknown as Record<string, ToastFn>;
  const originalError = t.error?.bind(toast);
  const originalWarning = t.warning?.bind(toast);

  if (originalError) {
    t.error = ((message: unknown, data?: unknown) => {
      try {
        const text = extractText(message, data);
        if (text && text.trim().length > 0) {
          frontendErrorCapture.reportToastError(text, 'error');
        }
      } catch {
        /* never break the toast */
      }
      return originalError(message, data);
    }) as ToastFn;
  }

  if (originalWarning) {
    t.warning = ((message: unknown, data?: unknown) => {
      try {
        const text = extractText(message, data);
        if (text && text.trim().length > 0) {
          frontendErrorCapture.reportToastError(text, 'warning');
        }
      } catch {
        /* never break the toast */
      }
      return originalWarning(message, data);
    }) as ToastFn;
  }
}
