import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { debug } from '@/lib/debug';

interface SearchResult {
  id: string;
  content: string;
  content_highlighted: string;
  created_at: string;
  conversation_id: string;
  user: {
    id: string;
    nom: string;
    prenom: string;
    avatar_url?: string | null;
  } | null;
  conversation: {
    id: string;
    name: string;
  } | null;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  limit: number;
  offset: number;
}

export function usePulseSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const search = useCallback(async (
    query: string, 
    conversationId?: string,
    limit = 20,
    offset = 0
  ) => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setTotal(0);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke('pulse-search', {
        body: {
          query: query.trim(),
          conversation_id: conversationId,
          limit,
          offset,
        },
      });

      if (error) throw error;

      const response = data as SearchResponse;
      setResults(response.results);
      setTotal(response.total);
    } catch (error: unknown) {
      debug.error('Search error:', error);
      toast({
        title: 'Erreur de recherche',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      });
      setResults([]);
      setTotal(0);
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  const clearSearch = useCallback(() => {
    setResults([]);
    setTotal(0);
    setHasSearched(false);
  }, []);

  return {
    results,
    total,
    isSearching,
    hasSearched,
    search,
    clearSearch,
  };
}
