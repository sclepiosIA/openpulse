import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";

/**
 * Logs an audit event for a document (fire-and-forget).
 * Inserts into `document_audit_log` with `performed_by = auth.uid()`.
 * Errors are swallowed (audit logging must never break the UX).
 *
 * Standard actions:
 * - `viewed`     : document opened in viewer
 * - `downloaded` : signed-url download triggered
 * - `printed`    : window.print() invoked from viewer
 * - `shared`     : permission grant / share
 * - `deleted`    : document deletion
 * - `permission_changed` : permission level changed
 */
export async function logDocumentAudit(
  documentId: string,
  action: "viewed" | "downloaded" | "printed" | "shared" | "deleted" | "permission_changed",
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    // Use getSession (cached) instead of getUser (network round-trip) — Core rule
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId || !documentId) return;

    await supabase.from("document_audit_log").insert({
      document_id: documentId,
      action,
      performed_by: userId,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      new_value: extra ? (extra as never) : null,
    });
  } catch (err) {
    debug.warn("[document-audit] insert failed", err);
  }
}
