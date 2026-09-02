/**
 * JARVIS 10.5 - Persistent Circuit Breaker
 * 
 * Circuit Breaker avec persistance en base de données pour survie cross-instance.
 * Synchronise l'état mémoire avec jarvis_circuit_state toutes les 10s.
 */

import { createClient } from "@supabase/supabase-js";
import {
  getCircuit,
  recordSuccess as baseRecordSuccess,
  recordFailure as baseRecordFailure,
  canExecute as baseCanExecute,
  getAllCircuitStates,
  resetCircuit as baseResetCircuit,
  type CircuitState,
  type CircuitMetrics,
} from "./circuit-breaker.ts";

// Cache pour éviter trop de requêtes DB
let lastSyncTime = 0;
const SYNC_INTERVAL_MS = 10000; // 10 secondes
let syncPromise: Promise<void> | null = null;

/**
 * Initialise le Supabase client pour les opérations DB
 */
function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

/**
 * Restaure l'état des circuits depuis la base de données au démarrage
 */
export async function restoreCircuitStatesFromDB(): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('jarvis_circuit_state')
      .select('*');

    if (error) {
      console.error('[CircuitBreaker] Error restoring states from DB:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log(`[CircuitBreaker] Restoring ${data.length} circuit states from DB`);
      
      for (const row of data) {
        // Initialiser le circuit avec l'état de la DB
        const circuit = getCircuit(row.circuit_name);
        
        // Restaurer l'état seulement si le circuit est plus récent en DB
        const dbStateTime = new Date(row.state_changed_at).getTime();
        if (dbStateTime > circuit.metrics.stateChangedAt) {
          circuit.state = row.state as CircuitState;
          circuit.metrics.failureCount = row.failure_count || 0;
          circuit.metrics.successCount = row.success_count || 0;
          circuit.metrics.consecutiveFailures = row.consecutive_failures || 0;
          circuit.metrics.consecutiveSuccesses = row.consecutive_successes || 0;
          circuit.metrics.avgLatencyMs = row.avg_latency_ms || 0;
          circuit.metrics.p95LatencyMs = row.p95_latency_ms || 0;
          circuit.metrics.stateChangedAt = dbStateTime;
          
          console.log(`[CircuitBreaker] Restored ${row.circuit_name}: ${row.state}`);
        }
      }
    }
  } catch (error) {
    console.error('[CircuitBreaker] Exception restoring states:', error);
  }
}

/**
 * Synchronise tous les états circuits vers la base de données
 */
export async function syncCircuitStatesToDB(): Promise<void> {
  const now = Date.now();
  
  // Éviter les syncs trop fréquentes
  if (now - lastSyncTime < SYNC_INTERVAL_MS) {
    return;
  }
  
  // Éviter les syncs concurrentes
  if (syncPromise) {
    return syncPromise;
  }

  syncPromise = (async () => {
    try {
      const states = getAllCircuitStates();
      const supabase = getSupabaseClient();

      for (const [name, { state, metrics }] of Object.entries(states)) {
        // Utiliser la fonction SQL pour upsert
        const { error } = await supabase.rpc('update_jarvis_circuit_state', {
          p_circuit_name: name,
          p_state: state,
          p_failure_count: metrics.failureCount,
          p_success_count: metrics.successCount,
          p_consecutive_failures: metrics.consecutiveFailures,
          p_consecutive_successes: metrics.consecutiveSuccesses,
          p_avg_latency_ms: metrics.avgLatencyMs,
          p_p95_latency_ms: metrics.p95LatencyMs,
        });

        if (error) {
          console.error(`[CircuitBreaker] Error syncing ${name} to DB:`, error);
        }
      }

      lastSyncTime = now;
    } catch (error) {
      console.error('[CircuitBreaker] Exception syncing to DB:', error);
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

/**
 * Record success with DB sync
 */
export function recordSuccessPersistent(name: string, latencyMs: number): void {
  baseRecordSuccess(name, latencyMs);
  
  // Async sync to DB (non-blocking)
  syncCircuitStatesToDB().catch(err => 
    console.error('[CircuitBreaker] Sync error:', err)
  );
}

/**
 * Record failure with DB sync
 */
export function recordFailurePersistent(name: string, latencyMs: number, error?: string): void {
  baseRecordFailure(name, latencyMs, error);
  
  // Async sync to DB (non-blocking)
  syncCircuitStatesToDB().catch(err => 
    console.error('[CircuitBreaker] Sync error:', err)
  );
}

/**
 * Check if circuit allows execution (with optional DB restore)
 */
export async function canExecutePersistent(
  name: string,
  forceRestore = false
): Promise<{ allowed: boolean; state: CircuitState; reason?: string }> {
  // Restore from DB if needed
  if (forceRestore) {
    await restoreCircuitStatesFromDB();
  }
  
  return baseCanExecute(name);
}

/**
 * Reset circuit with DB sync
 */
export async function resetCircuitPersistent(name: string): Promise<void> {
  baseResetCircuit(name);
  await syncCircuitStatesToDB();
}

/**
 * Get all circuit states with DB merge
 */
export async function getAllCircuitStatesPersistent(): Promise<
  Record<string, { state: CircuitState; metrics: CircuitMetrics; fromDB: boolean }>
> {
  const memoryStates = getAllCircuitStates();
  const result: Record<string, { state: CircuitState; metrics: CircuitMetrics; fromDB: boolean }> = {};
  
  // Add memory states
  for (const [name, data] of Object.entries(memoryStates)) {
    result[name] = { ...data, fromDB: false };
  }
  
  // Merge with DB states
  try {
    const supabase = getSupabaseClient();
    const { data: dbStates } = await supabase
      .from('jarvis_circuit_state')
      .select('*');
    
    for (const row of dbStates || []) {
      if (!result[row.circuit_name]) {
        result[row.circuit_name] = {
          state: row.state as CircuitState,
          metrics: {
            totalRequests: (row.success_count || 0) + (row.failure_count || 0),
            successCount: row.success_count || 0,
            failureCount: row.failure_count || 0,
            consecutiveFailures: row.consecutive_failures || 0,
            consecutiveSuccesses: row.consecutive_successes || 0,
            lastFailureTime: row.last_failure_at ? new Date(row.last_failure_at).getTime() : null,
            lastSuccessTime: row.last_success_at ? new Date(row.last_success_at).getTime() : null,
            avgLatencyMs: row.avg_latency_ms || 0,
            p95LatencyMs: row.p95_latency_ms || 0,
            stateChangedAt: new Date(row.state_changed_at).getTime(),
          },
          fromDB: true,
        };
      }
    }
  } catch (error) {
    console.error('[CircuitBreaker] Error fetching DB states:', error);
  }
  
  return result;
}

// Re-export base functions for backwards compatibility
export {
  getCircuit,
  canExecute as canExecuteBase,
  recordSuccess as recordSuccessBase,
  recordFailure as recordFailureBase,
  getOverallHealth,
  executeWithCircuitBreaker,
} from "./circuit-breaker.ts";
