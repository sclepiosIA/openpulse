/**
 * JARVIS 10.5 - Semantic Memory Search
 * 
 * Recherche dans la mémoire utilisateur via full-text search PostgreSQL.
 * Alternative aux embeddings vectoriels sans pgvector.
 */

import { createClient } from "@supabase/supabase-js";

export interface MemorySearchResult {
  id: string;
  category: string;
  key: string;
  value: string;
  importance: number;
  relevance_score: number;
}

export interface MemoryContext {
  memories: MemorySearchResult[];
  formattedContext: string;
  hasRelevantMemories: boolean;
}

/**
 * Recherche sémantique dans la mémoire utilisateur via full-text search
 */
export async function searchUserMemory(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  query: string,
  limit: number = 5
): Promise<MemorySearchResult[]> {
  try {
    // Utiliser la fonction SQL de recherche
    const { data, error } = await supabase.rpc('search_jarvis_memory', {
      p_user_id: userId,
      p_query: query,
      p_limit: limit,
    });

    if (error) {
      console.error('[SemanticMemory] Search error:', error);
      return [];
    }

    return (data || []) as MemorySearchResult[];
  } catch (error) {
    console.error('[SemanticMemory] Exception:', error);
    return [];
  }
}

/**
 * Recherche par similarité textuelle simple (fallback)
 */
export async function searchUserMemoryFallback(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  query: string,
  limit: number = 5
): Promise<MemorySearchResult[]> {
  try {
    // Recherche ILIKE simple
    const { data, error } = await supabase
      .from('jarvis_user_memory')
      .select('id, category, key, value, importance')
      .eq('user_id', userId)
      .or(`key.ilike.%${query}%,value.ilike.%${query}%`)
      .order('importance', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[SemanticMemory] Fallback search error:', error);
      return [];
    }

    return (data || []).map(m => ({
      ...m,
      relevance_score: 0.5, // Score par défaut pour fallback
    }));
  } catch (error) {
    console.error('[SemanticMemory] Fallback exception:', error);
    return [];
  }
}

/**
 * Construit un contexte mémoire enrichi pour injection dans le prompt
 */
export async function buildMemoryContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  query: string,
  maxMemories: number = 10
): Promise<MemoryContext> {
  // Essayer la recherche sémantique d'abord
  let memories = await searchUserMemory(supabase, userId, query, maxMemories);
  
  // Fallback si pas de résultats
  if (memories.length === 0) {
    memories = await searchUserMemoryFallback(supabase, userId, query, maxMemories);
  }
  
  // Aussi récupérer les mémoires les plus importantes
  const { data: topMemories } = await supabase
    .from('jarvis_user_memory')
    .select('id, category, key, value, importance')
    .eq('user_id', userId)
    .order('importance', { ascending: false })
    .limit(5);
  
  // Fusionner et dédupliquer
  const seenIds = new Set(memories.map(m => m.id));
  const mergedMemories = [...memories];
  
  for (const m of topMemories || []) {
    if (!seenIds.has(m.id)) {
      mergedMemories.push({
        ...m,
        relevance_score: 0.3, // Score plus bas pour les mémoires non-matchées
      });
      seenIds.add(m.id);
    }
  }
  
  // Limiter au max
  const finalMemories = mergedMemories.slice(0, maxMemories);
  
  // Formater pour le prompt
  const formattedContext = formatMemoriesForPrompt(finalMemories);
  
  return {
    memories: finalMemories,
    formattedContext,
    hasRelevantMemories: finalMemories.some(m => m.relevance_score > 0.5),
  };
}

/**
 * Formate les mémoires pour injection dans le prompt système
 */
function formatMemoriesForPrompt(memories: MemorySearchResult[]): string {
  if (memories.length === 0) {
    return '';
  }
  
  // Grouper par catégorie
  const grouped: Record<string, MemorySearchResult[]> = {};
  for (const m of memories) {
    if (!grouped[m.category]) {
      grouped[m.category] = [];
    }
    grouped[m.category].push(m);
  }
  
  const categoryLabels: Record<string, string> = {
    preference: '🎯 PRÉFÉRENCES UTILISATEUR',
    fact: '📋 FAITS CONNUS',
    instruction: '⚙️ INSTRUCTIONS PERMANENTES',
    context: '📍 CONTEXTE ACTUEL',
  };
  
  let context = '\n\n========== MÉMOIRE JARVIS (Informations retenues) ==========\n';
  
  for (const [category, items] of Object.entries(grouped)) {
    const label = categoryLabels[category] || category.toUpperCase();
    context += `\n${label}:\n`;
    
    for (const item of items) {
      const relevanceIndicator = item.relevance_score > 0.7 ? '★' : 
                                  item.relevance_score > 0.5 ? '☆' : '';
      context += `- ${item.key}: ${item.value} ${relevanceIndicator}\n`;
    }
  }
  
  context += '\n===========================================================';
  
  return context;
}

/**
 * Met à jour le compteur d'utilisation d'une mémoire
 */
export async function incrementMemoryUsage(
  supabase: ReturnType<typeof createClient>,
  memoryId: string
): Promise<void> {
  try {
    await supabase
      .from('jarvis_user_memory')
      .update({
        usage_count: supabase.rpc('increment_usage', { row_id: memoryId }), // Si fonction existe
        last_accessed_at: new Date().toISOString(),
      })
      .eq('id', memoryId);
  } catch {
    // Fallback: simple update sans increment
    await supabase
      .from('jarvis_user_memory')
      .update({
        last_accessed_at: new Date().toISOString(),
      })
      .eq('id', memoryId);
  }
}

/**
 * Extrait les mots-clés pertinents d'une requête pour la recherche mémoire
 */
export function extractKeywordsForSearch(query: string): string[] {
  // Mots à ignorer
  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'mais',
    'donc', 'car', 'ni', 'que', 'qui', 'quoi', 'où', 'quand', 'comment',
    'pourquoi', 'est', 'sont', 'suis', 'es', 'a', 'ai', 'as', 'ont', 'avons',
    'avez', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
    'ce', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
    'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
    'moi', 'toi', 'lui', 'eux', 'en', 'y', 'ne', 'pas', 'plus', 'moins',
    'très', 'trop', 'bien', 'mal', 'tout', 'tous', 'toute', 'toutes',
    'faire', 'fait', 'fais', 'font', 'être', 'avoir', 'aller', 'venir',
  ]);
  
  // Extraire les mots significatifs
  const words = query
    .toLowerCase()
    .replace(/[^\wàâäéèêëïîôùûüç\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Retourner les mots uniques
  return [...new Set(words)];
}
