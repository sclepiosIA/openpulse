import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'
import type { CustomDashboard, GridLayoutItem, WidgetConfig } from '@/types/report'
import { toast } from 'sonner'

const KEY = ['custom_dashboards'] as const

type DashboardRow = Record<string, unknown> & {
  layout?: unknown
  widgets?: unknown
  filters_schema?: unknown
  shared_with?: unknown
}

type DashboardInsert = {
  nom: string
  description: string | null
  owner_id: string
  widgets: WidgetConfig[]
  layout: GridLayoutItem[]
  is_template: boolean
  filters_schema?: unknown
}

function normalize(row: DashboardRow): CustomDashboard {
  return {
    ...row,
    layout: Array.isArray(row.layout) ? row.layout : [],
    widgets: Array.isArray(row.widgets) ? row.widgets : [],
    filters_schema: row.filters_schema || {},
    shared_with: row.shared_with || [],
  } as CustomDashboard
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message || fallback
  if (typeof e === 'string') return e
  return fallback
}

export function useCustomDashboards() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_dashboards' as never)
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data as DashboardRow[]).map(normalize)
    },
    staleTime: 60_000,
  })
}

export function useCustomDashboard(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('custom_dashboards' as never)
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data ? normalize(data as DashboardRow) : null
    },
    enabled: !!id,
  })
}

export function useCreateDashboard() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: {
      nom: string
      description?: string
      widgets?: WidgetConfig[]
      layout?: GridLayoutItem[]
      from_template_id?: string
    }) => {
      if (!user) throw new Error('Authentification requise')
      const payload: DashboardInsert = {
        nom: input.nom,
        description: input.description || null,
        owner_id: user.id,
        widgets: input.widgets || [],
        layout: input.layout || [],
        is_template: false,
      }
      const { data, error } = await supabase
        .from('custom_dashboards' as never)
        .insert(payload as never)
        .select()
        .single()
      if (error) throw error
      return normalize(data as DashboardRow)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success('Rapport créé')
    },
    onError: (e: unknown) => toast.error(errorMessage(e, 'Erreur lors de la création')),
  })
}

export function useUpdateDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<CustomDashboard> }) => {
      const { id, patch } = input
      const { data, error } = await supabase
        .from('custom_dashboards' as never)
        .update(patch as never)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()
      if (error) throw error
      return normalize(data as DashboardRow)
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: [...KEY, data.id] })
    },
    onError: (e: unknown) => toast.error(errorMessage(e, 'Erreur lors de la sauvegarde')),
  })
}

export function useDeleteDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_dashboards' as never)
        .delete()
        .eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success('Rapport supprimé')
    },
    onError: (e: unknown) => toast.error(errorMessage(e, 'Erreur')),
  })
}

export function useDuplicateDashboard() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (source: CustomDashboard) => {
      if (!user) throw new Error('Authentification requise')
      const payload: DashboardInsert = {
        nom: `${source.nom} (copie)`,
        description: source.description,
        owner_id: user.id,
        widgets: source.widgets,
        layout: source.layout,
        filters_schema: source.filters_schema,
        is_template: false,
      }
      const { data, error } = await supabase
        .from('custom_dashboards' as never)
        .insert(payload as never)
        .select()
        .single()
      if (error) throw error
      return normalize(data as DashboardRow)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success('Rapport dupliqué')
    },
    onError: (e: unknown) => toast.error(errorMessage(e, 'Erreur')),
  })
}
