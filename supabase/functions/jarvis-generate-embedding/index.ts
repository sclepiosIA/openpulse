/**
 * jarvis-generate-embedding - Generate embeddings for semantic memory
 * 
 * Uses Azure OpenAI text-embedding-ada-002 to generate vector embeddings
 * for Jarvis user memory entries.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface EmbeddingRequest {
  text: string;
  memory_id?: string;
  batch?: Array<{ id: string; text: string }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require either service call or authenticated user
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
    const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');
    
    // Use dedicated embedding endpoint if available, otherwise construct from main endpoint
    let embeddingEndpoint = Deno.env.get('AZURE_EMBEDDING_ENDPOINT');
    if (!embeddingEndpoint && AZURE_OPENAI_ENDPOINT) {
      // Extract base URL and construct embedding endpoint
      const baseUrl = AZURE_OPENAI_ENDPOINT.split('/openai/deployments/')[0];
      embeddingEndpoint = `${baseUrl}/openai/deployments/${Deno.env.get('IA_MODELE_EMBEDDINGS') ?? ''}/embeddings?api-version=${Deno.env.get('IA_VERSION_API') ?? '2024-02-01'}`;
    }
    
    if (!embeddingEndpoint || !AZURE_OPENAI_API_KEY) {
      console.log('[EmbeddingGen] Azure embedding endpoint not configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'Embedding service not configured'
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const request: EmbeddingRequest = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Handle batch requests
    if (request.batch && request.batch.length > 0) {
      console.log(`[EmbeddingGen] Processing batch of ${request.batch.length} embeddings`);
      
      const results = [];
      for (const item of request.batch) {
        try {
          const embedding = await generateEmbedding(embeddingEndpoint, AZURE_OPENAI_API_KEY, item.text);
          
          if (embedding && item.id) {
            // Update the memory with the embedding (scope by user_id when not a service call)
            let updateQuery = supabase
              .from('jarvis_user_memory')
              .update({ embedding })
              .eq('id', item.id);
            if (!auth.isServiceCall) {
              updateQuery = updateQuery.eq('user_id', auth.userId!);
            }
            const { error: updateError } = await updateQuery;
            
            if (updateError) {
              console.error(`[EmbeddingGen] Failed to update memory ${item.id}:`, updateError);
              results.push({ id: item.id, success: false, error: updateError.message });
            } else {
              results.push({ id: item.id, success: true });
            }
          }
        } catch (e) {
          results.push({ id: item.id, success: false, error: e.message });
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        results,
        processed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle single embedding request
    if (!request.text) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing text parameter'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[EmbeddingGen] Generating embedding for text (${request.text.length} chars)`);
    
    const embedding = await generateEmbedding(embeddingEndpoint, AZURE_OPENAI_API_KEY, request.text);
    
    if (!embedding) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to generate embedding'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If memory_id provided, update the database (scope by user when not service call)
    if (request.memory_id) {
      let updateQuery = supabase
        .from('jarvis_user_memory')
        .update({ embedding })
        .eq('id', request.memory_id);
      if (!auth.isServiceCall) {
        updateQuery = updateQuery.eq('user_id', auth.userId!);
      }
      const { error: updateError } = await updateQuery;
      
      if (updateError) {
        console.error('[EmbeddingGen] Failed to update memory:', updateError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to save embedding',
          embedding // Still return the embedding
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      embedding,
      dimensions: embedding.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[EmbeddingGen] Error:', error);
    return buildErrorResponse('jarvis-generate-embedding', error, corsHeaders, 500);
  }
});

async function generateEmbedding(
  endpoint: string,
  apiKey: string,
  text: string
): Promise<number[] | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        input: text.slice(0, 8000), // Limit input length
        model: Deno.env.get('IA_MODELE_EMBEDDINGS') ?? ''
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EmbeddingGen] Azure API error: ${response.status} - ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('[EmbeddingGen] Request timed out');
    } else {
      console.error('[EmbeddingGen] Fetch error:', error);
    }
    return null;
  }
}
