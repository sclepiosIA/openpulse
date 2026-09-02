/**
 * useJarvisPerformanceMetrics - Self-tuning performance tracking
 * 
 * Tracks latency, success rates, and adjusts Jarvis behavior dynamically.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/shared/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';

export interface PerformanceMetric {
  tool_name: string;
  latency_ms: number;
  success: boolean;
  timestamp: number;
}

interface AggregatedMetrics {
  avgLatency: number;
  successRate: number;
  callCount: number;
  p95Latency: number;
}

interface UseJarvisPerformanceMetricsReturn {
  recordMetric: (toolName: string, latencyMs: number, success: boolean) => void;
  getToolMetrics: (toolName: string) => AggregatedMetrics | undefined;
  getAllMetrics: () => Map<string, AggregatedMetrics>;
  getOverallHealth: () => 'excellent' | 'good' | 'degraded' | 'critical';
  shouldReduceContext: () => boolean;
  shouldIncreaseConfirmationThreshold: (toolName: string) => boolean;
  persistMetrics: () => Promise<void>;
}

const METRIC_WINDOW_SIZE = 100; // Keep last 100 metrics per tool
const LATENCY_THRESHOLD_MS = 3000;
const SUCCESS_RATE_THRESHOLD = 0.9;

export function useJarvisPerformanceMetrics(): UseJarvisPerformanceMetricsReturn {
  const { user } = useAuth();
  const metricsRef = useRef<Map<string, PerformanceMetric[]>>(new Map());
  const [aggregated, setAggregated] = useState<Map<string, AggregatedMetrics>>(new Map());

  // Record a new metric
  const recordMetric = useCallback((toolName: string, latencyMs: number, success: boolean) => {
    const metric: PerformanceMetric = {
      tool_name: toolName,
      latency_ms: latencyMs,
      success,
      timestamp: Date.now(),
    };

    // Get or create metrics array for this tool
    const toolMetrics = metricsRef.current.get(toolName) || [];
    toolMetrics.push(metric);

    // Keep only last METRIC_WINDOW_SIZE metrics
    if (toolMetrics.length > METRIC_WINDOW_SIZE) {
      toolMetrics.shift();
    }
    metricsRef.current.set(toolName, toolMetrics);

    // Recalculate aggregates
    updateAggregates(toolName, toolMetrics);
  }, []);

  // Calculate aggregated metrics
  const updateAggregates = useCallback((toolName: string, metrics: PerformanceMetric[]) => {
    if (metrics.length === 0) return;

    const latencies = metrics.map(m => m.latency_ms).sort((a, b) => a - b);
    const successCount = metrics.filter(m => m.success).length;

    const aggregatedMetric: AggregatedMetrics = {
      avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      successRate: successCount / metrics.length,
      callCount: metrics.length,
      p95Latency: latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1],
    };

    setAggregated(prev => {
      const newMap = new Map(prev);
      newMap.set(toolName, aggregatedMetric);
      return newMap;
    });
  }, []);

  // Get metrics for a specific tool
  const getToolMetrics = useCallback((toolName: string): AggregatedMetrics | undefined => {
    return aggregated.get(toolName);
  }, [aggregated]);

  // Get all metrics
  const getAllMetrics = useCallback((): Map<string, AggregatedMetrics> => {
    return new Map(aggregated);
  }, [aggregated]);

  // Calculate overall health
  const getOverallHealth = useCallback((): 'excellent' | 'good' | 'degraded' | 'critical' => {
    const allMetrics = Array.from(aggregated.values());
    if (allMetrics.length === 0) return 'excellent';

    const avgLatency = allMetrics.reduce((sum, m) => sum + m.avgLatency, 0) / allMetrics.length;
    const avgSuccessRate = allMetrics.reduce((sum, m) => sum + m.successRate, 0) / allMetrics.length;

    if (avgLatency < 1000 && avgSuccessRate > 0.95) return 'excellent';
    if (avgLatency < 2000 && avgSuccessRate > 0.9) return 'good';
    if (avgLatency < 4000 && avgSuccessRate > 0.8) return 'degraded';
    return 'critical';
  }, [aggregated]);

  // Self-tuning: Should reduce context to improve latency?
  const shouldReduceContext = useCallback((): boolean => {
    const allMetrics = Array.from(aggregated.values());
    if (allMetrics.length === 0) return false;

    const avgLatency = allMetrics.reduce((sum, m) => sum + m.avgLatency, 0) / allMetrics.length;
    return avgLatency > LATENCY_THRESHOLD_MS;
  }, [aggregated]);

  // Self-tuning: Should increase confirmation threshold for a tool?
  const shouldIncreaseConfirmationThreshold = useCallback((toolName: string): boolean => {
    const metrics = aggregated.get(toolName);
    if (!metrics || metrics.callCount < 10) return false;
    return metrics.successRate < SUCCESS_RATE_THRESHOLD;
  }, [aggregated]);

  // Persist metrics to database (batch write)
  const persistMetrics = useCallback(async () => {
    if (!user?.id) return;

    const metricsToSave = Array.from(aggregated.entries()).map(([toolName, data]) => ({
      user_id: user.id,
      metric_type: 'tool_performance',
      tool_name: toolName,
      value: data.avgLatency,
      breakdown: {
        success_rate: data.successRate,
        p95_latency: data.p95Latency,
        call_count: data.callCount,
      },
      date: new Date().toISOString().split('T')[0],
    }));

    if (metricsToSave.length > 0) {
      try {
        // Use upsert-like logic via RPC or direct insert
        await supabase.from('jarvis_performance_metrics').insert(metricsToSave as never);
      } catch (error) {
        debug.error('[PerformanceMetrics] Failed to persist:', error);
      }
    }
  }, [user?.id, aggregated]);

  // Auto-persist every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (aggregated.size > 0) {
        persistMetrics();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [persistMetrics, aggregated.size]);

  return {
    recordMetric,
    getToolMetrics,
    getAllMetrics,
    getOverallHealth,
    shouldReduceContext,
    shouldIncreaseConfirmationThreshold,
    persistMetrics,
  };
}
