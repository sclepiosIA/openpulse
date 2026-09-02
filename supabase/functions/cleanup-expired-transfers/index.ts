// Edge function: daily cleanup of expired or revoked email transfers.
// Removes storage objects and marks the transfer as purged.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, content-type, apikey;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const nowIso = new Date().toISOString();

    // Find transfers to purge: expired or revoked, and not yet purged
    const { data: transfers, error } = await supabase
      .from("email_transfers")
      .select("id, token, expires_at, revoked_at")
      .is("purged_at", null)
      .or(`expires_at.lt.${nowIso},revoked_at.not.is.null`)
      .limit(500);

    if (error) throw error;
    if (!transfers || transfers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, purged: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let purgedFiles = 0;
    let purgedTransfers = 0;

    for (const t of transfers) {
      const { data: files } = await supabase
        .from("email_transfer_files")
        .select("storage_path")
        .eq("transfer_id", t.id);

      if (files && files.length > 0) {
        const paths = files.map((f: any) => f.storage_path);
        const { error: rmErr } = await supabase.storage
          .from("email-transfers")
          .remove(paths);
        if (rmErr) {
          console.warn(`Storage remove failed for ${t.token}:`, rmErr.message);
        } else {
          purgedFiles += paths.length;
        }
      }

      const { error: upErr } = await supabase
        .from("email_transfers")
        .update({ purged_at: nowIso })
        .eq("id", t.id);

      if (!upErr) purgedTransfers++;
    }

    console.log(
      `cleanup-expired-transfers: purged ${purgedTransfers} transfers, ${purgedFiles} files`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        purged_transfers: purgedTransfers,
        purged_files: purgedFiles,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("cleanup-expired-transfers error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
