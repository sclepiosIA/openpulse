import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LayoutGrid,
  Zap,
  Target,
  ListChecks,
  Sparkles,
  GripVertical,
  Maximize2,
  Minimize2,
  X,
  Eye,
  EyeOff,
  Plus,
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import {
  WIDGET_REGISTRY,
  WidgetConfig,
  WidgetId,
  WidgetSize,
  DASHBOARD_TEMPLATES,
} from '@/hooks/dashboard/useDashboardLayout';

interface GridBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allWidgets: WidgetConfig[];
  onToggleVisibility: (widgetId: string) => void;
  onApplyTemplate: (templateId: string) => void;
  onUpdateOrder: (widgetIds: string[]) => void;
  onUpdateSize: (widgetId: string, size: WidgetSize) => void;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  compact: <Zap className="h-5 w-5" />,
  strategic: <Target className="h-5 w-5" />,
  operational: <ListChecks className="h-5 w-5" />,
  complete: <LayoutGrid className="h-5 w-5" />,
};

// Composant widget dans la palette (draggable)
function PaletteWidget({ widget, onAdd }: { widget: WidgetConfig; onAdd: () => void }) {
  const registryWidget = WIDGET_REGISTRY[widget.id as WidgetId];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${widget.id}`,
    data: { type: 'palette', widgetId: widget.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing',
        widget.visible 
          ? 'bg-primary/5 border-primary/20' 
          : 'bg-muted/30 border-border hover:border-primary/30',
        isDragging && 'opacity-50'
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {registryWidget?.label || widget.id}
          </span>
          <Badge variant="outline" className="text-[10px] px-1 py-0 flex-shrink-0">
            {registryWidget?.allowedSizes.join('/')}
          </Badge>
        </div>
        {registryWidget?.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {registryWidget.description}
          </p>
        )}
      </div>
      <Button
        variant={widget.visible ? "secondary" : "ghost"}
        size="icon"
        className="h-7 w-7 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }} aria-label="Voir">
        {widget.visible ? <Eye className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

// Composant widget dans la grille (sortable) avec animations iOS
function GridWidget({ 
  widget, 
  onRemove, 
  onToggleSize 
}: { 
  widget: WidgetConfig; 
  onRemove: () => void;
  onToggleSize: () => void;
}) {
  const registryWidget = WIDGET_REGISTRY[widget.id as WidgetId];
  const canResize = registryWidget?.allowedSizes.length > 1;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: widget.id,
    transition: {
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)', // Spring-like animation
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative p-3 rounded-lg border-2 border-dashed group',
        'transition-[border-color,background-color,box-shadow,opacity] duration-200',
        widget.size === 'L' ? 'col-span-2' : 'col-span-1',
        isDragging 
          ? 'border-primary bg-primary/10 shadow-lg scale-[1.02] opacity-90' 
          : 'border-border bg-background hover:border-primary/50'
      )}
    >
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="font-medium text-sm flex-1 truncate">
          {registryWidget?.label || widget.id}
        </span>
        <Badge variant="secondary" className="text-[10px] px-1.5">
          {widget.size}
        </Badge>
        {canResize && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onToggleSize}
            title={widget.size === 'L' ? 'Réduire' : 'Agrandir'} aria-label="Réduire">
            {widget.size === 'L' ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
          onClick={onRemove}
          title="Retirer" aria-label="Fermer">
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// Zone de drop pour la grille avec scroll
function GridDropZone({ 
  widgets, 
  onRemove, 
  onToggleSize,
  isOver 
}: { 
  widgets: WidgetConfig[];
  onRemove: (id: string) => void;
  onToggleSize: (id: string) => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: 'grid-zone' });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
        Aperçu du Dashboard (2 colonnes)
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-y-auto p-4 rounded-xl border-2 border-dashed transition-colors',
          isOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 bg-muted/20'
        )}
      >
        <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3 auto-rows-min">
            {widgets.map((widget) => (
              <GridWidget
                key={widget.id}
                widget={widget}
                onRemove={() => onRemove(widget.id)}
                onToggleSize={() => onToggleSize(widget.id)}
              />
            ))}
            {widgets.length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center py-12 text-muted-foreground">
                <EyeOff className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Glissez des widgets ici</p>
                <p className="text-xs opacity-75">ou cliquez sur + dans la palette</p>
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

// Overlay pendant le drag
function DragOverlayWidget({ widgetId }: { widgetId: string }) {
  const registryWidget = WIDGET_REGISTRY[widgetId as WidgetId];
  
  return (
    <div className="p-3 rounded-lg border-2 border-primary bg-primary/10 backdrop-blur-sm shadow-lg">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">
          {registryWidget?.label || widgetId}
        </span>
      </div>
    </div>
  );
}

export function GridBuilderDialog({ 
  open, 
  onOpenChange, 
  allWidgets, 
  onToggleVisibility,
  onApplyTemplate,
  onUpdateOrder,
  onUpdateSize,
}: GridBuilderDialogProps) {
  const [activeTab, setActiveTab] = useState('grid');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isOverGrid, setIsOverGrid] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const visibleWidgets = useMemo(
    () => allWidgets.filter(w => w.visible).sort((a, b) => a.order - b.order),
    [allWidgets]
  );

  const hiddenWidgets = useMemo(
    () => allWidgets.filter(w => !w.visible).sort((a, b) => a.order - b.order),
    [allWidgets]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id.replace('palette-', ''));
  };

  const handleDragOver = (event: DragOverEvent) => {
    setIsOverGrid(event.over?.id === 'grid-zone');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsOverGrid(false);

    if (!over) return;

    const activeIdStr = active.id as string;

    // Drag from palette to grid
    if (activeIdStr.startsWith('palette-')) {
      const widgetId = activeIdStr.replace('palette-', '');
      if (over.id === 'grid-zone' || visibleWidgets.some(w => w.id === over.id)) {
        onToggleVisibility(widgetId);
      }
      return;
    }

    // Reorder within grid
    if (over && active.id !== over.id) {
      const oldIndex = visibleWidgets.findIndex(w => w.id === active.id);
      const newIndex = visibleWidgets.findIndex(w => w.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(visibleWidgets, oldIndex, newIndex);
        onUpdateOrder(newOrder.map(w => w.id));
      }
    }
  };

  const handleToggleSize = (widgetId: string) => {
    const widget = allWidgets.find(w => w.id === widgetId);
    if (widget) {
      onUpdateSize(widgetId, widget.size === 'L' ? 'S' : 'L');
    }
  };

  const handleApplyTemplate = (templateId: string) => {
    onApplyTemplate(templateId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] !w-[95vw] h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Personnalisation du Dashboard
          </DialogTitle>
          <DialogDescription>
            Glissez-déposez les widgets pour créer votre disposition idéale
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="grid" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Disposition
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="flex-1 overflow-hidden mt-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-5 gap-4 h-full">
                {/* Palette - 2 colonnes */}
                <div className="col-span-2 flex flex-col overflow-hidden">
                  <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
                    Widgets disponibles
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {hiddenWidgets.map((widget) => (
                      <PaletteWidget
                        key={widget.id}
                        widget={widget}
                        onAdd={() => onToggleVisibility(widget.id)}
                      />
                    ))}
                    {hiddenWidgets.length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-8">
                        Tous les widgets sont affichés
                      </div>
                    )}
                  </div>
                </div>

                {/* Grid - 3 colonnes */}
                <div className="col-span-3 flex flex-col overflow-hidden">
                  <GridDropZone
                    widgets={visibleWidgets}
                    onRemove={onToggleVisibility}
                    onToggleSize={handleToggleSize}
                    isOver={isOverGrid}
                  />
                </div>
              </div>

              <DragOverlay>
                {activeId ? <DragOverlayWidget widgetId={activeId} /> : null}
              </DragOverlay>
            </DndContext>
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
