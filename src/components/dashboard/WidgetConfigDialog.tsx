import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WIDGET_REGISTRY, WidgetId, WidgetSettings } from '@/hooks/dashboard/useDashboardLayout';

/**
 * Internal typed settings for widget configuration dialog
 * This extends the base WidgetSettings with known properties
 */
interface TypedWidgetSettings {
  period?: string;
  showTrend?: boolean;
  alertThreshold?: number;
  autoRefreshMinutes?: number;
  compactMode?: boolean;
  maxItems?: number;
  [key: string]: unknown;
}

interface WidgetConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgetId: WidgetId | null;
  currentSettings: WidgetSettings;
  onSave: (widgetId: WidgetId, settings: WidgetSettings) => void;
}

const PERIOD_OPTIONS = [
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: '90d', label: '90 derniers jours' },
  { value: 'YTD', label: 'Depuis début d\'année' },
  { value: 'all', label: 'Tout' },
];

const REFRESH_OPTIONS = [
  { value: '1', label: '1 minute' },
  { value: '5', label: '5 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 heure' },
];

export function WidgetConfigDialog({ 
  open, 
  onOpenChange, 
  widgetId, 
  currentSettings,
  onSave 
}: WidgetConfigDialogProps) {
  const [settings, setSettings] = useState<TypedWidgetSettings>(currentSettings as TypedWidgetSettings);

  React.useEffect(() => {
    setSettings(currentSettings as TypedWidgetSettings);
  }, [currentSettings, widgetId]);

  if (!widgetId) return null;

  const registryWidget = WIDGET_REGISTRY[widgetId];
  type ConfigOptionValue = { default?: string | number | boolean; min?: number; max?: number } | undefined;
  const configOptions = 'configOptions' in registryWidget 
    ? (registryWidget.configOptions as Record<string, ConfigOptionValue>) 
    : null;
  const isConfigurable = 'configurable' in registryWidget && registryWidget.configurable;

  const handleSave = () => {
    onSave(widgetId, settings);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configuration : {registryWidget?.label}</DialogTitle>
          <DialogDescription>
            Personnalisez l'affichage et le comportement de ce widget
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Période */}
          {configOptions?.period && (
            <div className="space-y-2">
              <Label htmlFor="period">Période d'affichage</Label>
              <Select
                value={settings.period || String(configOptions.period.default)}
                onValueChange={(value: string) => setSettings(prev => ({ ...prev, period: value }))}
              >
                <SelectTrigger id="period">
                  <SelectValue placeholder="Sélectionner une période" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Afficher tendance */}
          {configOptions?.showTrend && (
            <div className="flex items-center justify-between">
              <Label htmlFor="showTrend" className="flex-1">
                Afficher les tendances
                <p className="text-xs text-muted-foreground font-normal">
                  Affiche l'évolution par rapport à la période précédente
                </p>
              </Label>
              <Switch
                id="showTrend"
                checked={settings.showTrend ?? (configOptions.showTrend?.default === true)}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showTrend: checked }))}
              />
            </div>
          )}

          {/* Seuil d'alerte */}
          {configOptions?.alertThreshold && (
            <div className="space-y-2">
              <Label htmlFor="alertThreshold">
                Seuil d'alerte
                <p className="text-xs text-muted-foreground font-normal">
                  Notification si la valeur dépasse ce seuil
                </p>
              </Label>
              <Input
                id="alertThreshold"
                type="number"
                placeholder="Ex: 100000"
                value={typeof settings.alertThreshold === 'number' ? settings.alertThreshold : ''}
                onChange={(e) => setSettings((prev) => ({ 
                  ...prev, 
                  alertThreshold: e.target.value ? Number(e.target.value) : undefined 
                }))}
              />
            </div>
          )}

          {/* Rafraîchissement automatique */}
          {configOptions?.autoRefresh && (
            <div className="space-y-2">
              <Label htmlFor="autoRefresh">Rafraîchissement automatique</Label>
              <Select
                value={settings.autoRefreshMinutes?.toString() || String(configOptions.autoRefresh?.default ?? 5)}
                onValueChange={(value) => setSettings(prev => ({ ...prev, autoRefreshMinutes: Number(value) }))}
              >
                <SelectTrigger id="autoRefresh">
                  <SelectValue placeholder="Sélectionner un intervalle" />
                </SelectTrigger>
                <SelectContent>
                  {REFRESH_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Affichage compact */}
          {configOptions?.compactMode && (
            <div className="flex items-center justify-between">
              <Label htmlFor="compactMode" className="flex-1">
                Mode compact
                <p className="text-xs text-muted-foreground font-normal">
                  Réduire l'espace entre les éléments
                </p>
              </Label>
              <Switch
                id="compactMode"
                checked={settings.compactMode ?? (configOptions.compactMode?.default === true)}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, compactMode: checked }))}
              />
            </div>
          )}

          {/* Limite d'éléments */}
          {configOptions?.maxItems && (
            <div className="space-y-2">
              <Label htmlFor="maxItems">
                Nombre d'éléments à afficher
              </Label>
              <Input
                id="maxItems"
                type="number"
                min="1"
                max="50"
                placeholder={`Max: ${configOptions.maxItems.max || 50}`}
                value={typeof settings.maxItems === 'number' ? settings.maxItems : ''}
                onChange={(e) => setSettings((prev) => ({
                  ...prev, 
                  maxItems: e.target.value ? Number(e.target.value) : undefined 
                }))}
              />
            </div>
          )}

          {/* Message si pas d'options */}
          {!isConfigurable && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Ce widget n'a pas d'options configurables.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!isConfigurable}>
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
