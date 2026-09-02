import { useState, useRef, Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'
import { useLocation } from 'react-router-dom'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Plus, LayoutDashboard, AlertTriangle, BookTemplate } from 'lucide-react'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { ContratsMobileHeader } from '@/components/contrats/ContratsMobileHeader'
import { ContratsTabsCompact } from '@/components/contrats/ContratsTabsCompact'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { Skeleton } from '@/components/ui/skeleton'
import { useContrats } from '@/hooks/contracts/useContrats'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageDataState } from '@/components/common/PageDataState'

// Lazy load components
const ContratsDashboard = lazy(() => import('@/components/contrats/ContratsDashboard'))
const ContratsList = lazy(() => import('@/components/contrats/ContratsList'))
const ContratsAlertes = lazy(() => import('@/components/contrats/ContratsAlertes'))
const ContratsTemplates = lazy(() => import('@/components/contrats/ContratsTemplates'))
const ContratFormDialog = lazy(() => import('@/components/contrats/ContratFormDialog'))

const CONTRATS_TABS = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'border-primary' },
  { value: 'contrats', label: 'Contrats', icon: FileText, color: 'border-blue-500' },
  { value: 'alertes', label: 'Alertes', icon: AlertTriangle, color: 'border-amber-500' },
  { value: 'templates', label: 'Modèles', icon: BookTemplate, color: 'border-violet-500' },
]

const LoadingFallback = () => (
  <div className="space-y-4 p-4">
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
)

function ContratsInner() {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showContratDialog, setShowContratDialog] = useState(false)
  const [editingContrat, setEditingContrat] =
    useState<
      ReturnType<typeof useContrats>['data'] extends (infer U)[] | undefined ? U | null : never
    >(null)
  const [headerSearch, setHeaderSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()
  const showGlobalNav = !location.pathname.startsWith('/m/')

  const handleSearchClick = () => {
    setActiveTab('contrats')
    setTimeout(() => searchInputRef.current?.focus(), 60)
  }

  // Get stats for header
  const {
    data: contrats,
    isLoading: contratsLoading,
    error: contratsError,
    refetch: refetchContrats,
  } = useContrats()
  const activeCount = contrats?.filter((c) => c.statut === 'actif').length || 0
  const alertesCount =
    contrats?.filter((c) => {
      if (!c.date_fin) return false
      const daysUntilEnd = Math.ceil(
        (new Date(c.date_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      return daysUntilEnd <= 30 && daysUntilEnd >= 0
    }).length || 0

  const headerStats = [{ label: 'contrats actifs', value: activeCount, highlight: true }]

  const headerActions = (
    <Button
      onClick={() => setShowContratDialog(true)}
      size="sm"
      className="h-9 rounded-xl bg-card text-primary hover:bg-card/90 shadow-md transition-all"
    >
      <Plus className="h-4 w-4 mr-2" />
      <span className="hidden sm:inline">Nouveau contrat</span>
      <span className="sm:hidden">Nouveau</span>
    </Button>
  )

  // Mobile toolbar with compact tabs
  const mobileToolbar = (
    <ContratsTabsCompact
      activeTab={activeTab}
      onTabChange={setActiveTab}
      badges={{
        alertes: alertesCount,
      }}
    />
  )

  return (
    <div className="min-h-dvh bg-gradient-page">
      {isMobile ? (
        <ContratsMobileHeader
          stats={{
            actifs: activeCount,
            alertes: alertesCount,
          }}
          onSearchClick={handleSearchClick}
          onNewContrat={() => setShowContratDialog(true)}
          toolbar={mobileToolbar}
          showGlobalNav={showGlobalNav}
        />
      ) : (
        <ImmersivePageHeader
          title="Gestion des Contrats"
          subtitle="Bibliothèque, signatures et suivi des échéances"
          icon={FileText}
          stats={headerStats}
          searchPlaceholder="Rechercher un contrat..."
          onSearchClick={handleSearchClick}
          actions={headerActions}
        >
          {/* Tabs in header - Pure HTML buttons (no Radix context needed) */}
          <div className="h-12 p-1 bg-card/10 backdrop-blur-sm border border-white/20 shadow-lg rounded-xl inline-flex gap-1">
            {CONTRATS_TABS.map((tab) => {
              const isActive = activeTab === tab.value
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex items-center gap-2 px-3 lg:px-4 h-10 rounded-lg transition-all ${
                    isActive
                      ? 'bg-card text-primary shadow-md'
                      : 'text-white/70 hover:text-white hover:bg-card/10'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{tab.label}</span>
                  {tab.value === 'alertes' && alertesCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs shadow-sm">
                      {alertesCount}
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        </ImmersivePageHeader>
      )}

      <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <PageDataState
          isLoading={contratsLoading && !contrats}
          isError={!!contratsError}
          error={contratsError}
          onRetry={() => refetchContrats()}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <Suspense fallback={<LoadingFallback />}>
              <TabsContent value="dashboard" className="space-y-4 mt-0">
                <ContratsDashboard />
              </TabsContent>

              <TabsContent value="contrats" className="space-y-4 mt-0">
                <ContratsList
                  onCreateNew={() => {
                    setEditingContrat(null)
                    setShowContratDialog(true)
                  }}
                  onEdit={(contrat) => {
                    setEditingContrat(contrat)
                    setShowContratDialog(true)
                  }}
                  search={headerSearch}
                  onSearchChange={setHeaderSearch}
                  searchInputRef={searchInputRef}
                />
              </TabsContent>

              <TabsContent value="alertes" className="space-y-4 mt-0">
                <ContratsAlertes />
              </TabsContent>

              <TabsContent value="templates" className="space-y-4 mt-0">
                <ContratsTemplates />
              </TabsContent>
            </Suspense>
          </Tabs>
        </PageDataState>
      </div>

      <Suspense fallback={null}>
        <ContratFormDialog
          open={showContratDialog}
          onOpenChange={(open) => {
            setShowContratDialog(open)
            if (!open) setEditingContrat(null)
          }}
          contrat={editingContrat ?? undefined}
        />
      </Suspense>
    </div>
  )
}

export default function Contrats() {
  return (
    <ErrorBoundary>
      <ContratsInner />
    </ErrorBoundary>
  )
}
