import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SliderWithInput } from '@/components/ui/slider-with-input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SimulationParams } from '@/types/simulator';
import { formatNumber, formatPercent } from '@/lib/simulator-config';
import { Building2, Users, TrendingUp, Activity, HelpCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
interface SimulatorMainParamsProps {
  params: SimulationParams;
  onUpdateParam: <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => void;
}

export function SimulatorMainParams({ params, onUpdateParam }: SimulatorMainParamsProps) {
  // Calculs pour affichage
  const uhcdBaselineAbs = Math.round(params.passages * (params.baseline / 100));
  const uhcdCibleAbs = Math.round(params.passages * (params.cible / 100));
  const uhcdDiff = uhcdCibleAbs - uhcdBaselineAbs;
  const monoAbs = Math.round(uhcdBaselineAbs * (params.taux_mono / 100));

  const handlePassagesChange = (value: string) => {
    const num = parseInt(value.replace(/\s/g, ''), 10);
    if (!isNaN(num) && num >= 0) {
      onUpdateParam('passages', num);
    }
  };

  // Handlers pour saisie absolue UHCD → recalcul du taux
  const handleUhcdBaselineAbsoluteChange = (absoluteValue: number) => {
    if (params.passages > 0) {
      const newTaux = (absoluteValue / params.passages) * 100;
      onUpdateParam('baseline', Math.min(20, Math.max(0, newTaux)));
    }
  };

  const handleUhcdCibleAbsoluteChange = (absoluteValue: number) => {
    if (params.passages > 0) {
      const newTaux = (absoluteValue / params.passages) * 100;
      onUpdateParam('cible', Math.min(25, Math.max(0, newTaux)));
    }
  };

  const handleMonoRumAbsoluteChange = (absoluteValue: number) => {
    if (uhcdBaselineAbs > 0) {
      const newTaux = (absoluteValue / uhcdBaselineAbs) * 100;
      onUpdateParam('taux_mono', Math.min(100, Math.max(0, newTaux)));
    }
  };

  // Parser pour extraire le nombre d'UHCD depuis "4 040 UHCD"
  const parseUhcdValue = (str: string) => parseInt(str.replace(/[^\d]/g, ''), 10);
  
  // Parser pour mono-RUM "2 828 mono-RUM sur 4 040 UHCD" → 2828
  const parseMonoValue = (str: string) => parseInt(str.split(' ')[0].replace(/[^\d]/g, ''), 10);

  // Calcul du pourcentage de progression pour les barres visuelles
  const baselineProgress = (params.baseline / 20) * 100;
  const cibleProgress = (params.cible / 25) * 100;
  const monoProgress = params.taux_mono;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          Paramètres de simulation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Passages annuels */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-muted-foreground" />
              Passages annuels aux urgences
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p>Nombre total de patients passés aux urgences sur une année (source: SAE ou DIM)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="relative">
            <Input
              type="text"
              value={formatNumber(params.passages)}
              onChange={(e) => handlePassagesChange(e.target.value)}
              className="text-xl font-bold h-14 pl-4 pr-20 bg-muted/30 border-2 focus:border-primary transition-colors"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              passages/an
            </span>
          </div>
        </div>

        {/* Taux UHCD Comparaison visuelle */}
        <div className="space-y-4 p-4 rounded-xl bg-muted/30 border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Évolution du taux UHCD</span>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{formatPercent(params.baseline)}</span>
              <ArrowRight className="h-4 w-4 text-primary" />
              <span className="font-semibold text-primary">{formatPercent(params.cible)}</span>
            </div>
          </div>

          {/* Barre de progression comparative */}
          <div className="relative h-8 rounded-lg bg-muted overflow-hidden">
            {/* Barre baseline */}
            <div 
              className="absolute inset-y-0 left-0 bg-muted-foreground/20 transition-all duration-300"
              style={{ width: `${baselineProgress}%` }}
            />
            {/* Barre cible */}
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/80 to-primary transition-all duration-300"
              style={{ width: `${cibleProgress}%` }}
            />
            {/* Indicateur différence */}
            {uhcdDiff > 0 && (
              <div className="absolute inset-y-0 right-2 flex items-center">
                <span className="text-xs font-bold text-primary-foreground bg-primary px-2 py-0.5 rounded">
                  +{formatNumber(uhcdDiff)} UHCD
                </span>
              </div>
            )}
          </div>

          {/* Sliders avec saisie fine */}
          <div className="grid grid-cols-2 gap-6">
            {/* Taux actuel */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground">Taux actuel</Label>
              </div>
              <SliderWithInput
                value={params.baseline}
                onChange={(v) => onUpdateParam('baseline', v)}
                min={0}
                max={20}
                step={0.1}
                unit="%"
                secondaryValue={`${formatNumber(uhcdBaselineAbs)} UHCD`}
                onSecondaryValueChange={handleUhcdBaselineAbsoluteChange}
                secondaryValueParser={parseUhcdValue}
              />
            </div>

            {/* Taux cible */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <Label className="text-xs text-primary font-medium">Objectif cible</Label>
              </div>
              <SliderWithInput
                value={params.cible}
                onChange={(v) => onUpdateParam('cible', v)}
                min={0}
                max={25}
                step={0.1}
                unit="%"
                variant="primary"
                secondaryValue={`${formatNumber(uhcdCibleAbs)} UHCD`}
                onSecondaryValueChange={handleUhcdCibleAbsoluteChange}
                secondaryValueParser={parseUhcdValue}
              />
            </div>
          </div>
        </div>

        {/* Taux Mono-RUM */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Proportion UHCD mono-RUM</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p>Pourcentage d'UHCD avec un seul RUM (Résumé d'Unité Médicale) - généralement entre 60% et 80%</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="space-y-2">
            {/* Barre de progression visuelle */}
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  params.taux_mono >= 70 ? "bg-green-500" : "bg-primary"
                )}
                style={{ width: `${monoProgress}%` }}
              />
            </div>
            <SliderWithInput
              value={params.taux_mono}
              onChange={(v) => onUpdateParam('taux_mono', v)}
              min={0}
              max={100}
              step={1}
              unit="%"
              secondaryValue={`${formatNumber(monoAbs)} mono-RUM sur ${formatNumber(uhcdBaselineAbs)} UHCD`}
              onSecondaryValueChange={handleMonoRumAbsoluteChange}
              secondaryValueParser={parseMonoValue}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
