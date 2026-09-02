import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, DollarSign, Calendar, Sun, CloudSun, Cloud, CloudRain, CloudLightning, Clock } from 'lucide-react'
import type { ProductionStats } from '@/hooks/production/useProductionStats'
import type { WeatherType, CsmSanteCompte } from '@/types/csm'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import { calculateEtablissementValue } from '@/lib/valueCalculations'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

const WEATHER_CONFIG: Record<WeatherType, { icon: typeof Sun; label: string; colorClass: string; bgClass: string; barColor: string }> = {
  sunny: { icon: Sun, label: 'Bon', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-50 dark:bg-emerald-950/30', barColor: 'bg-emerald-500' },
  'partly-cloudy': { icon: CloudSun, label: 'Correct', colorClass: 'text-amber-500', bgClass: 'bg-amber-50 dark:bg-amber-950/30', barColor: 'bg-amber-500' },
  cloudy: { icon: Cloud, label: 'À surveiller', colorClass: 'text-muted-foreground', bgClass: 'bg-gray-100 dark:bg-gray-800/30', barColor: 'bg-gray-400' },
  rainy: { icon: CloudRain, label: 'Préoccupant', colorClass: 'text-red-500', bgClass: 'bg-red-50 dark:bg-red-950/30', barColor: 'bg-red-500' },
  stormy: { icon: CloudLightning, label: 'Critique', colorClass: 'text-red-700', bgClass: 'bg-red-100 dark:bg-red-900/30', barColor: 'bg-red-700' },
  'not-started': { icon: Clock, label: 'Pas déployé', colorClass: 'text-blue-500', bgClass: 'bg-blue-50 dark:bg-blue-950/30', barColor: 'bg-blue-500' },
}

const WEATHER_ORDER: WeatherType[] = ['sunny', 'partly-cloudy', 'cloudy', 'rainy', 'stormy', 'not-started']

interface ProductionHeroMetricsProps {
  stats: ProductionStats
  onHealthFilter?: (status: string) => void
  santeMap?: Map<string, CsmSanteCompte>
  etablissements?: Etablissement[]
}

export function ProductionHeroMetrics({ stats, onHealthFilter, santeMap, etablissements }: ProductionHeroMetricsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const weatherStats = useMemo(() => {
    const result: Record<WeatherType, { count: number; revenue: number }> = {
      sunny: { count: 0, revenue: 0 },
      'partly-cloudy': { count: 0, revenue: 0 },
      cloudy: { count: 0, revenue: 0 },
      rainy: { count: 0, revenue: 0 },
      stormy: { count: 0, revenue: 0 },
      'not-started': { count: 0, revenue: 0 },
    }

    if (!etablissements) return result

    etablissements.forEach((etab) => {
      const sante = santeMap?.get(etab.id)
      const weather: WeatherType = (sante?.weather as WeatherType) || 'not-started'
      const revenue = calculateEtablissementValue(etab)
      result[weather].count++
      result[weather].revenue += revenue
    })

    return result
  }, [etablissements, santeMap])

  const totalCount = etablissements?.length || stats.totalClients

  return (
    <div className="space-y-6">
      {/* KPIs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients actifs</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.trends.recentlyLaunched > 0 && `+${stats.trends.recentlyLaunched} ce trimestre`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA annuel</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Revenus de production
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Météo globale</CardTitle>
            <Sun className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {weatherStats.sunny.count + weatherStats['partly-cloudy'].count} / {totalCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Comptes en bonne santé
            </p>
          </CardContent>
        </Card>

        <Card className={cn(
          stats.renewals.expired.length > 0 && "border-destructive/50 bg-destructive/5"
        )}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn(
              "text-sm font-medium",
              stats.renewals.expired.length > 0 && "text-destructive"
            )}>
              Renouvellements
              {stats.renewals.expired.length > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">
                  {stats.renewals.expired.length} expirés
                </span>
              )}
            </CardTitle>
            <Calendar className={cn(
              "h-4 w-4",
              stats.renewals.expired.length > 0 ? "text-destructive" : "text-muted-foreground"
            )} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.renewals.next30Days.length + stats.renewals.next90Days.length + stats.renewals.expired.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.renewals.next30Days.length} sous 30 jours · {stats.renewals.next90Days.length} sous 90 jours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Répartition par météo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            Répartition par météo client
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {WEATHER_ORDER.map((weather) => {
              const config = WEATHER_CONFIG[weather]
              const data = weatherStats[weather]
              const Icon = config.icon
              const pct = totalCount > 0 ? Math.round((data.count / totalCount) * 100) : 0

              return (
                <Button
                  key={weather}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start gap-2 hover:border-foreground/20"
                  onClick={() => onHealthFilter?.(weather)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className={cn("rounded-full p-1.5", config.bgClass)}>
                      <Icon className={cn("w-4 h-4", config.colorClass)} />
                    </div>
                    <span className="font-semibold text-sm">{config.label}</span>
                  </div>
                  <div className="space-y-1 w-full text-left">
                    <div className={cn("text-2xl font-bold", config.colorClass)}>
                      {data.count}
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        ({pct}%)
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      CA: {formatCurrency(data.revenue)}
                    </div>
                  </div>
                </Button>
              )
            })}
          </div>

          {/* Barre de progression visuelle */}
          <div className="mt-6">
            <div className="flex gap-0.5 w-full h-3 rounded-full overflow-hidden">
              {WEATHER_ORDER.map((weather) => {
                const data = weatherStats[weather]
                const pct = totalCount > 0 ? (data.count / totalCount) * 100 : 0
                if (pct === 0) return null
                return (
                  <div
                    key={weather}
                    className={WEATHER_CONFIG[weather].barColor}
                    style={{ width: `${pct}%` }}
                  />
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
