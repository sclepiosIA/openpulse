import { useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/shared/use-toast';
import { safeStorage } from '@/lib/safeStorage';
import { debug } from '@/lib/debug';

const STORAGE_KEY = 'email-draft-backup';
const DIRTY_FLAG = 'email-compose-dirty';
const DEBOUNCE_MS = 1000;

export interface DraftSnapshot {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  accountId: string;
  ts: number;
}

/**
 * Persists email composer state to sessionStorage with short debounce.
 * Restores automatically on mount if a snapshot exists.
 * Sets a dirty flag that prevents hardRecover from auto-reloading.
 * Adds beforeunload guard while dirty.
 */
export function useDraftRecovery(
  fields: { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string; accountId: string },
  setters: {
    setTo: (v: string[]) => void;
    setCc: (v: string[]) => void;
    setBcc: (v: string[]) => void;
    setSubject: (v: string) => void;
    setBody: (v: string) => void;
  },
  /** True when the composer has an initial draft or initial recipient (skip restore) */
  hasInitialData: boolean,
) {
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const restoredRef = useRef(false);

  // ── Restore on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (hasInitialData) {
      // If we already have data from props, don't overwrite with snapshot
      clearSnapshot();
      return;
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const snap: DraftSnapshot = JSON.parse(raw);
      // Only restore if snapshot is less than 30 min old
      if (Date.now() - snap.ts > 30 * 60 * 1000) {
        clearSnapshot();
        return;
      }

      // Only restore if there's meaningful content
      if (!snap.subject && !snap.body && snap.to.length === 0) {
        clearSnapshot();
        return;
      }

      setters.setTo(snap.to);
      setters.setCc(snap.cc);
      setters.setBcc(snap.bcc);
      setters.setSubject(snap.subject);
      setters.setBody(snap.body);
      restoredRef.current = true;

      toast({
        title: '✏️ Brouillon récupéré',
        description: 'Votre message précédent a été restauré automatiquement',
      });

      debug.log('[DraftRecovery] Restored snapshot from', new Date(snap.ts).toLocaleTimeString());
    } catch (e) {
      debug.error('[DraftRecovery] Restore failed:', e);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Debounced save to sessionStorage ──────────────────────────────
  useEffect(() => {
    // Skip the very first render to avoid saving default empty state
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    const isDirty = fields.to.length > 0 || fields.subject.length > 0 || fields.body.length > 0;

    if (!isDirty) {
      // Nothing to save, clear dirty flag
      try { safeStorage.removeItem(DIRTY_FLAG); } catch (_) {}
      return;
    }

    // Set dirty flag immediately (for hardRecover guard)
    try { safeStorage.setItem(DIRTY_FLAG, '1'); } catch (_) {}

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const snap: DraftSnapshot = {
          to: fields.to,
          cc: fields.cc,
          bcc: fields.bcc,
          subject: fields.subject,
          body: fields.body,
          accountId: fields.accountId,
          ts: Date.now(),
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
      } catch (e) {
        debug.error('[DraftRecovery] Save failed:', e);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fields.to, fields.cc, fields.bcc, fields.subject, fields.body, fields.accountId]);

  // ── beforeunload guard ────────────────────────────────────────────
  useEffect(() => {
    const isDirty = fields.to.length > 0 || fields.subject.length > 0 || fields.body.length > 0;
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages but still show the prompt
      e.returnValue = 'Vous avez un brouillon en cours. Quitter ?';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [fields.to, fields.subject, fields.body]);

  // ── Public: clear snapshot (call on send / explicit cancel) ───────
  const clearSnapshot = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      safeStorage.removeItem(DIRTY_FLAG);
    } catch (_) {}
  }, []);

  return { clearSnapshot, wasRestored: restoredRef.current };
}
