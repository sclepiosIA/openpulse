import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Search,
  RotateCcw,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ImmersivePageBackground } from '@/components/layout/ImmersivePageBackground'
import { PageDataState } from '@/components/common/PageDataState'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { fetchWorkflowRuns } from '@/services/automatisations/workflowRuns'
import { useWorkflows } from '@/hooks/workflows/useWorkflows'
import { useWorkflowReplay } from '@/hooks/workflows/useWorkflowReplay'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import type { WorkflowRun, WorkflowRunStatus } from '@/types/workflow'

const statusIcon = (s: string) => {
  if (s === 'success') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (s === 'failed') return <XCircle className="h-4 w-4 text-destructive" />
  if (s === 'running' || s === 'pending')
    return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
  if (s === 'paused' || s === 'scheduled') return <Clock className="h-4 w-4 text-amber-500" />
  return null
}

const statusVariant = (
  s: WorkflowRunStatus
): 'default' | 'destructive' | 'secondary' | 'outline' => {
  if (s === 'success') return 'default'
  if (s === 'failed') return 'destructive'
  if (s === 'paused' || s === 'pending' || s === 'running') return 'secondary'
  return 'outline'
}

export default function AutomationsRunsExplorer() {
  usePageTitle('Explorateur de runs')
  const navigate = useNavigate()
  const { data: workflows } = useWorkflows()
  const replayMut = useWorkflowReplay()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [workflowFilter, setWorkflowFilter] = useState<string>('all')
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null)

  const {
    data: runs,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['workflow_runs_explorer', statusFilter, workflowFilter],
    queryFn: async (): Promise<WorkflowRun[]> => {
      return fetchWorkflowRuns<WorkflowRun>({
        status: statusFilter,
        workflowId: workflowFilter,
        limit: 200,
      })
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  const workflowMap = useMemo(() => {
    const m = new Map<string, string>()
    ;(workflows || []).forEach((w) => m.set(w.id, w.nom))
    return m
  }, [workflows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return runs ?? []
    return (runs ?? []).filter((r) => {
      const nom = workflowMap.get(r.workflow_id) ?? ''
      return (
        nom.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.error ?? '').toLowerCase().includes(q)
      )
    })
  }, [runs, search, workflowMap])

  return (
    <ImmersivePageBackground>
      <ImmersivePageHeader
        icon={Eye}
        title="Explorateur de runs"
        subtitle="Tous les runs de workflows, filtres et replay"
        stats={[
          { label: 'runs affichés', value: filtered.length, highlight: true },
          { label: 'échecs', value: filtered.filter((r) => r.status === 'failed').length },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="bg-card/90 text-primary hover:bg-card"
            onClick={() => navigate('/automatisations')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        }
      />
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4">
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Recherche (nom, id, erreur)…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="success">Succès</SelectItem>
                  <SelectItem value="failed">Échec</SelectItem>
                  <SelectItem value="running">En cours</SelectItem>
                  <SelectItem value="paused">En pause</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
              <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Workflow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous workflows</SelectItem>
                  {(workflows ?? []).map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Runs récents</CardTitle>
          </CardHeader>
          <CardContent>
            <PageDataState
              isLoading={isLoading && !runs}
              isError={isError}
              isEmpty={!isLoading && filtered.length === 0}
              emptyTitle="Aucun run"
              emptyDescription="Aucun run pour ces filtres."
              onRetry={() => refetch()}
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Statut</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead className="hidden md:table-cell">Démarré</TableHead>
                      <TableHead className="hidden lg:table-cell">Durée</TableHead>
                      <TableHead className="hidden md:table-cell">Étapes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge
                            variant={statusVariant(r.status)}
                            className="text-xs gap-1 inline-flex items-center"
                          >
                            {statusIcon(r.status)}
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {workflowMap.get(r.workflow_id) ?? (
                            <span className="font-mono text-xs">{r.workflow_id.slice(0, 8)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                          {format(new Date(r.started_at), 'PPp', { locale: fr })}
                        </TableCell>
                        <TableCell className="text-xs hidden lg:table-cell">
                          {r.duration_ms != null ? `${r.duration_ms} ms` : '—'}
                        </TableCell>
                        <TableCell className="text-xs hidden md:table-cell">
                          {(r.steps_log ?? []).length}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedRun(r)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Rejouer"
                            disabled={replayMut.isPending}
                            onClick={() => replayMut.mutate(r.id)}
                          >
                            <RotateCcw className="h-4 w-4 text-amber-500" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Ouvrir le workflow"
                            onClick={() => navigate(`/automatisations/${r.workflow_id}/edit`)}
                          >
                            <ArrowLeft className="h-4 w-4 rotate-180" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </PageDataState>
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!selectedRun} onOpenChange={(o) => !o && setSelectedRun(null)}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Détails du run</SheetTitle>
          </SheetHeader>
          {selectedRun && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={statusVariant(selectedRun.status)}>{selectedRun.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(selectedRun.started_at), 'PPp', { locale: fr })}
                </span>
              </div>
              {selectedRun.error && (
                <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                  {selectedRun.error}
                </p>
              )}
              <div>
                <p className="text-xs font-semibold mb-1">Payload du déclencheur</p>
                <pre className="text-[10px] bg-muted/50 p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(selectedRun.trigger_payload, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1">
                  Étapes ({(selectedRun.steps_log ?? []).length})
                </p>
                <ScrollArea className="h-[400px] pr-2">
                  <div className="space-y-2">
                    {(selectedRun.steps_log ?? []).map((s, i) => (
                      <div key={i} className="border rounded p-2 text-xs">
                        <div className="flex items-center gap-2">
                          {statusIcon(s.status)}
                          <span className="font-medium capitalize">{s.node_type}</span>
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {s.node_id}
                          </span>
                        </div>
                        {s.error && <p className="text-destructive mt-1">{s.error}</p>}
                        {s.output && (
                          <pre className="bg-muted/50 p-1.5 rounded mt-1 overflow-auto max-h-24 text-[10px]">
                            {JSON.stringify(s.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <Button
                className="w-full"
                variant="outline"
                disabled={replayMut.isPending}
                onClick={() => replayMut.mutate(selectedRun.id)}
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Rejouer ce run
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </ImmersivePageBackground>
  )
}
