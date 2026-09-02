import { fetchAiProcessingErrors, fetchEmailSyncErrors } from '@/services/admin/systemLogs'
import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Search,
  Download,
  AlertTriangle,
  Info,
  CheckCircle,
  Shield,
  Brain,
  Mail,
  Monitor,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSecurityLogs } from '@/hooks/system/useSystemManagement'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { cn } from '@/lib/utils'
import { consoleCapture, type LogEntry } from '@/lib/consoleCapture'
import { PageDataState } from '@/components/common/PageDataState'

interface UnifiedLog {
  id: string
  timestamp: string
  source: 'security' | 'edge_function' | 'email_sync' | 'client'
  type: string
  message: string
  severity: 'high' | 'medium' | 'low' | 'info'
  user?: string
  metadata?: Record<string, unknown>
}

export default function LogsSysteme() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRisk, setFilterRisk] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('all')
  const [selectedLog, setSelectedLog] = useState<UnifiedLog | null>(null)
  const [periodDays, setPeriodDays] = useState(7)

  const sinceDate = useMemo(() => subDays(new Date(), periodDays).toISOString(), [periodDays])

  // Security logs
  const {
    data: securityLogs,
    isLoading: secLoading,
    isError: secError,
    refetch: refetchSec,
  } = useSecurityLogs()

  // Edge function errors (ai_processing_log)
  const {
    data: edgeLogs,
    isLoading: edgeLoading,
    isError: edgeError,
    refetch: refetchEdge,
  } = useQuery({
    queryKey: ['logs-systeme-edge', periodDays],
    queryFn: () => fetchAiProcessingErrors(sinceDate),
    staleTime: 2 * 60 * 1000,
  })

  // Email sync errors
  const {
    data: emailLogs,
    isLoading: emailLoading,
    isError: emailError,
    refetch: refetchEmail,
  } = useQuery({
    queryKey: ['logs-systeme-email-sync', periodDays],
    queryFn: () => fetchEmailSyncErrors(sinceDate),
    staleTime: 2 * 60 * 1000,
  })

  // Client console errors (from consoleCapture in memory)
  const clientLogs = useMemo<LogEntry[]>(() => consoleCapture.getErrorLogs(), [])

  // Unify all logs
  const allLogs = useMemo<UnifiedLog[]>(() => {
    const unified: UnifiedLog[] = []

    // Security
    for (const s of securityLogs || []) {
      unified.push({
        id: `sec-${s.id}`,
        timestamp: s.created_at,
        source: 'security',
        type: s.log_type,
        message: s.log_type,
        severity: s.risk_level === 'high' ? 'high' : s.risk_level === 'medium' ? 'medium' : 'low',
        user: s.user_email || undefined,
        metadata: { ip_address: s.ip_address, metadata: s.metadata },
      })
    }

    // Edge functions
    for (const e of edgeLogs || []) {
      unified.push({
        id: `edge-${e.id}`,
        timestamp: e.processed_at,
        source: 'edge_function',
        type: e.processing_type ?? 'unknown',
        message: e.error_message || 'Erreur Edge Function',
        severity: e.processing_duration_ms && e.processing_duration_ms > 80000 ? 'high' : 'medium',
        metadata: {
          duration_ms: e.processing_duration_ms,
          model: e.model_used,
          context_type: e.context_type,
        },
      })
    }

    // Email sync
    for (const em of emailLogs || []) {
      unified.push({
        id: `email-${em.id}`,
        timestamp: em.execution_start || em.execution_end || new Date().toISOString(),
        source: 'email_sync',
        type: 'sync_error',
        message:
          typeof em.error_details === 'string'
            ? em.error_details
            : em.error_details
              ? JSON.stringify(em.error_details)
              : 'Erreur de synchronisation email',
        severity: 'medium',
        metadata: { emails_fetched: em.emails_fetched, error_details: em.error_details },
      })
    }

    // Client console errors
    for (let i = 0; i < clientLogs.length; i++) {
      const c = clientLogs[i]
      unified.push({
        id: `client-${i}-${c.timestamp}`,
        timestamp: new Date(c.timestamp).toISOString(),
        source: 'client',
        type: c.level,
        message: c.args.join(' ').slice(0, 500),
        severity: c.level === 'error' ? 'high' : 'medium',
      })
    }

    unified.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return unified
  }, [securityLogs, edgeLogs, emailLogs, clientLogs])

  // Filter
  const filteredLogs = useMemo(() => {
    let result = allLogs

    if (activeTab !== 'all') {
      result = result.filter((l) => l.source === activeTab)
    }

    if (filterRisk !== 'all') {
      result = result.filter((l) => l.severity === filterRisk)
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(
        (l) =>
          l.message.toLowerCase().includes(lower) ||
          l.type.toLowerCase().includes(lower) ||
          l.user?.toLowerCase().includes(lower)
      )
    }

    return result
  }, [allLogs, activeTab, filterRisk, searchTerm])

  const isLoading = secLoading || edgeLoading || emailLoading
  const isError = secError || edgeError || emailError
  // P1 : n'afficher l'erreur pleine page que si TOUTES les sources échouent.
  // Si une seule source échoue (ex. RLS selon le rôle), on garde les logs des
  // autres sources (ou l'état vide) avec un bandeau d'erreur partielle.
  const isFullError = secError && edgeError && emailError
  const isPartialError = isError && !isFullError
  const handleRetry = () => {
    refetchSec()
    refetchEdge()
    refetchEmail()
  }

  const sourceConfig = {
    security: {
      label: 'Sécurité',
      icon: Shield,
      color: 'bg-amber-100 text-amber-700 border-amber-200',
    },
    edge_function: {
      label: 'Edge Fn',
      icon: Brain,
      color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    },
    email_sync: { label: 'Email', icon: Mail, color: 'bg-sky-100 text-sky-700 border-sky-200' },
    client: {
      label: 'Client',
      icon: Monitor,
      color: 'bg-violet-100 text-violet-700 border-violet-200',
    },
  }

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-destructive" />
      case 'medium':
        return <Info className="w-4 h-4 text-orange-500" />
      default:
        return <CheckCircle className="w-4 h-4 text-green-500" />
    }
  }

  const handleExport = () => {
    const csv = [
      ['Date', 'Source', 'Type', 'Message', 'Sévérité', 'Utilisateur'],
      ...filteredLogs.map((log) => [
        format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr }),
        sourceConfig[log.source].label,
        log.type,
        `"${log.message.replace(/"/g, '""')}"`,
        log.severity,
        log.user || 'N/A',
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-systeme-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Counts per tab
  const counts = useMemo(
    () => ({
      all: allLogs.length,
      security: allLogs.filter((l) => l.source === 'security').length,
      edge_function: allLogs.filter((l) => l.source === 'edge_function').length,
      email_sync: allLogs.filter((l) => l.source === 'email_sync').length,
      client: allLogs.filter((l) => l.source === 'client').length,
    }),
    [allLogs]
  )

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/parametres')} className="p-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className={cn('font-bold', isMobile ? 'text-xl' : 'text-2xl lg:text-3xl')}>
              Logs système
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Sécurité, Edge Functions, synchronisation email, erreurs client
            </p>
          </div>
        </div>
        <Button onClick={handleExport} size={isMobile ? 'sm' : 'default'} variant="outline">
          <Download className="w-4 h-4 mr-1.5" />
          {!isMobile && 'Exporter CSV'}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className={cn('flex gap-2 flex-wrap', isMobile && 'flex-col')}>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher message, type, utilisateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">24 heures</SelectItem>
                <SelectItem value="7">7 jours</SelectItem>
                <SelectItem value="30">30 jours</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes sévérités</SelectItem>
                <SelectItem value="high">Élevé</SelectItem>
                <SelectItem value="medium">Moyen</SelectItem>
                <SelectItem value="low">Faible</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs + Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="all" className="gap-1">
            Tous{' '}
            <Badge variant="secondary" className="text-[10px] ml-1 px-1.5">
              {counts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1">
            <Shield className="h-3.5 w-3.5" />
            Sécurité{' '}
            <Badge variant="secondary" className="text-[10px] ml-1 px-1.5">
              {counts.security}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="edge_function" className="gap-1">
            <Brain className="h-3.5 w-3.5" />
            Edge Fn{' '}
            <Badge variant="secondary" className="text-[10px] ml-1 px-1.5">
              {counts.edge_function}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="email_sync" className="gap-1">
            <Mail className="h-3.5 w-3.5" />
            Email{' '}
            <Badge variant="secondary" className="text-[10px] ml-1 px-1.5">
              {counts.email_sync}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="client" className="gap-1">
            <Monitor className="h-3.5 w-3.5" />
            Client{' '}
            <Badge variant="secondary" className="text-[10px] ml-1 px-1.5">
              {counts.client}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Événements ({filteredLogs.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!isLoading && isPartialError && (
                <div
                  role="alert"
                  className="m-4 flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="min-w-[200px] flex-1">
                    Certaines sources de logs sont indisponibles (accès restreint ou erreur).
                    Résultats partiels.
                  </span>
                  <Button variant="outline" size="sm" onClick={handleRetry}>
                    Réessayer
                  </Button>
                </div>
              )}
              {isLoading || isFullError ? (
                <div className="p-4">
                  <PageDataState isLoading={isLoading} isError={isFullError} onRetry={handleRetry}>
                    <></>
                  </PageDataState>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Aucun log à afficher</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[130px]">Date</TableHead>
                        <TableHead className="w-[90px]">Source</TableHead>
                        <TableHead className="w-[80px]">Sévérité</TableHead>
                        <TableHead className="w-[120px]">Type</TableHead>
                        <TableHead>Message</TableHead>
                        {!isMobile && <TableHead className="w-[140px]">Utilisateur</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.slice(0, 200).map((log) => {
                        const src = sourceConfig[log.source]
                        return (
                          <TableRow
                            key={log.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedLog(log)}
                          >
                            <TableCell className="text-xs font-mono whitespace-nowrap">
                              {format(new Date(log.timestamp), 'dd/MM HH:mm', { locale: fr })}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn('text-[10px] gap-1', src.color)}
                              >
                                <src.icon className="h-3 w-3" />
                                {src.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {getRiskIcon(log.severity)}
                                <span className="text-xs">{log.severity}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{log.type}</TableCell>
                            <TableCell className="text-xs max-w-[300px] truncate">
                              {log.message}
                            </TableCell>
                            {!isMobile && (
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">
                                {log.user || '—'}
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base flex-wrap">
              {selectedLog && (
                <>
                  <Badge variant="outline" className={sourceConfig[selectedLog.source].color}>
                    {sourceConfig[selectedLog.source].label}
                  </Badge>
                  <span className="text-muted-foreground text-sm ml-auto">
                    {format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                  </span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3 pr-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Type</p>
                  <p className="text-sm">{selectedLog.type}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Message</p>
                  <pre className="text-xs whitespace-pre-wrap bg-muted/50 p-3 rounded-md font-mono">
                    {selectedLog.message}
                  </pre>
                </div>
                {selectedLog.user && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Utilisateur</p>
                    <p className="text-sm">{selectedLog.user}</p>
                  </div>
                )}
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Métadonnées</p>
                    <pre className="text-[10px] bg-muted/50 p-3 rounded-md overflow-x-auto whitespace-pre-wrap font-mono">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
