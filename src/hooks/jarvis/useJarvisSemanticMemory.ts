/**
 * useJarvisSemanticMemory - Recherche sémantique dans la mémoire Jarvis
 * 
 * V2: Support des embeddings vectoriels via pgvector
 */

import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import { debug } from '@/lib/debug';
import { sanitizePostgrestValue } from '@/lib/sanitize';

export interface SemanticMemoryResult {
  id: string;
  category: string;
  key: string;
  value: string;
  importance: number;
  relevance_score: number;
}

export function useJarvisSemanticMemory() {
  const { user } = useAuth();
  const [isSearching, setIsSearching] = useState(false);
  const [lastResults, setLastResults] = useState<SemanticMemoryResult[]>([]);

  /**
   * Génère un embedding pour une requête via l'Edge Function
   */
  const generateEmbedding = useCallback(async (text: string): Promise<number[] | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('jarvis-generate-embedding', {
        body: { text, mode: 'query' }
      });
      
      if (error || !data?.embedding) {
        debug.warn('[SemanticMemory] Embedding generation failed, falling back to text search');
        return null;
      }
      
      return data.embedding;
    } catch (error) {
      debug.error('[SemanticMemory] Embedding error:', error);
      return null;
    }
  }, []);

  /**
   * Recherche sémantique avec embeddings vectoriels (fallback sur text search)
   */
  const searchMemory = useCallback(async (query: string, limit = 5): Promise<SemanticMemoryResult[]> => {
    if (!user?.id || !query.trim()) return [];
    setIsSearching(true);

    try {
      // Essayer d'abord la recherche vectorielle
      const embedding = await generateEmbedding(query);
      
      if (embedding) {
        // Recherche sémantique via fonction SQL (cast pour nouvelle fonction)
        const { data: semanticResults, error: semanticError } = await (supabase.rpc as unknown as (fn: string, params: Record<string, unknown>) => Promise<{ data: Array<{ id: string; category: string; key: string; value: string; similarity: number }> | null; error: { message: string } | null }>)(
          'search_jarvis_memory_semantic', 
          {
            p_user_id: user.id,
            p_query_embedding: embedding,
            p_limit: limit
          }
        );
        
        if (!semanticError && semanticResults && Array.isArray(semanticResults) && semanticResults.length > 0) {
          const results = semanticResults.map((r) => ({
            id: r.id,
            category: r.category,
            key: r.key,
            value: r.value,
            importance: 3, // Default importance
            relevance_score: r.similarity
          }));
          setLastResults(results);
          return results;
        }
      }
      
      // Fallback: recherche textuelle classique
      const { data, error } = await supabase
        .from('jarvis_user_memory')
        .select('id, category, key, value, importance')
        .eq('user_id', user.id)
        .or(`key.ilike.%${sanitizePostgrestValue(query)}%,value.ilike.%${sanitizePostgrestValue(query)}%`)
        .order('importance', { ascending: false })
        .limit(limit);

      if (error) {
        debug.error('[useJarvisSemanticMemory] Error:', error);
        return [];
      }

      const results = (data || []).map(m => ({ 
        ...m, 
        relevance_score: calculateTextSimilarity(query, `${m.key} ${m.value}`)
      })) as SemanticMemoryResult[];
      
      setLastResults(results);
      return results;
    } catch (error) {
      debug.error('[useJarvisSemanticMemory] Exception:', error);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [user?.id, generateEmbedding]);

  /**
   * Recherche multi-critères combinant sémantique et filtres
   */
  const searchMemoryAdvanced = useCallback(async (
    query: string,
    options: {
      categories?: string[];
      minImportance?: number;
      limit?: number;
    } = {}
  ): Promise<SemanticMemoryResult[]> => {
    if (!user?.id || !query.trim()) return [];
    setIsSearching(true);

    try {
      const { categories, minImportance = 1, limit = 10 } = options;
      
      // Recherche textuelle avec filtres
      let queryBuilder = supabase
        .from('jarvis_user_memory')
        .select('id, category, key, value, importance')
        .eq('user_id', user.id)
        .gte('importance', minImportance)
        .or(`key.ilike.%${sanitizePostgrestValue(query)}%,value.ilike.%${sanitizePostgrestValue(query)}%`)
        .order('importance', { ascending: false })
        .limit(limit);
      
      if (categories && categories.length > 0) {
        queryBuilder = queryBuilder.in('category', categories);
      }
      
      const { data, error } = await queryBuilder;

      if (error) {
        debug.error('[useJarvisSemanticMemory] Advanced search error:', error);
        return [];
      }

      const results = (data || []).map(m => ({ 
        ...m, 
        relevance_score: calculateTextSimilarity(query, `${m.key} ${m.value}`)
      })) as SemanticMemoryResult[];
      
      // Trier par score de similarité
      results.sort((a, b) => b.relevance_score - a.relevance_score);
      
      setLastResults(results);
      return results;
    } catch (error) {
      debug.error('[useJarvisSemanticMemory] Advanced search exception:', error);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [user?.id]);

  /**
   * Construit un contexte formaté à partir d'une recherche
   */
  const buildContextFromQuery = useCallback(async (query: string): Promise<string> => {
    const memories = await searchMemory(query, 10);
    if (memories.length === 0) return '';

    const grouped: Record<string, SemanticMemoryResult[]> = {};
    for (const m of memories) {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m);
    }

    const labels: Record<string, string> = { 
      preference: 'PRÉFÉRENCES', 
      fact: 'FAITS', 
      instruction: 'INSTRUCTIONS', 
      context: 'CONTEXTE' 
    };
    
    let ctx = '\n[MÉMOIRE SÉMANTIQUE]:';
    for (const [cat, items] of Object.entries(grouped)) {
      ctx += `\n${labels[cat] || cat}:`;
      for (const item of items.slice(0, 5)) {
        ctx += `\n- ${item.key}: ${item.value} (pertinence: ${Math.round(item.relevance_score * 100)}%)`;
      }
    }
    return ctx;
  }, [searchMemory]);

  /**
   * Récupère les mémoires les plus pertinentes pour un contexte de page
   */
  const getContextualMemories = useCallback(async (
    pageContext: string,
    entityType?: string
  ): Promise<SemanticMemoryResult[]> => {
    const searchTerms = [pageContext];
    if (entityType) searchTerms.push(entityType);
    
    const query = searchTerms.join(' ');
    return searchMemory(query, 5);
  }, [searchMemory]);

  return { 
    searchMemory, 
    searchMemoryAdvanced,
    isSearching, 
    lastResults, 
    buildContextFromQuery,
    getContextualMemories,
    generateEmbedding
  };
}

/**
 * Calcule une similarité textuelle simple (Jaccard)
 */
function calculateTextSimilarity(query: string, text: string): number {
  const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const textWords = new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (queryWords.size === 0 || textWords.size === 0) return 0;
  
  const intersection = new Set([...queryWords].filter(w => textWords.has(w)));
  const union = new Set([...queryWords, ...textWords]);
  
  return intersection.size / union.size;
}

export default useJarvisSemanticMemory;
