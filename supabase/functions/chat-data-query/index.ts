import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { origineAutorisee } from '../_shared/cors.ts'
import { createClient } from "@supabase/supabase-js";
import { logAICall, extractUsage, createTimer } from "../_shared/ai-logging.ts";
import { sanitizeForAI, wrapUserContent, logSecurityEvent } from "../_shared/security-utils.ts";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Cache global pour le schéma (persiste entre invocations dans la même instance)
let schemaCache: { content: string; fetchedAt: number } | null = null;
const SCHEMA_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Tables whitelistées pour l'introspection
const WHITELISTED_TABLES = [
  'etablissements',
  'contacts',
  'taches',
  'email_threads',
  'email_messages',
  'customer_health_metrics',
  'customer_activities',
  'profiles',
  'email_to_etablissement_suggestions',
  'partenaires',
  'groupes_etablissements'
];

// 🔒 SECURITY: tables the AI is allowed to query through execute_readonly_query.
// We extend WHITELISTED_TABLES with information_schema.columns so the live
// schema introspection (see getLiveSchemaSnapshot) keeps working without
// granting access to sensitive tables (rh_salaires_mensuels, profiles_sensitive,
// system_config, security_config, rgpd_*, etc.).
const QUERY_ALLOWED_TABLES = new Set<string>([
  ...WHITELISTED_TABLES,
  'information_schema.columns',
  'columns', // information_schema unqualified
]);

/**
 * Extract referenced table names (FROM/JOIN/UPDATE/INTO) and verify each one
 * is in QUERY_ALLOWED_TABLES. Throws if any reference is not allowed.
 * Defense-in-depth: even if the AI ignores the prompt, we reject the SQL
 * before it reaches the SECURITY DEFINER RPC that bypasses RLS.
 */
function assertTablesAllowed(sql: string): void {
  // Strip string literals and comments to avoid false matches.
  const stripped = sql
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

  // Match identifiers after FROM / JOIN / INTO / UPDATE.
  // Supports schema-qualified names (information_schema.columns) and
  // double-quoted identifiers.
  const re = /\b(?:FROM|JOIN|INTO|UPDATE)\s+("?[\w.]+"?)/gi;
  const refs = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const raw = m[1].replace(/"/g, '').toLowerCase();
    // Take last 2 components at most (schema.table)
    const parts = raw.split('.');
    const table = parts.length >= 2 ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}` : parts[0];
    refs.add(table);
  }

  for (const ref of refs) {
    const tableOnly = ref.includes('.') ? ref.split('.').pop()! : ref;
    if (!QUERY_ALLOWED_TABLES.has(ref) && !QUERY_ALLOWED_TABLES.has(tableOnly)) {
      throw new Error(`Forbidden table reference: ${ref}`);
    }
  }
}

// Relations clés statiques
const KEY_RELATIONSHIPS = `
## RELATIONS CLÉS :
- taches.etablissement_id → etablissements.id
- contacts.etablissement_id → etablissements.id
- customer_health_metrics.etablissement_id → etablissements.id (1-to-1)
- customer_activities.etablissement_id → etablissements.id
- email_threads.etablissement_id → etablissements.id
- email_threads.partenaire_id → partenaires.id
- etablissements.commercial_id → profiles.id
- etablissements.csm_id → profiles.id
- etablissements.chef_projet_id → profiles.id
`;

/**
 * Récupère un snapshot du schéma en temps réel avec cache
 */
async function getLiveSchemaSnapshot(supabaseClient: any): Promise<string> {
  const now = Date.now();
  
  // Vérifier le cache
  if (schemaCache && (now - schemaCache.fetchedAt) < SCHEMA_CACHE_TTL_MS) {
    console.log('📦 Schema cache hit (age:', Math.round((now - schemaCache.fetchedAt) / 1000), 'seconds)');
    return schemaCache.content;
  }

  console.log('🔍 Fetching live schema snapshot...');
  const schemaLines: string[] = ['# SCHÉMA BASE DE DONNÉES CRM (Live Snapshot)\n'];

  try {
    for (const tableName of WHITELISTED_TABLES) {
      const query = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${tableName}'
        ORDER BY ordinal_position
      `.trim();

      const { data, error } = await supabaseClient.rpc('execute_readonly_query', {
        query_text: query
      });

      if (error) {
        console.warn(`⚠️ Failed to fetch schema for ${tableName}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        schemaLines.push(`\n## ${tableName}`);
        const cols = data.map((col: any) => 
          `${col.column_name} (${col.data_type}${col.is_nullable === 'NO' ? ', NOT NULL' : ''})`
        ).join(', ');
        schemaLines.push(cols);
      }
    }

    schemaLines.push(KEY_RELATIONSHIPS);

    const schemaContent = schemaLines.join('\n');
    schemaCache = { content: schemaContent, fetchedAt: now };
    
    console.log('✅ Schema snapshot cached (size:', schemaContent.length, 'chars)');
    return schemaContent;

  } catch (error) {
    console.error('❌ Schema introspection failed:', error);
    // Fallback: schéma statique minimal
    return `# SCHÉMA BASE DE DONNÉES CRM (Fallback)
    
Tables disponibles : ${WHITELISTED_TABLES.join(', ')}

Principales colonnes :
- etablissements : id, nom, ville, region, statut, type, commercial_id, csm_id
- contacts : id, nom, prenom, email, etablissement_id
- taches : id, titre, statut, priorite, etablissement_id, assigne_a, date_echeance
- customer_health_metrics : etablissement_id, health_score, adoption_rate, nps_score
${KEY_RELATIONSHIPS}`;
  }
}

/**
 * Extrait un mot-clé plausible pour les suggestions
 */
function extractKeyword(userQuestion: string): string | null {
  // Nettoyer et extraire les mots significatifs
  const words = userQuestion
    .toLowerCase()
    .replace(/[^\wÀ-ÿ\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['avec', 'pour', 'dans', 'comment', 'quelle', 'quel'].includes(w));
  
  // Prendre le dernier mot capitalisé ou le plus long
  return words.length > 0 ? words[words.length - 1] : null;
}

/**
 * Génère des suggestions d'établissements si aucun résultat.
 * Utilise PostgREST (paramétré) au lieu de concaténation SQL pour éviter toute injection.
 */
async function getSuggestions(supabaseClient: any, keyword: string): Promise<any[]> {
  if (!keyword || keyword.length < 3) return [];

  // Sanitize: retire les caractères de contrôle PostgREST et les wildcards LIKE
  const safeKeyword = keyword
    .replace(/[(),."\\%_]/g, '')
    .trim()
    .substring(0, 100);

  if (safeKeyword.length < 3) return [];

  try {
    const pattern = `%${safeKeyword}%`;
    const { data, error } = await supabaseClient
      .from('etablissements')
      .select('id, nom, ville, region, statut')
      .or(`nom.ilike.${pattern},ville.ilike.${pattern}`)
      .limit(10);

    if (error || !data) {
      console.warn('⚠️ Suggestions query failed:', error?.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Suggestions error:', error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const __start = Date.now();

  try {
    console.log('📥 chat-data-query invoked');
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader || "";
    
    if (!token) {
      console.error('❌ No auth token provided');
      return new Response(JSON.stringify({ error: 'Missing authentication token. Please reconnect.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('❌ Auth error:', userError?.message || 'No user');
      return new Response(JSON.stringify({ error: 'Invalid or expired token. Please reconnect.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('✅ User authenticated:', user.id);

    // 🔒 SECURITY: Restrict free-form SQL execution to admin/direction roles only.
    // execute_readonly_query runs with SECURITY DEFINER via a service-role client,
    // bypassing RLS — so we must gate it strictly.
    const { data: rolesData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const allowedRoles = new Set(['admin', 'direction']);
    const hasAccess = (rolesData ?? []).some((r: any) => allowedRoles.has(r.role));
    if (!hasAccess) {
      console.warn('🚫 chat-data-query: forbidden for user', user.id);
      return new Response(JSON.stringify({ error: 'Forbidden: this feature is restricted to admin/direction roles.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 🔒 SECURITY: enforce 2FA-strict admin check (same gate that protects
    // sensitive tables via has_admin_role_strict). Without this, an admin
    // without 2FA could indirectly reach restricted tables through the
    // SECURITY DEFINER RPC.
    const { data: strictOk, error: strictErr } = await supabaseClient.rpc('has_admin_role_strict', { user_id: user.id });
    if (strictErr || strictOk !== true) {
      console.warn('🚫 chat-data-query: 2FA strict check failed for user', user.id, strictErr?.message);
      return new Response(JSON.stringify({ error: 'Forbidden: 2FA is required to use the data assistant.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { question, conversationHistory = [] } = await req.json();

    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 🔒 SECURITY: Sanitize user question before AI processing
    const sanitizedQuestion = sanitizeForAI(question, {
      maxLength: 1000,
      strictMode: false,
      functionName: 'chat-data-query'
    });

    console.log('📝 Question:', sanitizedQuestion);

    // Azure OpenAI Configuration
    const azureEndpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT');
    const azureApiKey = Deno.env.get('AZURE_OPENAI_API_KEY');

    if (!azureEndpoint || !azureApiKey) {
      throw new Error('Azure OpenAI credentials not configured');
    }

    // 1. RÉCUPÉRER LE SCHÉMA LIVE
    const liveSchema = await getLiveSchemaSnapshot(supabaseClient);
    const usedSchemaCache = schemaCache !== null && (Date.now() - schemaCache.fetchedAt) < SCHEMA_CACHE_TTL_MS;

    // 2. CONSTRUIRE LE PROMPT SQL RENFORCÉ
    const sqlGenerationMessages = [
      {
        role: 'system',
        content: `Tu es un expert SQL qui génère des requêtes PostgreSQL READ-ONLY pour interroger une base CRM.

${liveSchema}

RÈGLES STRICTES :
1. Génère UNIQUEMENT des requêtes SELECT ou WITH (CTE)
2. JAMAIS de INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, GRANT, REVOKE
3. Limite maximale : 100 lignes (ajoute LIMIT 100 si non spécifié)
4. Colonnes ENUM (statut, priorite, type, etc.) : utilise '=' OU CAST(col AS text) ILIKE pour recherche partielle
5. JAMAIS ILIKE directement sur un ENUM sans CAST
6. Dates : utilise TO_CHAR(date_col, 'YYYY-MM-DD') pour affichage lisible
7. Alias clairs pour toutes les colonnes dans le SELECT
8. Utilise UNIQUEMENT les colonnes listées ci-dessus
9. Pour recherches de noms d'établissements : génère des patterns robustes avec ILIKE '%terme%' et variantes (CH, Centre Hospitalier, Hopital/Hôpital)

TEMPLATES RAPIDES :
- Etablissement + health : SELECT e.*, chm.health_score FROM etablissements e LEFT JOIN customer_health_metrics chm ON e.id = chm.etablissement_id WHERE ...
- Tâches d'un établissement : SELECT t.* FROM taches t WHERE t.etablissement_id = (SELECT id FROM etablissements WHERE nom ILIKE '%...%' LIMIT 1)
- Contacts : SELECT c.* FROM contacts c WHERE c.etablissement_id = ...

IMPORTANT : Réponds UNIQUEMENT avec le SQL, sans markdown ni explication.`
      },
      {
        role: 'user',
        content: `Question utilisateur : "${wrapUserContent(sanitizedQuestion, 'USER_QUESTION')}"

Historique récent (contexte) :
${conversationHistory.slice(-4).map((m: any) => `${m.role}: ${sanitizeForAI(m.content || '', { maxLength: 500, functionName: 'chat-data-query' })}`).join('\n')}

Génère la requête SQL PostgreSQL appropriée.`
      }
    ];

    console.log('🤖 Calling Azure OpenAI for SQL generation...');
    
    // Timeout controller
    const sqlController = new AbortController();
    const sqlTimeoutId = setTimeout(() => sqlController.abort(), 90000);

    let sqlResponse;
    let retryCount = 0;
    const maxRetries = 1;

    while (retryCount <= maxRetries) {
      try {
        sqlResponse = await fetch(azureEndpoint!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': azureApiKey,
          },
          body: JSON.stringify({
            messages: sqlGenerationMessages,
            max_completion_tokens: 300,
            reasoning_effort: 'low',
            verbosity: 'low'
          }),
          signal: sqlController.signal
        });

        if (sqlResponse.status === 429) {
          retryCount++;
          if (retryCount > maxRetries) throw new Error('Rate limit exceeded after retry');
          console.warn('⚠️ Rate limited, retrying in 2s...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        if (!sqlResponse.ok) {
          const errorText = await sqlResponse.text();
          throw new Error(`Azure API error (${sqlResponse.status}): ${errorText}`);
        }

        break;
      } catch (error: any) {
        clearTimeout(sqlTimeoutId);
        if (error.name === 'AbortError') {
          throw new Error('SQL generation timeout (90s)');
        }
        throw error;
      }
    }

    clearTimeout(sqlTimeoutId);

    const sqlResult = await sqlResponse!.json();
    const firstChoice = sqlResult.choices?.[0];
    
    // Logs détaillés pour diagnostique
    console.log('📊 Azure response finish_reason:', firstChoice?.finish_reason);
    console.log('📊 Azure response usage:', JSON.stringify(sqlResult.usage));
    
    const rawContent = firstChoice?.message?.content?.trim() || '';
    
    if (!rawContent) {
      console.warn('⚠️ Empty content from Azure, returning error to client');
      return new Response(JSON.stringify({
        error: 'Le modèle n\'a pas pu générer de réponse. Merci de reformuler votre question.',
        success: false,
        timing: Date.now() - __start
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sqlQuery = rawContent
      .replace(/```sql\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()
      .replace(/;\s*$/, '');

    // Vérification de sécurité basique
    const upperSQL = sqlQuery.toUpperCase();
    const forbiddenKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE'];
    for (const keyword of forbiddenKeywords) {
      if (upperSQL.includes(keyword)) {
        throw new Error(`Forbidden SQL operation: ${keyword}`);
      }
    }

    // 🔒 SECURITY: enforce table allowlist (defense-in-depth against AI prompt
    // injection like "show me all rows from rh_salaires_mensuels").
    assertTablesAllowed(sqlQuery);

    // Ajouter LIMIT si absent
    if (!upperSQL.includes('LIMIT')) {
      sqlQuery += ' LIMIT 50';
    }

    console.log('🔍 Generated SQL:', sqlQuery.substring(0, 200) + '...');

    // 4. EXÉCUTION DU SQL
    let queryData;
    let queryError;
    let correctedSQL = null;

    try {
      const { data, error } = await supabaseClient.rpc('execute_readonly_query', {
        query_text: sqlQuery
      });

      queryData = data;
      queryError = error;

    } catch (error: any) {
      queryError = error;
    }

    // 5. RETRY SI ERREUR ENUM/ILIKE
    if (queryError && queryError.message?.includes('ILIKE') && queryError.message?.match(/type\s+\w+_\w+/i)) {
      console.warn('⚠️ ENUM error detected, retrying with CAST...');
      
      const retryPrompt = `La requête SQL a échoué avec cette erreur :
${queryError.message}

SQL original :
${sqlQuery}

CORRECTION NÉCESSAIRE : Cette erreur indique qu'on utilise ILIKE sur une colonne ENUM. 
Utilise CAST(colonne AS text) ILIKE '%valeur%' à la place.

Génère la version CORRIGÉE du SQL (sans markdown).`;

      const retryMessages = [
        { role: 'system', content: sqlGenerationMessages[0].content },
        { role: 'user', content: retryPrompt }
      ];

      try {
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 60000);

        const retryResponse = await fetch(azureEndpoint!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': azureApiKey,
          },
          body: JSON.stringify({
            messages: retryMessages,
            max_completion_tokens: 300,
            reasoning_effort: 'low',
            verbosity: 'low'
          }),
          signal: retryController.signal
        });

        clearTimeout(retryTimeoutId);

        if (retryResponse.ok) {
          const retryResult = await retryResponse.json();
          correctedSQL = retryResult.choices?.[0]?.message?.content
            ?.trim()
            .replace(/```sql\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim()
            .replace(/;\s*$/, '');

          if (correctedSQL) {
            console.log('🔄 Retrying with corrected SQL...');
            // 🔒 SECURITY: re-enforce table allowlist on the AI-corrected SQL.
            assertTablesAllowed(correctedSQL);
            const { data: retryData, error: retryError } = await supabaseClient.rpc('execute_readonly_query', {
              query_text: correctedSQL
            });

            if (!retryError) {
              queryData = retryData;
              queryError = null;
              sqlQuery = correctedSQL;
            } else {
              queryError = retryError;
            }
          }
        }
      } catch (retryErr) {
        console.error('❌ Retry failed:', retryErr);
      }
    }

    // 6. SI 0 RÉSULTAT → FALLBACK SUGGESTIONS
    let suggestions: any[] = [];
    let usedFallback = false;

    if (!queryError && (!queryData || queryData.length === 0)) {
      console.log('📭 Zero results, attempting fallback...');
      const keyword = extractKeyword(question);
      
      if (keyword) {
        console.log('🔎 Searching suggestions for keyword:', keyword);
        suggestions = await getSuggestions(supabaseClient, keyword);
        usedFallback = suggestions.length > 0;
        
        if (usedFallback) {
          console.log(`💡 Found ${suggestions.length} suggestions`);
        }
      }
    }

    // 7. ÉCHEC SQL → ERREUR
    if (queryError) {
      console.error('❌ SQL execution failed:', queryError.message, '| SQL:', sqlQuery);
      return new Response(JSON.stringify({
        error: sanitizeErrorForClient(queryError),
        success: false
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultData = queryData || [];
    const rowCount = resultData.length;

    console.log(`✅ Query executed successfully: ${rowCount} rows`);

    // 8. ANALYSE DES RÉSULTATS
    let analysisText = '';

    if (rowCount === 0 && suggestions.length > 0) {
      analysisText = `Aucun résultat exact trouvé. Voici des établissements similaires qui pourraient correspondre :`;
    } else if (rowCount === 0) {
      analysisText = `Aucun résultat trouvé pour cette requête.`;
    } else {
      // Générer analyse avec GPT-5
      const analysisMessages = [
        {
          role: 'system',
          content: `Tu es un assistant CRM qui analyse des résultats de requêtes.

RÈGLES :
1. Réponds en français, 2-3 phrases maximum
2. Format : texte brut (PAS de SQL, PAS de code, PAS de markdown)
3. Mentionne les insights clés (nombres, tendances, points d'attention)
4. Ton professionnel et concis
5. Si plusieurs résultats : synthétise les tendances
6. Si 1 résultat : détaille les infos importantes`
        },
        {
          role: 'user',
          content: `Question : "${question}"

Résultats (${rowCount} lignes) :
${JSON.stringify(resultData.slice(0, 5), null, 2)}

Analyse ces résultats en français.`
        }
      ];

      try {
        const analysisController = new AbortController();
        const analysisTimeoutId = setTimeout(() => analysisController.abort(), 60000);

        const analysisResponse = await fetch(azureEndpoint!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': azureApiKey,
          },
          body: JSON.stringify({
            messages: analysisMessages,
            max_completion_tokens: 250,
            reasoning_effort: 'low',
            verbosity: 'low'
          }),
          signal: analysisController.signal
        });

        clearTimeout(analysisTimeoutId);

        if (analysisResponse.ok) {
          const analysisResult = await analysisResponse.json();
          analysisText = analysisResult.choices?.[0]?.message?.content?.trim() || `${rowCount} résultat(s) trouvé(s).`;
          
          // Sanitize : enlever code/SQL si présent
          analysisText = analysisText
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`[^`]+`/g, '')
            .trim();
        }
      } catch (error) {
        console.warn('⚠️ Analysis generation failed, using fallback');
        analysisText = `${rowCount} résultat(s) trouvé(s).`;
      }
    }

    const elapsed = Date.now() - __start;
    console.log(`⏱️ Total execution time: ${elapsed}ms`);

    // Log to ai_processing_log for dashboard
    await logAICall({
      processing_type: 'data_query',
      model_used: 'gpt-5',
      processing_duration_ms: elapsed,
      success: true,
      result: { row_count: rowCount, used_fallback: usedFallback },
    });

    // 9. RÉPONSE FINALE
    return new Response(JSON.stringify({
      success: true,
      analysis: analysisText,
      data: resultData,
      rowCount,
      suggestions,
      timing: elapsed,
      flags: {
        usedSchemaCache,
        usedFallback
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Global error:', error);
    const elapsed = Date.now() - __start;
    
    return new Response(JSON.stringify({
      error: error.message || 'Une erreur inattendue est survenue',
      success: false,
      timing: elapsed
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
