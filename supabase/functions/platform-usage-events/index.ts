/**
 * POST /platform-usage-events
 * Body: { events: UsageEvent[] }  (max 500)
 * Ingests product telemetry. Returns { accepted, rejected }.
 */
import {
  withApiKey, jsonResponse, errorResponse, serviceClient,
  checkIdempotency, storeIdempotency,
} from "../_shared/platform-auth.ts";

interface UsageEvent {
  etablissement_id: string;
  user_external_id?: string | null;
  event_name: string;
  module?: string | null;
  occurred_at: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) =>
  withApiKey(req, async (ctx) => {
    if (req.method !== "POST") return errorResponse("Method not allowed", 405, "method");
    if (!ctx.scope.startsWith("platform:product")) {
      return errorResponse("Forbidden — product scope required", 403, "forbidden_scope");
    }

    const { key, cached } = await checkIdempotency(req, "usage-events");
    if (cached) return cached;

    let body: { events?: UsageEvent[] };
    try { body = await req.json(); } catch { return errorResponse("Invalid JSON", 400, "invalid_body"); }
    if (!Array.isArray(body.events)) return errorResponse("events must be array", 400, "invalid_events");
    if (body.events.length === 0) return jsonResponse({ accepted: 0, rejected: 0 }, 202);
    if (body.events.length > 500) return errorResponse("Max 500 events per batch", 400, "batch_too_large");

    const rows: Array<Record<string, unknown>> = [];
    let rejected = 0;
    for (const e of body.events) {
      if (!e.etablissement_id || !e.event_name || !e.occurred_at) { rejected++; continue; }
      if (!/^[0-9a-f-]{36}$/i.test(e.etablissement_id)) { rejected++; continue; }
      rows.push({
        etablissement_id: e.etablissement_id,
        user_external_id: e.user_external_id ?? null,
        event_name: e.event_name,
        module: e.module ?? null,
        occurred_at: e.occurred_at,
        metadata: e.metadata ?? {},
      });
    }

    if (rows.length > 0) {
      const sb = serviceClient();
      const { error } = await sb.from("platform_usage_events").insert(rows);
      if (error) {
        console.error("[platform-usage-events]", error);
        return errorResponse("Ingestion failed", 500, "db_error");
      }
    }

    const result = { accepted: rows.length, rejected };
    if (key) await storeIdempotency(key, "usage-events", result, 202);
    return jsonResponse(result, 202);
  }),
);
