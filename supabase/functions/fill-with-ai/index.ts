/**
 * fill-with-ai - Enrichit et catégorise des listes d'établissements ou contacts par lots via GPT-5.4
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGpt5Mini } from "../_shared/azure-gpt5-mini.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

type EntityType = 'etablissements' | 'contacts';

interface EnrichField {
  field: string;
  label: string;
  instruction?: string;
}

interface RequestBody {
  entity_type: EntityType;
  items: Array<{ id: string; [key: string]: unknown }>;
  fields_to_enrich: EnrichField[];
  custom_instructions?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // V2d hardening — per-token rate limit (bulk AI enrichment)
    const rlKey = `fill-with-ai:${authHeader.slice(-32)}`;
    const rl = checkRateLimit(rlKey, { limit: 5, windowSec: 60 });
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Trop de requêtes, veuillez patienter.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec ?? 60) }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentification invalide' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    const { entity_type, items, fields_to_enrich, custom_instructions } = body;

    if (!entity_type || !items?.length || !fields_to_enrich?.length) {
      return new Response(JSON.stringify({ error: 'Paramètres manquants: entity_type, items, fields_to_enrich' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (items.length > 50) {
      return new Response(JSON.stringify({ error: 'Maximum 50 éléments par lot' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fieldDescriptions = fields_to_enrich.map(f => 
      `- "${f.field}" (${f.label})${f.instruction ? `: ${f.instruction}` : ''}`
    ).join('\n');

    const entityLabel = entity_type === 'etablissements' ? 'établissements de santé' : 'contacts professionnels';

    const systemPrompt = `Tu es un assistant spécialisé dans l'enrichissement de données CRM pour des ${entityLabel} en France.

Tu reçois une liste d'éléments avec leurs données actuelles, et tu dois enrichir/compléter les champs demandés.

Règles absolues:
- Réponds UNIQUEMENT en JSON valide (un tableau d'objets)
- Chaque objet du tableau doit contenir "id" (identique à l'entrée) et les champs enrichis
- N'invente PAS de données factuelles (numéros, emails, adresses précises)
- Pour les catégorisations/classifications, utilise ton expertise du secteur de la santé français
- Si tu ne peux pas enrichir un champ, mets null
- Sois cohérent dans les catégories utilisées à travers tous les éléments

Champs à enrichir:
${fieldDescriptions}
${custom_instructions ? `\nInstructions supplémentaires: ${custom_instructions}` : ''}`;

    // Serialize items, limiting data to avoid token explosion
    const itemsSerialized = items.map(item => {
      const serialized: Record<string, unknown> = { id: item.id };
      for (const [key, value] of Object.entries(item)) {
        if (key === 'id') continue;
        if (typeof value === 'string' && value.length > 300) {
          serialized[key] = value.substring(0, 300) + '...';
        } else {
          serialized[key] = value;
        }
      }
      return serialized;
    });

    const userPrompt = `Enrichis ces ${items.length} ${entityLabel}:

${JSON.stringify(itemsSerialized, null, 2)}

Réponds avec un tableau JSON contenant pour chaque élément: { "id": "...", ${fields_to_enrich.map(f => `"${f.field}": "..."`).join(', ')} }`;

    const result = await callGpt5Mini(systemPrompt, userPrompt, {
      maxTokens: 4000,
      timeout: 90000,
      jsonOutput: true,
    });

    // Parse the AI response
    let enrichedItems: Array<{ id: string; [key: string]: unknown }>;
    try {
      const parsed = JSON.parse(result.content);
      enrichedItems = Array.isArray(parsed) ? parsed : parsed.items || parsed.results || [];
    } catch {
      // Try to extract JSON array from the response
      const match = result.content.match(/\[[\s\S]*\]/);
      if (match) {
        enrichedItems = JSON.parse(match[0]);
      } else {
        throw new Error('Impossible de parser la réponse IA');
      }
    }

    // Validate that each item has an id
    enrichedItems = enrichedItems.filter(item => item.id && items.some(orig => orig.id === item.id));

    return new Response(JSON.stringify({
      success: true,
      enriched_items: enrichedItems,
      total_processed: enrichedItems.length,
      total_requested: items.length,
      fields_enriched: fields_to_enrich.map(f => f.field),
      usage: result.usage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[fill-with-ai] Error:', error);
    return buildErrorResponse('fill-with-ai', error, corsHeaders, 500);
  }
});
