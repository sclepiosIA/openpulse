/**
 * versionHistory — historique de versions d'un document (multi-éditeur).
 *
 * Persistance :
 *  - PRIMAIRE : table Supabase `document_versions` (RLS par utilisateur).
 *  - FALLBACK : `localStorage` (clé par documentId) si hors-ligne ou erreur RLS.
 *
 * L'API est ASYNC pour toutes les opérations réseau. Les éditeurs qui appellent
 * `saveVersion` en fire-and-forget doivent utiliser `void saveVersion(...)`.
 *
 * Diff textuel ligne à ligne (LCS) exposé pour le dialog de comparaison.
 */
import { supabase } from '@/integrations/supabase/client';

export type VersionKind = 'html' | 'json';

export interface DocumentVersion {
  id: string;
  createdAt: number;
  name: string;
  kind: VersionKind;
  content: string;
  size: number;
  auto: boolean;
  /** true si la version provient de Supabase (sinon fallback local). */
  remote?: boolean;
}

const KEY_PREFIX = 'marque.docVersions.';
const MAX_VERSIONS = 50;

/* ─────────────────────────── LocalStorage helpers ─────────────────────────── */

function storageKey(documentId: string) { return `${KEY_PREFIX}${documentId}`; }

function safeParse(raw: string | null): DocumentVersion[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as DocumentVersion[];
  } catch { /* ignore */ }
  return [];
}

function readLocal(documentId: string): DocumentVersion[] {
  if (typeof window === 'undefined' || !documentId) return [];
  return safeParse(window.localStorage.getItem(storageKey(documentId)));
}

function writeLocal(documentId: string, versions: DocumentVersion[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(documentId), JSON.stringify(versions));
  } catch (err) {
    try {
      const trimmed = versions.slice(0, Math.max(10, Math.floor(MAX_VERSIONS / 2)));
      window.localStorage.setItem(storageKey(documentId), JSON.stringify(trimmed));
    } catch {
      console.warn('[versionHistory] localStorage indisponible', err);
    }
  }
}

/* ─────────────────────────────── Supabase I/O ─────────────────────────────── */

interface RemoteRow {
  id: string;
  document_id: string;
  user_id: string;
  name: string;
  kind: VersionKind;
  content: string;
  size: number;
  auto: boolean;
  created_at: string;
}

function rowToVersion(row: RemoteRow): DocumentVersion {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    name: row.name,
    kind: row.kind,
    content: row.content,
    size: row.size,
    auto: row.auto,
    remote: true,
  };
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch { return null; }
}

/* ─────────────────────────────── Public API ─────────────────────────────── */

export async function listVersions(documentId: string): Promise<DocumentVersion[]> {
  if (!documentId) return [];
  const local = readLocal(documentId);
  try {
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(MAX_VERSIONS);
    if (error) throw error;
    const remote = ((data ?? []) as unknown as RemoteRow[]).map(rowToVersion);
    // Fusion : remote prioritaire, on garde les locales non encore synchronisées.
    const remoteIds = new Set(remote.map((v) => v.id));
    const localOnly = local.filter((v) => !v.remote && !remoteIds.has(v.id));
    const merged = [...remote, ...localOnly]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_VERSIONS);
    // Rafraîchit le cache local (utile en offline).
    writeLocal(documentId, merged);
    return merged;
  } catch (err) {
    console.warn('[versionHistory] fallback localStorage (list)', err);
    return local.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export interface SaveVersionOptions {
  name?: string;
  auto?: boolean;
  /** Si identique au dernier snapshot, on ne crée pas de doublon. */
  dedupe?: boolean;
}

export async function saveVersion(
  documentId: string,
  content: string,
  kind: VersionKind,
  options: SaveVersionOptions = {},
): Promise<DocumentVersion | null> {
  if (!documentId) return null;
  const existing = readLocal(documentId).sort((a, b) => b.createdAt - a.createdAt);
  if (options.dedupe !== false && existing[0]?.content === content) {
    return existing[0];
  }
  const name = options.name?.trim() || defaultVersionName(options.auto);
  const size = content.length;
  const auto = !!options.auto;

  // Tentative Supabase (nécessite user auth).
  const uid = await currentUserId();
  if (uid) {
    try {
      const { data, error } = await supabase
        .from('document_versions')
        .insert({ document_id: documentId, user_id: uid, name, kind, content, size, auto })
        .select('*')
        .single();
      if (error) throw error;
      const v = rowToVersion(data as RemoteRow);
      const next = [v, ...existing.filter((x) => x.id !== v.id)].slice(0, MAX_VERSIONS);
      writeLocal(documentId, next);
      // Pruning côté serveur si > MAX_VERSIONS (best-effort).
      void pruneRemote(documentId, uid);
      return v;
    } catch (err) {
      console.warn('[versionHistory] fallback localStorage (save)', err);
    }
  }

  // Fallback local uniquement.
  const version: DocumentVersion = {
    id: (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    createdAt: Date.now(),
    name, kind, content, size, auto, remote: false,
  };
  const next = [version, ...existing].slice(0, MAX_VERSIONS);
  writeLocal(documentId, next);
  return version;
}

async function pruneRemote(documentId: string, uid: string) {
  try {
    const { data } = await supabase
      .from('document_versions')
      .select('id')
      .eq('document_id', documentId)
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    const rows = data ?? [];
    if (rows.length <= MAX_VERSIONS) return;
    const toDelete = rows.slice(MAX_VERSIONS).map((r) => r.id);
    if (toDelete.length) {
      await supabase.from('document_versions').delete().in('id', toDelete);
    }
  } catch { /* silent */ }
}

export async function renameVersion(
  documentId: string,
  versionId: string,
  name: string,
): Promise<boolean> {
  const clean = name.trim();
  if (!clean) return false;

  // Local
  const local = readLocal(documentId);
  const idx = local.findIndex((v) => v.id === versionId);
  if (idx !== -1) {
    local[idx] = { ...local[idx], name: clean };
    writeLocal(documentId, local);
  }

  // Remote (si applicable)
  try {
    const { error } = await supabase
      .from('document_versions')
      .update({ name: clean })
      .eq('id', versionId);
    if (error && idx === -1) return false;
    return true;
  } catch {
    return idx !== -1;
  }
}

export async function deleteVersion(
  documentId: string,
  versionId: string,
): Promise<boolean> {
  const local = readLocal(documentId);
  const next = local.filter((v) => v.id !== versionId);
  const localHit = next.length !== local.length;
  if (localHit) writeLocal(documentId, next);

  try {
    const { error } = await supabase
      .from('document_versions')
      .delete()
      .eq('id', versionId);
    if (error && !localHit) return false;
    return true;
  } catch {
    return localHit;
  }
}

export function clearVersionsLocalCache(documentId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(documentId));
}

function defaultVersionName(auto?: boolean) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return auto ? `Auto — ${stamp}` : `Version ${stamp}`;
}

/* ─────────────────────────────  Diff textuel  ───────────────────────────── */

export type DiffOp = { type: 'equal' | 'add' | 'del'; line: string };

/**
 * Diff ligne à ligne via LCS. O(n·m) mémoire — suffisant pour des documents
 * jusqu'à quelques milliers de lignes.
 */
export function diffLines(a: string, b: string): DiffOp[] {
  const A = a.split('\n');
  const B = b.split('\n');
  const n = A.length;
  const m = B.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (A[i] === B[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push({ type: 'equal', line: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'del', line: A[i] }); i++; }
    else { ops.push({ type: 'add', line: B[j] }); j++; }
  }
  while (i < n) { ops.push({ type: 'del', line: A[i++] }); }
  while (j < m) { ops.push({ type: 'add', line: B[j++] }); }
  return ops;
}

export function normalizeForDiff(content: string, kind: VersionKind): string {
  if (kind === 'json') {
    try { return JSON.stringify(JSON.parse(content), null, 2); }
    catch { return content; }
  }
  return content
    .replace(/></g, '>\n<')
    .replace(/\s+\n/g, '\n')
    .trim();
}

export function summarizeDiff(ops: DiffOp[]): { added: number; removed: number } {
  let added = 0, removed = 0;
  for (const op of ops) {
    if (op.type === 'add') added++;
    else if (op.type === 'del') removed++;
  }
  return { added, removed };
}
