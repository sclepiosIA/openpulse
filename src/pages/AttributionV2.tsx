import { useState } from 'react'
import { safeNum } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Target, TrendingUp, Users, CheckCircle2 } from 'lucide-react'
import { useAttributionV2, type AttributionModel } from '@/hooks/crm/useAttributionV2'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { PageDataState } from '@/components/common/PageDataState'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n || 0)

export default function AttributionV2Page() {
  usePageTitle('Attribution v2')
  const [model, setModel] = useState<AttributionModel>('time-decay')
  const { data, isLoading, error, refetch } = useAttributionV2(model)

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Target className="h-7 w-7 text-primary" />
            Attribution multi-touch v2
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ROI par canal sur les 12 derniers mois — pondération configurable
          </p>
        </div>
        <Tabs value={model} onValueChange={(v) => setModel(v as AttributionModel)}>
          <TabsList>
            <TabsTrigger value="linear">Linéaire</TabsTrigger>
            <TabsTrigger value="time-decay">Time-decay</TabsTrigger>
            <TabsTrigger value="u-shape">U-shape</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <PageDataState
        isLoading={isLoading}
        isError={!!error}
        error={error}
        onRetry={() => refetch()}
        loadingFallback={
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-96" />
          </div>
        }
      >
        {data && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                icon={Target}
                label="Touchpoints"
                value={safeNum(data.totals.touchpoints).toLocaleString('fr-FR')}
              />
              <KpiCard
                icon={Users}
                label="Établissements"
                value={safeNum(data.totals.etablissements).toLocaleString('fr-FR')}
              />
              <KpiCard
                icon={CheckCircle2}
                label="Signés"
                value={safeNum(data.totals.signed).toLocaleString('fr-FR')}
              />
              <KpiCard
                icon={TrendingUp}
                label="Valeur attribuée"
                value={fmtEur(data.totals.attributed_value)}
                highlight
              />
            </div>

            {/* Graph */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Valeur attribuée par canal</CardTitle>
                <CardDescription>
                  Modèle : <span className="font-semibold">{model}</span> · calculé{' '}
                  {format(new Date(data.computed_at), 'd MMM HH:mm', { locale: fr })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.channels.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    Aucun touchpoint sur la période.
                  </p>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer>
                      <BarChart data={data.channels}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(v: number) => fmtEur(v)}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          dataKey="attributed_value"
                          name="Valeur attribuée"
                          fill="hsl(var(--primary))"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Table détaillée */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Détail ROI par canal</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Canal</th>
                      <th className="text-right py-2 px-2">Touchpoints</th>
                      <th className="text-right py-2 px-2">Étabs</th>
                      <th className="text-right py-2 px-2">Signés</th>
                      <th className="text-right py-2 px-2">Conversion</th>
                      <th className="text-right py-2 px-2">Valeur attribuée</th>
                      <th className="text-right py-2 px-2">€/touch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.channels.map((c) => (
                      <tr key={c.channel} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-2">
                          <Badge variant="outline" className="font-mono">
                            {c.channel}
                          </Badge>
                        </td>
                        <td className="text-right py-2 px-2 font-mono">{c.touchpoints}</td>
                        <td className="text-right py-2 px-2 font-mono">{c.etablissements}</td>
                        <td className="text-right py-2 px-2 font-mono">{c.signed}</td>
                        <td className="text-right py-2 px-2 font-mono">
                          <span
                            className={
                              c.conversion_rate >= 20
                                ? 'text-success'
                                : c.conversion_rate >= 10
                                  ? 'text-foreground'
                                  : 'text-muted-foreground'
                            }
                          >
                            {c.conversion_rate}%
                          </span>
                        </td>
                        <td className="text-right py-2 px-2 font-semibold">
                          {fmtEur(c.attributed_value)}
                        </td>
                        <td className="text-right py-2 px-2 font-mono text-muted-foreground">
                          {fmtEur(c.value_per_touch)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </PageDataState>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, highlight = false }: any) {
  return (
    <Card className={highlight ? 'border-primary/40 bg-primary/5' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <div className="text-xl md:text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}
