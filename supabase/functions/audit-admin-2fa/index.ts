import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

/**
 * Audit Edge Function: Admin 2FA Compliance Check
 * 
 * Runs daily via pg_cron to identify admin users without 2FA enabled.
 * Creates in-app notifications for admins to enable 2FA.
 * 
 * Schedule: Daily at 08:00 UTC
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Service-role / admin only (called via pg_cron). Block public callers.
  const auth = await validateServiceOrUser(req);
  if (!auth.authorized || !auth.isServiceCall) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[audit-admin-2fa] Starting admin 2FA compliance audit...');

    // 1. Find all admin users
    const { data: adminRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(100);

    if (rolesError) {
      console.error('[audit-admin-2fa] Error fetching admin roles:', rolesError);
      throw rolesError;
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log('[audit-admin-2fa] No admin users found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No admin users found',
        adminsWithout2FA: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const adminUserIds = adminRoles.map(r => r.user_id);

    // 2. Check which admins have 2FA disabled
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id, prenom, nom, email, two_factor_enabled')
      .in('user_id', adminUserIds);

    if (profilesError) {
      console.error('[audit-admin-2fa] Error fetching profiles:', profilesError);
      throw profilesError;
    }

    const adminsWithout2FA = (profiles || []).filter(p => !p.two_factor_enabled);

    console.log(`[audit-admin-2fa] Found ${adminsWithout2FA.length} admin(s) without 2FA`);

    // 3. Create notifications for admins without 2FA
    const notifications = [];
    for (const admin of adminsWithout2FA) {
      if (!admin.user_id) continue;

      notifications.push({
        user_id: admin.user_id,
        title: '🔒 Sécurité: 2FA non activé',
        message: 'Votre compte administrateur n\'a pas l\'authentification à deux facteurs activée. Veuillez l\'activer dans Paramètres > Sécurité.',
        type: 'security',
        related_type: 'security_audit',
        related_id: admin.id,
        is_read: false
      });
    }

    if (notifications.length > 0) {
      // Check for existing unread notifications to avoid spam
      const { data: existingNotifs } = await supabase
        .from('in_app_notifications')
        .select('user_id')
        .eq('type', 'security')
        .eq('related_type', 'security_audit')
        .eq('is_read', false)
        .in('user_id', notifications.map(n => n.user_id));

      const usersWithExistingNotif = new Set((existingNotifs || []).map(n => n.user_id));
      const newNotifications = notifications.filter(n => !usersWithExistingNotif.has(n.user_id));

      if (newNotifications.length > 0) {
        const { error: notifError } = await supabase
          .from('in_app_notifications')
          .insert(newNotifications);

        if (notifError) {
          console.error('[audit-admin-2fa] Error creating notifications:', notifError);
        } else {
          console.log(`[audit-admin-2fa] Created ${newNotifications.length} notification(s)`);
        }
      }
    }

    // 4. Log audit result
    const auditResult = {
      timestamp: new Date().toISOString(),
      total_admins: adminUserIds.length,
      admins_with_2fa: adminUserIds.length - adminsWithout2FA.length,
      admins_without_2fa: adminsWithout2FA.length,
      compliance_rate: ((adminUserIds.length - adminsWithout2FA.length) / adminUserIds.length * 100).toFixed(1) + '%'
    };

    console.log('[audit-admin-2fa] Audit complete:', auditResult);

    return new Response(JSON.stringify({
      success: true,
      ...auditResult,
      // PII removed from response — admin identities only in server logs
      adminsWithout2FA: adminsWithout2FA.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });


  } catch (error: any) {
    console.error('[audit-admin-2fa] Error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: sanitizeErrorForClient(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
