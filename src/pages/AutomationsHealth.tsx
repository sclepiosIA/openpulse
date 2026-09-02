import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ArrowLeft, AlertTriangle, CheckCircle2, Clock, PauseCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useWorkflowHealth, type WorkflowHealth } from '@/hooks/workflows/useWorkflowHealth'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { ImmersivePageBackground } from '@/components/layout/ImmersivePageBackground'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { PageDataState } from '@/components/common/PageDataState'
import { Skeleton } from '@/components/ui/skeleton'

const EMPTY_HEALTH: WorkflowHealth = {
  window_days: 7,
  total_runs: 0,
  success: 0,
  failed: 0,
  paused: 0,
  success_rate: 0,
  avg_duration_ms: 0,
  pending_scheduled: 0,
  top_failing: [],
  per_day: [],
}

export default function AutomationsHealth() {
  usePageTitle('Santé des automatisations')
  const navigate = useNavigate()
  const [days, setDays] = useState(7)
  const { data: raw, isLoading, isError, error, refetch } = useWorkflowHealth(days)
  const data: WorkflowHealth = raw ?? EMPTY_HEALTH

  const fmtMs = (ms: number) => {
    if (!ms) return '—'
    if (ms < 1000) return `${ms} ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`
    return `${(ms / 60000).toFixed(1)} min`
  }

  return (
    <ImmersivePageBackground>
      <ImmersivePageHeader
        icon={Activity}
        title="Santé des automatisations"
        subtitle={`Suivi des exécutions sur ${days} jours`}
        actions={
          <div className="flex items-center gap-2">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-[120px] bg-card/90 text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 jour</SelectItem>
                <SelectItem value="7">7 jours</SelectItem>
                <SelectItem value="30">30 jours</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="bg-card/90"
              onClick={() => navigate('/automatisations')}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Retour
            </Button>
          </div>
        }
      />

      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <PageDataState
          isLoading={isLoading && !raw}
          isError={isError}
          error={error ?? undefined}
          onRetry={() => refetch()}
          loadingFallback={
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={`automations-health-skeleton-${i}`} className="h-24 w-full" />
                ))}
              </div>
              <Skeleton className="h-[300px] w-full" />
              <Skeleton className="h-[200px] w-full" />
            </div>
          }
        >
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard
                icon={<Activity className="h-4 w-4 text-primary" />}
                label="Exécutions"
                value={data.total_runs}
              />
              <KpiCard
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                label="Taux succès"
                value={`${data.success_rate}%`}
                tone={data.success_rate >= 90 ? 'good' : data.success_rate >= 70 ? 'warn' : 'bad'}
              />
              <KpiCard
                icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
                label="Échecs"
                value={data.failed}
                tone={data.failed > 0 ? 'bad' : 'good'}
              />
              <KpiCard
                icon={<PauseCircle className="h-4 w-4 text-amber-600" />}
                label="En pause"
                value={data.paused}
              />
              <KpiCard
                icon={<Clock className="h-4 w-4 text-blue-600" />}
                label="Durée moyenne"
                value={fmtMs(data.avg_duration_ms)}
              />
            </div>

            {data.pending_scheduled > 0 && (
              <Card className="border-amber-300 bg-amber-50/50">
                <CardContent className="py-3 flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span>
                    <strong>{data.pending_scheduled}</strong> étape(s) planifiée(s) en attente de
                    traitement
                  </span>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Évolution quotidienne</CardTitle>
                <CardDescription>Succès vs échecs jour par jour</CardDescription>
              </CardHeader>
              <CardContent>
                {data.per_day.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune exécution sur la période.</p>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.per_day}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="day"
                          tickFormatter={(d) =>
                            new Date(d).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                            })
                          }
                          className="text-xs"
                        />
                        <YAxis className="text-xs" allowDecimals={false} />
                        <Tooltip
                          labelFormatter={(d) => new Date(d).toLocaleDateString('fr-FR')}
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="success"
                          stroke="hsl(142 71% 45%)"
                          name="Succès"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="failed"
                          stroke="hsl(var(--destructive))"
                          name="Échecs"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top workflows en échec</CardTitle>
                <CardDescription>À investiguer en priorité</CardDescription>
              </CardHeader>
              <CardContent>
                {data.top_failing.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun workflow en échec 🎉</p>
                ) : (
                  <ul className="space-y-2">
                    {data.top_failing.map((w) => (
                      <li
                        key={w.id}
                        className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-muted/40 cursor-pointer"
                        onClick={() => navigate(`/automatisations/${w.id}/edit`)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                          <span className="font-medium truncate">{w.nom}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <Badge variant="destructive">
                            {w.failed} échec{w.failed > 1 ? 's' : ''}
                          </Badge>
                          <span className="text-muted-foreground">/ {w.total} total</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        </PageDataState>
      </div>
    </ImmersivePageBackground>
  )
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  tone?: 'good' | 'warn' | 'bad'
}) {
  const colorCls =
    tone === 'good'
      ? 'text-emerald-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'bad'
          ? 'text-destructive'
          : 'text-foreground'
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className={`text-2xl font-bold mt-1 ${colorCls}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
