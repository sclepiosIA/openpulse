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
    if (!authHeader) {
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

    // Verify caller is a 2FA-enabled admin (strict). Offboarding is destructive and
    // must be gated identically to admin-create-user / admin-reset-user-password.
    const { data: isStrictAdmin, error: strictErr } = await supabaseAdmin
      .rpc('has_admin_role_strict', { _user_id: caller.id });

    if (strictErr || !isStrictAdmin) {
      return new Response(JSON.stringify({ error: 'Privilèges administrateur (avec 2FA) requis' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { target_profile_id, reassign_to_user_id } = await req.json();

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

    const targetUserId = targetProfile.user_id;
    const summary: Record<string, number> = {};

    // 1. Reassign taches
    const reassignValue = reassign_to_user_id || null;
    const { data: taches } = await supabaseAdmin
      .from('taches')
      .update({ responsable_id: reassignValue })
      .eq('responsable_id', targetProfile.id)
      .select('id');
    summary.taches_reassigned = taches?.length || 0;

    // 2. Reassign calendar events created_by
    const { data: eventsUpdated } = await supabaseAdmin
      .from('calendar_events')
      .update({ created_by: reassign_to_user_id || caller.id })
      .eq('created_by', targetProfile.id)
      .select('id');
    summary.events_reassigned = eventsUpdated?.length || 0;

    // 3. Get calendars owned by target
    const { data: calendars } = await supabaseAdmin
      .from('calendars')
      .select('id')
      .eq('owner_id', targetUserId);

    const calendarIds = (calendars || []).map(c => c.id);

    if (calendarIds.length > 0) {
      // Move orphan events to caller's default calendar
      const { data: callerCalendar } = await supabaseAdmin
        .from('calendars')
        .select('id')
        .eq('owner_id', caller.id)
        .eq('is_default', true)
        .single();

      if (callerCalendar) {
        const { data: movedEvents } = await supabaseAdmin
          .from('calendar_events')
          .update({ calendar_id: callerCalendar.id })
          .in('calendar_id', calendarIds)
          .select('id');
        summary.events_moved = movedEvents?.length || 0;
      }

      // Delete calendar shares
      const { data: sharesDeleted } = await supabaseAdmin
        .from('calendar_shares')
        .delete()
        .in('calendar_id', calendarIds)
        .select('id');
      summary.shares_deleted = sharesDeleted?.length || 0;

      // Delete calendar subscriptions
      await supabaseAdmin
        .from('calendar_subscriptions')
        .delete()
        .in('calendar_id', calendarIds);

      // Delete calendar feed tokens
      await supabaseAdmin
        .from('calendar_feed_tokens')
        .delete()
        .or(`created_by_user_id.eq.${targetProfile.id},target_user_id.eq.${targetProfile.id}`);

      // Delete calendars
      await supabaseAdmin
        .from('calendars')
        .delete()
        .in('id', calendarIds);
      summary.calendars_deleted = calendarIds.length;
    }

    // 4. Delete user_roles
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', targetUserId);
    summary.roles_deleted = 1;

    // 5. Deactivate email accounts (don't delete - keep for audit)
    const { data: emailAccounts } = await supabaseAdmin
      .from('user_email_accounts')
      .update({ is_active: false, sync_enabled: false })
      .eq('user_id', targetUserId)
      .select('id');
    summary.email_accounts_deactivated = emailAccounts?.length || 0;

    // 6. Mark profile as inactive (keep for RH documents)
    await supabaseAdmin
      .from('profiles')
      .update({ actif: false })
      .eq('id', target_profile_id);

    // 7. Delete push subscriptions
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', targetUserId);

    // 8. Delete auth.users entry (prevents login)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      summary.auth_deleted = 0;
    } else {
      summary.auth_deleted = 1;
    }

    console.log(`[offboard-user] Offboarded ${targetProfile.prenom} ${targetProfile.nom}:`, summary);

    return new Response(JSON.stringify({
      success: true,
      user: `${targetProfile.prenom} ${targetProfile.nom}`,
      summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[offboard-user] Error:', error);
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
