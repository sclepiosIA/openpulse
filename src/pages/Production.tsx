import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react'
import {
  Loader2,
  Download,
  Factory,
  BarChart3,
  ChevronDown,
  Building2,
  Users,
  Route,
  Receipt,
  Activity,
  LineChart,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useProduction } from '@/hooks/production/useProduction'
import { useCustomerHealth } from '@/hooks/crm/useCustomerHealth'
import { useBulkHealthMetrics } from '@/hooks/crm/useCustomerHealthMetrics'
import { useCsmSante } from '@/hooks/csm/useCsmSante'
import { useCsmKpisTrimestriels } from '@/hooks/csm/useCsmKpisTrimestriels'
import { useCsmKpisMensuels } from '@/hooks/csm/useCsmKpisMensuels'
import { useCsmFacturation } from '@/hooks/csm/useCsmFacturation'
import { useLastEmailByEtablissement } from '@/hooks/email/useLastEmailByEtablissement'
import { useProductionStats } from '@/hooks/production/useProductionStats'
import {
  useProductionFilters,
  type ProductionFilters,
  type ProductionSortConfig,
} from '@/hooks/production/useProductionFilters'
import { ProductionHeroMetrics } from '@/components/production/ProductionHeroMetrics'
import { ProductionBillingAlerts } from '@/components/production/ProductionBillingAlerts'
import { type ProductionView } from '@/components/production/ProductionViewSelector'
import { EnrichedProductionCard } from '@/components/production/EnrichedProductionCard'
import { ProductionListView } from '@/components/production/ProductionListView'
import { ProductionAnalyticsView } from '@/components/production/ProductionAnalyticsView'
import { ProductionTimelineView } from '@/components/production/ProductionTimelineView'
import { ProductionCohortsView } from '@/components/production/ProductionCohortsView'
import { ProductionMobileHeader } from '@/components/production/ProductionMobileHeader'
import { ProductionViewSelectorCompact } from '@/components/production/ProductionViewSelectorCompact'
import { exportProductionToCSV } from '@/lib/productionUtils'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { CRMBulkActionsBar } from '@/components/layout/CRMBulkActionsBar'
import { CRMEmptyState } from '@/components/layout/CRMEmptyState'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { GlassmorphismUnderlineTabs } from '@/components/ui/glassmorphism-underline-tabs'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useUserPreferences } from '@/hooks/profile/useUserPreferences'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { PhaseNavTabs } from '@/components/layout/PhaseNavTabs'
import { usePhaseCounts } from '@/hooks/analytics/usePhaseCounts'
import { PageDataState } from '@/components/common/PageDataState'

// Lazy load CSM views
const CsmComptesView = lazy(() =>
  import('@/components/csm/CsmComptesView').then((m) => ({ default: m.CsmComptesView }))
)
const CsmContactsView = lazy(() =>
  import('@/components/csm/CsmContactsView').then((m) => ({ default: m.CsmContactsView }))
)
const CsmParcoursView = lazy(() =>
  import('@/components/csm/CsmParcoursView').then((m) => ({ default: m.CsmParcoursView }))
)
const CsmFacturationView = lazy(() =>
  import('@/components/csm/CsmFacturationView').then((m) => ({ default: m.CsmFacturationView }))
)
const CsmUtilisationView = lazy(() =>
  import('@/components/csm/CsmUtilisationView').then((m) => ({ default: m.CsmUtilisationView }))
)
const CsmKpisView = lazy(() =>
  import('@/components/csm/CsmKpisView').then((m) => ({ default: m.CsmKpisView }))
)

const CSM_TABS = [
  { value: 'production', label: 'Production', icon: Factory },
  { value: 'comptes', label: 'Comptes', icon: Building2 },
  { value: 'contacts', label: 'Contacts', icon: Users },
  { value: 'parcours', label: 'Parcours', icon: Route },
  { value: 'facturation', label: 'Facturation', icon: Receipt },
  { value: 'utilisation', label: 'Utilisation', icon: Activity },
  { value: 'kpis', label: 'KPIs', icon: LineChart },
] as const

type MainTab = (typeof CSM_TABS)[number]['value']

const CsmFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
)

function ProductionContent() {
  const queryClient = useQueryClient()
  const { data: etablissements, isLoading, isError, refetch } = useProduction()
  const { data: phaseCounts } = usePhaseCounts()
  const { getPreference, updatePreference } = useUserPreferences()
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const isMobile = useIsMobile()

  const [mainTab, setMainTab] = useState<MainTab>('production')
  const [currentView, setCurrentView] = useState<ProductionView>(
    (getPreference('production_view', 'grid') as ProductionView) || 'grid'
  )
  const [showKPIs, setShowKPIs] = useState(
    () => localStorage.getItem('production-show-kpis') !== 'false'
  )
  const [filters, setFilters] = useState<ProductionFilters>({
    search: '',
    regions: [],
    types: [],
    healthStatuses: [],
    csmIds: [],
    durationRanges: [],
    adoptionRanges: [],
    npsRanges: [],
    supportLevels: [],
    renewalPeriods: [],
  })
  const [sortConfig, setSortConfig] = useState<ProductionSortConfig>({
    field: 'nom',
    direction: 'asc',
  })
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    localStorage.setItem('production-show-kpis', String(showKPIs))
  }, [showKPIs])

  const handleViewChange = (view: ProductionView) => {
    setCurrentView(view)
    updatePreference('production_view', view)
  }

  const etablissementIds = useMemo(() => etablissements?.map((e) => e.id) || [], [etablissements])

  const { data: healthMetrics, isLoading: isHealthLoading } = useBulkHealthMetrics(etablissementIds)
  const { data: santeDonnees } = useCsmSante()
  const { data: allKpisTrimestriels } = useCsmKpisTrimestriels()
  const { data: allKpisMensuels } = useCsmKpisMensuels()
  const { data: allFacturations } = useCsmFacturation()
  const { data: lastEmailMap } = useLastEmailByEtablissement(etablissementIds)

  const deploymentDateMap = useMemo(() => {
    const map = new Map<string, string | null>()
    allFacturations.forEach((f: any) => {
      if (f.date_deploiement) map.set(f.etablissement_id, f.date_deploiement)
    })
    return map
  }, [allFacturations])

  const billingEndDateMap = useMemo(() => {
    const map = new Map<string, string | null>()
    allFacturations.forEach((f: any) => {
      if (f.date_fin_periode) map.set(f.etablissement_id, f.date_fin_periode)
    })
    return map
  }, [allFacturations])

  // Enrichir santeMap avec les taux calculés depuis les KPIs mensuels les plus récents
  const santeMap = useMemo(() => {
    const map = new Map<string, (typeof santeDonnees)[0]>()
    santeDonnees.forEach((s) => map.set(s.etablissement_id, { ...s }))

    // Grouper les KPIs mensuels par établissement
    const grouped = new Map<string, typeof allKpisMensuels>()
    allKpisMensuels.forEach((k) => {
      const arr = grouped.get(k.etablissement_id) || []
      arr.push(k)
      grouped.set(k.etablissement_id, arr)
    })

    grouped.forEach((kpis, etabId) => {
      const existing = map.get(etabId) || ({ etablissement_id: etabId } as any)

      // Taux d'utilisation depuis la dernière période complétée
      const completedUtil = kpis.filter(
        (k) => k.passages_total && k.passages_total > 0 && k.dossiers_traites != null
      )
      if (completedUtil.length > 0) {
        const latest = completedUtil.reduce((a, b) =>
          (a.sort_order ?? 0) < (b.sort_order ?? 0) ? a : b
        )
        existing.taux_utilisation = Math.round(
          ((latest.dossiers_traites || 0) / latest.passages_total!) * 100
        )
      }

      // Taux UHCD Backend depuis la dernière période renseignée
      const completedUhcd = kpis.filter((k) => k.taux_uhcd_backend != null)
      if (completedUhcd.length > 0) {
        const latest = completedUhcd.reduce((a, b) =>
          (a.sort_order ?? 0) < (b.sort_order ?? 0) ? a : b
        )
        existing.taux_uhcd = latest.taux_uhcd_backend
      }

      map.set(etabId, existing)
    })

    return map
  }, [santeDonnees, allKpisMensuels])

  const satisfactionMap = useMemo(() => {
    const map = new Map<string, number | null>()
    const grouped = new Map<string, typeof allKpisTrimestriels>()
    allKpisTrimestriels.forEach((k) => {
      const arr = grouped.get(k.etablissement_id) || []
      arr.push(k)
      grouped.set(k.etablissement_id, arr)
    })
    grouped.forEach((kpis, etabId) => {
      const sorted = [...kpis].sort((a, b) => b.sort_order - a.sort_order)
      map.set(etabId, sorted[0]?.taux_satisfaction ?? null)
    })
    return map
  }, [allKpisTrimestriels])

  const healthScores = useCustomerHealth(etablissements || [], healthMetrics || new Map())
  const stats = useProductionStats(etablissements || [], healthScores, healthMetrics || new Map())

  const standardFiltered = useProductionFilters(
    etablissements || [],
    filters,
    sortConfig,
    healthScores,
    healthMetrics || new Map()
  )

  const filteredEtablissements = useMemo(() => {
    if (!showIncompleteOnly) return standardFiltered
    return standardFiltered.filter((etab) => {
      const metrics = healthMetrics?.get(etab.id)
      return (
        !metrics ||
        metrics.nps_score === null ||
        metrics.contract_value === null ||
        metrics.contract_value === 0 ||
        metrics.adoption_rate === 0
      )
    })
  }, [standardFiltered, showIncompleteOnly, healthMetrics])

  const handleFiltersChange = (newFilters: Partial<ProductionFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }

  const handleHealthFilter = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      healthStatuses: [status as any],
    }))
  }

  const handleSelectionChange = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => (selected ? [...prev, id] : prev.filter((i) => i !== id)))
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])

  const handleExportAll = () => {
    const exportData = filteredEtablissements.map((etablissement) => ({
      etablissement,
      health: healthScores.get(etablissement.id),
      healthMetrics: healthMetrics?.get(etablissement.id),
    }))
    exportProductionToCSV(exportData, 'production-complet')
    toast.success(`${filteredEtablissements.length} établissement(s) exporté(s)`)
  }

  if (isLoading || isError) {
    return (
      <PageDataState isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <></>
      </PageDataState>
    )
  }
  // Note: isHealthLoading is intentionally not blocking — grid renders progressively
  // as enrichment hooks (health, CSM, last email) finish in background.

  const headerActions = (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowKPIs(!showKPIs)}
        className={cn(
          'h-9 px-3 gap-1.5 rounded-lg backdrop-blur-sm transition-all',
          showKPIs
            ? 'bg-card text-primary shadow-md'
            : 'bg-card/10 text-white hover:bg-card/20 border-white/20'
        )}
      >
        <BarChart3 className="h-4 w-4" />
        <span className="hidden sm:inline text-xs font-medium">KPIs</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', showKPIs && 'rotate-180')} />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 gap-1.5 bg-card/10 border-white/20 text-white hover:bg-card/20 backdrop-blur-sm rounded-lg"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-medium">Export</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExportAll}>
            Exporter CSV ({filteredEtablissements.length})
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const mobileToolbar = (
    <div className="flex items-center gap-1.5 w-full flex-nowrap">
      <PhaseNavTabs activePhase="production" counts={phaseCounts} compact />
      <div className="h-4 w-px bg-card/20 shrink-0" />
      <ProductionViewSelectorCompact currentView={currentView} onViewChange={handleViewChange} />
      <div className="h-4 w-px bg-card/20 shrink-0" />
      <div className="flex items-center gap-2 px-2 py-1 bg-card/10 backdrop-blur-sm border border-white/20 rounded-lg">
        <Switch
          id="incomplete-filter-mobile"
          checked={showIncompleteOnly}
          onCheckedChange={setShowIncompleteOnly}
          className="scale-75"
        />
        <Label
          htmlFor="incomplete-filter-mobile"
          className="cursor-pointer text-[10px] text-white/80 whitespace-nowrap"
        >
          Incomplet
        </Label>
      </div>
    </div>
  )

  const renderProductionView = () => (
    <>
      <Collapsible open={showKPIs} onOpenChange={setShowKPIs}>
        <CollapsibleContent>
          <ProductionHeroMetrics
            stats={stats}
            onHealthFilter={handleHealthFilter}
            santeMap={santeMap}
            etablissements={etablissements}
          />
        </CollapsibleContent>
      </Collapsible>

      <ProductionBillingAlerts />

      {filteredEtablissements.length === 0 && (
        <CRMEmptyState
          icon={Factory}
          title="Aucun établissement en production"
          description="Essayez de modifier vos filtres de recherche"
          hasFilters={
            filters.regions.length > 0 ||
            filters.types.length > 0 ||
            filters.healthStatuses.length > 0
          }
          onResetFilters={() =>
            setFilters({
              search: '',
              regions: [],
              types: [],
              healthStatuses: [],
              csmIds: [],
              durationRanges: [],
              adoptionRanges: [],
              npsRanges: [],
              supportLevels: [],
              renewalPeriods: [],
            })
          }
        />
      )}

      {selectedIds.length > 0 && (
        <CRMBulkActionsBar
          selectedCount={selectedIds.length}
          onClearSelection={handleClearSelection}
          actions={[
            {
              id: 'export',
              label: 'Exporter',
              icon: <Download className="h-4 w-4" />,
              onClick: handleExportAll,
            },
          ]}
        />
      )}

      {currentView === 'grid' && filteredEtablissements.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredEtablissements.map((etablissement) => (
            <EnrichedProductionCard
              key={etablissement.id}
              etablissement={etablissement}
              health={healthScores.get(etablissement.id)}
              healthMetrics={healthMetrics?.get(etablissement.id)}
              santeData={santeMap.get(etablissement.id)}
              satisfaction={satisfactionMap.get(etablissement.id) ?? null}
              deploymentDate={deploymentDateMap.get(etablissement.id) ?? null}
              billingEndDate={billingEndDateMap.get(etablissement.id) ?? null}
              lastEmail={lastEmailMap?.get(etablissement.id)}
              isSelected={selectedIds.includes(etablissement.id)}
              onSelectionChange={handleSelectionChange}
            />
          ))}
        </div>
      )}

      {currentView === 'list' && filteredEtablissements.length > 0 && (
        <ProductionListView
          etablissements={filteredEtablissements}
          healthScores={healthScores}
          healthMetrics={healthMetrics || new Map()}
        />
      )}

      {currentView === 'analytics' && (
        <ProductionAnalyticsView
          stats={stats}
          etablissements={filteredEtablissements}
          healthMetrics={healthMetrics}
        />
      )}

      {currentView === 'timeline' && (
        <ProductionTimelineView
          etablissements={filteredEtablissements}
          healthScores={healthScores}
        />
      )}

      {currentView === 'cohorts' && (
        <ProductionCohortsView
          etablissements={filteredEtablissements}
          healthScores={healthScores}
          healthMetrics={healthMetrics || new Map()}
        />
      )}
    </>
  )

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[hsl(var(--primary)/0.05)] via-background to-[hsl(var(--primary)/0.03)]">
      {isMobile ? (
        <ProductionMobileHeader
          stats={{
            totalClients: stats.totalClients,
            mrr: `${Math.round(stats.totalRevenue / 12 / 1000)}k€`,
            healthScore: `${stats.averageHealthScore}`,
          }}
          showKPIs={showKPIs}
          onToggleKPIs={() => setShowKPIs(!showKPIs)}
          onSearchClick={() => setShowGlobalSearch(true)}
          toolbar={mobileToolbar}
          headerActions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 bg-card/10 border-white/20 text-white hover:bg-card/20 backdrop-blur-sm rounded-lg"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card">
                <DropdownMenuItem onClick={handleExportAll}>
                  Exporter CSV ({filteredEtablissements.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      ) : (
        <ImmersivePageHeader
          title="Production & CSM"
          subtitle="Tableau de bord Customer Success"
          icon={Factory}
          stats={[
            { label: 'clients', value: stats.totalClients, highlight: true },
            { label: 'MRR', value: `${Math.round(stats.totalRevenue / 12 / 1000)}k€` },
            { label: 'santé', value: `${stats.averageHealthScore}%` },
          ]}
          searchPlaceholder="Rechercher un établissement..."
          onSearchClick={() => setShowGlobalSearch(true)}
          actions={headerActions}
        >
          {/* Phase navigation */}
          <PhaseNavTabs activePhase="production" counts={phaseCounts} />
          {mainTab === 'production' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-card/10 backdrop-blur-sm border border-white/20 rounded-lg">
                <Switch
                  id="incomplete-filter"
                  checked={showIncompleteOnly}
                  onCheckedChange={setShowIncompleteOnly}
                  className="scale-75"
                />
                <Label htmlFor="incomplete-filter" className="cursor-pointer text-xs text-white/80">
                  Données incomplètes
                </Label>
              </div>
              <GlassmorphismUnderlineTabs
                value={currentView}
                onValueChange={(v) => handleViewChange(v as ProductionView)}
                tabs={[
                  { value: 'grid', label: 'Grille' },
                  { value: 'list', label: 'Liste' },
                  { value: 'analytics', label: 'Analytique', shortLabel: 'Anal.' },
                  { value: 'timeline', label: 'Chronologie', shortLabel: 'Chrono' },
                  { value: 'cohorts', label: 'Cohortes' },
                ]}
              />
            </div>
          )}
        </ImmersivePageHeader>
      )}

      <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />

      <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-4">
        {/* CSM Tabs */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {CSM_TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-1.5 text-xs px-3 py-1.5"
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          <TabsContent value="production" className="mt-4 space-y-4">
            {renderProductionView()}
          </TabsContent>

          <TabsContent value="comptes" className="mt-4">
            <Suspense fallback={<CsmFallback />}>
              <CsmComptesView />
            </Suspense>
          </TabsContent>

          <TabsContent value="contacts" className="mt-4">
            <Suspense fallback={<CsmFallback />}>
              <CsmContactsView />
            </Suspense>
          </TabsContent>

          <TabsContent value="parcours" className="mt-4">
            <Suspense fallback={<CsmFallback />}>
              <CsmParcoursView />
            </Suspense>
          </TabsContent>

          <TabsContent value="facturation" className="mt-4">
            <Suspense fallback={<CsmFallback />}>
              <CsmFacturationView />
            </Suspense>
          </TabsContent>

          <TabsContent value="utilisation" className="mt-4">
            <Suspense fallback={<CsmFallback />}>
              <CsmUtilisationView />
            </Suspense>
          </TabsContent>

          <TabsContent value="kpis" className="mt-4">
            <Suspense fallback={<CsmFallback />}>
              <CsmKpisView />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function Production() {
  return (
    <React.Suspense
      fallback={
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ProductionContent />
    </React.Suspense>
  )
}
