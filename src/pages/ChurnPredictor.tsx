import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

import {
  useChurnPredictions,
  useRecomputeChurn,
  useChurnOverview,
  useChurnTrends,
} from '@/hooks/csm/useChurnPredictions'
import { ShieldAlert, RefreshCw, Download, TrendingUp, TrendingDown, BellOff } from 'lucide-react'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { ImmersivePageBackground } from '@/components/layout/ImmersivePageBackground'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { ChurnKpiBar } from '@/components/churn/ChurnKpiBar'
import { ChurnRiskDonut } from '@/components/churn/ChurnRiskDonut'
import { ChurnTrendChart } from '@/components/churn/ChurnTrendChart'
import { ChurnFactorsBreakdown } from '@/components/churn/ChurnFactorsBreakdown'
import { ChurnFiltersBar, type ChurnFiltersState } from '@/components/churn/ChurnFiltersBar'
import { ChurnAccountCard } from '@/components/churn/ChurnAccountCard'
import { ChurnActionPlanSheet } from '@/components/churn/ChurnActionPlanSheet'

import { toast } from 'sonner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageDataState } from '@/components/common/PageDataState'

function ChurnPredictorInner() {
  usePageTitle('Prédiction de churn')
  const { data: predictions, isLoading, isError, error, refetch } = useChurnPredictions()
  const { data: overview, isLoading: ovLoading, isError: ovError } = useChurnOverview()
  const { data: trends, isLoading: trendsLoading } = useChurnTrends(90)
  const recompute = useRecomputeChurn()

  const [actionId, setActionId] = useState<string | null>(null)
  const [filters, setFilters] = useState<ChurnFiltersState>({
    search: '',
    risks: [],
    csms: [],
    offres: [],
    minScore: 0,
    sort: 'score',
  })

  // Options dérivées
  const csmOptions = useMemo(() => {
    const m = new Map<string, string>()
    ;(predictions ?? []).forEach((p) => {
      const id = p.etablissement?.csm_id
      if (id) m.set(id, id.slice(0, 8))
    })
    return Array.from(m.entries()).map(([id, label]) => ({ id, label: `CSM ${label}` }))
  }, [predictions])

  const offreOptions = useMemo(() => {
    const set = new Set<string>()
    ;(predictions ?? []).forEach(
      (p) => p.etablissement?.type_offre && set.add(p.etablissement.type_offre)
    )
    return Array.from(set).sort()
  }, [predictions])

  // Filtre + tri
  const filtered = useMemo(() => {
    const list = (predictions ?? []).filter(
      (p) => !p.acknowledged_until || new Date(p.acknowledged_until) < new Date()
    )
    const q = filters.search.trim().toLowerCase()
    let arr = list.filter((p) => {
      if (q && !(p.etablissement?.nom ?? '').toLowerCase().includes(q)) return false
      if (filters.risks.length > 0 && !filters.risks.includes(p.risk_level)) return false
      if (
        filters.csms.length > 0 &&
        (!p.etablissement?.csm_id || !filters.csms.includes(p.etablissement.csm_id))
      )
        return false
      if (
        filters.offres.length > 0 &&
        (!p.etablissement?.type_offre || !filters.offres.includes(p.etablissement.type_offre))
      )
        return false
      if (filters.minScore > 0 && Number(p.score) < filters.minScore) return false
      return true
    })
    arr = [...arr].sort((a, b) => {
      switch (filters.sort) {
        case 'name':
          return (a.etablissement?.nom ?? '').localeCompare(b.etablissement?.nom ?? '')
        case 'predicted_at':
          return new Date(b.predicted_at).getTime() - new Date(a.predicted_at).getTime()
        case 'score':
        default:
          return Number(b.score) - Number(a.score)
      }
    })
    return arr
  }, [predictions, filters])

  const snoozedList = useMemo(
    () =>
      (predictions ?? []).filter(
        (p) => p.acknowledged_until && new Date(p.acknowledged_until) > new Date()
      ),
    [predictions]
  )
  const criticals = useMemo(() => filtered.filter((p) => p.risk_level === 'critical'), [filtered])
  const highs = useMemo(() => filtered.filter((p) => p.risk_level === 'high'), [filtered])

  const worsenedIds = useMemo(
    () => new Set((overview?.worsened ?? []).map((m) => m.etablissement_id)),
    [overview]
  )
  const improvedIds = useMemo(
    () => new Set((overview?.improved ?? []).map((m) => m.etablissement_id)),
    [overview]
  )
  const worsened = useMemo(
    () => filtered.filter((p) => worsenedIds.has(p.etablissement_id)),
    [filtered, worsenedIds]
  )
  const improved = useMemo(
    () => filtered.filter((p) => improvedIds.has(p.etablissement_id)),
    [filtered, improvedIds]
  )

  const actionPrediction = useMemo(
    () => (predictions ?? []).find((p) => p.etablissement_id === actionId) ?? null,
    [predictions, actionId]
  )

  const exportCSV = () => {
    const rows = [
      [
        'Établissement',
        'Score',
        'Niveau',
        'Tickets',
        'Emails 30j',
        'Impayés',
        'Jours sans contact',
        'Calculé le',
      ],
      ...filtered.map((p) => {
        const f = p.factors || {}
        return [
          p.etablissement?.nom ?? '',
          String(Number(p.score).toFixed(0)),
          p.risk_level,
          String(f.open_tickets ?? 0),
          String(f.emails_30d ?? 0),
          String(f.unpaid_invoices ?? 0),
          String(f.days_since_last_interaction ?? ''),
          new Date(p.predicted_at).toISOString(),
        ]
      }),
    ]
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `churn-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${filtered.length} comptes exportés`)
  }

  const renderList = (list: typeof filtered) =>
    isLoading ? (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`churn-predictor-skeleton-${i}`} className="h-32 w-full" />
        ))}
      </div>
    ) : list.length === 0 ? (
      <div className="text-center py-12 text-muted-foreground">
        <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Aucun compte dans ce segment.</p>
      </div>
    ) : (
      <div className="space-y-3">
        {list.map((p) => (
          <ChurnAccountCard key={p.id} prediction={p} onOpenAction={setActionId} />
        ))}
      </div>
    )

  const totalCount = (predictions ?? []).length
  const criticalCount = (predictions ?? []).filter((p) => p.risk_level === 'critical').length
  const highCount = (predictions ?? []).filter((p) => p.risk_level === 'high').length

  // Only treat the predictions list query as fatal. An overview-only failure
  // must degrade gracefully (KPI bar reste vide) afin que l'utilisateur puisse
  // toujours consulter la liste et déclencher un recalcul.
  if (isError) {
    return (
      <div className="container mx-auto py-12 px-4">
        <PageDataState
          isLoading={false}
          isError={true}
          error={error as Error}
          onRetry={() => refetch()}
        >
          {null}
        </PageDataState>
      </div>
    )
  }

  return (
    <ImmersivePageBackground>
      <ImmersivePageHeader
        icon={ShieldAlert}
        title="Prédiction de churn"
        subtitle="Comptes à risque — score 0-100, recalcul nocturne 02:00"
        stats={[
          { label: 'comptes', value: totalCount },
          { label: 'critiques', value: criticalCount, highlight: true },
          { label: 'élevés', value: highCount },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={!filtered.length}
              className="bg-card/10 border-white/20 text-white hover:bg-card/20 hover:text-white"
            >
              <Download className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button
              size="sm"
              onClick={() => recompute.mutate()}
              disabled={recompute.isPending}
              className="bg-card text-primary hover:bg-card/90"
            >
              <RefreshCw
                className={`h-4 w-4 sm:mr-1.5 ${recompute.isPending ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">
                {recompute.isPending ? 'Calcul…' : 'Recalculer'}
              </span>
            </Button>
          </>
        }
      />

      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <ChurnKpiBar
          kpis={overview?.kpis}
          prev={overview?.prev_kpis}
          mrrAtRisk={Number(overview?.mrr_at_risk ?? 0)}
          loading={ovLoading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChurnRiskDonut kpis={overview?.kpis} loading={ovLoading} />
          <div className="lg:col-span-2">
            <ChurnTrendChart data={trends} loading={trendsLoading} />
          </div>
        </div>

        <ChurnFactorsBreakdown
          data={overview?.factors_breakdown}
          total={overview?.kpis.total ?? 0}
          loading={ovLoading}
        />

        <ChurnFiltersBar
          filters={filters}
          onChange={setFilters}
          csmOptions={csmOptions}
          offreOptions={offreOptions}
        />

        <Tabs defaultValue="all">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">Tous ({filtered.length})</TabsTrigger>
            <TabsTrigger value="critical">🔴 Critiques ({criticals.length})</TabsTrigger>
            <TabsTrigger value="high">🟠 Élevés ({highs.length})</TabsTrigger>
            <TabsTrigger value="worsened">
              <TrendingUp className="h-3.5 w-3.5 mr-1 text-red-500" /> Aggravés ({worsened.length})
            </TabsTrigger>
            <TabsTrigger value="improved">
              <TrendingDown className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Améliorés (
              {improved.length})
            </TabsTrigger>
            <TabsTrigger value="snoozed">
              <BellOff className="h-3.5 w-3.5 mr-1" /> Suivis ({snoozedList.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {renderList(filtered)}
          </TabsContent>
          <TabsContent value="critical" className="mt-4">
            {renderList(criticals)}
          </TabsContent>
          <TabsContent value="high" className="mt-4">
            {renderList(highs)}
          </TabsContent>
          <TabsContent value="worsened" className="mt-4">
            {renderList(worsened)}
          </TabsContent>
          <TabsContent value="improved" className="mt-4">
            {renderList(improved)}
          </TabsContent>
          <TabsContent value="snoozed" className="mt-4">
            {renderList(snoozedList)}
          </TabsContent>
        </Tabs>

        <ChurnActionPlanSheet
          prediction={actionPrediction}
          open={!!actionId}
          onOpenChange={(o) => {
            if (!o) setActionId(null)
          }}
        />
      </div>
    </ImmersivePageBackground>
  )
}

export default function ChurnPredictor() {
  return (
    <ErrorBoundary>
      <ChurnPredictorInner />
    </ErrorBoundary>
  )
}
