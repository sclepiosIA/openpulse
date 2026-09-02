import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { SimulationResults } from '@/types/simulator';
import { formatEuro, formatNumber } from '@/lib/simulator-config';
import { TrendingUp, ArrowUp, Calculator, Target, Zap, PiggyBank, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimulationResultsPanelProps {
  results: SimulationResults;
}

export function SimulationResultsPanel({ results }: SimulationResultsPanelProps) {
  const gainPercentage = results.totalGainBaseline > 0 
    ? ((results.totalGainDiff / results.totalGainBaseline) * 100).toFixed(0)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPIs principaux avec design premium */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
          <CardContent className="relative pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Target className="h-3.5 w-3.5" />
              UHCD Actuels
            </div>
            <div className="text-2xl font-bold tabular-nums">{formatNumber(results.uhcdBaseline)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              dossiers/an
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-primary/20">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
          <CardContent className="relative pt-4">
            <div className="flex items-center gap-2 text-xs text-primary mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              UHCD Cible
            </div>
            <div className="text-2xl font-bold text-primary tabular-nums">{formatNumber(results.uhcdTarget)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              objectif
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-green-500/20">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent" />
          <CardContent className="relative pt-4">
            <div className="flex items-center gap-2 text-xs text-green-600 mb-1">
              <Zap className="h-3.5 w-3.5" />
              UHCD Supplémentaires
            </div>
            <div className="text-2xl font-bold text-green-600 tabular-nums flex items-center gap-1">
              <ChevronUp className="h-5 w-5" />
              {formatNumber(results.uhcdDiff)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              gain potentiel
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-2xl" />
          <CardContent className="relative pt-4">
            <div className="flex items-center gap-2 text-xs text-primary mb-1">
              <PiggyBank className="h-3.5 w-3.5" />
              Gain Total Estimé
            </div>
            <div className="text-2xl font-bold text-primary tabular-nums">{formatEuro(results.totalGainDiff)}</div>
            {Number(gainPercentage) > 0 && (
              <Badge variant="secondary" className="mt-1 bg-primary/10 text-primary text-xs">
                +{gainPercentage}%
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tableau des leviers avec design amélioré */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-muted/30 to-transparent border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            Détail par levier de valorisation
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Levier</TableHead>
                  <TableHead className="text-right font-semibold">Vol. actuel</TableHead>
                  <TableHead className="text-right font-semibold">Gain actuel</TableHead>
                  <TableHead className="text-right font-semibold text-primary">Vol. cible</TableHead>
                  <TableHead className="text-right font-semibold text-primary">Gain cible</TableHead>
                  <TableHead className="text-right font-semibold">Différentiel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.leviers.map((levier, index) => (
                  <TableRow 
                    key={levier.levier}
                    className={cn(
                      "transition-colors",
                      index % 2 === 0 ? "bg-background" : "bg-muted/10"
                    )}
                  >
                    <TableCell className="font-medium">{levier.levier}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatNumber(levier.volumeBaseline)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatEuro(levier.gainBaseline)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatNumber(levier.volumeTarget)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatEuro(levier.gainTarget)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={levier.gainDiff > 0 ? 'default' : 'secondary'} 
                        className={cn(
                          "font-mono tabular-nums",
                          levier.gainDiff > 0 && "bg-green-500 hover:bg-green-600"
                        )}
                      >
                        {levier.gainDiff > 0 && <ArrowUp className="h-3 w-3 mr-1" />}
                        {formatEuro(levier.gainDiff)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Ligne de total */}
                <TableRow className="bg-primary/5 font-bold border-t-2 border-primary/20">
                  <TableCell className="text-primary">TOTAL</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(results.totalGainBaseline)}</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right tabular-nums text-primary">{formatEuro(results.totalGainTarget)}</TableCell>
                  <TableCell className="text-right">
                    <Badge className="font-mono tabular-nums bg-primary hover:bg-primary/90 text-lg px-3">
                      <ArrowUp className="h-4 w-4 mr-1" />
                      {formatEuro(results.totalGainDiff)}
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Gain moyen par dossier avec design premium */}
      <Card className="bg-gradient-to-r from-muted/30 via-background to-muted/30 border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Gain moyen par dossier UHCD supplémentaire</span>
                <p className="text-xs text-muted-foreground/60">Valorisation unitaire moyenne</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary tabular-nums">{formatEuro(results.gainParDossier)}</div>
              <span className="text-xs text-muted-foreground">/dossier</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
