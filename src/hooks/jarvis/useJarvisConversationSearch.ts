/**
 * useJarvisConversationSearch - Full-text search in Jarvis conversation history
 * 
 * Uses PostgreSQL Full-Text Search via search_jarvis_conversations RPC
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import { useDebounce } from '@/hooks/shared/useDebounce';
import { debug } from '@/lib/debug';

export interface ConversationSearchResult {
  conversation_id: string;
  conversation_title: string;
  message_content: string;
  message_created_at: string;
  message_role: 'user' | 'assistant';
  relevance_score: number;
}

interface UseJarvisConversationSearchOptions {
  enabled?: boolean;
  limit?: number;
  debounceMs?: number;
}

interface UseJarvisConversationSearchReturn {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  results: ConversationSearchResult[];
  isSearching: boolean;
  hasSearched: boolean;
  clearSearch: () => void;
  highlightMatch: (text: string, term: string) => { text: string; highlight: boolean }[];
}

export function useJarvisConversationSearch(
  options: UseJarvisConversationSearchOptions = {}
): UseJarvisConversationSearchReturn {
  const { enabled = true, limit = 20, debounceMs = 300 } = options;
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, debounceMs);

  // Only search if we have at least 2 characters
  const shouldSearch = debouncedSearchTerm.trim().length >= 2;

  const { data: results = [], isLoading: isSearching } = useQuery({
    queryKey: ['jarvis-conversation-search', user?.id, debouncedSearchTerm, limit],
    queryFn: async () => {
      if (!user?.id || !shouldSearch) return [];

      const { data, error } = await supabase.rpc('search_jarvis_conversations', {
        p_user_id: user.id,
        p_search_term: debouncedSearchTerm.trim(),
        p_limit: limit,
        p_offset: 0,
      });

      if (error) {
        debug.error('[JarvisSearch] Error searching conversations:', error);
        return [];
      }

      return (data || []) as ConversationSearchResult[];
    },
    enabled: enabled && !!user?.id && shouldSearch,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  // Highlight matching parts of text
  const highlightMatch = useCallback((text: string, term: string): { text: string; highlight: boolean }[] => {
    if (!term || term.length < 2) {
      return [{ text, highlight: false }];
    }

    const parts: { text: string; highlight: boolean }[] = [];
    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    
    // Split search term into words for multi-word highlighting
    const searchWords = lowerTerm.split(/\s+/).filter(w => w.length >= 2);
    
    if (searchWords.length === 0) {
      return [{ text, highlight: false }];
    }

    // Create regex pattern for all search words
    const pattern = new RegExp(`(${searchWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    
    let lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      // Add non-matching part before this match
      if (match.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, match.index), highlight: false });
      }
      // Add the matching part
      parts.push({ text: match[0], highlight: true });
      lastIndex = pattern.lastIndex;
    }
    
    // Add remaining text after last match
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), highlight: false });
    }
    
    return parts.length > 0 ? parts : [{ text, highlight: false }];
  }, []);

  // Group results by conversation
  const groupedResults = useMemo(() => {
    const groups = new Map<string, ConversationSearchResult[]>();
    
    for (const result of results) {
      const existing = groups.get(result.conversation_id) || [];
      existing.push(result);
      groups.set(result.conversation_id, existing);
    }
    
    return groups;
  }, [results]);

  return {
    searchTerm,
    setSearchTerm,
    results,
    isSearching,
    hasSearched: shouldSearch,
    clearSearch,
    highlightMatch,
  };
}

export default useJarvisConversationSearch;
