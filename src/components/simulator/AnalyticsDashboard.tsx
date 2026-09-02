import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { SimulationParams, AnalyticsParams, AnalyticsResults } from '@/types/simulator';
import { formatEuro, formatNumber, formatPercent } from '@/lib/simulator-config';
import { BarChart3, TrendingUp, ArrowUp, Calculator, Sparkles, Target, Zap, PiggyBank } from 'lucide-react';

interface AnalyticsDashboardProps {
  params: SimulationParams;
  analyticsParams: AnalyticsParams;
  results: AnalyticsResults;
  onUpdateAnalyticsParam: <K extends keyof AnalyticsParams>(key: K, value: AnalyticsParams[K]) => void;
}

export function AnalyticsDashboard({
  params,
  analyticsParams,
  results,
  onUpdateAnalyticsParam,
}: AnalyticsDashboardProps) {
  const handleNumberChange = (key: keyof AnalyticsParams, value: string) => {
    const num = parseInt(value.replace(/\s/g, ''), 10);
    if (!isNaN(num) && num >= 0) {
      onUpdateAnalyticsParam(key, num);
    }
  };

  // Calcul du gain total
  const gainTotal = results.revTotalPlus - results.revTotalBase;
  const maxRevenue = Math.max(results.revTotalBase, results.revTotalPlus);

  return (
    <div className="space-y-6">
      {/* Paramètres mensuels avec design premium */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Calculator className="h-4 w-4 text-primary" />
            </div>
            Données mensuelles observées
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" />
                UHCD mensuels actuels
              </Label>
              <Input
                type="text"
                value={formatNumber(analyticsParams.uhcdMois)}
                onChange={(e) => handleNumberChange('uhcdMois', e.target.value)}
                className="font-semibold h-12 text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Consultations mensuelles
              </Label>
              <Input
                type="text"
                value={formatNumber(analyticsParams.consultMois)}
                onChange={(e) => handleNumberChange('consultMois', e.target.value)}
                className="font-semibold h-12 text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-primary font-medium flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                UHCD+ avec OpenPulse/mois
              </Label>
              <Input
                type="text"
                value={formatNumber(analyticsParams.plusMois)}
                onChange={(e) => handleNumberChange('plusMois', e.target.value)}
                className="border-primary/50 bg-primary/5 font-bold h-12 text-lg text-primary"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Passages à projeter
              </Label>
              <Input
                type="text"
                value={formatNumber(analyticsParams.totalProj)}
                onChange={(e) => handleNumberChange('totalProj', e.target.value)}
                className="font-semibold h-12 text-lg"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparaison visuelle des taux UHCD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
          <CardContent className="relative pt-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Target className="h-3.5 w-3.5" />
              Taux UHCD actuel
            </div>
            <div className="text-4xl font-bold tabular-nums mb-2">{formatPercent(results.pctUhcd)}</div>
            <div className="text-sm text-muted-foreground mb-4">
              {formatNumber(results.uhcdAn)} UHCD/an
            </div>
            <Progress value={results.pctUhcd * 5} className="h-2" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-primary/30">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
          <CardContent className="relative pt-6">
            <div className="flex items-center gap-2 text-xs text-primary mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              Taux UHCD avec OpenPulse
            </div>
            <div className="text-4xl font-bold text-primary tabular-nums mb-2">{formatPercent(results.pctUhcdPlus)}</div>
            <div className="text-sm text-muted-foreground mb-4">
              {formatNumber(results.uhcdPlusTotal)} UHCD/an
            </div>
            <Progress value={results.pctUhcdPlus * 5} className="h-2 [&>div]:bg-primary" />
          </CardContent>
        </Card>
      </div>

      {/* Comparaison des revenus avec barres visuelles */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-muted/30 to-transparent border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            Comparaison des revenus annuels
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Situation actuelle */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                Situation actuelle
              </h4>
              <div className="space-y-3">
                {[
                  { label: 'Revenus UHCD', value: results.revUhcdBase },
                  { label: 'Avis spécialisés', value: results.revAvisBase },
                  { label: 'CCMU 2+', value: results.revCcmu2Base },
                  { label: 'CCMU 3+', value: results.revCcmu3Base },
                ].map((item) => (
                  <div key={`base-${item.label}`} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="tabular-nums">{formatEuro(item.value)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-muted-foreground/30 transition-all"
                        style={{ width: `${(item.value / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-3 border-t mt-4">
                  <span>Total</span>
                  <span className="tabular-nums">{formatEuro(results.revTotalBase)}</span>
                </div>
              </div>
            </div>

            {/* Avec OpenPulse */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-primary flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                Avec OpenPulse
              </h4>
              <div className="space-y-3">
                {[
                  { label: 'Revenus UHCD', value: results.revUhcdPlus },
                  { label: 'Avis spécialisés', value: results.revAvisPlus },
                  { label: 'CCMU 2+', value: results.revCcmu2Plus },
                  { label: 'CCMU 3+', value: results.revCcmu3Plus },
                ].map((item) => (
                  <div key={`plus-${item.label}`} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="tabular-nums font-medium">{formatEuro(item.value)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(item.value / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-green-600 dark:text-green-400 text-sm">
                  <span>Bonus 5% mono-RUM</span>
                  <span className="tabular-nums">+{formatEuro(results.gainMonoRUM)}</span>
                </div>
                <div className="flex justify-between font-bold text-primary pt-3 border-t mt-4">
                  <span>Total</span>
                  <span className="tabular-nums">{formatEuro(results.revTotalPlus)}</span>
                </div>
              </div>
            </div>

            {/* Gains et ROI */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Gains additionnels
              </h4>
              <div className="space-y-4">
                {/* Jauge ROI UHCD */}
                <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl p-5 border border-green-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-muted-foreground">ROI UHCD</div>
                    <Badge variant="outline" className="text-green-600 border-green-500/30">
                      +{formatPercent(results.roiAnUhcdPct, 0)}
                    </Badge>
                  </div>
                  <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(results.roiAnUhcdPct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Jauge ROI Total */}
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-5 border border-primary/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-muted-foreground">ROI Total</div>
                    <Badge className="bg-primary">
                      +{formatPercent(results.roiAnTotalPct, 0)}
                    </Badge>
                  </div>
                  <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(results.roiAnTotalPct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Gain annuel */}
                <div className="bg-gradient-to-br from-primary/15 to-primary/5 rounded-xl p-5 border-2 border-primary/30">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <PiggyBank className="h-4 w-4" />
                    Gain annuel net
                  </div>
                  <div className="text-3xl font-bold text-primary tabular-nums flex items-center gap-2">
                    <ArrowUp className="h-6 w-6" />
                    {formatEuro(gainTotal)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projections scalées */}
      {results.scale !== 1 && (
        <Card className="bg-gradient-to-r from-muted/30 via-background to-muted/30 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Projections pour {formatNumber(analyticsParams.totalProj)} passages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <Badge variant="outline" className="text-sm px-3 py-1">
                Échelle : ×{results.scale.toFixed(2)}
              </Badge>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">UHCD projetés :</span>
                <span className="font-bold tabular-nums">{formatNumber(results.uhcdProj)}</span>
                <ArrowUp className="h-4 w-4 text-primary" />
                <span className="font-bold text-primary tabular-nums">{formatNumber(results.uhcdPlusProj)}</span>
                <Badge className="bg-green-500 ml-2">
                  +{formatNumber(results.uhcdPlusProj - results.uhcdProj)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
