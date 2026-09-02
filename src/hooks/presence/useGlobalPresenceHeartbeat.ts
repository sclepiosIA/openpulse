import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseBrowser'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { useVisibilityAwareInterval } from '@/hooks/ui/useVisibilityAwareInterval'
import { debug } from '@/lib/debug'

// Présence globale : conversation_id = NULL (index unique partiel côté DB).
// L'ancien sentinel UUID nul violait la FK pulse_presence_conversation_id_fkey.
const GLOBAL_CONVERSATION_ID: string | null = null
const HEARTBEAT_INTERVAL = 60_000 // 60s

// Statuts custom que le heartbeat ne doit pas écraser
const CUSTOM_STATUSES = new Set(['dnd', 'in_meeting', 'busy'])

/**
 * Hook global qui maintient la présence de l'utilisateur dans pulse_presence
 * même quand il n'est pas sur la page Pulse.
 * Upsert toutes les 60s, gère visibilité onglet et beforeunload.
 */
export function useGlobalPresenceHeartbeat() {
  const { data: currentProfile } = useCurrentProfile()
  const profileId = currentProfile?.id
  const currentStatusRef = useRef<string | null>(null)
  const jwtRef = useRef<string | null>(null)
  const writesPausedUntilRef = useRef(0)

  const handlePresenceError = useCallback((error: unknown) => {
    if (!error) return
    const status = (error as { status?: number })?.status
    const code = (error as { code?: string })?.code
    if (status === 401 || status === 403 || code === '42501') {
      writesPausedUntilRef.current = Date.now() + 60_000
    }
    debug.warn('[Presence] heartbeat skipped:', error)
  }, [])

  // Charge le statut existant pour ne pas écraser un statut custom
  const loadCurrentStatus = useCallback(async () => {
    if (!profileId) return
    const { data, error } = await supabase
      .from('pulse_presence')
      .select('status')
      .eq('user_id', profileId)
      .is('conversation_id', null)
      .maybeSingle()
    if (error) {
      handlePresenceError(error)
      return
    }
    currentStatusRef.current = data?.status ?? null
  }, [profileId, handlePresenceError])

  const upsertPresence = useCallback(
    async (status: 'active' | 'away' | 'offline') => {
      if (!profileId) return
      if (Date.now() < writesPausedUntilRef.current) return

      // Ne pas écraser un statut custom (dnd, in_meeting, busy) sauf pour offline
      if (
        status !== 'offline' &&
        currentStatusRef.current &&
        CUSTOM_STATUSES.has(currentStatusRef.current)
      ) {
        // Juste mettre à jour last_seen_at sans changer le statut
        const { error } = await supabase.from('pulse_presence').upsert(
          {
            user_id: profileId,
            conversation_id: GLOBAL_CONVERSATION_ID,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,conversation_id', ignoreDuplicates: false }
        )
        if (error) handlePresenceError(error)
        return
      }

      currentStatusRef.current = status
      const { error } = await supabase.from('pulse_presence').upsert(
        {
          user_id: profileId,
          conversation_id: GLOBAL_CONVERSATION_ID,
          status,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,conversation_id', ignoreDuplicates: false }
      )
      if (error) handlePresenceError(error)
    },
    [profileId, handlePresenceError]
  )

  // Heartbeat toutes les 60s — useVisibilityAwareInterval gère déjà pause/resume
  const heartbeat = useCallback(async () => {
    await upsertPresence('active')
  }, [upsertPresence])

  useVisibilityAwareInterval(heartbeat, HEARTBEAT_INTERVAL, {
    runImmediately: true,
    enabled: !!profileId,
  })

  // Charger le statut existant et le JWT au mount
  useEffect(() => {
    loadCurrentStatus()
    supabase.auth.getSession().then(({ data }) => {
      jwtRef.current = data.session?.access_token ?? null
    })
    // Refresh JWT ref on token changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      jwtRef.current = session?.access_token ?? null
    })
    return () => subscription.unsubscribe()
  }, [loadCurrentStatus])

  // Visibilité : only set "away" when tab hidden (active is handled by heartbeat restart)
  useEffect(() => {
    if (!profileId) return

    const handleVisibility = () => {
      if (document.hidden) {
        upsertPresence('away')
      }
      // When tab becomes visible again, useVisibilityAwareInterval restarts
      // and the heartbeat callback will call upsertPresence('active')
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [profileId, upsertPresence])

  // Offline au départ — fetch with keepalive only (sendBeacon can't send auth headers)
  useEffect(() => {
    if (!profileId) return

    const handleUnload = () => {
      const token = jwtRef.current
      if (!token) return // No JWT = can't authenticate, skip to avoid RLS violation

      const url = `${SUPABASE_URL}/rest/v1/pulse_presence?user_id=eq.${profileId}&conversation_id=is.null`
      const body = JSON.stringify({ status: 'offline', last_seen_at: new Date().toISOString() })

      fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          Prefer: 'return=minimal',
        },
        body,
        keepalive: true,
      }).catch(() => {})
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      // On unmount (logout), mark offline
      upsertPresence('offline')
    }
  }, [profileId, upsertPresence])
}
