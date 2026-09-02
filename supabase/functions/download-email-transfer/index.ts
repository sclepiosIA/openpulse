// Edge function: public endpoint to fetch transfer metadata, validate password,
// and stream/download individual files.
//
// Routes (via query params):
//   GET  ?token=XYZ                    → metadata { sender, files[], expires_at, password_required }
//   POST { token, password }           → returns { ok: true } if password matches (sets session-less validation)
//   GET  ?token=XYZ&file=<id>&p=<pwd>  → streams the file (or 401 if password wrong)
//
// No auth required (public link). Token is the only secret.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { origineAutorisee } from '../_shared/cors.ts'
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-transfer-password",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function verifyPassword(
  password: string,
  hash: string | null,
): Promise<boolean> {
  if (!hash) return true;
  const parts = hash.split(":");
  if (parts.length !== 3 || parts[0] !== "sha256") return false;
  const [, salt, expected] = parts;
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const got = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return got === expected;
}

async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip + (Deno.env.get("VAPID_SUBJECT") || "salt")),
  );
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token");
    let fileId = url.searchParams.get("file");
    let password = url.searchParams.get("p");

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      token = body.token ?? token;
      password = body.password ?? password;
    }

    if (!token) {
      return new Response(JSON.stringify({ error: "Token manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch transfer
    const { data: transfer, error: tErr } = await supabase
      .from("email_transfers")
      .select(
        "id, token, sender_email, subject, message, password_hash, notify_on_download, owner_id, expires_at, purged_at, revoked_at, file_count, total_size_bytes, download_count",
      )
      .eq("token", token)
      .maybeSingle();

    if (tErr || !transfer) {
      return new Response(JSON.stringify({ error: "Transfert introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (transfer.purged_at || transfer.revoked_at) {
      return new Response(
        JSON.stringify({ error: "Transfert révoqué ou expiré" }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (new Date(transfer.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Transfert expiré" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── METADATA (GET without file) ────────────────────────────────────
    if (req.method === "GET" && !fileId) {
      const { data: files } = await supabase
        .from("email_transfer_files")
        .select("id, filename, mime_type, size_bytes")
        .eq("transfer_id", transfer.id)
        .order("created_at", { ascending: true });

      return new Response(
        JSON.stringify({
          token: transfer.token,
          sender_email: transfer.sender_email,
          subject: transfer.subject,
          message: transfer.message,
          expires_at: transfer.expires_at,
          file_count: transfer.file_count,
          total_size_bytes: transfer.total_size_bytes,
          download_count: transfer.download_count,
          password_required: !!transfer.password_hash,
          files: files ?? [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── PASSWORD VERIFY (POST) ─────────────────────────────────────────
    if (req.method === "POST" && !fileId) {
      const ok = await verifyPassword(password ?? "", transfer.password_hash);
      return new Response(JSON.stringify({ ok }), {
        status: ok ? 200 : 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── FILE DOWNLOAD (GET with file) ──────────────────────────────────
    if (transfer.password_hash) {
      const pwdHeader = req.headers.get("x-transfer-password") ?? password;
      const ok = await verifyPassword(pwdHeader ?? "", transfer.password_hash);
      if (!ok) {
        return new Response(JSON.stringify({ error: "Mot de passe requis" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: file, error: fErr } = await supabase
      .from("email_transfer_files")
      .select("id, filename, mime_type, size_bytes, storage_path")
      .eq("transfer_id", transfer.id)
      .eq("id", fileId)
      .maybeSingle();

    if (fErr || !file) {
      return new Response(JSON.stringify({ error: "Fichier introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: blob, error: dlErr } = await supabase.storage
      .from("email-transfers")
      .download(file.storage_path);

    if (dlErr || !blob) {
      console.error("Storage download failed:", dlErr);
      return new Response(
        JSON.stringify({ error: "Fichier indisponible" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Log download (best-effort)
    try {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const ipHash = await hashIp(ip);
      await supabase.from("email_transfer_downloads").insert({
        transfer_id: transfer.id,
        file_id: file.id,
        ip_hash: ipHash,
        user_agent: req.headers.get("user-agent")?.slice(0, 255) ?? null,
      });
      await supabase
        .from("email_transfers")
        .update({ download_count: transfer.download_count + 1 })
        .eq("id", transfer.id);
    } catch (e) {
      console.warn("download log failed", e);
    }

    const safeName = file.filename.replace(/"/g, "");
    return new Response(blob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": file.mime_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": String(file.size_bytes),
      },
    });
  } catch (error) {
    console.error("download-email-transfer error:", error);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
