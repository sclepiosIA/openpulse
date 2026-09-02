/**
 * Sandbox guard — intercepts Supabase client to block destructive ops for sandbox accounts.
 * Set isSandbox(true) once the authenticated user's profile.is_sandbox is known.
 */
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';

let _isSandbox = false;
export function setSandboxFlag(v: boolean) { _isSandbox = v; }
export function getSandboxFlag() { return _isSandbox; }

const SILENT_BLOCKED_TABLES = new Set([
  'pulse_presence',
]);

const BLOCKED_FUNCTIONS = [
  /^send-email/i,
  /^send-push/i,
  /^send-native-push$/i,
  /^send-portal-notification$/i,
  /^forward-email$/i,
  /^sequence-engine$/i,
  /^process-email-queue$/i,
  /^create-support-ticket$/i,
  /^docuseal-/i,
  /^delete-/i,
  /^provision-test-accounts$/i,
];

function blocked(label: string, options: { notify?: boolean } = {}) {
  if (options.notify !== false) {
    toast.error("Mode démo : action bloquée", { description: label });
  }
  return { data: null, error: { message: "SANDBOX_BLOCKED", code: "SANDBOX_BLOCKED", details: label } };
}

let installed = false;
export function resetSandboxGuardForTests() {
  installed = false;
  _isSandbox = false;
}

// Le client Supabase est typé strict côté SDK, mais on intercepte ici à la volée
// des méthodes dynamiques (insert/update/delete/upsert, storage.upload…). On garde
// une signature `unknown` à l'extérieur et on caste localement à des helpers minimaux.
type FromBuilder = Record<string, (...args: unknown[]) => unknown>;
type StorageBucket = Record<string, (...args: unknown[]) => unknown>;
interface SupabaseLike {
  from: (table: string) => FromBuilder;
  functions: { invoke: (fn: string, opts?: unknown) => Promise<unknown> };
  storage: { from: (bucket: string) => StorageBucket };
}

export function installSandboxGuard(supabaseClient: unknown) {
  if (installed) return;
  installed = true;
  const supabase = supabaseClient as SupabaseLike;

  const origFrom = supabase.from.bind(supabase);
  supabase.from = (table: string) => {
    const builder = origFrom(table);
    for (const op of ["insert", "update", "delete", "upsert"] as const) {
      const orig = builder[op]?.bind(builder);
      if (!orig) continue;
      builder[op] = (...args: unknown[]) => {
        if (_isSandbox) {
          const fake = blocked(`${op} ${table}`, { notify: !SILENT_BLOCKED_TABLES.has(table) });
          // Return thenable mimicking PostgrestBuilder
          return {
            select: () => Promise.resolve(fake),
            single: () => Promise.resolve(fake),
            maybeSingle: () => Promise.resolve(fake),
            then: (cb: (v: unknown) => unknown) => Promise.resolve(fake).then(cb),
            catch: (cb: (e: unknown) => unknown) => Promise.resolve(fake).catch(cb),
          };
        }
        return orig(...args);
      };
    }
    return builder;
  };

  const origInvoke = supabase.functions.invoke.bind(supabase.functions);
  supabase.functions.invoke = (fn: string, opts?: unknown) => {
    if (_isSandbox && BLOCKED_FUNCTIONS.some((r) => r.test(fn))) {
      return Promise.resolve(blocked(`function ${fn}`));
    }
    return origInvoke(fn, opts);
  };

  // Storage
  const origStorageFrom = supabase.storage.from.bind(supabase.storage);
  supabase.storage.from = (bucket: string) => {
    const sb = origStorageFrom(bucket);
    for (const m of ["upload", "remove", "update", "move", "copy"] as const) {
      const orig = sb[m]?.bind(sb);
      if (!orig) continue;
      sb[m] = (...args: unknown[]) => {
        if (_isSandbox) return Promise.resolve(blocked(`storage.${m} ${bucket}`));
        return orig(...args);
      };
    }
    return sb;
  };
}

