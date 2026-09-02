import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ONLYOFFICE_JWT_SECRET = Deno.env.get("ONLYOFFICE_JWT_SECRET");
    const ONLYOFFICE_DOCUMENT_SERVER_URL = Deno.env.get("ONLYOFFICE_DOCUMENT_SERVER_URL");

    if (!ONLYOFFICE_JWT_SECRET || !ONLYOFFICE_DOCUMENT_SERVER_URL) {
      throw new Error("OnlyOffice configuration missing");
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    // Handle getServerUrl action
    if (body.action === "getServerUrl") {
      return new Response(
        JSON.stringify({ serverUrl: ONLYOFFICE_DOCUMENT_SERVER_URL }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate JWT token for OnlyOffice
    // SECURITY: derive identity from session — ignore client-provided userId/userName
    // SECURITY: re-generate signed URL server-side from documentId (prevent SSRF via attacker-controlled URL)
    const { documentId } = body;

    if (!documentId || typeof documentId !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid documentId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Lookup document via user-scoped client — RLS enforces access
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, storage_bucket, storage_path")
      .eq("id", documentId)
      .maybeSingle();

    if (docError || !doc?.storage_bucket || !doc?.storage_path) {
      return new Response(
        JSON.stringify({ error: "Document not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side signed URL (8h) — trusted origin only
    const { data: urlData, error: urlError } = await supabase.storage
      .from(doc.storage_bucket as string)
      .createSignedUrl(doc.storage_path as string, 3600 * 8);

    if (urlError || !urlData?.signedUrl) {
      return new Response(
        JSON.stringify({ error: "Unable to sign document URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const documentUrl = urlData.signedUrl;

    const sessionUserId = claimsData.user.id;
    let sessionUserName: string = claimsData.user.email ?? "User";
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nom, prenom, full_name")
        .eq("id", sessionUserId)
        .maybeSingle();
      if (profile) {
        sessionUserName = (profile as any).full_name
          || [((profile as any).prenom ?? ""), ((profile as any).nom ?? "")].filter(Boolean).join(" ").trim()
          || sessionUserName;
      }
    } catch { /* fallback to email */ }

    // Create JWT payload for OnlyOffice
    const secret = new TextEncoder().encode(ONLYOFFICE_JWT_SECRET);

    const payload = {
      document: {
        url: documentUrl,
      },
      editorConfig: {
        user: {
          id: sessionUserId,
          name: sessionUserName,
        },
      },
    };


    const jwtToken = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(secret);

    return new Response(
      JSON.stringify({ 
        token: jwtToken,
        documentUrl,
        serverUrl: ONLYOFFICE_DOCUMENT_SERVER_URL 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );


  } catch (error: unknown) {
    return buildErrorResponse('onlyoffice-token', error, corsHeaders, 500);
  }
});

