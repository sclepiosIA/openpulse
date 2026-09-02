/**
 * useJarvisMetricsHistory - Track and visualize Jarvis performance over time
 * 
 * Provides:
 * - Historical latency data (P50, P95, P99)
 * - Tool success rates
 * - Usage heatmap by hour
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/shared/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';

export interface MetricPoint {
  timestamp: number;
  value: number;
  toolName?: string;
}

export interface ToolStats {
  name: string;
  totalCalls: number;
  successCount: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

export interface HourlyUsage {
  hour: number;
  count: number;
  avgLatency: number;
}

interface MetricsHistoryState {
  latencyHistory: MetricPoint[];
  toolStats: ToolStats[];
  hourlyUsage: HourlyUsage[];
  p50: number;
  p95: number;
  p99: number;
  overallSuccessRate: number;
  totalInteractions: number;
}

const MAX_HISTORY_POINTS = 100;

export function useJarvisMetricsHistory() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<MetricsHistoryState>({
    latencyHistory: [],
    toolStats: [],
    hourlyUsage: [],
    p50: 0,
    p95: 0,
    p99: 0,
    overallSuccessRate: 100,
    totalInteractions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  
  const localMetricsRef = useRef<MetricPoint[]>([]);

  // Record a new metric point (called from performance hooks)
  const recordMetric = useCallback((latencyMs: number, toolName?: string, success: boolean = true) => {
    const point: MetricPoint = {
      timestamp: Date.now(),
      value: latencyMs,
      toolName,
    };
    
    localMetricsRef.current.push(point);
    
    // Keep only last MAX_HISTORY_POINTS
    if (localMetricsRef.current.length > MAX_HISTORY_POINTS) {
      localMetricsRef.current = localMetricsRef.current.slice(-MAX_HISTORY_POINTS);
    }
    
    // Recalculate percentiles
    const latencies = localMetricsRef.current.map(p => p.value).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
    
    setMetrics(prev => ({
      ...prev,
      latencyHistory: [...localMetricsRef.current],
      p50,
      p95,
      p99,
      totalInteractions: prev.totalInteractions + 1,
    }));
  }, []);

  // Fetch historical metrics from database
  const fetchHistoricalMetrics = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    
    try {
      // Fetch last 24h of performance metrics
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: metricsData } = await supabase
        .from('jarvis_performance_metrics')
        .select('id, metric_type, value, breakdown, date, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (metricsData && metricsData.length > 0) {
        // Calculate tool stats
        const toolMap = new Map<string, { latencies: number[]; successes: number; total: number }>();
        const hourMap = new Map<number, { count: number; totalLatency: number }>();
        
        metricsData.forEach(m => {
          const breakdown = (m.breakdown as Record<string, unknown>) || {};
          const toolName = (breakdown.tool_name as string) || m.metric_type || 'general';
          const successRate = (breakdown.success_rate as number) || 1;
          const latency = m.value || 0;
          
          // Tool stats
          if (!toolMap.has(toolName)) {
            toolMap.set(toolName, { latencies: [], successes: 0, total: 0 });
          }
          const toolData = toolMap.get(toolName)!;
          toolData.latencies.push(latency);
          toolData.total += 1;
          toolData.successes += successRate >= 0.5 ? 1 : 0;
          
          // Hourly usage
          const hour = new Date(m.created_at).getHours();
          if (!hourMap.has(hour)) {
            hourMap.set(hour, { count: 0, totalLatency: 0 });
          }
          const hourData = hourMap.get(hour)!;
          hourData.count += 1;
          hourData.totalLatency += latency;
        });
        
        // Convert to arrays
        const toolStats: ToolStats[] = Array.from(toolMap.entries())
          .map(([name, data]) => {
            const sorted = data.latencies.sort((a, b) => a - b);
            return {
              name,
              totalCalls: data.total,
              successCount: data.successes,
              successRate: data.total > 0 ? (data.successes / data.total) * 100 : 100,
              avgLatencyMs: sorted.reduce((a, b) => a + b, 0) / sorted.length,
              p95LatencyMs: sorted[Math.floor(sorted.length * 0.95)] || 0,
            };
          })
          .sort((a, b) => b.totalCalls - a.totalCalls)
          .slice(0, 10);
        
        const hourlyUsage: HourlyUsage[] = Array.from(hourMap.entries())
          .map(([hour, data]) => ({
            hour,
            count: data.count,
            avgLatency: data.count > 0 ? data.totalLatency / data.count : 0,
          }))
          .sort((a, b) => a.hour - b.hour);
        
        // Fill missing hours
        for (let h = 0; h < 24; h++) {
          if (!hourlyUsage.find(hu => hu.hour === h)) {
            hourlyUsage.push({ hour: h, count: 0, avgLatency: 0 });
          }
        }
        hourlyUsage.sort((a, b) => a.hour - b.hour);
        
        // Calculate overall metrics
        const allLatencies = metricsData.map(m => m.value || 0).sort((a, b) => a - b);
        const overallSuccessRate = toolStats.length > 0
          ? toolStats.reduce((sum, t) => sum + t.successRate, 0) / toolStats.length
          : 100;
        
        setMetrics(prev => ({
          ...prev,
          toolStats,
          hourlyUsage,
          p50: allLatencies[Math.floor(allLatencies.length * 0.5)] || prev.p50,
          p95: allLatencies[Math.floor(allLatencies.length * 0.95)] || prev.p95,
          p99: allLatencies[Math.floor(allLatencies.length * 0.99)] || prev.p99,
          overallSuccessRate,
          totalInteractions: metricsData.length,
        }));
      }
    } catch (error) {
      debug.error('[MetricsHistory] Error fetching metrics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Load historical data on mount
  useEffect(() => {
    fetchHistoricalMetrics();
  }, [fetchHistoricalMetrics]);

  return {
    ...metrics,
    isLoading,
    recordMetric,
    refresh: fetchHistoricalMetrics,
  };
}
