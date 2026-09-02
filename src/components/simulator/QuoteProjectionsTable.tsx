import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { QuoteResults, SimulationParams } from '@/types/simulator'
import { formatEuro, formatNumber, formatPercent } from '@/lib/simulator-config'
import {
  TrendingUp,
  Info,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Target,
  Users,
  PieChart,
} from 'lucide-react'
import { QuoteExportButtons } from './QuoteExportButtons'
import { cn } from '@/lib/utils'

interface QuoteProjectionsTableProps {
  results: QuoteResults
  params: SimulationParams
  etablissementNom?: string
}

export function QuoteProjectionsTable({
  results,
  params,
  etablissementNom,
}: QuoteProjectionsTableProps) {
  const hasReseller = results.configuration.resellerType !== null
  const isPremierNiveau = results.configuration.valorisationLevel === 'premier'

  // Couleurs des paliers
  const palierColors = [
    'from-blue-500/10 to-blue-500/5 border-blue-500/20',
    'from-indigo-500/10 to-indigo-500/5 border-indigo-500/20',
    'from-violet-500/10 to-violet-500/5 border-violet-500/20',
    'from-primary/15 to-primary/5 border-primary/30',
  ]

  const palierTextColors = [
    'text-blue-600 dark:text-blue-400',
    'text-indigo-600 dark:text-indigo-400',
    'text-violet-600 dark:text-violet-400',
    'text-primary',
  ]

  return (
    <div className="space-y-6">
      {/* Boutons d'export */}
      <div className="flex justify-end">
        <QuoteExportButtons results={results} params={params} etablissementNom={etablissementNom} />
      </div>

      {/* Données de base avec design premium */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-muted/50 to-transparent px-6 py-4 border-b">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Données de référence
          </div>
        </div>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Passages annuels
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {formatNumber(results.passagesAnnuels)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Target className="h-3.5 w-3.5" />
                UHCD actuels
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {formatNumber(results.uhcdActuels)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PieChart className="h-3.5 w-3.5" />
                UHCD mono-RUM
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {formatNumber(results.uhcdMonoRum)}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Taux mono-RUM/total</span>
              <div className="text-2xl font-bold tabular-nums text-primary">
                {formatPercent(results.tauxUhcdMonoRumSurTotal)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cartes visuelles des paliers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {results.paliers.map((p, index) => (
          <Card
            key={p.palier}
            className={cn(
              'relative overflow-hidden border-2 transition-all hover:shadow-lg',
              `bg-gradient-to-br ${palierColors[index]}`
            )}
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-card/5 rounded-full blur-xl" />
            <CardContent className="pt-4 relative">
              <div className="flex items-center justify-between mb-3">
                <Badge
                  variant="outline"
                  className={cn('text-xs font-semibold', palierTextColors[index])}
                >
                  Palier {p.palier}
                </Badge>
                <span className="text-xs text-muted-foreground">+{p.palier}% mono</span>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">ROI Net</div>
                <div
                  className={cn(
                    'text-xl font-bold tabular-nums',
                    p.roiNet > 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'
                  )}
                >
                  {p.roiNet > 0 ? '+' : ''}
                  {formatEuro(p.roiNet)}
                </div>
                <div className="flex items-center gap-1">
                  <Badge
                    variant={p.roiPourcentage > 100 ? 'default' : 'secondary'}
                    className={cn(
                      'text-xs tabular-nums',
                      p.roiPourcentage > 100 && 'bg-green-500 hover:bg-green-600'
                    )}
                  >
                    {p.roiPourcentage > 0 ? '+' : ''}
                    {formatPercent(p.roiPourcentage, 0)} ROI
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tableau des paliers détaillé */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-muted/30 to-transparent border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            Modèle au succès - Détail des 4 paliers
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-48 font-semibold">Indicateur</TableHead>
                {results.paliers.map((p, index) => (
                  <TableHead
                    key={p.palier}
                    className={cn('text-center font-semibold', palierTextColors[index])}
                  >
                    Palier {p.palier}
                    <div className="text-xs font-normal text-muted-foreground">
                      +{p.palier}% mono-RUM
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Taux objectif */}
              <TableRow>
                <TableCell className="font-medium">Taux UHCD objectif</TableCell>
                {results.paliers.map((p) => (
                  <TableCell key={p.palier} className="text-center tabular-nums">
                    {formatPercent(p.tauxObjectif)}
                  </TableCell>
                ))}
              </TableRow>

              {/* UHCD objectif */}
              <TableRow className="bg-muted/10">
                <TableCell className="font-medium">UHCD objectif</TableCell>
                {results.paliers.map((p) => (
                  <TableCell key={p.palier} className="text-center tabular-nums">
                    {formatNumber(p.uhcdObjectif)}
                  </TableCell>
                ))}
              </TableRow>

              {/* UHCD supplémentaires */}
              <TableRow>
                <TableCell className="font-medium">UHCD supplémentaires</TableCell>
                {results.paliers.map((p) => (
                  <TableCell
                    key={p.palier}
                    className="text-center text-green-600 dark:text-green-400 tabular-nums font-medium"
                  >
                    +{formatNumber(p.uhcdSupplementaires)}
                  </TableCell>
                ))}
              </TableRow>

              {/* Séparateur coûts */}
              <TableRow className="bg-muted/50 border-y-2 border-muted">
                <TableCell
                  colSpan={5}
                  className="font-semibold text-xs uppercase tracking-wide py-2"
                >
                  💰 Coûts{' '}
                  {hasReseller
                    ? `(avec ${results.configuration.resellerType?.name})`
                    : '(vente directe)'}
                </TableCell>
              </TableRow>

              {/* Frais d'accès */}
              <TableRow>
                <TableCell className="font-medium">Frais d'accès</TableCell>
                {results.paliers.map((p) => (
                  <TableCell key={p.palier} className="text-center tabular-nums">
                    {formatEuro(hasReseller ? p.fraisAccesRevendeur : p.fraisAcces)}
                  </TableCell>
                ))}
              </TableRow>

              {/* Prix solution */}
              <TableRow className="bg-muted/10">
                <TableCell className="font-medium">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 cursor-help">
                        Prix solution/an
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>PAU × multiplicateur du palier</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                {results.paliers.map((p) => (
                  <TableCell key={p.palier} className="text-center tabular-nums">
                    {formatEuro(hasReseller ? p.prixSolutionRevendeur : p.prixSolution)}
                    <div className="text-xs text-muted-foreground">×{p.multiplicateur}</div>
                  </TableCell>
                ))}
              </TableRow>

              {/* Coût total */}
              <TableRow className="font-bold">
                <TableCell>Coût total an 1</TableCell>
                {results.paliers.map((p) => (
                  <TableCell key={p.palier} className="text-center tabular-nums">
                    {formatEuro(hasReseller ? p.coutTotalRevendeur : p.coutTotal)}
                  </TableCell>
                ))}
              </TableRow>

              {/* Séparateur ROI */}
              <TableRow className="bg-green-500/10 border-y-2 border-green-500/20">
                <TableCell
                  colSpan={5}
                  className="font-semibold text-xs uppercase tracking-wide text-green-700 dark:text-green-400 py-2"
                >
                  📈 Retour sur investissement
                </TableCell>
              </TableRow>

              {/* ROI Total */}
              <TableRow>
                <TableCell className="font-medium">Gains bruts</TableCell>
                {results.paliers.map((p) => (
                  <TableCell
                    key={p.palier}
                    className="text-center text-green-600 dark:text-green-400 tabular-nums"
                  >
                    {formatEuro(p.roiTotal)}
                  </TableCell>
                ))}
              </TableRow>

              {/* ROI Net */}
              <TableRow className="font-bold bg-muted/10">
                <TableCell>ROI Net</TableCell>
                {results.paliers.map((p) => (
                  <TableCell key={p.palier} className="text-center">
                    <Badge
                      variant={p.roiNet > 0 ? 'default' : 'destructive'}
                      className={cn(
                        'font-mono tabular-nums text-sm px-3 py-1',
                        p.roiNet > 0 && 'bg-green-500 hover:bg-green-600'
                      )}
                    >
                      {p.roiNet > 0 ? (
                        <ArrowUp className="h-3 w-3 mr-1" />
                      ) : (
                        <ArrowDown className="h-3 w-3 mr-1" />
                      )}
                      {formatEuro(p.roiNet)}
                    </Badge>
                  </TableCell>
                ))}
              </TableRow>

              {/* ROI % */}
              <TableRow className="bg-primary/5 border-t-2 border-primary/20">
                <TableCell className="font-bold text-primary">ROI %</TableCell>
                {results.paliers.map((p, index) => (
                  <TableCell key={p.palier} className="text-center">
                    <Badge
                      variant={p.roiPourcentage > 0 ? 'default' : 'destructive'}
                      className={cn(
                        'text-lg px-4 py-1.5 tabular-nums',
                        p.roiPourcentage > 100 && 'bg-green-500 hover:bg-green-600',
                        p.roiPourcentage > 200 && 'bg-green-600 hover:bg-green-700'
                      )}
                    >
                      {p.roiPourcentage > 0 ? '+' : ''}
                      {formatPercent(p.roiPourcentage, 0)}
                    </Badge>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Détail ROI par levier (seulement si second niveau) */}
      {!isPremierNiveau && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-muted/30 to-transparent border-b">
            <CardTitle className="text-sm text-muted-foreground">
              Détail ROI par levier (Palier 4 - Performance maximale)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {results.paliers[3] && (
                <>
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl p-4 border border-blue-500/20">
                    <div className="text-xs text-muted-foreground mb-1">UHCD</div>
                    <div className="font-bold text-lg tabular-nums">
                      {formatEuro(results.paliers[3].roiUhcd)}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 rounded-xl p-4 border border-indigo-500/20">
                    <div className="text-xs text-muted-foreground mb-1">Avis spé</div>
                    <div className="font-bold text-lg tabular-nums">
                      {formatEuro(results.paliers[3].roiAvisSpec)}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 rounded-xl p-4 border border-violet-500/20">
                    <div className="text-xs text-muted-foreground mb-1">CCMU 2+</div>
                    <div className="font-bold text-lg tabular-nums">
                      {formatEuro(results.paliers[3].roiCcmu2)}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl p-4 border border-purple-500/20">
                    <div className="text-xs text-muted-foreground mb-1">CCMU 3+</div>
                    <div className="font-bold text-lg tabular-nums">
                      {formatEuro(results.paliers[3].roiCcmu3)}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl p-4 border border-green-500/20">
                    <div className="text-xs text-muted-foreground mb-1">Bonus 5%</div>
                    <div className="font-bold text-lg tabular-nums text-green-600">
                      {formatEuro(results.paliers[3].roiMonoUhcdBonus)}
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
