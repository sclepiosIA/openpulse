/**
 * POST /platform-webhooks-register
 * Body: { system: "site_web"|"product", url, hmac_secret }
 * Registers (or replaces) the webhook endpoint of a consumer system.
 * Caller needs the scope matching the system being registered.
 */
import { withApiKey, jsonResponse, errorResponse, serviceClient } from "../_shared/platform-auth.ts";

Deno.serve(async (req) =>
  withApiKey(req, async (ctx) => {
    if (req.method !== "POST") return errorResponse("Method not allowed", 405, "method");
    let body: { system?: string; url?: string; hmac_secret?: string };
    try { body = await req.json(); } catch { return errorResponse("Invalid JSON", 400, "invalid_body"); }
    if (!body.system || !["site_web", "product"].includes(body.system)) {
      return errorResponse("Invalid system", 400, "invalid_system");
    }
    if (!body.url || !/^https:\/\//.test(body.url)) {
      return errorResponse("Invalid url (https required)", 400, "invalid_url");
    }
    if (!body.hmac_secret || body.hmac_secret.length < 32) {
      return errorResponse("hmac_secret must be >= 32 chars", 400, "invalid_secret");
    }
    // Scope check
    if (!ctx.scope.includes(body.system)) {
      return errorResponse("Forbidden — scope mismatch", 403, "forbidden_scope");
    }

    const sb = serviceClient();
    const { error } = await sb.from("platform_webhook_endpoints").upsert({
      system: body.system,
      url: body.url,
      hmac_secret: body.hmac_secret,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "system" });

    if (error) {
      console.error("[platform-webhooks-register]", error);
      return errorResponse("Registration failed", 500, "db_error");
    }
    return jsonResponse({ ok: true, system: body.system }, 201);
  }),
);
