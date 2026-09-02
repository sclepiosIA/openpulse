import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

// ---------- Types ----------
export type BIColumn = { name: string; type: string; label: string; sensitive?: boolean }

export interface BIDataset {
  id: string
  key: string
  name: string
  description: string | null
  source_view: string
  columns: BIColumn[]
  allowed_roles: string[]
  is_active: boolean
  created_at: string
}

export type BIFilterOp =
  | '='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'in'
  | 'not_in'
  | 'between'
  | 'ilike'
  | 'like'
  | 'is_null'
  | 'is_not_null'

export type BIDateTrunc = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface BIFilter {
  col: string
  op: BIFilterOp
  value?: unknown
  date_trunc?: BIDateTrunc
}
export interface BIGroupBy {
  col: string
  date_trunc?: BIDateTrunc
  alias?: string
}
export interface BIAggregation {
  fn: 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max'
  col?: string
  alias: string
}
export interface BIOrderBy {
  col: string
  dir?: 'asc' | 'desc'
}

export interface BIDefinition {
  filters?: BIFilter[]
  group_by?: BIGroupBy[]
  aggregations?: BIAggregation[]
  order_by?: BIOrderBy[]
  limit?: number
}

export type BIVizType = 'table' | 'kpi' | 'line' | 'bar' | 'stacked_bar' | 'pie' | 'funnel'

export interface BIQuestion {
  id: string
  dataset_id: string
  name: string
  description: string | null
  definition: BIDefinition
  viz_type: BIVizType
  viz_config: Record<string, unknown>
  params: unknown[]
  is_shared: boolean
  tags: string[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BIDashboard {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  layout: Array<{ i: string; x: number; y: number; w: number; h: number }>
  filters: unknown[]
  allowed_roles: string[]
  is_favorite: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// ---------- Datasets ----------
export function useBIDatasets() {
  return useQuery({
    queryKey: ['bi', 'datasets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bi_datasets' as never)
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as BIDataset[]
    },
    staleTime: 5 * 60_000,
  })
}

// ---------- Questions ----------
export function useBIQuestions(datasetId?: string) {
  return useQuery({
    queryKey: ['bi', 'questions', datasetId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('bi_questions' as never)
        .select('*')
        .order('updated_at', { ascending: false })
      if (datasetId) q = q.eq('dataset_id', datasetId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as BIQuestion[]
    },
  })
}

export function useBIQuestion(id?: string) {
  return useQuery({
    queryKey: ['bi', 'question', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bi_questions' as never)
        .select('*')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as unknown as BIQuestion | null
    },
  })
}

export function useSaveBIQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<BIQuestion> & { dataset_id: string; name: string }) => {
      const row = {
        name: payload.name,
        description: payload.description ?? null,
        definition: payload.definition ?? {},
        viz_type: payload.viz_type ?? 'table',
        viz_config: payload.viz_config ?? {},
        tags: payload.tags ?? [],
      }
      if (payload.id) {
        const { data, error } = await (
          supabase.from('bi_questions' as never) as never as {
            update: (v: unknown) => {
              eq: (
                c: string,
                v: string
              ) => {
                select: () => { single: () => Promise<{ data: unknown; error: Error | null }> }
              }
            }
          }
        )
          .update(row)
          .eq('id', payload.id)
          .select()
          .single()
        if (error) throw error
        return data as BIQuestion
      }
      const { data, error } = await (
        supabase.from('bi_questions' as never) as never as {
          insert: (v: unknown) => {
            select: () => { single: () => Promise<{ data: unknown; error: Error | null }> }
          }
        }
      )
        .insert({ ...row, dataset_id: payload.dataset_id })
        .select()
        .single()
      if (error) throw error
      return data as unknown as BIQuestion
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bi', 'questions'] })
      toast.success('Question sauvegardée')
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  })
}

export function useDeleteBIQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bi_questions' as never)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bi', 'questions'] })
      toast.success('Question supprimée')
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  })
}

// ---------- Dashboards ----------
export function useBIDashboards() {
  return useQuery({
    queryKey: ['bi', 'dashboards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bi_dashboards' as never)
        .select('*')
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as unknown as BIDashboard[]
    },
  })
}

export function useBIDashboard(slug?: string) {
  return useQuery({
    queryKey: ['bi', 'dashboard', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bi_dashboards' as never)
        .select('*')
        .eq('slug', slug!)
        .maybeSingle()
      if (error) throw error
      return data as unknown as BIDashboard | null
    },
  })
}

export function useUpdateBIDashboardLayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, layout }: { id: string; layout: BIDashboard['layout'] }) => {
      const { error } = await (
        supabase.from('bi_dashboards' as never) as never as {
          update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> }
        }
      )
        .update({ layout })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bi', 'dashboards'] }),
  })
}

// ---------- Query execution ----------
export interface BIQueryResult {
  rows: Record<string, unknown>[]
  row_count: number
  cached: boolean
  duration_ms: number
  sql?: string
}

export function useRunBIQuery(questionId?: string) {
  return useQuery({
    queryKey: ['bi', 'run', questionId],
    enabled: !!questionId,
    queryFn: async (): Promise<BIQueryResult> => {
      const { data, error } = await supabase.functions.invoke('bi-run-query', {
        body: { question_id: questionId },
      })
      if (error) throw error
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
      return data as BIQueryResult
    },
    staleTime: 30_000,
  })
}

export function useExplainBIWithAI() {
  return useMutation({
    mutationFn: async (args: {
      question_name: string
      rows: unknown[]
      viz_type?: string
      context?: string
    }) => {
      const { data, error } = await supabase.functions.invoke('bi-explain-with-ai', { body: args })
      if (error) throw error
      const payload = data as { analysis?: string; error?: string }
      if (payload.error) throw new Error(payload.error)
      return payload.analysis ?? ''
    },
  })
}
