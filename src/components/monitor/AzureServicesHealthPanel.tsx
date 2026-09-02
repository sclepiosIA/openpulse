import { useQuery } from '@tanstack/react-query'
import { Activity, AlertCircle, CheckCircle2, Clock, HelpCircle, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { probeAllAzureServices, type AzureServiceHealthResult } from '@/services/azureServiceHealth'

const REFRESH_MS = 60_000

const STATUS_COPY: Record<
  AzureServiceHealthResult['status'],
  { label: string; tone: string; icon: typeof CheckCircle2 }
> = {
  ok: {
    label: 'OK',
    tone: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  degraded: {
    label: 'Dégradé',
    tone: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: AlertCircle,
  },
  down: {
    label: 'Indisponible',
    tone: 'bg-red-100 text-red-700 border-red-200',
    icon: AlertCircle,
  },
  unconfigured: {
    label: 'Non configuré',
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: HelpCircle,
  },
}

function statusRank(status: AzureServiceHealthResult['status']): number {
  return status === 'down' ? 3 : status === 'degraded' ? 2 : status === 'unconfigured' ? 1 : 0
}

export function AzureServicesHealthPanel() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['azure-services-health'],
    queryFn: () => probeAllAzureServices(),
    refetchInterval: REFRESH_MS,
    staleTime: 20_000,
  })

  const services = data ?? []
  const worstStatus = services.reduce<AzureServiceHealthResult['status']>(
    (worst, service) => (statusRank(service.status) > statusRank(worst) ? service.status : worst),
    'ok'
  )
  const healthyCount = services.filter((s) => s.status === 'ok').length
  const configuredCount = services.filter((s) => s.status !== 'unconfigured').length
  const lastChecked = services
    .map((s) => s.checkedAt)
    .sort()
    .at(-1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Services Azure Gestion
            </CardTitle>
            <CardDescription className="text-xs">
              Healthchecks publics Drive, Mail, Pulse et Meetings — sans secret côté navigateur.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={STATUS_COPY[worstStatus].tone}>
              {healthyCount}/{services.length || 4} OK
            </Badge>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? 'animate-spin' : ''} />
              Rafraîchir
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Sonde des services Azure…</p>
        ) : error ? (
          <p className="text-sm text-destructive">Impossible de charger la santé Azure.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {services.map((service) => {
                const copy = STATUS_COPY[service.status]
                const Icon = copy.icon
                const deps = Object.entries(service.dependencies)
                return (
                  <div key={service.id} className="rounded-lg border bg-background p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5" />
                          {service.label}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {service.description}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${copy.tone}`}>
                        {copy.label}
                      </Badge>
                    </div>
                    <dl className="text-[11px] text-muted-foreground space-y-1">
                      <div className="flex justify-between gap-2">
                        <dt>HTTP</dt>
                        <dd>{service.httpStatus ?? '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Version</dt>
                        <dd>{service.version ?? '—'}</dd>
                      </div>
                      {deps.length > 0 && (
                        <div>
                          <dt className="sr-only">Dépendances</dt>
                          <dd className="flex flex-wrap gap-1 pt-1">
                            {deps.map(([name, state]) => (
                              <span key={name} className="rounded-full bg-muted px-2 py-0.5">
                                {name}: {state}
                              </span>
                            ))}
                          </dd>
                        </div>
                      )}
                    </dl>
                    {service.message && (
                      <p className="text-[11px] text-muted-foreground">{service.message}</p>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {configuredCount} service(s) configuré(s). Dernière sonde{' '}
              {lastChecked
                ? formatDistanceToNow(new Date(lastChecked), { addSuffix: true, locale: fr })
                : 'non disponible'}
              .
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
