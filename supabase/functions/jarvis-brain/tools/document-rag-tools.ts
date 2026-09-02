/**
 * JARVIS 12.0 - Document RAG Tools
 * 
 * Semantic search across indexed documents using hybrid vector + BM25 search.
 * Enables Jarvis to answer questions about uploaded documents.
 */

import { SupabaseClient } from "@supabase/supabase-js";

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  execution_time_ms: number;
}

interface ToolExecutionContext {
  supabase: SupabaseClient;
  adminClient?: SupabaseClient;
  userId: string;
  authUserId?: string;
  conversationId?: string;
}

// Generate embedding for search query
async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
  const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');
  
  let embeddingEndpoint = Deno.env.get('AZURE_EMBEDDING_ENDPOINT');
  if (!embeddingEndpoint && AZURE_OPENAI_ENDPOINT) {
    const baseUrl = AZURE_OPENAI_ENDPOINT.split('/openai/deployments/')[0];
    embeddingEndpoint = `${baseUrl}/openai/deployments/${Deno.env.get('IA_MODELE_EMBEDDINGS') ?? ''}/embeddings?api-version=${Deno.env.get('IA_VERSION_API') ?? '2024-02-01'}`;
  }
  
  if (!embeddingEndpoint || !AZURE_OPENAI_API_KEY) {
    console.log('[DocumentRAG] Embedding endpoint not configured');
    return null;
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(embeddingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({
        input: query.slice(0, 2000),
        model: Deno.env.get('IA_MODELE_EMBEDDINGS') ?? ''
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`[DocumentRAG] Embedding API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[DocumentRAG] Embedding error:', error);
    return null;
  }
}

/**
 * Search documents using hybrid vector + text search
 */
export async function executeSearchDocuments(
  ctx: ToolExecutionContext,
  args: {
    query: string;
    limit?: number;
    similarity_threshold?: number;
    document_types?: string[];
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    console.log(`[DocumentRAG] Searching: "${args.query.slice(0, 100)}..."`);
    
    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(args.query);
    
    if (!queryEmbedding) {
      // Fallback to text-only search
      console.log('[DocumentRAG] Falling back to text-only search');
      return await executeTextOnlySearch(ctx, args);
    }
    
    // Use the hybrid search function
    const { data, error } = await ctx.supabase.rpc('search_documents_hybrid', {
      p_query_embedding: queryEmbedding,
      p_query_text: args.query,
      p_user_id: ctx.authUserId || ctx.userId,
      p_limit: args.limit || 10,
      p_similarity_threshold: args.similarity_threshold || 0.65
    });
    
    if (error) {
      console.error('[DocumentRAG] Search error:', error);
      throw error;
    }
    
    // Format results
    const results = (data || []).map((r: Record<string, unknown>) => ({
      document_id: r.document_id,
      document_name: r.document_name,
      excerpt: r.chunk_text,
      relevance_score: r.combined_score,
      similarity: r.similarity,
      metadata: r.metadata
    }));
    
    console.log(`[DocumentRAG] Found ${results.length} results`);
    
    return {
      success: true,
      data: {
        results,
        total: results.length,
        query: args.query,
        search_type: 'hybrid'
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Search failed';
    console.error('[DocumentRAG] Error:', errorMsg);
    return {
      success: false,
      error: errorMsg,
      execution_time_ms: Date.now() - start
    };
  }
}

/**
 * Fallback text-only search when embeddings unavailable
 */
async function executeTextOnlySearch(
  ctx: ToolExecutionContext,
  args: { query: string; limit?: number }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    // Simple full-text search on chunks
    const { data, error } = await ctx.supabase
      .from('document_embeddings')
      .select(`
        document_id,
        chunk_text,
        chunk_index,
        metadata,
        documents!inner(name)
      `)
      .textSearch('chunk_text', args.query, { type: 'websearch', config: 'french' })
      .limit(args.limit || 10);
    
    if (error) throw error;
    
    const results = (data || []).map((r: Record<string, unknown>) => ({
      document_id: r.document_id,
      document_name: (r.documents as Record<string, unknown>)?.name,
      excerpt: r.chunk_text,
      relevance_score: 0.5, // No score available for text search
      metadata: r.metadata
    }));
    
    return {
      success: true,
      data: {
        results,
        total: results.length,
        query: args.query,
        search_type: 'text_only'
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Text search failed',
      execution_time_ms: Date.now() - start
    };
  }
}

/**
 * Search Knowledge Base articles using semantic search
 */
export async function executeSearchKnowledgeBase(
  ctx: ToolExecutionContext,
  args: {
    query: string;
    limit?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    console.log(`[KBSearch] Searching: "${args.query.slice(0, 100)}..."`);
    
    // Les pages redigees du wiki remplacent les articles de la base de
    // connaissances : meme role, autre source. Pas d'embedding requis,
    // `documents.recherche` est une colonne engendree (schema-08-pages.sql).
    // La configuration doit etre NOMMEE et NON qualifiee par son schema.
    const query = ctx.supabase
      .from('documents')
      .select('id, titre:name, contenu:content')
      .not('content', 'is', null)
      .is('deleted_at', null)
      .textSearch('recherche', args.query, { type: 'websearch', config: 'francais_sans_accent' })
      .limit(args.limit || 10);

    const { data, error } = await query;
    if (error) throw error;
    
    return {
      success: true,
      data: {
        articles: (data || []).map((a: Record<string, unknown>) => ({
          id: a.id,
          title: a.titre,
          content_preview: String(a.contenu || '').slice(0, 500),
        })),
        total: data?.length || 0,
        search_type: 'text_only'
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'KB search failed',
      execution_time_ms: Date.now() - start
    };
  }
}

/**
 * Index a document for RAG (triggers jarvis-index-document)
 */
export async function executeIndexDocument(
  ctx: ToolExecutionContext,
  args: {
    document_id: string;
    force_reindex?: boolean;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    console.log(`[IndexDoc] Indexing document: ${args.document_id}`);
    
    // Call the indexing function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/jarvis-index-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        document_id: args.document_id,
        force_reindex: args.force_reindex
      })
    });
    
    const result = await response.json();
    
    return {
      success: result.success,
      data: result,
      error: result.error,
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Indexing failed',
      execution_time_ms: Date.now() - start
    };
  }
}

/**
 * Get indexing status for documents
 */
export async function executeGetIndexingStatus(
  ctx: ToolExecutionContext,
  args: {
    document_ids?: string[];
    include_unindexed?: boolean;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    // Get indexed documents count
    let query = ctx.supabase
      .from('document_embeddings')
      .select('document_id, chunk_index', { count: 'exact' });
    
    if (args.document_ids && args.document_ids.length > 0) {
      query = query.in('document_id', args.document_ids);
    }
    
    const { data, count, error } = await query;
    if (error) throw error;
    
    // Group by document
    const documentChunks: Record<string, number> = {};
    (data || []).forEach((row: { document_id: string }) => {
      documentChunks[row.document_id] = (documentChunks[row.document_id] || 0) + 1;
    });
    
    // Get unindexed documents if requested
    let unindexedDocs: { id: string; name: string }[] = [];
    if (args.include_unindexed) {
      const { data: allDocs } = await ctx.supabase
        .from('documents')
        .select('id, name')
        .not('id', 'in', `(${Object.keys(documentChunks).join(',')})`);
      
      unindexedDocs = allDocs || [];
    }
    
    return {
      success: true,
      data: {
        indexed_documents: Object.keys(documentChunks).length,
        total_chunks: count || 0,
        documents: Object.entries(documentChunks).map(([id, chunks]) => ({
          document_id: id,
          chunks
        })),
        unindexed_documents: unindexedDocs
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed',
      execution_time_ms: Date.now() - start
    };
  }
}
