/**
 * CRON every 1 min : dispatches pending `platform_events` to registered webhooks
 * with HMAC signature. Retries with exponential backoff. DLQ after 5 attempts.
 *
 * Authenticated by `x-internal-secret` (CRON_SECRET) to allow CRON invocation
 * via pg_net without exposing service_role.
 */
import {
  PLATFORM_CORS, preflight, jsonResponse, errorResponse,
  serviceClient, signWebhook,
} from "../_shared/platform-auth.ts";

const RETRY_DELAYS_SEC = [30, 120, 600, 3600, 21600]; // 30s, 2m, 10m, 1h, 6h
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  const sb = serviceClient();

  // CRON secret check : aligned with vault (single source of truth)
  const secret = req.headers.get("x-internal-secret") ?? "";
  const envSecret = Deno.env.get("CRON_SECRET") ?? "";
  let ok = secret.length > 0 && secret === envSecret;
  if (!ok && secret.length > 0) {
    const { data: vaultOk } = await sb.rpc("_verify_cron_secret", { _provided: secret });
    ok = vaultOk === true;
  }
  if (!ok) {
    return errorResponse("Forbidden", 403, "forbidden");
  }


  const now = new Date().toISOString();

  // Pick events whose next_retry_at is null (pending fresh) or <= now (retrying)
  const { data: events, error } = await sb
    .from("platform_events")
    .select("id, event_type, etablissement_id, payload, target, attempts")
    .in("status", ["pending", "retrying"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[dispatcher] fetch error", error);
    return errorResponse("Fetch failed", 500, "db_error");
  }
  if (!events || events.length === 0) return jsonResponse({ processed: 0 });

  // Load endpoints once
  const { data: endpoints } = await sb
    .from("platform_webhook_endpoints")
    .select("system, url, hmac_secret, active")
    .eq("active", true);
  const endpointsMap = new Map<string, { url: string; secret: string }>();
  (endpoints ?? []).forEach((e) =>
    endpointsMap.set(e.system, { url: e.url, secret: e.hmac_secret }),
  );

  let processed = 0;
  for (const ev of events) {
    const targets: string[] = ev.target === "all" ? ["site_web", "product"] : [ev.target];
    const envelope = {
      id: ev.id,
      event_id: ev.id,
      type: ev.event_type,
      event_type: ev.event_type,
      occurred_at: now,
      etablissement_id: ev.etablissement_id,
      data: ev.payload,
    };

    const raw = JSON.stringify(envelope);

    let allOk = true;
    let firstError = "";
    for (const t of targets) {
      const ep = endpointsMap.get(t);
      if (!ep) { allOk = false; firstError = `no endpoint for ${t}`; continue; }
      try {
        const sig = await signWebhook(ep.secret, raw);
        const resp = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Marque-Signature": sig,
            "X-Marque-Signature": sig,
            "Marque-Event": ev.event_type,
            "X-Marque-Event": ev.event_type,
            "Marque-Event-Id": ev.id,
            "X-Marque-Event-Id": ev.id,
          },
          body: raw,
          signal: AbortSignal.timeout(15000),
        });

        if (!resp.ok) {
          allOk = false;
          firstError = `${t} HTTP ${resp.status}`;
        }
      } catch (e) {
        allOk = false;
        firstError = `${t} ${(e as Error).message}`;
      }
    }

    const attempts = (ev.attempts ?? 0) + 1;
    if (allOk) {
      await sb.from("platform_events").update({
        status: "delivered",
        attempts,
        delivered_at: now,
        last_error: null,
      }).eq("id", ev.id);
    } else if (attempts >= MAX_ATTEMPTS) {
      await sb.from("platform_events").update({
        status: "dead",
        attempts,
        last_error: firstError,
      }).eq("id", ev.id);
    } else {
      const delaySec = RETRY_DELAYS_SEC[Math.min(attempts - 1, RETRY_DELAYS_SEC.length - 1)];
      const nextRetry = new Date(Date.now() + delaySec * 1000).toISOString();
      await sb.from("platform_events").update({
        status: "retrying",
        attempts,
        next_retry_at: nextRetry,
        last_error: firstError,
      }).eq("id", ev.id);
    }
    processed++;
  }

  return jsonResponse({ processed });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _cors = PLATFORM_CORS;
