import React, { useState, useMemo, useEffect } from 'react'
import { PageDataState } from '@/components/common/PageDataState'
import { debug } from '@/lib/debug'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import type { SelectedTacheData } from '@/types/ui-states'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Building2,
  CheckCircle,
  Clock,
  AlertTriangle,
  List,
  LayoutGrid,
  Table2,
  BarChart3,
  FolderKanban,
} from 'lucide-react'
import { useTaches, useUpdateTache } from '@/hooks/tasks/useTaches'
import { useEtablissements } from '@/hooks/crm/useEtablissements'
import { useProfiles, useCurrentProfile } from '@/hooks/profile/useProfiles'
import { getPhaseByStatus } from '@/config/phases'
import { useAllPortalTasksForProjets } from '@/hooks/tasks/useAllPortalTasksForProjets'
import {
  useUpdateClientPortalTask,
  type ClientPortalTaskStatus,
} from '@/hooks/portail/useClientPortalTasks'
import { TasksListView } from '@/components/projets/TasksListView'
import { MultiProjectKanbanView } from '@/components/projets/MultiProjectKanbanView'
import { TasksAnalyticsView } from '@/components/projets/TasksAnalyticsView'
import { TasksTableView } from '@/components/projets/TasksTableView'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { ProjetsMobileHeader } from '@/components/projets/ProjetsMobileHeader'
import { ProjetsTabsCompact } from '@/components/projets/ProjetsTabsCompact'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { useUserPreferences } from '@/hooks/profile/useUserPreferences'
import { useIsMobile } from '@/hooks/ui/use-mobile'
// Wrapper pour protéger contre les erreurs de contexte
function ProjetsContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { getPreference, updatePreference } = useUserPreferences()
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const isMobile = useIsMobile()
  const showGlobalNav = !location.pathname.startsWith('/m/')

  // Fonction pour générer une couleur unique pour chaque établissement
  const getEtablissementColor = (etablissementId: string, etablissementNom: string) => {
    if (!etablissementId || !etablissementNom) {
      return 'hsl(var(--primary))'
    }

    const hash = etablissementId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc)
    }, 0)

    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 70%, 45%)`
  }

  // Fonction pour obtenir la couleur de statut
  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'Terminé':
        return 'bg-green-500'
      case 'En cours':
        return 'bg-blue-500'
      case 'Bloqué':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [filterPhase, setFilterPhase] = useState('all')
  const [filterResponsable, setFilterResponsable] = useState('all')
  const [selectedTache, setSelectedTache] = useState<SelectedTacheData | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const { data: taches, isLoading, isError: tachesError, refetch: refetchTaches } = useTaches()
  const { data: portalTasks } = useAllPortalTasksForProjets()
  const { data: etablissements } = useEtablissements()
  const { data: profiles } = useProfiles()
  const { data: currentProfile } = useCurrentProfile()
  const updateTache = useUpdateTache()
  const updatePortalTask = useUpdateClientPortalTask()

  // Fusion : tâches internes + tâches portail (marque, non terminées) mappées
  const mergedTaches = useMemo(() => {
    // Note: union laxiste assumée (champs runtime compatibles via vues filtrées en aval)
    const list: any[] = [...(taches ?? [])]
    if (portalTasks && portalTasks.length > 0) {
      list.push(...portalTasks)
    }
    return list
  }, [taches, portalTasks])

  // Appliquer le filtre depuis l'URL au chargement
  useEffect(() => {
    const filter = searchParams.get('filter')
    if (filter) {
      setActiveFilter(filter)
    }
  }, [searchParams])

  // ✅ HOOK CRITIQUE : useMemo doit être appelé AVANT tout return conditionnel
  const filteredTaches = useMemo(() => {
    if (!mergedTaches) return []

    let filtered = mergedTaches

    // 🚫 Exclure les tâches des établissements en phase Prospect (commercial)
    // On garde les tâches globales (sans établissement) et celles en déploiement/production
    if (etablissements && etablissements.length > 0) {
      const etabPhaseMap = new Map(etablissements.map((e) => [e.id, getPhaseByStatus(e.statut)]))
      filtered = filtered.filter((tache) => {
        if (!tache.etablissement_id) return true // tâches globales
        const phase = etabPhaseMap.get(tache.etablissement_id)
        if (!phase) return true // établissement inconnu/hors-pipeline → on garde
        return phase !== 'commercial' // exclure phase prospect
      })
    }

    // Appliquer le filtre spécial depuis l'URL
    if (activeFilter === 'urgent') {
      const now = Date.now()
      filtered = filtered.filter((tache) => {
        if (tache.statut === 'Terminé' || !tache.echeance) return false
        const echeance = new Date(tache.echeance).getTime()
        const diffDays = Math.ceil((echeance - now) / (1000 * 60 * 60 * 24))
        return diffDays <= 7 && diffDays >= 0
      })
    } else if (activeFilter === 'my-tasks' && currentProfile) {
      filtered = filtered.filter(
        (tache) => tache.responsable_id === currentProfile.id && tache.statut !== 'Terminé'
      )
    }

    return filtered.filter((tache) => {
      const etablissement = etablissements?.find((e) => e.id === tache.etablissement_id)
      const responsable = profiles?.find((p) => p.id === tache.responsable_id)
      const categorie = tache.categorie_id ? { nom: '' } : null // Simplified for now

      const matchesSearch =
        tache.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        etablissement?.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        responsable?.nom.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesPhase = filterPhase === 'all' || categorie?.nom === filterPhase
      const matchesResponsable =
        filterResponsable === 'all' || tache.responsable_id === filterResponsable

      return matchesSearch && matchesPhase && matchesResponsable
    })
  }, [
    mergedTaches,
    etablissements,
    profiles,
    searchTerm,
    filterPhase,
    filterResponsable,
    activeFilter,
    currentProfile,
  ])

  const resetFilters = () => {
    setActiveFilter(null)
    setSearchParams({})
    setSearchTerm('')
    setFilterPhase('all')
    setFilterResponsable('all')
  }

  // Ouvrir les détails d'une tâche
  const openTacheDetails = (tache: any) => {
    setSelectedTache(tache)
    setDetailsOpen(true)
  }

  // Gérer le changement de statut (route vers le bon hook selon origine)
  const handleStatusChange = (tacheId: string, newStatus: string) => {
    if (typeof tacheId === 'string' && tacheId.startsWith('portal-')) {
      const rawId = tacheId.replace(/^portal-/, '')
      const portalStatus: ClientPortalTaskStatus =
        newStatus === 'Terminé' ? 'done' : newStatus === 'En cours' ? 'in_progress' : 'todo'
      updatePortalTask.mutate({ id: rawId, patch: { statut: portalStatus } })
      return
    }
    updateTache.mutate({
      id: tacheId,
      data: {
        statut: newStatus as 'A faire' | 'En cours' | 'Bloqué' | 'Terminé',
        ...(newStatus === 'Terminé' && {
          date_realisation: new Date().toISOString().split('T')[0],
        }),
      },
    })
  }

  const handleTaskStatusChange = async (tacheId: string, completed: boolean) => {
    if (typeof tacheId === 'string' && tacheId.startsWith('portal-')) {
      const rawId = tacheId.replace(/^portal-/, '')
      const portalStatus: ClientPortalTaskStatus = completed ? 'done' : 'todo'
      updatePortalTask.mutate({ id: rawId, patch: { statut: portalStatus } })
      return
    }
    await updateTache.mutateAsync({
      id: tacheId,
      data: { statut: completed ? 'Terminé' : 'A faire' },
    })
  }

  // Stats — calculées sur les tâches hors phase Prospect (cohérent avec l'affichage)
  const tachesHorsProspect = useMemo(() => {
    if (!mergedTaches || mergedTaches.length === 0) return []
    if (!etablissements || etablissements.length === 0) return mergedTaches
    const etabPhaseMap = new Map(etablissements.map((e) => [e.id, getPhaseByStatus(e.statut)]))
    return mergedTaches.filter((t) => {
      if (!t.etablissement_id) return true
      const phase = etabPhaseMap.get(t.etablissement_id)
      if (!phase) return true
      return phase !== 'commercial'
    })
  }, [mergedTaches, etablissements])

  const stats = useMemo(
    () => ({
      total: tachesHorsProspect.length,
      terminées: tachesHorsProspect.filter((t) => t.statut === 'Terminé').length,
      enCours: tachesHorsProspect.filter((t) => t.statut === 'En cours').length,
      enRetard: tachesHorsProspect.filter(
        (t) => t.echeance && new Date(t.echeance) < new Date() && t.statut !== 'Terminé'
      ).length,
    }),
    [tachesHorsProspect]
  )

  // ✅ Maintenant on peut retourner conditionnellement (tous les hooks ont été appelés)
  if (isLoading || tachesError) {
    return (
      <PageDataState isLoading={isLoading} isError={tachesError} onRetry={() => refetchTaches()}>
        <></>
      </PageDataState>
    )
  }

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'Terminé':
        return <Badge className="bg-success text-success-foreground">Terminé</Badge>
      case 'En cours':
        return <Badge className="bg-primary text-primary-foreground">En cours</Badge>
      case 'A faire':
        return <Badge variant="secondary">À faire</Badge>
      case 'Bloqué':
        return <Badge className="bg-warning text-warning-foreground">Bloqué</Badge>
      default:
        return <Badge variant="outline">{statut}</Badge>
    }
  }

  const getPhaseBadge = (phase: string) => {
    const colors = {
      Contractuel: 'bg-slate-100 text-foreground',
      Conformité: 'bg-orange-100 text-orange-800',
      Déploiement: 'bg-blue-100 text-blue-800',
      Formation: 'bg-purple-100 text-purple-800',
      'Go-Live': 'bg-green-100 text-green-800',
      Suivi: 'bg-green-100 text-green-800',
    }
    return (
      <Badge className={colors[phase as keyof typeof colors] || 'bg-gray-100 text-foreground'}>
        {phase}
      </Badge>
    )
  }

  const getPrioriteIcon = (priorite: string) => {
    switch (priorite) {
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-destructive" />
      case 'medium':
        return <Clock className="w-4 h-4 text-warning" />
      case 'low':
        return <CheckCircle className="w-4 h-4 text-muted-foreground" />
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  const headerActions = activeFilter && (
    <Button
      variant="ghost"
      size="sm"
      onClick={resetFilters}
      className="h-9 bg-card/10 border-white/20 text-white hover:bg-card/20 backdrop-blur-sm rounded-lg"
    >
      Réinitialiser
    </Button>
  )

  // Mobile toolbar for header
  const mobileToolbar = (
    <ProjetsTabsCompact
      currentTab={
        searchParams.get('tab') || (getPreference('projets_view', 'list') as string) || 'list'
      }
      onTabChange={(tab) => {
        updatePreference('projets_view', tab)
        const params = new URLSearchParams(searchParams)
        params.set('tab', tab)
        setSearchParams(params, { replace: true })
      }}
    />
  )

  return (
    <div className="min-h-dvh bg-gradient-page">
      {isMobile ? (
        <ProjetsMobileHeader
          stats={{
            total: stats.total,
            completed: stats.terminées,
            inProgress: stats.enCours,
            overdue: stats.enRetard,
          }}
          activeFilter={activeFilter}
          onSearchClick={() => setShowGlobalSearch(true)}
          onResetFilters={resetFilters}
          toolbar={mobileToolbar}
          showGlobalNav={showGlobalNav}
        />
      ) : (
        <ImmersivePageHeader
          title="Projets & Tâches"
          subtitle="Gérez et suivez toutes vos tâches en cours"
          icon={FolderKanban}
          stats={[
            { label: 'total', value: stats.total, highlight: true },
            { label: 'terminées', value: stats.terminées },
            { label: 'en cours', value: stats.enCours },
            { label: 'en retard', value: stats.enRetard },
          ]}
          searchPlaceholder="Rechercher une tâche..."
          onSearchClick={() => setShowGlobalSearch(true)}
          actions={headerActions}
        >
          {activeFilter && (
            <Badge variant="secondary" className="bg-card/20 text-white border-white/30 text-sm">
              Filtre :{' '}
              {activeFilter === 'urgent'
                ? '🚨 Tâches urgentes'
                : activeFilter === 'my-tasks'
                  ? '👤 Mes tâches'
                  : '📊 Toutes'}
            </Badge>
          )}
        </ImmersivePageHeader>
      )}

      <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />

      <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-6 animate-fade-in">
        {/* Stats cards - hidden on mobile (already in header) */}
        {!isMobile && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card className="hover-scale animate-scale-in transition-all duration-300 bg-card/80 backdrop-blur-sm border-primary/10 shadow-sm">
              <CardContent className="pt-4 pb-3 sm:pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
                    <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
                  </div>
                  <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="hover-scale animate-scale-in transition-all duration-300 bg-card/80 backdrop-blur-sm border-primary/10 shadow-sm"
              style={{ animationDelay: '50ms' }}
            >
              <CardContent className="pt-4 pb-3 sm:pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Terminées</p>
                    <p className="text-xl sm:text-2xl font-bold text-success">{stats.terminées}</p>
                  </div>
                  <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-success" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="hover-scale animate-scale-in transition-all duration-300 bg-card/80 backdrop-blur-sm border-primary/10 shadow-sm"
              style={{ animationDelay: '100ms' }}
            >
              <CardContent className="pt-4 pb-3 sm:pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">En cours</p>
                    <p className="text-xl sm:text-2xl font-bold text-primary">{stats.enCours}</p>
                  </div>
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="hover-scale animate-scale-in transition-all duration-300 bg-card/80 backdrop-blur-sm border-primary/10 shadow-sm"
              style={{ animationDelay: '150ms' }}
            >
              <CardContent className="pt-4 pb-3 sm:pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">En retard</p>
                    <p className="text-xl sm:text-2xl font-bold text-destructive">
                      {stats.enRetard}
                    </p>
                  </div>
                  <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-destructive" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Onglets de vues avec style underline glassmorphism */}
        <Tabs
          value={
            searchParams.get('tab') || (getPreference('projets_view', 'list') as string) || 'list'
          }
          onValueChange={(tab) => {
            const params = new URLSearchParams(searchParams)
            params.set('tab', tab)
            setSearchParams(params, { replace: true })
            updatePreference('projets_view', tab)
          }}
        >
          <div className="mb-6">
            <div className="flex items-center bg-card/70 backdrop-blur-sm border border-primary/10 rounded-xl p-1.5 shadow-sm">
              <TabsList className="bg-transparent gap-1 w-full">
                {[
                  { value: 'list', icon: List, label: 'Liste' },
                  { value: 'table', icon: Table2, label: 'Tableau' },
                  { value: 'kanban', icon: LayoutGrid, label: 'Kanban' },
                  { value: 'analytics', icon: BarChart3, label: 'Analytique' },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex-1 gap-2 h-9 rounded-lg bg-transparent data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all"
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          <TabsContent value="list" className="mt-0 animate-fade-in">
            <TasksListView
              taches={filteredTaches}
              onStatusChange={handleStatusChange}
              resetFilters={resetFilters}
              activeFilter={activeFilter}
              getEtablissementColor={getEtablissementColor}
            />
          </TabsContent>

          <TabsContent value="table" className="mt-0 animate-fade-in">
            <TasksTableView
              taches={filteredTaches}
              onStatusChange={handleStatusChange}
              getEtablissementColor={getEtablissementColor}
            />
          </TabsContent>

          <TabsContent value="kanban" className="mt-0 animate-fade-in">
            <MultiProjectKanbanView
              taches={filteredTaches}
              getEtablissementColor={getEtablissementColor}
            />
          </TabsContent>

          <TabsContent value="analytics" className="mt-0 animate-fade-in">
            <TasksAnalyticsView taches={tachesHorsProspect} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function Projets() {
  try {
    return <ProjetsContent />
  } catch (error) {
    debug.error('Error in Projets component:', error)
    return (
      <div className="p-6 flex items-center justify-center">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-destructive mb-4">Une erreur est survenue lors du chargement</div>
            <Button
              onClick={() => {
                // Force re-render without full page reload
                window.dispatchEvent(new Event('focus'))
              }}
            >
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}
