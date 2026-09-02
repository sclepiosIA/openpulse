import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Building2,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  MoreHorizontal,
  ChevronDown,
  BarChart3,
  CheckSquare,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { CRMToolbar } from '@/components/layout/CRMToolbar'
import { EtablissementsMobileHeader } from '@/components/etablissement/EtablissementsMobileHeader'
import { UnifiedFilters } from '@/components/etablissement/UnifiedFilters'
import { ViewSelector, type EtablissementView } from '@/components/etablissement/ViewSelector'
import { SortMenu, type SortField, type SortDirection } from '@/components/etablissement/SortMenu'
import { EtablissementFilters } from '@/components/etablissement/EtablissementFilters'
import { EtablissementForm } from '@/components/etablissement/EtablissementForm'
import { cn } from '@/lib/utils'
import type { UseFormReturn } from 'react-hook-form'
import type { CreateEtablissementData } from '@/hooks/crm/useEtablissements'
import type { ReactNode } from 'react'

interface EtablissementsPageHeaderProps {
  isMobile: boolean
  searchTerm: string
  setSearchTerm: (v: string) => void
  debouncedCount: number
  totalCount: number
  allEtablissementsData: any[] | undefined
  showStats: boolean
  onToggleStats: (open: boolean) => void
  currentView: EtablissementView
  onViewChange: (view: EtablissementView) => void
  sortField: SortField
  sortDirection: SortDirection
  onSortChange: (f: SortField, d: SortDirection) => void
  isFiltersDialogOpen: boolean
  setIsFiltersDialogOpen: (v: boolean) => void
  isDialogOpen: boolean
  setIsDialogOpen: (v: boolean) => void
  isImportDialogOpen: boolean
  setIsImportDialogOpen: (v: boolean) => void
  isSelectionMode: boolean
  setIsSelectionMode: (v: boolean) => void
  showFillWithAI: boolean
  setShowFillWithAI: (v: boolean) => void
  canFilterByUser: boolean | null | undefined
  showOnlyMine: boolean
  toggleShowOnlyMine: () => void
  getToggleText: () => string
  downloadEstablishmentsCsv: () => void
  invalidateQueries: () => void
  unifiedFiltersElement: ReactNode
  onSearchClick: () => void
  form: UseFormReturn<CreateEtablissementData>
  onSubmit: (data: CreateEtablissementData) => Promise<void>
  createPending: boolean
  allProfiles: any[] | undefined
  activeFilterFlags: {
    statutFilter: string | null
    typeFilter: string | null
    dpiFilter: string | null
    regionFilter: string | null
    commercialFilter: string | null
    chefProjetFilter: string | null
    csmFilter: string | null
  }
}

export function EtablissementsPageHeader(props: EtablissementsPageHeaderProps) {
  const {
    isMobile,
    searchTerm,
    setSearchTerm,
    debouncedCount,
    totalCount,
    allEtablissementsData,
    showStats,
    onToggleStats,
    currentView,
    onViewChange,
    sortField,
    sortDirection,
    onSortChange,
    isFiltersDialogOpen,
    setIsFiltersDialogOpen,
    isDialogOpen,
    setIsDialogOpen,
    isImportDialogOpen: _isImportDialogOpen,
    setIsImportDialogOpen,
    isSelectionMode,
    setIsSelectionMode,
    showFillWithAI: _showFillWithAI,
    setShowFillWithAI,
    canFilterByUser,
    showOnlyMine,
    toggleShowOnlyMine,
    getToggleText,
    downloadEstablishmentsCsv,
    invalidateQueries,
    unifiedFiltersElement,
    onSearchClick,
    form,
    onSubmit,
    createPending,
    allProfiles,
    activeFilterFlags,
  } = props

  if (isMobile) {
    return (
      <EtablissementsMobileHeader
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        onCreateClick={() => setIsDialogOpen(true)}
        stats={{ displayed: debouncedCount, total: totalCount }}
        showGlobalNav={true}
        toolbar={
          <div className="flex items-center gap-1.5 w-full">
            <UnifiedFilters
              etablissements={allEtablissementsData || []}
              allCount={allEtablissementsData?.length || 0}
              variant="tabs-only"
              compact
            />
            <div className="h-5 w-px bg-card/20 shrink-0" />
            <UnifiedFilters
              etablissements={allEtablissementsData || []}
              allCount={allEtablissementsData?.length || 0}
              variant="smart-only"
              compact
            />
            <div className="h-5 w-px bg-card/20 shrink-0" />
            <ViewSelector currentView={currentView} onViewChange={onViewChange} />
            <SortMenu
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
            <Dialog open={isFiltersDialogOpen} onOpenChange={setIsFiltersDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Filtrer"
                  title="Filtrer"
                  className="h-8 w-8 p-0 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white rounded-lg shrink-0"
                >
                  <Filter className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <EtablissementFilters onClose={() => setIsFiltersDialogOpen(false)} />
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Plus d'options"
                  title="Plus d'options"
                  className="h-8 w-8 p-0 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white rounded-lg shrink-0"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onToggleStats(!showStats)}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {showStats ? 'Masquer KPIs' : 'Afficher KPIs'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={downloadEstablishmentsCsv}>
                  <Download className="h-4 w-4 mr-2" />
                  Exporter CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsSelectionMode(!isSelectionMode)}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  {isSelectionMode ? 'Annuler sélection' : 'Mode sélection'}
                </DropdownMenuItem>
                {canFilterByUser && (
                  <DropdownMenuItem onClick={toggleShowOnlyMine}>
                    {showOnlyMine ? (
                      <ToggleRight className="h-4 w-4 mr-2" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 mr-2" />
                    )}
                    {showOnlyMine ? getToggleText() : 'Tous les établissements'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={invalidateQueries}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualiser
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
    )
  }

  const {
    statutFilter,
    typeFilter,
    dpiFilter,
    regionFilter,
    commercialFilter,
    chefProjetFilter,
    csmFilter,
  } = activeFilterFlags
  const activeFiltersCount = [
    statutFilter,
    typeFilter,
    dpiFilter,
    regionFilter,
    commercialFilter,
    chefProjetFilter,
    csmFilter,
  ].filter(Boolean).length

  return (
    <ImmersivePageHeader
      title="Établissements"
      subtitle="Gestion des clients hospitaliers"
      icon={Building2}
      stats={[
        { label: 'affichés', value: debouncedCount, highlight: true },
        { label: 'total', value: totalCount },
      ]}
      searchPlaceholder="Rechercher établissement..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      onSearchClick={onSearchClick}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleStats(!showStats)}
            aria-label={showStats ? 'Masquer les statistiques' : 'Afficher les statistiques'}
            aria-expanded={showStats}
            title={showStats ? 'Masquer les statistiques' : 'Afficher les statistiques'}
            className="h-9 px-2 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            <ChevronDown
              className={cn('h-3 w-3 ml-1 transition-transform', showStats && 'rotate-180')}
              aria-hidden="true"
            />
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="h-9"
                aria-label="Nouvel établissement"
                title="Nouvel établissement"
              >
                <Plus className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Nouvel établissement</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nouvel établissement</DialogTitle>
                <DialogDescription>
                  Créer une fiche pour un nouveau client hospitalier
                </DialogDescription>
              </DialogHeader>
              <EtablissementForm
                form={form}
                onSubmit={onSubmit}
                onCancel={() => setIsDialogOpen(false)}
                submitLabel="Créer"
                isLoading={createPending}
                allProfiles={allProfiles}
              />
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <CRMToolbar
        searchSlot={
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-white/50" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 bg-card/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50"
            />
          </div>
        }
        unifiedFilters={unifiedFiltersElement}
        viewSelector={<ViewSelector currentView={currentView} onViewChange={onViewChange} />}
        sortMenu={
          <SortMenu
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
        }
        advancedFilters={
          <Dialog open={isFiltersDialogOpen} onOpenChange={setIsFiltersDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={
                  activeFiltersCount > 0
                    ? `Filtres avancés (${activeFiltersCount} actifs)`
                    : 'Filtres avancés'
                }
                title="Filtres avancés"
                className="h-9 px-2 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white"
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
                {activeFiltersCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-4 px-1 text-[10px] bg-card/20 text-white"
                    aria-hidden="true"
                  >
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <EtablissementFilters onClose={() => setIsFiltersDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        }
        moreActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Plus d'options"
                title="Plus d'options"
                className="h-9 px-2 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={downloadEstablishmentsCsv}>
                <Download className="h-4 w-4 mr-2" />
                Exporter CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowFillWithAI(true)} className="text-primary">
                <Sparkles className="h-4 w-4 mr-2" />
                Fill with AI
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsSelectionMode(!isSelectionMode)}>
                <CheckSquare className="h-4 w-4 mr-2" />
                {isSelectionMode ? 'Annuler sélection' : 'Mode sélection'}
              </DropdownMenuItem>
              {canFilterByUser && (
                <DropdownMenuItem onClick={toggleShowOnlyMine}>
                  {showOnlyMine ? (
                    <ToggleRight className="h-4 w-4 mr-2" />
                  ) : (
                    <ToggleLeft className="h-4 w-4 mr-2" />
                  )}
                  {showOnlyMine ? getToggleText() : 'Tous les établissements'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={invalidateQueries}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
    </ImmersivePageHeader>
  )
}
