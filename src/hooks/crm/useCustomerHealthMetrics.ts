import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'

export interface HealthMetrics {
  id: string
  etablissement_id: string
  health_score: number
  health_status: 'healthy' | 'at-risk' | 'churn-risk' | 'critical' | 'onboarding'
  
  // Adoption - Métriques médicales
  adoption_rate: number
  taux_utilisation_cotation: number
  taux_completion_dossier: number
  
  // Engagement - Métriques UHCD et qualité médicale
  taux_uhcd_mono_rum: number
  nombre_avis_specialise: number
  nombre_ccmu_2_plus: number
  nombre_ccmu_3_plus: number
  
  // Satisfaction
  nps_score: number | null
  nps_survey_date: string | null
  satisfaction_score: number | null
  
  // Support
  support_tickets_open: number
  support_tickets_closed_30d: number
  avg_resolution_time_hours: number | null
  last_ticket_date: string | null
  
  // Contrat
  payment_status: 'on_time' | 'late' | 'overdue'
  contract_value: number | null
  contract_start_date: string | null
  contract_end_date: string | null
  roi_annuel: number | null
  
  // Métadonnées
  calculated_at: string
  notes: string | null
}

// Hook pour récupérer les métriques d'un établissement
export function useCustomerHealthMetrics(etablissementId?: string) {
  return useQuery({
    queryKey: ['customer-health-metrics', etablissementId],
    queryFn: async () => {
      if (!etablissementId) return null

      const { data, error } = await supabase
        .from('customer_health_metrics')
        .select('id, etablissement_id, health_score, health_status, adoption_rate, taux_utilisation_cotation, taux_completion_dossier, taux_uhcd_mono_rum, nombre_avis_specialise, nombre_ccmu_2_plus, nombre_ccmu_3_plus, nps_score, nps_survey_date, satisfaction_score, support_tickets_open, support_tickets_closed_30d, avg_resolution_time_hours, last_ticket_date, payment_status, contract_value, contract_start_date, contract_end_date, roi_annuel, calculated_at, notes')
        .eq('etablissement_id', etablissementId)
        .maybeSingle()

      if (error) throw error

      return data ? (data as unknown as HealthMetrics) : null
    },
    enabled: !!etablissementId,
  })
}

// Hook pour récupérer les métriques de plusieurs établissements
export function useBulkHealthMetrics(etablissementIds?: string[]) {
  return useQuery({
    queryKey: ['customer-health-metrics-bulk', etablissementIds],
    queryFn: async () => {
      if (!etablissementIds || etablissementIds.length === 0) {
        return new Map<string, HealthMetrics>()
      }

      const { data, error } = await supabase
        .from('customer_health_metrics')
        .select('id, etablissement_id, health_score, health_status, adoption_rate, taux_utilisation_cotation, taux_completion_dossier, taux_uhcd_mono_rum, nombre_avis_specialise, nombre_ccmu_2_plus, nombre_ccmu_3_plus, nps_score, nps_survey_date, satisfaction_score, support_tickets_open, support_tickets_closed_30d, avg_resolution_time_hours, last_ticket_date, payment_status, contract_value, contract_start_date, contract_end_date, roi_annuel, calculated_at, notes')
        .in('etablissement_id', etablissementIds)

      if (error) throw error

      // Convertir en Map pour accès rapide
      const map = new Map<string, HealthMetrics>()
      data?.forEach(metrics => {
        map.set(metrics.etablissement_id, metrics as unknown as HealthMetrics)
      })

      return map
    },
    enabled: !!etablissementIds && etablissementIds.length > 0,
  })
}

// Hook pour mettre à jour les métriques
export function useUpdateHealthMetrics() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (metrics: Partial<HealthMetrics> & { etablissement_id: string }) => {
      const { data, error } = await supabase
        .from('customer_health_metrics')
        .upsert({
          ...metrics,
          updated_at: new Date().toISOString()
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-health-metrics'] })
      toast.success('Métriques mises à jour')
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}
