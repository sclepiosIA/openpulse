import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const RequestSchema = z.object({
  account_id: z.string().uuid().optional(),
  dry_run: z.boolean().default(true),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { account_id, dry_run } = parsed.data;
    const stalwartUrl = Deno.env.get("STALWART_URL") || "http://stalwart:8080";

    // Fetch accounts to migrate
    let query = supabase
      .from("user_email_accounts")
      .select("id, email_address, imap_host, imap_port, sync_method, is_active, sync_enabled")
      .eq("is_active", true)
      .eq("sync_enabled", true)
      .eq("sync_method", "imap");

    if (account_id) {
      query = query.eq("id", account_id);
    }

    const { data: accounts, error: accountsError } = await query;
    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    console.log(`🔄 Found ${accounts?.length || 0} IMAP accounts to evaluate for JMAP migration`);

    const results: Array<{
      account_id: string;
      email: string;
      status: string;
      jmap_reachable: boolean;
      message: string;
    }> = [];

    for (const account of accounts || []) {
      try {
        console.log(`📧 Evaluating ${account.email_address}...`);

        // Step 1: Check JMAP connectivity to Stalwart
        let jmapReachable = false;
        try {
          const resp = await fetch(`${stalwartUrl}/.well-known/jmap`, {
            signal: AbortSignal.timeout(10000),
          });
          jmapReachable = resp.ok;
        } catch {
          jmapReachable = false;
        }

        if (!jmapReachable) {
          results.push({
            account_id: account.id,
            email: account.email_address,
            status: "skipped",
            jmap_reachable: false,
            message: "Stalwart JMAP endpoint unreachable",
          });
          continue;
        }

        // Step 2: Verify account exists in Stalwart
        // In a real implementation, we'd check via Stalwart admin API
        // For now, we verify JMAP session discovery works

        if (dry_run) {
          results.push({
            account_id: account.id,
            email: account.email_address,
            status: "ready",
            jmap_reachable: true,
            message: `Dry run: account eligible for JMAP migration (current: ${account.imap_host}:${account.imap_port})`,
          });
          continue;
        }

        // Step 3: Switch sync_method to JMAP
        const { error: updateError } = await supabase
          .from("user_email_accounts")
          .update({ sync_method: "jmap" })
          .eq("id", account.id);

        if (updateError) {
          throw new Error(`Failed to update sync_method: ${updateError.message}`);
        }

        // Step 4: Trigger initial JMAP sync
        const { data: syncResult, error: syncError } = await supabase.functions.invoke(
          "sync-emails-jmap",
          { body: { account_id: account.id, historical_backfill: false } }
        );

        if (syncError) {
          // Rollback on failure
          await supabase
            .from("user_email_accounts")
            .update({ sync_method: "imap" })
            .eq("id", account.id);

          throw new Error(`JMAP sync test failed, rolled back: ${syncError.message}`);
        }

        results.push({
          account_id: account.id,
          email: account.email_address,
          status: "migrated",
          jmap_reachable: true,
          message: `Successfully migrated to JMAP. Initial sync: ${syncResult?.messages_synced || 0} messages`,
        });

        console.log(`✅ ${account.email_address} migrated to JMAP`);
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`❌ Migration failed for ${account.email_address}:`, errorMsg);
        results.push({
          account_id: account.id,
          email: account.email_address,
          status: "failed",
          jmap_reachable: false,
          message: errorMsg,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        total_accounts: accounts?.length || 0,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Migration error:", error);
    return buildErrorResponse('migrate-to-jmap', error, corsHeaders, 500);
  }
});
