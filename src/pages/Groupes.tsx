import { useState, useMemo, useCallback } from 'react'
import { VirtualizedGrid } from '@/components/ui/virtualized-grid'
import { Plus, Building2, BarChart2, Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGroupes, useDeleteGroupe } from '@/hooks/crm/useGroupes'
import { useProfilesMap } from '@/hooks/profile/useProfilesMap'
import { Skeleton } from '@/components/ui/skeleton'
import { GroupeCreateDialog } from '@/components/groupe/GroupeCreateDialog'
import { ViewSelectorGroupes, GroupeView } from '@/components/groupe/ViewSelectorGroupes'
import { GroupesStatsPanel } from '@/components/groupe/GroupesStatsPanel'
import { EnhancedGroupeCard } from '@/components/groupe/EnhancedGroupeCard'
import { GroupesTableView } from '@/components/groupe/GroupesTableView'
import { GroupesListView } from '@/components/groupe/GroupesListView'
import { GroupesTimelineView } from '@/components/groupe/GroupesTimelineView'
import { GroupesFiltersBar } from '@/components/groupe/GroupesFiltersBar'
import { SortMenuGroupes } from '@/components/groupe/SortMenuGroupes'
import { BulkActionsBarGroupes } from '@/components/groupe/BulkActionsBarGroupes'
import { AdvancedSearchGroupes, AdvancedFilters } from '@/components/groupe/AdvancedSearchGroupes'
import { useSearchParams } from 'react-router-dom'
import { useUserPreferences } from '@/hooks/profile/useUserPreferences'
import { differenceInDays } from 'date-fns'
import {
  exportGroupesToCSV,
  exportGroupesToExcel,
  exportGroupesToPDF,
} from '@/lib/exportGroupesUtils'
import { useToast } from '@/hooks/shared/use-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { GroupesMobileHeader } from '@/components/groupe/GroupesMobileHeader'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/shared/useDebounce'
import { PageDataState } from '@/components/common/PageDataState'

export default function Groupes() {
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const { getPreference, updatePreference, isFavoriteGroupe } = useUserPreferences()
  const [currentView, setCurrentView] = useState<GroupeView>(
    (getPreference('groupes_view', 'grid') as GroupeView) || 'grid'
  )
  const [isStatsPanelOpen, setIsStatsPanelOpen] = useState(false)
  const [selectedGroupes, setSelectedGroupes] = useState<string[]>([])
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    region: [],
    type: [],
    modules: [],
  })
  const [searchParams] = useSearchParams()
  const deleteGroupe = useDeleteGroupe()
  const { toast } = useToast()
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)

  const { data: groupes, isLoading, isError: groupesError, refetch: refetchGroupes } = useGroupes()
  const debouncedSearch = useDebounce(search, 300)

  // Sauvegarder la vue en BDD quand elle change
  const handleViewChange = (view: GroupeView) => {
    setCurrentView(view)
    updatePreference('groupes_view', view)
  }
  const { map: profilesMap } = useProfilesMap()

  const typeFilter = searchParams.get('type')
  const sortParam = searchParams.get('sort') || 'nom-asc'
  const smartFilter = searchParams.get('smart_filter')

  // Appliquer tous les filtres
  const filteredAndSortedGroupes = useMemo(() => {
    if (!groupes) return []

    const sLower = debouncedSearch.toLowerCase()
    const filtered = groupes.filter((g) => {
      // Recherche de base (debounced)
      const matchesSearch =
        !sLower ||
        g.nom.toLowerCase().includes(sLower) ||
        g.region?.toLowerCase().includes(sLower) ||
        g.description?.toLowerCase().includes(sLower)

      // Filtre quick type
      const matchesType = !typeFilter || g.type === typeFilter

      // Smart filters
      let matchesSmartFilter = true
      if (smartFilter === 'favoris') {
        matchesSmartFilter = isFavoriteGroupe(g.id)
      } else if (smartFilter === 'nouveaux') {
        matchesSmartFilter = differenceInDays(new Date(), new Date(g.created_at)) <= 30
      } else if (smartFilter === 'ght') {
        matchesSmartFilter = g.type === 'GHT'
      } else if (smartFilter === 'grosses') {
        matchesSmartFilter = g.nombre_etablissements > 5
      }

      // Filtres avancés
      const matchesAdvanced =
        (!advancedFilters.nom || g.nom.toLowerCase().includes(advancedFilters.nom.toLowerCase())) &&
        (!advancedFilters.region ||
          advancedFilters.region.length === 0 ||
          (g.region && advancedFilters.region.includes(g.region))) &&
        (!advancedFilters.type ||
          advancedFilters.type.length === 0 ||
          advancedFilters.type.includes(g.type)) &&
        (!advancedFilters.etablissementsMin ||
          g.nombre_etablissements >= advancedFilters.etablissementsMin) &&
        (!advancedFilters.etablissementsMax ||
          g.nombre_etablissements <= advancedFilters.etablissementsMax) &&
        (!advancedFilters.progressionMin ||
          g.progression_moyenne >= advancedFilters.progressionMin) &&
        (!advancedFilters.progressionMax ||
          g.progression_moyenne <= advancedFilters.progressionMax) &&
        (!advancedFilters.modules ||
          advancedFilters.modules.length === 0 ||
          (g.modules_deployes &&
            advancedFilters.modules.some((m) => g.modules_deployes?.includes(m)))) &&
        (!advancedFilters.passagesUrgencesMin ||
          (g.total_passages_urgences_annuel &&
            g.total_passages_urgences_annuel >= advancedFilters.passagesUrgencesMin)) &&
        (!advancedFilters.passagesUrgencesMax ||
          (g.total_passages_urgences_annuel &&
            g.total_passages_urgences_annuel <= advancedFilters.passagesUrgencesMax)) &&
        (!advancedFilters.dateCreationDebut ||
          new Date(g.created_at) >= new Date(advancedFilters.dateCreationDebut)) &&
        (!advancedFilters.dateCreationFin ||
          new Date(g.created_at) <= new Date(advancedFilters.dateCreationFin)) &&
        (!advancedFilters.searchInNotes ||
          (g.notes && g.notes.toLowerCase().includes(advancedFilters.searchInNotes.toLowerCase())))

      return matchesSearch && matchesType && matchesSmartFilter && matchesAdvanced
    })

    // Tri
    const [sortField, sortOrder] = sortParam.split('-')

    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'nom':
          comparison = a.nom.localeCompare(b.nom)
          break
        case 'created':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'etablissements':
          comparison = a.nombre_etablissements - b.nombre_etablissements
          break
        case 'progression':
          comparison = a.progression_moyenne - b.progression_moyenne
          break
        default:
          comparison = 0
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [
    groupes,
    debouncedSearch,
    typeFilter,
    sortParam,
    smartFilter,
    advancedFilters,
    isFavoriteGroupe,
  ])

  // Stats pour le header
  const ghtCount = useMemo(() => groupes?.filter((g) => g.type === 'GHT').length || 0, [groupes])
  const totalEtabs = useMemo(
    () => groupes?.reduce((acc, g) => acc + g.nombre_etablissements, 0) || 0,
    [groupes]
  )

  const handleExport = useCallback(
    (groupeIds: string[]) => {
      const groupesToExport = groupes?.filter((g) => groupeIds.includes(g.id)) || []

      toast({
        title: 'Export en cours...',
        description: 'Veuillez patienter',
      })

      setTimeout(() => {
        exportGroupesToExcel(groupesToExport)
        toast({
          title: 'Export réussi',
          description: `${groupesToExport.length} groupe(s) exporté(s)`,
        })
      }, 500)
    },
    [groupes, toast]
  )

  const handleDelete = useCallback(
    async (groupeIds: string[]) => {
      for (const id of groupeIds) {
        await deleteGroupe.mutateAsync(id)
      }
      setSelectedGroupes([])
      toast({
        title: 'Suppression réussie',
        description: `${groupeIds.length} groupe(s) supprimé(s)`,
      })
    },
    [deleteGroupe, toast]
  )

  const toggleSelection = (groupeId: string) => {
    setSelectedGroupes((prev) =>
      prev.includes(groupeId) ? prev.filter((id) => id !== groupeId) : [...prev, groupeId]
    )
  }

  const showCheckboxes = selectedGroupes.length > 0 || currentView === 'grid'

  // Header actions avec style glassmorphism
  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsStatsPanelOpen(!isStatsPanelOpen)}
        className={cn(
          'h-9 px-3 rounded-lg backdrop-blur-sm transition-all',
          isStatsPanelOpen
            ? 'bg-card text-primary shadow-md'
            : 'bg-card/10 text-white/80 hover:bg-card/20 hover:text-white border border-white/20'
        )}
      >
        <BarChart2 className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">Stats</span>
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
          <DropdownMenuItem onClick={() => exportGroupesToCSV(filteredAndSortedGroupes)}>
            Export CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportGroupesToExcel(filteredAndSortedGroupes)}>
            Export Excel
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => exportGroupesToPDF(filteredAndSortedGroupes)}>
            Export PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        onClick={() => setCreateDialogOpen(true)}
        size="sm"
        className="h-9 px-4 bg-card text-primary hover:bg-card/90 rounded-lg shadow-md"
      >
        <Plus className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">Nouveau</span>
      </Button>
    </div>
  )

  // Mobile toolbar compact - une seule ligne avec scroll horizontal
  const mobileToolbar = (
    <div className="flex items-center gap-1 w-full overflow-x-auto scrollbar-hide flex-nowrap">
      <ViewSelectorGroupes currentView={currentView} onViewChange={handleViewChange} />
      <SortMenuGroupes />
      <div className="h-4 w-px bg-card/20 shrink-0" />
      <GroupesFiltersBar groupes={groupes || []} compact />
      <AdvancedSearchGroupes onSearch={setAdvancedFilters} />
    </div>
  )

  return (
    <div className="min-h-dvh bg-gradient-page">
      {/* Header conditionnel mobile/desktop */}
      {isMobile ? (
        <GroupesMobileHeader
          searchValue={search}
          onSearchChange={setSearch}
          onCreateClick={() => setCreateDialogOpen(true)}
          stats={{
            displayed: filteredAndSortedGroupes.length,
            total: groupes?.length || 0,
            ght: ghtCount,
          }}
          toolbar={mobileToolbar}
          showGlobalNav={true}
        />
      ) : (
        <ImmersivePageHeader
          title="Groupes d'Établissements"
          subtitle={isLoading ? 'Chargement...' : `${filteredAndSortedGroupes.length} résultats`}
          icon={Building2}
          stats={[
            { label: 'Total', value: groupes?.length || 0 },
            { label: 'GHT', value: ghtCount, highlight: true },
            { label: 'Établissements liés', value: totalEtabs },
          ]}
          onSearchClick={() => setShowGlobalSearch(true)}
          searchPlaceholder="Rechercher un groupe..."
          actions={headerActions}
        >
          {/* Toolbar intégré dans le header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-2">
            {/* Search local */}
            <div className="relative w-full sm:w-auto sm:min-w-[200px] sm:max-w-[280px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
              <Input
                placeholder="Filtrer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-10 bg-card/10 border-white/20 text-white placeholder:text-white/50 focus:bg-card/20 rounded-lg"
                aria-label="Filtrer les groupes"
              />
            </div>

            {/* View selector glassmorphism */}
            <div className="flex items-center gap-2">
              <ViewSelectorGroupes currentView={currentView} onViewChange={handleViewChange} />
              <SortMenuGroupes />
              <AdvancedSearchGroupes onSearch={setAdvancedFilters} />
            </div>
          </div>
        </ImmersivePageHeader>
      )}

      {/* Content */}
      <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-4">
        {/* Quick Filters - masqués sur mobile car dans le header */}
        {!isMobile && <GroupesFiltersBar groupes={groupes || []} />}

        {groupesError ? (
          <PageDataState isLoading={false} isError={true} onRetry={() => refetchGroupes()}>
            <></>
          </PageDataState>
        ) : isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={`groupes-stats-skeleton-${i}`} className="h-24" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={`groupes-card-skeleton-${i}`} className="h-64" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {isStatsPanelOpen && <GroupesStatsPanel groupes={filteredAndSortedGroupes} />}

            {currentView === 'grid' && (
              <VirtualizedGrid
                items={filteredAndSortedGroupes}
                columns={3}
                estimatedRowHeight={280}
                gap={16}
                virtualizationThreshold={30}
                getItemKey={(g) => g.id}
                renderItem={(groupe) => (
                  <EnhancedGroupeCard
                    groupe={groupe}
                    isSelected={selectedGroupes.includes(groupe.id)}
                    onSelect={() => toggleSelection(groupe.id)}
                    showCheckbox={showCheckboxes}
                    profiles={profilesMap}
                  />
                )}
              />
            )}

            {currentView === 'table' && <GroupesTableView groupes={filteredAndSortedGroupes} />}

            {currentView === 'list' && <GroupesListView groupes={filteredAndSortedGroupes} />}

            {currentView === 'timeline' && (
              <GroupesTimelineView groupes={filteredAndSortedGroupes} />
            )}

            {filteredAndSortedGroupes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Aucun groupe trouvé</h3>
                <p className="text-muted-foreground mb-4">
                  {search || typeFilter || smartFilter
                    ? 'Essayez de modifier vos critères de recherche'
                    : 'Commencez par créer votre premier groupe'}
                </p>
                {!search && !typeFilter && !smartFilter && (
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer un groupe
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <BulkActionsBarGroupes
        selectedGroupes={selectedGroupes}
        groupes={groupes || []}
        onClearSelection={() => setSelectedGroupes([])}
        onExport={handleExport}
        onDelete={handleDelete}
      />

      <GroupeCreateDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />
    </div>
  )
}
