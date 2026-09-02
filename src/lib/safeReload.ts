/**
 * Centralized safe reload helper.
 *
 * Prevents destructive `window.location.reload()` calls when the user is
 * actively typing or in the middle of a sensitive task, and throttles
 * reloads to at most 1 per 60s.
 *
 * All reload sites in the app should use this helper instead of calling
 * `window.location.reload()` directly.
 */
import { debug } from '@/lib/debug';
import { safeStorage } from '@/lib/safeStorage';

const LAST_RELOAD_KEY = 'app-last-safe-reload-at';
const LAST_INPUT_KEY = 'app-last-input-at';
const EDITING_FLAG = 'app-editing-active';
const EMAIL_DIRTY_FLAG = 'email-compose-dirty';
const JARVIS_TASK_FLAG = 'jarvis-task-active';

const RELOAD_THROTTLE_MS = 60_000;
const ACTIVE_INPUT_WINDOW_MS = 2 * 60 * 1000;

export interface SafeReloadOptions {
  /** If true, ignore the editing guard (use only for fatal/unrecoverable errors). */
  force?: boolean;
}

export interface SafeReloadResult {
  reloaded: boolean;
  reason?: 'editing' | 'email-dirty' | 'jarvis-task' | 'throttled' | 'no-window';
}

function isUserEditing(): boolean {
  if (safeStorage.getItem(EDITING_FLAG) === '1') {
    const last = parseInt(safeStorage.getItem(LAST_INPUT_KEY) || '0', 10);
    if (Date.now() - last < ACTIVE_INPUT_WINDOW_MS) return true;
  }
  // Also check live DOM focus on editable elements
  if (typeof document !== 'undefined') {
    const el = document.activeElement as HTMLElement | null;
    if (el) {
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
    }
  }
  return false;
}

/**
 * Attempt to reload the page, respecting active-editing guards and throttling.
 * Returns whether the reload actually happened and (if not) why it was blocked.
 */
export function safeReload(source: string, options: SafeReloadOptions = {}): SafeReloadResult {
  if (typeof window === 'undefined') {
    return { reloaded: false, reason: 'no-window' };
  }

  const { force = false } = options;

  if (!force) {
    if (safeStorage.getItem(EMAIL_DIRTY_FLAG) === '1') {
      debug.warn(`[safeReload] Blocked (email compose dirty) — source=${source}`);
      return { reloaded: false, reason: 'email-dirty' };
    }
    if (safeStorage.getItem(JARVIS_TASK_FLAG) === '1') {
      debug.warn(`[safeReload] Blocked (jarvis task active) — source=${source}`);
      return { reloaded: false, reason: 'jarvis-task' };
    }
    if (isUserEditing()) {
      debug.warn(`[safeReload] Blocked (user editing) — source=${source}`);
      return { reloaded: false, reason: 'editing' };
    }
  }

  const last = parseInt(safeStorage.getItem(LAST_RELOAD_KEY) || '0', 10);
  if (!force && last && Date.now() - last < RELOAD_THROTTLE_MS) {
    debug.warn(`[safeReload] Blocked (throttle, ${Math.round((Date.now() - last) / 1000)}s ago) — source=${source}`);
    return { reloaded: false, reason: 'throttled' };
  }

  safeStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
  debug.warn(`[safeReload] Reloading — source=${source}${force ? ' (forced)' : ''}`);

  // Sentry breadcrumb if available
  try {
    const w = window as unknown as { Sentry?: { addBreadcrumb?: (b: unknown) => void } };
    w.Sentry?.addBreadcrumb?.({
      category: 'reload',
      level: 'warning',
      message: `safeReload: ${source}`,
      data: { source, forced: force },
    });
  } catch {
    /* noop */
  }

  window.location.reload();
  return { reloaded: true };
}
