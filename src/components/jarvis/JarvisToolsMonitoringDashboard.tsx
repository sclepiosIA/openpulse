import { safeNum } from '@/lib/formatters'
/**
 * JarvisToolsMonitoringDashboard - Dashboard complet de monitoring des outils Jarvis
 *
 * Affiche latence, taux de succès, coûts par outil avec graphiques interactifs
 */

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Timer,
  CheckCircle2,
  XCircle,
  DollarSign,
  TrendingUp,
  Zap,
  AlertTriangle,
  BarChart3,
  Cpu,
  Filter,
  RefreshCw,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  useJarvisToolsMonitoring,
  formatLatency,
  formatCost,
  getHealthStatus,
} from '@/hooks/jarvis/useJarvisToolsMonitoring'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { KPICard, ToolDetailRow, HEALTH_COLORS, CHART_COLORS } from './JarvisToolsMonitoringParts'

export function JarvisToolsMonitoringDashboard() {
  const [period, setPeriod] = useState('30')
  const [activeTab, setActiveTab] = useState('overview')
  const [expandedTool, setExpandedTool] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'calls' | 'latency' | 'success' | 'cost'>('calls')

  const { data, isLoading, refetch, isRefetching } = useJarvisToolsMonitoring(parseInt(period))

  const sortedTools = useMemo(() => {
    if (!data?.tools) return []
    return [...data.tools].sort((a, b) => {
      switch (sortBy) {
        case 'calls':
          return b.callCount - a.callCount
        case 'latency':
          return b.avgLatencyMs - a.avgLatencyMs
        case 'success':
          return a.successRate - b.successRate
        case 'cost':
          return b.estimatedCost - a.estimatedCost
        default:
          return 0
      }
    })
  }, [data?.tools, sortBy])

  const dailyAggregated = useMemo(() => {
    if (!data?.dailyMetrics) return []
    const byDate = new Map<
      string,
      { date: string; calls: number; avgLatency: number; successRate: number; tokens: number }
    >()

    data.dailyMetrics.forEach((m) => {
      const existing = byDate.get(m.date) || {
        date: m.date,
        calls: 0,
        avgLatency: 0,
        successRate: 0,
        tokens: 0,
      }
      existing.calls += m.calls
      existing.tokens += m.tokens
      byDate.set(m.date, existing)
    })

    // Calculate averages
    byDate.forEach((value, key) => {
      const dayMetrics = data.dailyMetrics.filter((m) => m.date === key)
      if (dayMetrics.length > 0) {
        value.avgLatency =
          dayMetrics.reduce((sum, m) => sum + m.avgLatency * m.calls, 0) / value.calls
        value.successRate =
          dayMetrics.reduce((sum, m) => sum + m.successRate * m.calls, 0) / value.calls
      }
    })

    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [data?.dailyMetrics])

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={`jarvis-tools-skeleton-${i}`} className="h-24 bg-muted/50 rounded-xl" />
            ))}
          </div>
          <div className="h-80 bg-muted/50 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!data) return null

  const overallHealth = getHealthStatus(data.totals.overallSuccessRate, data.totals.avgLatency)

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-primary/15 to-primary/5 rounded-xl ring-1 ring-primary/20">
              <Cpu className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Monitoring Outils Jarvis</h3>
              <p className="text-xs text-muted-foreground">
                Performance temps réel des {data.tools.length} outils actifs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 jours</SelectItem>
                <SelectItem value="14">14 jours</SelectItem>
                <SelectItem value="30">30 jours</SelectItem>
                <SelectItem value="90">90 jours</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="Appels totaux"
            value={safeNum(data.totals.totalCalls).toLocaleString()}
            subtitle={`${data.tools.length} outils`}
            icon={<Zap className="h-4 w-4 text-amber-500" />}
            colorClass="from-amber-500/10 to-amber-500/5"
          />
          <KPICard
            title="Taux de succès"
            value={`${safeNum(data.totals.overallSuccessRate).toFixed(1)}%`}
            subtitle={`${safeNum(data.totals.totalSuccess).toLocaleString()} succès`}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            colorClass="from-emerald-500/10 to-emerald-500/5"
          />
          <KPICard
            title="Latence moyenne"
            value={formatLatency(data.totals.avgLatency)}
            subtitle={`P90: ${formatLatency(data.totals.p90Latency)}`}
            icon={<Timer className="h-4 w-4 text-sky-500" />}
            colorClass="from-sky-500/10 to-sky-500/5"
          />
          <KPICard
            title="Coût estimé"
            value={formatCost(data.totals.estimatedCost)}
            subtitle={`${(data.totals.totalTokens / 1000).toFixed(0)}K tokens`}
            icon={<DollarSign className="h-4 w-4 text-violet-500" />}
            colorClass="from-violet-500/10 to-violet-500/5"
          />
        </div>

        {/* Health Status Banner */}
        <Card
          className={cn(
            'border',
            HEALTH_COLORS[overallHealth].border,
            HEALTH_COLORS[overallHealth].bg
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', HEALTH_COLORS[overallHealth].bg)}>
                <Activity className={cn('h-5 w-5', HEALTH_COLORS[overallHealth].text)} />
              </div>
              <div>
                <p className="font-medium">État global du système</p>
                <p className="text-sm text-muted-foreground">
                  {overallHealth === 'excellent' && 'Tous les outils fonctionnent parfaitement'}
                  {overallHealth === 'good' && 'Performance globale satisfaisante'}
                  {overallHealth === 'degraded' &&
                    'Quelques outils présentent des latences élevées'}
                  {overallHealth === 'critical' &&
                    'Attention : plusieurs outils rencontrent des problèmes'}
                </p>
              </div>
            </div>
            <Badge
              className={cn(
                HEALTH_COLORS[overallHealth].bg,
                HEALTH_COLORS[overallHealth].text,
                'border-0'
              )}
            >
              {overallHealth === 'excellent' && 'Excellent'}
              {overallHealth === 'good' && 'Bon'}
              {overallHealth === 'degraded' && 'Dégradé'}
              {overallHealth === 'critical' && 'Critique'}
            </Badge>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="gap-2 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="latency" className="gap-2 text-xs">
              <Timer className="h-3.5 w-3.5" />
              Latences
            </TabsTrigger>
            <TabsTrigger value="costs" className="gap-2 text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              Coûts
            </TabsTrigger>
            <TabsTrigger value="errors" className="gap-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              Erreurs
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Daily Trend Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Évolution quotidienne
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyAggregated}>
                      <defs>
                        <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date) => format(new Date(date), 'dd/MM')}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number, name: string) => [
                          name === 'calls'
                            ? value.toLocaleString()
                            : name === 'avgLatency'
                              ? formatLatency(value)
                              : `${value.toFixed(1)}%`,
                          name === 'calls'
                            ? 'Appels'
                            : name === 'avgLatency'
                              ? 'Latence moy.'
                              : 'Taux de succès',
                        ]}
                        labelFormatter={(date) =>
                          format(new Date(date), 'EEEE d MMMM', { locale: fr })
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="calls"
                        stroke="hsl(var(--primary))"
                        fill="url(#colorCalls)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Tools Table */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    Performance par outil
                  </CardTitle>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <Filter className="h-3 w-3 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calls">Par appels</SelectItem>
                      <SelectItem value="latency">Par latence</SelectItem>
                      <SelectItem value="success">Par erreurs</SelectItem>
                      <SelectItem value="cost">Par coût</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Outil</TableHead>
                      <TableHead className="text-right">Appels</TableHead>
                      <TableHead className="text-right">Succès</TableHead>
                      <TableHead className="text-right">Latence moy.</TableHead>
                      <TableHead className="text-right">P90</TableHead>
                      <TableHead className="text-right">Coût</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTools.slice(0, 15).map((tool) => (
                      <ToolDetailRow
                        key={tool.toolName}
                        tool={tool}
                        isExpanded={expandedTool === tool.toolName}
                        onToggle={() =>
                          setExpandedTool(expandedTool === tool.toolName ? null : tool.toolName)
                        }
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Latency Tab */}
          <TabsContent value="latency" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Latency Distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Distribution des latences</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.latencyDistribution}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="bucket" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                          {data.latencyDistribution.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                index < 2
                                  ? 'hsl(142, 76%, 36%)'
                                  : index < 4
                                    ? 'hsl(199, 89%, 48%)'
                                    : index < 5
                                      ? 'hsl(43, 96%, 56%)'
                                      : 'hsl(0, 84%, 60%)'
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Top Latency Tools */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Outils les plus lents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sortedTools
                    .sort((a, b) => b.p90LatencyMs - a.p90LatencyMs)
                    .slice(0, 5)
                    .map((tool, index) => (
                      <motion.div
                        key={tool.toolName}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
                          <span className="text-sm font-medium truncate max-w-[150px]">
                            {tool.displayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs font-mono">
                            P90: {formatLatency(tool.p90LatencyMs)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              tool.trend.latencyChange <= 0 ? 'text-emerald-600' : 'text-red-600'
                            )}
                          >
                            {tool.trend.latencyChange > 0 ? '+' : ''}
                            {safeNum(tool.trend.latencyChange).toFixed(0)}%
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                </CardContent>
              </Card>
            </div>

            {/* Latency by Tool */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Comparaison des latences par outil</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={sortedTools.slice(0, 10)}
                      layout="vertical"
                      margin={{ left: 120 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis
                        type="number"
                        className="text-xs"
                        tickFormatter={(v) => formatLatency(v)}
                      />
                      <YAxis
                        dataKey="displayName"
                        type="category"
                        className="text-xs"
                        width={110}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => formatLatency(value)}
                      />
                      <Legend />
                      <Bar
                        dataKey="avgLatencyMs"
                        name="Moyenne"
                        fill="hsl(var(--primary))"
                        radius={[0, 4, 4, 0]}
                      />
                      <Bar
                        dataKey="p90LatencyMs"
                        name="P90"
                        fill="hsl(43, 96%, 56%)"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Costs Tab */}
          <TabsContent value="costs" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Cost by Tool Pie */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Répartition des coûts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sortedTools.slice(0, 6).map((t) => ({
                            name: t.displayName,
                            value: t.estimatedCost,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {sortedTools.slice(0, 6).map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatCost(value)}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          formatter={(value) => <span className="text-xs">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Breakdown */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top 5 outils par coût</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sortedTools
                    .sort((a, b) => b.estimatedCost - a.estimatedCost)
                    .slice(0, 5)
                    .map((tool, index) => {
                      const percentage = (tool.estimatedCost / data.totals.estimatedCost) * 100
                      return (
                        <motion.div
                          key={tool.toolName}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate max-w-[180px]">
                              {tool.displayName}
                            </span>
                            <span className="text-sm font-mono">
                              {formatCost(tool.estimatedCost)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={percentage} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground w-12 text-right">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        </motion.div>
                      )
                    })}
                </CardContent>
              </Card>
            </div>

            {/* Cost Efficiency */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Efficacité coût/appel</CardTitle>
                <CardDescription>Coût moyen par appel pour chaque outil</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={sortedTools
                        .map((t) => ({
                          name: t.displayName,
                          costPerCall: t.callCount > 0 ? t.estimatedCost / t.callCount : 0,
                          calls: t.callCount,
                        }))
                        .sort((a, b) => b.costPerCall - a.costPerCall)
                        .slice(0, 10)}
                      layout="vertical"
                      margin={{ left: 120 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis
                        type="number"
                        className="text-xs"
                        tickFormatter={(v) => `$${v.toFixed(4)}`}
                      />
                      <YAxis dataKey="name" type="category" className="text-xs" width={110} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number, name: string) => [
                          name === 'costPerCall' ? `$${value.toFixed(4)}` : value.toLocaleString(),
                          name === 'costPerCall' ? 'Coût/appel' : 'Appels',
                        ]}
                      />
                      <Bar dataKey="costPerCall" fill="hsl(262, 83%, 58%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Error Rate by Tool */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Outils avec erreurs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.topErrorTools.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                      <p className="text-sm font-medium">Aucune erreur</p>
                      <p className="text-xs text-muted-foreground">
                        Tous les outils fonctionnent correctement
                      </p>
                    </div>
                  ) : (
                    data.topErrorTools.map((tool, index) => (
                      <motion.div
                        key={tool.toolName}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/10"
                      >
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium">{tool.toolName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">
                            {tool.errorCount} erreurs
                          </Badge>
                          <Badge variant="outline" className="text-xs text-red-600">
                            {tool.errorRate.toFixed(1)}%
                          </Badge>
                        </div>
                      </motion.div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Success Rate Distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Distribution des taux de succès</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: '≥98% (Excellent)', min: 98, color: 'bg-emerald-500' },
                      { label: '95-98% (Bon)', min: 95, max: 98, color: 'bg-sky-500' },
                      { label: '90-95% (Dégradé)', min: 90, max: 95, color: 'bg-amber-500' },
                      { label: '<90% (Critique)', max: 90, color: 'bg-red-500' },
                    ].map((bucket) => {
                      const count = sortedTools.filter(
                        (t) =>
                          (bucket.min === undefined || t.successRate >= bucket.min) &&
                          (bucket.max === undefined || t.successRate < bucket.max)
                      ).length
                      const percentage = (count / sortedTools.length) * 100

                      return (
                        <div key={bucket.label} className="flex items-center gap-3">
                          <div className={cn('w-3 h-3 rounded-full', bucket.color)} />
                          <span className="text-sm flex-1">{bucket.label}</span>
                          <span className="text-sm font-medium">{count} outils</span>
                          <Progress value={percentage} className="w-20 h-1.5" />
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Errors */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Erreurs récentes</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentErrors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                    <p className="text-sm font-medium">Aucune erreur récente</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.recentErrors.map((error, index) => (
                      <motion.div
                        key={`jarvis-tools-error-${error.toolName}-${error.timestamp}-${index}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className="p-3 rounded-lg bg-muted/30 border border-border/50"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-xs">
                            {error.toolName}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(error.timestamp), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-red-600 truncate" title={error.errorMessage}>
                          {error.errorMessage}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  )
}
