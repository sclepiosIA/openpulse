import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { origineAutorisee } from '../_shared/cors.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ========== 1. API Key Authentication ==========
    const apiKeyHeader = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
    if (!apiKeyHeader) {
      return new Response(
        JSON.stringify({ error: "Missing X-API-Key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keyHash = await hashApiKey(apiKeyHeader);
    const keyPrefix = apiKeyHeader.substring(0, 12);

    const { data: apiKey, error: keyError } = await supabase
      .from("api_keys")
      .select("id, nom, permissions, rate_limit_per_minute, rate_limit_per_day, total_requests, est_active, expires_at, created_by")
      .eq("key_hash", keyHash)
      .eq("key_prefix", keyPrefix)
      .single();

    if (keyError || !apiKey) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiKey.est_active) {
      return new Response(
        JSON.stringify({ error: "API key is revoked" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "API key has expired" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check permissions
    const permissions = (apiKey.permissions as string[]) || [];
    if (!permissions.includes("write") && !permissions.includes("admin")) {
      return new Response(
        JSON.stringify({ error: "API key lacks 'write' permission" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== 2. Rate Limiting ==========
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    if (apiKey.rate_limit_per_minute) {
      const { count } = await supabase
        .from("api_logs")
        .select("id", { count: "exact", head: true })
        .eq("api_key_id", apiKey.id)
        .gte("created_at", oneMinuteAgo);

      if ((count || 0) >= apiKey.rate_limit_per_minute) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded (per minute)" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
        );
      }
    }

    if (apiKey.rate_limit_per_day) {
      const { count } = await supabase
        .from("api_logs")
        .select("id", { count: "exact", head: true })
        .eq("api_key_id", apiKey.id)
        .gte("created_at", oneDayAgo);

      if ((count || 0) >= apiKey.rate_limit_per_day) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded (per day)" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" } }
        );
      }
    }

    // ========== 3. Parse Request Body ==========
    const contentType = req.headers.get("content-type") || "";
    let titre = "";
    let description = "";
    let tags: string[] = [];
    let type_probleme = "autre";
    let priorite = "moyenne";
    let contact_nom = "";
    let contact_email = "";
    let etablissement_id: string | null = null;
    const files: { name: string; data: Uint8Array; type: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      titre = (formData.get("titre") as string) || "";
      description = (formData.get("description") as string) || "";
      type_probleme = (formData.get("type_probleme") as string) || "autre";
      priorite = (formData.get("priorite") as string) || "moyenne";
      contact_nom = (formData.get("contact_nom") as string) || "";
      contact_email = (formData.get("contact_email") as string) || "";
      etablissement_id = (formData.get("etablissement_id") as string) || null;

      const tagsStr = formData.get("tags") as string;
      if (tagsStr) {
        try {
          tags = JSON.parse(tagsStr);
        } catch {
          tags = tagsStr.split(",").map((t: string) => t.trim()).filter(Boolean);
        }
      }

      // Collect files
      const attachments = formData.getAll("attachments");
      for (const file of attachments) {
        if (file instanceof File) {
          if (files.length >= MAX_FILES) break;
          if (file.size > MAX_FILE_SIZE) {
            return new Response(
              JSON.stringify({ error: `File "${file.name}" exceeds 10 MB limit` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          const data = new Uint8Array(await file.arrayBuffer());
          files.push({ name: file.name, data, type: file.type || "application/octet-stream" });
        }
      }
    } else {
      // JSON body
      const body = await req.json();
      titre = body.titre || "";
      description = body.description || "";
      tags = body.tags || [];
      type_probleme = body.type_probleme || "autre";
      priorite = body.priorite || "moyenne";
      contact_nom = body.contact_nom || "";
      contact_email = body.contact_email || "";
      etablissement_id = body.etablissement_id || null;
    }

    // ========== 4. Validate ==========
    if (!titre || titre.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Field 'titre' is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (titre.length > 500) {
      return new Response(
        JSON.stringify({ error: "Field 'titre' must be under 500 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validPriorites = ["basse", "moyenne", "haute", "critique"];
    if (!validPriorites.includes(priorite)) {
      priorite = "moyenne";
    }

    const validTypes = ["bug", "fonctionnalite", "question", "amelioration", "autre"];
    if (!validTypes.includes(type_probleme)) {
      type_probleme = "autre";
    }

    // ========== 5. Create Ticket ==========
    const startTime = Date.now();

    const slaHours = priorite === "critique" ? 4 : priorite === "haute" ? 8 : priorite === "moyenne" ? 24 : 48;
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();

    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .insert({
        titre: titre.trim(),
        description: description?.trim() || null,
        type_probleme,
        priorite,
        contact_nom: contact_nom || null,
        contact_email: contact_email || null,
        etablissement_id,
        tags: tags.length > 0 ? tags : [],
        sla_deadline: slaDeadline,
      })
      .select("id, numero_ticket, titre, priorite, statut, created_at")
      .single();

    if (ticketError) {
      console.error("Error creating ticket:", ticketError);
      throw new Error("Failed to create ticket");
    }

    // ========== 6. Upload Attachments ==========
    const attachmentRecords: { file_name: string; storage_path: string; mime_type: string; file_size: number }[] = [];

    for (const file of files) {
      const storagePath = `${ticket.id}/${crypto.randomUUID()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("ticket-attachments")
        .upload(storagePath, file.data, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error(`Failed to upload ${file.name}:`, uploadError);
        continue;
      }

      attachmentRecords.push({
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.data.length,
      });
    }

    // Insert attachment records
    if (attachmentRecords.length > 0) {
      const { error: attachError } = await supabase
        .from("support_ticket_attachments")
        .insert(
          attachmentRecords.map((a) => ({
            ticket_id: ticket.id,
            file_name: a.file_name,
            file_size: a.file_size,
            mime_type: a.mime_type,
            storage_path: a.storage_path,
            uploaded_by_api_key_id: apiKey.id,
          }))
        );

      if (attachError) {
        console.error("Error inserting attachment records:", attachError);
      }
    }

    const durationMs = Date.now() - startTime;

    // ========== 7. Log API Call ==========
    await supabase.from("api_logs").insert({
      api_key_id: apiKey.id,
      endpoint: "/api-v1-tickets",
      method: "POST",
      status_code: 201,
      duration_ms: durationMs,
      request_body: { titre, type_probleme, priorite, tags, has_attachments: files.length > 0 },
      response_body: { ticket_id: ticket.id, numero_ticket: ticket.numero_ticket },
    });

    // Increment total_requests
    await supabase
      .from("api_keys")
      .update({
        total_requests: (apiKey.total_requests || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", apiKey.id);

    // ========== 8. Response ==========
    return new Response(
      JSON.stringify({
        success: true,
        ticket: {
          id: ticket.id,
          numero_ticket: ticket.numero_ticket,
          titre: ticket.titre,
          priorite: ticket.priorite,
          statut: ticket.statut,
          created_at: ticket.created_at,
          attachments_count: attachmentRecords.length,
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in api-v1-tickets:", error);

    // Log error
    try {
      const apiKeyHeader = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
      if (apiKeyHeader) {
        const keyHash = await hashApiKey(apiKeyHeader);
        const { data: apiKey } = await supabase
          .from("api_keys")
          .select("id")
          .eq("key_hash", keyHash)
          .single();

        if (apiKey) {
          await supabase.from("api_logs").insert({
            api_key_id: apiKey.id,
            endpoint: "/api-v1-tickets",
            method: "POST",
            status_code: 500,
            error_message: "Internal server error",
          });
        }
      }
    } catch {
      // Silent fail for error logging
    }

    return buildErrorResponse('api-v1-tickets', error, corsHeaders, 500);
  }
});
