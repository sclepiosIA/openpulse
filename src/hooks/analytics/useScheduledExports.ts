import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface ScheduledExport {
  id: string
  dashboard_id: string
  format: 'pdf' | 'xlsx'
  frequency: 'daily' | 'weekly' | 'monthly' | null
  hour_utc: number | null
  day_of_week: number | null
  day_of_month: number | null
  recipients: string[]
  is_active: boolean
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
  error_message: string | null
  created_at: string
}

const KEY = ['scheduled_exports'] as const

export function useScheduledExports(dashboardId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, dashboardId],
    queryFn: async (): Promise<ScheduledExport[]> => {
      if (!dashboardId) return []
      const { data, error } = await supabase
        .from('custom_dashboard_exports')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as ScheduledExport[]
    },
    enabled: !!dashboardId,
  })
}

type UpsertInput = Partial<ScheduledExport> & {
  dashboard_id: string
  format: 'pdf' | 'xlsx'
}

export function useUpsertScheduledExport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpsertInput) => {
      const payload = {
        dashboard_id: input.dashboard_id,
        format: input.format,
        frequency: input.frequency ?? null,
        hour_utc: input.hour_utc ?? null,
        day_of_week: input.day_of_week ?? null,
        day_of_month: input.day_of_month ?? null,
        recipients: input.recipients ?? [],
        is_active: input.is_active ?? true,
      }
      if (input.id) {
        const { data, error } = await supabase
          .from('custom_dashboard_exports')
          .update(payload)
          .eq('id', input.id)
          .select()
          // safe: guaranteed-row
          .single()
        if (error) throw error
        return data
      }
      const { data: authData } = await supabase.auth.getSession()
      const insertPayload = { ...payload, created_by: authData.session?.user?.id ?? '' }
      const { data, error } = await supabase
        .from('custom_dashboard_exports')
        .insert(insertPayload)
        .select()
        // safe: guaranteed-row
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, vars.dashboard_id] })
      toast.success('Planification enregistrée')
    },
    onError: (e: Error) => toast.error(e.message || 'Erreur de planification'),
  })
}

export function useDeleteScheduledExport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_dashboard_exports').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success('Planification supprimée')
    },
  })
}
