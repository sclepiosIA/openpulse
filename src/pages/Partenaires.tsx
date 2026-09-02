import { useState, useMemo, useEffect } from 'react'
import { useDebounce } from '@/hooks/shared/useDebounce'
import { useMediaQuery } from '@/hooks/shared/useMediaQuery'
import { VirtualizedGrid } from '@/components/ui/virtualized-grid'
import {
  Plus,
  Search,
  Filter,
  Download,
  Handshake,
  Sparkles,
  MoreHorizontal,
  BarChart3,
  ChevronDown,
  RefreshCw,
  CheckSquare,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePartenaires } from '@/hooks/crm/usePartenaires'

import { Partenaire } from '@/hooks/crm/usePartenaires'
import { PartenaireCreateForm } from '@/components/partenaire/PartenaireCreateForm'
import { PartenaireEditForm } from '@/components/partenaire/PartenaireEditForm'
import { ViewSelectorPartenaires } from '@/components/partenaire/ViewSelectorPartenaires'
import { SortMenuPartenaires, SortConfig } from '@/components/partenaire/SortMenuPartenaires'
import { UnifiedFiltersPartenaires } from '@/components/partenaire/UnifiedFiltersPartenaires'
import { PartenairesStatsPanel } from '@/components/partenaire/PartenairesStatsPanel'
import { EnhancedPartenaireCard } from '@/components/partenaire/EnhancedPartenaireCard'
import { PartenairesTableView } from '@/components/partenaire/PartenairesTableView'
import { PartenairesListView } from '@/components/partenaire/PartenairesListView'
import { BulkActionsBarPartenaires } from '@/components/partenaire/BulkActionsBarPartenaires'
import {
  AdvancedSearchPartenaires,
  AdvancedSearchFilters,
} from '@/components/partenaire/AdvancedSearchPartenaires'
import { PartenairesMobileHeader } from '@/components/partenaire/PartenairesMobileHeader'
import { useUserPreferences } from '@/hooks/profile/useUserPreferences'
import { useAuth } from '@/components/AuthProvider'
import {
  exportPartenairesToCSV,
  exportPartenairesToExcel,
  exportPartenairesToPDF,
} from '@/lib/exportPartenairesUtils'
import { useAllPendingContactsCounts } from '@/hooks/crm/usePendingContactsCount'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { toast } from 'sonner'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { PageDataState } from '@/components/common/PageDataState'

export default function Partenaires() {
  const { data: partenaires, isLoading, isError: partenairesError, refetch } = usePartenaires()
  const { user } = useAuth()
  const { getPreference, updatePreference, isFavoritePartenaire, toggleFavoritePartenaire } =
    useUserPreferences()
  const { data: pendingCounts = {} } = useAllPendingContactsCounts()
  const isMobile = useIsMobile()

  // Responsive grid columns detection
  const isSmallMobile = useMediaQuery('(max-width: 767px)')
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  const isLaptop = useMediaQuery('(min-width: 1024px) and (max-width: 1279px)')

  const gridColumns = useMemo(() => {
    if (isSmallMobile) return 1
    if (isTablet) return 2
    if (isLaptop) return 3
    return 4
  }, [isSmallMobile, isTablet, isLaptop])

  const [showGlobalSearch, setShowGlobalSearch] = useState(false)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false)
  const [selectedPartenaire, setSelectedPartenaire] = useState<Partenaire | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [hasShownGlobalNotification, setHasShownGlobalNotification] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)

  // Stats panel collapsed by default
  const [showStats, setShowStats] = useState(
    () => localStorage.getItem('partenaires-show-stats') === 'true'
  )

  useEffect(() => {
    localStorage.setItem('partenaires-show-stats', String(showStats))
  }, [showStats])

  const [currentView, setCurrentView] = useState<'grid' | 'table' | 'list'>(
    (getPreference('partenaires_view', 'grid') as 'grid' | 'table' | 'list') || 'grid'
  )
  const [smartFilter, setSmartFilter] = useState('all')
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'nom',
    direction: 'asc',
  })

  const handleViewChange = (view: 'grid' | 'table' | 'list') => {
    setCurrentView(view)
    updatePreference('partenaires_view', view)
  }

  useEffect(() => {
    const totalPending = Object.values(pendingCounts).reduce((sum, count) => sum + count, 0)
    if (totalPending > 0 && !hasShownGlobalNotification) {
      toast.success(
        `${totalPending} nouveau${totalPending > 1 ? 'x' : ''} contact${totalPending > 1 ? 's' : ''} détecté${totalPending > 1 ? 's' : ''} par I.A.`,
        {
          description: 'Consultez les fiches partenaires pour valider les contacts.',
          duration: 6000,
          icon: <Sparkles className="h-4 w-4" />,
        }
      )
      setHasShownGlobalNotification(true)
    }
  }, [pendingCounts, hasShownGlobalNotification])

  const handleToggleFavorite = async (id: string) => {
    await toggleFavoritePartenaire(id)
  }

  const handleEdit = (partenaire: Partenaire) => {
    setSelectedPartenaire(partenaire)
    setEditDialogOpen(true)
  }

  const handleApplyAdvancedFilters = (filters: AdvancedSearchFilters) => {
    setAdvancedFilters(filters)
    setAdvancedSearchOpen(false)
  }

  const filteredAndSortedPartenaires = useMemo(() => {
    let filtered = [...partenaires]
    const now = new Date()

    // Search
    if (debouncedSearch) {
      const sLower = debouncedSearch.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.nom.toLowerCase().includes(sLower) ||
          p.ville?.toLowerCase().includes(sLower) ||
          p.email?.toLowerCase().includes(sLower)
      )
    }

    // Advanced filters
    if (advancedFilters) {
      if (advancedFilters.nom) {
        filtered = filtered.filter((p) =>
          p.nom.toLowerCase().includes(advancedFilters.nom!.toLowerCase())
        )
      }
      if (advancedFilters.types.length > 0) {
        filtered = filtered.filter((p) => advancedFilters.types.includes(p.type_partenaire))
      }
      if (advancedFilters.statuts.length > 0) {
        filtered = filtered.filter((p) => advancedFilters.statuts.includes(p.statut_relation))
      }
      if (advancedFilters.ville) {
        filtered = filtered.filter((p) =>
          p.ville?.toLowerCase().includes(advancedFilters.ville!.toLowerCase())
        )
      }
      if (advancedFilters.region) {
        filtered = filtered.filter((p) =>
          p.region?.toLowerCase().includes(advancedFilters.region!.toLowerCase())
        )
      }
      if (advancedFilters.dateCreationMin) {
        filtered = filtered.filter(
          (p) => new Date(p.created_at) >= new Date(advancedFilters.dateCreationMin!)
        )
      }
      if (advancedFilters.dateCreationMax) {
        filtered = filtered.filter(
          (p) => new Date(p.created_at) <= new Date(advancedFilters.dateCreationMax!)
        )
      }
      if (advancedFilters.valeurMin !== undefined) {
        filtered = filtered.filter((p) => (p.valeur_partenariat || 0) >= advancedFilters.valeurMin!)
      }
      if (advancedFilters.valeurMax !== undefined) {
        filtered = filtered.filter((p) => (p.valeur_partenariat || 0) <= advancedFilters.valeurMax!)
      }
      if (advancedFilters.engagementMin !== undefined) {
        filtered = filtered.filter(
          (p) => (p.engagement_score || 0) >= advancedFilters.engagementMin!
        )
      }
      if (advancedFilters.engagementMax !== undefined) {
        filtered = filtered.filter(
          (p) => (p.engagement_score || 0) <= advancedFilters.engagementMax!
        )
      }
      if (advancedFilters.notesSearch) {
        filtered = filtered.filter((p) =>
          p.notes?.toLowerCase().includes(advancedFilters.notesSearch!.toLowerCase())
        )
      }
    }

    // Smart filters
    if (smartFilter === 'favorites') {
      filtered = filtered.filter((p) => isFavoritePartenaire(p.id))
    } else if (smartFilter === 'new') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      filtered = filtered.filter((p) => new Date(p.created_at) >= thirtyDaysAgo)
    } else if (smartFilter === 'to_relance') {
      filtered = filtered.filter((p) => {
        const dernier = p.dernier_contact ? new Date(p.dernier_contact) : null
        const prochaine = p.prochaine_action ? new Date(p.prochaine_action) : null
        const contactOld = dernier
          ? (now.getTime() - dernier.getTime()) / (1000 * 60 * 60 * 24) > 60
          : false
        const actionPassed = prochaine ? prochaine < now : false
        return contactOld || actionPassed
      })
    } else if (smartFilter === 'high_value') {
      filtered = filtered.filter((p) => (p.valeur_partenariat || 0) > 50000)
    } else if (smartFilter === 'mine') {
      filtered = filtered.filter((p) => p.responsable_marque_id === user?.id)
    } else if (smartFilter === 'institutionnel_only') {
      filtered = filtered.filter((p) => p.type_partenaire === 'institutionnel')
    } else if (smartFilter === 'industriel_only') {
      filtered = filtered.filter((p) => p.type_partenaire === 'industriel')
    } else if (smartFilter === 'apporteurs') {
      filtered = filtered.filter((p) => (p.tags ?? []).includes('apporteur-affaires'))
    } else if (smartFilter === 'actif') {
      filtered = filtered.filter((p) => p.statut_relation === 'actif')
    } else if (smartFilter === 'prospect') {
      filtered = filtered.filter((p) => p.statut_relation === 'prospect')
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortConfig.field as keyof Partenaire]
      const bVal = b[sortConfig.field as keyof Partenaire]

      const aValue = aVal ?? ''
      const bValue = bVal ?? ''

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      const aNum = typeof aValue === 'number' ? aValue : 0
      const bNum = typeof bValue === 'number' ? bValue : 0
      return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
    })

    return filtered
  }, [
    partenaires,
    debouncedSearch,
    smartFilter,
    sortConfig,
    user?.id,
    isFavoritePartenaire,
    advancedFilters,
  ])

  const smartFilterCounts = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    return {
      all: partenaires.length,
      favorites: partenaires.filter((p) => isFavoritePartenaire(p.id)).length,
      new: partenaires.filter((p) => new Date(p.created_at) >= thirtyDaysAgo).length,
      toRelance: partenaires.filter((p) => {
        const dernier = p.dernier_contact ? new Date(p.dernier_contact) : null
        const prochaine = p.prochaine_action ? new Date(p.prochaine_action) : null
        const contactOld = dernier
          ? (now.getTime() - dernier.getTime()) / (1000 * 60 * 60 * 24) > 60
          : false
        const actionPassed = prochaine ? prochaine < now : false
        return contactOld || actionPassed
      }).length,
      highValue: partenaires.filter((p) => (p.valeur_partenariat || 0) > 50000).length,
      mine: partenaires.filter((p) => p.responsable_marque_id === user?.id).length,
      institutionnel: partenaires.filter((p) => p.type_partenaire === 'institutionnel').length,
      industriel: partenaires.filter((p) => p.type_partenaire === 'industriel').length,
      actifs: partenaires.filter((p) => p.statut_relation === 'actif').length,
      prospects: partenaires.filter((p) => p.statut_relation === 'prospect').length,
      apporteurs: partenaires.filter((p) => (p.tags ?? []).includes('apporteur-affaires')).length,
    }
  }, [partenaires, user?.id, isFavoritePartenaire])

  // Stats pour le header
  const totalValeur = useMemo(
    () => partenaires.reduce((acc, p) => acc + (p.valeur_partenariat || 0), 0),
    [partenaires]
  )
  const actifsCount = useMemo(
    () => partenaires.filter((p) => p.statut_relation === 'actif').length,
    [partenaires]
  )

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const toExport =
      selectedIds.length > 0
        ? partenaires.filter((p) => selectedIds.includes(p.id))
        : filteredAndSortedPartenaires

    if (format === 'csv') exportPartenairesToCSV(toExport)
    else if (format === 'excel') exportPartenairesToExcel(toExport)
    else if (format === 'pdf') exportPartenairesToPDF(toExport)
  }

  if (isLoading || partenairesError) {
    return (
      <PageDataState isLoading={isLoading} isError={partenairesError} onRetry={() => refetch()}>
        <></>
      </PageDataState>
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

      {/* More actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 bg-card/10 text-white/80 hover:bg-card/20 hover:text-white border border-white/20 backdrop-blur-sm rounded-lg"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setAdvancedSearchOpen(true)}>
            <Filter className="h-4 w-4 mr-2" />
            Recherche avancée
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileText className="h-4 w-4 mr-2" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => setSelectionMode(!selectionMode)}>
            <CheckSquare className="h-4 w-4 mr-2" />
            {selectionMode ? 'Désactiver sélection' : 'Mode sélection'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Primary action */}
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

  // Mobile toolbar compact - single line with horizontal scroll
  const mobileToolbar = (
    <div className="flex items-center gap-1 w-full overflow-x-auto scrollbar-hide flex-nowrap">
      <ViewSelectorPartenaires currentView={currentView} onViewChange={handleViewChange} />
      <SortMenuPartenaires sortConfig={sortConfig} onSortChange={setSortConfig} />
      <div className="h-4 w-px bg-card/20 shrink-0" />
      <UnifiedFiltersPartenaires
        activeFilter={smartFilter}
        onFilterChange={setSmartFilter}
        counts={smartFilterCounts}
        compact
      />
    </div>
  )

  return (
    <div className="min-h-dvh bg-gradient-page">
      {/* Header - Mobile vs Desktop */}
      {isMobile ? (
        <PartenairesMobileHeader
          searchValue={search}
          onSearchChange={setSearch}
          onCreateClick={() => setCreateDialogOpen(true)}
          stats={{
            displayed: filteredAndSortedPartenaires.length,
            total: partenaires.length,
            actifs: actifsCount,
            valeur: `${(totalValeur / 1000).toFixed(0)}k€`,
          }}
          toolbar={mobileToolbar}
          showGlobalNav={true}
          showStats={showStats}
          onToggleStats={() => setShowStats(!showStats)}
          onAdvancedSearch={() => setAdvancedSearchOpen(true)}
          onExport={handleExport}
          onRefresh={() => refetch()}
          selectionMode={selectionMode}
          onToggleSelectionMode={() => setSelectionMode(!selectionMode)}
        />
      ) : (
        <ImmersivePageHeader
          title="Partenaires"
          subtitle={`${filteredAndSortedPartenaires.length} résultats`}
          icon={Handshake}
          stats={[
            { label: 'Total', value: partenaires.length },
            { label: 'Actifs', value: actifsCount, highlight: true },
            { label: 'Valeur', value: `${(totalValeur / 1000).toFixed(0)}k€` },
          ]}
          onSearchClick={() => setShowGlobalSearch(true)}
          searchPlaceholder="Rechercher un partenaire..."
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
                aria-label="Filtrer les partenaires"
              />
            </div>

            {/* View selector + Sort */}
            <div className="flex items-center gap-2">
              <ViewSelectorPartenaires currentView={currentView} onViewChange={handleViewChange} />
              <SortMenuPartenaires sortConfig={sortConfig} onSortChange={setSortConfig} />
            </div>
          </div>
        </ImmersivePageHeader>
      )}

      {/* Content */}
      <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-4">
        {/* Stats Panel - Collapsible */}
        <Collapsible open={showStats} onOpenChange={setShowStats}>
          <CollapsibleContent>
            <PartenairesStatsPanel partenaires={partenaires} />
          </CollapsibleContent>
        </Collapsible>

        {/* Unified Filters - Hidden on mobile (integrated in header) */}
        {!isMobile && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <UnifiedFiltersPartenaires
              activeFilter={smartFilter}
              onFilterChange={setSmartFilter}
              counts={smartFilterCounts}
            />

            {/* Advanced filters indicator */}
            {advancedFilters && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Filtres avancés actifs</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdvancedFilters(null)}
                  className="h-5 px-2 text-xs"
                >
                  Réinitialiser
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Advanced filters indicator - Mobile */}
        {isMobile && advancedFilters && (
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs text-muted-foreground">Filtres avancés actifs</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAdvancedFilters(null)}
              className="h-5 px-2 text-xs"
            >
              Réinitialiser
            </Button>
          </div>
        )}

        {/* Results count */}
        <div className="text-xs text-muted-foreground">
          {filteredAndSortedPartenaires.length} partenaire
          {filteredAndSortedPartenaires.length !== 1 ? 's' : ''}
          {selectedIds.length > 0 &&
            ` • ${selectedIds.length} sélectionné${selectedIds.length !== 1 ? 's' : ''}`}
        </div>

        {/* Views */}
        {currentView === 'grid' && (
          <VirtualizedGrid
            items={filteredAndSortedPartenaires}
            columns={gridColumns}
            estimatedRowHeight={320}
            gap={12}
            virtualizationThreshold={40}
            getItemKey={(p) => p.id}
            renderItem={(partenaire) => (
              <EnhancedPartenaireCard
                partenaire={partenaire}
                isFavorite={isFavoritePartenaire(partenaire.id)}
                onToggleFavorite={(id) => handleToggleFavorite(id)}
                isSelected={selectedIds.includes(partenaire.id)}
                onSelect={(id) =>
                  setSelectedIds((prev) =>
                    prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                  )
                }
                showCheckbox={selectionMode}
                pendingContactsCount={pendingCounts[partenaire.id] || 0}
              />
            )}
          />
        )}

        {currentView === 'table' && (
          <PartenairesTableView
            partenaires={filteredAndSortedPartenaires}
            selectedIds={selectedIds}
            onSelectOne={(id: string) =>
              setSelectedIds((prev) =>
                prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
              )
            }
            onSelectAll={(selected) =>
              setSelectedIds(selected ? filteredAndSortedPartenaires.map((p) => p.id) : [])
            }
            onEdit={handleEdit}
            pendingCounts={pendingCounts}
            onCreate={() => setCreateDialogOpen(true)}
          />
        )}

        {currentView === 'list' && (
          <PartenairesListView
            partenaires={filteredAndSortedPartenaires}
            selectedIds={selectedIds}
            onSelectOne={(id: string) =>
              setSelectedIds((prev) =>
                prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
              )
            }
          />
        )}

        {filteredAndSortedPartenaires.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Handshake className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Aucun partenaire trouvé</h3>
            <p className="text-muted-foreground mb-4">
              {search || smartFilter !== 'all'
                ? 'Essayez de modifier vos critères de recherche'
                : 'Commencez par créer votre premier partenaire'}
            </p>
            {!search && smartFilter === 'all' && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer un partenaire
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions Bar - Only show when items selected */}
      {selectedIds.length > 0 && (
        <BulkActionsBarPartenaires
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds([])}
          onExport={(format) => handleExport(format)}
        />
      )}

      {/* Dialogs */}
      <PartenaireCreateForm open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      {selectedPartenaire && (
        <PartenaireEditForm
          partenaire={selectedPartenaire}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open)
            if (!open) setSelectedPartenaire(null)
          }}
        />
      )}

      <AdvancedSearchPartenaires
        open={advancedSearchOpen}
        onOpenChange={setAdvancedSearchOpen}
        onApplyFilters={handleApplyAdvancedFilters}
      />

      <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />
    </div>
  )
}
