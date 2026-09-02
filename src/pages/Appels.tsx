/**
 * Page /appels — journal global des appels avec KPIs et filtres.
 */
import { useMemo, useState } from 'react'
import { useCalls } from '@/hooks/voice/useCalls'
import { linkify } from '@/lib/linkify'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { CallRecordingPlayer } from '@/components/cti/CallRecordingPlayer'
import { CALL_STATUS_LABELS } from '@/types/calls'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { PageDataState } from '@/components/common/PageDataState'

export default function Appels() {
  usePageTitle('Appels')
  const { data: calls, isLoading, isError, refetch } = useCalls({ limit: 500 })
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState<'all' | 'outbound' | 'inbound'>('all')

  const filtered = useMemo(() => {
    let list = calls ?? []
    if (direction !== 'all') list = list.filter((c) => c.direction === direction)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          (c.display_name || '').toLowerCase().includes(q) ||
          c.from_number.toLowerCase().includes(q) ||
          c.to_number.toLowerCase().includes(q) ||
          (c.notes || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [calls, search, direction])

  const kpis = useMemo(() => {
    const list = calls ?? []
    const total = list.length
    const completed = list.filter((c) => c.status === 'completed').length
    const totalDuration = list.reduce((s, c) => s + (c.duration_sec || 0), 0)
    const avg = completed > 0 ? Math.round(totalDuration / completed) : 0
    const answerRate = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, avg, answerRate }
  }, [calls])

  return (
    <div className="container py-6 space-y-6 max-w-7xl">
      <header className="flex items-center gap-3">
        <Phone className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Appels</h1>
          <p className="text-sm text-muted-foreground">
            Journal complet des communications téléphoniques
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total appels</div>
            <div className="text-2xl font-bold">{kpis.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Aboutis
            </div>
            <div className="text-2xl font-bold">{kpis.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Durée moy.
            </div>
            <div className="text-2xl font-bold">
              {Math.floor(kpis.avg / 60)}m {kpis.avg % 60}s
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Taux de réponse</div>
            <div className="text-2xl font-bold">{kpis.answerRate}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historique</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Rechercher (nom, numéro, note)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="outbound">Sortants</SelectItem>
                <SelectItem value="inbound">Entrants</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <PageDataState
            isLoading={isLoading && !calls}
            isError={isError}
            isEmpty={!isLoading && filtered.length === 0}
            emptyTitle="Aucun appel"
            emptyDescription="Aucun appel ne correspond aux filtres."
            onRetry={() => refetch()}
          >
            <div className="divide-y">
              {filtered.map((c) => (
                <div key={c.id} className="py-3 flex items-start gap-3">
                  <div className="mt-1">
                    {c.direction === 'outbound' ? (
                      <PhoneOutgoing className="h-4 w-4 text-primary" />
                    ) : (
                      <PhoneIncoming className="h-4 w-4 text-success" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {c.display_name ||
                          (c.direction === 'outbound' ? c.to_number : c.from_number)}
                      </span>
                      <Badge
                        variant={
                          c.status === 'completed'
                            ? 'default'
                            : c.status === 'failed' || c.status === 'missed'
                              ? 'destructive'
                              : 'outline'
                        }
                        className="text-[10px]"
                      >
                        {CALL_STATUS_LABELS[c.status]}
                      </Badge>
                      {c.duration_sec > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {Math.floor(c.duration_sec / 60)}m {c.duration_sec % 60}s
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(c.started_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                      {c.from_number && c.to_number && ` · ${c.from_number} → ${c.to_number}`}
                    </div>
                    {c.notes && (
                      <div className="text-xs mt-2 bg-muted/30 rounded p-2 max-w-2xl whitespace-pre-wrap break-words">
                        {linkify(c.notes)}
                      </div>
                    )}
                    {c.failure_reason && (
                      <div className="text-xs mt-1 text-destructive flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {c.failure_reason}
                      </div>
                    )}
                    <div className="mt-2">
                      <CallRecordingPlayer recordingPath={c.recording_path} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PageDataState>
        </CardContent>
      </Card>
    </div>
  )
}
