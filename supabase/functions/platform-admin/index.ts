/**
 * Platform API — Admin console backend.
 * Manages: API keys, webhook endpoints, mappings, events monitoring.
 * Auth: JWT + admin role required.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PLATFORM_CORS, preflight, jsonResponse, errorResponse, sha256Hex } from "../_shared/platform-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function service() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

async function requireAdmin(req: Request): Promise<{ userId: string } | Response> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return errorResponse("Unauthorized", 401, "no_auth");
  const token = auth.replace("Bearer ", "").trim();
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user?.id) return errorResponse("Unauthorized", 401, "bad_token");
  const userId = data.user.id;
  const sb = service();
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "manager");
  if (!isAdmin) return errorResponse("Forbidden", 403, "not_admin");
  return { userId };
}

function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createPlatformApiKey(sb: ReturnType<typeof service>, userId: string, name: string, scope: string) {
  const plain = `sk_${scope.replace("platform:", "").replace(":", "_")}_${randomToken(24)}`;
  const hash = await sha256Hex(plain);
  const prefix = plain.slice(0, 12);
  const { data, error } = await sb.from("api_keys").insert({
    nom: name,
    description: "Créée automatiquement depuis Platform API",
    key_hash: hash,
    key_prefix: prefix,
    permissions: [scope],
    rate_limit_per_minute: 600,
    created_by: userId,
    est_active: true,
  }).select("id").single();
  if (error) throw error;
  return { id: data.id, key: plain, prefix };
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  const guard = await requireAdmin(req);
  if (guard instanceof Response) return guard;
  const sb = service();

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? (req.method === "POST" ? (await req.clone().json()).action : null);

    if (req.method === "GET") {
      if (action === "list_keys") {
        const { data } = await sb.from("api_keys")
          .select("id, nom, description, key_prefix, permissions, est_active, last_used_at, total_requests, created_at, revoked_at")
          .order("created_at", { ascending: false }).limit(100);
        return jsonResponse({ keys: data ?? [] });
      }
      if (action === "list_webhooks") {
        const { data } = await sb.from("platform_webhook_endpoints")
          .select("id, system, url, active, created_at, updated_at")
          .order("system");
        return jsonResponse({ endpoints: data ?? [] });
      }
      if (action === "list_events") {
        const limit = Number(url.searchParams.get("limit") ?? 50);
        const status = url.searchParams.get("status");
        let q = sb.from("platform_events")
          .select("id, event_type, etablissement_id, status, attempts, last_error, target, created_at, delivered_at, next_retry_at")
          .order("created_at", { ascending: false }).limit(Math.min(limit, 200));
        if (status) q = q.eq("status", status);
        const { data } = await q;
        return jsonResponse({ events: data ?? [] });
      }
      if (action === "list_mappings") {
        const etab = url.searchParams.get("etablissement_id");
        let q = sb.from("client_external_ids")
          .select("id, etablissement_id, system, external_id, provisioned_at, metadata, created_at")
          .order("created_at", { ascending: false }).limit(200);
        if (etab) q = q.eq("etablissement_id", etab);
        const { data } = await q;
        return jsonResponse({ mappings: data ?? [] });
      }
      if (action === "stats") {
        const { data } = await sb.from("platform_events").select("status");
        const counts: Record<string, number> = {};
        (data ?? []).forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
        return jsonResponse({ event_counts: counts });
      }
      return errorResponse("Unknown action", 400, "bad_action");
    }

    if (req.method === "POST") {
      const body = await req.json();
      if (body.action === "create_api_key") {
        const { name, scope, description } = body;
        if (!name || !scope) return errorResponse("name & scope required", 400);
        if (!["platform:site_web", "platform:product", "platform:product:sandbox"].includes(scope))
          return errorResponse("Invalid scope", 400);
        const created = await createPlatformApiKey(sb, guard.userId, name, scope);
        if (description) await sb.from("api_keys").update({ description }).eq("id", created.id);
        return jsonResponse({ ...created, warning: "Cette clé ne sera plus jamais affichée." }, 201);
      }
      if (body.action === "setup_site_web") {
        const webhookUrl = String(body.webhook_url ?? '');
        if (!/^https:\/\//.test(webhookUrl)) return errorResponse("Invalid webhook URL", 400, "invalid_url");
        const hmacSecret = randomToken(32);
        const { data: endpoint, error: endpointError } = await sb.from("platform_webhook_endpoints").upsert({
          system: "site_web",
          url: webhookUrl,
          hmac_secret: hmacSecret,
          active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "system" }).select("id, system, url").single();
        if (endpointError) return errorResponse(endpointError.message, 500, "webhook_setup_failed");
        await sb.from("api_keys")
          .update({ est_active: false, revoked_at: new Date().toISOString(), revoked_by: guard.userId })
          .contains("permissions", ["platform:site_web"])
          .eq("est_active", true);
        const apiKey = await createPlatformApiKey(sb, guard.userId, "Site Web OpenPulse", "platform:site_web");
        return jsonResponse({
          ok: true,
          endpoint,
          site_web_project_id: "9028644f-1053-4ae3-9f25-62107448a1a3",
          secrets: {
            PLATFORM_API_URL: `${SUPABASE_URL}/functions/v1`,
            PLATFORM_API_KEY: apiKey.key,
            PLATFORM_WEBHOOK_HMAC_SECRET: hmacSecret,
          },
          webhook_url: webhookUrl,
          api_key_prefix: apiKey.prefix,
          warning: "Copiez ces secrets maintenant : la clé API et le secret HMAC ne seront plus affichés.",
        }, 201);
      }
      if (body.action === "revoke_api_key") {
        const { id } = body;
        await sb.from("api_keys").update({ est_active: false, revoked_at: new Date().toISOString(), revoked_by: guard.userId }).eq("id", id);
        return jsonResponse({ ok: true });
      }
      if (body.action === "upsert_webhook") {
        const { system, url: targetUrl, active } = body;
        if (!["site_web", "product"].includes(system)) return errorResponse("Invalid system", 400);
        if (!targetUrl) return errorResponse("url required", 400);
        // Preserve existing secret if any
        const { data: existing } = await sb.from("platform_webhook_endpoints").select("id, hmac_secret").eq("system", system).maybeSingle();
        if (existing) {
          await sb.from("platform_webhook_endpoints").update({
            url: targetUrl, active: active ?? true, updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
          return jsonResponse({ id: existing.id, system, secret_exists: true });
        }
        const secret = randomToken(32);
        const { data, error } = await sb.from("platform_webhook_endpoints").insert({
          system, url: targetUrl, hmac_secret: secret, active: active ?? true,
        }).select("id").single();
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ id: data.id, system, hmac_secret: secret, warning: "Notez ce secret, il ne sera plus affiché." }, 201);
      }
      if (body.action === "rotate_webhook_secret") {
        const { system } = body;
        const secret = randomToken(32);
        const { error } = await sb.from("platform_webhook_endpoints")
          .update({ hmac_secret: secret, updated_at: new Date().toISOString() }).eq("system", system);
        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ system, hmac_secret: secret, warning: "Notez ce secret, il ne sera plus affiché." });
      }
      if (body.action === "retry_event") {
        const { id } = body;
        await sb.from("platform_events").update({
          status: "pending", next_retry_at: null, last_error: null,
        }).eq("id", id);
        return jsonResponse({ ok: true });
      }
      return errorResponse("Unknown action", 400, "bad_action");
    }

    return errorResponse("Method not allowed", 405);
  } catch (e) {
    console.error("[platform-admin] error", e);
    return errorResponse("Internal error", 500, "internal_error");
  }
});

// keep import used
const _ = PLATFORM_CORS;
void _;
