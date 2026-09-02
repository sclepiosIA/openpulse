import { supabase } from '@/integrations/supabase/client'
import { debug } from '@/lib/debug'

const GLOBAL_CONVERSATION_ID: string | null = null

export type PresenceRow = {
  status: string
  custom_status: string | null
  custom_status_emoji: string | null
  auto_status: boolean | null
  calendar_event_id: string | null
}

export async function fetchLatestPresence(userId: string): Promise<PresenceRow | null> {
  const { data, error } = await supabase
    .from('pulse_presence')
    .select('status, custom_status, custom_status_emoji, auto_status, calendar_event_id')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    debug.warn('Pulse presence read skipped:', error)
    return null
  }

  return (data as PresenceRow | null) ?? null
}

export async function upsertPresence(params: {
  userId: string
  status: string
  customStatus?: string | null
  autoStatus?: boolean
  statusExpiresAt?: string | null
}): Promise<void> {
  const { error } = await supabase.from('pulse_presence').upsert(
    {
      user_id: params.userId,
      conversation_id: GLOBAL_CONVERSATION_ID,
      status: params.status,
      custom_status: params.customStatus ?? null,
      status_expires_at: params.statusExpiresAt ?? null,
      auto_status: params.autoStatus ?? false,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,conversation_id' }
  )

  if (error) {
    debug.warn('Pulse global presence update skipped:', error)
  }
}

export async function upsertGlobalPresence(params: {
  userId: string
  status: string
  customStatus?: string | null
  autoStatus?: boolean
  statusExpiresAt?: string | null
}): Promise<void> {
  const { error } = await supabase.from('pulse_presence').upsert(
    {
      user_id: params.userId,
      conversation_id: null,
      status: params.status,
      custom_status: params.customStatus ?? null,
      status_expires_at: params.statusExpiresAt ?? null,
      auto_status: params.autoStatus ?? false,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,conversation_id', ignoreDuplicates: false }
  )

  if (error) {
    debug.warn('Pulse global presence update skipped:', error)
  }
}
