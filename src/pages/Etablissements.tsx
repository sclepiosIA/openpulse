import React, { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PageDataState } from '@/components/common/PageDataState'
import { debug } from '@/lib/debug'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Search } from 'lucide-react'
import {
  useCreateEtablissement,
  useUpdateEtablissement,
  useDeleteEtablissement,
  type CreateEtablissementData,
  type Etablissement,
} from '@/hooks/crm/useEtablissements'
import { useAllEtablissements } from '@/hooks/crm/useProspects'
import {
  useProfilesWithRoles,
  useCurrentProfileWithRole,
} from '@/hooks/profile/useProfilesWithRoles'
import { useToast } from '@/hooks/shared/use-toast'
import { useIntersectionObserver } from '@/hooks/shared/useIntersectionObserver'
import { useAuth } from '@/components/AuthProvider'
import { useUserPreferences } from '@/hooks/profile/useUserPreferences'
import { CreateEtablissementSchema } from '@/lib/validations'
import { useFilteredEtablissements } from '@/hooks/crm/useFilteredEtablissements'
import { EtablissementDialogs } from '@/components/etablissement/EtablissementDialogs'

import { type EtablissementView } from '@/components/etablissement/ViewSelector'
import { UnifiedFilters } from '@/components/etablissement/UnifiedFilters'
import { BlockedEtablissementsSection } from '@/components/etablissement/BlockedEtablissementsSection'
import { EtablissementsTableView } from '@/components/etablissement/EtablissementsTableView'
import { EtablissementsListView } from '@/components/etablissement/EtablissementsListView'
import { EtablissementsKanbanView } from '@/components/etablissement/EtablissementsKanbanView'
import { EtablissementStatsKPIs } from '@/components/etablissement/EtablissementStatsKPIs'
import { EtablissementsStatsPanel } from '@/components/etablissement/EtablissementsStatsPanel'
import { type SortField, type SortDirection } from '@/components/etablissement/SortMenu'
import { BulkActionsBar } from '@/components/etablissement/BulkActionsBar'
import { FillWithAIDialog } from '@/components/ai/FillWithAIDialog'

import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { exportEtablissementsCsv } from './etablissements/exportEtablissementsCsv'
import { EtablissementsGridView } from './etablissements/EtablissementsGridView'
import { EtablissementsPageHeader } from './etablissements/EtablissementsPageHeader'
import { ViewSwitcher } from '@/components/views/ViewSwitcher'
import type { EntityView } from '@/hooks/views/useEntityViews'

function Etablissements() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const { data: allProfiles } = useProfilesWithRoles()
  const { data: userProfile } = useCurrentProfileWithRole()
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false)
  const [showFillWithAI, setShowFillWithAI] = useState(false)
  const [selectedEtablissement, setSelectedEtablissement] = useState<Etablissement | null>(null)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')

  // Filtres depuis les paramètres URL
  const statutFilter = searchParams.get('statut')
  const typeFilter = searchParams.get('type')
  const dpiFilter = searchParams.get('dpi')
  const regionFilter = searchParams.get('region')
  const commercialFilter = searchParams.get('commercial')
  const chefProjetFilter = searchParams.get('chef_projet')
  const csmFilter = searchParams.get('csm')
  const signatureYearFilter = searchParams.get('signature_year')

  // Gestion des préférences utilisateur
  const { getPreference, updatePreference, isLoading: isLoadingPreferences } = useUserPreferences()

  // Gestion du toggle "Mes établissements" via les préférences BDD
  const showOnlyMine = Boolean(getPreference('etablissements-show-only-mine', false))

  // Gestion de la vue (cartes, tableau, liste, kanban)
  const [currentView, setCurrentView] = useState<EtablissementView>(
    (getPreference('etablissements-view', 'grid') as EtablissementView) || 'grid'
  )

  const handleViewChange = (view: EtablissementView) => {
    setCurrentView(view)
    updatePreference('etablissements-view', view)
  }

  // Gestion du tri
  const [sortField, setSortField] = useState<SortField>(
    (getPreference('etablissements-sort-field', 'nom') as SortField) || 'nom'
  )
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    (getPreference('etablissements-sort-direction', 'asc') as SortDirection) || 'asc'
  )

  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field)
    setSortDirection(direction)
    updatePreference('etablissements-sort-field', field)
    updatePreference('etablissements-sort-direction', direction)
  }

  // Vue sauvegardée active (inspiration Twenty CRM)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const handleApplyView = (view: EntityView | null) => {
    setActiveViewId(view?.id ?? null)
    if (!view) {
      setSearchParams({})
      return
    }
    // Les "filters" sauvegardés sont les query params URL
    const next = new URLSearchParams()
    const filterMap = (view.filters || []) as unknown as Array<{ field: string; value: string }>
    filterMap.forEach((f) => {
      if (f.value) next.set(f.field, String(f.value))
    })
    setSearchParams(next)
    if (view.view_type && ['table', 'list', 'kanban', 'gallery'].includes(view.view_type)) {
      const mapped = view.view_type === 'gallery' ? 'grid' : view.view_type
      setCurrentView(mapped as EtablissementView)
    }
  }

  // Gestion de la sélection multiple
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Stats collapsible state - DOIT être avant tout early return
  const [showStats, setShowStats] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('etab-show-stats') === 'true'
    }
    return false
  })

  const handleToggleStats = (open: boolean) => {
    setShowStats(open)
    localStorage.setItem('etab-show-stats', String(open))
  }

  // Récupérer TOUS les établissements pour assurer la cohérence avec les graphiques
  const { data: allEtablissementsData, isError, error, refetch } = useAllEtablissements()

  // Pour maintenir la compatibilité avec le code existant, transformer les données
  const data = useMemo(() => {
    if (!allEtablissementsData) return undefined
    return {
      pages: [{ data: allEtablissementsData }],
      pageParams: [0],
    }
  }, [allEtablissementsData])

  const isLoading = !allEtablissementsData && !isError
  const fetchNextPage = () => {} // Pas besoin de pagination avec toutes les données
  const hasNextPage = false
  const isFetchingNextPage = false
  const createEtablissement = useCreateEtablissement()
  const updateEtablissement = useUpdateEtablissement()
  const deleteEtablissement = useDeleteEtablissement()

  // Intersection observer pour le scroll infini avec protection
  const { ref: loadMoreRef, inView } = useIntersectionObserver({
    threshold: 0,
    rootMargin: '100px',
    triggerOnce: false,
  })

  // Debounce search term — 150 ms pour rendre la liste réactive (audit UX)
  // tout en évitant les requêtes intermédiaires. Application immédiate si la
  // recherche est vidée pour ne pas laisser un état filtré obsolète à l'écran.
  useEffect(() => {
    if (searchTerm === '') {
      setDebouncedSearchTerm('')
      return
    }
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 150)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Déclencher le chargement de la page suivante quand on atteint le bas
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const etablissements = useFilteredEtablissements({
    source: data?.pages.flatMap((p) => p.data),
    debouncedSearchTerm,
    showOnlyMine,
    userProfile,
    statutFilter,
    typeFilter,
    dpiFilter,
    regionFilter,
    commercialFilter,
    chefProjetFilter,
    csmFilter,
    signatureYearFilter,
    smartFilter: searchParams.get('smart_filter'),
    sortField,
    sortDirection,
  })

  // Fonction pour enlever les filtres (URL + recherche locale)
  const clearFilters = () => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.delete('statut')
    newSearchParams.delete('type')
    newSearchParams.delete('dpi')
    newSearchParams.delete('region')
    newSearchParams.delete('commercial')
    newSearchParams.delete('chef_projet')
    newSearchParams.delete('csm')
    newSearchParams.delete('signature_year')
    newSearchParams.delete('smart_filter')
    setSearchParams(newSearchParams)
    // Reset également la recherche locale (fix audit CSM : "Cambrai" résiduel)
    setSearchTerm('')
    setDebouncedSearchTerm('')
  }

  const clearStatutFilter = () => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.delete('statut')
    setSearchParams(newSearchParams)
  }

  // Fonction pour gérer le toggle et sauvegarder en base de données
  const toggleShowOnlyMine = () => {
    const newValue = !showOnlyMine
    updatePreference('etablissements-show-only-mine', newValue)
  }

  // Purge des sélections devenues invisibles après filtre/recherche
  useEffect(() => {
    if (selectedIds.size === 0) return
    const visible = new Set(etablissements.map((e) => e.id))
    const next = new Set<string>()
    let changed = false
    selectedIds.forEach((id) => {
      if (visible.has(id)) next.add(id)
      else changed = true
    })
    if (changed) setSelectedIds(next)
  }, [etablissements, selectedIds])

  // Gestion de la sélection multiple
  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
    setIsSelectionMode(false)
  }

  const handleBulkExport = () => {
    const selectedEtabs = etablissements.filter((e) => selectedIds.has(e.id))
    // Logique d'export...
    toast({
      title: 'Export en cours',
      description: `${selectedEtabs.length} établissements sélectionnés`,
    })
  }

  const handleBulkDelete = () => {
    if (confirm(`Supprimer ${selectedIds.size} établissements ?`)) {
      // Logique de suppression...
      toast({
        title: 'Suppression en cours',
        description: `${selectedIds.size} établissements`,
      })
    }
  }

  const handleBulkChangeStatut = () => {
    toast({
      title: 'Changement de statut',
      description: `${selectedIds.size} établissements sélectionnés`,
    })
  }

  // Vérifier si l'utilisateur peut utiliser le filtre "Mes établissements"
  const canFilterByUser =
    userProfile && ['commercial', 'chef_projet', 'csm'].includes(userProfile.role)

  // Texte du toggle selon le rôle
  const getToggleText = () => {
    if (!userProfile) return 'Mes établissements'
    switch (userProfile.role) {
      case 'commercial':
        return 'Mes clients'
      case 'chef_projet':
        return 'Mes projets'
      case 'csm':
        return 'Mes comptes'
      default:
        return 'Mes établissements'
    }
  }

  const form = useForm<CreateEtablissementData>({
    resolver: zodResolver(CreateEtablissementSchema),
    mode: 'onBlur',
    defaultValues: {
      nom: '',
      type: 'CHU',
      ville: '',
      region: '',
      date_prise_contact: new Date().toISOString().split('T')[0],
      date_signature: new Date().toISOString().split('T')[0],
      adresse: '',
      code_postal: '',
      telephone: '',
      email: '',
      date_fin_contrat: '',
      commercial_id: '',
      chef_projet_id: '',
      csm_id: '',
      type_offre: '',
      notes: '',
    },
  })

  const editForm = useForm<CreateEtablissementData>({
    resolver: zodResolver(CreateEtablissementSchema),
    mode: 'onBlur',
    defaultValues: {
      nom: '',
      type: 'CHU',
      ville: '',
      region: '',
      date_prise_contact: new Date().toISOString().split('T')[0],
      date_signature: new Date().toISOString().split('T')[0],
      adresse: '',
      code_postal: '',
      telephone: '',
      email: '',
      date_fin_contrat: '',
      commercial_id: '',
      chef_projet_id: '',
      csm_id: '',
      type_offre: '',
      notes: '',
    },
  })

  const onSubmit = async (data: CreateEtablissementData) => {
    try {
      await createEtablissement.mutateAsync(data)
      setIsDialogOpen(false)
      form.reset()
    } catch (error) {
      debug.error('Error creating etablissement:', error)
    }
  }

  const onEditSubmit = async (data: CreateEtablissementData) => {
    if (!selectedEtablissement) return
    try {
      await updateEtablissement.mutateAsync({
        id: selectedEtablissement.id,
        data,
      })
      setIsEditDialogOpen(false)
      setSelectedEtablissement(null)
      editForm.reset()
    } catch (error) {
      debug.error('Error updating etablissement:', error)
    }
  }

  const openEditDialog = (etablissement: Etablissement) => {
    setSelectedEtablissement(etablissement)
    editForm.reset({
      nom: etablissement.nom,
      type: etablissement.type,
      ville: etablissement.ville,
      region: etablissement.region,
      date_prise_contact:
        etablissement.date_prise_contact || new Date().toISOString().split('T')[0],
      date_signature: etablissement.date_signature,
      date_fin_contrat: etablissement.date_fin_contrat || '',
      commercial_id: etablissement.commercial_id || '',
      chef_projet_id: etablissement.chef_projet_id || '',
      csm_id: etablissement.csm_id || '',
      adresse: etablissement.adresse || '',
      code_postal: etablissement.code_postal || '',
      telephone: etablissement.telephone,
      email: etablissement.email,
      type_offre: etablissement.type_offre,
      notes: etablissement.notes,
    })
    setIsEditDialogOpen(true)
  }

  const downloadEstablishmentsCsv = () => {
    const filename = exportEtablissementsCsv(etablissements)
    if (!filename) {
      toast({
        title: 'Aucune donnée',
        description: "Il n'y a aucun établissement à exporter",
        variant: 'destructive',
      })
      return
    }
    toast({
      title: 'Export réussi',
      description: `Fichier ${filename} téléchargé avec succès`,
    })
  }

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'Contractuel':
        return <Badge variant="secondary">Contractuel</Badge>
      case 'Conformité':
        return <Badge className="bg-warning text-warning-foreground">Conformité</Badge>
      case 'Déploiement':
        return <Badge className="bg-primary text-primary-foreground">Déploiement</Badge>
      case 'Formation':
        return <Badge className="bg-accent text-accent-foreground">Formation</Badge>
      case 'Go-Live':
        return <Badge className="bg-success text-success-foreground">Go-Live</Badge>
      case 'Production':
        return <Badge className="bg-success text-success-foreground">Production</Badge>
      default:
        return <Badge variant="outline">{statut}</Badge>
    }
  }

  const getTypeIcon = (type: string) => {
    return <Building2 className="w-4 h-4" />
  }

  // Mémoisation du composant UnifiedFilters - DOIT être avant tout early return
  const unifiedFiltersElement = useMemo(
    () => (
      <UnifiedFilters
        etablissements={allEtablissementsData || []}
        allCount={allEtablissementsData?.length || 0}
      />
    ),
    [allEtablissementsData]
  )

  // Early return pour loading/erreur - TOUS les hooks doivent être AVANT cette ligne
  if (isLoading || isError) {
    return (
      <PageDataState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
      >
        {null}
      </PageDataState>
    )
  }

  // État courant des filtres reconstruit à partir des searchParams (pour sauvegarde de vue)
  const currentViewState = {
    filters: Array.from(searchParams.entries()).map(([field, value]) => ({
      field,
      value,
      operator: 'eq' as const,
    })),
    sort: [{ field: sortField, direction: sortDirection }],
    columns: [],
    view_type: (currentView === 'grid' ? 'gallery' : currentView) as
      | 'table'
      | 'kanban'
      | 'list'
      | 'gallery',
  }

  return (
    <div className="min-h-dvh bg-gradient-page">
      <div className="px-4 pt-3 flex items-center gap-2 border-b border-border/40 bg-background/60 backdrop-blur">
        <ViewSwitcher
          entity="etablissements"
          activeViewId={activeViewId}
          currentState={currentViewState}
          onApplyView={handleApplyView}
        />
      </div>
      <EtablissementsPageHeader
        isMobile={isMobile}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        debouncedCount={etablissements?.length || 0}
        totalCount={allEtablissementsData?.length || 0}
        allEtablissementsData={allEtablissementsData}
        showStats={showStats}
        onToggleStats={handleToggleStats}
        currentView={currentView}
        onViewChange={handleViewChange}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        isFiltersDialogOpen={isFiltersDialogOpen}
        setIsFiltersDialogOpen={setIsFiltersDialogOpen}
        isDialogOpen={isDialogOpen}
        setIsDialogOpen={setIsDialogOpen}
        isImportDialogOpen={isImportDialogOpen}
        setIsImportDialogOpen={setIsImportDialogOpen}
        isSelectionMode={isSelectionMode}
        setIsSelectionMode={setIsSelectionMode}
        showFillWithAI={showFillWithAI}
        setShowFillWithAI={setShowFillWithAI}
        canFilterByUser={canFilterByUser}
        showOnlyMine={showOnlyMine}
        toggleShowOnlyMine={toggleShowOnlyMine}
        getToggleText={getToggleText}
        downloadEstablishmentsCsv={downloadEstablishmentsCsv}
        invalidateQueries={() => queryClient.invalidateQueries({ queryKey: ['etablissements'] })}
        unifiedFiltersElement={unifiedFiltersElement}
        onSearchClick={() => setShowGlobalSearch(true)}
        form={form}
        onSubmit={onSubmit}
        createPending={createEtablissement.isPending}
        allProfiles={allProfiles}
        activeFilterFlags={{
          statutFilter,
          typeFilter,
          dpiFilter,
          regionFilter,
          commercialFilter,
          chefProjetFilter,
          csmFilter,
        }}
      />

      <EtablissementDialogs
        createOpen={isDialogOpen}
        onCreateOpenChange={setIsDialogOpen}
        createForm={form}
        onCreate={onSubmit}
        createPending={createEtablissement.isPending}
        editOpen={isEditDialogOpen}
        onEditOpenChange={setIsEditDialogOpen}
        editForm={editForm}
        onEdit={onEditSubmit}
        editPending={updateEtablissement.isPending}
        importOpen={isImportDialogOpen}
        onImportOpenChange={setIsImportDialogOpen}
        allProfiles={allProfiles}
      />

      {/* Global Search Dialog */}
      <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />

      {/* Contenu principal avec padding */}
      <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Filtres actifs - compact */}
        {(typeFilter ||
          dpiFilter ||
          regionFilter ||
          commercialFilter ||
          chefProjetFilter ||
          csmFilter ||
          signatureYearFilter) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="text-[10px] h-5">
              {
                [
                  typeFilter,
                  dpiFilter,
                  regionFilter,
                  commercialFilter,
                  chefProjetFilter,
                  csmFilter,
                  signatureYearFilter,
                ].filter(Boolean).length
              }{' '}
              filtres avancés
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-5 text-[10px] px-1.5"
            >
              Effacer
            </Button>
          </div>
        )}

        {/* Stats collapsibles (masquées par défaut) */}
        <Collapsible open={showStats} onOpenChange={handleToggleStats}>
          <CollapsibleContent className="space-y-3">
            <EtablissementStatsKPIs
              etablissements={allEtablissementsData || []}
              totalEtablissements={allEtablissementsData?.length || 0}
            />
            <EtablissementsStatsPanel etablissements={allEtablissementsData || []} />
          </CollapsibleContent>
        </Collapsible>

        {/* Vues conditionnelles selon le sélecteur */}

        {currentView === 'table' && (
          <EtablissementsTableView etablissements={etablissements} profiles={allProfiles} />
        )}

        {currentView === 'list' && <EtablissementsListView etablissements={etablissements} />}

        {currentView === 'kanban' && <EtablissementsKanbanView etablissements={etablissements} />}

        {/* Vue par défaut : Cartes (grid) */}
        {currentView === 'grid' && (
          <EtablissementsGridView
            etablissements={etablissements}
            allEtablissementsData={allEtablissementsData}
            allProfiles={allProfiles}
            isSelectionMode={isSelectionMode}
            selectedIds={selectedIds}
            isLoading={isLoading}
            isFetchingNextPage={isFetchingNextPage}
            searchTerm={searchTerm}
            loadMoreRef={loadMoreRef}
            onSelect={handleSelect}
            onEdit={openEditDialog}
            onDelete={(etab: Etablissement) => {
              if (confirm(`Supprimer "${etab.nom}" ?`)) {
                deleteEtablissement.mutate(etab.id)
              }
            }}
            onCreateClick={() => setIsDialogOpen(true)}
          />
        )}

        {/* Barre d'actions groupées */}
        <BulkActionsBar
          selectedCount={selectedIds.size}
          onClearSelection={handleClearSelection}
          onExport={handleBulkExport}
          onDelete={handleBulkDelete}
          onChangeStatut={handleBulkChangeStatut}
        />

        <FillWithAIDialog
          open={showFillWithAI}
          onOpenChange={setShowFillWithAI}
          entityType="etablissements"
          items={etablissements.map((e) => ({
            id: e.id,
            nom: e.nom,
            ville: e.ville,
            region: e.region,
            statut: e.statut,
            type: (e as any).type,
            dpi: e.dpi,
            ca_mensuel: (e as any).ca_mensuel,
          }))}
        />

        {/* Section établissements bloqués - compacte */}
        {allEtablissementsData && (
          <BlockedEtablissementsSection etablissements={allEtablissementsData} />
        )}
      </div>
    </div>
  )
}

export default Etablissements
