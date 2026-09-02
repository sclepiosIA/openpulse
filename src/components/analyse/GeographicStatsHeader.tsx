import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2,
  MapPin,
  TrendingUp,
  Percent,
  Target,
  Rocket,
  CheckCircle2,
  X,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getGeoPhaseFromStatus } from '@/config/phases'

interface Etablissement {
  id: string
  statut: string
  region?: string
  [key: string]: any
}

interface GeographicStatsHeaderProps {
  etablissements: Etablissement[]
  filteredEtablissements: Etablissement[]
  mapFilter: string
  selectedRegion: string | null
  onFilterChange: (filter: 'all' | 'prospects' | 'deploiement' | 'production') => void
  onClearRegion: () => void
  onResetAll?: () => void
  activeFiltersCount?: number
}

const PHASE_CONFIG = {
  prospects: {
    label: 'Prospects',
    icon: Target,
    bgActive: 'bg-amber-500',
    bgInactive: 'bg-amber-50 dark:bg-amber-950/30',
    textActive: 'text-white',
    textInactive: 'text-amber-700 dark:text-amber-400',
    borderActive: 'border-amber-500 shadow-lg shadow-amber-500/25',
    borderInactive: 'border-amber-200 dark:border-amber-800 hover:border-amber-400',
    dotClass: 'bg-amber-500',
  },
  deploiement: {
    label: 'Déploiement',
    icon: Rocket,
    bgActive: 'bg-blue-500',
    bgInactive: 'bg-blue-50 dark:bg-blue-950/30',
    textActive: 'text-white',
    textInactive: 'text-blue-700 dark:text-blue-400',
    borderActive: 'border-blue-500 shadow-lg shadow-blue-500/25',
    borderInactive: 'border-blue-200 dark:border-blue-800 hover:border-blue-400',
    dotClass: 'bg-blue-500',
  },
  production: {
    label: 'Production',
    icon: CheckCircle2,
    bgActive: 'bg-emerald-500',
    bgInactive: 'bg-emerald-50 dark:bg-emerald-950/30',
    textActive: 'text-white',
    textInactive: 'text-emerald-700 dark:text-emerald-400',
    borderActive: 'border-emerald-500 shadow-lg shadow-emerald-500/25',
    borderInactive: 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-400',
    dotClass: 'bg-emerald-500',
  },
}

export function GeographicStatsHeader({
  etablissements,
  filteredEtablissements,
  mapFilter,
  selectedRegion,
  onFilterChange,
  onClearRegion,
  onResetAll,
  activeFiltersCount = 0,
}: GeographicStatsHeaderProps) {
  const stats = useMemo(() => {
    const regionsSet = new Set(filteredEtablissements.map((e) => e.region).filter(Boolean))
    const prospectsCount = filteredEtablissements.filter(
      (e) => getGeoPhaseFromStatus(e.statut) === 'prospects'
    ).length
    const productionCount = filteredEtablissements.filter(
      (e) => getGeoPhaseFromStatus(e.statut) === 'production'
    ).length
    const conversionRate =
      prospectsCount > 0 ? Math.round((productionCount / prospectsCount) * 100) : 0
    const coverageRate = Math.round((regionsSet.size / 18) * 100)

    return {
      total: filteredEtablissements.length,
      regions: regionsSet.size,
      conversionRate,
      coverageRate,
    }
  }, [filteredEtablissements])

  const phaseCounts = useMemo(
    () => ({
      prospects: etablissements.filter((e) => getGeoPhaseFromStatus(e.statut) === 'prospects')
        .length,
      deploiement: etablissements.filter((e) => getGeoPhaseFromStatus(e.statut) === 'deploiement')
        .length,
      production: etablissements.filter((e) => getGeoPhaseFromStatus(e.statut) === 'production')
        .length,
    }),
    [etablissements]
  )

  const isFiltered = mapFilter !== 'all' || selectedRegion || activeFiltersCount > 0

  return (
    <div className="space-y-6">
      {/* Header avec titre */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analyse Géographique</h1>
            <p className="text-sm text-muted-foreground">
              Visualisez la répartition de vos établissements
            </p>
          </div>
          {isFiltered && (
            <Badge className="ml-auto text-xs font-medium bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
              {filteredEtablissements.length} résultat{filteredEtablissements.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* KPIs Cards - Design Premium */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* KPI Principal */}
        <Card className="col-span-2 lg:col-span-1 p-5 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-4 relative">
            <div className="p-3 rounded-xl bg-primary/20 border border-primary/20">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl lg:text-4xl font-bold tracking-tight">{stats.total}</p>
              <p className="text-sm text-muted-foreground">
                {isFiltered ? `sur ${etablissements.length} établissements` : 'Établissements'}
              </p>
            </div>
          </div>
        </Card>

        {/* KPI Régions */}
        <Card className="p-4 bg-gradient-to-br from-chart-2/10 via-chart-2/5 to-transparent border-chart-2/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-chart-2/20 border border-chart-2/20">
              <MapPin className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.regions}</p>
              <p className="text-xs text-muted-foreground">Régions couvertes</p>
            </div>
          </div>
        </Card>

        {/* KPI Conversion */}
        <Card className="p-4 bg-gradient-to-br from-chart-5/10 via-chart-5/5 to-transparent border-chart-5/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-chart-5/20 border border-chart-5/20">
              <TrendingUp className="h-5 w-5 text-chart-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.conversionRate}%</p>
              <p className="text-xs text-muted-foreground">Taux de conversion</p>
            </div>
          </div>
        </Card>

        {/* KPI Couverture */}
        <Card className="p-4 bg-gradient-to-br from-chart-3/10 via-chart-3/5 to-transparent border-chart-3/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-chart-3/20 border border-chart-3/20">
              <Percent className="h-5 w-5 text-chart-3" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.coverageRate}%</p>
              <p className="text-xs text-muted-foreground">Couverture nationale</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Phase Filter Buttons - Design Premium */}
      <div className="flex flex-wrap items-center gap-2 lg:gap-3">
        <button
          onClick={() => onFilterChange('all')}
          className={cn(
            'px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border-2',
            'hover:scale-[1.02] active:scale-[0.98]',
            mapFilter === 'all' && !selectedRegion
              ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent'
          )}
        >
          <span>Tous</span>
          <span className="ml-2 opacity-80">({etablissements.length})</span>
        </button>

        {(Object.keys(PHASE_CONFIG) as Array<keyof typeof PHASE_CONFIG>).map((phase) => {
          const config = PHASE_CONFIG[phase]
          const Icon = config.icon
          const isActive = mapFilter === phase

          return (
            <button
              key={phase}
              onClick={() => onFilterChange(phase)}
              className={cn(
                'px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2.5',
                'hover:scale-[1.02] active:scale-[0.98]',
                isActive
                  ? cn(config.bgActive, config.textActive, config.borderActive)
                  : cn(config.bgInactive, config.textInactive, config.borderInactive)
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{config.label}</span>
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs font-bold',
                  isActive ? 'bg-card/20 text-inherit border-0' : 'bg-transparent'
                )}
              >
                {phaseCounts[phase]}
              </Badge>
            </button>
          )
        })}

        {selectedRegion && (
          <button
            onClick={onClearRegion}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-accent-foreground hover:bg-accent/80 flex items-center gap-2 border-2 border-accent transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <MapPin className="h-4 w-4" />
            <span className="max-w-[120px] truncate">{selectedRegion}</span>
            <X className="h-4 w-4" />
          </button>
        )}

        {activeFiltersCount > 0 && (
          <Badge variant="outline" className="text-xs py-1.5 px-3 font-medium border-dashed">
            +{activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} avancé
            {activeFiltersCount > 1 ? 's' : ''}
          </Badge>
        )}

        {(mapFilter !== 'all' || selectedRegion || activeFiltersCount > 0) && onResetAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetAll}
            className="text-xs text-muted-foreground hover:text-destructive ml-auto"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Réinitialiser
          </Button>
        )}
      </div>
    </div>
  )
}
