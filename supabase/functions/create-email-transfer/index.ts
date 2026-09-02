// Edge function: create an email transfer record after files have been uploaded
// to the `email-transfers` bucket from the browser.
//
// Body: {
//   subject, message, recipient_emails: string[],
//   retention_days: 3 | 7 | 30,
//   password?: string,
//   notify_on_download?: boolean,
//   files: Array<{ filename, mime_type, size_bytes, storage_path }>
// }
//
// Returns: { token, public_url, expires_at, total_size_bytes }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { origineAutorisee } from '../_shared/cors.ts'
import { createClient } from "@supabase/supabase-js";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024; // 2 Go
const MAX_ACTIVE_TRANSFERS = 10;
const MAX_ACTIVE_BYTES = 10 * 1024 * 1024 * 1024; // 10 Go quota par user
const ALLOWED_RETENTION = [3, 7, 30];

const PUBLIC_BASE_URL =
  Deno.env.get('PUBLIC_APP_URL');

async function hashPassword(password: string): Promise<string> {
  // Argon-equivalent unavailable in Deno edge runtime; use SHA-256 with salt prefix.
  // This is acceptable for transfer links that already require a unique token.
  const salt = crypto.randomUUID();
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${salt}:${hash}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      sender_email,
      subject,
      message,
      recipient_emails = [],
      retention_days = 7,
      password,
      notify_on_download = false,
      files = [],
    } = body;

    // ── Validation ─────────────────────────────────────────────────────
    if (!Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: "Aucun fichier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (files.length > MAX_FILES) {
      return new Response(
        JSON.stringify({ error: `Maximum ${MAX_FILES} fichiers` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!ALLOWED_RETENTION.includes(Number(retention_days))) {
      return new Response(
        JSON.stringify({ error: "Durée de rétention invalide (3/7/30 j)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const totalSize = files.reduce(
      (s: number, f: any) => s + Number(f.size_bytes || 0),
      0,
    );
    if (totalSize > MAX_TOTAL_BYTES) {
      return new Response(
        JSON.stringify({ error: "Taille totale > 2 Go" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check user quota
    const { data: activeTransfers } = await supabase
      .from("email_transfers")
      .select("id, total_size_bytes")
      .eq("owner_id", user.id)
      .is("purged_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString());

    const activeCount = activeTransfers?.length ?? 0;
    const activeBytes =
      activeTransfers?.reduce(
        (s, t: any) => s + Number(t.total_size_bytes || 0),
        0,
      ) ?? 0;

    if (activeCount >= MAX_ACTIVE_TRANSFERS) {
      return new Response(
        JSON.stringify({
          error: `Quota atteint : ${MAX_ACTIVE_TRANSFERS} transferts actifs max`,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (activeBytes + totalSize > MAX_ACTIVE_BYTES) {
      return new Response(
        JSON.stringify({ error: "Quota global de 10 Go atteint" }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Token + expiration ─────────────────────────────────────────────
    const token = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(
      Date.now() + Number(retention_days) * 24 * 60 * 60 * 1000,
    ).toISOString();

    const passwordHash = password ? await hashPassword(password) : null;

    // ── Insert transfer ────────────────────────────────────────────────
    const { data: transfer, error: insertError } = await supabase
      .from("email_transfers")
      .insert({
        token,
        owner_id: user.id,
        sender_email: sender_email || user.email,
        subject: subject || null,
        message: message || null,
        recipient_emails,
        password_hash: passwordHash,
        notify_on_download: !!notify_on_download,
        total_size_bytes: totalSize,
        file_count: files.length,
        expires_at: expiresAt,
      })
      .select("id, token, expires_at, total_size_bytes")
      .single();

    if (insertError || !transfer) {
      console.error("Insert transfer failed:", insertError);
      return new Response(
        JSON.stringify({ error: "Création du transfert impossible" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Insert files ───────────────────────────────────────────────────
    const fileRows = files.map((f: any) => ({
      transfer_id: transfer.id,
      filename: String(f.filename).slice(0, 255),
      mime_type: f.mime_type || "application/octet-stream",
      size_bytes: Number(f.size_bytes || 0),
      storage_path: String(f.storage_path),
    }));

    const { error: filesError } = await supabase
      .from("email_transfer_files")
      .insert(fileRows);

    if (filesError) {
      console.error("Insert files failed:", filesError);
      // rollback
      await supabase.from("email_transfers").delete().eq("id", transfer.id);
      return new Response(
        JSON.stringify({ error: "Création des fichiers impossible" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        token: transfer.token,
        public_url: `${PUBLIC_BASE_URL}/transfer/${transfer.token}`,
        expires_at: transfer.expires_at,
        total_size_bytes: transfer.total_size_bytes,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("create-email-transfer error:", error);
    return new Response(
      JSON.stringify({ error: sanitizeErrorForClient(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
