import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'

export type ActivityType = 
  | 'qbr' 
  | 'training' 
  | 'support_ticket' 
  | 'escalation' 
  | 'renewal' 
  | 'upsell' 
  | 'nps_survey' 
  | 'health_change' 
  | 'note' 
  | 'meeting' 
  | 'email' 
  | 'incident'
  | 'call'
  | 'visio'
  | 'demo'
  | 'document'
  | 'linkedin'

// Type strict pour les métadonnées d'activité client
export interface CustomerActivityMetadata {
  notes?: string;
  attendees?: string[];
  outcome?: string;
  followup_date?: string;
  related_ticket_id?: string;
  duration_minutes?: number;
  generated?: boolean;
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface CustomerActivity {
  id: string
  etablissement_id: string
  activity_type: ActivityType
  title: string
  description: string | null
  activity_date: string
  scheduled_date: string | null
  completed_date: string | null
  metadata: CustomerActivityMetadata
  created_by: string | null
  assigned_to: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
}

export function useCustomerActivities(etablissementId?: string, options?: {
  type?: ActivityType
  status?: string
  limit?: number
}) {
  return useQuery({
    queryKey: ['customer-activities', etablissementId, options],
    queryFn: async () => {
      let query = supabase
        .from('customer_activities')
        .select('id, etablissement_id, activity_type, title, description, activity_date, scheduled_date, completed_date, metadata, created_by, assigned_to, status, created_at, updated_at')
        .order('activity_date', { ascending: false })

      if (etablissementId) {
        query = query.eq('etablissement_id', etablissementId)
      }

      if (options?.type) {
        query = query.eq('activity_type', options.type)
      }

      if (options?.status) {
        query = query.eq('status', options.status)
      }

      query = query.limit(options?.limit || 500)

      const { data, error } = await query

      if (error) throw error
      return data as CustomerActivity[]
    },
    enabled: !!etablissementId || etablissementId === undefined,
  })
}

export function useCreateActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (activity: Omit<CustomerActivity, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('customer_activities')
        .insert(activity)
        .select('id, etablissement_id, activity_type, title, description, activity_date, scheduled_date, completed_date, metadata, created_by, assigned_to, status, created_at, updated_at')
        // safe: guaranteed-row
        .single();

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-activities'] })
      toast.success('Activité créée')
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}
