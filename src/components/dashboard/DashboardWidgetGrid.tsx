import React, { Suspense, useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GripVertical,
  Maximize2,
  Minimize2,
  EyeOff,
  Loader2,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useDashboardLayout,
  WidgetConfig,
  WidgetSize,
  WIDGET_REGISTRY,
  WidgetId,
  DASHBOARD_TEMPLATES,
} from '@/hooks/dashboard/useDashboardLayout';
import { DashboardCustomizeButton, DashboardCustomizeActions } from './DashboardCustomizeButton';
import { GridBuilderDialog } from './GridBuilderDialog';
import { WidgetConfigDialog } from './WidgetConfigDialog';

interface SortableWidgetProps {
  widget: WidgetConfig;
  isEditMode: boolean;
  onToggleSize: (size: WidgetSize) => void;
  onOpenConfig?: () => void;
  children: React.ReactNode;
}

function SortableWidget({ widget, isEditMode, onToggleSize, onOpenConfig, children }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const registryWidget = WIDGET_REGISTRY[widget.id as WidgetId];
  const canResize = registryWidget?.allowedSizes.length > 1;
  const isConfigurable = 'configurable' in registryWidget && registryWidget.configurable;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative transition-all duration-200',
        widget.size === 'L' ? 'col-span-2' : 'col-span-1',
        isDragging && 'opacity-50 z-50',
        isEditMode && 'ring-2 ring-primary/20 ring-dashed rounded-lg'
      )}
    >
      {isEditMode && (
        <div className="absolute -top-3 left-2 right-2 flex items-center justify-between z-10">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1.5 bg-background border rounded-md shadow-sm hover:bg-muted"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-1 bg-background border rounded-md shadow-sm p-1">
            {isConfigurable && onOpenConfig && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onOpenConfig}
                aria-label="Configurer ce widget"
                title="Configurer ce widget"
              >
                <Settings className="h-3 w-3" />
              </Button>
            )}
            {canResize && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label={widget.size === 'L' ? 'Réduire le widget' : 'Agrandir le widget'}
                onClick={() => onToggleSize(widget.size === 'L' ? 'S' : 'L')}
              >
                {widget.size === 'L' ? (
                  <Minimize2 className="h-3 w-3" />
                ) : (
                  <Maximize2 className="h-3 w-3" />
                )}
              </Button>
            )}
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {widget.size}
            </Badge>
          </div>
        </div>
      )}
      <div className={cn(isEditMode && 'mt-4')}>
        {children}
      </div>
    </div>
  );
}

// Type pour l'état externe passé depuis le parent
export type ExternalLayoutState = ReturnType<typeof useDashboardLayout>;

interface DashboardWidgetGridProps {
  team?: string;
  renderWidget: (widgetId: WidgetId, size: WidgetSize) => React.ReactNode;
  hideToolbar?: boolean;
  customizeActions?: React.ReactNode;
  /** État externe pour synchroniser avec le header - si fourni, le hook interne n'est pas utilisé */
  externalState?: ExternalLayoutState;
}

// Export actions pour le header
export interface DashboardGridActions {
  isEditMode: boolean;
  isSaving: boolean;
  startEdit: () => void;
  cancelEdit: () => void;
  saveLayout: () => void;
  resetToDefault: () => void;
  openWidgetSelector: () => void;
  applyTemplate: (templateId: string) => void;
}

export function DashboardWidgetGrid({ 
  team = 'direction', 
  renderWidget,
  hideToolbar = false,
  externalState
}: DashboardWidgetGridProps) {
  // Utiliser l'état externe s'il est fourni, sinon créer un état local
  const internalState = useDashboardLayout(team);
  const state = externalState || internalState;

  const {
    visibleWidgets,
    allWidgets,
    isLoading,
    isEditMode,
    isSaving,
    isWidgetSelectorOpen,
    configWidgetId,
    startEdit,
    cancelEdit,
    saveLayout,
    resetToDefault,
    updateWidgetOrder,
    updateWidgetSize,
    toggleWidgetVisibility,
    toggleWidgetVisibilityAndSave,
    updateWidgetSettings,
    updateWidgetOrderAndSave,
    updateWidgetSizeAndSave,
    applyTemplate,
    openWidgetSelector,
    closeWidgetSelector,
    openWidgetConfig,
    closeWidgetConfig,
    getWidgetSettings,
  } = state;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = visibleWidgets.findIndex((w) => w.id === active.id);
      const newIndex = visibleWidgets.findIndex((w) => w.id === over.id);
      const newOrder = arrayMove(visibleWidgets, oldIndex, newIndex);
      updateWidgetOrder(newOrder.map(w => w.id));
    }
  };

  const templates = Object.entries(DASHBOARD_TEMPLATES).map(([id, t]) => ({
    id,
    name: t.name,
    description: t.description
  }));

  const customizeActions: DashboardCustomizeActions = {
    startEdit,
    cancelEdit,
    saveLayout,
    resetToDefault,
    openWidgetSelector,
    applyTemplate
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar - hidden when hideToolbar is true (moved to header) */}
      {!hideToolbar && (
        <div className="flex items-center justify-end gap-2">
          <DashboardCustomizeButton
            isEditMode={isEditMode}
            isSaving={isSaving}
            actions={customizeActions}
            templates={templates}
          />
        </div>
      )}

      {/* Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleWidgets.map(w => w.id)}
          strategy={rectSortingStrategy}
        >
          <WidgetGridContent
            visibleWidgets={visibleWidgets}
            isEditMode={isEditMode}
            renderWidget={renderWidget}
            updateWidgetSize={updateWidgetSize}
            openWidgetConfig={openWidgetConfig}
          />
        </SortableContext>
      </DndContext>

      {visibleWidgets.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <EyeOff className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Aucun widget visible</p>
            <Button variant="link" onClick={startEdit} className="mt-2">
              Configurer le dashboard
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grid Builder Dialog */}
      <GridBuilderDialog
        open={isWidgetSelectorOpen}
        onOpenChange={closeWidgetSelector}
        allWidgets={allWidgets}
        onToggleVisibility={toggleWidgetVisibilityAndSave}
        onApplyTemplate={applyTemplate}
        onUpdateOrder={updateWidgetOrderAndSave}
        onUpdateSize={(widgetId, size) => updateWidgetSizeAndSave(widgetId, size)}
      />

      {/* Widget Config Dialog */}
      <WidgetConfigDialog
        open={!!configWidgetId}
        onOpenChange={(open) => !open && closeWidgetConfig()}
        widgetId={configWidgetId}
        currentSettings={configWidgetId ? getWidgetSettings(configWidgetId) : {}}
        onSave={updateWidgetSettings}
      />
    </div>
  );
}

/** Sub-component that pre-filters widgets returning null to avoid empty grid cells */
function WidgetGridContent({
  visibleWidgets,
  isEditMode,
  renderWidget,
  updateWidgetSize,
  openWidgetConfig,
}: {
  visibleWidgets: WidgetConfig[];
  isEditMode: boolean;
  renderWidget: (widgetId: WidgetId, size: WidgetSize) => React.ReactNode;
  updateWidgetSize: (id: string, size: WidgetSize) => void;
  openWidgetConfig: (id: WidgetId) => void;
}) {
  // Pre-render all widgets and filter out nulls to prevent empty grid cells
  const widgetContents = useMemo(() => {
    const map = new Map<string, React.ReactNode>();
    for (const w of visibleWidgets) {
      const content = renderWidget(w.id as WidgetId, w.size);
      if (content !== null && content !== undefined) {
        map.set(w.id, content);
      }
    }
    return map;
  }, [visibleWidgets, renderWidget]);

  const filteredWidgets = useMemo(
    () => visibleWidgets.filter(w => widgetContents.has(w.id)),
    [visibleWidgets, widgetContents]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
      {filteredWidgets.map((widget) => (
        <SortableWidget
          key={widget.id}
          widget={widget}
          isEditMode={isEditMode}
          onToggleSize={(size) => updateWidgetSize(widget.id, size)}
          onOpenConfig={() => openWidgetConfig(widget.id as WidgetId)}
        >
          <Suspense
            fallback={
              <Card className="h-full">
                <CardContent className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            }
          >
            {widgetContents.get(widget.id)}
          </Suspense>
        </SortableWidget>
      ))}
    </div>
  );
}
