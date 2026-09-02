import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import type { ActivityType } from './useCustomerActivities'

// Type strict pour les métadonnées d'activité
export interface ActivityMetadata {
  notes?: string
  attendees?: string[]
  outcome?: string
  followup_date?: string
  related_ticket_id?: string
  duration_minutes?: number
  [key: string]: string | number | string[] | undefined
}

export interface GroupeActivity {
  id: string
  etablissement_id: string | null
  activity_type: ActivityType
  title: string
  description: string | null
  activity_date: string
  scheduled_date: string | null
  completed_date: string | null
  metadata: ActivityMetadata | null
  created_by: string | null
  assigned_to: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  groupe_id?: string | null
  etablissement_nom?: string
  source: 'groupe' | 'etablissement'
}

// Fetch all activities for a groupe (direct + from all member establishments)
export function useGroupeActivities(
  groupeId?: string,
  options?: {
    type?: ActivityType
    status?: string
    limit?: number
    includeEstablishments?: boolean
  }
) {
  return useQuery({
    queryKey: ['groupe-activities', groupeId, options],
    queryFn: async () => {
      if (!groupeId) return []

      // First get all establishment IDs in this groupe
      const { data: groupeEtabs } = await supabase
        .from('etablissements_groupes')
        .select('etablissement_id, etablissement:etablissements(nom)')
        .eq('groupe_id', groupeId)
        .is('date_sortie', null)

      const etablissementIds = groupeEtabs?.map((eg) => eg.etablissement_id) || []
      // Type assertion pour le join Supabase
      type EtabJoin = { nom: string } | null
      const etablissementNames =
        groupeEtabs?.reduce(
          (acc, eg) => {
            const etab = eg.etablissement as EtabJoin
            acc[eg.etablissement_id] = etab?.nom || 'Inconnu'
            return acc
          },
          {} as Record<string, string>
        ) || {}

      // Fetch activities from all member establishments
      let query = supabase
        .from('customer_activities')
        .select(
          'id, etablissement_id, activity_type, title, description, activity_date, scheduled_date, completed_date, metadata, created_by, assigned_to, status, created_at, updated_at'
        )
        .order('activity_date', { ascending: false })

      if (etablissementIds.length > 0) {
        query = query.in('etablissement_id', etablissementIds)
      } else {
        return [] // No establishments in groupe
      }

      if (options?.type) {
        query = query.eq('activity_type', options.type)
      }

      if (options?.status) {
        query = query.eq('status', options.status)
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query

      if (error) throw error

      // Enrich with etablissement name - handle metadata safely
      const enrichedActivities: GroupeActivity[] = (data || []).map((activity) => {
        let parsedMetadata: ActivityMetadata | null = null
        if (
          activity.metadata &&
          typeof activity.metadata === 'object' &&
          !Array.isArray(activity.metadata)
        ) {
          parsedMetadata = activity.metadata as ActivityMetadata
        }

        return {
          id: activity.id,
          etablissement_id: activity.etablissement_id,
          activity_type: activity.activity_type as ActivityType,
          title: activity.title,
          description: activity.description,
          activity_date: activity.activity_date || activity.created_at || '',
          scheduled_date: activity.scheduled_date,
          completed_date: activity.completed_date,
          metadata: parsedMetadata,
          created_by: activity.created_by,
          assigned_to: activity.assigned_to,
          status: (activity.status || 'scheduled') as GroupeActivity['status'],
          created_at: activity.created_at || '',
          updated_at: activity.updated_at || '',
          etablissement_nom: activity.etablissement_id
            ? etablissementNames[activity.etablissement_id] || 'Inconnu'
            : 'Groupe',
          source: 'etablissement' as const,
        }
      })

      return enrichedActivities
    },
    enabled: !!groupeId,
    // Uses global staleTime from QueryClient (2 min)
  })
}

// Get activity statistics for a groupe
export function useGroupeActivityStats(groupeId?: string) {
  const { data: activities, isLoading } = useGroupeActivities(groupeId, { limit: 100 })

  const stats = {
    total: activities?.length || 0,
    byType: {} as Record<ActivityType, number>,
    byStatus: {
      scheduled: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    },
    recentCount: 0, // Last 30 days
  }

  if (activities) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    activities.forEach((activity) => {
      // Count by type
      stats.byType[activity.activity_type] = (stats.byType[activity.activity_type] || 0) + 1

      // Count by status
      if (activity.status in stats.byStatus) {
        stats.byStatus[activity.status as keyof typeof stats.byStatus]++
      }

      // Count recent
      if (new Date(activity.activity_date) >= thirtyDaysAgo) {
        stats.recentCount++
      }
    })
  }

  return { stats, isLoading }
}
