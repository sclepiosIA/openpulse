import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTresoreriePrevisionnel } from '@/hooks/tresorerie/useTresoreriePrevisionnel'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Calculator,
  BarChart3,
} from 'lucide-react'
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  ReferenceLine,
} from 'recharts'
import { cn } from '@/lib/utils'

type Horizon = '3' | '6' | '12'
type ScenarioType = 'pessimiste' | 'realiste' | 'optimiste'

interface SimulationEntry {
  type: 'revenu' | 'depense'
  montant: number
  mois: number // Index du mois (0-11)
}

const SCENARIOS = {
  pessimiste: {
    pipelineMultiplier: 0.5,
    depensesDelta: 1.1,
    label: 'Pessimiste',
    color: 'hsl(0, 84%, 60%)',
    description: '50% pipeline, +10% dépenses',
  },
  realiste: {
    pipelineMultiplier: 0.7,
    depensesDelta: 1.0,
    label: 'Réaliste',
    color: 'hsl(217, 91%, 60%)',
    description: '70% pipeline, dépenses stables',
  },
  optimiste: {
    pipelineMultiplier: 1.0,
    depensesDelta: 0.95,
    label: 'Optimiste',
    color: 'hsl(142, 76%, 36%)',
    description: '100% pipeline, -5% dépenses',
  },
}

export function TresoreriePrevisionnelle() {
  const { previsions, isLoading } = useTresoreriePrevisionnel()
  const [horizon, setHorizon] = useState<Horizon>('12')
  const [simulation, setSimulation] = useState<SimulationEntry | null>(null)
  const [simType, setSimType] = useState<'revenu' | 'depense'>('revenu')
  const [simMontant, setSimMontant] = useState('')
  const [simMois, setSimMois] = useState('0')

  const formatMontant = (value: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value)

  const formatCompact = (value: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)

  // Calcul des scénarios
  const scenariosData = useMemo(() => {
    if (!previsions.length) return []

    const horizonNum = parseInt(horizon)
    const slicedPrevisions = previsions.slice(0, horizonNum)

    return slicedPrevisions.map((p, index) => {
      const baseRevenusContractualises = p.revenusContractualises
      const baseRevenusPipeline = p.revenusPipeline
      const baseDepenses = p.depenses

      // Appliquer simulation si présente
      let simRevenuDelta = 0
      let simDepenseDelta = 0
      if (simulation && simulation.mois === index) {
        if (simulation.type === 'revenu') {
          simRevenuDelta = simulation.montant
        } else {
          simDepenseDelta = simulation.montant
        }
      }

      // Calcul par scénario
      const scenarioValues: Record<ScenarioType, number> = {
        pessimiste: 0,
        realiste: 0,
        optimiste: 0,
      }

      ;(Object.keys(SCENARIOS) as ScenarioType[]).forEach((scenario) => {
        const config = SCENARIOS[scenario]
        const revenus =
          baseRevenusContractualises +
          baseRevenusPipeline * config.pipelineMultiplier +
          simRevenuDelta
        const depenses = baseDepenses * config.depensesDelta + simDepenseDelta
        const flux = revenus - depenses
        scenarioValues[scenario] = flux
      })

      return {
        mois: p.moisLabel,
        moisIndex: index,
        ...scenarioValues,
        base: p.fluxTresorerie,
      }
    })
  }, [previsions, horizon, simulation])

  // Calcul des soldes cumulés
  const chartData = useMemo(() => {
    if (!scenariosData.length || !previsions.length) return []

    const soldeInitial = previsions[0] ? previsions[0].soldePrevu - previsions[0].fluxTresorerie : 0

    let cumulPessimiste = soldeInitial
    let cumulRealiste = soldeInitial
    let cumulOptimiste = soldeInitial

    return scenariosData.map((d) => {
      cumulPessimiste += d.pessimiste
      cumulRealiste += d.realiste
      cumulOptimiste += d.optimiste

      return {
        mois: d.mois,
        pessimiste: cumulPessimiste,
        realiste: cumulRealiste,
        optimiste: cumulOptimiste,
      }
    })
  }, [scenariosData, previsions])

  // Point de stress (premier mois où pessimiste < 0)
  const stressPoint = useMemo(() => {
    return chartData.find((d) => d.pessimiste < 0)
  }, [chartData])

  // Soldes finaux par scénario
  const finalBalances = useMemo(() => {
    if (!chartData.length) return null
    const last = chartData[chartData.length - 1]
    return {
      pessimiste: last.pessimiste,
      realiste: last.realiste,
      optimiste: last.optimiste,
    }
  }, [chartData])

  const handleApplySimulation = () => {
    const montant = parseFloat(simMontant)
    if (isNaN(montant) || montant <= 0) return

    setSimulation({
      type: simType,
      montant,
      mois: parseInt(simMois),
    })
  }

  const handleClearSimulation = () => {
    setSimulation(null)
    setSimMontant('')
    setSimMois('0')
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={`tresorerie-previsionnelle-skeleton-${i}`}>
              <CardContent className="pt-6">
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-[350px]" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sélecteur d'horizon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">Horizon :</span>
          <Tabs value={horizon} onValueChange={(v) => setHorizon(v as Horizon)}>
            <TabsList className="h-8">
              <TabsTrigger value="3" className="text-xs px-3">
                3 mois
              </TabsTrigger>
              <TabsTrigger value="6" className="text-xs px-3">
                6 mois
              </TabsTrigger>
              <TabsTrigger value="12" className="text-xs px-3">
                12 mois
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {simulation && (
          <Badge variant="secondary" className="gap-2">
            <Calculator className="h-3 w-3" />
            Simulation active : {simulation.type === 'revenu' ? '+' : '-'}
            {formatMontant(simulation.montant)} en M+{simulation.mois + 1}
            <button onClick={handleClearSimulation} className="ml-1 hover:text-destructive">
              ×
            </button>
          </Badge>
        )}
      </div>

      {/* Alerte point de stress */}
      {stressPoint && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-700">
              Point de stress détecté en scénario pessimiste
            </p>
            <p className="text-sm text-muted-foreground">
              Le solde passerait en négatif en <strong>{stressPoint.mois}</strong> (
              {formatMontant(stressPoint.pessimiste)}). Préparez des actions correctives.
            </p>
          </div>
        </div>
      )}

      {/* KPIs par scénario */}
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(SCENARIOS) as ScenarioType[]).map((key) => {
          const scenario = SCENARIOS[key]
          const finalBalance = finalBalances?.[key] || 0
          const isNegative = finalBalance < 0

          return (
            <Card key={key} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {key === 'pessimiste' && (
                    <TrendingDown className="h-4 w-4" style={{ color: scenario.color }} />
                  )}
                  {key === 'realiste' && (
                    <Target className="h-4 w-4" style={{ color: scenario.color }} />
                  )}
                  {key === 'optimiste' && (
                    <TrendingUp className="h-4 w-4" style={{ color: scenario.color }} />
                  )}
                  {scenario.label}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: scenario.color, color: scenario.color }}
                >
                  M+{horizon}
                </Badge>
              </CardHeader>
              <CardContent>
                <div
                  className={cn('text-2xl font-bold', isNegative ? 'text-red-600' : '')}
                  style={{ color: isNegative ? undefined : scenario.color }}
                >
                  {formatCompact(finalBalance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{scenario.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Graphique comparatif */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            Projection comparative des scénarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11 }} width={70} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatMontant(value),
                    SCENARIOS[name as ScenarioType]?.label || name,
                  ]}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--background))',
                  }}
                />
                <Legend formatter={(value) => SCENARIOS[value as ScenarioType]?.label || value} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="pessimiste"
                  name="pessimiste"
                  stroke={SCENARIOS.pessimiste.color}
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
                <Line
                  type="monotone"
                  dataKey="realiste"
                  name="realiste"
                  stroke={SCENARIOS.realiste.color}
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="optimiste"
                  name="optimiste"
                  stroke={SCENARIOS.optimiste.color}
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Simulateur */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-muted-foreground" />
            Simulateur d'impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="sim-type">Type</Label>
              <Select value={simType} onValueChange={(v) => setSimType(v as 'revenu' | 'depense')}>
                <SelectTrigger id="sim-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenu">Revenu additionnel</SelectItem>
                  <SelectItem value="depense">Dépense additionnelle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sim-montant">Montant (€)</Label>
              <Input
                id="sim-montant"
                type="number"
                placeholder="Ex: 50000"
                value={simMontant}
                onChange={(e) => setSimMontant(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sim-mois">Mois d'application</Label>
              <Select value={simMois} onValueChange={setSimMois}>
                <SelectTrigger id="sim-mois">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {previsions.slice(0, parseInt(horizon)).map((p, i) => (
                    <SelectItem key={`previsionnelle-mois-${p.moisLabel}-${i}`} value={String(i)}>
                      {p.moisLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleApplySimulation} className="flex-1">
                Appliquer
              </Button>
              {simulation && (
                <Button variant="outline" onClick={handleClearSimulation}>
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Ajoutez un revenu ou une dépense hypothétique pour visualiser son impact sur les
            projections.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
