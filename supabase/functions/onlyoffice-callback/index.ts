import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

/**
 * OnlyOffice Callback Handler
 * 
 * This function handles callbacks from OnlyOffice Document Server when:
 * - status 1: Document is being edited (no action needed)
 * - status 2: Document is ready for saving after editing
 * - status 3: Document saving error (log and respond)
 * - status 4: Document closed with no changes (no action needed)
 * - status 6: Document is being edited but force save requested
 * - status 7: Error occurred during force save
 */

interface OnlyOfficeCallback {
  status: number;
  url?: string; // URL to download the modified document
  key: string;  // Document key
  users?: string[];
  actions?: Array<{ type: number; userid: string }>;
  changesurl?: string;
  history?: any;
  forcesavetype?: number;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ONLYOFFICE_JWT_SECRET = Deno.env.get("ONLYOFFICE_JWT_SECRET");
    const ONLYOFFICE_DOCUMENT_SERVER_URL = Deno.env.get("ONLYOFFICE_DOCUMENT_SERVER_URL");

    // SECURITY: validate OnlyOffice JWT (sent in Authorization: Bearer <token>)
    if (!ONLYOFFICE_JWT_SECRET) {
      console.error("ONLYOFFICE_JWT_SECRET not configured — refusing callback");
      return new Response(JSON.stringify({ error: 1 }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!bearer) {
      console.error("Missing OnlyOffice JWT in callback");
      return new Response(JSON.stringify({ error: 1 }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    try {
      await jose.jwtVerify(bearer, new TextEncoder().encode(ONLYOFFICE_JWT_SECRET));
    } catch (e) {
      console.error("Invalid OnlyOffice JWT:", e);
      return new Response(JSON.stringify({ error: 1 }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const documentId = url.searchParams.get("documentId");

    if (!documentId) {
      console.error("Missing documentId in callback");
      return new Response(
        JSON.stringify({ error: 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callback: OnlyOfficeCallback = await req.json();
    console.log(`OnlyOffice callback for ${documentId}:`, JSON.stringify(callback));

    // SECURITY: restrict callback.url to the configured OnlyOffice server host
    if (callback.url && ONLYOFFICE_DOCUMENT_SERVER_URL) {
      try {
        const allowedHost = new URL(ONLYOFFICE_DOCUMENT_SERVER_URL).host;
        const cbHost = new URL(callback.url).host;
        if (cbHost !== allowedHost) {
          console.error(`Callback URL host ${cbHost} not in allowlist (${allowedHost})`);
          return new Response(JSON.stringify({ error: 1 }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: 1 }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create admin client for storage operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    switch (callback.status) {
      case 1: // Being edited
        console.log("Document is being edited");
        break;

      case 2: // Ready for saving
      case 6: // Force save requested
        if (!callback.url) {
          console.error("No URL provided for saving");
          return new Response(
            JSON.stringify({ error: 1 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          // 1. Get current document info
          const { data: document, error: docError } = await supabaseAdmin
            .from("documents")
            .select("*")
            .eq("id", documentId)
            .single();

          if (docError || !document) {
            console.error("Document not found:", docError);
            return new Response(
              JSON.stringify({ error: 1 }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // 2. Download the modified document from OnlyOffice
          console.log("Downloading modified document from:", callback.url);
          const docResponse = await fetch(callback.url);
          
          if (!docResponse.ok) {
            throw new Error(`Failed to download document: ${docResponse.status}`);
          }

          const fileBlob = await docResponse.blob();
          const fileBuffer = await fileBlob.arrayBuffer();

          // 3. Upload to Supabase Storage (overwrite existing)
          const { error: uploadError } = await supabaseAdmin.storage
            .from(document.storage_bucket)
            .upload(document.storage_path, fileBuffer, {
              contentType: document.mime_type,
              upsert: true,
            });

          if (uploadError) {
            console.error("Failed to upload document:", uploadError);
            return new Response(
              JSON.stringify({ error: 1 }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // 4. Update document metadata
          const { error: updateError } = await supabaseAdmin
            .from("documents")
            .update({
              updated_at: new Date().toISOString(),
              file_size_bytes: fileBuffer.byteLength,
            })
            .eq("id", documentId);

          if (updateError) {
            console.error("Failed to update document metadata:", updateError);
          }

          // 5. Log audit entry
          const userId = callback.actions?.[0]?.userid;
          if (userId) {
            await supabaseAdmin.from("document_audit_log").insert({
              document_id: documentId,
              action: callback.status === 6 ? "force_saved" : "saved",
              performed_by: userId,
              new_value: {
                size: fileBuffer.byteLength,
                saved_at: new Date().toISOString(),
              },
            });
          }

          console.log("Document saved successfully");
        } catch (saveError: any) {
          console.error("Error saving document:", saveError);
          return new Response(
            JSON.stringify({ error: 1 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;

      case 3: // Saving error
        console.error("OnlyOffice reported saving error");
        break;

      case 4: // Closed without changes
        console.log("Document closed without changes");
        break;

      case 7: // Force save error
        console.error("OnlyOffice force save error");
        break;

      default:
        console.log("Unknown status:", callback.status);
    }

    // OnlyOffice expects { error: 0 } for success
    return new Response(
      JSON.stringify({ error: 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in onlyoffice-callback:", error);
    return new Response(
      JSON.stringify({ error: 1 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
