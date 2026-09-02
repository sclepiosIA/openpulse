import React, { useState, useMemo, useEffect } from 'react'
import {
  Loader2,
  Building2,
  Download,
  Rocket,
  MapPin,
  Users,
  Activity,
  Tag,
  BarChart3,
  ChevronDown,
} from 'lucide-react'
import { useDeploiement } from '@/hooks/production/useProduction'
import { Button } from '@/components/ui/button'
import { DeploymentHeroMetrics } from '@/components/deploiement/DeploymentHeroMetrics'
import { type DeploymentView } from '@/components/deploiement/DeploymentViewSelector'
import { DeploymentListView } from '@/components/deploiement/DeploymentListView'
import { DeploymentTimelineView } from '@/components/deploiement/DeploymentTimelineView'
import { DeploymentGanttView } from '@/components/deploiement/DeploymentGanttView'
import {
  useDeploymentFilters,
  type DeploymentFilters,
  type SortField,
  type SortDirection,
} from '@/hooks/production/useDeploymentFilters'
import { useDeploymentHealth } from '@/hooks/production/useDeploymentHealth'
import { exportToCSV, DEPLOYMENT_PHASES, HEALTH_OPTIONS } from '@/lib/deploymentUtils'
import { useToast } from '@/hooks/shared/use-toast'
import { useActiveProfiles } from '@/hooks/profile/useProfiles'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import {
  CRMFiltersBar,
  type FilterConfig,
  type SortOption,
} from '@/components/layout/CRMFiltersBar'
import { CRMEmptyState } from '@/components/layout/CRMEmptyState'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { GlassmorphismUnderlineTabs } from '@/components/ui/glassmorphism-underline-tabs'
import { cn } from '@/lib/utils'
import { useUserPreferences } from '@/hooks/profile/useUserPreferences'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { DeploymentMobileHeader } from '@/components/deploiement/DeploymentMobileHeader'
import { DeploymentFiltersCompact } from '@/components/deploiement/DeploymentFiltersCompact'
import { DeploymentViewSelectorCompact } from '@/components/deploiement/DeploymentViewSelectorCompact'
import { DeploymentSortMenuCompact } from '@/components/deploiement/DeploymentSortMenuCompact'
import { PhaseNavTabs } from '@/components/layout/PhaseNavTabs'
import { usePhaseCounts } from '@/hooks/analytics/usePhaseCounts'
import { PageDataState } from '@/components/shared/PageDataState'

function DeploiementContent() {
  const { data: etablissements, isLoading, isError, refetch } = useDeploiement()
  const { data: phaseCounts } = usePhaseCounts()
  const { toast } = useToast()
  const { getPreference, updatePreference } = useUserPreferences()
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const isMobile = useIsMobile()

  const [showKPIs, setShowKPIs] = useState(
    () => localStorage.getItem('deploiement-show-kpis') !== 'false'
  )

  const [filters, setFilters] = useState<DeploymentFilters>({
    searchTerm: '',
    regions: [],
    types: [],
    statuts: [],
    healthStatuses: [],
    teamMembers: [],
  })

  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'nom',
    direction: 'asc',
  })

  const [currentView, setCurrentView] = useState<DeploymentView>(
    (getPreference('deploiement_view', 'list') as DeploymentView) || 'list'
  )

  useEffect(() => {
    localStorage.setItem('deploiement-show-kpis', String(showKPIs))
  }, [showKPIs])

  // Sauvegarder la vue en BDD quand elle change
  const handleViewChange = (view: DeploymentView) => {
    setCurrentView(view)
    updatePreference('deploiement_view', view)
  }

  const healthScores = useDeploymentHealth(etablissements || [])

  const filteredEtablissements = useDeploymentFilters(
    etablissements || [],
    filters,
    sortConfig,
    healthScores
  )

  const { data: profiles } = useActiveProfiles()

  // Stats pour le header
  const healthyCount = useMemo(() => {
    return filteredEtablissements.filter((e) => {
      const health = healthScores.get(e.id)
      return health?.status === 'healthy'
    }).length
  }, [filteredEtablissements, healthScores])

  const avgProgression = useMemo(() => {
    if (!filteredEtablissements.length) return 0
    const sum = filteredEtablissements.reduce((acc, e) => acc + (e.progression || 0), 0)
    return Math.round(sum / filteredEtablissements.length)
  }, [filteredEtablissements])

  const uniqueRegions = useMemo(() => {
    if (!etablissements) return []
    return Array.from(new Set(etablissements.map((e) => e.region)))
      .filter(Boolean)
      .sort()
  }, [etablissements])

  const uniqueTypes = useMemo(() => {
    if (!etablissements) return []
    return Array.from(new Set(etablissements.map((e) => e.type)))
      .filter(Boolean)
      .sort()
  }, [etablissements])

  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        key: 'regions',
        label: 'Région',
        icon: MapPin,
        options: uniqueRegions.map((r) => ({ value: r, label: r })),
      },
      {
        key: 'types',
        label: 'Type',
        icon: Building2,
        options: uniqueTypes.map((t) => ({ value: t, label: t })),
      },
      {
        key: 'statuts',
        label: 'Statut',
        icon: Tag,
        options: DEPLOYMENT_PHASES.map((s) => ({ value: s, label: s })),
      },
      {
        key: 'healthStatuses',
        label: 'Santé',
        icon: Activity,
        options: HEALTH_OPTIONS.map((h) => ({ value: h.value, label: h.label })),
      },
      {
        key: 'teamMembers',
        label: 'Équipe',
        icon: Users,
        options: (profiles || []).map((p) => ({ value: p.id, label: `${p.prenom} ${p.nom}` })),
      },
    ],
    [uniqueRegions, uniqueTypes, profiles]
  )

  const sortOptions: SortOption[] = [
    { value: 'nom-asc', label: 'Nom (A-Z)' },
    { value: 'nom-desc', label: 'Nom (Z-A)' },
    { value: 'date_signature-desc', label: 'Date signature ↓' },
    { value: 'date_signature-asc', label: 'Date signature ↑' },
    { value: 'progression-desc', label: 'Progression ↓' },
    { value: 'progression-asc', label: 'Progression ↑' },
    { value: 'urgence-desc', label: 'Urgence ↓' },
  ]

  const handlePhaseClick = (statut: string) => {
    setFilters((prev) => ({
      ...prev,
      statuts: prev.statuts.includes(statut)
        ? prev.statuts.filter((s) => s !== statut)
        : [...prev.statuts, statut],
    }))
  }

  const handleFiltersChange = (newFilters: Record<string, string[]>) => {
    setFilters((prev) => ({
      ...prev,
      regions: newFilters.regions || [],
      types: newFilters.types || [],
      statuts: newFilters.statuts || [],
      healthStatuses: (newFilters.healthStatuses as any[]) || [],
      teamMembers: newFilters.teamMembers || [],
    }))
  }

  const handleSortChange = (value: string) => {
    const [field, direction] = value.split('-') as [SortField, SortDirection]
    setSortConfig({ field, direction })
  }

  const handleExportAll = () => {
    const columns = [
      { key: 'nom' as const, label: 'Nom' },
      { key: 'type' as const, label: 'Type' },
      { key: 'region' as const, label: 'Région' },
      { key: 'statut' as const, label: 'Statut' },
      { key: 'progression' as const, label: 'Progression (%)' },
      { key: 'date_signature' as const, label: 'Date signature' },
      { key: 'csm_name' as const, label: 'CSM' },
      { key: 'cp_name' as const, label: 'Chef de projet' },
    ]

    const exportData = filteredEtablissements.map((e) => ({
      nom: e.nom,
      type: e.type,
      region: e.region,
      statut: e.statut,
      progression: e.progression || 0,
      date_signature: e.date_signature
        ? new Date(e.date_signature).toLocaleDateString('fr-FR')
        : '',
      csm_name: e.csm ? `${e.csm.prenom} ${e.csm.nom}` : '',
      cp_name: e.chef_projet ? `${e.chef_projet.prenom} ${e.chef_projet.nom}` : '',
    }))

    exportToCSV(exportData, columns, 'deploiement')

    toast({
      title: 'Export réussi',
      description: `${filteredEtablissements.length} établissement(s) exporté(s)`,
    })
  }

  if (isError || isLoading) {
    return (
      <div className="p-6">
        <PageDataState
          isLoading={isLoading}
          isError={isError}
          loadingLabel="Chargement du déploiement..."
          onRetry={() => refetch()}
        >
          {null}
        </PageDataState>
      </div>
    )
  }

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
          <DropdownMenuItem onClick={handleExportAll}>Exporter CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  // Mobile toolbar
  const mobileToolbar = (
    <div className="flex items-center gap-1.5 w-full flex-nowrap">
      <PhaseNavTabs activePhase="deploiement" counts={phaseCounts} compact />
      <div className="h-4 w-px bg-card/20 shrink-0" />
      {/* View Selector Compact */}
      <DeploymentViewSelectorCompact currentView={currentView} onViewChange={handleViewChange} />

      {/* Separator */}
      <div className="h-4 w-px bg-card/20 shrink-0" />

      {/* Filters Compact */}
      <DeploymentFiltersCompact
        filters={{
          regions: filters.regions,
          types: filters.types,
          statuts: filters.statuts,
          healthStatuses: filters.healthStatuses,
          teamMembers: filters.teamMembers,
        }}
        onFiltersChange={handleFiltersChange}
        filterConfigs={filterConfigs}
      />

      {/* Sort Compact */}
      <DeploymentSortMenuCompact
        sortValue={`${sortConfig.field}-${sortConfig.direction}`}
        onSortChange={handleSortChange}
        sortOptions={sortOptions}
      />
    </div>
  )

  // Mobile header actions
  const mobileHeaderActions = (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowKPIs(!showKPIs)}
        className={cn(
          'h-8 w-8 p-0 rounded-lg backdrop-blur-sm',
          showKPIs
            ? 'bg-card text-primary shadow-md'
            : 'bg-card/10 text-white/80 border border-white/20 hover:bg-card/20'
        )}
      >
        <BarChart3 className="h-3.5 w-3.5" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 bg-card/10 border border-white/20 text-white/80 hover:bg-card/20 backdrop-blur-sm rounded-lg"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card">
          <DropdownMenuItem onClick={handleExportAll}>Exporter CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <div className="min-h-dvh bg-gradient-page">
      {isMobile ? (
        <DeploymentMobileHeader
          searchValue={filters.searchTerm}
          onSearchChange={(v) => setFilters((prev) => ({ ...prev, searchTerm: v }))}
          stats={{
            displayed: filteredEtablissements.length,
            total: etablissements?.length || 0,
            healthy: healthyCount,
            avgProgress: avgProgression,
          }}
          toolbar={mobileToolbar}
          headerActions={mobileHeaderActions}
          showGlobalNav={true}
        />
      ) : (
        <ImmersivePageHeader
          title="Déploiement"
          subtitle={`${filteredEtablissements.length} établissement(s) en cours`}
          icon={Rocket}
          stats={[
            { label: 'en cours', value: filteredEtablissements.length, highlight: true },
            { label: 'santé OK', value: healthyCount },
            { label: '% moyen', value: `${avgProgression}%` },
          ]}
          searchPlaceholder="Rechercher un établissement..."
          onSearchClick={() => setShowGlobalSearch(true)}
          actions={headerActions}
        >
          {/* Phase navigation */}
          <PhaseNavTabs activePhase="deploiement" counts={phaseCounts} />
          {/* View Selector underline style */}
          <GlassmorphismUnderlineTabs
            value={currentView}
            onValueChange={(v) => handleViewChange(v as DeploymentView)}
            tabs={[
              { value: 'list', label: 'Liste' },
              { value: 'timeline', label: 'Chronologie', shortLabel: 'Chrono' },
              { value: 'gantt', label: 'Gantt' },
            ]}
          />
        </ImmersivePageHeader>
      )}

      <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />

      <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-4">
        {/* KPIs collapsibles - always show toggle on mobile via header */}
        <Collapsible open={showKPIs} onOpenChange={setShowKPIs}>
          <CollapsibleContent>
            <DeploymentHeroMetrics
              etablissements={etablissements || []}
              healthScores={healthScores}
              onPhaseClick={handlePhaseClick}
              activePhases={filters.statuts}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Filtres et tri unifiés - masqués sur mobile */}
        {!isMobile && (
          <CRMFiltersBar
            searchValue={filters.searchTerm}
            onSearchChange={(value) => setFilters((prev) => ({ ...prev, searchTerm: value }))}
            searchPlaceholder="Rechercher un établissement..."
            filters={{
              regions: filters.regions,
              types: filters.types,
              statuts: filters.statuts,
              healthStatuses: filters.healthStatuses,
              teamMembers: filters.teamMembers,
            }}
            filterConfigs={filterConfigs}
            onFiltersChange={handleFiltersChange}
            sortValue={`${sortConfig.field}-${sortConfig.direction}`}
            sortOptions={sortOptions}
            onSortChange={handleSortChange}
          />
        )}

        {/* Contenu selon la vue */}
        {currentView === 'list' && (
          <DeploymentListView etablissements={filteredEtablissements} healthScores={healthScores} />
        )}

        {currentView === 'timeline' && (
          <DeploymentTimelineView
            etablissements={filteredEtablissements}
            healthScores={healthScores}
          />
        )}

        {currentView === 'gantt' && <DeploymentGanttView etablissements={filteredEtablissements} />}

        {/* Empty state */}
        {filteredEtablissements.length === 0 && (
          <CRMEmptyState
            icon={Rocket}
            title="Aucun établissement en déploiement"
            description="Ajustez les filtres pour voir plus de résultats"
            hasFilters={
              filters.regions.length > 0 || filters.types.length > 0 || filters.statuts.length > 0
            }
            onResetFilters={() =>
              setFilters({
                searchTerm: '',
                regions: [],
                types: [],
                statuts: [],
                healthStatuses: [],
                teamMembers: [],
              })
            }
          />
        )}
      </div>
    </div>
  )
}

import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function Deploiement() {
  return (
    <ErrorBoundary>
      <React.Suspense
        fallback={
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        }
      >
        <DeploiementContent />
      </React.Suspense>
    </ErrorBoundary>
  )
}
