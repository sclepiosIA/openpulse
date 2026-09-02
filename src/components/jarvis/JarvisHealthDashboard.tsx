/**
 * JarvisHealthDashboard - Enhanced real-time health monitoring dashboard
 *
 * Displays:
 * - Overall system status
 * - Circuit breaker states
 * - Latency metrics (P50/P95/P99)
 * - Tool success rates
 * - Usage heatmap by hour
 * - Recommendations
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Activity,
  TrendingUp,
  BarChart3,
  Wrench,
} from 'lucide-react'
import { useJarvisCircuitState, type HealthStatus } from '@/hooks/jarvis/useJarvisCircuitState'
import { useJarvisMetricsHistory } from '@/hooks/jarvis/useJarvisMetricsHistory'

const statusConfig: Record<HealthStatus, { color: string; icon: React.ReactNode; label: string }> =
  {
    HEALTHY: {
      color: 'bg-green-500',
      icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      label: 'Excellent',
    },
    DEGRADED: {
      color: 'bg-yellow-500',
      icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
      label: 'Dégradé',
    },
    UNHEALTHY: {
      color: 'bg-orange-500',
      icon: <XCircle className="h-5 w-5 text-orange-500" />,
      label: 'Instable',
    },
    OFFLINE: {
      color: 'bg-red-500',
      icon: <XCircle className="h-5 w-5 text-red-500" />,
      label: 'Hors ligne',
    },
    UNKNOWN: {
      color: 'bg-gray-500',
      icon: <Clock className="h-5 w-5 text-muted-foreground" />,
      label: 'Inconnu',
    },
  }

const circuitStatusColors: Record<string, string> = {
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'HALF-OPEN': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  OPEN: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export function JarvisHealthDashboard() {
  const {
    status,
    lastChecked,
    isChecking,
    circuits,
    recommendations,
    responseTimeMs,
    degradationMode,
    forceCheck,
  } = useJarvisCircuitState()

  const {
    toolStats,
    hourlyUsage,
    p50,
    p95,
    p99,
    overallSuccessRate,
    totalInteractions,
    isLoading: metricsLoading,
    refresh: refreshMetrics,
  } = useJarvisMetricsHistory()

  const config = statusConfig[status]

  // Get max count for heatmap normalization
  const maxHourlyCount = Math.max(...hourlyUsage.map((h) => h.count), 1)

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              État du Système
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                forceCheck()
                refreshMetrics()
              }}
              disabled={isChecking || metricsLoading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${isChecking || metricsLoading ? 'animate-spin' : ''}`}
              />
              Rafraîchir
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-full ${config.color} flex items-center justify-center`}
            >
              <span className="text-white text-2xl font-bold">
                {status === 'HEALTHY' ? '✓' : status === 'OFFLINE' ? '✗' : '!'}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {config.icon}
                <span className="text-xl font-semibold">{config.label}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Mode: <Badge variant="outline">{degradationMode}</Badge>
              </p>
              {lastChecked && (
                <p className="text-xs text-muted-foreground mt-1">
                  Dernière vérification: {lastChecked.toLocaleTimeString('fr-FR')}
                  {responseTimeMs && ` (${responseTimeMs}ms)`}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">
            <TrendingUp className="h-4 w-4 mr-1" />
            Latence
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Wrench className="h-4 w-4 mr-1" />
            Outils
          </TabsTrigger>
          <TabsTrigger value="usage">
            <BarChart3 className="h-4 w-4 mr-1" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="circuits">
            <Zap className="h-4 w-4 mr-1" />
            Circuits
          </TabsTrigger>
        </TabsList>

        {/* Performance Tab - Latency Metrics */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Percentiles de Latence (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{Math.round(p50)}ms</div>
                  <div className="text-xs text-muted-foreground">P50 (médiane)</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{Math.round(p95)}ms</div>
                  <div className="text-xs text-muted-foreground">P95</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{Math.round(p99)}ms</div>
                  <div className="text-xs text-muted-foreground">P99</div>
                </div>
              </div>

              {/* Simple latency bars */}
              <div className="space-y-2">
                {[
                  { label: 'P50', value: p50, max: 5000, color: 'bg-green-500' },
                  { label: 'P95', value: p95, max: 5000, color: 'bg-yellow-500' },
                  { label: 'P99', value: p99, max: 5000, color: 'bg-red-500' },
                ].map(({ label, value, max, color }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{label}</span>
                      <span>{Math.round(value)}ms / 5000ms max</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} transition-all duration-300`}
                        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-muted-foreground">Taux de succès global</div>
                  <div className="text-3xl font-bold text-primary">
                    {overallSuccessRate.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Interactions (24h)</div>
                  <div className="text-3xl font-bold">{totalInteractions}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools Tab - Success Rates */}
        <TabsContent value="tools">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Top 10 Outils (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {toolStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune donnée disponible
                  </p>
                ) : (
                  toolStats.map((tool) => (
                    <div key={tool.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[150px]" title={tool.name}>
                          {tool.name.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              tool.successRate >= 90
                                ? 'default'
                                : tool.successRate >= 70
                                  ? 'secondary'
                                  : 'destructive'
                            }
                            className="text-xs"
                          >
                            {tool.successRate.toFixed(0)}%
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {tool.totalCalls} appels
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>Moy: {Math.round(tool.avgLatencyMs)}ms</span>
                        <span>•</span>
                        <span>P95: {Math.round(tool.p95LatencyMs)}ms</span>
                      </div>
                      <Progress value={tool.successRate} className="h-1.5" />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Tab - Heatmap */}
        <TabsContent value="usage">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Utilisation par Heure (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-12 gap-1">
                {hourlyUsage.slice(0, 24).map((hour) => {
                  const intensity = hour.count / maxHourlyCount
                  const bgColor =
                    hour.count === 0
                      ? 'bg-muted'
                      : intensity > 0.7
                        ? 'bg-primary'
                        : intensity > 0.3
                          ? 'bg-primary/60'
                          : 'bg-primary/30'

                  return (
                    <div
                      key={hour.hour}
                      className={`aspect-square rounded ${bgColor} flex items-center justify-center cursor-help transition-colors`}
                      title={`${hour.hour}h: ${hour.count} interactions, ${Math.round(hour.avgLatency)}ms moy.`}
                    >
                      {hour.count > 0 && (
                        <span className="text-[8px] text-white font-bold">{hour.count}</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>0h</span>
                <span>6h</span>
                <span>12h</span>
                <span>18h</span>
                <span>23h</span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-muted" />
                  <span>0</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-primary/30" />
                  <span>Faible</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-primary/60" />
                  <span>Moyen</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-primary" />
                  <span>Élevé</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Circuits Tab */}
        <TabsContent value="circuits">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Circuit Breakers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {circuits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun circuit actif</p>
                ) : (
                  circuits.map((circuit) => (
                    <div key={circuit.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{circuit.name}</span>
                        <Badge className={circuitStatusColors[circuit.status]}>
                          {circuit.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {circuit.latencyMs && <span>{circuit.latencyMs}ms</span>}
                        {circuit.lastError && (
                          <span
                            className="text-red-500 truncate max-w-[150px]"
                            title={circuit.lastError}
                          >
                            {circuit.lastError}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              Recommandations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendations.map((rec, index) => (
                <li
                  key={`reco-${index}-${typeof rec === 'string' ? rec.slice(0, 24) : index}`}
                  className="text-sm flex items-start gap-2"
                >
                  <span className="text-yellow-500 mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default JarvisHealthDashboard
