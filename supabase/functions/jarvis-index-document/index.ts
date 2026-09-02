/**
 * jarvis-index-document - Index documents for RAG
 * 
 * Extracts text from documents (PDF, DOCX, TXT), chunks it,
 * generates embeddings, and stores them for semantic search.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface IndexRequest {
  document_id: string;
  storage_path?: string;
  force_reindex?: boolean;
}

interface ChunkResult {
  text: string;
  index: number;
  tokens: number;
  metadata: Record<string, unknown>;
}

// Simple token estimation (4 chars ≈ 1 token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Chunk text into segments of ~500 tokens with overlap
function chunkText(text: string, maxTokens = 500, overlapTokens = 50): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  const words = text.split(/\s+/);
  let currentChunk: string[] = [];
  let currentTokens = 0;
  let chunkIndex = 0;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordTokens = estimateTokens(word + ' ');
    
    if (currentTokens + wordTokens > maxTokens && currentChunk.length > 0) {
      // Save current chunk
      const chunkText = currentChunk.join(' ');
      chunks.push({
        text: chunkText,
        index: chunkIndex++,
        tokens: estimateTokens(chunkText),
        metadata: {}
      });
      
      // Keep last N words for overlap
      const overlapWordCount = Math.floor(overlapTokens / 5); // ~5 chars per word avg
      currentChunk = currentChunk.slice(-overlapWordCount);
      currentTokens = estimateTokens(currentChunk.join(' '));
    }
    
    currentChunk.push(word);
    currentTokens += wordTokens;
  }
  
  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join(' ');
    chunks.push({
      text: chunkText,
      index: chunkIndex,
      tokens: estimateTokens(chunkText),
      metadata: {}
    });
  }
  
  return chunks;
}

// Extract text from PDF using basic parsing
async function extractTextFromPDF(content: ArrayBuffer): Promise<string> {
  // Simple PDF text extraction - looks for text streams
  const bytes = new Uint8Array(content);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  
  // Try to extract text from PDF streams
  const textParts: string[] = [];
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/gi;
  let match;
  
  while ((match = streamRegex.exec(text)) !== null) {
    const streamContent = match[1];
    // Filter for readable text
    const readable = streamContent
      .replace(/[^x20-x7Enrt]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (readable.length > 20) {
      textParts.push(readable);
    }
  }
  
  // Fallback: just get all readable text
  if (textParts.length === 0) {
    const fallbackText = text
      .replace(/[^x20-x7Enrt]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return fallbackText.slice(0, 50000); // Limit to ~50k chars
  }
  
  return textParts.join('\n\n').slice(0, 50000);
}

// Extract text based on file type
async function extractText(content: ArrayBuffer, mimeType: string, fileName: string): Promise<string> {
  const lowerName = fileName.toLowerCase();
  
  // Plain text files
  if (mimeType.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.csv')) {
    return new TextDecoder().decode(content);
  }
  
  // PDF
  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return await extractTextFromPDF(content);
  }
  
  // DOCX - extract from document.xml
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lowerName.endsWith('.docx')) {
    // For DOCX, we'd need proper ZIP extraction - for now, try basic text extraction
    const text = new TextDecoder('utf-8', { fatal: false }).decode(content);
    const readable = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/[^x20-x7Enrt]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return readable.slice(0, 50000);
  }
  
  // HTML
  if (mimeType === 'text/html' || lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    const text = new TextDecoder().decode(content);
    return text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  // JSON
  if (mimeType === 'application/json' || lowerName.endsWith('.json')) {
    return new TextDecoder().decode(content);
  }
  
  // Fallback: try as text
  try {
    return new TextDecoder().decode(content);
  } catch {
    return '';
  }
}

// Generate embedding using Azure OpenAI
async function generateEmbedding(text: string): Promise<number[] | null> {
  const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
  const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');
  
  let embeddingEndpoint = Deno.env.get('AZURE_EMBEDDING_ENDPOINT');
  if (!embeddingEndpoint && AZURE_OPENAI_ENDPOINT) {
    const baseUrl = AZURE_OPENAI_ENDPOINT.split('/openai/deployments/')[0];
    embeddingEndpoint = `${baseUrl}/openai/deployments/${Deno.env.get('IA_MODELE_EMBEDDINGS') ?? ''}/embeddings?api-version=${Deno.env.get('IA_VERSION_API') ?? '2024-02-01'}`;
  }
  
  if (!embeddingEndpoint || !AZURE_OPENAI_API_KEY) {
    console.log('[IndexDoc] Embedding endpoint not configured');
    return null;
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  try {
    const response = await fetch(embeddingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({
        input: text.slice(0, 8000),
        model: Deno.env.get('IA_MODELE_EMBEDDINGS') ?? ''
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`[IndexDoc] Embedding API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[IndexDoc] Embedding error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require either internal service call or authenticated user
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: IndexRequest = await req.json();
    
    if (!request.document_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing document_id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[IndexDoc] Starting indexing for document: ${request.document_id}`);

    // Get document info
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, name, storage_path, storage_bucket, mime_type, created_by')
      .eq('id', request.document_id)
      .single();

    if (docError || !doc) {
      console.error('[IndexDoc] Document fetch error:', docError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Document not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Ownership check for user calls (service calls bypass)
    if (!auth.isServiceCall && doc.created_by && doc.created_by !== auth.userId) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if already indexed (unless force_reindex)
    if (!request.force_reindex) {
      const { data: existing } = await supabase
        .from('document_embeddings')
        .select('id')
        .eq('document_id', request.document_id)
        .limit(1);
      
      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Document already indexed',
          already_indexed: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Delete existing embeddings if force reindex
      await supabase
        .from('document_embeddings')
        .delete()
        .eq('document_id', request.document_id);
    }

    // Download file from storage
    const storagePath = request.storage_path || doc.storage_path;
    const bucket = doc.storage_bucket || 'documents';
    
    console.log(`[IndexDoc] Downloading from ${bucket}/${storagePath}`);
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('[IndexDoc] Download error:', downloadError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to download file'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract text
    console.log(`[IndexDoc] Extracting text from ${doc.name} (${doc.mime_type})`);
    const content = await fileData.arrayBuffer();
    const extractedText = await extractText(content, doc.mime_type || '', doc.name);

    if (!extractedText || extractedText.length < 50) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not extract meaningful text from document'
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[IndexDoc] Extracted ${extractedText.length} chars, chunking...`);

    // Chunk the text
    const chunks = chunkText(extractedText, 500, 50);
    console.log(`[IndexDoc] Created ${chunks.length} chunks`);

    // Generate embeddings and store
    const embeddings: { document_id: string; storage_path: string; chunk_index: number; chunk_text: string; chunk_tokens: number; embedding: number[] | null; metadata: Record<string, unknown> }[] = [];
    
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.text);
      
      embeddings.push({
        document_id: request.document_id,
        storage_path: storagePath,
        chunk_index: chunk.index,
        chunk_text: chunk.text,
        chunk_tokens: chunk.tokens,
        embedding,
        metadata: {
          file_name: doc.name,
          mime_type: doc.mime_type,
          chunk_position: chunk.index,
          total_chunks: chunks.length
        }
      });
      
      // Rate limiting: small delay between embedding calls
      if (chunks.length > 5) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Bulk insert embeddings
    const { error: insertError } = await supabase
      .from('document_embeddings')
      .insert(embeddings);

    if (insertError) {
      console.error('[IndexDoc] Insert error:', insertError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to store embeddings'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const successfulEmbeddings = embeddings.filter(e => e.embedding !== null).length;
    
    console.log(`[IndexDoc] Successfully indexed document: ${chunks.length} chunks, ${successfulEmbeddings} with embeddings`);

    return new Response(JSON.stringify({
      success: true,
      document_id: request.document_id,
      document_name: doc.name,
      chunks_created: chunks.length,
      embeddings_generated: successfulEmbeddings,
      total_tokens: embeddings.reduce((sum, e) => sum + e.chunk_tokens, 0)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[IndexDoc] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: sanitizeErrorForClient(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
