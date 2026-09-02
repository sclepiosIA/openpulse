import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getProcessingTypeLabel } from '@/hooks/ai/useAIUsageStats'

// Minimal structural types to avoid coupling with full DB row types.
interface FrontendErrorLike {
  error_type?: string | null
  error_message?: string | null
  current_route?: string | null
  created_at: string
}
interface AiErrorLike {
  processing_type: string
}
interface ApiErrorLike {
  method: string
  endpoint: string
  status_code?: number | null
}
interface EmailSyncErrorLike {
  emails_fetched?: number | null
}
interface FeedbackLike {
  priority?: string | null
}
interface SecurityLogLike {
  risk_level?: string | null
}

export function FrontendSummary({ errors }: { errors: FrontendErrorLike[] }) {
  if (errors.length === 0) return null
  const counts = errors.reduce<Record<string, number>>((acc, e) => {
    acc[e.error_type || 'runtime'] = (acc[e.error_type || 'runtime'] || 0) + 1
    return acc
  }, {})
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Types d'erreurs frontend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <Badge key={type} variant="outline" className="text-xs gap-1">
                {type === 'runtime'
                  ? 'Runtime'
                  : type === 'unhandled_rejection'
                    ? 'Promise rejetée'
                    : type === 'react_boundary'
                      ? 'React Boundary'
                      : type === 'network'
                        ? 'Réseau'
                        : type}
                <span className="bg-destructive/10 text-destructive px-1.5 rounded-full font-bold">
                  {count}
                </span>
              </Badge>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function HotspotsCard({ errors }: { errors: FrontendErrorLike[] }) {
  const groups = new Map<string, { message: string; route: string; count: number; last: string }>()
  for (const e of errors) {
    const msg = (e.error_message || 'unknown').slice(0, 120)
    const route = e.current_route || '—'
    const key = `${msg}|${route}`
    const existing = groups.get(key)
    if (existing) {
      existing.count++
      if (e.created_at > existing.last) existing.last = e.created_at
    } else {
      groups.set(key, { message: msg, route, count: 1, last: e.created_at })
    }
  }
  const rows = Array.from(groups.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Hotspots frontend ({errors.length} erreurs)</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune erreur frontend sur la période.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div
                key={`row-${r.route}-${i}`}
                className="flex items-start gap-3 p-2 rounded border bg-muted/30"
              >
                <Badge variant="destructive" className="shrink-0">
                  {r.count}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium break-words">{r.message}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-mono">{r.route}</span> · dernière :{' '}
                    {new Date(r.last).toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AiSummary({ errors }: { errors: AiErrorLike[] }) {
  if (errors.length === 0) return null
  const counts = errors.reduce<Record<string, number>>((acc, e) => {
    acc[e.processing_type] = (acc[e.processing_type] || 0) + 1
    return acc
  }, {})
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Répartition par type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <Badge key={type} variant="outline" className="text-xs gap-1">
                {getProcessingTypeLabel(type)}
                <span className="bg-destructive/10 text-destructive px-1.5 rounded-full font-bold">
                  {count}
                </span>
              </Badge>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function ApiSummary({ errors }: { errors: ApiErrorLike[] }) {
  if (errors.length === 0) return null
  const byEndpoint = errors.reduce<Record<string, { count: number; statuses: Set<number> }>>(
    (acc, e) => {
      const key = `${e.method} ${e.endpoint}`
      if (!acc[key]) acc[key] = { count: 0, statuses: new Set() }
      acc[key].count++
      if (e.status_code) acc[key].statuses.add(e.status_code)
      return acc
    },
    {}
  )
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Endpoints en erreur</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {Object.entries(byEndpoint)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 15)
            .map(([endpoint, info]) => (
              <div
                key={endpoint}
                className="flex items-center justify-between text-xs p-2 rounded bg-muted/30"
              >
                <span className="font-mono truncate max-w-[60%]">{endpoint}</span>
                <div className="flex gap-2 items-center">
                  {Array.from(info.statuses).map((s) => (
                    <Badge
                      key={String(s)}
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        s >= 500
                          ? 'text-red-600 border-red-200'
                          : 'text-orange-600 border-orange-200'
                      )}
                    >
                      {String(s)}
                    </Badge>
                  ))}
                  <Badge variant="secondary" className="text-[10px] font-bold">
                    {String(info.count)}x
                  </Badge>
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function EmailSyncSummary({ errors }: { errors: EmailSyncErrorLike[] }) {
  if (errors.length === 0) return null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Résumé synchronisation email</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Syncs en erreur :</span>
            <Badge variant="destructive" className="text-xs">
              {errors.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Emails non synchronisés :</span>
            <Badge variant="outline" className="text-xs">
              {errors.reduce((acc, e) => acc + (e.emails_fetched || 0), 0)}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function FeedbackSummary({ feedbacks }: { feedbacks: FeedbackLike[] }) {
  if (feedbacks.length === 0) return null
  const counts = feedbacks.reduce<Record<string, number>>((acc, f) => {
    const p = f.priority || 'non définie'
    acc[p] = (acc[p] || 0) + 1
    return acc
  }, {})
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Distribution par priorité</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([priority, count]) => (
              <Badge
                key={priority}
                variant="outline"
                className={cn(
                  'text-xs gap-1',
                  priority === 'critical'
                    ? 'text-red-700 border-red-200'
                    : priority === 'high'
                      ? 'text-orange-700 border-orange-200'
                      : priority === 'medium'
                        ? 'text-yellow-700 border-yellow-200'
                        : 'text-muted-foreground'
                )}
              >
                {priority}
                <span className="bg-destructive/10 text-destructive px-1.5 rounded-full font-bold">
                  {count}
                </span>
              </Badge>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function SecuritySummary({ logs }: { logs: SecurityLogLike[] }) {
  if (logs.length === 0) return null
  const counts = logs.reduce<Record<string, number>>((acc, s) => {
    acc[s.risk_level || 'inconnu'] = (acc[s.risk_level || 'inconnu'] || 0) + 1
    return acc
  }, {})
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Distribution par niveau de risque</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([level, count]) => (
              <Badge
                key={level}
                variant="outline"
                className={cn(
                  'text-xs gap-1',
                  level === 'high'
                    ? 'text-red-700 border-red-200'
                    : level === 'medium'
                      ? 'text-amber-700 border-amber-200'
                      : 'text-muted-foreground'
                )}
              >
                {level}
                <span className="bg-destructive/10 text-destructive px-1.5 rounded-full font-bold">
                  {count}
                </span>
              </Badge>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
