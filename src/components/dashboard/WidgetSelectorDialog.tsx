import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutGrid, Zap, Target, ListChecks, Sparkles } from 'lucide-react';
import {
  WIDGET_REGISTRY,
  WidgetConfig,
  WidgetId,
  DASHBOARD_TEMPLATES,
} from '@/hooks/dashboard/useDashboardLayout';

interface WidgetSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allWidgets: WidgetConfig[];
  onToggleVisibility: (widgetId: string) => void;
  onApplyTemplate: (templateId: string) => void;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  compact: <Zap className="h-5 w-5" />,
  strategic: <Target className="h-5 w-5" />,
  operational: <ListChecks className="h-5 w-5" />,
  complete: <LayoutGrid className="h-5 w-5" />,
};

export function WidgetSelectorDialog({ 
  open, 
  onOpenChange, 
  allWidgets, 
  onToggleVisibility,
  onApplyTemplate
}: WidgetSelectorDialogProps) {
  const [activeTab, setActiveTab] = useState('widgets');

  const handleApplyTemplate = (templateId: string) => {
    onApplyTemplate(templateId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Personnalisation du Dashboard
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les widgets à afficher ou appliquez un template prédéfini
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="widgets">Widgets</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="widgets" className="flex-1 overflow-y-auto mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allWidgets.map((widget) => {
                const registryWidget = WIDGET_REGISTRY[widget.id as WidgetId];
                return (
                  <div 
                    key={widget.id} 
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                      widget.visible 
                        ? 'bg-primary/5 border-primary/20' 
                        : 'bg-muted/30 border-border'
                    }`}
                  >
                    <Checkbox
                      id={widget.id}
                      checked={widget.visible}
                      onCheckedChange={() => onToggleVisibility(widget.id)}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor={widget.id}
                      className="flex-1 cursor-pointer space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{registryWidget?.label || widget.id}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {registryWidget?.allowedSizes.join('/')}
                        </Badge>
                      </div>
                      {registryWidget?.description && (
                        <p className="text-xs text-muted-foreground">
                          {registryWidget.description}
                        </p>
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="flex-1 overflow-y-auto mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(DASHBOARD_TEMPLATES).map(([id, template]) => (
                <Card 
                  key={id} 
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handleApplyTemplate(id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {TEMPLATE_ICONS[id] || <LayoutGrid className="h-5 w-5" />}
                      {template.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1">
                      {template.widgets.slice(0, 4).map(widgetId => (
                        <Badge key={widgetId} variant="secondary" className="text-[10px]">
                          {WIDGET_REGISTRY[widgetId as WidgetId]?.label || widgetId}
                        </Badge>
                      ))}
                      {template.widgets.length > 4 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{template.widgets.length - 4}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
