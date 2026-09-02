import { safeNum } from '@/lib/formatters'
/**
 * JarvisToolsMonitoringParts - Sous-composants présentationnels du dashboard
 * (extraits de JarvisToolsMonitoringDashboard.tsx pour respecter le budget < 800 L)
 */

import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
  formatLatency,
  formatCost,
  getHealthStatus,
  ToolMetrics,
} from '@/hooks/jarvis/useJarvisToolsMonitoring'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export const HEALTH_COLORS = {
  excellent: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
  good: { bg: 'bg-sky-500/10', text: 'text-sky-500', border: 'border-sky-500/20' },
  degraded: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  critical: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
}

export const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(199, 89%, 48%)',
  'hsl(262, 83%, 58%)',
  'hsl(24, 95%, 53%)',
  'hsl(346, 77%, 49%)',
]

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: number
  trendLabel?: string
  colorClass?: string
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendLabel,
  colorClass = 'from-primary/10 to-primary/5',
}: KPICardProps) {
  return (
    <Card className={cn('relative overflow-hidden bg-gradient-to-br border-border/50', colorClass)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="p-2.5 bg-background/80 rounded-xl ring-1 ring-border/50 shadow-sm">
            {icon}
          </div>
        </div>
        {trend !== undefined && (
          <div
            className={cn(
              'absolute bottom-2 right-2 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg',
              trend >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
            )}
          >
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
            {trendLabel && <span className="text-muted-foreground ml-1">{trendLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ToolDetailRow({
  tool,
  isExpanded,
  onToggle,
}: {
  tool: ToolMetrics
  isExpanded: boolean
  onToggle: () => void
}) {
  const health = getHealthStatus(tool.successRate, tool.avgLatencyMs)
  const healthColors = HEALTH_COLORS[health]

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors">
          <TableCell className="font-medium">
            <div className="flex items-center gap-2">
              <div
                className={cn('w-2 h-2 rounded-full', healthColors.bg, healthColors.text)}
                style={{
                  backgroundColor:
                    health === 'excellent'
                      ? '#10b981'
                      : health === 'good'
                        ? '#0ea5e9'
                        : health === 'degraded'
                          ? '#f59e0b'
                          : '#ef4444',
                }}
              />
              {tool.displayName}
            </div>
          </TableCell>
          <TableCell className="text-right">
            <Badge variant="outline" className="font-mono">
              {tool.callCount.toLocaleString()}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <Badge
              variant="outline"
              className={cn(
                'font-mono',
                tool.successRate >= 98
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : tool.successRate >= 95
                    ? 'bg-sky-500/10 text-sky-600'
                    : tool.successRate >= 90
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-red-500/10 text-red-600'
              )}
            >
              {tool.successRate.toFixed(1)}%
            </Badge>
          </TableCell>
          <TableCell className="text-right font-mono text-sm">
            {formatLatency(tool.avgLatencyMs)}
          </TableCell>
          <TableCell className="text-right font-mono text-sm">
            {formatLatency(tool.p90LatencyMs)}
          </TableCell>
          <TableCell className="text-right font-mono text-sm text-muted-foreground">
            {formatCost(tool.estimatedCost)}
          </TableCell>
          <TableCell className="w-8">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <TableRow className="bg-muted/30">
          <TableCell colSpan={7} className="p-4">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Latences détaillées</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">
                    P50: {formatLatency(tool.p50LatencyMs)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    P90: {formatLatency(tool.p90LatencyMs)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    P99: {formatLatency(tool.p99LatencyMs)}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Tokens</p>
                <p className="font-medium">{tool.totalTokens.toLocaleString()} total</p>
                <p className="text-xs text-muted-foreground">
                  ~{Math.round(tool.avgTokensPerCall)} / appel
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Tendances (vs période précédente)</p>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      tool.trend.latencyChange <= 0 ? 'text-emerald-600' : 'text-red-600'
                    )}
                  >
                    Latence: {tool.trend.latencyChange > 0 ? '+' : ''}
                    {safeNum(tool.trend.latencyChange).toFixed(1)}%
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      tool.trend.successRateChange >= 0 ? 'text-emerald-600' : 'text-red-600'
                    )}
                  >
                    Succès: {tool.trend.successRateChange > 0 ? '+' : ''}
                    {safeNum(tool.trend.successRateChange).toFixed(1)}%
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Dernière utilisation</p>
                <p className="font-medium">
                  {tool.lastUsed
                    ? formatDistanceToNow(new Date(tool.lastUsed), { addSuffix: true, locale: fr })
                    : 'N/A'}
                </p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  )
}
