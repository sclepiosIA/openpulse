import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGeographicStats } from '@/hooks/geography/useGeographicStats'
import { Building2, MapPin, TrendingUp, Target, Award } from 'lucide-react'
import { formatNumber, formatPercent } from '@/lib/geoUtils'
import { getGeoPhaseFromStatus } from '@/config/phases'

interface Etablissement {
  id: string
  statut: string
  region?: string
  nombre_passages_urgences_annuel?: number
  [key: string]: any
}

interface GeographicStatsProps {
  etablissements?: Etablissement[]
}

export function GeographicStats({ etablissements }: GeographicStatsProps) {
  const { stats: globalStats, loading } = useGeographicStats()

  // Si des établissements filtrés sont fournis, calculer les stats contextuelles
  const stats = useMemo(() => {
    if (!etablissements || etablissements.length === 0) {
      return globalStats
    }

    const regionsSet = new Set(etablissements.map((e) => e.region).filter(Boolean))
    const prospectsCount = etablissements.filter(
      (e) => getGeoPhaseFromStatus(e.statut) === 'prospects'
    ).length
    const productionCount = etablissements.filter(
      (e) => getGeoPhaseFromStatus(e.statut) === 'production'
    ).length
    const totalPassages = etablissements.reduce(
      (acc, e) => acc + (e.nombre_passages_urgences_annuel || 0),
      0
    )
    const conversionRate =
      prospectsCount > 0 ? Math.round((productionCount / prospectsCount) * 100 * 10) / 10 : 0
    const coverageRate = Math.round((regionsSet.size / 18) * 100 * 10) / 10

    return {
      ...globalStats,
      totalEtablissements: etablissements.length,
      regionsCount: regionsSet.size,
      averagePerRegion:
        regionsSet.size > 0 ? Math.round((etablissements.length / regionsSet.size) * 10) / 10 : 0,
      totalPassagesUrgences: totalPassages,
      conversionRate,
      coverageRate,
    }
  }, [etablissements, globalStats])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={`geographic-stats-skeleton-${i}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const statsCards = [
    {
      title: 'Total Établissements',
      value: formatNumber(stats.totalEtablissements),
      icon: Building2,
      description: 'Tous statuts confondus',
      color: 'text-chart-1',
    },
    {
      title: 'Régions Couvertes',
      value: stats.regionsCount,
      icon: MapPin,
      description: `${formatPercent(stats.coverageRate)} du territoire`,
      color: 'text-chart-2',
    },
    {
      title: 'Moyenne par Région',
      value: stats.averagePerRegion.toFixed(1),
      icon: Target,
      description: 'Établissements',
      color: 'text-chart-3',
    },
    {
      title: 'Taux de Conversion',
      value: `${stats.conversionRate}%`,
      icon: TrendingUp,
      description: 'Prospects → Production',
      color: 'text-chart-5',
    },
    {
      title: 'Passages Urgences',
      value: formatNumber(stats.totalPassagesUrgences),
      icon: Award,
      description: 'Volume annuel total',
      color: 'text-muted-foreground',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {statsCards.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={`geographic-stat-${stat.title}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
