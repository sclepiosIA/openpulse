/**
 * JARVIS 9.0 - Enhanced Executor
 * 
 * Moteur d'exécution amélioré avec:
 * - Exécution parallèle intelligente
 * - Classification multi-intentions
 * - Pré-chargement de données
 * - Apprentissage en temps réel
 */

import { executeTool, ToolExecutionContext, ToolResult, requiresConfirmation } from "./tools-executor.ts";
import { executeToolsParallel, canParallelize, ToolCall } from "./parallel-executor.ts";
import { classifyIntents, IntentClassificationResult } from "./intent-classifier.ts";

export interface EnhancedExecutionResult {
  results: ToolResult[];
  parallelized: boolean;
  totalTimeMs: number;
  parallelGain: number;
  intentsDetected: number;
  executionStrategy: 'sequential' | 'parallel' | 'hybrid';
}

export interface ExecutionPlan {
  toolCalls: ToolCall[];
  canParallelize: boolean;
  requiresUserConfirmation: boolean[];
  estimatedTimeMs: number;
}

/**
 * Analyse le message et prépare un plan d'exécution optimisé
 */
export function prepareExecutionPlan(
  userMessage: string,
  toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>
): ExecutionPlan {
  // Classifier les intentions pour contexte
  const intents = classifyIntents(userMessage);
  
  // Convertir les tool calls
  const calls: ToolCall[] = toolCalls.map(tc => ({
    id: tc.id,
    name: tc.function.name,
    arguments: safeParseJSON(tc.function.arguments),
  }));
  
  // Vérifier quels outils nécessitent confirmation
  const needsConfirmation = calls.map(c => requiresConfirmation(c.name, false, c.arguments));
  
  // Estimer le temps (moyenne 500ms par outil)
  const estimatedTime = calls.length * 500;
  
  return {
    toolCalls: calls,
    canParallelize: canParallelize(calls) && intents.suggestedParallelExecution,
    requiresUserConfirmation: needsConfirmation,
    estimatedTimeMs: estimatedTime,
  };
}

/**
 * Exécute les outils de manière optimisée (parallèle ou séquentielle)
 */
export async function executeToolsOptimized(
  context: ToolExecutionContext,
  toolCalls: ToolCall[],
  options: {
    preferParallel?: boolean;
    skipConfirmation?: boolean;
    maxParallelTools?: number;
  } = {}
): Promise<EnhancedExecutionResult> {
  const startTime = Date.now();
  const { preferParallel = true, skipConfirmation = false, maxParallelTools = 5 } = options;
  
  // Filtrer les outils qui nécessitent confirmation si non skipConfirmation
  const executableCalls = skipConfirmation 
    ? toolCalls 
    : toolCalls.filter(tc => !requiresConfirmation(tc.name, false, tc.arguments));
  
  const blockedCalls = toolCalls.filter(tc => requiresConfirmation(tc.name, false, tc.arguments) && !skipConfirmation);
  
  if (executableCalls.length === 0) {
    return {
      results: blockedCalls.map(tc => ({
        success: false,
        error: 'REQUIRES_CONFIRMATION',
        data: { tool: tc.name, args: tc.arguments },
        execution_time_ms: 0,
      })),
      parallelized: false,
      totalTimeMs: 0,
      parallelGain: 0,
      intentsDetected: toolCalls.length,
      executionStrategy: 'sequential',
    };
  }
  
  // Décider de la stratégie d'exécution
  const shouldParallelize = preferParallel && 
    canParallelize(executableCalls) && 
    executableCalls.length <= maxParallelTools;
  
  let results: ToolResult[];
  let parallelGain = 0;
  let strategy: 'sequential' | 'parallel' | 'hybrid' = 'sequential';
  
  if (shouldParallelize && executableCalls.length > 1) {
    console.log(`[EnhancedExecutor] Executing ${executableCalls.length} tools in PARALLEL`);
    strategy = 'parallel';
    
    const parallelResult = await executeToolsParallel(executableCalls, context);
    results = Array.from(parallelResult.results.values());
    parallelGain = parallelResult.parallelizationGain;
  } else {
    console.log(`[EnhancedExecutor] Executing ${executableCalls.length} tools SEQUENTIALLY`);
    
    results = [];
    for (const call of executableCalls) {
      const result = await executeTool(context, call.name, call.arguments);
      results.push(result);
    }
  }
  
  // Ajouter les résultats des outils bloqués
  for (const blocked of blockedCalls) {
    results.push({
      success: false,
      error: 'REQUIRES_CONFIRMATION',
      data: { tool: blocked.name, args: blocked.arguments },
      execution_time_ms: 0,
    });
  }
  
  return {
    results,
    parallelized: shouldParallelize,
    totalTimeMs: Date.now() - startTime,
    parallelGain,
    intentsDetected: toolCalls.length,
    executionStrategy: strategy,
  };
}

/**
 * Analyse une requête et suggère les outils à utiliser avant l'appel GPT
 */
export function preAnalyzeRequest(
  message: string
): {
  suggestedTools: string[];
  likelyMultiIntent: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
  shouldPrefetch: string[];
} {
  const classification = classifyIntents(message);
  
  // Extraire les outils suggérés
  const suggestedTools = classification.intents
    .filter(i => i.suggestedTool)
    .map(i => i.suggestedTool!);
  
  // Données à pré-charger
  const shouldPrefetch: string[] = [];
  
  for (const intent of classification.intents) {
    if (intent.type === 'list_tasks') shouldPrefetch.push('taches');
    if (intent.type === 'pipeline') shouldPrefetch.push('etablissements');
    if (intent.type === 'treasury') shouldPrefetch.push('factures');
    if (intent.type === 'support') shouldPrefetch.push('support_tickets');
  }
  
  return {
    suggestedTools: [...new Set(suggestedTools)],
    likelyMultiIntent: classification.isMultiIntent,
    complexity: classification.complexity,
    shouldPrefetch: [...new Set(shouldPrefetch)],
  };
}

/**
 * Pré-charge les données susceptibles d'être utilisées
 */
export async function prefetchLikelyData(
  context: ToolExecutionContext,
  tables: string[]
): Promise<Map<string, unknown[]>> {
  const prefetchedData = new Map<string, unknown[]>();
  
  const queries = tables.map(async (table) => {
    try {
      const { data, error } = await context.supabase
        .from(table)
        .select('*')
        .limit(20)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        prefetchedData.set(table, data);
      }
    } catch (e) {
      console.warn(`[EnhancedExecutor] Prefetch failed for ${table}:`, e);
    }
  });
  
  await Promise.all(queries);
  return prefetchedData;
}

/**
 * Enregistre les métriques d'exécution pour l'apprentissage
 */
export async function recordExecutionMetrics(
  context: ToolExecutionContext,
  result: EnhancedExecutionResult,
  userMessage: string
): Promise<void> {
  try {
    await context.adminClient
      .from('jarvis_performance_metrics')
      .insert({
        user_id: context.userId,
        metric_type: 'execution',
        value: result.totalTimeMs,
        breakdown: {
          parallelized: result.parallelized,
          parallel_gain: result.parallelGain,
          tools_count: result.results.length,
          strategy: result.executionStrategy,
          intents: result.intentsDetected,
          success_rate: result.results.filter(r => r.success).length / result.results.length,
          message_preview: userMessage.substring(0, 100),
        },
      });
  } catch (e) {
    console.error('[EnhancedExecutor] Failed to record metrics:', e);
  }
}

function safeParseJSON(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
