import { Button } from '@/components/ui/button'
import { debug } from '@/lib/debug'
import {
  Download,
  RefreshCw,
  BarChart3,
  ChevronDown,
  MoreHorizontal,
  FileSpreadsheet,
  FileText,
  FileDown,
} from 'lucide-react'
import { useToast } from '@/hooks/shared/use-toast'
import React, { useState, useEffect } from 'react'
import { RapportsPeriodSelector } from '@/components/rapports/RapportsPeriodSelector'
import { RapportsAdvancedFilters } from '@/components/rapports/RapportsAdvancedFilters'
import { RapportsHeroMetrics } from '@/components/rapports/RapportsHeroMetrics'
import { RapportsChartsSection } from '@/components/rapports/RapportsChartsSection'
import { RapportsTableView } from '@/components/rapports/RapportsTableView'
import { RapportsTimelineView } from '@/components/rapports/RapportsTimelineView'
import { RapportsGoalsView } from '@/components/rapports/RapportsGoalsView'
import { RapportsComparativeView } from '@/components/rapports/RapportsComparativeView'
import { RapportsAIInsights } from '@/components/rapports/RapportsAIInsights'
import { RapportsBreadcrumbs } from '@/components/rapports/RapportsBreadcrumbs'
import { RapportsViewSelectorCompact } from '@/components/rapports/RapportsViewSelectorCompact'
import { RapportsMobileHeader } from '@/components/rapports/RapportsMobileHeader'
import { useRapportsFilters, type RapportsView } from '@/hooks/analytics/useRapportsFilters'
import { useRapportsData } from '@/hooks/analytics/useRapportsData'
import { RapportsDrilldownProvider } from '@/contexts/RapportsDrilldownContext'
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  prepareEtablissementsForExport,
} from '@/lib/rapportExportUtils'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { GlassmorphismUnderlineTabs } from '@/components/ui/glassmorphism-underline-tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/ui/use-mobile'

export default function Rapports() {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [showKPIs, setShowKPIs] = useState(
    () => localStorage.getItem('rapports-show-kpis') !== 'false'
  )
  const [showSearch, setShowSearch] = useState(false)

  const {
    view,
    setView,
    filters,
    periodPreset,
    setPeriodPreset,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    compareWithPrevious,
    setCompareWithPrevious,
    selectedEtablissements,
    setSelectedEtablissements,
    selectedResponsables,
    setSelectedResponsables,
    selectedStatuts,
    setSelectedStatuts,
    selectedTypesOffre,
    setSelectedTypesOffre,
    selectedPalliers,
    setSelectedPalliers,
    minValue,
    setMinValue,
    maxValue,
    setMaxValue,
    minPassages,
    setMinPassages,
    maxPassages,
    setMaxPassages,
    includeProspects,
    setIncludeProspects,
    productionOnly,
    setProductionOnly,
    resetFilters,
  } = useRapportsFilters()

  const { etablissements, stats, profiles } = useRapportsData(filters)

  useEffect(() => {
    localStorage.setItem('rapports-show-kpis', String(showKPIs))
  }, [showKPIs])

  const handleExport = (type: string) => {
    if (!etablissements || etablissements.length === 0) {
      toast({
        title: 'Aucune donnée',
        description: "Il n'y a pas de données à exporter",
        variant: 'destructive',
      })
      return
    }

    const exportData = prepareEtablissementsForExport(etablissements, profiles || [])

    try {
      switch (type) {
        case 'CSV':
          exportToCSV(exportData, 'rapports')
          break
        case 'Excel':
          exportToExcel(exportData, stats, 'rapports')
          break
        case 'PDF':
          exportToPDF(exportData, stats, 'rapports')
          break
      }
      toast({
        title: 'Export réussi',
        description: `Le fichier ${type} a été téléchargé`,
      })
    } catch (error) {
      debug.error('Export error:', error)
      toast({
        title: "Erreur d'export",
        description: "Une erreur s'est produite lors de l'export",
        variant: 'destructive',
      })
    }
  }

  const handleRefresh = () => {
    toast({
      title: 'Actualisation',
      description: 'Les données ont été actualisées',
    })
  }

  const headerStats = [
    { label: 'établissements', value: stats?.totalEtablissements || 0, highlight: true },
    { label: 'CA total', value: `${Math.round((stats?.totalValeur || 0) / 1000)}k€` },
  ]

  // Header actions - Premium Glassmorphism
  const headerActions = (
    <div className="flex items-center gap-2">
      {/* KPIs Toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowKPIs(!showKPIs)}
        className={cn(
          'h-9 px-3 gap-2 rounded-xl transition-all',
          showKPIs
            ? 'bg-card/20 border border-white/30 text-white'
            : 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/70 hover:text-white hover:bg-card/20'
        )}
      >
        <BarChart3 className="h-4 w-4" />
        <span className="hidden sm:inline text-sm">KPIs</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', showKPIs && 'rotate-180')} />
      </Button>

      {/* Export dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 gap-2 rounded-xl bg-card/10 backdrop-blur-sm border border-white/20 text-white/70 hover:text-white hover:bg-card/20 transition-all"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Export</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="rounded-xl border-primary/10 shadow-lg bg-card/95 backdrop-blur-md"
        >
          <DropdownMenuItem onClick={() => handleExport('CSV')} className="rounded-lg">
            <FileDown className="h-4 w-4 mr-2" />
            Exporter CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('Excel')} className="rounded-lg">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exporter Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('PDF')} className="rounded-lg">
            <FileText className="h-4 w-4 mr-2" />
            Exporter PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* More actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-xl bg-card/10 backdrop-blur-sm border border-white/20 text-white/70 hover:text-white hover:bg-card/20 transition-all"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="rounded-xl border-primary/10 shadow-lg bg-card/95 backdrop-blur-md"
        >
          <DropdownMenuItem onClick={handleRefresh} className="rounded-lg">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  // Mobile toolbar content
  const mobileToolbar = (
    <div className="flex items-center gap-1.5 w-full flex-nowrap">
      {/* Period pills compacts */}
      {(['7d', '30d', '90j', '1y'] as const).map((p, i) => {
        const labels = ['7j', '30j', '90j', '1an']
        return (
          <button
            key={p}
            onClick={() => setPeriodPreset(p === '90j' ? '90d' : p)}
            className={cn(
              'h-6 px-2 text-[10px] rounded-lg transition-all shrink-0',
              periodPreset === p || (p === '90j' && periodPreset === '90d')
                ? 'bg-card text-primary shadow-sm'
                : 'bg-card/10 border border-white/20 text-white/70 hover:bg-card/20'
            )}
          >
            {labels[i]}
          </button>
        )
      })}
      <div className="h-4 w-px bg-card/20 shrink-0" />
      {/* View icons */}
      <RapportsViewSelectorCompact currentView={view} onViewChange={setView} />
    </div>
  )

  // Mobile header actions
  const mobileHeaderActions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white rounded-lg"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="rounded-xl border-primary/10 shadow-lg bg-card/95 backdrop-blur-md"
      >
        <DropdownMenuItem onClick={() => handleExport('CSV')} className="rounded-lg">
          <FileDown className="h-4 w-4 mr-2" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('Excel')} className="rounded-lg">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('PDF')} className="rounded-lg">
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleRefresh} className="rounded-lg">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <RapportsDrilldownProvider>
      <div className="min-h-dvh bg-gradient-page">
        {/* Header - Conditional Mobile/Desktop */}
        {isMobile ? (
          <RapportsMobileHeader
            stats={{
              etablissements: stats?.totalEtablissements || 0,
              caTotal: `${Math.round((stats?.totalValeur || 0) / 1000)}k€`,
            }}
            onSearchClick={() => setShowSearch(true)}
            toolbar={mobileToolbar}
            headerActions={mobileHeaderActions}
          />
        ) : (
          <ImmersivePageHeader
            title="Rapports"
            subtitle="Analyses et statistiques détaillées"
            icon={BarChart3}
            stats={headerStats}
            searchPlaceholder="Rechercher..."
            onSearchClick={() => setShowSearch(true)}
            actions={headerActions}
          >
            {/* Compact toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <RapportsPeriodSelector
                  periodPreset={periodPreset}
                  onPeriodChange={setPeriodPreset}
                  customStartDate={customStartDate}
                  customEndDate={customEndDate}
                  onCustomStartDateChange={setCustomStartDate}
                  onCustomEndDateChange={setCustomEndDate}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <RapportsAdvancedFilters
                  selectedEtablissements={selectedEtablissements}
                  onSelectedEtablissementsChange={setSelectedEtablissements}
                  selectedResponsables={selectedResponsables}
                  onSelectedResponsablesChange={setSelectedResponsables}
                  selectedStatuts={selectedStatuts}
                  onSelectedStatutsChange={setSelectedStatuts}
                  selectedTypesOffre={selectedTypesOffre}
                  onSelectedTypesOffreChange={setSelectedTypesOffre}
                  selectedPalliers={selectedPalliers}
                  onSelectedPalliersChange={setSelectedPalliers}
                  minValue={minValue}
                  maxValue={maxValue}
                  onValueRangeChange={(min, max) => {
                    setMinValue(min)
                    setMaxValue(max)
                  }}
                  minPassages={minPassages}
                  maxPassages={maxPassages}
                  onPassagesRangeChange={(min, max) => {
                    setMinPassages(min)
                    setMaxPassages(max)
                  }}
                  includeProspects={includeProspects}
                  onIncludeProspectsChange={setIncludeProspects}
                  productionOnly={productionOnly}
                  onProductionOnlyChange={setProductionOnly}
                  compareWithPrevious={compareWithPrevious}
                  onCompareWithPreviousChange={setCompareWithPrevious}
                  onResetFilters={resetFilters}
                />
                <div className="h-5 w-px bg-card/20" />
                <GlassmorphismUnderlineTabs
                  value={view}
                  onValueChange={(v) => setView(v as RapportsView)}
                  tabs={[
                    { value: 'dashboard', label: 'Dashboard', shortLabel: 'Dash' },
                    { value: 'charts', label: 'Graphiques', shortLabel: 'Graph' },
                    { value: 'table', label: 'Tableau', shortLabel: 'Table' },
                    { value: 'evolution', label: 'Évolution', shortLabel: 'Evol' },
                    { value: 'goals', label: 'Objectifs', shortLabel: 'Obj' },
                  ]}
                />
              </div>
            </div>
          </ImmersivePageHeader>
        )}

        {/* Content */}
        <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-4">
          {/* Breadcrumbs */}
          <RapportsBreadcrumbs />

          {/* AI Insights - Only in dashboard view */}
          {view === 'dashboard' && (
            <RapportsAIInsights
              stats={stats}
              etablissements={etablissements || []}
              filters={filters}
            />
          )}

          {/* Collapsible KPIs */}
          <Collapsible open={showKPIs} onOpenChange={setShowKPIs}>
            <CollapsibleContent>
              <RapportsHeroMetrics stats={stats} compareWithPrevious={compareWithPrevious} />
            </CollapsibleContent>
          </Collapsible>

          {/* Content based on view */}
          {view === 'dashboard' && (
            <>
              <RapportsChartsSection />
              <RapportsComparativeView />
            </>
          )}

          {view === 'charts' && <RapportsChartsSection />}

          {view === 'table' && <RapportsTableView />}

          {view === 'evolution' && <RapportsTimelineView />}

          {view === 'goals' && <RapportsGoalsView />}
        </div>

        <GlobalSearchDialog open={showSearch} setOpen={setShowSearch} hideTrigger />
      </div>
    </RapportsDrilldownProvider>
  )
}
