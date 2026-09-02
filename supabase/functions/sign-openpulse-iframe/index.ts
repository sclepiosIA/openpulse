// Edge function: sign-openpulse-iframe
// Signe (ts, OPENPULSE_IFRAME_SECRET) en HMAC-SHA256 et renvoie l'URL d'autologin
// d'un backend produit declare dans app_config.backend_urls.
// Reservee aux roles admin/direction.
//
// Remplace la fonction amont dont le nom de repertoire portait la marque de
// l'editeur et dont l'allowlist contenait deux hotes d'infrastructure en dur.
// Ici l'allowlist est fournie par l'exploitant via la variable d'environnement
// OPENPULSE_IFRAME_ALLOWED_HOSTS (hotes separes par des virgules, sans schema).
// Sans allowlist configuree, toute redirection est refusee (fail-closed) : c'est
// la garde anti open-redirect, elle ne doit jamais devenir permissive.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { sanitizeErrorForClient, safeErrorLog } from "../_shared/error-sanitizer.ts";
import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": origineAutorisee(),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function allowedHosts(): Set<string> {
  const raw = Deno.env.get("OPENPULSE_IFRAME_ALLOWED_HOSTS") ?? "";
  const hosts = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  return new Set<string>(hosts);
}

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
    const SECRET = Deno.env.get("OPENPULSE_IFRAME_SECRET");

    if (!SECRET) {
      console.error("[sign-openpulse-iframe] Secret absent");
      return jsonResponse(
        { error: "Service non configure (secret manquant)." },
        500,
      );
    }

    const hosts = allowedHosts();
    if (hosts.size === 0) {
      console.error("[sign-openpulse-iframe] Allowlist d'hotes vide");
      return jsonResponse(
        { error: "Service non configure (allowlist d'hotes vide)." },
        500,
      );
    }

    // 1. Authentification de l'appelant
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

    // 2. RBAC admin/direction
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: roleRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "direction"]);
    if (roleErr) {
      console.error("[sign-openpulse-iframe] Erreur de lecture des roles", roleErr);
      return jsonResponse({ error: "Erreur de verification des droits." }, 500);
    }
    if (!roleRows || roleRows.length === 0) {
      console.warn("[sign-openpulse-iframe] Acces refuse", { userId });
      return jsonResponse(
        { error: "Reserve aux roles admin et direction." },
        403,
      );
    }

    // 3. Lecture de l'environnement demande (compat body.backend et body.env)
    let backendKey = "openpulse-prod";
    let envParam: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        if (typeof body?.backend === "string" && body.backend.length > 0) {
          backendKey = body.backend;
        }
        if (typeof body?.env === "string" && body.env.length > 0) {
          envParam = body.env;
        }
      } catch {
        // corps illisible : on garde les valeurs par defaut
      }
    } else {
      const url = new URL(req.url);
      const qp = url.searchParams.get("backend");
      if (qp) backendKey = qp;
      const qe = url.searchParams.get("env");
      if (qe) envParam = qe;
    }

    if (envParam === "preprod") backendKey = "openpulse-preprod";
    else if (envParam === "prod") backendKey = "openpulse-prod";

    const configKey = backendKey.replace(/-/g, "_");

    // 4. Lecture de app_config.backend_urls puis controle d'allowlist
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
        { error: `Backend « ${backendKey} » non configure.` },
        400,
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(entry.url);
    } catch {
      return jsonResponse({ error: "URL backend invalide." }, 500);
    }
    if (!hosts.has(parsedUrl.host.toLowerCase())) {
      console.warn("[sign-openpulse-iframe] Hote hors allowlist", {
        host: parsedUrl.host,
      });
      return jsonResponse(
        { error: "Hote non autorise pour autologin." },
        400,
      );
    }

    // 5. Signature
    const ts = Math.floor(Date.now() / 1000);
    const sig = await hmacSha256Hex(SECRET, String(ts));

    // 6. URL finale : `${base}/user/login?autologin&type=openpulse&ts=...&sig=...`
    const base = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname.replace(/\/+$/, "")}`;
    const finalUrl = `${base}/user/login?autologin&type=openpulse&ts=${ts}&sig=${sig}`;

    const elapsed = Date.now() - startedAt;
    console.log("[sign-openpulse-iframe] OK", {
      userId,
      backendKey,
      host: parsedUrl.host,
      elapsed,
    });

    return jsonResponse({
      url: finalUrl,
      backend: backendKey,
      ts,
    });
  } catch (error) {
    console.error(
      "[sign-openpulse-iframe] Erreur",
      safeErrorLog("sign-openpulse-iframe", error),
    );
    return jsonResponse(
      { error: sanitizeErrorForClient(error) },
      500,
    );
  }
});
