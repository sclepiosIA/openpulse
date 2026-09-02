import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

type Action = 'archive' | 'unarchive' | 'spam' | 'unspam' | 'read' | 'unread' | 'processed' | 'delete' | 'undelete';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, thread_ids } = await req.json() as { action: Action; thread_ids: string[] };

    if (!action || !thread_ids || !Array.isArray(thread_ids) || thread_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'action et thread_ids requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (thread_ids.length > 500) {
      return new Response(JSON.stringify({ error: 'Maximum 500 threads par opération' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use service role for the actual update
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Ownership check: fetch the email account IDs the caller can access
    // (personal accounts via profile_id OR shared accounts).
    const { data: accounts, error: acctErr } = await serviceClient
      .from('user_email_accounts')
      .select('id')
      .or(`profile_id.eq.${user.id},is_shared.eq.true`);

    if (acctErr) throw acctErr;

    const allowedAccountIds = (accounts ?? []).map((a: { id: string }) => a.id);
    if (allowedAccountIds.length === 0) {
      return new Response(JSON.stringify({ success: true, affected: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let updateData: Record<string, unknown>;

    switch (action) {
      case 'archive':
        updateData = { is_archived: true };
        break;
      case 'unarchive':
        updateData = { is_archived: false };
        break;
      case 'spam':
        updateData = { is_spam: true };
        break;
      case 'unspam':
        updateData = { is_spam: false };
        break;
      case 'read':
        updateData = { unread_count: 0 };
        break;
      case 'unread':
        updateData = { unread_count: 1 };
        break;
      case 'processed':
        updateData = {
          is_processed: true,
          processed_at: new Date().toISOString(),
          processed_by: user.id,
          unread_count: 0,
        };
        break;
      case 'delete':
        updateData = { is_deleted: true };
        break;
      case 'undelete':
        updateData = { is_deleted: false };
        break;
      default:
        return new Response(JSON.stringify({ error: `Action inconnue: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const { error, count } = await serviceClient
      .from('email_threads')
      .update(updateData, { count: 'exact' })
      .in('id', thread_ids)
      .in('user_email_account_id', allowedAccountIds);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, affected: count ?? 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    return buildErrorResponse('email-bulk-actions', error, corsHeaders, 500);
  }
});
