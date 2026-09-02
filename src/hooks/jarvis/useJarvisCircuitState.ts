/**
 * useJarvisCircuitState - Frontend circuit breaker state tracking
 * 
 * Monitors Jarvis system health and provides:
 * - Real-time health status
 * - Circuit breaker states
 * - Connection monitoring
 * - Graceful degradation hints
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'OFFLINE' | 'UNKNOWN';

export interface CircuitState {
  name: string;
  status: 'CLOSED' | 'OPEN' | 'HALF-OPEN';
  latencyMs?: number;
  lastError?: string;
}

export interface JarvisHealthState {
  status: HealthStatus;
  lastChecked: Date | null;
  isChecking: boolean;
  circuits: CircuitState[];
  recommendations: string[];
  responseTimeMs: number | null;
  degradationMode: 'full' | 'reduced' | 'minimal' | 'cache-only';
}

interface UseJarvisCircuitStateOptions {
  checkIntervalMs?: number;
  autoCheck?: boolean;
}

export function useJarvisCircuitState(options: UseJarvisCircuitStateOptions = {}) {
  const { checkIntervalMs = 30000, autoCheck = true } = options;
  
  const [health, setHealth] = useState<JarvisHealthState>({
    status: 'UNKNOWN',
    lastChecked: null,
    isChecking: false,
    circuits: [],
    recommendations: [],
    responseTimeMs: null,
    degradationMode: 'full',
  });

  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  /**
   * Determine degradation mode based on health status
   */
  const getDegradationMode = useCallback((status: HealthStatus): JarvisHealthState['degradationMode'] => {
    switch (status) {
      case 'HEALTHY':
        return 'full';
      case 'DEGRADED':
        return 'reduced';
      case 'UNHEALTHY':
        return 'minimal';
      case 'OFFLINE':
        return 'cache-only';
      default:
        return 'full';
    }
  }, []);

  /**
   * Fetch health status from the health check endpoint
   */
  const checkHealth = useCallback(async () => {
    if (!mountedRef.current) return;
    
    setHealth(prev => ({ ...prev, isChecking: true }));

    try {
      const { data, error } = await supabase.functions.invoke('jarvis-health-check', {
        method: 'GET',
      });

      if (!mountedRef.current) return;

      if (error) {
        debug.error('[JarvisCircuitState] Health check error:', error);
        setHealth(prev => ({
          ...prev,
          status: 'UNKNOWN',
          isChecking: false,
          lastChecked: new Date(),
          recommendations: ['Health check failed - status unknown'],
          degradationMode: 'reduced',
        }));
        return;
      }

      const status = data.status as HealthStatus;
      const circuits: CircuitState[] = [];

      // Extract circuit states from checks
      if (data.checks?.azureGpt52) {
        circuits.push({
          name: 'azure-gpt52',
          status: data.checks.azureGpt52.status === 'ok' ? 'CLOSED' : 
                  data.checks.azureGpt52.status === 'degraded' ? 'HALF-OPEN' : 'OPEN',
          latencyMs: data.checks.azureGpt52.latencyMs,
          lastError: data.checks.azureGpt52.message,
        });
      }

      if (data.checks?.azureGpt5) {
        circuits.push({
          name: 'azure-gpt5',
          status: data.checks.azureGpt5.status === 'ok' ? 'CLOSED' : 
                  data.checks.azureGpt5.status === 'degraded' ? 'HALF-OPEN' : 'OPEN',
          latencyMs: data.checks.azureGpt5.latencyMs,
          lastError: data.checks.azureGpt5.message,
        });
      }

      if (data.checks?.database) {
        circuits.push({
          name: 'database',
          status: data.checks.database.status === 'ok' ? 'CLOSED' : 
                  data.checks.database.status === 'degraded' ? 'HALF-OPEN' : 'OPEN',
          latencyMs: data.checks.database.latencyMs,
          lastError: data.checks.database.message,
        });
      }

      setHealth({
        status,
        lastChecked: new Date(),
        isChecking: false,
        circuits,
        recommendations: data.recommendations || [],
        responseTimeMs: data.responseTimeMs,
        degradationMode: getDegradationMode(status),
      });

    } catch (error) {
      if (!mountedRef.current) return;
      
      debug.error('[JarvisCircuitState] Health check exception:', error);
      setHealth(prev => ({
        ...prev,
        status: 'OFFLINE',
        isChecking: false,
        lastChecked: new Date(),
        recommendations: ['Unable to reach health endpoint'],
        degradationMode: 'cache-only',
      }));
    }
  }, [getDegradationMode]);

  /**
   * Force a health check
   */
  const forceCheck = useCallback(() => {
    return checkHealth();
  }, [checkHealth]);

  /**
   * Get current context budget based on health (V11 OPTIMIZED)
   * Reduced by 40-60% for better latency
   */
  const getContextBudget = useCallback((): number => {
    switch (health.degradationMode) {
      case 'full':
        return 2500;  // Was 4000 → 2500 (37% reduction)
      case 'reduced':
        return 1500;  // Was 2000 → 1500 (25% reduction)
      case 'minimal':
        return 800;   // Was 1000 → 800 (20% reduction)
      case 'cache-only':
        return 400;   // Was 500 → 400 (20% reduction)
      default:
        return 1500;
    }
  }, [health.degradationMode]);

  /**
   * Check if streaming should be enabled
   */
  const shouldEnableStreaming = useCallback((): boolean => {
    return health.degradationMode !== 'cache-only' && 
           health.degradationMode !== 'minimal';
  }, [health.degradationMode]);

  /**
   * Check if a specific circuit is available
   */
  const isCircuitAvailable = useCallback((circuitName: string): boolean => {
    const circuit = health.circuits.find(c => c.name === circuitName);
    return circuit ? circuit.status !== 'OPEN' : true;
  }, [health.circuits]);

  // Setup auto-check interval
  useEffect(() => {
    mountedRef.current = true;

    if (autoCheck) {
      // Initial check
      checkHealth();

      // Setup interval
      checkIntervalRef.current = setInterval(checkHealth, checkIntervalMs);
    }

    return () => {
      mountedRef.current = false;
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [autoCheck, checkIntervalMs, checkHealth]);

  return {
    ...health,
    forceCheck,
    getContextBudget,
    shouldEnableStreaming,
    isCircuitAvailable,
  };
}

export default useJarvisCircuitState;
