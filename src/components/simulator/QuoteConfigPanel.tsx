import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import type { QuoteConfiguration, ValorisationLevel } from '@/types/simulator';
import { CENTER_TYPES, DPI_TYPES, RESELLER_TYPES, formatEuro } from '@/lib/simulator-config';
import { Building, FileText, Users, Layers, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuoteConfigPanelProps {
  configuration: QuoteConfiguration | null;
  onUpdateConfiguration: (updates: Partial<QuoteConfiguration>) => void;
}

export function QuoteConfigPanel({ configuration, onUpdateConfiguration }: QuoteConfigPanelProps) {
  const [hasReseller, setHasReseller] = useState(configuration?.resellerType !== null);

  const handleCenterTypeChange = (id: string) => {
    const centerType = CENTER_TYPES.find(ct => ct.id === id);
    if (centerType) {
      onUpdateConfiguration({ centerType });
    }
  };

  const handleDPITypeChange = (id: string) => {
    const dpiType = DPI_TYPES.find(dt => dt.id === id);
    if (dpiType) {
      onUpdateConfiguration({ dpiType });
    }
  };

  const handleResellerToggle = (enabled: boolean) => {
    setHasReseller(enabled);
    if (!enabled) {
      onUpdateConfiguration({ resellerType: null });
    } else {
      onUpdateConfiguration({ resellerType: RESELLER_TYPES[0] });
    }
  };

  const handleResellerChange = (id: string) => {
    const resellerType = RESELLER_TYPES.find(rt => rt.id === id);
    if (resellerType) {
      onUpdateConfiguration({ resellerType });
    }
  };

  const handleValorisationLevelChange = (level: ValorisationLevel) => {
    onUpdateConfiguration({ valorisationLevel: level });
  };

  if (!configuration) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          Configuration du devis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Niveau de valorisation - Cards cliquables */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Niveau de valorisation
          </Label>
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => handleValorisationLevelChange('premier')}
              className={cn(
                "relative flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
                configuration.valorisationLevel === 'premier'
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
              )}
            >
              <div className={cn(
                "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center",
                configuration.valorisationLevel === 'premier'
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/30"
              )}>
                {configuration.valorisationLevel === 'premier' && (
                  <Check className="h-3 w-3 text-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">Premier niveau</div>
                <div className="text-xs text-muted-foreground mt-0.5">UHCD uniquement</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleValorisationLevelChange('second')}
              className={cn(
                "relative flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
                configuration.valorisationLevel === 'second'
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
              )}
            >
              <div className={cn(
                "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center",
                configuration.valorisationLevel === 'second'
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/30"
              )}>
                {configuration.valorisationLevel === 'second' && (
                  <Check className="h-3 w-3 text-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm flex items-center gap-2">
                  Second niveau
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Recommandé
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">UHCD + Avis spé + CCMU</div>
              </div>
            </button>
          </div>
        </div>

        {/* Type de centre - Cards cliquables */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Building className="h-4 w-4 text-muted-foreground" />
            Type d'établissement
          </Label>
          <div className="space-y-2">
            {CENTER_TYPES.map((ct) => (
              <button
                key={ct.id}
                type="button"
                onClick={() => handleCenterTypeChange(ct.id)}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all",
                  configuration.centerType.id === ct.id
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                    configuration.centerType.id === ct.id
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30"
                  )}>
                    {configuration.centerType.id === ct.id && (
                      <Check className="h-2.5 w-2.5 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-medium">{ct.name}</span>
                </div>
                <Badge variant="outline" className="tabular-nums text-xs">
                  {ct.prixPAU}€/PAU
                </Badge>
              </button>
            ))}
          </div>
        </div>

        {/* Type de DPI - Cards cliquables */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Type de DPI
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {DPI_TYPES.map((dt) => (
              <button
                key={dt.id}
                type="button"
                onClick={() => handleDPITypeChange(dt.id)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 text-center transition-all",
                  configuration.dpiType.id === dt.id
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                  configuration.dpiType.id === dt.id
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30"
                )}>
                  {configuration.dpiType.id === dt.id && (
                    <Check className="h-2.5 w-2.5 text-white" />
                  )}
                </div>
                <span className="text-sm font-medium">{dt.name}</span>
                <Badge variant="secondary" className="tabular-nums text-xs">
                  {formatEuro(dt.baseFrais)}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        {/* Revendeur */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-muted-foreground" />
              Revendeur partenaire
            </Label>
            <Switch
              checked={hasReseller}
              onCheckedChange={handleResellerToggle}
            />
          </div>
          
          {hasReseller && (
            <div className="grid grid-cols-2 gap-2">
              {RESELLER_TYPES.map((rt) => (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => handleResellerChange(rt.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 text-center transition-all",
                    configuration.resellerType?.id === rt.id
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <span className="text-sm font-medium">{rt.name}</span>
                  <Badge variant="outline" className="text-xs">
                    +{rt.markup * 100}%
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
