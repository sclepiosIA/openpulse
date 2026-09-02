import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { etablissement_id } = await req.json();
    if (!etablissement_id) {
      return new Response(JSON.stringify({ error: 'etablissement_id requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has access to this etablissement
    const { data: canView, error: rpcError } = await userClient.rpc('can_view_etablissement_data', {
      _etablissement_id: etablissement_id,
    });
    if (rpcError || !canView) {
      return new Response(JSON.stringify({ error: 'Accès refusé' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch last 20 email threads for this etablissement
    const { data: threads } = await supabase
      .from('email_threads')
      .select('subject, ai_generated_title, last_message_date, category')
      .eq('etablissement_id', etablissement_id)
      .eq('is_deleted', false)
      .order('last_message_date', { ascending: false })
      .limit(20);

    // Fetch last 20 customer activities
    const { data: activities } = await supabase
      .from('customer_activities')
      .select('activity_type, title, description, activity_date, metadata, status')
      .eq('etablissement_id', etablissement_id)
      .order('activity_date', { ascending: false })
      .limit(20);

    // Fetch etablissement name
    const { data: etab } = await supabase
      .from('etablissements')
      .select('nom')
      .eq('id', etablissement_id)
      .single();

    const etabName = etab?.nom || 'Établissement';

    // Build context for AI
    const emailsSummary = (threads || []).map(t => 
      `- [${t.last_message_date?.split('T')[0]}] ${t.ai_generated_title || t.subject} (${t.category || 'non classé'})`
    ).join('\n') || 'Aucun email récent';

    const activitiesSummary = (activities || []).map(a => {
      const meta = a.metadata as Record<string, unknown> || {};
      const duration = meta.duration_minutes ? ` (${meta.duration_minutes}min)` : '';
      return `- [${a.activity_date?.split('T')[0]}] ${a.activity_type}: ${a.title}${duration} — ${a.status}${a.description ? '\n  CR: ' + (a.description as string).substring(0, 200) : ''}`;
    }).join('\n') || 'Aucune activité récente';

    const systemPrompt = `Tu es un assistant expert en Customer Success Management. Tu analyses les communications avec un client pour produire une synthèse structurée. Réponds toujours en JSON valide.`;

    const userPrompt = `Analyse les communications récentes avec l'établissement "${etabName}" et produis une synthèse structurée.

## Emails récents
${emailsSummary}

## Interactions récentes (appels, visios, réunions, notes, LinkedIn, etc.)
${activitiesSummary}

Produis un JSON avec cette structure exacte :
{
  "summary": "Résumé global de 2-4 phrases sur l'état de la relation et les sujets en cours",
  "key_points": ["Point clé 1", "Point clé 2", ...],
  "pending_actions": ["Action à faire 1", "Action à faire 2", ...],
  "sentiment": "positif" | "neutre" | "négatif" | "mitigé",
  "last_contact_date": "YYYY-MM-DD ou null"
}

Règles :
- 3 à 6 key_points maximum
- 2 à 5 pending_actions maximum
- Le sentiment reflète la tonalité globale de la relation
- last_contact_date est la date du dernier échange (email ou activité)
- Sois concis et actionnable`;

    const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
    const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Configuration IA manquante' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    let azureResponse: Response;
    try {
      azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_completion_tokens: 2000,
          reasoning_effort: 'medium',
          verbosity: 'low',
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (azureResponse.status === 429) {
        await new Promise(r => setTimeout(r, 1000));
        azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': AZURE_OPENAI_API_KEY,
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_completion_tokens: 2000,
            reasoning_effort: 'medium',
            verbosity: 'low',
            response_format: { type: 'json_object' },
          }),
        });
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const err = error as Error;
      if (err.name === 'AbortError') {
        return new Response(JSON.stringify({ error: 'Timeout IA (90s)' }), {
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw error;
    }

    if (!azureResponse.ok) {
      const errText = await azureResponse.text();
      console.error('Azure error:', azureResponse.status, errText);
      return new Response(JSON.stringify({ error: 'Erreur du service IA' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const azureData = await azureResponse.json();
    const content = azureData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: 'Réponse IA vide' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = JSON.parse(content);

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('synthesize-communication error:', error);
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
