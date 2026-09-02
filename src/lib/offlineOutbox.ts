/**
 * Offline outbox — file d'attente locale pour emails et notes de dashboard
 * rédigés hors ligne. Persistée dans IndexedDB via idb-keyval.
 *
 * Le flush est orchestré par `useOutboxFlusher` (au retour du réseau).
 */
import { get, set, del, keys, createStore } from 'idb-keyval';
import { supabase } from '@/integrations/supabase/client';

export type OutboxStatus = 'pending' | 'sending' | 'failed';

export interface OutboxEmailDraft {
  kind: 'email';
  id: string;
  /** Edge function to invoke when flushing (e.g. 'send-email-reply'). */
  function_name: string;
  /** Body posted to the edge function — must be fully self-contained. */
  payload: Record<string, unknown>;
  /** Display info for the badge / list UI. */
  display: {
    to: string[];
    subject: string;
    excerpt?: string;
  };
  created_at: number;
  status: OutboxStatus;
  last_error?: string;
  attempts: number;
}

export interface OutboxDashboardNote {
  kind: 'dashboard_note';
  id: string;
  dashboard_id?: string;
  content: string;
  title?: string;
  created_at: number;
  status: OutboxStatus;
  last_error?: string;
  attempts: number;
}

export type OutboxItem = OutboxEmailDraft | OutboxDashboardNote;

const emailStore = createStore('marque-outbox', 'email-drafts');
const noteStore = createStore('marque-outbox', 'dashboard-notes');

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Emails ───────────────────────────────────────────────────────────────────

export async function enqueueEmail(
  draft: Omit<OutboxEmailDraft, 'kind' | 'id' | 'created_at' | 'status' | 'attempts'>
): Promise<OutboxEmailDraft> {
  const item: OutboxEmailDraft = {
    kind: 'email',
    id: makeId('email'),
    created_at: Date.now(),
    status: 'pending',
    attempts: 0,
    ...draft,
  };
  await set(item.id, item, emailStore);
  notifyChange();
  return item;
}

export async function listEmailDrafts(): Promise<OutboxEmailDraft[]> {
  const ks = await keys(emailStore);
  const items: OutboxEmailDraft[] = [];
  for (const k of ks) {
    const v = await get<OutboxEmailDraft>(k as string, emailStore);
    if (v) items.push(v);
  }
  return items.sort((a, b) => a.created_at - b.created_at);
}

export async function deleteEmailDraft(id: string): Promise<void> {
  await del(id, emailStore);
  notifyChange();
}

async function updateEmailDraft(id: string, patch: Partial<OutboxEmailDraft>): Promise<void> {
  const cur = await get<OutboxEmailDraft>(id, emailStore);
  if (!cur) return;
  await set(id, { ...cur, ...patch }, emailStore);
}

// ─── Dashboard notes ──────────────────────────────────────────────────────────

export async function enqueueDashboardNote(
  note: Omit<OutboxDashboardNote, 'kind' | 'id' | 'created_at' | 'status' | 'attempts'>
): Promise<OutboxDashboardNote> {
  const item: OutboxDashboardNote = {
    kind: 'dashboard_note',
    id: makeId('note'),
    created_at: Date.now(),
    status: 'pending',
    attempts: 0,
    ...note,
  };
  await set(item.id, item, noteStore);
  notifyChange();
  return item;
}

export async function listDashboardNotes(): Promise<OutboxDashboardNote[]> {
  const ks = await keys(noteStore);
  const items: OutboxDashboardNote[] = [];
  for (const k of ks) {
    const v = await get<OutboxDashboardNote>(k as string, noteStore);
    if (v) items.push(v);
  }
  return items.sort((a, b) => a.created_at - b.created_at);
}

export async function deleteDashboardNote(id: string): Promise<void> {
  await del(id, noteStore);
  notifyChange();
}

async function updateDashboardNote(id: string, patch: Partial<OutboxDashboardNote>): Promise<void> {
  const cur = await get<OutboxDashboardNote>(id, noteStore);
  if (!cur) return;
  await set(id, { ...cur, ...patch }, noteStore);
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

export async function listAllOutbox(): Promise<OutboxItem[]> {
  const [emails, notes] = await Promise.all([listEmailDrafts(), listDashboardNotes()]);
  return [...emails, ...notes].sort((a, b) => a.created_at - b.created_at);
}

export async function countPending(): Promise<number> {
  const all = await listAllOutbox();
  return all.filter((i) => i.status !== 'sending').length;
}

// ─── Flusher ──────────────────────────────────────────────────────────────────

let flushInFlight = false;

export async function flushOutbox(): Promise<{ sent: number; failed: number }> {
  if (flushInFlight) return { sent: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { sent: 0, failed: 0 };
  flushInFlight = true;
  let sent = 0;
  let failed = 0;
  try {
    // Emails
    for (const draft of await listEmailDrafts()) {
      if (draft.status === 'sending') continue;
      await updateEmailDraft(draft.id, { status: 'sending' });
      try {
        const { error } = await supabase.functions.invoke(draft.function_name, {
          body: draft.payload,
        });
        if (error) throw new Error(error.message ?? `${draft.function_name} failed`);
        await deleteEmailDraft(draft.id);
        sent++;
      } catch (err) {
        failed++;
        await updateEmailDraft(draft.id, {
          status: 'failed',
          attempts: (draft.attempts ?? 0) + 1,
          last_error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    // Dashboard notes
    for (const note of await listDashboardNotes()) {
      if (note.status === 'sending') continue;
      await updateDashboardNote(note.id, { status: 'sending' });
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('Utilisateur non authentifié');
        const { error } = await supabase.from('dashboard_notes').insert({
          user_id: userId,
          content: note.content,
          tab_name: note.title ?? 'default',
        });
        if (error) throw new Error(error.message);
        await deleteDashboardNote(note.id);
        sent++;

      } catch (err) {
        failed++;
        await updateDashboardNote(note.id, {
          status: 'failed',
          attempts: (note.attempts ?? 0) + 1,
          last_error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    flushInFlight = false;
    if (sent > 0 || failed > 0) notifyChange();
  }
  return { sent, failed };
}

// ─── Change events (so the badge can react) ────────────────────────────────────

const CHANGE_EVENT = 'marque-outbox-change';
export function notifyChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}
export function onOutboxChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
