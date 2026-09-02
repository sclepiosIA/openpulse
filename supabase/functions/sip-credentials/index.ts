// Edge function: sip-credentials
// Renvoie les credentials SIP déchiffrés pour l'utilisateur authentifié.
// TTL court côté front : NE JAMAIS persister en localStorage.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { origineAutorisee } from '../_shared/cors.ts'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabase.rpc('get_sip_credentials');

    if (error) {
      console.error('[sip-credentials] RPC error:', error.message);
      return new Response(JSON.stringify({ error: 'Failed to fetch SIP credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: 'No active SIP configuration' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ credentials: data[0] }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (e: unknown) {
    return buildErrorResponse('sip-credentials', e, corsHeaders, 500);
  }

});
