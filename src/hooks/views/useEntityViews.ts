import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export type EntityViewType = 'table' | 'kanban' | 'list' | 'gallery';

export interface EntityViewFilter {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'contains' | 'gte' | 'lte' | 'between';
  value: unknown;
}

export interface EntityViewSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface EntityView {
  id: string;
  user_id: string;
  entity: string;
  name: string;
  view_type: EntityViewType;
  filters: EntityViewFilter[];
  sort: EntityViewSort[];
  columns: string[];
  is_shared: boolean;
  is_default: boolean;
  position: number;
  icon?: string | null;
  color?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntityViewInput {
  name: string;
  view_type?: EntityViewType;
  filters?: EntityViewFilter[];
  sort?: EntityViewSort[];
  columns?: string[];
  is_shared?: boolean;
  is_default?: boolean;
  icon?: string | null;
  color?: string | null;
}

const queryKey = (entity: string) => ['entity_views', entity] as const;

/**
 * Vues sauvegardées génériques sur une entité (inspiration Twenty CRM).
 *
 * Permet à chaque utilisateur de créer, partager et basculer entre des vues
 * personnalisées (filtres + tri + colonnes + type d'affichage) sur n'importe
 * quelle entité de l'application.
 */
export function useEntityViews(entity: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKey(entity),
    enabled: !!user?.id && !!entity,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<EntityView[]> => {
      const { data, error } = await supabase
        .from('entity_views')
        .select('id,user_id,entity,name,view_type,filters,sort,columns,is_shared,is_default,position,icon,color,created_at,updated_at')
        .eq('entity', entity)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EntityView[];
    },
  });

  const views = useMemo(() => data ?? [], [data]);
  const ownViews = useMemo(() => views.filter(v => v.user_id === user?.id), [views, user?.id]);
  const sharedViews = useMemo(() => views.filter(v => v.user_id !== user?.id && v.is_shared), [views, user?.id]);
  const defaultView = useMemo(() => ownViews.find(v => v.is_default) ?? null, [ownViews]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKey(entity) });
  }, [qc, entity]);

  const createView = useMutation({
    mutationFn: async (input: EntityViewInput) => {
      if (!user?.id) throw new Error('Not authenticated');
      const payload = {
        user_id: user.id,
        entity,
        name: input.name,
        view_type: input.view_type ?? 'table',
        filters: JSON.parse(JSON.stringify(input.filters ?? [])),
        sort: JSON.parse(JSON.stringify(input.sort ?? [])),
        columns: JSON.parse(JSON.stringify(input.columns ?? [])),
        is_shared: input.is_shared ?? false,
        is_default: input.is_default ?? false,
        icon: input.icon ?? null,
        color: input.color ?? null,
        position: views.length,
      };
      const { data, error } = await supabase
        .from('entity_views')
        .insert([payload])
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
  });

  const updateView = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EntityViewInput> }) => {
      const payload: Record<string, unknown> = { ...patch };
      if (patch.filters !== undefined) payload.filters = JSON.parse(JSON.stringify(patch.filters));
      if (patch.sort !== undefined) payload.sort = JSON.parse(JSON.stringify(patch.sort));
      if (patch.columns !== undefined) payload.columns = JSON.parse(JSON.stringify(patch.columns));
      const { error } = await supabase.from('entity_views').update(payload as never).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('entity_views').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setDefaultView = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      // Désactive le default actuel puis active le nouveau (la contrainte unique partielle empêche les doublons)
      await supabase.from('entity_views').update({ is_default: false })
        .eq('user_id', user.id).eq('entity', entity).eq('is_default', true);
      const { error } = await supabase.from('entity_views').update({ is_default: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    views,
    ownViews,
    sharedViews,
    defaultView,
    isLoading,
    isError,
    refetch,
    createView: createView.mutateAsync,
    updateView: updateView.mutateAsync,
    deleteView: deleteView.mutateAsync,
    setDefaultView: setDefaultView.mutateAsync,
    isMutating: createView.isPending || updateView.isPending || deleteView.isPending || setDefaultView.isPending,
  };
}
