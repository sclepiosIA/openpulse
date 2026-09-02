import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth required
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

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Role check: only commercial / admin / direction can create financial documents
    const { data: roleRows } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['commercial', 'admin', 'direction']);

    if (!roleRows || roleRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Permissions insuffisantes' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action } = body as { action: string };

    if (action === 'create_devis') {
      const { etablissement_id, client_nom, client_email, montant_ht, date_validite } = body;

      if (!client_nom) {
        return new Response(JSON.stringify({ error: 'Nom du client requis' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const montantHt = parseFloat(montant_ht) || 0;

      const { data, error } = await serviceClient.from('devis').insert({
        client_nom,
        client_email: client_email || null,
        etablissement_id: etablissement_id || null,
        montant_ht: montantHt,
        montant_tva: montantHt * 0.2,
        montant_ttc: montantHt * 1.2,
        date_validite: date_validite || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: user.id,
        statut: 'brouillon',
      }).select('id').single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, id: data.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'create_avoir') {
      const {
        facture_id, etablissement_id, client_nom, client_email, client_adresse,
        client_siret, montant_ht, motif, motif_detail, notes_internes
      } = body;

      if (!client_nom || !facture_id) {
        return new Response(JSON.stringify({ error: 'Nom du client et facture requis' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const montantHt = parseFloat(montant_ht) || 0;
      const montantTva = montantHt * 0.2;
      const montantTtc = montantHt + montantTva;

      const { data, error } = await serviceClient.from('avoirs').insert({
        facture_id,
        etablissement_id: etablissement_id || null,
        client_nom,
        client_email: client_email || null,
        client_adresse: client_adresse || null,
        client_siret: client_siret || null,
        montant_ht: montantHt,
        montant_tva: montantTva,
        montant_ttc: montantTtc,
        motif,
        motif_detail: motif_detail || null,
        notes_internes: notes_internes || null,
        created_by: user.id,
        statut: 'brouillon',
      }).select('id').single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, id: data.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: `Action inconnue: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    return buildErrorResponse('facturation-actions', error, corsHeaders, 500);
  }
});
