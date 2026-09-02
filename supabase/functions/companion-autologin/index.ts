import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateUserAuth } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

const DEDICATED_EMAIL = "formation-client@exploitant.example.org";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Require authenticated caller
  const auth = await validateUserAuth(req);
  if ('error' in auth) {
    return jsonResponse({ error: 'Unauthorized', code: 'unauthorized' }, 401);
  }

  // RBAC: restrict to admin/direction (same pattern as hm-backend-autologin)
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const callerId = (auth as { userId: string }).userId;
    const { data: roleRows, error: roleErr } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .in('role', ['admin', 'direction']);
    if (roleErr) {
      console.error('[companion-autologin] role lookup error', roleErr);
      return jsonResponse({ error: 'Erreur de vérification des droits.', code: 'role_lookup_failed' }, 500);
    }
    if (!roleRows || roleRows.length === 0) {
      return jsonResponse({ error: 'Réservé aux rôles admin et direction.', code: 'forbidden' }, 403);
    }
  } catch (e) {
    console.error('[companion-autologin] RBAC check crashed', e);
    return jsonResponse({ error: 'Erreur de vérification des droits.', code: 'role_lookup_failed' }, 500);
  }

  try {
    const companionUrl = Deno.env.get("COMPANION_SUPABASE_URL");
    const companionServiceKey = Deno.env.get("COMPANION_SERVICE_ROLE_KEY");
    const companionAppUrl = Deno.env.get("COMPANION_APP_URL");

    // Validate presence of required secrets
    if (!companionUrl || !companionServiceKey) {
      console.error("[companion-autologin] Missing required env vars");
      return jsonResponse({
        error: "Configuration serveur manquante pour le compagnon.",
        code: "missing_companion_config",
      }, 500);
    }

    // Validate COMPANION_SUPABASE_URL format
    //
    // L'hôte devait auparavant finir par `.supabase.co`, ce qui réservait cette
    // fonction aux projets hébergés par l'éditeur. Or l'installateur d'OpenPulse
    // met en place un Supabase auto-hébergé, dont l'hôte est celui de
    // l'exploitant : la règle excluait donc le déploiement de référence. Ce qui
    // importe pour la sécurité est le transport chiffré, pas le nom de domaine.
    try {
      const parsed = new URL(companionUrl);
      if (parsed.protocol !== "https:") {
        throw new Error("Not a valid Supabase URL");
      }
    } catch {
      console.error("[companion-autologin] Invalid COMPANION_SUPABASE_URL format (HTTPS required)");
      return jsonResponse({
        error: "L'URL du compagnon est mal configurée. Contactez le support.",
        code: "invalid_companion_config",
      }, 500);
    }

    // Create admin client for the companion Supabase project
    const companionAdmin = createClient(companionUrl, companionServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Generate a magic link for the dedicated premium account
    const { data, error } = await companionAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: DEDICATED_EMAIL,
    });

    if (error) {
      console.error("[companion-autologin] generateLink error:", error.message);
      return jsonResponse({
        error: "Impossible de générer le lien d'accès.",
        code: "link_generation_failed",
      }, 500);
    }

    const hashedToken = data?.properties?.hashed_token;

    if (!hashedToken) {
      console.error("[companion-autologin] No hashed_token in response");
      return jsonResponse({
        error: "Token d'accès non généré.",
        code: "no_hashed_token",
      }, 500);
    }

    // Build the companion app URL with token_hash for PKCE-compatible auth
    const baseUrl = (companionAppUrl || 'https://marque-ai-companion.apercu.example.org').replace(/\/$/, '');
    const autologinUrl = `${baseUrl}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink&next=/dashboard`;

    console.log("[companion-autologin] Autologin URL generated successfully");
    return jsonResponse({ url: autologinUrl });
  } catch (err: unknown) {
    return buildErrorResponse('companion-autologin', err, corsHeaders, 500);
  }
});
