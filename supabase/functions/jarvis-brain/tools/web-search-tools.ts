/**
 * JARVIS 12.0 - Web Search Tools
 * 
 * Recherche web via Brave Search API avec analyse GPT-5.
 * Fournit des résultats en temps réel avec synthèse intelligente.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  page_age?: string;
}

interface BraveSearchResponse {
  web?: {
    results: BraveSearchResult[];
  };
  news?: {
    results: BraveSearchResult[];
  };
}

/**
 * Recherche sur le web via Brave Search avec analyse GPT-5 optionnelle
 */
export async function executeWebSearch(
  ctx: ToolContext,
  args: {
    query: string;
    search_type?: 'web' | 'news';
    count?: number;
    freshness?: 'day' | 'week' | 'month' | 'year';
    country?: string;
    analyze?: boolean;
    analysis_focus?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    const BRAVE_API_KEY = Deno.env.get('BRAVE_SEARCH_API_KEY');
    
    if (!BRAVE_API_KEY) {
      return {
        success: false,
        error: 'Brave Search API non configurée. Veuillez ajouter le secret BRAVE_SEARCH_API_KEY.',
        execution_time_ms: Date.now() - start
      };
    }

    // Configuration de la requête Brave Search
    const searchCount = Math.min(args.count || 10, 20);
    const searchType = args.search_type || 'web';
    
    // Construire les paramètres
    const params = new URLSearchParams({
      q: args.query,
      count: searchCount.toString(),
      text_decorations: 'false',
      search_lang: 'fr',
      ui_lang: 'fr-FR',
    });

    if (args.freshness) {
      // Brave utilise 'pd' (past day), 'pw' (past week), 'pm' (past month), 'py' (past year)
      const freshnessMap: Record<string, string> = {
        'day': 'pd',
        'week': 'pw',
        'month': 'pm',
        'year': 'py'
      };
      params.append('freshness', freshnessMap[args.freshness] || 'pw');
    }

    if (args.country) {
      params.append('country', args.country);
    }

    // Appel à l'API Brave Search
    const endpoint = searchType === 'news' 
      ? 'https://api.search.brave.com/res/v1/news/search'
      : 'https://api.search.brave.com/res/v1/web/search';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[WebSearch] Brave API error:', response.status, errorText);
      throw new Error(`Brave Search API error: ${response.status}`);
    }

    const searchData: BraveSearchResponse = await response.json();
    
    // Extraire les résultats selon le type de recherche
    const rawResults = searchType === 'news' 
      ? searchData.news?.results || []
      : searchData.web?.results || [];

    // Formater les résultats
    const results = rawResults.slice(0, searchCount).map((r, index) => ({
      position: index + 1,
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age || r.page_age || null,
    }));

    // Si pas d'analyse demandée ou pas de résultats, retourner les résultats bruts
    if (args.analyze === false || results.length === 0) {
      return {
        success: true,
        data: {
          query: args.query,
          search_type: searchType,
          results,
          count: results.length,
          analyzed: false,
        },
        execution_time_ms: Date.now() - start
      };
    }

    // Analyse GPT-5 des résultats
    const AZURE_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
    const AZURE_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

    if (!AZURE_ENDPOINT || !AZURE_API_KEY) {
      // Retourner les résultats sans analyse si GPT-5 non configuré
      return {
        success: true,
        data: {
          query: args.query,
          search_type: searchType,
          results,
          count: results.length,
          analyzed: false,
          note: 'Azure GPT-5 non configuré pour l\'analyse'
        },
        execution_time_ms: Date.now() - start
      };
    }

    // Préparer le contexte pour GPT-5
    const resultsContext = results.map(r => 
      `[${r.position}] ${r.title}\nURL: ${r.url}\n${r.description}`
    ).join('\n\n');

    const analysisPrompt = args.analysis_focus 
      ? `Analyse ces résultats de recherche web en te concentrant sur: ${args.analysis_focus}`
      : 'Synthétise ces résultats de recherche web de manière concise et structurée';

    const systemPrompt = `Tu es un assistant de recherche expert. Analyse les résultats de recherche web et fournis une synthèse utile et actionnable pour un utilisateur professionnel. Cite les sources pertinentes avec leurs numéros [1], [2], etc. Réponds en français.`;

    const userPrompt = `Question de recherche: "${args.query}"

${analysisPrompt}

Résultats de recherche:
${resultsContext}

Fournis:
1. Une synthèse concise des informations clés
2. Les points importants à retenir
3. Les sources les plus pertinentes`;

    // Appel GPT-5 avec timeout
    const aiController = new AbortController();
    const aiTimeoutId = setTimeout(() => aiController.abort(), 60000);

    try {
      const aiResponse = await fetch(AZURE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 2000,
          reasoning_effort: 'low',
          verbosity: 'low',
        }),
        signal: aiController.signal,
      });

      clearTimeout(aiTimeoutId);

      if (!aiResponse.ok) {
        // Retourner les résultats sans analyse en cas d'erreur GPT-5
        console.warn('[WebSearch] GPT-5 analysis failed:', aiResponse.status);
        return {
          success: true,
          data: {
            query: args.query,
            search_type: searchType,
            results,
            count: results.length,
            analyzed: false,
            note: 'Analyse GPT-5 non disponible temporairement'
          },
          execution_time_ms: Date.now() - start
        };
      }

      const aiData = await aiResponse.json();
      const analysis = aiData.choices?.[0]?.message?.content || '';

      return {
        success: true,
        data: {
          query: args.query,
          search_type: searchType,
          analysis,
          results,
          count: results.length,
          analyzed: true,
          analysis_focus: args.analysis_focus || 'general',
          sources: results.map(r => ({ title: r.title, url: r.url })),
        },
        execution_time_ms: Date.now() - start
      };

    } catch (aiError) {
      clearTimeout(aiTimeoutId);
      console.warn('[WebSearch] GPT-5 analysis error:', aiError);
      
      // Retourner les résultats sans analyse
      return {
        success: true,
        data: {
          query: args.query,
          search_type: searchType,
          results,
          count: results.length,
          analyzed: false,
          note: 'Analyse GPT-5 timeout ou erreur'
        },
        execution_time_ms: Date.now() - start
      };
    }

  } catch (error) {
    console.error('[WebSearch] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Web search failed',
      execution_time_ms: Date.now() - start
    };
  }
}
