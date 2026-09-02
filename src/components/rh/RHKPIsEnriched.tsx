import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { safeNum } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { useRHAnalytics } from '@/hooks/hr/useRHAnalytics'
import { useRHKPIs } from '@/hooks/hr/useRHKPIs'
import { RHEvolutionChart } from './RHEvolutionChart'
import { RHChargesBreakdown } from './RHChargesBreakdown'
import { RHComparisonCard } from './RHComparisonCard'
import { RHAlerts } from './RHAlerts'
import { Users, TrendingUp, Calendar, DollarSign, Award } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { StatsSkeleton } from '@/components/shared/LoadingStates'

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
]

export function RHKPIsEnriched() {
  const { data: analytics, isLoading: analyticsLoading } = useRHAnalytics(12)
  const { data: kpis, isLoading: kpisLoading } = useRHKPIs()

  const isLoading = analyticsLoading || kpisLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <StatsSkeleton count={6} />
      </div>
    )
  }

  if (!analytics || !kpis) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            Aucune donnée disponible pour l'analyse RH
          </p>
        </CardContent>
      </Card>
    )
  }

  const ancienneteEnMois = Math.round(analytics.ancienneteMoyenne)
  const ancienneteAnnees = Math.floor(ancienneteEnMois / 12)
  const ancienneteMoisRestants = ancienneteEnMois % 12

  return (
    <div className="space-y-6">
      {/* Section 1 : Vue d'ensemble financière */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Vue d'ensemble financière</h3>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card className="md:col-span-1 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Masse salariale nette</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                }).format(kpis.masse_salariale_nette_mensuelle)}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                }).format(kpis.masse_salariale_nette_annuelle)}{' '}
                /an
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-1 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Masse salariale brute</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                }).format(kpis.masse_salariale_brute_mensuelle)}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                }).format(kpis.masse_salariale_brute_annuelle)}{' '}
                /an
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-1 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coût total employeur</CardTitle>
              <DollarSign className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                }).format(kpis.masse_salariale_mensuelle)}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                }).format(kpis.masse_salariale_annuelle)}{' '}
                /an
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-1 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coût employeur moyen</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                }).format(kpis.cout_moyen_salaire)}
              </div>
              <p className="text-xs text-muted-foreground">Par employé / mois</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-1 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Effectif actif</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.effectif_actif}</div>
              <p className="text-xs text-muted-foreground">Sur {kpis.effectif_total} employés</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-1 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taux d'absentéisme</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.taux_absenteisme.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {kpis.taux_absenteisme <= 3
                  ? 'Excellent'
                  : kpis.taux_absenteisme <= 5
                    ? 'Normal'
                    : 'Élevé'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 2 : Analyses RH */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Analyses RH</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Répartition par contrat</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="40%" height={120}>
                  <PieChart>
                    <Pie
                      data={analytics.repartitionContrats}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      dataKey="count"
                    >
                      {analytics.repartitionContrats.map((entry, index) => (
                        // Recharts pose `role="img"` en dur sur chaque secteur
                        // (Sector.js) : sans nom accessible, axe remonte
                        // `svg-img-alt`. Le libellé passe par les props du Cell.
                        <Cell
                          key={`cell-${index}`}
                          aria-label={`${entry.type} : ${entry.count}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {analytics.repartitionContrats.map((item, index) => (
                    <div key={item.type} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{item.type}</span>
                      </div>
                      <span className="font-medium">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Ancienneté moyenne</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {ancienneteAnnees > 0 ? `${ancienneteAnnees}a` : `${ancienneteMoisRestants}m`}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {ancienneteAnnees > 0 &&
                  ancienneteMoisRestants > 0 &&
                  `${ancienneteMoisRestants} mois`}
                {ancienneteEnMois < 12 && ' - Équipe junior'}
                {ancienneteEnMois >= 12 && ancienneteEnMois < 36 && ' - Bonne expérience'}
                {ancienneteEnMois >= 36 && ' - Équipe expérimentée'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Turnover 12 mois</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {safeNum(analytics.turnover12Mois.tauxTurnover).toFixed(1)}%
              </div>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span>↑ {analytics.turnover12Mois.entrees} entrées</span>
                <span>↓ {analytics.turnover12Mois.sorties} sorties</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 3 : Top 3 Coûts */}
      {analytics.top3Couts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 3 des coûts mensuels</CardTitle>
            <CardDescription>Employés avec les coûts totaux les plus élevés</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.top3Couts.map((item, index) => (
                <div key={item.profile_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="font-medium">
                      {item.prenom} {item.nom}
                    </span>
                  </div>
                  <span className="font-bold">
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumFractionDigits: 0,
                    }).format(item.coutTotal)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 4 : Graphiques d'évolution */}
      <div className="grid gap-6 md:grid-cols-2">
        <RHEvolutionChart />
        <RHChargesBreakdown />
      </div>

      {/* Section 5 : Comparaisons temporelles */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Comparaisons temporelles</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <RHComparisonCard type="month" />
          <RHComparisonCard type="quarter" />
          <RHComparisonCard type="year" />
        </div>
      </div>

      {/* Section 6 : Alertes et recommandations */}
      <RHAlerts />
    </div>
  )
}
