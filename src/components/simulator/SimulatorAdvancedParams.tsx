import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SliderWithInput } from '@/components/ui/slider-with-input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import type { SimulationParams } from '@/types/simulator';
import { formatPercent } from '@/lib/simulator-config';
import { Settings, Euro, Sliders, TrendingUp } from 'lucide-react';

interface SimulatorAdvancedParamsProps {
  params: SimulationParams;
  onUpdateParam: <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => void;
}

export function SimulatorAdvancedParams({ params, onUpdateParam }: SimulatorAdvancedParamsProps) {
  const handleTarifChange = (key: keyof SimulationParams, value: string) => {
    const num = parseFloat(value.replace(',', '.'));
    if (!isNaN(num) && num >= 0) {
      onUpdateParam(key, num);
    }
  };

  // Calcul des gains pour affichage inline
  const avisGain = params.taux_avis_cible - params.taux_avis_baseline;
  const ccmu2Gain = params.taux_ccmu2_cible - params.taux_ccmu2_baseline;
  const ccmu3Gain = params.taux_ccmu3_cible - params.taux_ccmu3_baseline;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-muted/30 to-transparent border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-muted">
            <Settings className="h-4 w-4 text-muted-foreground" />
          </div>
          Paramètres avancés
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="multiple" className="w-full">
          {/* Leviers de valorisation */}
          <AccordionItem value="leviers" className="border-b-0">
            <AccordionTrigger className="text-sm py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Leviers de valorisation</span>
                {(avisGain > 0 || ccmu2Gain > 0 || ccmu3Gain > 0) && (
                  <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Actif
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pt-2 pb-4">
              {/* Avis spécialisés */}
              <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Avis spécialisés</Label>
                  {avisGain > 0 && (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +{formatPercent(avisGain)}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground">Taux actuel</span>
                    <SliderWithInput
                      value={params.taux_avis_baseline}
                      onChange={(v) => onUpdateParam('taux_avis_baseline', v)}
                      min={0}
                      max={15}
                      step={0.1}
                      unit="%"
                      size="sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs text-primary font-medium">Objectif</span>
                    <SliderWithInput
                      value={params.taux_avis_cible}
                      onChange={(v) => onUpdateParam('taux_avis_cible', v)}
                      min={0}
                      max={15}
                      step={0.1}
                      unit="%"
                      variant="primary"
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              {/* CCMU 2+ */}
              <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">CCMU 2+</Label>
                  {ccmu2Gain > 0 && (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +{formatPercent(ccmu2Gain)}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground">Taux actuel</span>
                    <SliderWithInput
                      value={params.taux_ccmu2_baseline}
                      onChange={(v) => onUpdateParam('taux_ccmu2_baseline', v)}
                      min={0}
                      max={15}
                      step={0.1}
                      unit="%"
                      size="sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs text-primary font-medium">Objectif</span>
                    <SliderWithInput
                      value={params.taux_ccmu2_cible}
                      onChange={(v) => onUpdateParam('taux_ccmu2_cible', v)}
                      min={0}
                      max={15}
                      step={0.1}
                      unit="%"
                      variant="primary"
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              {/* CCMU 3+ */}
              <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">CCMU 3+</Label>
                  {ccmu3Gain > 0 && (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +{formatPercent(ccmu3Gain)}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground">Taux actuel</span>
                    <SliderWithInput
                      value={params.taux_ccmu3_baseline}
                      onChange={(v) => onUpdateParam('taux_ccmu3_baseline', v)}
                      min={0}
                      max={15}
                      step={0.1}
                      unit="%"
                      size="sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs text-primary font-medium">Objectif</span>
                    <SliderWithInput
                      value={params.taux_ccmu3_cible}
                      onChange={(v) => onUpdateParam('taux_ccmu3_cible', v)}
                      min={0}
                      max={15}
                      step={0.1}
                      unit="%"
                      variant="primary"
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Tarifs unitaires */}
          <AccordionItem value="tarifs" className="border-b-0">
            <AccordionTrigger className="text-sm py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Tarifs unitaires</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tarif UHCD</Label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={params.TARIF_UHCD}
                      onChange={(e) => handleTarifChange('TARIF_UHCD', e.target.value)}
                      className="h-10 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tarif Avis spé</Label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={params.TARIF_AVIS_SPE}
                      onChange={(e) => handleTarifChange('TARIF_AVIS_SPE', e.target.value)}
                      className="h-10 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tarif CCMU2</Label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={params.TARIF_CCMU2}
                      onChange={(e) => handleTarifChange('TARIF_CCMU2', e.target.value)}
                      className="h-10 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tarif CCMU3</Label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={params.TARIF_CCMU3}
                      onChange={(e) => handleTarifChange('TARIF_CCMU3', e.target.value)}
                      className="h-10 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2 p-4 rounded-lg bg-muted/30 border">
                <Label className="text-sm">Bonus mono-RUM</Label>
                <SliderWithInput
                  value={params.BONUS_MONORUM * 100}
                  onChange={(v) => onUpdateParam('BONUS_MONORUM', v / 100)}
                  min={0}
                  max={10}
                  step={0.1}
                  unit="%"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
