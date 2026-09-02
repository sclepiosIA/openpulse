import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { safeNum } from '@/lib/formatters'
import { BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react'
import type { ProductionStats } from '@/hooks/production/useProductionStats'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import { useNavigate } from 'react-router-dom'
import { calculateEtablissementValue } from '@/lib/valueCalculations'
import { formatCurrency, getHealthLabelFr } from '@/lib/productionUtils'

interface ProductionAnalyticsViewProps {
  stats: ProductionStats
  etablissements: Etablissement[]
  healthMetrics?: Map<string, any>
}

export function ProductionAnalyticsView({
  stats,
  etablissements,
  healthMetrics,
}: ProductionAnalyticsViewProps) {
  const navigate = useNavigate()

  // Top 5 clients par CA
  const topClientsByRevenue = [...etablissements]
    .map((e) => ({
      ...e,
      revenue: calculateEtablissementValue(e),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Évolution CA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Répartition du CA par santé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-success" />
                  <span className="text-sm">{getHealthLabelFr('healthy')}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {formatCurrency(stats.byHealth.healthy.revenue)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.totalRevenue > 0
                      ? ((stats.byHealth.healthy.revenue / stats.totalRevenue) * 100).toFixed(0)
                      : 0}
                    %
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-warning" />
                  <span className="text-sm">{getHealthLabelFr('at-risk')}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {formatCurrency(stats.byHealth.atRisk.revenue)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.totalRevenue > 0
                      ? ((stats.byHealth.atRisk.revenue / stats.totalRevenue) * 100).toFixed(0)
                      : 0}
                    %
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-destructive" />
                  <span className="text-sm">{getHealthLabelFr('churn-risk')}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {formatCurrency(stats.byHealth.churnRisk.revenue)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.totalRevenue > 0
                      ? ((stats.byHealth.churnRisk.revenue / stats.totalRevenue) * 100).toFixed(0)
                      : 0}
                    %
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-primary" />
                  <span className="text-sm">{getHealthLabelFr('onboarding')}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {formatCurrency(stats.byHealth.onboarding.revenue)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.totalRevenue > 0
                      ? ((stats.byHealth.onboarding.revenue / stats.totalRevenue) * 100).toFixed(0)
                      : 0}
                    %
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NPS par segment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              NPS moyen par segment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.averageNPS > 0 && (
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                  <span className="font-medium">Global</span>
                  <div className="text-right">
                    <div className="font-semibold text-lg">{stats.averageNPS.toFixed(1)}/10</div>
                  </div>
                </div>
              )}
              {stats.byHealth.healthy.nps > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">{getHealthLabelFr('healthy')}</span>
                  <div className="font-semibold text-success">
                    {safeNum(stats.byHealth.healthy.nps).toFixed(1)}/10
                  </div>
                </div>
              )}
              {stats.byHealth.atRisk.nps > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">{getHealthLabelFr('at-risk')}</span>
                  <div className="font-semibold text-warning">
                    {safeNum(stats.byHealth.atRisk.nps).toFixed(1)}/10
                  </div>
                </div>
              )}
              {stats.byHealth.churnRisk.nps > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">{getHealthLabelFr('churn-risk')}</span>
                  <div className="font-semibold text-destructive">
                    {safeNum(stats.byHealth.churnRisk.nps).toFixed(1)}/10
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top clients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Top 5 clients par CA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topClientsByRevenue.map((etab, index) => (
              <div
                key={etab.id}
                className="flex justify-between items-center p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                onClick={() => navigate(`/etablissements/${etab.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-semibold text-sm">#{index + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium">{etab.nom}</div>
                    <div className="text-xs text-muted-foreground">
                      {etab.type} · {etab.region}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(etab.revenue)}</div>
                  <div className="text-xs text-muted-foreground">{etab.ville}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Renouvellements à venir */}
      {(stats.renewals.next30Days.length > 0 || stats.renewals.next90Days.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Renouvellements à venir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.renewals.next30Days.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-destructive mb-2">
                    Urgents (sous 30 jours) - {stats.renewals.next30Days.length} client(s)
                  </div>
                  <div className="space-y-2">
                    {stats.renewals.next30Days.slice(0, 3).map((etab) => (
                      <div
                        key={etab.id}
                        className="flex justify-between items-center p-2 rounded hover:bg-muted cursor-pointer text-sm"
                        onClick={() => navigate(`/etablissements/${etab.id}`)}
                      >
                        <span>{etab.nom}</span>
                        <span className="text-muted-foreground">{etab.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {stats.renewals.next90Days.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-warning mb-2">
                    30-90 jours - {stats.renewals.next90Days.length} client(s)
                  </div>
                  <div className="space-y-2">
                    {stats.renewals.next90Days.slice(0, 3).map((etab) => (
                      <div
                        key={etab.id}
                        className="flex justify-between items-center p-2 rounded hover:bg-muted cursor-pointer text-sm"
                        onClick={() => navigate(`/etablissements/${etab.id}`)}
                      >
                        <span>{etab.nom}</span>
                        <span className="text-muted-foreground">{etab.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
