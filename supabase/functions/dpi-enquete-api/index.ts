import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-api-key;

const TYPES = ['post_formation', 'ces', 'satisfaction', 'suivi_csm'] as const;
type EnqueteType = typeof TYPES[number];
const PATHS: Record<EnqueteType, string> = {
  post_formation: 'post-formation', ces: 'ces', satisfaction: 'satisfaction', suivi_csm: 'suivi-csm',
};

/**
 * API publique pour intégration DPI (Hôpital Manager, Résurgence, Mediboard…).
 * Sur appel : génère un token enquête + renvoie l'URL à afficher dans la pop-up.
 *
 * POST /functions/v1/dpi-enquete-api
 * Headers: X-API-Key: <clé DPI fournie par OpenPulse>
 * Body: { type, etablissement_external_id, user_external_id?, user_email?, user_nom? }
 *
 * Renvoie : { url, token, expires_at }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const apiKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'X-API-Key header requis' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Validation clé API : table api_keys (key_hash en SHA-256 hex, active=true, expires)
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const { data: keyRow } = await supabase
    .from('api_keys')
    .select('id, permissions, est_active, expires_at')
    .eq('key_hash', hashHex)
    .eq('est_active', true)
    .maybeSingle();

  if (!keyRow) {
    return new Response(JSON.stringify({ error: 'Clé API invalide' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'Clé API expirée' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // La cle doit porter une portee de plateforme. Sans ce controle, la portee
  // « read » -- valeur par defaut de la colonne -- suffisait a ecrire, alors
  // que cette fonction travaille avec le role de service et contourne donc la
  // securite au niveau ligne.
  const porteesCle: string[] = Array.isArray(keyRow.permissions) ? keyRow.permissions : [];
  if (!porteesCle.some((p) => typeof p === 'string' && p.startsWith('platform:'))) {
    return new Response(JSON.stringify({ error: 'Portée insuffisante pour cette API' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const type = body.type as EnqueteType;
    if (!TYPES.includes(type)) {
      return new Response(JSON.stringify({ error: 'type invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Établissement : scope éventuel dans permissions.etablissement_id, sinon lookup par external_id
    const perms = (keyRow.permissions || {}) as { etablissement_id?: string; system?: string };
    let etablissementId: string | null = perms.etablissement_id || null;
    if (!etablissementId && body.etablissement_external_id) {
      const q = supabase
        .from('client_external_ids')
        .select('etablissement_id')
        .eq('external_id', body.etablissement_external_id);
      if (perms.system) q.eq('system', perms.system);
      const { data: ext } = await q.maybeSingle();
      etablissementId = ext?.etablissement_id || null;
    }

    if (!etablissementId) {
      return new Response(JSON.stringify({ error: 'Établissement non identifiable' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Lookup ou création de l'utilisateur (par email)
    let userId: string | null = null;
    if (body.user_email) {
      const { data: u } = await supabase
        .from('etablissement_users')
        .select('id')
        .eq('etablissement_id', etablissementId)
        .eq('email', String(body.user_email).toLowerCase())
        .maybeSingle();
      userId = u?.id || null;
    }

    const { data: campagne, error } = await supabase
      .from('enquetes_campagnes')
      .insert({
        type,
        etablissement_id: etablissementId,
        user_id: userId,
        canal: 'dpi_popup',
        status: 'sent',
        sent_at: new Date().toISOString(),
        email_destinataire: body.user_email || null,
        metadata: { source: 'dpi_api', external_id: body.user_external_id || null },
      })
      .select('id, token_unique, expires_at')
      .single();

    if (error || !campagne) {
      return new Response(JSON.stringify({ error: 'Création campagne échouée' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = Deno.env.get('PUBLIC_APP_URL');
    const url = `${baseUrl}/enquete/${PATHS[type]}/${campagne.token_unique}`;

    // Log usage (optionnel)
    await supabase.from('api_logs').insert({
      api_key_id: keyRow.id,
      endpoint: 'dpi-enquete-api',
      method: 'POST',
      status_code: 200,
      request_body: { type, etablissement_id: etablissementId },
    }).then(() => null).catch(() => null);

    return new Response(JSON.stringify({
      url,
      token: campagne.token_unique,
      expires_at: campagne.expires_at,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('dpi-enquete-api error:', err);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
