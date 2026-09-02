/**
 * useJarvisDocumentRAG - Hook for document-based RAG operations
 * 
 * Provides semantic search across indexed documents and KB articles,
 * as well as document indexing triggers.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import { debug } from '@/lib/debug';

interface DocumentSearchResult {
  document_id: string;
  document_name: string;
  excerpt: string;
  relevance_score: number;
  similarity?: number;
  metadata?: Record<string, unknown>;
}

interface KBSearchResult {
  id: string;
  title: string;
  content_preview: string;
  category_name?: string;
  base_type: string;
  combined_score?: number;
}

interface SearchResults {
  documents: DocumentSearchResult[];
  kb_articles: KBSearchResult[];
  total: number;
  search_type: 'hybrid' | 'text_only';
}

interface IndexingStatus {
  document_id: string;
  chunks: number;
  is_indexed: boolean;
}

export function useJarvisDocumentRAG() {
  const { user } = useAuth();
  const [isSearching, setIsSearching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Search across indexed documents using semantic search
   */
  const searchDocuments = useCallback(async (
    query: string,
    options?: {
      limit?: number;
      similarityThreshold?: number;
      includeKB?: boolean;
    }
  ): Promise<SearchResults | null> => {
    if (!user?.id || !query.trim()) {
      return null;
    }

    setIsSearching(true);
    setError(null);

    try {
      // First, generate embedding for the query
      const { data: embeddingResult, error: embeddingError } = await supabase.functions.invoke(
        'jarvis-generate-embedding',
        { body: { text: query } }
      );

      if (embeddingError) {
        debug.warn('[DocumentRAG] Embedding generation failed, using text search:', embeddingError);
      }

      const embedding = embeddingResult?.embedding;
      let documentResults: DocumentSearchResult[] = [];
      let kbResults: KBSearchResult[] = [];
      let searchType: 'hybrid' | 'text_only' = 'text_only';

      // Search documents
      if (embedding) {
        // Use hybrid search with embeddings
        const { data, error: searchError } = await supabase.rpc('search_documents_hybrid', {
          p_query_embedding: embedding,
          p_query_text: query,
          p_user_id: user.id,
          p_limit: options?.limit || 10,
          p_similarity_threshold: options?.similarityThreshold || 0.65
        });

        if (searchError) {
          debug.error('[DocumentRAG] Hybrid search error:', searchError);
        } else {
          documentResults = (data || []).map((r: Record<string, unknown>) => ({
            document_id: r.document_id as string,
            document_name: r.document_name as string,
            excerpt: r.chunk_text as string,
            relevance_score: r.combined_score as number,
            similarity: r.similarity as number,
            metadata: r.metadata as Record<string, unknown>
          }));
          searchType = 'hybrid';
        }
      } else {
        // Fallback to text search
        const { data, error: textError } = await supabase
          .from('document_embeddings')
          .select(`
            document_id,
            chunk_text,
            metadata,
            documents!inner(name)
          `)
          .textSearch('chunk_text', query, { type: 'websearch', config: 'french' })
          .limit(options?.limit || 10);

        if (!textError && data) {
          documentResults = data
            .filter((r) => r.document_id !== null)
            .map((r) => ({
            document_id: r.document_id as string,
            document_name: (r.documents as { name: string })?.name || 'Unknown',
            excerpt: r.chunk_text,
            relevance_score: 0.5,
            metadata: r.metadata as Record<string, unknown>
          }));
        }
      }


      const results: SearchResults = {
        documents: documentResults,
        kb_articles: kbResults,
        total: documentResults.length + kbResults.length,
        search_type: searchType
      };

      setSearchResults(results);
      return results;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Search failed';
      setError(errorMsg);
      debug.error('[DocumentRAG] Search error:', err);
      return null;
    } finally {
      setIsSearching(false);
    }
  }, [user?.id]);

  /**
   * Index a document for semantic search
   */
  const indexDocument = useCallback(async (
    documentId: string,
    forceReindex = false
  ): Promise<boolean> => {
    if (!documentId) {
      return false;
    }

    setIsIndexing(true);
    setError(null);

    try {
      const { data, error: indexError } = await supabase.functions.invoke(
        'jarvis-index-document',
        {
          body: {
            document_id: documentId,
            force_reindex: forceReindex
          }
        }
      );

      if (indexError) {
        throw indexError;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Indexing failed');
      }

      debug.log(`[DocumentRAG] Successfully indexed document: ${documentId}`, data);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Indexing failed';
      setError(errorMsg);
      debug.error('[DocumentRAG] Index error:', err);
      return false;
    } finally {
      setIsIndexing(false);
    }
  }, []);

  /**
   * Get indexing status for documents
   */
  const getIndexingStatus = useCallback(async (
    documentIds?: string[]
  ): Promise<IndexingStatus[]> => {
    try {
      let query = supabase
        .from('document_embeddings')
        .select('document_id');

      if (documentIds && documentIds.length > 0) {
        query = query.in('document_id', documentIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Count chunks per document
      const chunkCounts: Record<string, number> = {};
      (data || []).forEach((row) => {
        if (row.document_id) {
          chunkCounts[row.document_id] = (chunkCounts[row.document_id] || 0) + 1;
        }
      });

      // Build status array
      const statusList: IndexingStatus[] = [];
      
      if (documentIds) {
        documentIds.forEach(id => {
          statusList.push({
            document_id: id,
            chunks: chunkCounts[id] || 0,
            is_indexed: chunkCounts[id] > 0
          });
        });
      } else {
        Object.entries(chunkCounts).forEach(([id, chunks]) => {
          statusList.push({
            document_id: id,
            chunks,
            is_indexed: true
          });
        });
      }

      return statusList;
    } catch (err) {
      debug.error('[DocumentRAG] Status check error:', err);
      return [];
    }
  }, []);

  /**
   * Batch index multiple documents
   */
  const batchIndexDocuments = useCallback(async (
    documentIds: string[]
  ): Promise<{ success: number; failed: number }> => {
    let success = 0;
    let failed = 0;

    for (const docId of documentIds) {
      const result = await indexDocument(docId);
      if (result) {
        success++;
      } else {
        failed++;
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    return { success, failed };
  }, [indexDocument]);

  /**
   * Clear search results
   */
  const clearResults = useCallback(() => {
    setSearchResults(null);
    setError(null);
  }, []);

  return {
    // State
    isSearching,
    isIndexing,
    searchResults,
    error,
    
    // Actions
    searchDocuments,
    indexDocument,
    batchIndexDocuments,
    getIndexingStatus,
    clearResults
  };
}

export default useJarvisDocumentRAG;
