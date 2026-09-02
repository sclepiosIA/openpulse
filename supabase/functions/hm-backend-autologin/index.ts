// Edge function: hm-backend-autologin
// Signe (ts, SECRET) en HMAC-SHA256 et renvoie l'URL d'autologin HM v2.
// Réservée aux rôles admin/direction. Allowlist anti-open-redirect.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { origineAutorisee } from '../_shared/cors.ts'
import { sanitizeErrorForClient, safeErrorLog } from "../_shared/error-sanitizer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Hosts HM autorisés pour autologin (anti open-redirect)
const ALLOWED_HOSTS = new Set<string>([
  "hm-v2.openpulse.example.org",
]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SECRET = Deno.env.get("HM_BACKEND_AUTOLOGIN_SECRET");

    if (!SECRET) {
      console.error("[hm-backend-autologin] Missing HM_BACKEND_AUTOLOGIN_SECRET");
      return jsonResponse(
        { error: "Service non configuré (secret manquant)." },
        500,
      );
    }

    // 1. Auth caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authentification requise." }, 401);
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Session invalide." }, 401);
    }
    const userId = userData.user.id;

    // 2. RBAC admin/direction (service role pour bypass RLS et éviter ambiguïté overload)
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: roleRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "direction"]);
    if (roleErr) {
      console.error("[hm-backend-autologin] role lookup error", roleErr);
      return jsonResponse({ error: "Erreur de vérification des droits." }, 500);
    }
    if (!roleRows || roleRows.length === 0) {
      console.warn("[hm-backend-autologin] Forbidden", { userId });
      return jsonResponse(
        { error: "Réservé aux rôles admin et direction." },
        403,
      );
    }

    // 3. Lecture backend key
    let backendKey = "hm-beta";
    if (req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        if (typeof body?.backend === "string" && body.backend.length > 0) {
          backendKey = body.backend;
        }
      } catch {
        // ignore
      }
    } else {
      const url = new URL(req.url);
      const qp = url.searchParams.get("backend");
      if (qp) backendKey = qp;
    }
    const configKey = backendKey.replace(/-/g, "_");

    // 4. Lookup app_config.backend_urls + allowlist
    const { data: cfgRow, error: cfgErr } = await supabaseUser
      .from("app_config")
      .select("value")
      .eq("key", "backend_urls")
      .maybeSingle();

    if (cfgErr || !cfgRow?.value) {
      return jsonResponse({ error: "Configuration backend introuvable." }, 500);
    }

    const entry = (cfgRow.value as Record<string, {
      url?: string;
      autologin?: string | boolean;
    }>)[configKey];

    if (!entry || !entry.url) {
      return jsonResponse(
        { error: `Backend « ${backendKey} » non configuré.` },
        400,
      );
    }
    if (!entry.autologin) {
      return jsonResponse(
        { error: `Backend « ${backendKey} » sans autologin activé.` },
        400,
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(entry.url);
    } catch {
      return jsonResponse({ error: "URL backend invalide." }, 500);
    }
    if (parsedUrl.pathname === "/backend") {
      parsedUrl.pathname = "/backend/";
    }
    if (!ALLOWED_HOSTS.has(parsedUrl.host)) {
      console.warn("[hm-backend-autologin] Host not in allowlist", {
        host: parsedUrl.host,
      });
      return jsonResponse(
        { error: "Hôte non autorisé pour autologin." },
        400,
      );
    }

    // 5. Signature
    const ts = Math.floor(Date.now() / 1000);
    const sig = await hmacSha256Hex(SECRET, String(ts));

    // 6. Construire URL finale (préserver query existante éventuelle)
    parsedUrl.searchParams.set("type", "marque");
    parsedUrl.searchParams.set("ts", String(ts));
    parsedUrl.searchParams.set("sig", sig);

    const elapsed = Date.now() - startedAt;
    console.log("[hm-backend-autologin] OK", {
      userId,
      backendKey,
      host: parsedUrl.host,
      elapsed,
    });

    return jsonResponse({
      url: parsedUrl.toString(),
      backend: backendKey,
      ts,
    });
  } catch (error) {
    console.error(
      "[hm-backend-autologin] Error",
      safeErrorLog("hm-backend-autologin", error),
    );
    return jsonResponse(
      { error: sanitizeErrorForClient(error) },
      500,
    );
  }
});
