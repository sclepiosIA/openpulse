/**
 * JarvisPerformanceWidget - Real-time performance monitoring
 * 
 * Shows latency, health status, and self-tuning indicators.
 */

import { motion } from 'framer-motion';
import { Activity, Zap, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useJarvisPerformanceMetrics } from '@/hooks/jarvis/useJarvisPerformanceMetrics';

interface JarvisPerformanceWidgetProps {
  compact?: boolean;
  className?: string;
}

const HEALTH_CONFIG = {
  excellent: {
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    icon: CheckCircle2,
    label: 'Excellent',
  },
  good: {
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
    icon: TrendingUp,
    label: 'Bon',
  },
  degraded: {
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    icon: AlertTriangle,
    label: 'Dégradé',
  },
  critical: {
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    icon: AlertTriangle,
    label: 'Critique',
  },
};

export function JarvisPerformanceWidget({ compact = false, className }: JarvisPerformanceWidgetProps) {
  const { getAllMetrics, getOverallHealth, shouldReduceContext } = useJarvisPerformanceMetrics();

  const health = getOverallHealth();
  const healthConfig = HEALTH_CONFIG[health];
  const HealthIcon = healthConfig.icon;
  const allMetrics = getAllMetrics();
  
  // Calculate overall stats
  const metricsArray = Array.from(allMetrics.values());
  const totalCalls = metricsArray.reduce((sum, m) => sum + m.callCount, 0);
  const avgLatency = metricsArray.length > 0 
    ? Math.round(metricsArray.reduce((sum, m) => sum + m.avgLatency, 0) / metricsArray.length)
    : 0;
  const avgSuccessRate = metricsArray.length > 0
    ? Math.round((metricsArray.reduce((sum, m) => sum + m.successRate, 0) / metricsArray.length) * 100)
    : 100;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn("flex items-center gap-2", className)}
      >
        <div className={cn("p-1.5 rounded-lg", healthConfig.bgColor)}>
          <HealthIcon className={cn("h-3.5 w-3.5", healthConfig.color)} />
        </div>
        <span className="text-xs text-muted-foreground">
          {avgLatency > 0 ? `${avgLatency}ms` : '--'}
        </span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
          {avgSuccessRate}%
        </Badge>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("p-4 rounded-xl border bg-card space-y-4", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Performance Jarvis</span>
        </div>
        <Badge 
          variant="outline" 
          className={cn("text-[10px]", healthConfig.color, healthConfig.bgColor)}
        >
          <HealthIcon className="h-3 w-3 mr-1" />
          {healthConfig.label}
        </Badge>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">{avgLatency || '--'}ms</div>
          <div className="text-xs text-muted-foreground">Latence moy.</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">{avgSuccessRate}%</div>
          <div className="text-xs text-muted-foreground">Succès</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">{totalCalls}</div>
          <div className="text-xs text-muted-foreground">Appels</div>
        </div>
      </div>

      {/* Success Rate Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Taux de succès</span>
          <span className={avgSuccessRate >= 90 ? 'text-emerald-500' : 'text-amber-500'}>
            {avgSuccessRate}%
          </span>
        </div>
        <Progress 
          value={avgSuccessRate} 
          className="h-1.5"
        />
      </div>

      {/* Self-Tuning Indicator */}
      {shouldReduceContext() && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 text-warning"
        >
          <Zap className="h-3.5 w-3.5" />
          <span className="text-xs">Auto-optimisation: réduction du contexte activée</span>
        </motion.div>
      )}

      {/* Top Tools */}
      {metricsArray.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Outils les plus utilisés</div>
          <div className="space-y-1">
            {Array.from(allMetrics.entries())
              .sort((a, b) => b[1].callCount - a[1].callCount)
              .slice(0, 3)
              .map(([toolName, metrics]) => (
                <div 
                  key={toolName}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground truncate max-w-[120px]">
                    {toolName.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground">{Math.round(metrics.avgLatency)}ms</span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[9px] h-4 px-1",
                        metrics.successRate >= 0.9 ? 'text-primary' : 'text-warning'
                      )}
                    >
                      {Math.round(metrics.successRate * 100)}%
                    </Badge>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
