/**
 * JARVIS 15.0 - Web Scraping Tools (Native, No External API)
 * 
 * Outils pour extraire du contenu de pages web sans dépendance payante.
 */

import { ToolExecutionContext, ToolResult } from "../tools-executor.ts";

/**
 * Execute web_scrape tool
 * Extrait le contenu d'une page web (texte, markdown, liens, métadonnées)
 */
export async function executeWebScrape(
  ctx: ToolExecutionContext,
  args: {
    url: string;
    formats?: ('text' | 'markdown' | 'html' | 'links' | 'metadata')[];
    maxLength?: number;
    selector?: string;
    includeImages?: boolean;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  console.log(`[executeWebScrape] 🌐 URL: ${args.url}`);
  console.log(`[executeWebScrape] Formats: ${args.formats?.join(', ') || 'text'}`);
  
  try {
    // Appeler l'Edge Function jarvis-web-scrape
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/jarvis-web-scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        url: args.url,
        formats: args.formats || ['text', 'metadata'],
        maxLength: args.maxLength || 30000,
        selector: args.selector,
        includeImages: args.includeImages,
      }),
    });

    const data = await response.json();
    
    if (!data.success) {
      console.error(`[executeWebScrape] ❌ Failed:`, data.error);
      return {
        success: false,
        error: data.error || 'Failed to scrape page',
        execution_time_ms: Date.now() - start
      };
    }

    console.log(`[executeWebScrape] ✅ Success - ${data.wordCount || 0} words extracted`);
    
    // Formater la réponse pour Jarvis
    const formattedResult: Record<string, unknown> = {
      url: data.url,
      title: data.title,
      wordCount: data.wordCount,
    };

    if (data.text) {
      formattedResult.text = data.text;
    }
    if (data.markdown) {
      formattedResult.markdown = data.markdown;
    }
    if (data.html) {
      formattedResult.html = data.html;
    }
    if (data.links) {
      formattedResult.links = data.links.slice(0, 50); // Limiter à 50 liens
      formattedResult.totalLinks = data.links.length;
    }
    if (data.images) {
      formattedResult.images = data.images.slice(0, 20); // Limiter à 20 images
      formattedResult.totalImages = data.images.length;
    }
    if (data.metadata) {
      formattedResult.metadata = data.metadata;
    }

    return {
      success: true,
      data: formattedResult,
      execution_time_ms: Date.now() - start
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape page';
    console.error(`[executeWebScrape] EXCEPTION:`, errorMessage);
    
    return {
      success: false,
      error: `❌ **Échec du scraping**\n\n${errorMessage}`,
      execution_time_ms: Date.now() - start
    };
  }
}

/**
 * Execute web_search tool
 * Recherche sur le web via DuckDuckGo (gratuit, sans API key)
 */
export async function executeWebSearchFree(
  ctx: ToolExecutionContext,
  args: {
    query: string;
    maxResults?: number;
    region?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  console.log(`[executeWebSearchFree] 🔍 Query: ${args.query}`);
  
  try {
    // Utiliser DuckDuckGo HTML (pas d'API key requise)
    const encodedQuery = encodeURIComponent(args.query);
    const region = args.region || 'fr-fr';
    const maxResults = Math.min(args.maxResults || 10, 20);
    
    // DuckDuckGo Lite HTML version (plus fiable pour le scraping)
    const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}&kl=${region}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Jarvis-Bot/1.0)',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      throw new Error(`Search failed: HTTP ${response.status}`);
    }

    const html = await response.text();
    
    // Parser les résultats de DuckDuckGo Lite
    const results: Array<{ title: string; url: string; snippet: string }> = [];
    
    // Pattern pour extraire les résultats de DDG Lite
    const resultPattern = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
    
    let match;
    while ((match = resultPattern.exec(html)) !== null && results.length < maxResults) {
      const [, url, title, snippetRaw] = match;
      const snippet = snippetRaw.replace(/<[^>]+>/g, '').trim();
      
      if (url && title) {
        results.push({
          title: title.trim(),
          url: url.trim(),
          snippet: snippet.substring(0, 300),
        });
      }
    }
    
    // Fallback: parser les liens simples si le pattern précis ne fonctionne pas
    if (results.length === 0) {
      const linkPattern = /<a[^>]*href="([^"]+)"[^>]*rel="nofollow"[^>]*>([^<]+)<\/a>/gi;
      
      while ((match = linkPattern.exec(html)) !== null && results.length < maxResults) {
        const [, url, title] = match;
        
        // Filtrer les liens internes de DDG
        if (url && !url.includes('duckduckgo.com') && title) {
          results.push({
            title: title.trim(),
            url: url.trim(),
            snippet: '',
          });
        }
      }
    }

    console.log(`[executeWebSearchFree] ✅ Found ${results.length} results`);
    
    return {
      success: true,
      data: {
        query: args.query,
        results,
        resultCount: results.length,
        source: 'DuckDuckGo (free)',
      },
      execution_time_ms: Date.now() - start
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Search failed';
    console.error(`[executeWebSearchFree] EXCEPTION:`, errorMessage);
    
    return {
      success: false,
      error: `❌ **Échec de la recherche**\n\n${errorMessage}`,
      execution_time_ms: Date.now() - start
    };
  }
}
