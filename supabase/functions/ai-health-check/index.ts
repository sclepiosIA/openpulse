import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface EndpointHealth {
  model: string;
  status: 'ok' | 'error' | 'unconfigured';
  latency_ms: number | null;
  error?: string;
  endpoint_configured: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check - admin only
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: roles } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: EndpointHealth[] = [];

    // Test GPT-5.4 endpoint (primary — AZURE_OPENAI_ENDPOINT is the 5.4 deployment)
    const gpt54Endpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT');
    const gpt54Key = Deno.env.get('AZURE_OPENAI_API_KEY');
    results.push(await testEndpoint('gpt-5.4', gpt54Endpoint, gpt54Key));

    // Test GPT-5.2 endpoint (fallback)
    const gpt52Endpoint = Deno.env.get('AZURE_GPT52_ENDPOINT');
    const gpt52Key = Deno.env.get('AZURE_GPT52_API_KEY') || gpt54Key;
    results.push(await testEndpoint('gpt-5.2', gpt52Endpoint, gpt52Key));

    // Test GPT-5 Mini endpoint (final fallback)
    const gpt5MiniEndpoint = Deno.env.get('AZURE_GPT5_MINI_ENDPOINT');
    const gpt5MiniKey = Deno.env.get('AZURE_GPT5_MINI_API_KEY') || gpt54Key;
    results.push(await testEndpoint('gpt-5-mini', gpt5MiniEndpoint, gpt5MiniKey));

    return new Response(JSON.stringify({
      success: true,
      checked_at: new Date().toISOString(),
      endpoints: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('ai-health-check error:', error);
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function testEndpoint(
  model: string,
  endpoint?: string,
  apiKey?: string
): Promise<EndpointHealth> {
  if (!endpoint || !apiKey) {
    return {
      model,
      status: 'unconfigured',
      latency_ms: null,
      endpoint_configured: false,
    };
  }

  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'ping' }],
        max_completion_tokens: 5,
        reasoning_effort: 'low',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latency = Date.now() - start;

    if (response.ok || response.status === 200) {
      // Consume body
      await response.text();
      return {
        model,
        status: 'ok',
        latency_ms: latency,
        endpoint_configured: true,
      };
    }

    const errorText = await response.text();
    return {
      model,
      status: response.status === 429 ? 'ok' : 'error', // 429 = reachable but rate limited
      latency_ms: latency,
      error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
      endpoint_configured: true,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      model,
      status: 'error',
      latency_ms: Date.now() - start,
      error: err.name === 'AbortError' ? 'Timeout (15s)' : err.message,
      endpoint_configured: true,
    };
  }
}
