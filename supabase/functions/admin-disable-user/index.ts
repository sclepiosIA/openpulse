import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Token invalide' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify caller is a 2FA-enabled admin (strict). Disabling accounts is destructive
    // and must be gated identically to admin-create-user / admin-reset-user-password.
    const { data: isStrictAdmin, error: strictErr } = await supabaseAdmin
      .rpc('has_admin_role_strict', { _user_id: caller.id });

    if (strictErr || !isStrictAdmin) {
      return new Response(JSON.stringify({ error: 'Privilèges administrateur (avec 2FA) requis' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { target_profile_id } = await req.json();

    if (!target_profile_id) {
      return new Response(JSON.stringify({ error: 'target_profile_id requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get target profile
    const { data: targetProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, prenom, nom, email')
      .eq('id', target_profile_id)
      .single();

    if (profileErr || !targetProfile) {
      return new Response(JSON.stringify({ error: 'Profil introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Prevent self-disable
    if (targetProfile.user_id === caller.id) {
      return new Response(JSON.stringify({ error: 'Vous ne pouvez pas désactiver votre propre compte' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const targetUserId = targetProfile.user_id;
    const summary: Record<string, number> = {};

    // 1. Deactivate profile
    await supabaseAdmin
      .from('profiles')
      .update({ actif: false })
      .eq('id', target_profile_id);
    summary.profile_deactivated = 1;

    // 2. Revoke all sessions — change password to random UUID to invalidate any existing tokens
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();
    const { error: updatePwError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: randomPassword,
    });
    if (updatePwError) {
      console.error('[admin-disable-user] Error updating password:', updatePwError);
    }
    summary.password_invalidated = updatePwError ? 0 : 1;

    // 3. Delete push subscriptions
    const { data: pushDeleted } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', targetUserId)
      .select('id');
    summary.push_subscriptions_deleted = pushDeleted?.length || 0;

    // 4. Delete pulse_presence entries
    const { data: presenceDeleted } = await supabaseAdmin
      .from('pulse_presence')
      .delete()
      .eq('user_id', targetUserId)
      .select('id');
    summary.presence_deleted = presenceDeleted?.length || 0;

    // 5. Delete calendar feed tokens
    const { data: feedTokensDeleted } = await supabaseAdmin
      .from('calendar_feed_tokens')
      .delete()
      .or(`created_by_user_id.eq.${targetProfile.id},target_user_id.eq.${targetProfile.id}`)
      .select('id');
    summary.feed_tokens_deleted = feedTokensDeleted?.length || 0;

    // 6. Disable email sync (keep accounts for audit)
    const { data: emailAccounts } = await supabaseAdmin
      .from('user_email_accounts')
      .update({ sync_enabled: false })
      .eq('user_id', targetUserId)
      .select('id');
    summary.email_sync_disabled = emailAccounts?.length || 0;

    console.log(`[admin-disable-user] Disabled ${targetProfile.prenom} ${targetProfile.nom}:`, summary);

    return new Response(JSON.stringify({
      success: true,
      user: `${targetProfile.prenom} ${targetProfile.nom}`,
      summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[admin-disable-user] Error:', error);
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
