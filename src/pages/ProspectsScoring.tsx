import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useProspectsScoringList,
  useScoringOverview,
  useScoringTrends,
  useRecomputeAllScores,
  useScoringOwners,
} from '@/hooks/crm/useBehavioralScore'
import { getScoreTier } from '@/types/scoring'
import {
  Activity,
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  AlertCircle,
  Moon,
  UserX,
  BellOff,
} from 'lucide-react'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { ImmersivePageBackground } from '@/components/layout/ImmersivePageBackground'
import { PageDataState } from '@/components/common/PageDataState'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useToast } from '@/hooks/shared/use-toast'
import { ScoringKpiBar } from '@/components/scoring/ScoringKpiBar'
import {
  ScoringFiltersBar,
  type ScoringFiltersState,
  type TierKey,
} from '@/components/scoring/ScoringFiltersBar'
import { ScoringTrendChart } from '@/components/scoring/ScoringTrendChart'
import { ScoringPhaseDistribution } from '@/components/scoring/ScoringPhaseDistribution'
import { ScoringChannelMix } from '@/components/scoring/ScoringChannelMix'
import { ScoringMovementSection } from '@/components/scoring/ScoringMovementSection'
import { ProspectActionMenu } from '@/components/scoring/ProspectActionMenu'
import { ProspectScoringSheet } from '@/components/scoring/ProspectScoringSheet'

function tierOf(score: number): TierKey {
  if (score >= 80) return 'hot'
  if (score >= 60) return 'warm'
  if (score >= 40) return 'working'
  return 'cold'
}

function ownerLabel(
  o: { prenom: string | null; nom: string | null; email: string | null } | undefined
) {
  if (!o) return null
  return `${o.prenom ?? ''} ${o.nom ?? ''}`.trim() || o.email || null
}

export default function ProspectsScoring() {
  usePageTitle('Scoring prospects')
  const navigate = useNavigate()
  const { toast } = useToast()
  const {
    data: prospects,
    isLoading,
    isError: listError,
    error: listErr,
    refetch: refetchList,
  } = useProspectsScoringList()
  const {
    data: overview,
    isLoading: ovLoading,
    isError: ovError,
    error: ovErr,
  } = useScoringOverview()
  const { data: trends, isLoading: trendsLoading } = useScoringTrends(90)
  const { data: ownersList } = useScoringOwners()
  const recompute = useRecomputeAllScores()

  const [sheetId, setSheetId] = useState<string | null>(null)
  const [filters, setFilters] = useState<ScoringFiltersState>({
    search: '',
    tiers: [],
    owners: [],
    statuts: [],
    onlySnoozed: false,
    onlyOrphans: false,
    sort: 'score',
  })

  const ownersById = useMemo(() => {
    const m = new Map<
      string,
      {
        id: string
        prenom: string | null
        nom: string | null
        email: string | null
        avatar_url: string | null
      }
    >()
    ;(ownersList ?? []).forEach((o) => m.set(o.id, o))
    return m
  }, [ownersList])

  const statutsList = useMemo(() => {
    const set = new Set<string>()
    ;(prospects ?? []).forEach((p) => p.statut && set.add(p.statut))
    return Array.from(set).sort()
  }, [prospects])

  const filtered = useMemo(() => {
    const list = prospects ?? []
    const q = filters.search.trim().toLowerCase()
    let arr = list.filter((p) => {
      if (q && !p.nom.toLowerCase().includes(q)) return false
      const score = p.score_conversion ?? 0
      if (filters.tiers.length > 0 && !filters.tiers.includes(tierOf(score))) return false
      if (
        filters.owners.length > 0 &&
        (!p.commercial_id || !filters.owners.includes(p.commercial_id))
      )
        return false
      if (filters.statuts.length > 0 && (!p.statut || !filters.statuts.includes(p.statut)))
        return false
      if (filters.onlySnoozed && !p.scoring_snoozed_until) return false
      if (filters.onlyOrphans && p.commercial_id) return false
      return true
    })
    arr = [...arr].sort((a, b) => {
      switch (filters.sort) {
        case 'velocity':
          return (Number(b.engagement_velocity) || 0) - (Number(a.engagement_velocity) || 0)
        case 'last': {
          const da = a.last_engagement_at ? new Date(a.last_engagement_at).getTime() : 0
          const db = b.last_engagement_at ? new Date(b.last_engagement_at).getTime() : 0
          return db - da
        }
        case 'mrr':
          return (b.score_conversion ?? 0) - (a.score_conversion ?? 0) // proxy
        case 'score':
        default:
          return (b.score_conversion ?? 0) - (a.score_conversion ?? 0)
      }
    })
    return arr
  }, [prospects, filters])

  const sheetItem = useMemo(
    () => (prospects ?? []).find((p) => p.id === sheetId),
    [prospects, sheetId]
  )

  const exportCSV = () => {
    const rows = [
      [
        'Nom',
        'Score',
        'Score comportemental',
        'Vélocité',
        'Dernier signal',
        'Owner',
        'Statut',
        "Snoozé jusqu'au",
      ],
      ...filtered.map((p) => {
        const owner = p.commercial_id
          ? (ownerLabel(ownersById.get(p.commercial_id) as any) ?? '')
          : ''
        return [
          p.nom,
          String(p.score_conversion ?? 0),
          String(p.behavioral_score ?? 0),
          String(p.engagement_velocity ?? 0),
          p.last_engagement_at ?? '',
          owner,
          p.statut ?? '',
          p.scoring_snoozed_until ?? '',
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
    a.download = `scoring-prospects-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Export CSV téléchargé', description: `${filtered.length} prospects exportés.` })
  }

  const handleRecompute = async () => {
    try {
      const res = await recompute.mutateAsync()
      toast({
        title: 'Scores recalculés',
        description: `${res.updated}/${res.processed} prospects mis à jour.`,
      })
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message ?? String(e), variant: 'destructive' })
    }
  }

  const openSheet = (id: string) => setSheetId(id)

  const totalProspects = (prospects ?? []).length
  const hotCount = (prospects ?? []).filter((p) => (p.score_conversion ?? 0) >= 80).length
  const warmCount = (prospects ?? []).filter((p) => {
    const s = p.score_conversion ?? 0
    return s >= 60 && s < 80
  }).length

  return (
    <ImmersivePageBackground>
      <ImmersivePageHeader
        icon={Activity}
        title="Scoring prospects"
        subtitle="Score statique + comportemental (décroissance 30j) + attribution multi-touch"
        stats={[
          { label: 'prospects', value: totalProspects },
          { label: 'hot', value: hotCount, highlight: true },
          { label: 'warm', value: warmCount },
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
              onClick={handleRecompute}
              disabled={recompute.isPending}
              className="bg-card text-primary hover:bg-card/90"
            >
              <RefreshCw
                className={`h-4 w-4 sm:mr-1.5 ${recompute.isPending ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">
                {recompute.isPending ? 'Recalcul…' : 'Recalculer'}
              </span>
            </Button>
          </>
        }
      />

      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <PageDataState
          isLoading={false}
          isError={listError || ovError}
          error={(listErr ?? ovErr) as unknown}
          onRetry={() => refetchList()}
        >
          {/* KPIs */}
          <ScoringKpiBar kpis={overview?.kpis} prev={overview?.prev_kpis} loading={ovLoading} />

          {/* Filtres */}
          <ScoringFiltersBar
            filters={filters}
            onChange={setFilters}
            ownersList={(ownersList ?? []) as any}
            statutsList={statutsList}
          />

          {/* Tabs */}
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="movements">Top mouvements</TabsTrigger>
              <TabsTrigger value="list">Liste complète ({filtered.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <ScoringTrendChart data={trends} loading={trendsLoading} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ScoringPhaseDistribution data={overview?.by_status} loading={ovLoading} />
                <ScoringChannelMix data={overview?.channels} loading={ovLoading} />
              </div>
            </TabsContent>

            <TabsContent value="movements" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ScoringMovementSection
                  title="🚀 Hot streaks"
                  icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
                  items={overview?.hot_streaks}
                  loading={ovLoading}
                  onClick={openSheet}
                  emptyText="Personne ne progresse cette semaine."
                />
                <ScoringMovementSection
                  title="📉 À relancer"
                  icon={<AlertCircle className="h-4 w-4 text-red-500" />}
                  items={overview?.to_relaunch}
                  loading={ovLoading}
                  onClick={openSheet}
                  emptyText="Aucun décrochage détecté."
                  showLastEngagement
                />
                <ScoringMovementSection
                  title="😴 Endormis (>30j)"
                  icon={<Moon className="h-4 w-4 text-amber-600" />}
                  items={overview?.dormant}
                  loading={ovLoading}
                  onClick={openSheet}
                  emptyText="Aucun prospect endormi."
                  showLastEngagement
                />
                <ScoringMovementSection
                  title="👤 Sans owner"
                  icon={<UserX className="h-4 w-4 text-violet-600" />}
                  items={overview?.orphans}
                  loading={ovLoading}
                  onClick={openSheet}
                  emptyText="Tous les prospects ont un commercial assigné."
                />
              </div>
            </TabsContent>

            <TabsContent value="list" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Tous les prospects ({filtered.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={`prospects-scoring-skeleton-${i}`} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-10 text-center">
                      Aucun prospect ne correspond aux filtres.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Prospect</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                            <TableHead className="text-right hidden md:table-cell">
                              Compor.
                            </TableHead>
                            <TableHead className="text-right">Vélocité</TableHead>
                            <TableHead className="hidden md:table-cell">Dernier signal</TableHead>
                            <TableHead className="hidden lg:table-cell">Owner</TableHead>
                            <TableHead className="hidden md:table-cell">Phase</TableHead>
                            <TableHead className="w-[40px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((p) => {
                            const score = p.score_conversion ?? 0
                            const tier = getScoreTier(score)
                            const v = Number(p.engagement_velocity) || 0
                            const VIcon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus
                            const owner = p.commercial_id
                              ? ownerLabel(ownersById.get(p.commercial_id) as any)
                              : null
                            const isSnoozed =
                              p.scoring_snoozed_until &&
                              new Date(p.scoring_snoozed_until) > new Date()
                            return (
                              <TableRow
                                key={p.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => openSheet(p.id)}
                              >
                                <TableCell className="font-medium max-w-[220px]">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate">{p.nom}</span>
                                    {isSnoozed && (
                                      <BellOff
                                        className="h-3 w-3 text-amber-600 shrink-0"
                                        aria-label="snoozé"
                                      />
                                    )}
                                    {score >= 80 && (
                                      <Flame className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge
                                    variant="outline"
                                    className={`font-mono text-xs ${
                                      score >= 80
                                        ? 'text-emerald-600 border-emerald-600/30'
                                        : score >= 60
                                          ? 'text-amber-600 border-amber-600/30'
                                          : score >= 40
                                            ? 'text-orange-600 border-orange-600/30'
                                            : 'text-red-500 border-red-500/30'
                                    }`}
                                  >
                                    {score}/100
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs hidden md:table-cell">
                                  {p.behavioral_score ?? 0}/50
                                </TableCell>
                                <TableCell className="text-right">
                                  <span
                                    className={`inline-flex items-center gap-0.5 font-mono text-xs ${v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-muted-foreground'}`}
                                  >
                                    <VIcon className="h-3 w-3" />
                                    {v > 0 ? '+' : ''}
                                    {v.toFixed(1)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                                  {p.last_engagement_at
                                    ? formatDistanceToNow(new Date(p.last_engagement_at), {
                                        addSuffix: true,
                                        locale: fr,
                                      })
                                    : '—'}
                                </TableCell>
                                <TableCell className="text-xs hidden lg:table-cell">
                                  {owner ? (
                                    <span className="truncate">{owner}</span>
                                  ) : (
                                    <span className="text-muted-foreground italic">
                                      non assigné
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <Badge variant="outline" className="text-xs">
                                    {p.statut ?? tier.label}
                                  </Badge>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <ProspectActionMenu
                                    etablissementId={p.id}
                                    onOpenSheet={openSheet}
                                  />
                                </TableCell>
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
        </PageDataState>

        <ProspectScoringSheet
          etablissementId={sheetId}
          etablissementNom={sheetItem?.nom}
          open={!!sheetId}
          onOpenChange={(o) => {
            if (!o) setSheetId(null)
          }}
        />
      </div>
    </ImmersivePageBackground>
  )
}
