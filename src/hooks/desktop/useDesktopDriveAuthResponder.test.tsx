import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  cleanup,
  exchangeDesktopWebSessionForDriveToken,
  installDesktopAuthResponder,
  isTrustedDesktopParentContext,
  notifyDesktopDriveAuthStatus,
  listFactors,
  challengeAndVerify,
  getSession,
} = vi.hoisted(() => ({
  cleanup: vi.fn(),
  exchangeDesktopWebSessionForDriveToken: vi.fn(),
  installDesktopAuthResponder: vi.fn(),
  isTrustedDesktopParentContext: vi.fn(),
  notifyDesktopDriveAuthStatus: vi.fn(),
  listFactors: vi.fn(),
  challengeAndVerify: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('@/lib/desktopBridge', () => ({
  installDesktopAuthResponder,
  isTrustedDesktopParentContext,
  notifyDesktopDriveAuthStatus,
}))
vi.mock('@/lib/drive/driveClient', () => ({
  exchangeDesktopWebSessionForDriveToken,
  DriveFreshMfaRequiredError: class DriveFreshMfaRequiredError extends Error {
    handoffChallenge: string
    constructor(handoffChallenge: string) {
      super('fresh mfa required')
      this.name = 'DriveFreshMfaRequiredError'
      this.handoffChallenge = handoffChallenge
    }
  },
}))
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      mfa: { listFactors, challengeAndVerify },
      getSession,
    },
  },
}))

import { useDesktopDriveAuthResponder } from './useDesktopDriveAuthResponder'

const DRIVE_SESSION = {
  accessToken: 'drive-scoped-token-long-enough',
  refreshToken: 'drive-refresh-token-opaque-long-enough',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  userEmail: 'user@gsi.fr',
  displayName: 'OpenPulse User',
}

describe('useDesktopDriveAuthResponder', () => {
  beforeEach(() => {
    cleanup.mockReset()
    exchangeDesktopWebSessionForDriveToken.mockReset()
    installDesktopAuthResponder.mockReset()
    isTrustedDesktopParentContext.mockReset()
    notifyDesktopDriveAuthStatus.mockReset()
    listFactors.mockReset()
    challengeAndVerify.mockReset()
    getSession.mockReset()
    installDesktopAuthResponder.mockReturnValue(cleanup)
    isTrustedDesktopParentContext.mockReturnValue(true)
    exchangeDesktopWebSessionForDriveToken.mockResolvedValue(DRIVE_SESSION)
    listFactors.mockResolvedValue({
      data: { totp: [{ id: 'factor-1', status: 'verified' }] },
      error: null,
    })
    challengeAndVerify.mockResolvedValue({ data: {}, error: null })
    getSession.mockResolvedValue({
      data: { session: { access_token: 'fresh-provider-token-never-forwarded' } },
    })
  })

  it('échange dans la PWA et ne publie jamais le bearer fournisseur', async () => {
    const providerToken = 'provider-access-token-never-forwarded'
    const { rerender, unmount } = renderHook(
      ({ token, loading }) => useDesktopDriveAuthResponder(token, loading),
      { initialProps: { token: providerToken as string | null, loading: false } }
    )

    await waitFor(() =>
      expect(notifyDesktopDriveAuthStatus).toHaveBeenLastCalledWith('authenticated')
    )
    expect(exchangeDesktopWebSessionForDriveToken).not.toHaveBeenCalled()
    const getter = installDesktopAuthResponder.mock.calls.at(-1)?.[0]
    const snapshot = await getter({ nonce: 'desktop-nonce-hook-1234' })
    expect(exchangeDesktopWebSessionForDriveToken).toHaveBeenCalledWith(providerToken, {
      nonce: 'desktop-nonce-hook-1234',
    })
    expect(snapshot).toEqual({ status: 'authenticated', driveSession: DRIVE_SESSION })
    expect(JSON.stringify(snapshot)).not.toContain(providerToken)

    rerender({ token: null, loading: true })
    await waitFor(() => expect(notifyDesktopDriveAuthStatus).toHaveBeenLastCalledWith('loading'))
    rerender({ token: null, loading: false })
    await waitFor(() =>
      expect(notifyDesktopDriveAuthStatus).toHaveBeenLastCalledWith('unauthenticated')
    )
    const unauthenticated = await installDesktopAuthResponder.mock.calls.at(-1)?.[0]()
    expect(unauthenticated).toEqual({
      status: 'unauthenticated',
      driveSession: null,
    })

    unmount()
    expect(cleanup).toHaveBeenCalled()
  })

  it('exige puis vérifie un TOTP frais avant de reprendre le challenge serveur', async () => {
    const challenge = 'server-handoff-challenge-opaque-long-enough'
    const mfaRequired = Object.assign(new Error('fresh mfa required'), {
      name: 'DriveFreshMfaRequiredError',
      handoffChallenge: challenge,
    })
    exchangeDesktopWebSessionForDriveToken
      .mockRejectedValueOnce(mfaRequired)
      .mockResolvedValueOnce(DRIVE_SESSION)
    renderHook(() => useDesktopDriveAuthResponder('provider-token-long-enough', false))
    const getter = installDesktopAuthResponder.mock.calls.at(-1)?.[0]

    const challengeSnapshot = await getter({ nonce: 'desktop-nonce-mfa-1234' })
    expect(challengeSnapshot).toEqual({
      status: 'mfa-required',
      driveSession: null,
      handoffChallenge: challenge,
    })

    const authenticated = await getter({
      nonce: 'desktop-nonce-mfa-1234',
      mfaCode: '123456',
      handoffChallenge: challenge,
    })

    expect(challengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' })
    expect(exchangeDesktopWebSessionForDriveToken).toHaveBeenLastCalledWith(
      'fresh-provider-token-never-forwarded',
      { nonce: 'desktop-nonce-mfa-1234', challenge }
    )
    expect(authenticated).toEqual({ status: 'authenticated', driveSession: DRIVE_SESSION })
  })

  it('ne publie aucune session Drive si l’échange serveur échoue', async () => {
    exchangeDesktopWebSessionForDriveToken.mockRejectedValue(new Error('offline'))
    renderHook(() => useDesktopDriveAuthResponder('provider-token-long-enough', false))
    await waitFor(() =>
      expect(notifyDesktopDriveAuthStatus).toHaveBeenLastCalledWith('authenticated')
    )
    const unauthenticated = await installDesktopAuthResponder.mock.calls.at(-1)?.[0]()
    await waitFor(() =>
      expect(notifyDesktopDriveAuthStatus).toHaveBeenLastCalledWith('unauthenticated')
    )
    expect(unauthenticated).toEqual({
      status: 'unauthenticated',
      driveSession: null,
    })
  })

  it('ne crée aucun grant Desktop dans un navigateur web standard', async () => {
    isTrustedDesktopParentContext.mockReturnValue(false)
    renderHook(() => useDesktopDriveAuthResponder('provider-token-long-enough', false))

    await waitFor(() =>
      expect(notifyDesktopDriveAuthStatus).toHaveBeenLastCalledWith('unauthenticated')
    )
    const snapshot = await installDesktopAuthResponder.mock.calls.at(-1)?.[0]()
    expect(snapshot).toEqual({ status: 'unauthenticated', driveSession: null })
    expect(exchangeDesktopWebSessionForDriveToken).not.toHaveBeenCalled()
  })
})
