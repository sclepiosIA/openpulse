// Internal invocation guard for EF that should only be callable by trusted
// internal callers (other EF, CRON, server-side jobs). NOT for browser clients.
//
// Caller MUST send header `x-internal-secret: <secret>` matching one of:
//   - Deno.env.get("INTERNAL_INVOCATION_SECRET")  (preferred shared secret)
//   - Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")   (fallback for service_role
//                                                  bearer style callers)
//
// Comparison is timing-safe. Missing/invalid → 401 "Unauthorized internal call".
//
// Usage:
//   import { requireInternalSecret } from "../_shared/internal-secret.ts";
//   const denied = requireInternalSecret(req, corsHeaders);
//   if (denied) return denied;

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface InternalSecretOptions {
  /** Also accept `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (default true). */
  allowServiceRoleBearer?: boolean;
}

export function requireInternalSecret(
  req: Request,
  corsHeaders: Record<string, string>,
  opts: InternalSecretOptions = {},
): Response | null {
  const { allowServiceRoleBearer = true } = opts;

  const internalSecret = Deno.env.get("INTERNAL_INVOCATION_SECRET") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const provided = req.headers.get("x-internal-secret") ?? "";
  if (provided && internalSecret && timingSafeEqualStr(provided, internalSecret)) {
    return null;
  }
  if (provided && serviceRoleKey && timingSafeEqualStr(provided, serviceRoleKey)) {
    return null;
  }

  if (allowServiceRoleBearer) {
    const auth = req.headers.get("Authorization") ?? "";
    if (auth.startsWith("Bearer ") && serviceRoleKey) {
      const token = auth.slice(7);
      if (timingSafeEqualStr(token, serviceRoleKey)) return null;
    }
  }

  console.warn("[internal-secret] Unauthorized internal invocation rejected");
  return new Response(
    JSON.stringify({ error: "Unauthorized internal call" }),
    {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
