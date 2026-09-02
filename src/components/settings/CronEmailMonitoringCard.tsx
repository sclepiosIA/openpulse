import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, Clock, Mail, RefreshCw, Loader2 } from 'lucide-react'
import { formatDistanceToNow, differenceInHours, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { toast } from 'sonner'
import { useState } from 'react'

interface SyncLog {
  id: string
  execution_start: string
  execution_end: string | null
  status: string | null
  accounts_synced: number | null
  emails_fetched: number | null
  ai_analyses_performed: number | null
  errors_count: number | null
}

export function CronEmailMonitoringCard() {
  const isMobile = useIsMobile()
  const [isTriggering, setIsTriggering] = useState(false)

  // Fetch latest sync logs
  const {
    data: syncLogs,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['cron-email-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_sync_logs')
        .select(
          'id, execution_start, execution_end, status, accounts_synced, emails_fetched, ai_analyses_performed, errors_count'
        )
        .order('execution_start', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data || []) as SyncLog[]
    },
    staleTime: 60_000,
  })

  // Fetch pending threads count
  const { data: pendingCount, isLoading: pendingLoading } = useQuery({
    queryKey: ['cron-email-pending-threads'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('email_threads')
        .select('id', { count: 'exact', head: true })
        .is('ai_last_processed_at', null)
      if (error) throw error
      return count || 0
    },
    staleTime: 60_000,
  })

  const lastSync = syncLogs?.[0]
  const lastSyncDate = lastSync?.execution_start ? new Date(lastSync.execution_start) : null
  const hoursSinceLastSync = lastSyncDate ? differenceInHours(new Date(), lastSyncDate) : Infinity
  const isInactive = hoursSinceLastSync > 2
  const hasErrors = lastSync?.errors_count && lastSync.errors_count > 0

  const getStatusInfo = () => {
    if (!lastSync)
      return { label: 'Jamais exécuté', color: 'bg-muted text-muted-foreground', icon: Clock }
    if (isInactive)
      return {
        label: `Inactif (${hoursSinceLastSync}h)`,
        color: 'bg-destructive/10 text-destructive border-destructive/30',
        icon: AlertTriangle,
      }
    if (hasErrors)
      return {
        label: 'Erreurs',
        color: 'bg-amber-100 text-amber-700 border-amber-300',
        icon: AlertTriangle,
      }
    return {
      label: 'Actif',
      color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      icon: CheckCircle2,
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon

  const handleTriggerSync = async () => {
    setIsTriggering(true)
    try {
      const { error } = await supabase.functions.invoke('hourly-email-sync-and-analysis', {
        body: { mode: 'manual' },
      })
      if (error) throw error
      toast.success('Synchronisation lancée avec succès')
      setTimeout(() => refetchLogs(), 5000)
    } catch (err: any) {
      toast.error(`Erreur : ${err.message}`)
    } finally {
      setIsTriggering(false)
    }
  }

  return (
    <Card
      className={cn(
        'bg-card/80 backdrop-blur-sm border-t-4',
        isInactive ? 'border-t-destructive' : 'border-t-sky-500'
      )}
    >
      <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}>
            <div
              className={cn(
                'rounded-lg',
                isInactive ? 'bg-destructive/10' : 'bg-sky-500/10',
                isMobile ? 'p-1.5' : 'p-2'
              )}
            >
              <Mail
                className={cn(
                  isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4',
                  isInactive ? 'text-destructive' : 'text-sky-600'
                )}
              />
            </div>
            CRON Email
          </CardTitle>
          <Badge variant="outline" className={cn('text-xs', statusInfo.color)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusInfo.label}
          </Badge>
        </div>
        {!isMobile && (
          <CardDescription>Synchronisation et analyse IA automatique des emails</CardDescription>
        )}
      </CardHeader>
      <CardContent className={cn('space-y-3', isMobile && 'p-3 pt-1')}>
        {/* Alert if inactive */}
        {isInactive && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-medium text-destructive">
                CRON inactif depuis {hoursSinceLastSync}h
              </p>
              <p className="text-muted-foreground mt-0.5">
                Vérifiez que <code className="bg-muted px-1 rounded">app.supabase_url</code> et{' '}
                <code className="bg-muted px-1 rounded">app.service_role_key</code> sont configurés
                dans les paramètres Postgres.
              </p>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Dernière sync
            </p>
            <p className={cn('font-semibold truncate', isMobile ? 'text-xs' : 'text-sm')}>
              {logsLoading
                ? '...'
                : lastSyncDate
                  ? formatDistanceToNow(lastSyncDate, { addSuffix: true, locale: fr })
                  : 'Jamais'}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              En attente IA
            </p>
            <p
              className={cn(
                'font-semibold',
                isMobile ? 'text-xs' : 'text-sm',
                pendingCount && pendingCount > 0 ? 'text-amber-600' : 'text-emerald-600'
              )}
            >
              {pendingLoading ? '...' : `${pendingCount} thread${pendingCount !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Emails récupérés
            </p>
            <p className={cn('font-semibold', isMobile ? 'text-xs' : 'text-sm')}>
              {logsLoading ? '...' : (lastSync?.emails_fetched ?? '—')}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Analyses IA</p>
            <p className={cn('font-semibold', isMobile ? 'text-xs' : 'text-sm')}>
              {logsLoading ? '...' : (lastSync?.ai_analyses_performed ?? '—')}
            </p>
          </div>
        </div>

        {/* Recent executions */}
        {syncLogs && syncLogs.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Dernières exécutions</p>
            <div className="space-y-1">
              {syncLogs.slice(0, 3).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/30"
                >
                  <div className="flex items-center gap-1.5">
                    {log.status === 'success' || log.status === 'completed' ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    ) : log.status === 'error' || log.status === 'failed' ? (
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                    ) : (
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">
                      {format(new Date(log.execution_start), 'dd/MM HH:mm', { locale: fr })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {log.emails_fetched != null && <span>{log.emails_fetched} emails</span>}
                    {log.errors_count != null && log.errors_count > 0 && (
                      <span className="text-destructive">{log.errors_count} err</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={cn('flex gap-2', isMobile ? 'flex-col' : '')}>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl bg-card/50 hover:bg-card border-sky-500/20"
            onClick={handleTriggerSync}
            disabled={isTriggering}
          >
            {isTriggering ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isTriggering ? 'Sync en cours...' : 'Forcer la sync'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
