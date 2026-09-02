/**
 * JARVIS 9.0 - Parallel Tool Executor
 * 
 * Exécute les outils en parallèle quand ils n'ont pas de dépendances entre eux.
 * Construit un DAG (graphe acyclique dirigé) pour optimiser l'exécution.
 */

import { executeTool, ToolExecutionContext, ToolResult } from "./tools-executor.ts";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ParallelExecutionResult {
  results: Map<string, ToolResult>;
  executionOrder: string[][];
  totalTimeMs: number;
  parallelizationGain: number;
}

// Tool dependencies - which tools must complete before others
const TOOL_DEPENDENCIES: Record<string, string[]> = {
  // send_email peut dépendre de query_database si on cherche un contact
  'send_email': [],
  // create_task peut dépendre de query_database si on lie à un établissement
  'create_task': [],
  // schedule_meeting peut dépendre de detect_calendar_conflicts
  'schedule_meeting': ['detect_calendar_conflicts'],
  // suggest_email_response dépend de query_database pour le thread
  'suggest_email_response': ['query_database'],
  // sync_qonto ne dépend de rien
  'sync_qonto_transactions': [],
  // create_invoice peut dépendre de query_database
  'create_invoice': [],
};

// Tools that produce data that others might consume
const DATA_PRODUCER_TOOLS = new Set([
  'query_database',
  'search_contacts',
  'search_establishments',
  'get_email_thread',
]);

/**
 * Analyse les appels d'outils pour détecter les dépendances
 */
function detectDependencies(toolCalls: ToolCall[]): Map<string, Set<string>> {
  const dependencies = new Map<string, Set<string>>();
  
  for (const call of toolCalls) {
    dependencies.set(call.id, new Set<string>());
  }
  
  // Vérifier les dépendances explicites
  for (const call of toolCalls) {
    const explicitDeps = TOOL_DEPENDENCIES[call.name] || [];
    
    for (const depTool of explicitDeps) {
      // Chercher si un autre appel de cet outil existe
      const depCall = toolCalls.find(tc => tc.name === depTool && tc.id !== call.id);
      if (depCall) {
        dependencies.get(call.id)!.add(depCall.id);
      }
    }
  }
  
  // Détecter les dépendances de données (ex: query_database puis send_email avec le résultat)
  const producerCalls = toolCalls.filter(tc => DATA_PRODUCER_TOOLS.has(tc.name));
  
  for (const call of toolCalls) {
    if (DATA_PRODUCER_TOOLS.has(call.name)) continue;
    
    // Vérifier si les arguments référencent des résultats de producteurs
    const argsStr = JSON.stringify(call.arguments).toLowerCase();
    
    for (const producer of producerCalls) {
      // Heuristique: si le nom de table/entité est mentionné, il y a probablement une dépendance
      const producerArgs = producer.arguments as Record<string, unknown>;
      const table = producerArgs.table as string | undefined;
      
      if (table && argsStr.includes(table.toLowerCase())) {
        dependencies.get(call.id)!.add(producer.id);
      }
    }
  }
  
  return dependencies;
}

/**
 * Construit les couches d'exécution parallèle (tri topologique)
 */
function buildExecutionLayers(
  toolCalls: ToolCall[],
  dependencies: Map<string, Set<string>>
): ToolCall[][] {
  const layers: ToolCall[][] = [];
  const executed = new Set<string>();
  const remaining = new Set(toolCalls.map(tc => tc.id));
  
  while (remaining.size > 0) {
    const layer: ToolCall[] = [];
    
    // Trouver tous les outils dont les dépendances sont satisfaites
    for (const call of toolCalls) {
      if (!remaining.has(call.id)) continue;
      
      const deps = dependencies.get(call.id)!;
      const allDepsSatisfied = [...deps].every(depId => executed.has(depId));
      
      if (allDepsSatisfied) {
        layer.push(call);
      }
    }
    
    // Éviter les boucles infinies
    if (layer.length === 0 && remaining.size > 0) {
      // Prendre le premier outil restant (dépendance cyclique ou manquante)
      const firstRemaining = toolCalls.find(tc => remaining.has(tc.id))!;
      layer.push(firstRemaining);
      console.warn(`[ParallelExecutor] Forced execution of ${firstRemaining.name} due to unresolved dependencies`);
    }
    
    // Marquer comme exécutés
    for (const call of layer) {
      executed.add(call.id);
      remaining.delete(call.id);
    }
    
    if (layer.length > 0) {
      layers.push(layer);
    }
  }
  
  return layers;
}

/**
 * Exécute les outils en parallèle selon les couches calculées
 */
export async function executeToolsParallel(
  toolCalls: ToolCall[],
  context: ToolExecutionContext
): Promise<ParallelExecutionResult> {
  const startTime = Date.now();
  const results = new Map<string, ToolResult>();
  const executionOrder: string[][] = [];
  
  if (toolCalls.length === 0) {
    return {
      results,
      executionOrder: [],
      totalTimeMs: 0,
      parallelizationGain: 0,
    };
  }
  
  // Si un seul outil, pas besoin de paralléliser
  if (toolCalls.length === 1) {
    const call = toolCalls[0];
    const result = await executeTool(context, call.name, call.arguments);
    results.set(call.id, result);
    
    return {
      results,
      executionOrder: [[call.name]],
      totalTimeMs: Date.now() - startTime,
      parallelizationGain: 0,
    };
  }
  
  // Détecter les dépendances et construire les couches
  const dependencies = detectDependencies(toolCalls);
  const layers = buildExecutionLayers(toolCalls, dependencies);
  
  console.log(`[ParallelExecutor] ${toolCalls.length} tools → ${layers.length} execution layers`);
  
  let sequentialEstimate = 0;
  
  // Exécuter couche par couche
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    const layer = layers[layerIndex];
    const layerStart = Date.now();
    
    console.log(`[ParallelExecutor] Layer ${layerIndex + 1}: ${layer.map(c => c.name).join(', ')}`);
    
    // Exécuter tous les outils de la couche en parallèle
    const layerResults = await Promise.all(
      layer.map(async (call) => {
        const toolStart = Date.now();
        try {
          const result = await executeTool(context, call.name, call.arguments);
          const toolTime = Date.now() - toolStart;
          sequentialEstimate += toolTime;
          return { id: call.id, result, time: toolTime };
        } catch (error) {
          const errorResult: ToolResult = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            execution_time_ms: Date.now() - toolStart,
          };
          return { id: call.id, result: errorResult, time: Date.now() - toolStart };
        }
      })
    );
    
    // Stocker les résultats
    for (const { id, result } of layerResults) {
      results.set(id, result);
    }
    
    executionOrder.push(layer.map(c => c.name));
    
    const layerTime = Date.now() - layerStart;
    console.log(`[ParallelExecutor] Layer ${layerIndex + 1} completed in ${layerTime}ms`);
  }
  
  const totalTime = Date.now() - startTime;
  const parallelizationGain = sequentialEstimate > 0 
    ? Math.round(((sequentialEstimate - totalTime) / sequentialEstimate) * 100)
    : 0;
  
  console.log(`[ParallelExecutor] Total: ${totalTime}ms (estimated sequential: ${sequentialEstimate}ms, gain: ${parallelizationGain}%)`);
  
  return {
    results,
    executionOrder,
    totalTimeMs: totalTime,
    parallelizationGain,
  };
}

/**
 * Vérifie si des outils peuvent être exécutés en parallèle
 */
export function canParallelize(toolCalls: ToolCall[]): boolean {
  if (toolCalls.length <= 1) return false;
  
  const dependencies = detectDependencies(toolCalls);
  const layers = buildExecutionLayers(toolCalls, dependencies);
  
  // Si toutes les couches ont un seul élément, pas de parallélisation possible
  return layers.some(layer => layer.length > 1);
}

/**
 * Estime le gain de parallélisation potentiel
 */
export function estimateParallelizationGain(toolCalls: ToolCall[]): number {
  if (toolCalls.length <= 1) return 0;
  
  const dependencies = detectDependencies(toolCalls);
  const layers = buildExecutionLayers(toolCalls, dependencies);
  
  // Estimation basique: si tous en parallèle, gain = (n-1)/n
  // Réalité: dépend des couches
  const maxLayerSize = Math.max(...layers.map(l => l.length));
  const avgLayerSize = toolCalls.length / layers.length;
  
  // Gain estimé basé sur la taille moyenne des couches
  return Math.round(((avgLayerSize - 1) / avgLayerSize) * 100);
}
