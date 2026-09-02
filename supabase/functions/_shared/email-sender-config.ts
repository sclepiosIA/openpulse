/**
 * Shared helper to load email sender addresses from app_config.
 * All Edge Functions that send emails should use this instead of hardcoded from addresses.
 */
import { createClient } from '@supabase/supabase-js'

export interface EmailSenderConfig {
  default_from: string
  notifications_from: string
  formations_from: string
  support_from: string
}

const DEFAULT_CONFIG: EmailSenderConfig = {
  default_from: 'OpenPulse <noreply@exploitant.example.org>',
  notifications_from: 'OpenPulse <notifications@exploitant.example.org>',
  formations_from: 'OpenPulse <formations@exploitant.example.org>',
  support_from: 'OpenPulse <support@exploitant.example.org>',
}

let cachedConfig: EmailSenderConfig | null = null
let cacheExpiry = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getEmailSenderConfig(): Promise<EmailSenderConfig> {
  const now = Date.now()
  if (cachedConfig && now < cacheExpiry) {
    return cachedConfig
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'email_sender')
      .single()

    if (error || !data) {
      console.warn(
        '[email-sender-config] Failed to load from app_config, using defaults:',
        error?.message
      )
      return DEFAULT_CONFIG
    }

    const val = data.value as Record<string, string>
    cachedConfig = {
      default_from: val.default_from || DEFAULT_CONFIG.default_from,
      notifications_from: val.notifications_from || DEFAULT_CONFIG.notifications_from,
      formations_from: val.formations_from || DEFAULT_CONFIG.formations_from,
      support_from: val.support_from || DEFAULT_CONFIG.support_from,
    }
    cacheExpiry = now + CACHE_TTL
    return cachedConfig
  } catch (err) {
    console.error('[email-sender-config] Error loading config:', err)
    return DEFAULT_CONFIG
  }
}
