import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

/**
 * DocSpace Upload Edge Function
 * 
 * Uploads a document from Supabase Storage to DocSpace for editing.
 * Returns the DocSpace file ID for use in the editor.
 */

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DOCSPACE_URL = Deno.env.get("ONLYOFFICE_DOCSPACE_URL");
    const API_KEY = Deno.env.get("ONLYOFFICE_API_KEY");

    if (!DOCSPACE_URL || !API_KEY) {
      throw new Error("DocSpace configuration missing");
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { documentId, folderId } = body;

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "Missing documentId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get document info via user-scoped client so RLS applies (ownership / folder permissions)
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(document.storage_bucket)
      .download(document.storage_path);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download document" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload to DocSpace using the Files API (official sample for "My Documents")
    // DocSpace API: POST /api/2.0/files/{folderId}/upload
    const docspaceAuth = API_KEY.startsWith("Bearer ") ? API_KEY : `Bearer ${API_KEY}`;
    const targetFolderId = folderId || "@my";

    const fileBuffer = await fileData.arrayBuffer();
    const file = new File([fileBuffer], document.name, { type: document.mime_type });

    const formData = new FormData();
    formData.append("file", file);

    const uploadResponse = await fetch(
      `${DOCSPACE_URL}/api/2.0/files/${targetFolderId}/upload`,
      {
        method: "POST",
        headers: {
          "Authorization": docspaceAuth,
        },
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("DocSpace upload failed:", uploadResponse.status, errorText);
      return new Response(
        JSON.stringify({
          error: "Failed to upload to DocSpace",
          details: errorText,
          status: uploadResponse.status,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uploadResult = await uploadResponse.json();
    console.log("DocSpace upload result:", JSON.stringify(uploadResult));

    // Extract the file ID from the response
    const docSpaceFileId =
      uploadResult?.response?.id ||
      uploadResult?.response?.file?.id ||
      uploadResult?.id ||
      uploadResult?.file?.id;

    if (!docSpaceFileId) {
      console.error("No file ID in response:", uploadResult);
      return new Response(
        JSON.stringify({ error: "No file ID returned from DocSpace" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store the mapping for later retrieval
    await supabaseAdmin
      .from("documents")
      .update({
        source_type: "docspace",
        source_id: String(docSpaceFileId),
      })
      .eq("id", documentId);

    return new Response(
      JSON.stringify({
        success: true,
        docSpaceFileId,
        documentId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('docspace-upload', error, corsHeaders, 500);
  }
});
