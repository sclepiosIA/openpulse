import { useState, useMemo } from 'react'
import { TrendingUp, Download, BarChart3, Search } from 'lucide-react'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { ImmersivePageBackground } from '@/components/layout/ImmersivePageBackground'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { Input } from '@/components/ui/input'
import { useSalesForecast, type ForecastRange } from '@/hooks/crm/useSalesForecast'
import { ForecastKPIs } from '@/components/forecasting/ForecastKPIs'
import { ForecastByQuarter } from '@/components/forecasting/ForecastByQuarter'
import { ForecastByCommercial } from '@/components/forecasting/ForecastByCommercial'
import { ForecastByPhase } from '@/components/forecasting/ForecastByPhase'
import { ForecastTopDeals } from '@/components/forecasting/ForecastTopDeals'
import { CommercialFilterPopover } from '@/components/forecasting/CommercialFilterPopover'
import { ForecastV2Panel } from '@/components/forecasting/ForecastV2Panel'
import { useToast } from '@/hooks/shared/use-toast'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { PageDataState } from '@/components/common/PageDataState'
import { safeNum } from '@/lib/formatters'

const fx = (v: unknown, d = 2) => safeNum(v).toFixed(d)

const RANGE_LABELS: Record<ForecastRange, string> = {
  current_quarter: 'Trimestre courant',
  next_quarter: 'Trimestre suivant',
  rolling_12: '12 mois glissants',
  year: 'Année en cours',
}

export default function Forecasting() {
  usePageTitle('Prévisions des ventes')
  const [range, setRange] = useState<ForecastRange>('year')
  const [selectedCommercials, setSelectedCommercials] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const { data, isLoading, error, refetch } = useSalesForecast(range)
  const { toast } = useToast()

  const commercialOptions = useMemo(
    () =>
      (data?.by_commercial || [])
        .filter((c) => c.user_id)
        .map((c) => ({ id: c.user_id as string, label: c.display_name })),
    [data]
  )

  const matchSearch = (txt: string) =>
    !search.trim() || txt.toLowerCase().includes(search.trim().toLowerCase())

  const matchCommercial = (userId: string | null | undefined) =>
    selectedCommercials.length === 0 ||
    (userId !== null && userId !== undefined && selectedCommercials.includes(userId))

  const filteredCommercials = useMemo(
    () =>
      (data?.by_commercial || [])
        .filter((c) => matchCommercial(c.user_id))
        .filter((c) => matchSearch(c.display_name)),
    [data, selectedCommercials, search]
  )

  const filteredTopDeals = useMemo(
    () => (data?.top_deals || []).filter((d) => matchSearch(d.nom)),
    [data, search]
  )
  const filteredHotDeals = useMemo(
    () => (data?.hot_deals || []).filter((d) => matchSearch(d.nom)),
    [data, search]
  )
  const filteredAtRisk = useMemo(
    () => (data?.at_risk_deals || []).filter((d) => matchSearch(d.nom)),
    [data, search]
  )

  const csvContent = useMemo(() => {
    if (!data) return null
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines: string[] = [
      'Section,Label,Pipeline brut (EUR),Pipeline pondéré (EUR),Gagné (EUR),Objectif (EUR),Détail',
    ]
    data.by_quarter.forEach((q) =>
      lines.push(
        [
          'Trimestre',
          esc(q.quarter),
          fx(q.raw),
          fx(q.weighted),
          fx(q.won),
          fx(q.target),
          esc(`${q.count} deals`),
        ].join(',')
      )
    )
    filteredCommercials.forEach((c) =>
      lines.push(
        [
          'Commercial',
          esc(c.display_name),
          fx(c.raw),
          fx(c.weighted),
          fx(c.won),
          '0',
          esc(`${c.deals_count} deals`),
        ].join(',')
      )
    )
    data.by_phase.forEach((p) =>
      lines.push(
        [
          'Phase',
          esc(p.label || p.statut),
          fx(p.raw),
          fx(p.weighted),
          '0',
          '0',
          esc(`${p.probability}% / ${p.count} deals`),
        ].join(',')
      )
    )
    ;(data.by_phase_group || []).forEach((g) =>
      lines.push(
        [
          'Phase métier',
          esc(g.phase_group),
          fx(g.raw),
          fx(g.weighted),
          '0',
          '0',
          esc(`${g.count} deals`),
        ].join(',')
      )
    )
    filteredHotDeals.forEach((d) =>
      lines.push(
        [
          'Deal chaud',
          esc(d.nom),
          fx(d.deal_value),
          fx(d.weighted_value),
          '0',
          '0',
          esc(`${d.statut} · ${d.probability}% · closing ${d.closing_date}`),
        ].join(',')
      )
    )
    filteredAtRisk.forEach((d) =>
      lines.push(
        [
          'Deal à risque',
          esc(d.nom),
          fx(d.deal_value),
          fx(d.weighted_value),
          '0',
          '0',
          esc(`${d.statut} · closing dépassé ${d.closing_date}`),
        ].join(',')
      )
    )
    filteredTopDeals.forEach((d) =>
      lines.push(
        [
          'Top deal',
          esc(d.nom),
          fx(d.deal_value),
          fx(d.weighted_value),
          '0',
          '0',
          esc(`${d.statut} · ${d.probability}% · closing ${d.closing_date}`),
        ].join(',')
      )
    )
    return lines.join('\n')
  }, [data, filteredCommercials, filteredHotDeals, filteredAtRisk, filteredTopDeals])

  const handleExport = () => {
    if (!csvContent) return
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forecast-${range}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({ title: 'Export CSV téléchargé' })
  }

  return (
    <ImmersivePageBackground>
      <ImmersivePageHeader
        title="Prévisions des ventes"
        subtitle="Prévision pondérée du pipeline par probabilité de closing"
        icon={TrendingUp}
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Select value={range} onValueChange={(v) => setRange(v as ForecastRange)}>
              <SelectTrigger className="w-[170px] sm:w-[200px] bg-card/10 border-white/20 text-white backdrop-blur-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RANGE_LABELS) as ForecastRange[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {RANGE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CommercialFilterPopover
              options={commercialOptions}
              selected={selectedCommercials}
              onChange={setSelectedCommercials}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!data}
              className="bg-card/10 border-white/20 text-white hover:bg-card/20 hover:text-white"
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.assign('/rapports-custom')}
              className="bg-card/10 border-white/20 text-white hover:bg-card/20 hover:text-white"
              title="Ouvrir dans Rapports personnalisés"
            >
              <BarChart3 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Rapports</span>
            </Button>
          </div>
        }
      />

      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <PageDataState
          isLoading={isLoading || !data}
          isError={!!error}
          error={error}
          onRetry={() => refetch()}
          loadingFallback={
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={`forecasting-skeleton-${i}`} className="h-28" />
                ))}
              </div>
              <Skeleton className="h-10 w-full max-w-md" />
              <Skeleton className="h-80" />
            </div>
          }
        >
          {data && (
            <>
              <ForecastKPIs kpis={data.kpis} previous={data.previous_period} />

              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un commercial, un établissement…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Tabs defaultValue="quarter" className="space-y-4">
                <TabsList className="w-full sm:w-auto overflow-x-auto">
                  <TabsTrigger value="quarter">Trimestres</TabsTrigger>
                  <TabsTrigger value="commercial">Commerciaux</TabsTrigger>
                  <TabsTrigger value="phase">Phases</TabsTrigger>
                  <TabsTrigger value="top">Top deals</TabsTrigger>
                  <TabsTrigger value="ai-v2">IA v2 ✨</TabsTrigger>
                </TabsList>
                <TabsContent value="quarter">
                  <ForecastByQuarter data={data.by_quarter} />
                </TabsContent>
                <TabsContent value="commercial">
                  <ForecastByCommercial data={filteredCommercials} />
                </TabsContent>
                <TabsContent value="phase">
                  <ForecastByPhase data={data.by_phase} groups={data.by_phase_group} />
                </TabsContent>
                <TabsContent value="top">
                  <ForecastTopDeals
                    data={filteredTopDeals}
                    hot={filteredHotDeals}
                    atRisk={filteredAtRisk}
                  />
                </TabsContent>
                <TabsContent value="ai-v2">
                  <ForecastV2Panel start={data.range.start} end={data.range.end} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </PageDataState>
      </div>
    </ImmersivePageBackground>
  )
}
