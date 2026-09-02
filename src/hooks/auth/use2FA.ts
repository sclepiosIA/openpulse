import { useCallback, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseBrowser'
import { debug } from '@/lib/debug'
import { useAuth } from '@/components/AuthProvider'

/**
 * Source de vérité du 2FA : facteurs TOTP Supabase Auth réellement vérifiés.
 * Le booléen historique `profiles.two_factor_enabled` peut être stale et ne
 * doit jamais bloquer un utilisateur qui n'a enrôlé aucun authentificateur.
 */
export async function checkTwoFactorRequired(_userId: string): Promise<boolean> {
  const mfa = supabase.auth.mfa
  if (!mfa?.listFactors) return false

  const factors = await mfa.listFactors()
  if (factors.error) throw factors.error
  return factors.data.totp.some((factor) => factor.status === 'verified')
}

/**
 * Indicate qu'un ancien compte marqué 2FA doit migrer vers Supabase MFA.
 * Ce flag ne permet jamais de valider un login : il ouvre uniquement le
 * parcours d'enrôlement QR natif.
 */
export async function checkLegacyTwoFactorMigrationRequired(userId: string): Promise<boolean> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('two_factor_enabled')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return profile?.two_factor_enabled === true
}

/** Validate a TOTP against an already-established, unpublished auth session. */
export async function validateTwoFactorToken(session: Session, token: string): Promise<boolean> {
  if (!/^\d{6}$/.test(token)) return false

  const response = await supabase.functions.invoke('generate-2fa-secret', {
    body: { action: 'validate', token },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (response.error) throw response.error
  return response.data?.valid === true
}

/**
 * Settings/profile helper. The login flow must use AuthProvider.verify2FA so
 * it retains the pending session and cannot publish it prematurely.
 */
export function use2FA() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const validate2FAToken = useCallback(async (token: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return false
      return await validateTwoFactorToken(session, token)
    } catch (error) {
      debug.error('Erreur validation 2FA:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // `useCallback` obligatoire : cette fonction est consommée en dépendance
  // d'effets (cf. `Profil.tsx`). Recréée à chaque rendu, elle relançait
  // l'effet, dont le `setState` provoquait un nouveau rendu — boucle infinie.
  // Mesuré sur /profil : 2 022 requêtes en 20 s (953 sur /auth/v1/user,
  // 713 sur /rest/v1/profiles), jusqu'à `net::ERR_INSUFFICIENT_RESOURCES` et
  // une page bloquée sur « Erreur de chargement ».
  const check2FAEnabled = useCallback(async (): Promise<boolean> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const userId = session?.user?.id || user?.id
      if (!userId) return false
      return await checkTwoFactorRequired(userId)
    } catch (error) {
      debug.error('Erreur vérification 2FA:', error)
      return false
    }
  }, [user?.id])

  return { validate2FAToken, check2FAEnabled, isLoading }
}
