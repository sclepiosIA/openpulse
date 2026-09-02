/**
 * JARVIS 10.0 - Health Check Endpoint
 * 
 * Monitors system health including:
 * - Azure OpenAI connectivity
 * - Database connectivity
 * - Circuit breaker states
 * - Tool health metrics
 * - Overall system status
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateUserAuth } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { requireInternalSecret } from "../_shared/internal-secret.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface HealthCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'OFFLINE';
  timestamp: string;
  checks: {
    database: ComponentHealth;
    azureGpt52: ComponentHealth;
    azureGpt5: ComponentHealth;
    circuitBreakers: CircuitBreakersSummary;
  };
  recommendations: string[];
  responseTimeMs: number;
}

interface ComponentHealth {
  status: 'ok' | 'degraded' | 'error' | 'unknown';
  latencyMs?: number;
  message?: string;
  lastChecked: string;
}

interface CircuitBreakersSummary {
  total: number;
  closed: number;
  open: number;
  halfOpen: number;
}

// Simple in-memory circuit state for health check
// In production, this would be shared with the actual circuit breakers
const circuitStates: Record<string, 'CLOSED' | 'OPEN' | 'HALF-OPEN'> = {};

/**
 * Check database connectivity
 */
async function checkDatabase(supabase: ReturnType<typeof createClient>): Promise<ComponentHealth> {
  const startTime = Date.now();
  
  try {
    // Simple query to check connectivity
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    const latencyMs = Date.now() - startTime;

    if (error) {
      return {
        status: 'error',
        latencyMs,
        message: error.message,
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: latencyMs < 1000 ? 'ok' : 'degraded',
      latencyMs,
      message: latencyMs > 1000 ? 'High latency detected' : undefined,
      lastChecked: new Date().toISOString(),
    };
  } catch (error: unknown) {
    return {
      status: 'error',
      latencyMs: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check Azure OpenAI connectivity (lightweight ping)
 */
async function checkAzureEndpoint(
  name: string,
  endpoint: string | undefined,
  apiKey: string | undefined
): Promise<ComponentHealth> {
  if (!endpoint || !apiKey) {
    return {
      status: 'unknown',
      message: 'Endpoint not configured',
      lastChecked: new Date().toISOString(),
    };
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // Lightweight request with minimal tokens
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      circuitStates[name] = 'CLOSED';
      return {
        status: latencyMs < 3000 ? 'ok' : 'degraded',
        latencyMs,
        message: latencyMs > 3000 ? 'High latency detected' : undefined,
        lastChecked: new Date().toISOString(),
      };
    }

    // Rate limited but endpoint is reachable
    if (response.status === 429) {
      return {
        status: 'degraded',
        latencyMs,
        message: 'Rate limited',
        lastChecked: new Date().toISOString(),
      };
    }

    circuitStates[name] = 'OPEN';
    return {
      status: 'error',
      latencyMs,
      message: `HTTP ${response.status}`,
      lastChecked: new Date().toISOString(),
    };

  } catch (error) {
    clearTimeout(timeoutId);
    circuitStates[name] = 'OPEN';
    
    return {
      status: 'error',
      latencyMs: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Connection failed',
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Get circuit breakers summary
 */
function getCircuitBreakersSummary(): CircuitBreakersSummary {
  const states = Object.values(circuitStates);
  return {
    total: states.length || 2, // At least Azure endpoints
    closed: states.filter(s => s === 'CLOSED').length,
    open: states.filter(s => s === 'OPEN').length,
    halfOpen: states.filter(s => s === 'HALF-OPEN').length,
  };
}

/**
 * Generate recommendations based on health status
 */
function generateRecommendations(checks: HealthCheckResult['checks']): string[] {
  const recommendations: string[] = [];

  if (checks.database.status === 'error') {
    recommendations.push('Database connectivity issue detected - check Supabase status');
  } else if (checks.database.status === 'degraded') {
    recommendations.push('Database latency elevated - consider query optimization');
  }

  if (checks.azureGpt52.status === 'error' && checks.azureGpt5.status === 'error') {
    recommendations.push('Both Azure endpoints down - activate cache-only mode');
  } else if (checks.azureGpt52.status === 'error') {
    recommendations.push('GPT-5.2 endpoint down - using GPT-5 fallback');
  } else if (checks.azureGpt5.status === 'error') {
    recommendations.push('GPT-5 fallback endpoint down - primary still available');
  }

  if (checks.circuitBreakers.open > 0) {
    recommendations.push(`${checks.circuitBreakers.open} circuit(s) open - some features may be degraded`);
  }

  if ((checks.azureGpt52.latencyMs || 0) > 5000 || (checks.azureGpt5.latencyMs || 0) > 5000) {
    recommendations.push('High AI latency detected - consider reducing context size');
  }

  return recommendations;
}

/**
 * Determine overall status from component checks
 */
function determineOverallStatus(checks: HealthCheckResult['checks']): HealthCheckResult['status'] {
  const { database, azureGpt52, azureGpt5 } = checks;

  // Both AI endpoints down = OFFLINE
  if (azureGpt52.status === 'error' && azureGpt5.status === 'error') {
    return 'OFFLINE';
  }

  // Database down = UNHEALTHY
  if (database.status === 'error') {
    return 'UNHEALTHY';
  }

  // Any error or multiple degraded = UNHEALTHY
  const errorCount = [database, azureGpt52, azureGpt5].filter(c => c.status === 'error').length;
  const degradedCount = [database, azureGpt52, azureGpt5].filter(c => c.status === 'degraded').length;

  if (errorCount > 0 || degradedCount >= 2) {
    return 'UNHEALTHY';
  }

  // Any degraded = DEGRADED
  if (degradedCount > 0) {
    return 'DEGRADED';
  }

  return 'HEALTHY';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Dual auth: internal CRON (shared secret OR service_role Bearer) OR authenticated user
  const internalDenied = requireInternalSecret(req, corsHeaders);
  if (internalDenied) {
    const auth = await validateUserAuth(req);
    if ('error' in auth) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  const startTime = Date.now();
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const [database, azureGpt52, azureGpt5] = await Promise.all([
      checkDatabase(supabase),
      checkAzureEndpoint(
        'GPT-5.2',
        Deno.env.get('AZURE_OPENAI_ENDPOINT'),
        Deno.env.get('AZURE_OPENAI_API_KEY'),
      ),
      checkAzureEndpoint(
        'GPT-5',
        Deno.env.get('AZURE_OPENAI_ENDPOINT_FALLBACK') ?? Deno.env.get('AZURE_OPENAI_ENDPOINT'),
        Deno.env.get('AZURE_OPENAI_API_KEY_FALLBACK') ?? Deno.env.get('AZURE_OPENAI_API_KEY'),
      ),
    ]);

    const circuitBreakers: CircuitBreakersSummary = {
      total: Object.keys(circuitStates).length,
      closed: Object.values(circuitStates).filter(s => s === 'CLOSED').length,
      open: Object.values(circuitStates).filter(s => s === 'OPEN').length,
      halfOpen: Object.values(circuitStates).filter(s => s === 'HALF-OPEN').length,
    };

    const checks = { database, azureGpt52, azureGpt5, circuitBreakers };
    const result: HealthCheckResult = {
      status: determineOverallStatus(checks),
      timestamp: new Date().toISOString(),
      checks,
      recommendations: generateRecommendations(checks),
      responseTimeMs: Date.now() - startTime,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return buildErrorResponse('jarvis-health-check', error, corsHeaders, 500);
  }
});

