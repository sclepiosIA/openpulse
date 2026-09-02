import { useMemo, useState } from 'react'
import { debug } from '@/lib/debug'
import { useEtablissements } from '@/hooks/crm/useEtablissements'
import { useNavigate } from 'react-router-dom'
import Map from '@/components/pipeline/Map'
import { PageDataState } from '@/components/common/PageDataState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GeographicStatsHeader } from '@/components/analyse/GeographicStatsHeader'
import { GeographicCharts } from '@/components/analyse/GeographicCharts'
import { GeographicFilters } from '@/components/analyse/GeographicFilters'
import { GeographicTableView } from '@/components/analyse/GeographicTableView'
import { FranceRegionMap } from '@/components/analyse/FranceRegionMap'
import { ExpansionTimeline } from '@/components/analyse/ExpansionTimeline'
import { MobileFiltersSheet } from '@/components/analyse/MobileFiltersSheet'
import { AnalyseGeoMobileHeader } from '@/components/analyse/AnalyseGeoMobileHeader'
import { PhaseFiltersCompact } from '@/components/analyse/PhaseFiltersCompact'
import { TabsCompact } from '@/components/analyse/TabsCompact'
import { MapPin, Table2, BarChart3, Calendar } from 'lucide-react'
import { normalizeString } from '@/lib/geoUtils'
import { cn } from '@/lib/utils'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { getGeoPhaseFromStatus } from '@/config/phases'

type FilterType = 'all' | 'prospects' | 'deploiement' | 'production'

export default function AnalyseGeographique() {
  const { data: etablissements, isLoading, isError, refetch } = useEtablissements()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [mapFilter, setMapFilter] = useState<FilterType>('all')
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('map')
  const [advancedFilters, setAdvancedFilters] = useState<any>({
    search: '',
    regions: [],
    types: [],
    phases: [],
    dpis: [],
  })

  const filteredEtablissements = useMemo(() => {
    if (!etablissements) return []

    return etablissements.filter((etab) => {
      // Filtre par phase (boutons principaux)
      if (mapFilter !== 'all') {
        const phase = getGeoPhaseFromStatus(etab.statut)
        if (phase !== mapFilter) return false
      }

      // Recherche textuelle
      if (advancedFilters.search) {
        const searchTerm = normalizeString(advancedFilters.search)
        const matchesSearch =
          normalizeString(etab.nom).includes(searchTerm) ||
          normalizeString(etab.ville).includes(searchTerm) ||
          normalizeString(etab.region || '').includes(searchTerm)
        if (!matchesSearch) return false
      }

      // Filtre par régions (filtres avancés)
      if (advancedFilters.regions.length > 0 && !advancedFilters.regions.includes(etab.region))
        return false

      // Filtre par région sélectionnée (carte)
      if (selectedRegion && etab.region !== selectedRegion) return false

      // Filtre par types
      if (advancedFilters.types.length > 0 && !advancedFilters.types.includes(etab.type))
        return false

      // Filtre par phases (filtres avancés)
      if (advancedFilters.phases.length > 0) {
        const geoPhase = getGeoPhaseFromStatus(etab.statut)
        const phaseLabel =
          geoPhase === 'prospects'
            ? 'Prospects'
            : geoPhase === 'deploiement'
              ? 'Déploiement'
              : geoPhase === 'production'
                ? 'Production'
                : 'Prospects'
        if (!advancedFilters.phases.includes(phaseLabel)) return false
      }

      // Filtre par DPI
      if (
        advancedFilters.dpis.length > 0 &&
        (!etab.dpi || !advancedFilters.dpis.includes(etab.dpi))
      )
        return false

      return true
    })
  }, [etablissements, mapFilter, selectedRegion, advancedFilters])

  // Compter les filtres actifs
  const activeFiltersCount = useMemo(() => {
    return [
      advancedFilters.regions?.length || 0,
      advancedFilters.types?.length || 0,
      advancedFilters.phases?.length || 0,
      advancedFilters.dpis?.length || 0,
      advancedFilters.commercialId ? 1 : 0,
      advancedFilters.chefProjetId ? 1 : 0,
      advancedFilters.csmId ? 1 : 0,
    ].reduce((a, b) => a + b, 0)
  }, [advancedFilters])

  // Stats pour le header
  const regionsCouvertes = useMemo(() => {
    if (!etablissements) return 0
    return new Set(etablissements.map((e) => e.region).filter(Boolean)).size
  }, [etablissements])

  const productionCount = useMemo(() => {
    if (!etablissements) return 0
    return etablissements.filter((e) => getGeoPhaseFromStatus(e.statut) === 'production').length
  }, [etablissements])

  const prospectsCount = useMemo(() => {
    if (!etablissements) return 0
    return etablissements.filter((e) => getGeoPhaseFromStatus(e.statut) === 'prospects').length
  }, [etablissements])

  const deploiementCount = useMemo(() => {
    if (!etablissements) return 0
    return etablissements.filter((e) => getGeoPhaseFromStatus(e.statut) === 'deploiement').length
  }, [etablissements])

  // Couleur de bordure de la carte selon le filtre
  const mapBorderColor = useMemo(() => {
    switch (mapFilter) {
      case 'production':
        return 'ring-2 ring-emerald-500/50'
      case 'deploiement':
        return 'ring-2 ring-blue-500/50'
      case 'prospects':
        return 'ring-2 ring-amber-500/50'
      default:
        return ''
    }
  }, [mapFilter])

  // Handle filter change with sync
  const handleFilterChange = (filter: FilterType) => {
    setMapFilter(filter)
    if (filter === 'all') {
      setAdvancedFilters((prev: any) => ({ ...prev, phases: [] }))
    } else {
      const phaseLabel =
        filter === 'prospects'
          ? 'Prospects'
          : filter === 'deploiement'
            ? 'Déploiement'
            : 'Production'
      setAdvancedFilters((prev: any) => ({ ...prev, phases: [phaseLabel] }))
    }
    setSelectedRegion(null)
  }

  // Mobile toolbar
  const mobileToolbar = (
    <div className="flex items-center gap-1.5 w-full flex-nowrap">
      <PhaseFiltersCompact
        mapFilter={mapFilter}
        onFilterChange={handleFilterChange}
        counts={{
          all: etablissements?.length || 0,
          prospects: prospectsCount,
          deploiement: deploiementCount,
          production: productionCount,
        }}
        selectedRegion={selectedRegion}
        onClearRegion={() => setSelectedRegion(null)}
      />
      <div className="h-4 w-px bg-card/20 shrink-0" />
      <TabsCompact value={activeTab} onValueChange={setActiveTab} />
    </div>
  )

  if (isLoading || isError) {
    return (
      <div className="px-3 sm:px-4 lg:px-6 py-6">
        <PageDataState isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
          <></>
        </PageDataState>
      </div>
    )
  }

  if (!etablissements || etablissements.length === 0) {
    return (
      <div className="min-h-dvh bg-gradient-page">
        <ImmersivePageHeader
          title="Analyse Géographique"
          icon={MapPin}
          onSearchClick={() => setShowGlobalSearch(true)}
        />
        <div className="px-3 sm:px-4 lg:px-6 py-6">
          <Card>
            <CardContent className="py-12">
              <p className="text-muted-foreground text-center">Aucun établissement disponible.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gradient-page">
      {/* Header - Mobile vs Desktop */}
      {isMobile ? (
        <AnalyseGeoMobileHeader
          searchValue={advancedFilters.search}
          onSearchChange={(v) => setAdvancedFilters((prev: any) => ({ ...prev, search: v }))}
          stats={{
            displayed: filteredEtablissements.length,
            total: etablissements.length,
            regions: regionsCouvertes,
            production: productionCount,
          }}
          toolbar={mobileToolbar}
          showGlobalNav={true}
        />
      ) : (
        <ImmersivePageHeader
          title="Analyse Géographique"
          subtitle={`${filteredEtablissements.length} établissements`}
          icon={MapPin}
          stats={[
            { label: 'Total', value: etablissements.length },
            { label: 'Régions', value: regionsCouvertes },
            { label: 'Production', value: productionCount, highlight: true },
          ]}
          onSearchClick={() => setShowGlobalSearch(true)}
          searchPlaceholder="Rechercher une ville, région..."
        />
      )}

      <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-6">
        {/* Header avec KPIs et filtres de phase - Desktop only */}
        {!isMobile && (
          <GeographicStatsHeader
            etablissements={etablissements}
            filteredEtablissements={filteredEtablissements}
            mapFilter={mapFilter}
            selectedRegion={selectedRegion}
            onFilterChange={handleFilterChange}
            onClearRegion={() => setSelectedRegion(null)}
            onResetAll={() => {
              setMapFilter('all')
              setSelectedRegion(null)
              setAdvancedFilters({
                search: '',
                regions: [],
                types: [],
                phases: [],
                dpis: [],
              })
              try {
                localStorage.removeItem('geo-advanced-filters')
              } catch (e) {
                if (import.meta.env.DEV) debug.warn('[AnalyseGeo] Failed to clear filters:', e)
              }
            }}
            activeFiltersCount={activeFiltersCount}
          />
        )}

        {/* Tabs avec contenu */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          {/* TabsList - Desktop only (mobile uses TabsCompact in header) */}
          {!isMobile && (
            <TabsList className="grid w-full grid-cols-4 max-w-xl h-12 p-1 bg-muted/50">
              <TabsTrigger
                value="map"
                className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <MapPin className="h-4 w-4 text-chart-2" />
                <span className="hidden sm:inline">Carte</span>
              </TabsTrigger>
              <TabsTrigger
                value="charts"
                className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <BarChart3 className="h-4 w-4 text-chart-5" />
                <span className="hidden sm:inline">Graphiques</span>
              </TabsTrigger>
              <TabsTrigger
                value="table"
                className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Table2 className="h-4 w-4 text-chart-3" />
                <span className="hidden sm:inline">Tableau</span>
                <Badge variant="secondary" className="text-[10px] hidden md:inline-flex font-bold">
                  {filteredEtablissements.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="timeline"
                className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Calendar className="h-4 w-4 text-chart-4" />
                <span className="hidden sm:inline">Timeline</span>
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="map" className="space-y-4 animate-fade-in">
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              {/* Filtres - Visibles uniquement sur desktop */}
              <div className="hidden lg:block">
                <GeographicFilters onFiltersChange={setAdvancedFilters} />
              </div>

              {/* Carte et région France */}
              <div className="space-y-4">
                <Card className={cn('overflow-hidden transition-all', mapBorderColor)}>
                  {/* Header de la carte */}
                  <div className="px-4 py-3 border-b bg-muted/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h3 className="font-medium text-sm">Carte des établissements</h3>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        Production
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        Déploiement
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        Prospects
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-0">
                    <Map
                      etablissements={filteredEtablissements}
                      className="h-[450px] lg:h-[550px]"
                      onMarkerClick={(e: any) => navigate(`/etablissements/${e.id}`)}
                      selectedRegion={selectedRegion}
                    />
                  </CardContent>
                </Card>
                <FranceRegionMap
                  onRegionClick={(r) => setSelectedRegion(selectedRegion === r ? null : r)}
                  selectedRegion={selectedRegion}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="charts" className="space-y-4 animate-fade-in">
            <GeographicCharts
              onFilterByRegion={setSelectedRegion}
              onFilterByPhase={(p) => {
                const phaseMap: Record<string, FilterType> = {
                  Prospects: 'prospects',
                  Déploiement: 'deploiement',
                  Production: 'production',
                }
                setMapFilter(phaseMap[p] || 'all')
              }}
            />
          </TabsContent>

          <TabsContent value="table" className="animate-fade-in">
            <GeographicTableView etablissements={filteredEtablissements} />
          </TabsContent>

          <TabsContent value="timeline" className="animate-fade-in">
            <ExpansionTimeline etablissements={filteredEtablissements} />
          </TabsContent>
        </Tabs>

        {/* Bouton filtres flottant sur mobile */}
        <MobileFiltersSheet onFiltersChange={setAdvancedFilters} activeCount={activeFiltersCount} />

        <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />
      </div>
    </div>
  )
}
