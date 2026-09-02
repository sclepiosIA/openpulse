import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useDebounce } from '@/hooks/shared/useDebounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Target, Plus, Search, Download, BarChart3, ChevronDown } from 'lucide-react'
import { useProspects, useProspectStats, useAllEtablissements } from '@/hooks/crm/useProspects'
import {
  useDeleteEtablissement,
  useUpdateEtablissement,
  type Etablissement,
} from '@/hooks/crm/useEtablissements'
import { useToast } from '@/hooks/shared/use-toast'
import { useUserPreferences } from '@/hooks/profile/useUserPreferences'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { EtablissementCreateForm } from '@/components/etablissement/EtablissementCreateForm'
import { EtablissementEditForm } from '@/components/etablissement/EtablissementEditForm'
import { ProspectStatsDashboard } from '@/components/pipeline/ProspectStatsDashboard'
import { PipelineMaturiteCard } from '@/components/prospects/PipelineMaturiteCard'
import { BlockedEtablissementsSection } from '@/components/etablissement/BlockedEtablissementsSection'
import { CRMEmptyState } from '@/components/layout/CRMEmptyState'
import { PageDataState } from '@/components/common/PageDataState'
import {
  ProspectsViewSelector,
  type ProspectView,
} from '@/components/prospects/ProspectsViewSelector'
import {
  ProspectsSortMenu,
  type ProspectSortConfig,
} from '@/components/prospects/ProspectsSortMenu'
import {
  ProspectsSmartFilters,
  type ProspectSmartFilter,
} from '@/components/prospects/ProspectsSmartFilters'
import {
  ProspectsFiltersBar,
  type ProspectFilters,
} from '@/components/prospects/ProspectsFiltersBar'
import { BulkActionsBarProspects } from '@/components/prospects/BulkActionsBarProspects'
import { ProspectsGridView } from '@/components/prospects/ProspectsGridView'
import { ProspectsListView } from '@/components/prospects/ProspectsListView'
import { ProspectsTableView } from '@/components/prospects/ProspectsTableView'
import { ProspectsKanbanView } from '@/components/prospects/ProspectsKanbanView'
import { ProspectsMobileHeader } from '@/components/prospects/ProspectsMobileHeader'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import Papa from 'papaparse'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { PhaseNavTabs } from '@/components/layout/PhaseNavTabs'
import { countByPhase } from '@/lib/phaseUtils'

function ProspectsContent() {
  const { toast } = useToast()
  const { getPreference, updatePreference } = useUserPreferences()
  const isMobile = useIsMobile()
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState<Etablissement | null>(null)
  const [currentView, setCurrentView] = useState<ProspectView>(
    (getPreference('prospects_view', 'table') as ProspectView) || 'table'
  )
  const [sortConfig, setSortConfig] = useState<ProspectSortConfig>({
    field: 'nom',
    direction: 'asc',
  })
  const [smartFilter, setSmartFilter] = useState<ProspectSmartFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showStats, setShowStats] = useState(
    () => localStorage.getItem('prospects-show-stats') !== 'false'
  )
  const [filters, setFilters] = useState<ProspectFilters>({
    search: '',
    regions: [],
    types: [],
    statuts: [],
    commercialIds: [],
    progressionRange: [0, 100],
  })

  const { data: prospects, isLoading, isError, refetch } = useProspects()
  const { data: allEtablissements } = useAllEtablissements()
  const { data: stats } = useProspectStats()
  const deleteEtablissement = useDeleteEtablissement()
  const updateEtablissement = useUpdateEtablissement()

  const handleBulkChangeStatus = async (status: string) => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    let ok = 0,
      fail = 0
    await Promise.all(
      ids.map((id) =>
        updateEtablissement
          .mutateAsync({ id, data: { statut: status } as never })
          .then(() => {
            ok++
          })
          .catch(() => {
            fail++
          })
      )
    )
    toast({
      title: fail === 0 ? 'Statut mis à jour' : 'Mise à jour partielle',
      description: `${ok} prospect(s) mis à jour${fail ? `, ${fail} échec(s)` : ''}`,
      variant: fail === 0 ? 'default' : 'destructive',
    })
    setSelectedIds(new Set())
  }

  const phaseCounts = useMemo(() => {
    if (!allEtablissements) return undefined
    return {
      commercial: countByPhase(allEtablissements, 'commercial'),
      deploiement: countByPhase(allEtablissements, 'deploiement'),
      production: countByPhase(allEtablissements, 'production'),
    }
  }, [allEtablissements])

  // Sauvegarder la vue en BDD quand elle change
  const handleViewChange = (view: ProspectView) => {
    setCurrentView(view)
    updatePreference('prospects_view', view)
  }

  const getProgressInfo = useCallback(
    (prospectId: string) => {
      if (!stats) return { progress: 0, totalTasks: 0, completedTasks: 0, potentialValue: 0 }
      const prospectStats = stats.prospectsPipelineProgress.find((p) => p.id === prospectId)
      return prospectStats || { progress: 0, totalTasks: 0, completedTasks: 0, potentialValue: 0 }
    },
    [stats]
  )

  // Données de filtres disponibles
  const availableRegions = useMemo(
    () => [...new Set(prospects?.map((p) => p.region) || [])].sort(),
    [prospects]
  )
  const availableTypes = useMemo(
    () => [...new Set(prospects?.map((p) => p.type) || [])].sort(),
    [prospects]
  )
  const availableStatuts = useMemo(
    () => [...new Set(prospects?.map((p) => p.statut) || [])].sort(),
    [prospects]
  )
  const availableCommercials = useMemo(() => {
    const map = new Map()
    prospects?.forEach((p) => {
      if (p.commercial_id && p.commercial) {
        map.set(p.commercial_id, {
          id: p.commercial_id,
          name: `${p.commercial.prenom} ${p.commercial.nom}`,
        })
      }
    })
    return Array.from(map.values())
  }, [prospects])

  // Filtrage et tri
  const debouncedSearchQ = useDebounce(filters.search, 150)
  const filteredProspects = useMemo(() => {
    if (!prospects) return []

    let filtered = [...prospects]
    const now = new Date()

    // Recherche (debounced)
    if (debouncedSearchQ) {
      const search = debouncedSearchQ.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.nom.toLowerCase().includes(search) ||
          p.ville.toLowerCase().includes(search) ||
          p.region.toLowerCase().includes(search)
      )
    }

    // Filtres avancés
    if (filters.regions.length > 0) {
      filtered = filtered.filter((p) => filters.regions.includes(p.region))
    }
    if (filters.types.length > 0) {
      filtered = filtered.filter((p) => filters.types.includes(p.type))
    }
    if (filters.statuts.length > 0) {
      filtered = filtered.filter((p) => filters.statuts.includes(p.statut))
    }
    if (filters.commercialIds.length > 0) {
      filtered = filtered.filter(
        (p) => p.commercial_id && filters.commercialIds.includes(p.commercial_id)
      )
    }

    // Smart filters
    if (smartFilter === 'hot') {
      filtered = filtered.filter((p) => getProgressInfo(p.id).progress > 50)
    } else if (smartFilter === 'recent') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      filtered = filtered.filter((p) => new Date(p.created_at) >= weekAgo)
    } else if (smartFilter === 'high_value') {
      filtered = filtered.filter((p) => (getProgressInfo(p.id).potentialValue || 0) > 50000)
    }

    // Tri
    filtered.sort((a, b) => {
      let aVal: any, bVal: any
      switch (sortConfig.field) {
        case 'nom':
          aVal = a.nom.toLowerCase()
          bVal = b.nom.toLowerCase()
          break
        case 'date_creation':
          aVal = new Date(a.created_at).getTime()
          bVal = new Date(b.created_at).getTime()
          break
        case 'progression':
          aVal = getProgressInfo(a.id).progress
          bVal = getProgressInfo(b.id).progress
          break
        case 'ca_potentiel':
          aVal = getProgressInfo(a.id).potentialValue || 0
          bVal = getProgressInfo(b.id).potentialValue || 0
          break
        case 'ville':
          aVal = a.ville.toLowerCase()
          bVal = b.ville.toLowerCase()
          break
        default:
          return 0
      }
      return sortConfig.direction === 'asc' ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1
    })

    return filtered
  }, [
    prospects,
    debouncedSearchQ,
    filters.regions,
    filters.types,
    filters.statuts,
    filters.commercialIds,
    smartFilter,
    sortConfig,
    getProgressInfo,
  ])

  // Counts pour smart filters
  const smartFilterCounts = useMemo(() => {
    if (!prospects) return { all: 0, hot: 0, recent: 0, stalled: 0, high_value: 0 }
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return {
      all: prospects.length,
      hot: prospects.filter((p) => getProgressInfo(p.id).progress > 50).length,
      recent: prospects.filter((p) => new Date(p.created_at) >= weekAgo).length,
      stalled: 0,
      high_value: prospects.filter((p) => (getProgressInfo(p.id).potentialValue || 0) > 50000)
        .length,
    }
  }, [prospects, getProgressInfo])

  // Stats pour le header
  const totalPipelineValue = useMemo(() => {
    if (!prospects) return 0
    return prospects.reduce((acc, p) => acc + (getProgressInfo(p.id).potentialValue || 0), 0)
  }, [prospects, getProgressInfo])

  // Purger les sélections devenues invalides après un changement de filtre/recherche
  useEffect(() => {
    if (selectedIds.size === 0) return
    const visibleIds = new Set(filteredProspects.map((p) => p.id))
    let changed = false
    const next = new Set<string>()
    selectedIds.forEach((id) => {
      if (visibleIds.has(id)) next.add(id)
      else changed = true
    })
    if (changed) setSelectedIds(next)
  }, [filteredProspects, selectedIds])

  const handleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const handleSelectAll = (selected: boolean) => {
    setSelectedIds(selected ? new Set(filteredProspects.map((p) => p.id)) : new Set())
  }

  const handleExport = () => {
    const toExport =
      selectedIds.size > 0
        ? filteredProspects.filter((p) => selectedIds.has(p.id))
        : filteredProspects
    const csv = Papa.unparse(
      toExport.map((p) => ({
        Nom: p.nom,
        Type: p.type,
        Ville: p.ville,
        Région: p.region,
        Statut: p.statut,
      })),
      { delimiter: ';' }
    )
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Export réussi', description: `${toExport.length} prospects exportés` })
  }

  const handleDelete = (id: string) => {
    if (confirm('Supprimer ce prospect ?')) deleteEtablissement.mutate(id)
  }

  const openEditDialog = (prospect: Etablissement) => {
    setSelectedProspect(prospect)
    setIsEditDialogOpen(true)
  }

  const hasActiveFilters =
    filters.regions.length > 0 ||
    filters.types.length > 0 ||
    filters.statuts.length > 0 ||
    filters.commercialIds.length > 0 ||
    smartFilter !== 'all'

  if (isError || isLoading) {
    return (
      <div
        className="p-4 md:p-6"
        data-page="prospects"
        data-page-ready={isError ? 'true' : 'false'}
        data-page-state={isLoading ? 'loading' : 'error'}
      >
        <PageDataState isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
          <></>
        </PageDataState>
      </div>
    )
  }

  // Header actions avec style glassmorphism
  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowStats(!showStats)}
        className={cn(
          'h-9 px-3 rounded-lg backdrop-blur-sm transition-all',
          showStats
            ? 'bg-card text-primary shadow-md'
            : 'bg-card/10 text-white/80 hover:bg-card/20 hover:text-white border border-white/20'
        )}
      >
        <BarChart3 className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">Stats</span>
        <ChevronDown
          className={cn('h-3 w-3 ml-1 transition-transform', showStats && 'rotate-180')}
        />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 bg-card/10 text-white/80 hover:bg-card/20 hover:text-white border border-white/20 backdrop-blur-sm rounded-lg"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Export</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport}>Exporter CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        onClick={() => setIsDialogOpen(true)}
        size="sm"
        className="h-9 px-4 bg-card text-primary hover:bg-card/90 rounded-lg shadow-md"
      >
        <Plus className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">Nouveau</span>
      </Button>
    </div>
  )

  // Mobile toolbar - single scrollable line
  const mobileToolbar = (
    <div className="flex items-center gap-1.5 w-full flex-nowrap overflow-x-auto scrollbar-thin -mx-1 px-1">
      <PhaseNavTabs activePhase="commercial" counts={phaseCounts} compact />
      <div className="h-4 w-px bg-card/20 shrink-0" />
      <ProspectsSmartFilters
        activeFilter={smartFilter}
        onFilterChange={setSmartFilter}
        counts={smartFilterCounts}
        compact
      />
      <div className="h-4 w-px bg-card/20 shrink-0" />
      <ProspectsFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        availableRegions={availableRegions}
        availableTypes={availableTypes}
        availableStatuts={availableStatuts}
        availableCommercials={availableCommercials}
        compact
      />
      <ProspectsSortMenu sortConfig={sortConfig} onSortChange={setSortConfig} compact />
      <ProspectsViewSelector currentView={currentView} onViewChange={handleViewChange} compact />
    </div>
  )

  // Mobile header actions
  const mobileHeaderActions = (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowStats(!showStats)}
        aria-label={showStats ? 'Masquer les statistiques' : 'Afficher les statistiques'}
        title={showStats ? 'Masquer les statistiques' : 'Afficher les statistiques'}
        aria-pressed={showStats}
        className={cn(
          'h-8 w-8 p-0 rounded-lg backdrop-blur-sm transition-all',
          showStats
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
            aria-label="Exporter"
            title="Exporter"
            className="h-8 w-8 p-0 bg-card/10 text-white/80 hover:bg-card/20 border border-white/20 backdrop-blur-sm rounded-lg"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card">
          <DropdownMenuItem onClick={handleExport}>Exporter CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <div
      className="min-h-dvh bg-gradient-page"
      data-page="prospects"
      data-page-ready="true"
      data-page-state="ready"
    >
      {/* Header - Mobile vs Desktop */}
      {isMobile ? (
        <ProspectsMobileHeader
          searchValue={filters.search}
          onSearchChange={(v) => setFilters((f) => ({ ...f, search: v }))}
          onCreateClick={() => setIsDialogOpen(true)}
          stats={{
            displayed: filteredProspects.length,
            total: prospects?.length || 0,
            hot: smartFilterCounts.hot,
            pipeline: `${(totalPipelineValue / 1000).toFixed(0)}k€`,
          }}
          toolbar={mobileToolbar}
          headerActions={mobileHeaderActions}
          showGlobalNav={true}
        />
      ) : (
        <ImmersivePageHeader
          title="Pipeline Commercial"
          subtitle={`${filteredProspects.length} prospect${filteredProspects.length > 1 ? 's' : ''}`}
          icon={Target}
          stats={[
            { label: 'Total', value: prospects?.length || 0 },
            { label: 'Chauds', value: smartFilterCounts.hot, highlight: true },
            { label: 'Pipeline', value: `${(totalPipelineValue / 1000).toFixed(0)}k€` },
          ]}
          onSearchClick={() => setShowGlobalSearch(true)}
          searchPlaceholder="Rechercher un prospect..."
          actions={headerActions}
        >
          {/* Phase navigation */}
          <PhaseNavTabs activePhase="commercial" counts={phaseCounts} />
          {/* Toolbar intégré dans le header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-2">
            {/* Search local */}
            <div className="relative w-full sm:w-auto sm:min-w-[200px] sm:max-w-[280px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
              <Input
                placeholder="Filtrer..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="h-9 pl-10 bg-card/10 border-white/20 text-white placeholder:text-white/50 focus:bg-card/20 rounded-lg"
                aria-label="Filtrer les prospects"
              />
            </div>

            {/* Smart filters + View selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <ProspectsSmartFilters
                activeFilter={smartFilter}
                onFilterChange={setSmartFilter}
                counts={smartFilterCounts}
              />
              <div className="flex items-center gap-1.5">
                <ProspectsFiltersBar
                  filters={filters}
                  onFiltersChange={setFilters}
                  availableRegions={availableRegions}
                  availableTypes={availableTypes}
                  availableStatuts={availableStatuts}
                  availableCommercials={availableCommercials}
                />
                <ProspectsSortMenu sortConfig={sortConfig} onSortChange={setSortConfig} />
                <ProspectsViewSelector currentView={currentView} onViewChange={handleViewChange} />
              </div>
            </div>
          </div>
        </ImmersivePageHeader>
      )}

      <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-4">
        <EtablissementCreateForm
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          context="prospect"
        />

        {/* Stats collapsibles */}
        <Collapsible open={showStats} onOpenChange={setShowStats}>
          <CollapsibleContent className="space-y-4">
            <ProspectStatsDashboard />
            <PipelineMaturiteCard />
          </CollapsibleContent>
        </Collapsible>

        {filteredProspects.length === 0 ? (
          <CRMEmptyState
            icon={Target}
            title="Aucun prospect trouvé"
            description={
              hasActiveFilters
                ? 'Essayez de modifier vos filtres'
                : 'Commencez par ajouter votre premier prospect'
            }
            hasFilters={hasActiveFilters}
            onResetFilters={() => {
              setFilters({
                search: '',
                regions: [],
                types: [],
                statuts: [],
                commercialIds: [],
                progressionRange: [0, 100],
              })
              setSmartFilter('all')
            }}
            onCreate={() => setIsDialogOpen(true)}
            createLabel="Nouveau prospect"
          />
        ) : (
          <>
            {currentView === 'grid' && (
              <ProspectsGridView
                prospects={filteredProspects}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                getProgressInfo={getProgressInfo}
                onEdit={openEditDialog}
                onDelete={handleDelete}
              />
            )}
            {currentView === 'list' && (
              <ProspectsListView
                prospects={filteredProspects}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                getProgressInfo={getProgressInfo}
                onEdit={openEditDialog}
                onDelete={handleDelete}
              />
            )}
            {currentView === 'table' && (
              <ProspectsTableView
                prospects={filteredProspects}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
                getProgressInfo={getProgressInfo}
                onEdit={openEditDialog}
                onDelete={handleDelete}
              />
            )}
            {currentView === 'kanban' && (
              <ProspectsKanbanView
                prospects={filteredProspects}
                getProgressInfo={getProgressInfo}
                onEdit={openEditDialog}
                onDelete={handleDelete}
              />
            )}
          </>
        )}

        {allEtablissements && <BlockedEtablissementsSection etablissements={allEtablissements} />}

        <BulkActionsBarProspects
          selectedCount={selectedIds.size}
          onClearSelection={() => setSelectedIds(new Set())}
          onExport={handleExport}
          onChangeStatus={handleBulkChangeStatus}
        />

        {selectedProspect && (
          <EtablissementEditForm
            etablissement={selectedProspect}
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open)
              if (!open) setSelectedProspect(null)
            }}
          />
        )}

        <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />
      </div>
    </div>
  )
}

export default function Prospects() {
  return <ProspectsContent />
}
