import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  LayoutDashboard,
  List,
  Columns3,
  GanttChartSquare,
  BarChart3,
  Upload,
  Beaker,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { useRDProjets, useRDProjet } from '@/hooks/rd/useRD'
import { CreateProjetDialog } from '@/components/rd/CreateProjetDialog'
import { RDDashboard } from '@/components/rd/RDDashboard'
import { RDBacklog } from '@/components/rd/RDBacklog'
import { RDKanbanBoard } from '@/components/rd/RDKanbanBoard'
import { RDGanttContainer } from '@/components/rd/RDGanttContainer'
import { RDAnalytics } from '@/components/rd/RDAnalytics'
import { ImportDeckDialog } from '@/components/rd/ImportDeckDialog'
import { ProjetActionsMenu } from '@/components/rd/ProjetActionsMenu'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { RDMobileHeader } from '@/components/rd/RDMobileHeader'
import { RDTabsCompact } from '@/components/rd/RDTabsCompact'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { ActionsDropdown, type ActionItem } from '@/components/shared/ActionsDropdown'
import { RoadmapAIRefreshButton } from '@/components/rd/RoadmapAIRefreshButton'
import { PageDataState } from '@/components/shared/PageDataState'

const RD_TABS = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { value: 'backlog', label: 'Backlog', icon: List },
  { value: 'kanban', label: 'Kanban', icon: Columns3 },
  { value: 'gantt', label: 'Gantt', icon: GanttChartSquare },
  { value: 'analytics', label: 'Analytics', icon: BarChart3 },
]

export default function RD() {
  const location = useLocation()
  const [selectedProjetId, setSelectedProjetId] = useState<string | undefined>()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const isMobile = useIsMobile()
  const showGlobalNav = !location.pathname.startsWith('/m/')

  const {
    data: projets,
    isLoading: projetsLoading,
    isError: projetsError,
    error: projetsErrorObj,
    refetch: refetchProjets,
  } = useRDProjets()
  const { data: currentProjet } = useRDProjet(selectedProjetId)

  // Auto-select first project if none selected
  if (!selectedProjetId && projets?.length && !projetsLoading) {
    setSelectedProjetId(projets[0].id)
  }

  const activeTabData = RD_TABS.find((t) => t.value === activeTab)

  // Actions secondaires groupées
  const secondaryActions: ActionItem[] = [
    {
      label: 'Importer JSON',
      icon: Upload,
      onClick: () => setShowImportDialog(true),
    },
  ]

  // Mobile project selector
  const mobileProjectSelector = (
    <Select value={selectedProjetId} onValueChange={setSelectedProjetId}>
      <SelectTrigger className="w-full h-8 bg-card/10 backdrop-blur-sm border-white/20 text-white text-xs">
        <SelectValue placeholder="Sélectionner un projet" />
      </SelectTrigger>
      <SelectContent className="bg-card">
        {projets?.map((projet) => (
          <SelectItem key={projet.id} value={projet.id}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: projet.couleur }} />
              <span className="truncate">{projet.nom}</span>
              {projet.dpi && (
                <span className="text-[9px] uppercase font-semibold px-1 py-0.5 rounded bg-muted text-muted-foreground">
                  {projet.dpi === 'hm' ? 'HM' : projet.dpi === 'resurgences' ? 'RES' : 'TRV'}
                </span>
              )}
              {projet.visible_portail && <span title="Visible portail client">🌐</span>}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="min-h-dvh bg-gradient-page">
      {isMobile ? (
        <RDMobileHeader
          currentProjet={
            currentProjet ? { nom: currentProjet.nom, statut: currentProjet.statut } : null
          }
          onSearchClick={() => setShowGlobalSearch(true)}
          onCreateProject={() => setShowCreateDialog(true)}
          onImport={() => setShowImportDialog(true)}
          projectSelector={mobileProjectSelector}
          toolbar={<RDTabsCompact currentTab={activeTab} onTabChange={setActiveTab} />}
          showGlobalNav={showGlobalNav}
        />
      ) : (
        <ImmersivePageHeader
          title="R&D / Développement"
          subtitle="Gestion agile des projets"
          icon={Beaker}
          searchPlaceholder="Rechercher stories..."
          onSearchClick={() => setShowGlobalSearch(true)}
          actions={
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* Project Selector */}
              <Select value={selectedProjetId} onValueChange={setSelectedProjetId}>
                <SelectTrigger className="w-full sm:w-[180px] md:w-[220px] h-9 bg-card/10 backdrop-blur-sm border-white/20 text-white">
                  <SelectValue placeholder="Sélectionner un projet" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  {projets?.map((projet) => (
                    <SelectItem key={projet.id} value={projet.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: projet.couleur }}
                        />
                        <span className="truncate">{projet.nom}</span>
                        {projet.dpi && (
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {projet.dpi === 'hm'
                              ? 'HM'
                              : projet.dpi === 'resurgences'
                                ? 'RES'
                                : 'TRV'}
                          </span>
                        )}
                        {projet.visible_portail && (
                          <span title="Visible sur le portail client">🌐</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Project Actions Menu */}
              {currentProjet && (
                <ProjetActionsMenu
                  projet={currentProjet}
                  onDeleted={() => {
                    const remainingProjets = projets?.filter((p) => p.id !== currentProjet.id)
                    setSelectedProjetId(remainingProjets?.[0]?.id)
                  }}
                />
              )}

              {/* Bouton régénération résumé IA roadmap (admin/direction) */}
              <RoadmapAIRefreshButton />

              {/* Actions secondaires groupées */}
              <ActionsDropdown actions={secondaryActions} className="hidden sm:flex" />

              <Button
                onClick={() => setShowCreateDialog(true)}
                size="sm"
                className="h-9 bg-card text-primary hover:bg-card/90 border border-white/30 rounded-xl transition-colors"
              >
                <Plus className="h-4 w-4 mr-0 sm:mr-2" />
                <span className="hidden sm:inline font-semibold">Nouveau projet</span>
              </Button>
            </div>
          }
        >
          {/* Project Status Badge inside header */}
          {currentProjet && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={currentProjet.statut === 'actif' ? 'default' : 'secondary'}
                className="bg-card/20 text-white border-white/30"
              >
                {currentProjet.statut}
              </Badge>
              {currentProjet.responsable && (
                <span className="text-sm text-white/70 hidden sm:inline">
                  Lead: {currentProjet.responsable.prenom} {currentProjet.responsable.nom}
                </span>
              )}
            </div>
          )}
        </ImmersivePageHeader>
      )}

      {/* Global Search Dialog */}
      <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />

      {/* Main Content */}
      <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        {projetsError ? (
          <Card className="py-12 sm:py-20 bg-card/80 backdrop-blur-sm border-destructive/20">
            <CardContent className="text-center px-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Erreur de chargement</h2>
              <p className="text-sm text-muted-foreground mb-2">
                Impossible de charger les projets R&D
              </p>
              {projetsErrorObj?.message && (
                <p className="text-xs text-destructive/80 mb-6 font-mono break-words max-w-xl mx-auto">
                  {projetsErrorObj.message}
                </p>
              )}
              <Button onClick={() => refetchProjets()} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : projetsLoading ? (
          <PageDataState
            isLoading
            loadingLabel="Chargement des projets R&D…"
            onRetry={() => refetchProjets()}
          >
            {null}
          </PageDataState>
        ) : !selectedProjetId ? (
          <Card className="py-12 sm:py-20 bg-card/80 backdrop-blur-sm border-primary/10 shadow-lg">
            <CardContent className="text-center px-4">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl opacity-50" />
                <div className="relative p-6 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 ring-4 ring-primary/10">
                  <Beaker className="h-12 w-12 sm:h-16 sm:w-16 text-primary" />
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Aucun projet R&D
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-8 max-w-md mx-auto">
                Créez votre premier projet ou importez depuis Nextcloud Deck
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowImportDialog(true)}
                  className="touch-target-min h-11 rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Importer JSON
                </Button>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="touch-target-min h-11 rounded-xl bg-primary hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un projet
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            {/* Desktop: Horizontal tabs (mobile tabs are in header) */}
            {!isMobile && (
              <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid h-12 p-1 bg-card/60 backdrop-blur-sm border border-primary/10 shadow-lg rounded-xl">
                <TabsTrigger
                  value="dashboard"
                  className="gap-2 h-10 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </TabsTrigger>
                <TabsTrigger
                  value="backlog"
                  className="gap-2 h-10 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all"
                >
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">Backlog</span>
                </TabsTrigger>
                <TabsTrigger
                  value="kanban"
                  className="gap-2 h-10 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all"
                >
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Kanban</span>
                </TabsTrigger>
                <TabsTrigger
                  value="gantt"
                  className="gap-2 h-10 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all"
                >
                  <GanttChartSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Gantt</span>
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="gap-2 h-10 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Analytics</span>
                </TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="dashboard">
              <RDDashboard projetId={selectedProjetId} />
            </TabsContent>

            <TabsContent value="backlog">
              <RDBacklog projetId={selectedProjetId} />
            </TabsContent>

            <TabsContent value="kanban">
              <RDKanbanBoard projetId={selectedProjetId} />
            </TabsContent>

            <TabsContent value="gantt">
              <RDGanttContainer projetId={selectedProjetId} />
            </TabsContent>

            <TabsContent value="analytics">
              <RDAnalytics projetId={selectedProjetId} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Dialogs */}
      <CreateProjetDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={(newProjetId) => {
          setSelectedProjetId(newProjetId)
          setShowCreateDialog(false)
        }}
      />

      <ImportDeckDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={(newProjetId) => {
          setSelectedProjetId(newProjetId)
          setShowImportDialog(false)
        }}
      />
    </div>
  )
}
