import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Brain, TrendingUp, TrendingDown, Info, Sparkles } from 'lucide-react'
import { useForecastV2, type ForecastV2Deal } from '@/hooks/forecasting/useForecastV2'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { safeNum } from '@/lib/formatters'

const safeFmtDate = (v: unknown, pattern: string): string => {
  if (!v) return '—'
  const d = new Date(v as string)
  return Number.isNaN(d.getTime()) ? '—' : format(d, pattern, { locale: fr })
}

interface Props {
  start?: string
  end?: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n || 0)

export function ForecastV2Panel({ start, end }: Props) {
  const { data, isLoading, error } = useForecastV2(start, end)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          Erreur Forecast v2 : {(error as Error).message}
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const { kpis, top_deals } = data
  const v1 = safeNum(kpis?.pipeline_weighted_v1)
  const v2 = safeNum(kpis?.pipeline_weighted_v2)
  const delta = v2 - v1
  const deltaPct = v1 > 0 ? (delta / v1) * 100 : 0

  return (
    <div className="space-y-6">
      {/* En-tête modèle */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Forecast prédictif v2</CardTitle>
              <Badge variant="outline" className="text-xs">
                {data.model_version}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              Calculé {safeFmtDate(data.computed_at, 'd MMM HH:mm')}
            </span>
          </div>
          <CardDescription className="text-xs">
            Probabilités ajustées par signaux comportementaux + taux historique du statut.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* KPIs comparatifs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCompare label="Pondéré v1 (statique)" value={kpis.pipeline_weighted_v1} />
        <KpiCompare label="Pondéré v2 (prédictif)" value={kpis.pipeline_weighted_v2} highlight />
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Écart v2 vs v1</div>
            <div
              className={`text-2xl font-bold flex items-center gap-2 ${delta >= 0 ? 'text-success' : 'text-destructive'}`}
            >
              {delta >= 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              {fmt(delta)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {deltaPct >= 0 ? '+' : ''}
              {safeNum(deltaPct).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top deals avec ajustement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Top deals — ajustement IA
          </CardTitle>
          <CardDescription>Comparaison probabilité statique vs prédictive</CardDescription>
        </CardHeader>
        <CardContent>
          {top_deals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun deal dans la période.</p>
          ) : (
            <div className="space-y-2">
              {top_deals.slice(0, 15).map((deal) => (
                <DealRow key={deal.id} deal={deal} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCompare({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? 'border-primary/40 bg-primary/5' : ''}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className="text-2xl font-bold">{fmt(value)}</div>
      </CardContent>
    </Card>
  )
}

function DealRow({ deal }: { deal: ForecastV2Deal }) {
  const positive = deal.delta >= 0
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">{deal.nom}</div>
        <div className="text-xs text-muted-foreground">
          {deal.statut} · clôture{' '}
          {format(new Date(deal.closing_date), 'd MMM yyyy', { locale: fr })}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-4 text-xs shrink-0">
        <div className="text-center">
          <div className="text-muted-foreground">v1</div>
          <div className="font-mono">{deal.probability_v1}%</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">v2</div>
          <div className="font-mono font-semibold">{deal.probability_v2}%</div>
        </div>
        <Badge variant={positive ? 'default' : 'destructive'} className="font-mono">
          {positive ? '+' : ''}
          {deal.delta}
        </Badge>
      </div>

      <div className="text-right shrink-0">
        <div className="font-semibold text-sm">{fmt(deal.weighted_v2)}</div>
        <div className="text-xs text-muted-foreground line-through">{fmt(deal.weighted_v1)}</div>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            aria-label="Informations"
          >
            <Info className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" side="left">
          <div className="space-y-2">
            <div className="text-sm font-semibold">Décomposition du score</div>
            {deal.factors.map((f, i) => (
              <div key={`fact-${f.label}-${i}`} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{f.label}</span>
                <span
                  className={`font-mono ${f.points >= 0 ? 'text-success' : 'text-destructive'}`}
                >
                  {f.points >= 0 ? '+' : ''}
                  {f.points}
                </span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
