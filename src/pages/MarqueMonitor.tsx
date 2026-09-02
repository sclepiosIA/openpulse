import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ArrowLeft,
  Download,
  AlertCircle,
  Shield,
  Brain,
  Mail,
  Activity,
  Bug,
  Globe,
  Monitor,
  Repeat,
  BarChart3,
  Zap,
  RefreshCw,
  AlertTriangle,
  Database,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useMonitorLogs, type MonitorLogEntry } from '@/hooks/monitoring/useMonitorLogs'
import { getProcessingTypeLabel } from '@/hooks/ai/useAIUsageStats'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { cn } from '@/lib/utils'
import { useDbHealthStats } from '@/hooks/system/useDbHealthStats'
import { DatabaseTab } from './marque-monitor/DatabaseTab'
import { PatternsTab } from './marque-monitor/PatternsTab'
import { GlobalChart } from './marque-monitor/GlobalChart'
import { LogTablePanel } from './marque-monitor/LogTablePanel'
import { LogTable } from './marque-monitor/LogTable'
import { KpiCard } from './marque-monitor/KpiCard'
import { LogDetailDialog } from './marque-monitor/LogDetailDialog'
import { MonitorFilters } from './marque-monitor/MonitorFilters'
import { SOURCE_CONFIG, SEVERITY_CONFIG } from './marque-monitor/config'
import {
  AiSummary,
  ApiSummary,
  EmailSyncSummary,
  FeedbackSummary,
  FrontendSummary,
  HotspotsCard,
  SecuritySummary,
} from './marque-monitor/SummaryCards'
import { MonitorPerformancePanel } from '@/components/monitor/MonitorPerformancePanel'
import { AzureServicesHealthPanel } from '@/components/monitor/AzureServicesHealthPanel'

export default function MarqueMonitor() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const monitor = useMonitorLogs()
  const [selectedLog, setSelectedLog] = useState<MonitorLogEntry | null>(null)

  const { data: dbHealth, isLoading: dbHealthLoading } = useDbHealthStats()

  const handleExport = () => {
    const csv = [
      ['Date', 'Source', 'Sévérité', 'Type', 'Message', 'Utilisateur'],
      ...monitor.filteredLogs.map((log) => [
        `"${format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr })}"`,
        `"${SOURCE_CONFIG[log.source].label}"`,
        `"${SEVERITY_CONFIG[log.severity].label}"`,
        `"${(log.source === 'ai' ? getProcessingTypeLabel(log.type) : log.type).replace(/"/g, '""')}"`,
        `"${log.message.replace(/"/g, '""')}"`,
        `"${(log.userEmail || log.userId || 'N/A').replace(/"/g, '""')}"`,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `marque-monitor-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const displayedLogs = monitor.filteredLogs.slice(0, monitor.displayCount)
  const hasMoreLogs = monitor.filteredLogs.length > monitor.displayCount

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/parametres')} className="p-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1
              className={cn(
                'font-bold flex items-center gap-2',
                isMobile ? 'text-xl' : 'text-2xl lg:text-3xl'
              )}
            >
              <Activity className="h-6 w-6 text-primary" />
              OpenPulse Monitor
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-muted-foreground text-sm">
                Diagnostic centralisé — erreurs frontend, IA, API, email, sécurité
              </p>
              {monitor.lastUpdatedAt && (
                <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap">
                  Màj{' '}
                  {formatDistanceToNow(new Date(monitor.lastUpdatedAt), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button onClick={handleExport} size={isMobile ? 'sm' : 'default'} variant="outline">
          <Download className="w-4 h-4 mr-1.5" />
          {!isMobile && 'Export CSV'}
        </Button>
      </div>

      {/* Error banner */}
      {monitor.hasError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span>
              {monitor.errorInfos.length === 1
                ? `Source en erreur : ${monitor.errorInfos[0].source} — ${monitor.errorInfos[0].message}`
                : `${monitor.errorInfos.length} sources en erreur : ${monitor.errorInfos.map((e) => e.source).join(', ')}`}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={monitor.retryAll}
              className="shrink-0 w-fit"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div
        className={cn(
          'grid gap-3',
          isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-7'
        )}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <KpiCard
                  title="Erreurs 24h"
                  value={monitor.kpis.errors24h}
                  icon={AlertCircle}
                  color="text-red-600"
                  bgColor="bg-red-50"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                Erreurs critiques et erreurs des dernières 24h (indépendant du filtre période)
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <KpiCard
          title="Frontend"
          value={monitor.kpis.frontendErrors}
          icon={Monitor}
          color="text-violet-600"
          bgColor="bg-violet-50"
        />
        <KpiCard
          title="Taux IA"
          value={`${monitor.kpis.aiSuccessRate}%`}
          icon={Brain}
          color="text-fuchsia-600"
          bgColor="bg-fuchsia-50"
        />
        <KpiCard
          title="API KO"
          value={monitor.kpis.apiErrors}
          icon={Globe}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <KpiCard
          title="Syncs KO"
          value={monitor.kpis.syncErrors}
          icon={Mail}
          color="text-sky-600"
          bgColor="bg-sky-50"
        />
        <KpiCard
          title="Bugs"
          value={monitor.kpis.feedbackBugs}
          icon={Bug}
          color="text-rose-600"
          bgColor="bg-rose-50"
        />
        <KpiCard
          title="Sécu."
          value={monitor.kpis.securityAlerts}
          icon={Shield}
          color="text-amber-600"
          bgColor="bg-amber-50"
          className={isMobile ? 'col-span-2' : ''}
        />
      </div>

      {/* Filters */}
      <MonitorFilters
        searchTerm={monitor.searchTerm}
        onSearchChange={monitor.setSearchTerm}
        period={monitor.period}
        onPeriodChange={monitor.setPeriod}
        severityFilter={monitor.severityFilter}
        onSeverityChange={monitor.setSeverityFilter}
        userFilter={monitor.userFilter}
        onUserFilterChange={monitor.setUserFilter}
        sourceFilter={monitor.sourceFilter}
        onSourceFilterChange={monitor.setSourceFilter}
        activeTab={monitor.activeTab}
        uniqueUsers={monitor.uniqueUsers}
        isMobile={isMobile}
      />

      {/* Tabs — all TabsContent rendered natively, no conditional wrappers */}
      <Tabs value={monitor.activeTab} onValueChange={monitor.setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="global" className="gap-1">
            <BarChart3 className="h-3.5 w-3.5" />
            Global
          </TabsTrigger>
          <TabsTrigger value="patterns" className="gap-1">
            <Repeat className="h-3.5 w-3.5" />
            Patterns
          </TabsTrigger>
          <TabsTrigger value="hotspots" className="gap-1">
            <Repeat className="h-3.5 w-3.5" />
            Hotspots
          </TabsTrigger>
          <TabsTrigger value="frontend" className="gap-1">
            <Monitor className="h-3.5 w-3.5" />
            Frontend
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1">
            <Brain className="h-3.5 w-3.5" />
            IA
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-1">
            <Globe className="h-3.5 w-3.5" />
            API
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1">
            <Mail className="h-3.5 w-3.5" />
            Email
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-1">
            <Bug className="h-3.5 w-3.5" />
            Bugs
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1">
            <Shield className="h-3.5 w-3.5" />
            Sécu.
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-1">
            <Database className="h-3.5 w-3.5" />
            Base
          </TabsTrigger>
          <TabsTrigger value="perf" className="gap-1">
            <Zap className="h-3.5 w-3.5" />
            Perf
          </TabsTrigger>
        </TabsList>

        {/* Performance tab */}
        <TabsContent value="perf" className="mt-4 space-y-4">
          <AzureServicesHealthPanel />
          <MonitorPerformancePanel />
        </TabsContent>

        {/* Patterns tab */}
        <TabsContent value="patterns" className="mt-4 space-y-4">
          <PatternsTab recurringPatterns={monitor.recurringPatterns} />
        </TabsContent>

        {/* Global tab */}
        <TabsContent value="global" className="mt-4 space-y-4">
          <GlobalChart period={monitor.period} chartData={monitor.chartData} />
          <LogTable
            logs={displayedLogs}
            isLoading={monitor.isLoading}
            totalCount={monitor.filteredLogs.length}
            hasMore={hasMoreLogs}
            onLoadMore={monitor.loadMore}
            onSelect={setSelectedLog}
            isMobile={isMobile}
          />
        </TabsContent>

        {/* Frontend tab */}
        <TabsContent value="frontend" className="mt-4 space-y-4">
          <LogTablePanel
            summary={<FrontendSummary errors={monitor.frontendErrors} />}
            logs={displayedLogs}
            isLoading={monitor.isLoading}
            totalCount={monitor.filteredLogs.length}
            hasMore={hasMoreLogs}
            onLoadMore={monitor.loadMore}
            onSelect={setSelectedLog}
            isMobile={isMobile}
            LogTable={LogTable}
          />
        </TabsContent>

        {/* Hotspots tab — frontend errors groupés par (message, route) */}
        <TabsContent value="hotspots" className="mt-4 space-y-4">
          <HotspotsCard errors={monitor.frontendErrors} />
        </TabsContent>

        {/* AI tab */}
        <TabsContent value="ai" className="mt-4 space-y-4">
          <LogTablePanel
            summary={<AiSummary errors={monitor.aiErrors} />}
            logs={displayedLogs}
            isLoading={monitor.isLoading}
            totalCount={monitor.filteredLogs.length}
            hasMore={hasMoreLogs}
            onLoadMore={monitor.loadMore}
            onSelect={setSelectedLog}
            isMobile={isMobile}
            LogTable={LogTable}
          />
        </TabsContent>

        {/* API tab */}
        <TabsContent value="api" className="mt-4 space-y-4">
          <LogTablePanel
            summary={<ApiSummary errors={monitor.apiErrors} />}
            logs={displayedLogs}
            isLoading={monitor.isLoading}
            totalCount={monitor.filteredLogs.length}
            hasMore={hasMoreLogs}
            onLoadMore={monitor.loadMore}
            onSelect={setSelectedLog}
            isMobile={isMobile}
            LogTable={LogTable}
          />
        </TabsContent>

        {/* Email tab */}
        <TabsContent value="email" className="mt-4 space-y-4">
          <LogTablePanel
            summary={<EmailSyncSummary errors={monitor.emailSyncErrors} />}
            logs={displayedLogs}
            isLoading={monitor.isLoading}
            totalCount={monitor.filteredLogs.length}
            hasMore={hasMoreLogs}
            onLoadMore={monitor.loadMore}
            onSelect={setSelectedLog}
            isMobile={isMobile}
            LogTable={LogTable}
          />
        </TabsContent>

        {/* Feedback tab */}
        <TabsContent value="feedback" className="mt-4 space-y-4">
          <LogTablePanel
            summary={<FeedbackSummary feedbacks={monitor.feedbacks} />}
            logs={displayedLogs}
            isLoading={monitor.isLoading}
            totalCount={monitor.filteredLogs.length}
            hasMore={hasMoreLogs}
            onLoadMore={monitor.loadMore}
            onSelect={setSelectedLog}
            isMobile={isMobile}
            LogTable={LogTable}
          />
        </TabsContent>

        {/* Security tab */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <LogTablePanel
            summary={<SecuritySummary logs={monitor.securityLogs} />}
            logs={displayedLogs}
            isLoading={monitor.isLoading}
            totalCount={monitor.filteredLogs.length}
            hasMore={hasMoreLogs}
            onLoadMore={monitor.loadMore}
            onSelect={setSelectedLog}
            isMobile={isMobile}
            LogTable={LogTable}
          />
        </TabsContent>

        {/* Database health tab */}
        <TabsContent value="database" className="mt-4 space-y-4">
          <DatabaseTab dbHealth={dbHealth} dbHealthLoading={dbHealthLoading} />
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <LogDetailDialog log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  )
}
