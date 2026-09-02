import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { PhaseKey } from '@/config/phases'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  Edit,
  List,
  BarChart3,
  FileText,
  Info,
  Users,
  FileText as FileIcon,
  ListChecks,
  LayoutGrid,
  GanttChart,
  Activity,
  ExternalLink,
  MessageSquare,
  TrendingUp,
  GraduationCap,
  BookOpen,
  ArrowUp,
  Receipt,
  Heart,
  Route,
  LineChart,
  Brain,
  Phone,
} from 'lucide-react'
import { TAB_CATEGORIES, TAB_TO_CATEGORY } from './etablissement-detail/tabCategories'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useEtablissement } from '@/hooks/crm/useEtablissements'
import { useTasksBreakdown } from '@/hooks/analytics/useTasksBreakdown'
import { useTachesByEtablissement } from '@/hooks/tasks/useTaches'
import { useRegenerateTasks } from '@/hooks/tasks/useRegenerateTasks'
import { EtablissementHeader } from '@/components/etablissement/EtablissementHeader'
import { EtablissementEditForm } from '@/components/etablissement/EtablissementEditForm'
// EtablissementProgressionStatus removed - info moved to header popovers
import { TaskEditDialog as TaskForm } from '@/components/tasks/TaskEditDialog'
import { TacheDocuments } from '@/components/tasks/TacheDocuments'
// KPIMiniCards removed - info moved to header popovers
import { useEtablissementEmailSuggestions } from '@/hooks/crm/useEtablissementEmailSuggestions'
import { useAISuggestions } from '@/hooks/ai/useAISuggestions'
// GroupeIndicator removed - integrated into header
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Mail } from 'lucide-react'
import { EtablissementDetailTabContent } from './etablissement-detail/EtablissementDetailTabContent'

import { useEtablissementUsers } from '@/hooks/crm/useEtablissementUsers'
import { useVirtualBreadcrumb } from '@/hooks/shared/useVirtualBreadcrumb'
import { TAB_LABELS } from '@/config/tabLabels'
import { PageDataState } from '@/components/common/PageDataState'
import { usePageTitle } from '@/hooks/shared/usePageTitle'

/**
 * Type pour les tâches dans cette page
 * Définit les propriétés utilisées dans le rendu du dialog
 */
interface SelectedTask {
  id: string
  titre: string
  description?: string | null
  statut: string
  priorite?: string | null
  echeance?: string | null
  date_debut?: string | null
  date_realisation?: string | null
  etablissement_id?: string | null
  responsable_id?: string | null
  archive?: boolean
  categorie?: { id: string; nom: string; couleur?: string | null } | null
  responsable?: { id: string; prenom: string | null; nom: string | null } | null
}

// UUID v4 lax (accepte tout UUID) — bloque les IDs numériques crafted comme /etablissements/999999
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function EtablissementDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlTab = searchParams.get('tab') || 'infos'
  const phaseFilter = searchParams.get('phase') as PhaseKey | null

  // Garde-fou : ID non-UUID → redirect 404 propre (évite un 400 PostgREST + entrée bruit dans frontend_error_logs).
  useEffect(() => {
    if (id && !UUID_RE.test(id)) {
      navigate('/404', { replace: true })
    }
  }, [id, navigate])

  // CRITICAL: uiActiveTab est la source de vérité pour le RENDU.
  // Il est mis à jour immédiatement au clic, indépendamment de l'URL.
  // Cela garantit que le Gantt est démonté instantanément même si setSearchParams est retardé.
  const [uiActiveTab, setUiActiveTab] = useState(urlTab)

  // Synchroniser URL -> UI (ex: navigation back/forward, liens directs)
  useEffect(() => {
    setUiActiveTab(urlTab)
  }, [urlTab])

  // Alias pour compatibilité du reste du code
  const activeTab = uiActiveTab

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedTache, setSelectedTache] = useState<SelectedTask | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>(
    () => TAB_TO_CATEGORY[urlTab] || 'informations'
  )

  // Refs et état pour sticky navigation
  const categoriesBarRef = useRef<HTMLDivElement>(null)
  const [isSticky, setIsSticky] = useState(false)

  const { data: etablissement, isLoading, isError, error, refetch } = useEtablissement(id || '')

  // Titre d'onglet dédié pour éviter la rétention du titre du listing (BUG Prompt 2)
  usePageTitle(etablissement?.nom ? `${etablissement.nom} — Établissement` : 'Établissement')
  const { data: tasksBreakdown } = useTasksBreakdown(id || '')
  const { data: allTachesData } = useTachesByEtablissement(id || '')
  const taches = allTachesData?.filter((t) => !t.archive)
  const allTaches = allTachesData // Toutes les tâches de l'établissement (non archivées, filtrées côté serveur)
  const regenerateTasks = useRegenerateTasks()
  const {
    suggestions,
    isLoading: isSuggestionsLoading,
    acceptSuggestion,
    rejectSuggestion,
    isAccepting,
    isRejecting,
  } = useEtablissementEmailSuggestions(id)

  // AI Suggestions pour le header
  const {
    suggestions: aiSuggestions,
    approveSuggestion: approveAISuggestion,
    rejectSuggestion: rejectAISuggestion,
    isApproving: isApprovingAI,
    isRejecting: isRejectingAI,
  } = useAISuggestions(id, 'operational')

  // Hook pour les données de formation (utilisé pour le badge de l'onglet formations)
  const { data: etablissementUsers } = useEtablissementUsers(id || '')

  // Calculer le taux de formation au top level pour éviter l'erreur de hooks
  const formationRate = useMemo(() => {
    if (!etablissementUsers || etablissementUsers.length === 0) return null
    const formedUsers = etablissementUsers.filter((u) => u.statut_formation === 'forme').length
    return Math.round((formedUsers / etablissementUsers.length) * 100)
  }, [etablissementUsers])

  // Redirection automatique de timeline vers gantt (timeline supprimé)
  useEffect(() => {
    if (activeTab === 'timeline') {
      const newParams = new URLSearchParams(searchParams)
      newParams.set('tab', 'gantt')
      setSearchParams(newParams, { replace: true })
    }
  }, [activeTab, searchParams, setSearchParams])

  // Handler pour les clics sur tâches - utilise unknown pour accepter différents types de composants
  const handleTaskClick = (task: unknown) => {
    setSelectedTache(task as SelectedTask)
    setDetailsOpen(true)
  }

  // Vérifier si on doit ouvrir le formulaire d'édition depuis l'URL
  useEffect(() => {
    const shouldEdit = searchParams.get('edit') === 'true'
    if (shouldEdit) {
      setIsEditOpen(true)
      // Nettoyer le paramètre edit de l'URL après ouverture
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('edit')
      setSearchParams(newParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Détecter quand la barre de catégories devient sticky
  useEffect(() => {
    const handleScroll = () => {
      if (categoriesBarRef.current) {
        const rect = categoriesBarRef.current.getBoundingClientRect()
        setIsSticky(rect.top <= 0)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Intégration fil d'Ariane - Deux niveaux: catégorie + onglet
  const { pushEntry, popEntry } = useVirtualBreadcrumb()

  useEffect(() => {
    if (!etablissement) return

    // Construire le label: "Établissement > Nom > Catégorie > Onglet"
    const categoryLabel = TAB_CATEGORIES[activeCategory]?.label || activeCategory
    const tabLabel =
      TAB_LABELS.etablissementDetail.tabs[
        activeTab as keyof typeof TAB_LABELS.etablissementDetail.tabs
      ] || activeTab
    const fullLabel = `${etablissement.nom} > ${categoryLabel} > ${tabLabel}`

    // Créer une entrée virtuelle combinant les deux niveaux
    pushEntry(
      fullLabel,
      () => {
        // Retour à la liste des établissements
        navigate('/etablissements')
      },
      '/etablissements',
      'tab'
    ) // Type 'tab' pour l'icône

    return () => {
      popEntry()
    }
  }, [activeTab, activeCategory, etablissement?.nom, pushEntry, popEntry, navigate])

  // Ref pour tracker l'onglet précédent (cleanup Gantt)
  const prevTabRef = useRef(activeTab)

  // Cleanup agressif quand on quitte le Gantt
  useEffect(() => {
    const prevTab = prevTabRef.current
    prevTabRef.current = activeTab

    if (prevTab === 'gantt' && activeTab !== 'gantt') {
      import('@/lib/dom/radixOverlayCleanup').then(({ cleanupRadixUIStateDelayed }) => {
        cleanupRadixUIStateDelayed({ aggressive: true, debug: false })
      })
    }
  }, [activeTab])

  const handleTabChange = (tab: string, options?: { phase?: PhaseKey }) => {
    // CRITICAL #1: Bascule IMMÉDIATE de l'UI, AVANT toute opération async/URL
    // C'est ce qui garantit le démontage instantané du Gantt
    setUiActiveTab(tab)

    // CRITICAL #2: Nettoyage SYNCHRONE des locks DOM
    document.body.removeAttribute('data-scroll-locked')
    document.body.style.pointerEvents = ''
    document.body.style.overflow = ''
    document.documentElement.style.pointerEvents = ''
    document.documentElement.style.overflow = ''

    // Cleanup asynchrone Radix pour les portals
    import('@/lib/dom/radixOverlayCleanup').then(({ cleanupRadixUIStateDelayed }) => {
      cleanupRadixUIStateDelayed({ aggressive: uiActiveTab === 'gantt', debug: false })
    })

    // Mettre à jour la catégorie active
    const category = TAB_TO_CATEGORY[tab]
    if (category) {
      setActiveCategory(category)
    }

    // Synchroniser l'URL (peut être retardé, ce n'est plus bloquant pour le rendu)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('tab', tab)

    if (options?.phase) {
      newParams.set('phase', options.phase)
    } else {
      newParams.delete('phase')
    }

    setSearchParams(newParams)

    // Toujours scroller pour placer le menu en haut
    if (categoriesBarRef.current) {
      categoriesBarRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      })
    }
  }

  const handleCategoryChange = (categoryKey: string) => {
    setActiveCategory(categoryKey)
    // Naviguer vers le premier onglet de cette catégorie
    const category = TAB_CATEGORIES[categoryKey as keyof typeof TAB_CATEGORIES]
    if (category && category.tabs.length > 0) {
      handleTabChange(category.tabs[0])
    }
  }

  const handlePhaseClick = (phase: PhaseKey) => {
    handleTabChange('taches', { phase })
  }

  if (isLoading || isError || !etablissement) {
    return (
      <PageDataState
        isLoading={isLoading}
        isError={isError || (!isLoading && !etablissement)}
        error={error ?? (!etablissement ? new Error('Établissement introuvable') : undefined)}
        onRetry={() => refetch()}
        loadingFallback={
          <div className="p-3 sm:p-4 md:p-6 flex items-center justify-center min-h-[50vh]">
            <Loader2 className="h-6 sm:h-8 w-6 sm:w-8 animate-spin" />
          </div>
        }
      >
        <></>
      </PageDataState>
    )
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-dvh bg-gradient-page">
      {/* Collapsible Header - Espacement réduit */}
      <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
        <EtablissementHeader
          etablissement={etablissement as any}
          onEdit={() => setIsEditOpen(true)}
          progression={etablissement.progression || 0}
          tasksCompleted={allTaches?.filter((t: any) => t.statut === 'Terminé').length || 0}
          tasksTotal={allTaches?.length || 0}
          tasksBreakdown={tasksBreakdown}
          upcomingDeadlines={
            taches?.filter((t: any) => {
              if (!t.echeance) return false
              const deadline = new Date(t.echeance)
              const today = new Date()
              const weekFromNow = new Date()
              weekFromNow.setDate(today.getDate() + 7)
              return deadline >= today && deadline <= weekFromNow
            }).length || 0
          }
          tasksStatusBreakdown={{
            aFaire: allTaches?.filter((t: any) => t.statut === 'A faire').length || 0,
            enCours: allTaches?.filter((t: any) => t.statut === 'En cours').length || 0,
            bloque: allTaches?.filter((t: any) => t.statut === 'Bloqué').length || 0,
            termine: allTaches?.filter((t: any) => t.statut === 'Terminé').length || 0,
          }}
          onNavigate={handleTabChange as any}
          aiSuggestions={aiSuggestions}
          onApproveSuggestion={approveAISuggestion}
          onRejectSuggestion={rejectAISuggestion}
          isApprovingSuggestion={isApprovingAI}
          isRejectingSuggestion={isRejectingAI}
        />
      </div>

      {/* Tabs de contenu avec catégories */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        {(() => {
          const showStatsOnglets = etablissement.statut === 'Production'
          const visibleCategories = Object.entries(TAB_CATEGORIES).filter(
            ([_, category]) => !category.productionOnly || showStatsOnglets
          )

          return (
            <>
              {/* Container sticky pour les barres de navigation - z-50 + isolate pour garantir priorité sur le Gantt */}
              <div
                ref={categoriesBarRef}
                className={cn(
                  'sticky top-0 z-50 relative isolate bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80 transition-all pointer-events-auto',
                  isSticky && 'shadow-lg border-b border-primary/10'
                )}
              >
                {/* Barre de catégories principales - Style glassmorphism */}
                {/* `data-tab-nav` : point d'ancrage stable pour les tests. Cette
                    barre joue le rôle d'onglets de premier niveau tout en étant
                    composée de boutons — les sous-onglets Radix (`role="tab"`)
                    ne sont montés que si la catégorie active en compte plusieurs. */}
                <div
                  data-tab-nav="categories"
                  className="flex gap-2 pt-3 px-3 sm:px-4 lg:px-6 overflow-x-auto scrollbar-thin pb-2"
                >
                  {visibleCategories.map(([categoryKey, category]) => {
                    const CategoryIcon = category.icon
                    const isActive = activeCategory === categoryKey

                    // Calculer les badges pour chaque catégorie
                    let badgeContent = null
                    if (categoryKey === 'gestion' && allTaches) {
                      badgeContent = `${allTaches.filter((t: any) => t.statut === 'Terminé').length}/${allTaches.length}`
                    } else if (categoryKey === 'informations') {
                      const teamCount = [
                        etablissement.commercial,
                        etablissement.chef_projet,
                        etablissement.csm,
                      ].filter(Boolean).length
                      badgeContent = teamCount > 0 ? `${teamCount}` : null
                    } else if (categoryKey === 'communication' && suggestions) {
                      badgeContent = suggestions.length > 0 ? `${suggestions.length}` : null
                    }

                    return (
                      <Button
                        key={categoryKey}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCategoryChange(categoryKey)}
                        className={cn(
                          'flex-shrink-0 gap-2 h-9 rounded-xl transition-all',
                          isActive
                            ? 'bg-primary text-white hover:bg-primary/90'
                            : 'bg-card/60 backdrop-blur-sm border border-primary/10 hover:bg-card/80 hover:border-primary/20'
                        )}
                      >
                        <CategoryIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">{category.label}</span>
                        {badgeContent && (
                          <Badge
                            variant={isActive ? 'secondary' : 'outline'}
                            className={cn(
                              'ml-1 text-[10px] px-1.5 py-0 rounded-full',
                              isActive && 'bg-card/20 text-white border-white/30'
                            )}
                          >
                            {badgeContent}
                          </Badge>
                        )}
                      </Button>
                    )
                  })}
                </div>

                {/* Sous-onglets de la catégorie active - Style underline glassmorphism */}
                {activeCategory &&
                  TAB_CATEGORIES[activeCategory as keyof typeof TAB_CATEGORIES] &&
                  TAB_CATEGORIES[activeCategory as keyof typeof TAB_CATEGORIES].tabs.length > 1 && (
                    <div className="px-3 sm:px-4 lg:px-6 pt-3 pb-4 border-b border-primary/10">
                      <TabsList className="w-full flex gap-1 h-11 p-1 bg-card/60 backdrop-blur-sm border border-primary/10 shadow-md rounded-xl">
                        {TAB_CATEGORIES[activeCategory as keyof typeof TAB_CATEGORIES].tabs.map(
                          (tabValue) => {
                            // Configuration des onglets individuels
                            const tabConfig: Record<
                              string,
                              { label: string; icon: any; badge?: () => React.ReactNode }
                            > = {
                              infos: { label: 'Informations', icon: Info },
                              contacts: { label: 'Contacts', icon: Users },
                              equipe: {
                                label: 'Équipe',
                                icon: Users,
                                badge: () => (
                                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                                    {
                                      [
                                        etablissement.commercial,
                                        etablissement.chef_projet,
                                        etablissement.csm,
                                      ].filter(Boolean).length
                                    }
                                  </Badge>
                                ),
                              },
                              taches: {
                                label: 'Tâches',
                                icon: ListChecks,
                                badge: () =>
                                  allTaches && allTaches.length > 0 ? (
                                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                                      {allTaches.filter((t: any) => t.statut === 'Terminé').length}/
                                      {allTaches.length}
                                    </Badge>
                                  ) : null,
                              },
                              kanban: { label: 'Kanban', icon: LayoutGrid },
                              agenda: {
                                label: 'Agenda',
                                icon: List,
                                badge: () =>
                                  taches ? (
                                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                                      {taches.filter((t: any) => t.echeance).length}
                                    </Badge>
                                  ) : null,
                              },
                              timeline: { label: 'Timeline', icon: BarChart3 },
                              gantt: { label: 'Gantt', icon: GanttChart },
                              documents: { label: 'Documents', icon: FileIcon },
                              emails: { label: 'Emails', icon: Mail },
                              appels: { label: 'Appels', icon: Phone },
                              interactions: { label: 'Interactions', icon: MessageSquare },
                              'synthese-ia': { label: 'Synthèse IA', icon: Brain },
                              scoring: { label: 'Scoring', icon: TrendingUp },
                              'csm-sante': { label: 'Organisation CSM', icon: Heart },
                              'csm-parcours': { label: 'Parcours', icon: Route },
                              'csm-facturation': { label: 'Suivi Factu', icon: Receipt },
                              'csm-kpis-mensuels': { label: 'KPIs Mensuels', icon: Activity },
                              'csm-kpis-trimestriels': { label: 'KPIs Trim.', icon: LineChart },
                              'csm-playbooks': { label: 'Playbooks', icon: BookOpen },

                              formations: {
                                label: 'Formations',
                                icon: GraduationCap,
                                badge: () => {
                                  // Utiliser la valeur calculée au top level
                                  if (formationRate === null) return null
                                  return (
                                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                                      {formationRate}%
                                    </Badge>
                                  )
                                },
                              },
                              'stats-utilisation': { label: 'Utilisation', icon: BarChart3 },
                              'stats-urgences': { label: 'Urgences', icon: Activity },
                              enquetes: { label: 'Enquêtes', icon: MessageSquare },
                              'portail-client': { label: 'Portail client', icon: ExternalLink },
                            }

                            const config = tabConfig[tabValue]
                            if (!config) return null

                            const TabIcon = config.icon

                            return (
                              <TabsTrigger
                                key={tabValue}
                                value={tabValue}
                                className="flex-1 gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all"
                              >
                                <TabIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">{config.label}</span>
                                {config.badge && config.badge()}
                              </TabsTrigger>
                            )
                          }
                        )}
                      </TabsList>
                    </div>
                  )}
              </div>

              {/* Contenu des onglets - UN SEUL onglet monté à la fois */}
              <div key={activeTab} className="px-3 sm:px-4 lg:px-6 py-4 animate-fade-in">
                <EtablissementDetailTabContent
                  activeTab={activeTab}
                  uiActiveTab={uiActiveTab}
                  etablissement={etablissement}
                  id={id || ''}
                  phaseFilter={phaseFilter}
                  taches={taches}
                  onTaskClick={handleTaskClick}
                  onEditOpen={() => setIsEditOpen(true)}
                />
              </div>
            </>
          )
        })()}
      </Tabs>

      {/* Bouton Scroll to Top */}
      {isSticky && (
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Monter"
        >
          <ArrowUp className="w-4 h-4" />
        </Button>
      )}

      {/* Modal de modification */}
      <EtablissementEditForm
        etablissement={etablissement}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />

      {/* Dialog de détails de tâche */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTache?.titre}</DialogTitle>
          </DialogHeader>

          {selectedTache && (
            <div className="space-y-6">
              {/* Informations de la tâche */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Catégorie</p>
                      <p className="font-medium">{selectedTache.categorie?.nom || 'Non définie'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Responsable</p>
                      <p className="font-medium">
                        {selectedTache.responsable
                          ? `${selectedTache.responsable.prenom} ${selectedTache.responsable.nom}`
                          : 'Non assigné'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Statut</p>
                      <Badge>{selectedTache.statut}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Priorité</p>
                      <Badge
                        variant={
                          selectedTache.priorite === 'high'
                            ? 'destructive'
                            : selectedTache.priorite === 'medium'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {selectedTache.priorite === 'high'
                          ? 'Haute'
                          : selectedTache.priorite === 'medium'
                            ? 'Moyenne'
                            : 'Basse'}
                      </Badge>
                    </div>
                    {selectedTache.echeance && (
                      <div>
                        <p className="text-sm text-muted-foreground">Échéance</p>
                        <p className="font-medium">
                          {format(parseISO(selectedTache.echeance), 'PPP', { locale: fr })}
                        </p>
                      </div>
                    )}
                    {selectedTache.date_realisation && (
                      <div>
                        <p className="text-sm text-muted-foreground">Date de réalisation</p>
                        <p className="font-medium">
                          {format(parseISO(selectedTache.date_realisation), 'PPP', { locale: fr })}
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedTache.description && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Description</p>
                      <p className="text-sm">{selectedTache.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDocuments(!showDocuments)}>
                  <FileText className="w-4 h-4 mr-2" />
                  {showDocuments ? 'Masquer' : 'Voir'} les documents
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
                  <Edit className="w-4 h-4 mr-2" />
                  {isEditing ? 'Annuler' : 'Modifier'}
                </Button>
              </div>

              {/* Édition */}
              {isEditing && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Éditer la tâche</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TaskForm
                      tache={{
                        ...selectedTache,
                        // Convert null to undefined for TaskForm compatibility
                        priorite: selectedTache.priorite ?? undefined,
                        etablissement_id: selectedTache.etablissement_id ?? undefined,
                        responsable_id: selectedTache.responsable_id ?? undefined,
                      }}
                      mode="edit"
                    />
                  </CardContent>
                </Card>
              )}

              {/* Documents */}
              {showDocuments && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TacheDocuments
                      tacheId={selectedTache.id}
                      tacheTitre={selectedTache.titre}
                      etablissementId={id}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
