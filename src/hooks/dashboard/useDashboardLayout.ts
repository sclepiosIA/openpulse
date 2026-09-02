import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/shared/useAuth';
import { fromExtended } from '@/lib/supabaseTyped';
import { toast } from 'sonner';
import { debug } from '@/lib/debug';
import {
  type WidgetId,
  type WidgetSettings,
  type WidgetSize,
  type WidgetConfig,
  type DashboardLayout,
  type WidgetDefinition,
  type DashboardTemplate,
  WIDGET_REGISTRY,
  DASHBOARD_TEMPLATES,
  DEFAULT_LAYOUT,
  LAYOUT_TEMPLATES,
  getWidgetDefinition,
  getWidgetsByCategory,
  mergeRegistryWithLayout,
} from './useDashboardLayout.registry';

// Re-exports pour compat
export type {
  WidgetId,
  WidgetSettings,
  WidgetSize,
  WidgetConfig,
  DashboardLayout,
  WidgetDefinition,
  DashboardTemplate,
};
export {
  WIDGET_REGISTRY,
  DASHBOARD_TEMPLATES,
  DEFAULT_LAYOUT,
  LAYOUT_TEMPLATES,
  getWidgetDefinition,
  getWidgetsByCategory,
};

// ============= Hook =============

export function useDashboardLayout(team: string = 'direction') {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [localLayout, setLocalLayout] = useState<DashboardLayout | null>(null);
  const [isWidgetSelectorOpen, setIsWidgetSelectorOpen] = useState(false);
  const [configWidgetId, setConfigWidgetId] = useState<WidgetId | null>(null);

  // Récupérer le layout depuis la base de données
  const { data: savedLayout, isLoading } = useQuery({
    queryKey: ['dashboard-layout', user?.id, team],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await fromExtended('dashboard_layouts')
        .select('layout')
        .eq('user_id', user.id)
        .eq('team', team)
        .maybeSingle();

      if (error) {
        debug.error('Error fetching dashboard layout:', error);
        return null;
      }

      return data?.layout as DashboardLayout | null;
    },
    enabled: !!user?.id,
  });

  // Layout effectif (local en mode édition, sinon DB fusionné avec registre, sinon default)
  const effectiveLayout = isEditMode && localLayout 
    ? mergeRegistryWithLayout(localLayout)
    : mergeRegistryWithLayout(savedLayout ?? null);

  // Synchroniser le layout local avec le layout sauvegardé (fusionné)
  useEffect(() => {
    if (savedLayout && !localLayout) {
      setLocalLayout(mergeRegistryWithLayout(savedLayout));
    }
  }, [savedLayout, localLayout]);

  // Initialiser le layout local avec les defaults si pas de données
  useEffect(() => {
    if (!isLoading && !savedLayout && !localLayout) {
      setLocalLayout(DEFAULT_LAYOUT);
    }
  }, [isLoading, savedLayout, localLayout]);

  // Mutation pour sauvegarder le layout
  const saveLayoutMutation = useMutation({
    mutationFn: async (layout: DashboardLayout) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await fromExtended('dashboard_layouts')
        .upsert({
          user_id: user.id,
          team,
          layout,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,team',
        });

      if (error) throw error;
      return layout;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-layout', user?.id, team] });
      // Only show generic save toast and exit edit mode when saving from edit mode button
      if (isEditMode) {
        toast.success('Dashboard personnalisé sauvegardé');
        setIsEditMode(false);
      }
    },
    onError: (error) => {
      debug.error('Error saving layout:', error);
      toast.error('Erreur lors de la sauvegarde');
    },
  });

  // ============= Actions =============

  const startEdit = useCallback(() => {
    setLocalLayout(mergeRegistryWithLayout(savedLayout ?? null));
    setIsEditMode(true);
  }, [savedLayout]);

  const cancelEdit = useCallback(() => {
    setLocalLayout(mergeRegistryWithLayout(savedLayout ?? null));
    setIsEditMode(false);
  }, [savedLayout]);

  const saveLayout = useCallback(() => {
    if (localLayout) {
      saveLayoutMutation.mutate(localLayout);
    }
  }, [localLayout, saveLayoutMutation]);

  const openWidgetSelector = useCallback(() => {
    setIsWidgetSelectorOpen(true);
  }, []);

  const closeWidgetSelector = useCallback(() => {
    setIsWidgetSelectorOpen(false);
  }, []);

  const openWidgetConfig = useCallback((widgetId: WidgetId) => {
    setConfigWidgetId(widgetId);
  }, []);

  const closeWidgetConfig = useCallback(() => {
    setConfigWidgetId(null);
  }, []);

  const updateWidgetOrder = useCallback((widgetIds: string[]) => {
    setLocalLayout(prev => {
      if (!prev) return prev;
      const newWidgets = [...prev.widgets];
      widgetIds.forEach((id, index) => {
        const widget = newWidgets.find(w => w.id === id);
        if (widget) widget.order = index;
      });
      return { ...prev, widgets: newWidgets.sort((a, b) => a.order - b.order) };
    });
  }, []);

  const updateWidgetOrderAndSave = useCallback((widgetIds: string[]) => {
    const currentLayout = localLayout || effectiveLayout;
    const newWidgets = [...currentLayout.widgets];
    widgetIds.forEach((id, index) => {
      const widget = newWidgets.find(w => w.id === id);
      if (widget) widget.order = index;
    });
    const newLayout = { ...currentLayout, widgets: newWidgets.sort((a, b) => a.order - b.order) };
    setLocalLayout(newLayout);
    saveLayoutMutation.mutate(newLayout);
  }, [localLayout, effectiveLayout, saveLayoutMutation]);

  const toggleWidgetVisibility = useCallback((widgetId: string) => {
    setLocalLayout(prev => {
      if (!prev) return prev;
      const newWidgets = prev.widgets.map(w => 
        w.id === widgetId ? { ...w, visible: !w.visible } : w
      );
      return { ...prev, widgets: newWidgets };
    });
  }, []);

  const toggleWidgetVisibilityAndSave = useCallback((widgetId: string) => {
    const currentLayout = localLayout || effectiveLayout;
    const newWidgets = currentLayout.widgets.map(w => 
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    );
    const newLayout = { ...currentLayout, widgets: newWidgets };
    setLocalLayout(newLayout);
    saveLayoutMutation.mutate(newLayout);
  }, [localLayout, effectiveLayout, saveLayoutMutation]);

  const updateWidgetSize = useCallback((widgetId: string, size: WidgetSize) => {
    setLocalLayout(prev => {
      if (!prev) return prev;
      const newWidgets = prev.widgets.map(w => 
        w.id === widgetId ? { ...w, size } : w
      );
      return { ...prev, widgets: newWidgets };
    });
  }, []);

  const updateWidgetSizeAndSave = useCallback((widgetId: string, size: WidgetSize) => {
    const currentLayout = localLayout || effectiveLayout;
    const newWidgets = currentLayout.widgets.map(w => 
      w.id === widgetId ? { ...w, size } : w
    );
    const newLayout = { ...currentLayout, widgets: newWidgets };
    setLocalLayout(newLayout);
    saveLayoutMutation.mutate(newLayout);
  }, [localLayout, effectiveLayout, saveLayoutMutation]);

  const updateWidgetSettings = useCallback((widgetId: WidgetId, settings: Record<string, unknown>) => {
    const currentLayout = localLayout || effectiveLayout;
    const newWidgets = currentLayout.widgets.map(w => 
      w.id === widgetId ? { ...w, settings: { ...w.settings, ...settings } } : w
    );
    const newLayout = { ...currentLayout, widgets: newWidgets };
    setLocalLayout(newLayout);
    saveLayoutMutation.mutate(newLayout);
  }, [localLayout, effectiveLayout, saveLayoutMutation]);

  const getWidgetSettings = useCallback((widgetId: WidgetId): Record<string, unknown> => {
    const widget = effectiveLayout.widgets.find(w => w.id === widgetId);
    return widget?.settings || {};
  }, [effectiveLayout]);

  const updateColumns = useCallback((columns: 1 | 2 | 3 | 4) => {
    setLocalLayout(prev => prev ? { ...prev, columns } : prev);
  }, []);

  const applyTemplate = useCallback((templateId: string) => {
    const template = DASHBOARD_TEMPLATES[templateId];
    if (template) {
      // Create widget configs from template
      const widgets: WidgetConfig[] = template.widgets.map((id, index) => ({
        id,
        visible: true,
        order: index,
        size: WIDGET_REGISTRY[id]?.defaultSize || 'S',
      }));
      
      // Add remaining widgets as invisible
      const templateIds = new Set(template.widgets);
      const registryIds = Object.keys(WIDGET_REGISTRY) as WidgetId[];
      const hiddenWidgets: WidgetConfig[] = registryIds
        .filter(id => !templateIds.has(id))
        .map((id, index) => ({
          id,
          visible: false,
          order: widgets.length + index,
          size: WIDGET_REGISTRY[id]?.defaultSize || 'S',
        }));
      
      const newLayout: DashboardLayout = {
        widgets: [...widgets, ...hiddenWidgets],
        columns: 2,
        theme: 'comfortable',
      };
      
      setLocalLayout(newLayout);
      saveLayoutMutation.mutate(newLayout);
      toast.success(`Template "${template.name}" appliqué`);
    }
  }, [saveLayoutMutation]);

  const resetToDefault = useCallback(() => {
    setLocalLayout(DEFAULT_LAYOUT);
    saveLayoutMutation.mutate(DEFAULT_LAYOUT);
    toast.success('Dashboard réinitialisé');
  }, [saveLayoutMutation]);

  // ============= Computed Values =============

  // Widgets visibles (enabled/visible = true) triés
  const visibleWidgets = useMemo(() => {
    return effectiveLayout.widgets
      .filter(w => w.visible)
      .sort((a, b) => a.order - b.order);
  }, [effectiveLayout]);

  // Alias for backward compatibility
  const activeWidgets = visibleWidgets;

  // Tous les widgets (pour le sélecteur)
  const allWidgets = useMemo(() => {
    return effectiveLayout.widgets.sort((a, b) => a.order - b.order);
  }, [effectiveLayout]);

  // Widgets non visibles
  const availableWidgets = useMemo(() => {
    return effectiveLayout.widgets.filter(w => !w.visible);
  }, [effectiveLayout]);

  return {
    // State
    layout: effectiveLayout,
    visibleWidgets,
    activeWidgets,
    allWidgets,
    availableWidgets,
    isLoading,
    isEditMode,
    isSaving: saveLayoutMutation.isPending,
    isWidgetSelectorOpen,
    configWidgetId,

    // Edit mode actions
    startEdit,
    cancelEdit,
    saveLayout,

    // Widget selector actions
    openWidgetSelector,
    closeWidgetSelector,

    // Widget config actions  
    openWidgetConfig,
    closeWidgetConfig,
    getWidgetSettings,

    // Widget manipulation actions
    updateWidgetOrder,
    updateWidgetOrderAndSave,
    toggleWidgetVisibility,
    toggleWidgetVisibilityAndSave,
    updateWidgetSize,
    updateWidgetSizeAndSave,
    updateWidgetSettings,
    updateColumns,

    // Template/reset actions
    applyTemplate,
    resetToDefault,

    // Setters (for advanced use)
    setIsEditMode,
    setIsWidgetSelectorOpen,
    setConfigWidgetId,

    // Helpers
    getWidgetDefinition,
    getWidgetsByCategory,
  };
}
