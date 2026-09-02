import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import type { Calendar } from '@/types/calendar'
import { queryPresets } from '@/lib/queryPresets'

interface OwnerProfile {
  id: string
  prenom: string
  nom: string
  avatar_url: string | null
  user_id: string | null
}

export interface MarqueTeamCalendar extends Calendar {
  owner_profile: OwnerProfile
}

/**
 * Récupère les calendriers par défaut de tous les autres membres de l'équipe.
 * Ces calendriers sont visibles grâce à la RLS qui autorise is_default = true.
 */
export function useMarqueTeamCalendars() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['marque-team-calendars', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Non authentifié')

      // Fetch all default calendars that are NOT owned by current user
      const { data: calendars, error } = await supabase
        .from('calendars')
        .select(
          'id, name, color, description, owner_id, type, is_default, is_visible, timezone, created_at, updated_at'
        )
        .eq('is_default', true)
        .neq('owner_id', user.id)
        .limit(50)

      if (error) throw error
      if (!calendars || calendars.length === 0) return []

      // Fetch profiles for owners
      const ownerIds = calendars.map((c) => c.owner_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, prenom, nom, avatar_url, user_id, actif')
        .in('user_id', ownerIds)

      // Build map and track inactive profiles
      const profilesByUserId = (profiles || []).reduce<
        Record<string, OwnerProfile & { actif?: boolean }>
      >((acc, p) => {
        if (p.user_id) {
          acc[p.user_id] = {
            id: p.id,
            prenom: p.prenom || '',
            nom: p.nom || '',
            avatar_url: p.avatar_url || null,
            user_id: p.user_id,
            actif: (p as { actif?: boolean }).actif,
          }
        }
        return acc
      }, {})

      // Filter out calendars whose owner is inactive, has no profile, or is a test/e2e account
      const isTestProfile = (p: { prenom?: string; nom?: string }) => {
        const full = `${p.prenom ?? ''} ${p.nom ?? ''}`.trim().toLowerCase()
        return (
          /^test\b/.test(full) ||
          /\btest\b/.test(p.prenom?.toLowerCase() ?? '') ||
          full.includes('e2e-') ||
          full.startsWith('e2e ')
        )
      }
      const activeCalendars = calendars.filter((cal) => {
        const profile = profilesByUserId[cal.owner_id]
        // Exclude if no profile found or profile is inactive
        if (!profile) return false
        if (profile.actif === false) return false
        if (isTestProfile(profile)) return false
        return true
      })

      return activeCalendars.map((cal) => ({
        ...cal,
        type: (cal.type as Calendar['type']) || 'personal',
        is_default: cal.is_default ?? false,
        is_visible: cal.is_visible ?? true,
        timezone: cal.timezone ?? 'Europe/Paris',
        owner_profile: profilesByUserId[cal.owner_id] || {
          id: '',
          prenom: '?',
          nom: '',
          avatar_url: null,
          user_id: cal.owner_id,
        },
      })) as MarqueTeamCalendar[]
    },
    enabled: !!user,
    ...queryPresets.reference,
  })
}
