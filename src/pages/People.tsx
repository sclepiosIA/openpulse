import { useState, useEffect, useMemo } from 'react'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { useSearchParams, useLocation } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  DollarSign,
  Calendar,
  CalendarCheck,
  FileText,
  GraduationCap,
  Target,
  ClipboardCheck,
  AlertTriangle,
  BarChart3,
  UserPlus,
  Keyboard,
  Clock,
} from 'lucide-react'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { PeopleMobileHeader } from '@/components/people/PeopleMobileHeader'
import { PeopleTabsCompact } from '@/components/people/PeopleTabsCompact'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { PageDataState } from '@/components/common/PageDataState'
import { PeopleOverview } from '@/components/people/PeopleOverview'
import { RHSalairesTable } from '@/components/rh/RHSalairesTable'
import { RHKPIsEnriched } from '@/components/rh/RHKPIsEnriched'

import { RHDossierEmploye } from '@/components/rh/RHDossierEmploye'
import { RHPlanningAbsencesVisuel } from '@/components/rh/RHPlanningAbsencesVisuel'
import { RHDemandeConge } from '@/components/rh/RHDemandeConge'
import { RHValidationConges } from '@/components/rh/RHValidationConges'
import { RHDemandeFormation } from '@/components/rh/RHDemandeFormation'
import { RHBudgetFormation } from '@/components/rh/RHBudgetFormation'
import { RHObjectifsIndividuels } from '@/components/rh/RHObjectifsIndividuels'
import { RHEntretienDetail } from '@/components/rh/RHEntretienDetail'
import { UnifiedCalendar } from '@/components/shared/UnifiedCalendar'
import { useNavigationShortcuts } from '@/hooks/ui/useKeyboardShortcuts'
import { useRolePermissions } from '@/hooks/auth/useRolePermissions'
import { RHAccessGuard } from '@/components/security/RHAccessGuard'
import { RouteGuard } from '@/components/security/RouteGuard'
import { TeamMemberCard } from '@/components/equipe/TeamMemberCard'
import { TeamTableView } from '@/components/equipe/TeamTableView'
import { TeamFiltersBar } from '@/components/equipe/TeamFiltersBar'
import { TeamMemberDetailDialog } from '@/components/equipe/TeamMemberDetailDialog'
import { usePeopleData, type EnrichedProfile } from '@/hooks/hr/usePeopleData'
import { useTeamFilters } from '@/hooks/hr/useTeamFilters'
import { CardSkeleton } from '@/components/shared/LoadingStates'
import { applyTeamFilters } from '@/lib/teamFilters'
import { useTabBreadcrumb } from '@/hooks/ui/useTabBreadcrumb'
import { TAB_LABELS } from '@/config/tabLabels'
import { AddUserDialog } from '@/components/people/AddUserDialog'
import { KeyboardShortcutsHelp } from '@/components/shared/KeyboardShortcutsHelp'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { TimeTracker } from '@/components/rh/TimeTracker'
import { CollapsibleKPISection, KPIToggleButton } from '@/components/shared/CollapsibleKPISection'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const PEOPLE_TABS = [
  { value: 'analyses', label: 'Analyses RH', icon: BarChart3, permission: 'canViewSalaries' },
  { value: 'equipe', label: 'Équipe', icon: Users, permission: 'canViewAllTeamMembers' },
  { value: 'salaires', label: 'Salaires', icon: DollarSign, permission: 'canViewSalaries' },
  { value: 'temps', label: 'Temps', icon: Clock, permission: null },
  { value: 'planning', label: 'Planning', icon: Calendar, permission: null },
  { value: 'conges', label: 'Congés', icon: CalendarCheck, permission: null },
  { value: 'objectifs', label: 'Objectifs', icon: Target, permission: null },
  { value: 'formations', label: 'Formations', icon: GraduationCap, permission: null },
  {
    value: 'entretiens',
    label: 'Entretiens',
    icon: ClipboardCheck,
    permission: 'canViewRHDocuments',
  },
  { value: 'fiches', label: 'Dossiers RH', icon: FileText, permission: 'canViewRHDocuments' },
]

export default function People() {
  usePageTitle('People')
  const location = useLocation()
  const permissions = useRolePermissions()
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'analyses'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'calendar'>('cards')
  const [selectedProfile, setSelectedProfile] = useState<EnrichedProfile | null>(null)
  const isMobile = useIsMobile()
  const showGlobalNav = !location.pathname.startsWith('/m/')

  // Hook unifié pour toutes les données People
  const {
    profiles: enrichedProfiles,
    rhKpis,
    currentUserId,
    isLoading: peopleLoading,
    isError: peopleError,
    refetch: refetchPeople,
  } = usePeopleData()
  const { filters, updateFilter, resetFilters } = useTeamFilters()

  // Gérer le changement d'onglet avec URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // Intégration fil d'Ariane avec label dynamique selon le mode de vue
  const subLabel =
    activeTab === 'equipe' && viewMode !== 'cards'
      ? TAB_LABELS.people.subViews[viewMode]
      : undefined

  useTabBreadcrumb(
    {
      pageLabel: TAB_LABELS.people.pageLabel,
      parentPath: '/people',
      tabLabels: TAB_LABELS.people.tabs,
      onTabChange: handleTabChange,
    },
    activeTab,
    subLabel
  )

  // Filtrer les profils selon le scope de l'utilisateur
  const visibleProfiles = useMemo(() => {
    if (!enrichedProfiles) return []

    if (permissions.viewScope === 'all') {
      return enrichedProfiles
    } else if (permissions.viewScope === 'managed') {
      // Filtrer les profils avec des projets assignés
      return enrichedProfiles.filter((p) => p.assignedProjects.length > 0)
    } else {
      // Scope 'own' - uniquement le profil de l'utilisateur connecté
      if (!currentUserId) return []
      return enrichedProfiles.filter((p) => p.user_id === currentUserId)
    }
  }, [enrichedProfiles, permissions.viewScope, currentUserId])

  // Appliquer les filtres
  const filteredProfiles = useMemo(() => {
    const statsMap = visibleProfiles.reduce<Record<string, (typeof visibleProfiles)[0]['stats']>>(
      (acc, p) => {
        acc[p.id] = p.stats
        return acc
      },
      {}
    )
    return applyTeamFilters(visibleProfiles, filters, statsMap)
  }, [visibleProfiles, filters])

  // Type for permission keys
  type PermissionKey = keyof typeof permissions

  // Onglets disponibles selon permissions
  const availableTabs = useMemo(() => {
    return PEOPLE_TABS.filter((tab) => {
      if (!tab.permission) return true
      return permissions[tab.permission as PermissionKey]
    }).map((t) => t.value)
  }, [permissions])

  // Onglets filtrés pour l'affichage
  const displayedTabs = useMemo(() => {
    return PEOPLE_TABS.filter((tab) => {
      if (!tab.permission) return true
      return permissions[tab.permission as PermissionKey]
    })
  }, [permissions])

  // S'assurer que l'onglet actif est disponible
  useEffect(() => {
    if (!availableTabs.includes(activeTab) && availableTabs.length > 0) {
      handleTabChange(availableTabs[0])
    }
  }, [availableTabs, activeTab])

  // Raccourcis clavier
  useNavigationShortcuts(availableTabs, activeTab, handleTabChange)

  const handleViewDetails = (profile: EnrichedProfile) => {
    setSelectedProfile(profile)
  }

  const getAssignedProjects = (profileId: string) => {
    const profile = enrichedProfiles?.find((p) => p.id === profileId)
    return profile?.assignedProjects || []
  }

  const activeTabData = displayedTabs.find((t) => t.value === activeTab)

  // Mobile toolbar with compact tabs
  const mobileToolbar = (
    <PeopleTabsCompact
      activeTab={activeTab}
      onTabChange={handleTabChange}
      canViewSalaries={permissions.canViewSalaries}
    />
  )

  // Get role label for mobile header
  const getRoleLabel = () => {
    if (permissions.isAdmin) return 'Admin'
    if (permissions.role === 'chef_projet') return 'Chef de Projet'
    if (permissions.role === 'csm') return 'CSM'
    if (permissions.role === 'commercial') return 'Commercial'
    return permissions.role || undefined
  }

  if (peopleError) {
    return (
      <RouteGuard allowedTeams={['direction']}>
        <PageDataState isLoading={false} isError={true} onRetry={() => refetchPeople()}>
          <></>
        </PageDataState>
      </RouteGuard>
    )
  }

  return (
    <RouteGuard allowedTeams={['direction']}>
      <div className="min-h-dvh bg-gradient-page">
        {/* Header - Mobile vs Desktop */}
        {isMobile ? (
          <PeopleMobileHeader
            stats={{
              membres: visibleProfiles.length,
            }}
            roleLabel={getRoleLabel()}
            onSearchClick={() => setShowGlobalSearch(true)}
            onAddUser={permissions.isAdmin ? () => setShowAddUser(true) : undefined}
            toolbar={mobileToolbar}
            showGlobalNav={showGlobalNav}
          />
        ) : (
          <ImmersivePageHeader
            title="Gestion des Ressources"
            subtitle={
              permissions.isLoading
                ? 'Chargement des permissions...'
                : permissions.isAdmin
                  ? 'Vue complète RH, équipe et salaires'
                  : permissions.role === 'rh'
                    ? 'Périmètre RH : employés, absences, congés, paie et masse salariale'
                    : permissions.canViewAllTeamMembers
                      ? "Gestion de l'équipe et du planning"
                      : `Périmètre limité à vos projets — pour étendre l'accès, contactez un administrateur`
            }
            icon={Users}
            stats={[{ label: 'membres', value: visibleProfiles.length, highlight: true }]}
            searchPlaceholder="Rechercher collaborateur..."
            onSearchClick={() => setShowGlobalSearch(true)}
            actions={
              <>
                {!permissions.isAdmin && permissions.role && (
                  <Badge
                    variant="outline"
                    className="text-xs hidden sm:inline-flex bg-card/10 border-white/20 text-white"
                  >
                    {permissions.role === 'chef_projet'
                      ? 'Chef de Projet'
                      : permissions.role === 'csm'
                        ? 'CSM'
                        : permissions.role === 'commercial'
                          ? 'Commercial'
                          : permissions.role}
                  </Badge>
                )}
                <KPIToggleButton storageKey="people-kpis-visible" label="KPIs" showIcon={true} />
                {permissions.isAdmin && (
                  <Button
                    onClick={() => setShowAddUser(true)}
                    variant="ghost"
                    size="sm"
                    className="touch-target-min h-9 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white"
                  >
                    <UserPlus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Ajouter</span>
                  </Button>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowShortcuts(true)}
                        aria-label="Raccourcis clavier"
                        className="touch-target-min hidden sm:flex h-9 w-9 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white"
                      >
                        <Keyboard className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Raccourcis clavier (Ctrl+?)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            }
          />
        )}

        {/* Global Search Dialog */}
        <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />

        <div className="px-3 sm:px-4 lg:px-6 space-y-4 sm:space-y-6">
          {/* Stats globales - Collapsible */}
          <CollapsibleKPISection storageKey="people-kpis-visible" defaultOpen={!isMobile}>
            <PeopleOverview context={activeTab === 'equipe' ? 'equipe' : 'rh'} />
          </CollapsibleKPISection>

          {/* Alertes de cohérence des données */}
          {enrichedProfiles && activeTab === 'analyses' && !isMobile && (
            <div className="space-y-2">
              {enrichedProfiles.filter(
                (p) => p.stats.totalTasks === 0 && p.stats.totalProjects === 0
              ).length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Profils sans activité</AlertTitle>
                  <AlertDescription>
                    {
                      enrichedProfiles.filter(
                        (p) => p.stats.totalTasks === 0 && p.stats.totalProjects === 0
                      ).length
                    }{' '}
                    membre(s) n'ont ni tâches ni projets assignés
                  </AlertDescription>
                </Alert>
              )}

              {enrichedProfiles.filter((p) => !p.role).length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Rôles non assignés</AlertTitle>
                  <AlertDescription>
                    {enrichedProfiles.filter((p) => !p.role).length} membre(s) n'ont pas de rôle
                    défini
                  </AlertDescription>
                </Alert>
              )}

              {permissions.canViewSalaries &&
                rhKpis &&
                rhKpis.effectif_actif !== rhKpis.effectif_total && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Données salariales incomplètes</AlertTitle>
                    <AlertDescription>
                      {rhKpis.effectif_total - rhKpis.effectif_actif} employé(s) sans données
                      salariales ce mois-ci
                    </AlertDescription>
                  </Alert>
                )}
            </div>
          )}

          {/* Onglets principaux */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            {/* Desktop: Horizontal tabs - only show on desktop since mobile uses header tabs */}
            {!isMobile && (
              <TabsList className="flex w-full overflow-x-auto gap-1">
                {permissions.canViewSalaries && (
                  <TabsTrigger value="analyses" className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    <span>Analyses RH</span>
                  </TabsTrigger>
                )}

                {permissions.canViewAllTeamMembers && (
                  <TabsTrigger value="equipe" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Équipe</span>
                  </TabsTrigger>
                )}

                {permissions.canViewSalaries && (
                  <TabsTrigger value="salaires" className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    <span>Salaires</span>
                  </TabsTrigger>
                )}

                <TabsTrigger value="temps" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Temps</span>
                </TabsTrigger>

                <TabsTrigger value="planning" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Planning</span>
                </TabsTrigger>

                <TabsTrigger value="conges" className="flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4" />
                  <span>Congés</span>
                </TabsTrigger>

                <TabsTrigger value="objectifs" className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  <span>Objectifs</span>
                </TabsTrigger>

                <TabsTrigger value="formations" className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  <span>Formations</span>
                </TabsTrigger>

                {permissions.canViewRHDocuments && (
                  <TabsTrigger value="entretiens" className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4" />
                    <span>Entretiens</span>
                  </TabsTrigger>
                )}

                {permissions.canViewRHDocuments && (
                  <TabsTrigger value="fiches" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>Dossiers RH</span>
                  </TabsTrigger>
                )}
              </TabsList>
            )}

            <TabsContent value="analyses">
              <RHAccessGuard requiredPermission="canViewSalaries">
                <RHKPIsEnriched />
              </RHAccessGuard>
            </TabsContent>

            <TabsContent value="equipe">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold line-clamp-1">
                      Gestion de l'équipe
                    </h2>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {filteredProfiles.length} membre{filteredProfiles.length > 1 ? 's' : ''}{' '}
                      affiché{filteredProfiles.length > 1 ? 's' : ''}
                      {filteredProfiles.length !== visibleProfiles.length &&
                        ` (sur ${visibleProfiles.length})`}
                    </p>
                  </div>

                  <div className="w-full sm:w-auto">
                    <Tabs
                      value={viewMode}
                      onValueChange={(v) => setViewMode(v as any)}
                      className="w-full sm:w-auto"
                    >
                      <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
                        <TabsTrigger value="cards" className="text-xs sm:text-sm">
                          Cartes
                        </TabsTrigger>
                        <TabsTrigger value="table" className="text-xs sm:text-sm">
                          Tableau
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="text-xs sm:text-sm">
                          Calendrier
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                {(viewMode === 'cards' || viewMode === 'table') && (
                  <TeamFiltersBar
                    filters={filters}
                    onFilterChange={updateFilter}
                    onReset={resetFilters}
                  />
                )}

                {peopleLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <CardSkeleton key={`people-card-skeleton-${i}`} />
                    ))}
                  </div>
                ) : (viewMode === 'cards' || viewMode === 'table') &&
                  filteredProfiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg">
                    <Users className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">
                      Aucun membre ne correspond à votre recherche
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Modifiez vos filtres ou réinitialisez la recherche.
                    </p>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-4 text-xs underline text-primary hover:opacity-80"
                    >
                      Réinitialiser les filtres
                    </button>
                  </div>
                ) : viewMode === 'cards' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProfiles.map((profile) => {
                      return (
                        <TeamMemberCard
                          key={profile.id}
                          profile={profile}
                          stats={profile.stats}
                          assignedProjects={profile.assignedProjects}
                          onViewDetails={() => handleViewDetails(profile)}
                        />
                      )
                    })}
                  </div>
                ) : viewMode === 'table' ? (
                  <TeamTableView
                    profiles={filteredProfiles.map((p) => ({
                      id: p.id,
                      prenom: p.prenom,
                      nom: p.nom,
                      email: p.email,
                      role: p.role,
                      actif: p.actif,
                      fonction: p.fonction,
                    }))}
                    stats={filteredProfiles.reduce(
                      (acc, p) => {
                        acc[p.id] = p.stats
                        return acc
                      },
                      {} as Record<string, (typeof filteredProfiles)[0]['stats']>
                    )}
                    onViewDetails={(profile) => {
                      const fullProfile = filteredProfiles.find((fp) => fp.id === profile.id)
                      if (fullProfile) handleViewDetails(fullProfile)
                    }}
                  />
                ) : (
                  <UnifiedCalendar showTasks={true} showAbsences={permissions.canViewAllAbsences} />
                )}
              </div>
            </TabsContent>

            <TabsContent value="salaires">
              <RHAccessGuard requiredPermission="canViewSalaries">
                <RHSalairesTable />
              </RHAccessGuard>
            </TabsContent>

            <TabsContent value="temps">
              <TimeTracker />
            </TabsContent>

            <TabsContent value="planning">
              <RHPlanningAbsencesVisuel />
            </TabsContent>

            <TabsContent value="conges">
              <div className="space-y-6">
                <RHDemandeConge />
                {permissions.canViewAllAbsences && <RHValidationConges />}
              </div>
            </TabsContent>

            <TabsContent value="objectifs">
              <RHObjectifsIndividuels />
            </TabsContent>

            <TabsContent value="formations">
              <div className="space-y-6">
                <RHDemandeFormation />
                {permissions.canViewSalaries && <RHBudgetFormation />}
              </div>
            </TabsContent>

            <TabsContent value="entretiens">
              <RHAccessGuard requiredPermission="canViewRHDocuments">
                <RHEntretienDetail />
              </RHAccessGuard>
            </TabsContent>

            <TabsContent value="fiches">
              <RHAccessGuard requiredPermission="canViewRHDocuments">
                <RHDossierEmploye />
              </RHAccessGuard>
            </TabsContent>
          </Tabs>
        </div>

        {/* Dialogs */}
        <AddUserDialog open={showAddUser} onOpenChange={setShowAddUser} />
        <KeyboardShortcutsHelp open={showShortcuts} onOpenChange={setShowShortcuts} />

        {selectedProfile && (
          <TeamMemberDetailDialog
            profile={selectedProfile}
            stats={selectedProfile.stats}
            open={!!selectedProfile}
            onOpenChange={(open) => !open && setSelectedProfile(null)}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </RouteGuard>
  )
}
