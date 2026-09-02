import { useEffect } from 'react'
import {
  installDesktopAuthResponder,
  isTrustedDesktopParentContext,
  notifyDesktopDriveAuthStatus,
  type DesktopDriveAuthRequest,
  type DesktopDriveAuthSnapshot,
} from '@/lib/desktopBridge'
import {
  DriveFreshMfaRequiredError,
  exchangeDesktopWebSessionForDriveToken,
} from '@/lib/drive/driveClient'
import { supabase } from '@/integrations/supabase/client'

function freshMfaChallenge(error: unknown): string | null {
  if (
    (error instanceof DriveFreshMfaRequiredError ||
      (error instanceof Error && error.name === 'DriveFreshMfaRequiredError')) &&
    typeof (error as { handoffChallenge?: unknown }).handoffChallenge === 'string'
  ) {
    return (error as unknown as { handoffChallenge: string }).handoffChallenge
  }
  return null
}

async function verifyFreshDesktopMfa(code: string): Promise<string> {
  const factors = await supabase.auth.mfa.listFactors()
  if (factors.error) throw factors.error
  const factor = factors.data.totp.find((candidate) => candidate.status === 'verified')
  if (!factor) throw new Error('Aucun facteur TOTP vérifié')
  const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
  if (verified.error) throw verified.error
  const refreshed = await supabase.auth.getSession()
  const token = refreshed.data.session?.access_token
  if (!token) throw new Error('Session MFA fraîche indisponible')
  return token
}

/**
 * Expose une session Drive uniquement à la demande nonce-corrélée du parent
 * Tauri. Le premier échange crée un challenge serveur ; un refresh long n'est
 * délivré qu'après une nouvelle preuve TOTP Supabase liée à ce challenge.
 */
export function useDesktopDriveAuthResponder(
  providerAccessToken: string | null,
  loading: boolean
): void {
  const trustedDesktopContext = isTrustedDesktopParentContext()
  const status = !trustedDesktopContext
    ? 'unauthenticated'
    : loading
      ? 'loading'
      : providerAccessToken
        ? 'authenticated'
        : 'unauthenticated'

  useEffect(() => {
    const cleanup = installDesktopAuthResponder(
      async (request: DesktopDriveAuthRequest): Promise<DesktopDriveAuthSnapshot> => {
        if (!trustedDesktopContext || !providerAccessToken || loading) {
          return { status, driveSession: null }
        }
        try {
          const token = request.mfaCode
            ? await verifyFreshDesktopMfa(request.mfaCode)
            : providerAccessToken
          const driveSession = await exchangeDesktopWebSessionForDriveToken(token, {
            nonce: request.nonce,
            ...(request.handoffChallenge ? { challenge: request.handoffChallenge } : {}),
          })
          return { status: 'authenticated', driveSession }
        } catch (error) {
          const handoffChallenge = freshMfaChallenge(error)
          if (handoffChallenge) {
            return { status: 'mfa-required', driveSession: null, handoffChallenge }
          }
          notifyDesktopDriveAuthStatus('unauthenticated')
          return { status: 'unauthenticated', driveSession: null }
        }
      }
    )
    notifyDesktopDriveAuthStatus(status)
    return cleanup
  }, [loading, providerAccessToken, status, trustedDesktopContext])
}
