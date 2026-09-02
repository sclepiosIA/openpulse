import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'

export interface TimeActivityType {
  id: string
  code: string
  label: string
  category: string
  is_billable_default: boolean
  is_cir_eligible: boolean
  is_absence: boolean
  color: string | null
}

export interface TimeImputation {
  id: string
  user_id: string
  date_imputation: string
  week_iso: string
  duration_minutes: number
  activity_type_id: string | null
  etablissement_id: string | null
  projet_rd_id: string | null
  tache_id: string | null
  is_billable: boolean
  hourly_rate_snapshot: number | null
  cout_horaire_charge_snapshot: number | null
  tjm_snapshot: number | null
  note: string | null
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
}

export interface WeeklySubmission {
  id: string
  user_id: string
  week_iso: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  total_minutes: number
  billable_minutes: number
  submitted_at: string | null
  approved_at: string | null
  rejection_reason: string | null
  note: string | null
}

/** ISO week (YYYY-Www) for a JS Date. */
export function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

export function weekDates(weekIso: string): Date[] {
  const [y, w] = weekIso.split('-W').map(Number)
  // Thursday of ISO week
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (w - 1) * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    return d
  })
}

export function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function useActivityTypes() {
  return useQuery({
    queryKey: ['time_activity_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_activity_types')
        .select(
          'id, code, label, category, is_billable_default, is_cir_eligible, is_absence, color'
        )
        .eq('active', true)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as TimeActivityType[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useWeekImputations(weekIso: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['time_imputations', user?.id, weekIso],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_imputations')
        .select('*')
        .eq('user_id', user!.id)
        .eq('week_iso', weekIso)
        .order('date_imputation')
      if (error) throw error
      return (data ?? []) as TimeImputation[]
    },
  })
}

export function useWeeklySubmission(weekIso: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['time_weekly_submission', user?.id, weekIso],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_weekly_submissions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('week_iso', weekIso)
        .maybeSingle()
      if (error) throw error
      return data as WeeklySubmission | null
    },
  })
}

export function useUpsertImputation() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (
      payload: Partial<TimeImputation> & { date_imputation: string; duration_minutes: number }
    ) => {
      if (!user) throw new Error('Non authentifié')
      const row = {
        ...payload,
        user_id: user.id,
        week_iso: isoWeek(new Date(payload.date_imputation)),
      }
      if (payload.id) {
        const { error } = await supabase.from('time_imputations').update(row).eq('id', payload.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('time_imputations').insert(row as never)
        if (error) throw error
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ['time_imputations', user?.id, isoWeek(new Date(vars.date_imputation))],
      })
    },
  })
}

export function useDeleteImputation() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_imputations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time_imputations', user?.id] }),
  })
}

export function useSubmitWeek() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ week_iso, note }: { week_iso: string; note?: string }) => {
      const { data, error } = await supabase.functions.invoke('time-submit-week', {
        body: { week_iso, note },
      })
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['time_weekly_submission', user?.id, vars.week_iso] })
      qc.invalidateQueries({ queryKey: ['time_imputations', user?.id, vars.week_iso] })
    },
  })
}

export type TimeSuggestion = {
  date: string
  activity_type_code: string
  duration_minutes: number
  etablissement_id: string | null
  projet_rd_id: string | null
  note: string | null
}

export function useSuggestImputations() {
  return useMutation({
    mutationFn: async (date: string) => {
      const { data, error } = await supabase.functions.invoke('time-suggest-imputation', {
        body: { date },
      })
      if (error) throw error
      return data as { suggestions: TimeSuggestion[]; error?: string; reason?: string }
    },
  })
}

/** Suggestion IA sur toute la semaine (lundi -> dimanche) */
export function useSuggestWeekImputations() {
  return useMutation({
    mutationFn: async (weekStart: string) => {
      const { data, error } = await supabase.functions.invoke('time-suggest-imputation', {
        body: { week_start: weekStart },
      })
      if (error) throw error
      return data as { suggestions: TimeSuggestion[]; error?: string; reason?: string }
    },
  })
}

/** Admin: liste des semaines à valider */
export function usePendingWeeklySubmissions() {
  return useQuery({
    queryKey: ['time_weekly_submissions_pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_weekly_submissions')
        .select('*')
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as WeeklySubmission[]
    },
  })
}

export function useApproveWeek() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      submission_id,
      action,
      reason,
    }: {
      submission_id: string
      action: 'approve' | 'reject'
      reason?: string
    }) => {
      const { data, error } = await supabase.functions.invoke('time-approve-week', {
        body: { submission_id, action, reason },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time_weekly_submissions_pending'] })
      qc.invalidateQueries({ queryKey: ['time_weekly_submission'] })
    },
  })
}

/** Rentabilité par établissement */
export function useRentabiliteEtablissement(mois?: string) {
  return useQuery({
    queryKey: ['v_time_rentabilite_etablissement', mois ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('v_time_rentabilite_etablissement').select('*')
      if (mois) q = q.gte('mois', mois)
      const { data, error } = await q.order('mois', { ascending: false }).limit(500)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useRentabiliteProjetRd(mois?: string) {
  return useQuery({
    queryKey: ['v_time_rentabilite_projet_rd', mois ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('v_time_rentabilite_projet_rd').select('*')
      if (mois) q = q.gte('mois', mois)
      const { data, error } = await q.order('mois', { ascending: false }).limit(500)
      if (error) throw error
      return data ?? []
    },
  })
}
