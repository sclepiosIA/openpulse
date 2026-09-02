import React, { useMemo, useCallback, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { lazyWithRetry } from '@/lib/lazyWithRetry'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  RefreshCw,
  Target,
  Calendar,
  MessageCircle,
  Mail,
  StickyNote,
  TrendingUp,
  Wallet,
  Users,
  BarChart3,
  Briefcase,
  Sparkles,
} from 'lucide-react'
import { useDashboardCoreData } from '@/hooks/dashboard/useDashboardCoreData'
import { useUserRole } from '@/hooks/shared/useUserRole'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { DashboardHero } from '@/components/dashboard/DashboardHero'
import { PipelinePremium } from '@/components/dashboard/PipelinePremium'
// Lazy load EmailIntelligenceHub to reduce initial bundle size
const EmailIntelligenceHub = lazyWithRetry(
  () => import('@/components/dashboard/EmailIntelligenceHub')
)
import { TasksActionPanel } from '@/components/dashboard/TasksActionPanel'
import { DashboardErrorBoundary } from '@/components/debug/DashboardErrorBoundary'
import { EmailUnreadBadge } from '@/components/email/EmailUnreadBadge'
import { NotificationBadge } from '@/components/layout/NotificationBadge'
import { BlockedEtablissementsSection } from '@/components/etablissement/BlockedEtablissementsSection'
import { calculateEtablissementValue } from '@/lib/valueCalculations'
import { DirectionTresorerieWidget } from '@/components/direction/DirectionTresorerieWidget'
import { DirectionRHWidget } from '@/components/direction/DirectionRHWidget'
import { DashboardWidgetGrid } from '@/components/dashboard/DashboardWidgetGrid'
import { DashboardCustomizeButton } from '@/components/dashboard/DashboardCustomizeButton'
import {
  useDashboardLayout,
  WidgetId,
  WidgetSize,
  DASHBOARD_TEMPLATES,
  DashboardTemplate,
} from '@/hooks/dashboard/useDashboardLayout'

import { AgendaWidget } from '@/components/dashboard/AgendaWidget'
import { PulseWidget } from '@/components/dashboard/PulseWidget'
import { EmailInboxWidget } from '@/components/dashboard/EmailInboxWidget'
import { NotesWidget } from '@/components/dashboard/NotesWidget'
import { JarvisDashboardWidget } from '@/components/jarvis/JarvisDashboardWidget'
import { FollowUpWidget } from '@/components/dashboard/FollowUpWidget'
import { MobileDualCarousel } from '@/components/dashboard/MobileDualCarousel'

import { useMobileDashboard } from '@/hooks/analytics/useMobileDashboard'
import { cn } from '@/lib/utils'
import { DashboardSkeleton } from '@/components/shared/DashboardSkeleton'
import { FullDashboardSkeleton } from '@/components/shared/FullDashboardSkeleton'
import { RecentActivityWidget } from '@/components/dashboard/widgets/RecentActivityWidget'
const ProspectStatsDashboard = lazyWithRetry(() =>
  import('@/components/pipeline/ProspectStatsDashboard').then((m) => ({
    default: m.ProspectStatsDashboard,
  }))
)
const ActivityFeed = lazyWithRetry(() =>
  import('@/components/dashboard/ActivityFeed').then((m) => ({ default: m.ActivityFeed }))
)
const MRRDashboard = lazyWithRetry(() => import('@/components/dashboard/MRRDashboard'))

function getStatusWeight(status: string): number {
  const weights: Record<string, number> = {
    Prospect: 5,
    Refus: 0,
    Reporté: 10,
    Bloqué: 5,
    Contacté: 15,
    'Attente RDV': 25,
    'RDV pris': 35,
    'Attente post RDV': 45,
    'Dans les RDV': 55,
    'Etude émise': 65,
    'Dans les RDV post EME': 75,
    Négociation: 85,
    Contractualisation: 95,
    Vendu: 100,
    Contractuel: 100,
    Conformité: 100,
    Déploiement: 100,
    Formation: 100,
    'Go-Live': 100,
    Production: 100,
  }
  return weights[status] || 0
}

export function DirectionDashboard() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const {
    overview: dashboardOverview,
    etablissements: allEtablissements,
    taches: allTaches,
    isLoadingOverview: dashboardLoading,
    errors: coreErrors,
  } = useDashboardCoreData()
  const { data: profiles } = useProfiles()
  const { isCopil, role } = useUserRole()

  // Mobile mode state
  const mobileDashboard = useMobileDashboard()
  const {
    isMobile,
    isCompact,
    mode,
    toggleMode,
    carousel1Index,
    setCarousel1Index,
    carousel2Index,
    setCarousel2Index,
  } = mobileDashboard

  // Dashboard customization
  const dashboardLayoutState = useDashboardLayout('direction')
  const {
    isEditMode,
    isSaving,
    startEdit,
    cancelEdit,
    saveLayout,
    resetToDefault,
    openWidgetSelector,
    applyTemplate,
    visibleWidgets,
  } = dashboardLayoutState

  const templates = Object.entries(DASHBOARD_TEMPLATES).map(
    ([id, t]: [string, DashboardTemplate]) => ({
      id,
      name: t.name,
      description: t.description,
    })
  )

  const globalStats = useMemo(() => {
    if (dashboardOverview && !dashboardLoading) {
      return {
        totalEtablissements: dashboardOverview.total_etablissements,
        prospects: dashboardOverview.total_prospects,
        contractuels: dashboardOverview.total_contractuel,
        production: dashboardOverview.total_production,
        totalValeur: dashboardOverview.valeur_totale,
      }
    }

    if (!allEtablissements || allEtablissements.length === 0) {
      return {
        totalEtablissements: 0,
        prospects: 0,
        contractuels: 0,
        production: 0,
        totalValeur: 0,
      }
    }

    return {
      totalEtablissements: allEtablissements.length,
      prospects: allEtablissements.filter((e) => e.statut === 'Prospect').length,
      contractuels: allEtablissements.filter((e) =>
        ['Contractuel', 'Conformité', 'Déploiement', 'Formation', 'Go-Live'].includes(e.statut)
      ).length,
      production: allEtablissements.filter((e) => e.statut === 'Production').length,
      totalValeur: allEtablissements.reduce((sum, e) => sum + calculateEtablissementValue(e), 0),
    }
  }, [allEtablissements, dashboardOverview, dashboardLoading])

  const urgentTasks = useMemo(() => {
    if (!allTaches) return []
    const today = new Date()
    return allTaches
      .filter((task) => {
        if (task.statut === 'Terminé' || !task.echeance) return false
        const echeance = new Date(task.echeance)
        const diffDays = Math.ceil((echeance.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return diffDays <= 7 && diffDays >= 0
      })
      .sort((a, b) => new Date(a.echeance!).getTime() - new Date(b.echeance!).getTime())
  }, [allTaches])

  const conversionRate = useMemo(() => {
    if (!allEtablissements || allEtablissements.length === 0) return 0
    const prospects = allEtablissements.filter((e) => e.statut === 'Prospect').length
    const vendu = allEtablissements.filter((e) =>
      ['Vendu', 'Contractuel', 'Production'].includes(e.statut)
    ).length
    return prospects === 0 ? 0 : Math.round((vendu / (prospects + vendu)) * 100)
  }, [allEtablissements])

  // Widget renderer function for the grid - memoized to prevent mobileCarouselSections recalculation
  const renderWidget = useCallback(
    (widgetId: WidgetId, size: WidgetSize): React.ReactNode => {
      switch (widgetId) {
        case 'hero_metrics':
          // Already displayed by DashboardHero above the grid
          return null
        case 'pipeline':
          return <PipelinePremium />
        case 'tresorerie_ai':
          // Copil n'a pas accès à la trésorerie : on masque le widget côté front (RLS bloquerait de toute façon).
          if (isCopil) return null
          return <DirectionTresorerieWidget />
        case 'rh_ai':
          // Copil n'a pas accès aux données RH sensibles.
          if (isCopil) return null
          return <DirectionRHWidget />
        case 'tasks_panel': {
          const totalTasks = allTaches?.length ?? 0
          const doneTasks = allTaches?.filter((t) => t.statut === 'Terminé').length ?? 0
          const globalProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
          return (
            <TasksActionPanel
              urgentTasks={urgentTasks}
              myTasks={[]}
              allTasks={allTaches || []}
              myTasksProgress={0}
              globalProgress={globalProgress}
            />
          )
        }
        case 'email_intel':
          return (
            <Suspense fallback={<DashboardSkeleton variant="list" />}>
              <EmailIntelligenceHub />
            </Suspense>
          )
        case 'activity_feed':
          return (
            <DashboardErrorBoundary componentName="ActivityFeed">
              <Suspense fallback={<DashboardSkeleton variant="list" />}>
                <ActivityFeed />
              </Suspense>
            </DashboardErrorBoundary>
          )
        case 'prospect_stats':
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Analyse Détaillée de l'Activité
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DashboardErrorBoundary componentName="ProspectStatsDashboard">
                  <Suspense fallback={<DashboardSkeleton variant="stats" />}>
                    <ProspectStatsDashboard />
                  </Suspense>
                </DashboardErrorBoundary>
              </CardContent>
            </Card>
          )
        case 'blocked_etablissements':
          return <BlockedEtablissementsSection etablissements={allEtablissements || []} />
        case 'agenda_widget':
          return <AgendaWidget maxItems={5} />
        case 'pulse_widget':
          return <PulseWidget maxItems={5} />
        case 'email_inbox_widget':
          return <EmailInboxWidget maxItems={5} />
        case 'notes_widget':
          return <NotesWidget />
        case 'jarvis_assistant':
          return <JarvisDashboardWidget maxSuggestions={3} />
        case 'follow_up_relances':
          return <FollowUpWidget />
        case 'global_activity_feed':
          return <RecentActivityWidget />
        case 'mrr_dashboard':
          return (
            <DashboardErrorBoundary componentName="MRRDashboard">
              <Suspense fallback={<DashboardSkeleton variant="stats" />}>
                <MRRDashboard />
              </Suspense>
            </DashboardErrorBoundary>
          )
        default:
          return (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Widget non trouvé: {widgetId}
              </CardContent>
            </Card>
          )
      }
    },
    [
      globalStats,
      urgentTasks,
      conversionRate,
      dashboardOverview,
      allTaches,
      allEtablissements,
      isCopil,
    ]
  )

  // Mobile dual carousel configuration
  const mobileCarouselSections = useMemo(() => {
    // Section 1: Communication & Organisation
    const communicationWidgets = [
      {
        id: 'agenda_widget',
        label: 'Agenda',
        icon: Calendar,
        content: renderWidget('agenda_widget', 'S'),
      },
      {
        id: 'pulse_widget',
        label: 'Pulse',
        icon: MessageCircle,
        content: renderWidget('pulse_widget', 'S'),
      },
      {
        id: 'email_inbox_widget',
        label: 'Emails',
        icon: Mail,
        content: renderWidget('email_inbox_widget', 'S'),
      },
      {
        id: 'notes_widget',
        label: 'Notes',
        icon: StickyNote,
        content: renderWidget('notes_widget', 'S'),
      },
    ].filter((w) => visibleWidgets.some((vw) => vw.id === w.id))

    // Section 2: Business & Analytics
    const businessWidgets = [
      { id: 'rh_ai', label: 'RH', icon: Users, content: renderWidget('rh_ai', 'S') },
      {
        id: 'tresorerie_ai',
        label: 'Trésorerie',
        icon: Wallet,
        content: renderWidget('tresorerie_ai', 'S'),
      },
      {
        id: 'pipeline',
        label: 'Pipeline',
        icon: TrendingUp,
        content: renderWidget('pipeline', 'S'),
      },
      {
        id: 'tasks_panel',
        label: 'Tâches',
        icon: BarChart3,
        content: renderWidget('tasks_panel', 'S'),
      },
      {
        id: 'follow_up_relances',
        label: 'Relances',
        icon: TrendingUp,
        content: renderWidget('follow_up_relances', 'S'),
      },
    ].filter((w) => visibleWidgets.some((vw) => vw.id === w.id))

    return [
      {
        id: 'communication',
        title: 'Communication',
        icon: Sparkles,
        widgets: communicationWidgets,
        currentIndex: carousel1Index,
        onIndexChange: setCarousel1Index,
      },
      {
        id: 'business',
        title: 'Business',
        icon: Briefcase,
        widgets: businessWidgets,
        currentIndex: carousel2Index,
        onIndexChange: setCarousel2Index,
      },
    ].filter((section) => section.widgets.length > 0)
  }, [
    visibleWidgets,
    carousel1Index,
    carousel2Index,
    setCarousel1Index,
    setCarousel2Index,
    renderWidget,
  ])

  // État d'erreur explicite si toutes les requêtes échouent (ex. permissions refusées)
  const hasFatalError =
    coreErrors && coreErrors.length > 0 && !allEtablissements && !dashboardOverview
  if (hasFatalError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <div className="text-destructive font-medium">
              Impossible de charger le tableau de bord
            </div>
            <p className="text-sm text-muted-foreground">
              {role === 'copil'
                ? "Votre rôle « copil » n'a peut-être pas les permissions requises sur certaines données. Contactez un administrateur."
                : 'Une erreur réseau ou de permission empêche le chargement des données.'}
            </p>
            <p className="text-xs text-muted-foreground break-words">
              {coreErrors[0] instanceof Error ? coreErrors[0].message : String(coreErrors[0])}
            </p>
            <Button onClick={() => queryClient.invalidateQueries()}>Réessayer</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show skeleton only while the fast overview RPC is loading.
  // Widgets dépendant des etablissements/taches gèrent leur propre skeleton
  // (perf #34 audit CRM 2026-05-21 — éviter ~10 s d'écran blanc bloqué sur le payload etablissements complet).
  if (dashboardLoading && !dashboardOverview) {
    return <FullDashboardSkeleton />
  }

  // Toolbar actions pour le hero
  const toolbarActionsElement = (
    <>
      <EmailUnreadBadge
        variant="ghost-white"
        className="text-white/80 hover:text-white hover:bg-card/20 [&>button]:text-white/80 [&>button]:hover:text-white [&>button]:hover:bg-card/20"
      />
      <NotificationBadge variant="ghost-white" />
      <Button
        variant="ghost"
        size="sm"
        className="text-white/80 hover:text-white hover:bg-card/20 h-9 gap-2"
        onClick={() => navigate('/rapports-custom')}
        title="Rapports personnalisés"
      >
        <BarChart3 className="h-4 w-4" />
        <span className="hidden md:inline text-xs">Rapports</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-white/80 hover:text-white hover:bg-card/20 h-9 w-9"
        onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })}
        aria-label="Actualiser"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      <DashboardCustomizeButton
        isEditMode={isEditMode}
        isSaving={isSaving}
        actions={{
          startEdit,
          cancelEdit,
          saveLayout,
          resetToDefault,
          openWidgetSelector,
          applyTemplate,
        }}
        templates={templates}
        variant="ghost-white"
      />
    </>
  )

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      {/* Hero avec toolbar intégrée */}
      <DashboardHero
        totalEtablissements={globalStats.totalEtablissements}
        totalValeur={globalStats.totalValeur}
        conversionRate={conversionRate}
        prospects={globalStats.prospects}
        production={globalStats.production}
        contractuels={globalStats.contractuels}
        toolbarActions={toolbarActionsElement}
      />

      {/* Main Content */}
      <div
        className={cn(
          'w-full max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 xl:px-8 pt-2 space-y-3 sm:space-y-4',
          // En mode compact mobile, pas de padding bottom excessif
          isMobile && isCompact ? 'pb-0' : 'pb-4'
        )}
      >
        {/* Mobile: Show compact mode with dual carousel OR full grid */}
        {isMobile ? (
          isCompact ? (
            // Mode compact: Dual carousel with swipe navigation - no extra scroll
            <MobileDualCarousel sections={mobileCarouselSections} className="pb-0" />
          ) : (
            // Mode full: Regular widget grid on mobile
            <DashboardWidgetGrid
              team="direction"
              renderWidget={renderWidget}
              hideToolbar={true}
              externalState={dashboardLayoutState}
            />
          )
        ) : (
          // Desktop: Always show full grid
          <DashboardWidgetGrid
            team="direction"
            renderWidget={renderWidget}
            hideToolbar={true}
            externalState={dashboardLayoutState}
          />
        )}
      </div>
    </div>
  )
}
