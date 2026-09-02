// Tests du shell PWA plein écran : iframe Gestion sans surcouche visible,
// panneau Drive/Préférences piloté par le menu natif/tray, écran d'échec réseau.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import GestionPwaApp, {
  DRIVE_AUTH_RESPONSE_TIMEOUT_MS,
  FRAME_LOAD_TIMEOUT_MS,
  isTrustedPwaMessage,
  isValidDriveAuthState,
  isValidPwaAuthStatus,
  offlineCopy,
  postDriveAuthRequest,
  pwaTargetOrigin,
} from './GestionPwaApp'
import { useAppStore } from '../state/store'
import type { SyncStatus } from '../api/types'
import { publishUpdateUiState } from '../api/updaterClient'
import * as driveClientApi from '../api/driveClient'
import * as notificationsClientApi from '../api/notificationsClient'

beforeEach(() => {
  cleanup()
  useAppStore.setState({
    activeApp: 'drive',
    screen: 'login',
    panelOpen: false,
    session: null,
    config: null,
    spaces: [],
    selectedSpaceIds: [],
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function getFrame(): HTMLIFrameElement {
  return screen.getByTitle('Gestion') as HTMLIFrameElement
}

function driveAuthPayload(token = 'drive-access-token-long-enough') {
  return {
    driveAccessToken: token,
    driveRefreshToken: 'drive-refresh-token-opaque-long-enough',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    userEmail: 'session@gsi.fr',
    displayName: 'Session Gestion',
  }
}

function openPanel(app: 'drive' | 'preferences' | 'notifications') {
  act(() => {
    useAppStore.getState().setActiveApp(app)
    useAppStore.getState().setPanelOpen(true)
  })
}

describe('GestionPwaApp — PWA plein écran', () => {
  it('monte la PWA Gestion en iframe pleine fenêtre (racine du domaine)', () => {
    render(<GestionPwaApp />)
    const frame = getFrame()
    expect(frame.tagName).toBe('IFRAME')
    expect(frame.getAttribute('src')).toMatch(/^https:\/\/.+\/$/)
    expect(frame.className).toContain('pwa-root-frame')
    expect(frame.getAttribute('allow')).not.toContain('clipboard-read')
  })

  it("affiche l'état de chargement tant que l'iframe n'a pas émis load", () => {
    render(<GestionPwaApp />)
    expect(screen.getByRole('status')).toBeTruthy()
    fireEvent.load(getFrame())
    expect(screen.queryByRole('status')).toBeNull()
  })

  it("n'affiche aucune surcouche native permanente", () => {
    const { container } = render(<GestionPwaApp />)
    expect(container.querySelector('.sidebar')).toBeNull()
    expect(container.querySelector('.shell')).toBeNull()
    expect(container.querySelector('.pwa-root-overlay')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Recharger' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Drive' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Préférences' })).toBeNull()
  })

  it('reste fail-closed si les préférences natives sont illisibles au démarrage', async () => {
    vi.spyOn(notificationsClientApi, 'getPreferences').mockRejectedValue(
      new Error('préférences corrompues')
    )
    render(<GestionPwaApp />)
    const frame = getFrame()
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')

    fireEvent.load(frame)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const authRequests = postMessage.mock.calls.filter(
      ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
    )
    expect(authRequests).toHaveLength(0)
  })

  it('ne lance qu’un seul challenge quand le statut PWA et load arrivent ensemble', async () => {
    const preferences = await notificationsClientApi.getPreferences()
    vi.spyOn(notificationsClientApi, 'getPreferences').mockResolvedValue({
      ...preferences,
      drive_auto_connect: true,
    })
    render(<GestionPwaApp />)
    const frame = getFrame()
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: pwaTargetOrigin(frame.src),
          source: frame.contentWindow,
          data: { type: 'gestion-desktop-drive-auth-status', status: 'authenticated' },
        })
      )
      fireEvent.load(frame)
    })

    await waitFor(() =>
      expect(
        postMessage.mock.calls.filter(
          ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
        )
      ).toHaveLength(1)
    )
  })

  it('expire une demande orpheline, la rejoue une fois puis libère le handoff', async () => {
    vi.useFakeTimers()
    const preferences = await notificationsClientApi.getPreferences()
    vi.spyOn(notificationsClientApi, 'getPreferences').mockResolvedValue({
      ...preferences,
      drive_auto_connect: true,
    })
    render(<GestionPwaApp />)
    const frame = getFrame()
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    fireEvent.load(frame)
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: pwaTargetOrigin(frame.src),
        source: frame.contentWindow,
        data: { type: 'gestion-desktop-drive-auth-status', status: 'authenticated' },
      })
    )
    const authRequests = () =>
      postMessage.mock.calls.filter(
        ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
      )
    expect(authRequests()).toHaveLength(1)
    const firstNonce = (authRequests()[0][0] as { nonce: string }).nonce

    await act(async () => {
      vi.advanceTimersByTime(DRIVE_AUTH_RESPONSE_TIMEOUT_MS + 1)
    })
    expect(authRequests()).toHaveLength(2)
    expect((authRequests()[1][0] as { nonce: string }).nonce).not.toBe(firstNonce)

    await act(async () => {
      vi.advanceTimersByTime(DRIVE_AUTH_RESPONSE_TIMEOUT_MS + 1)
    })
    expect(authRequests()).toHaveLength(2)
  })

  it('ne réappaire pas un Desktop qui possède déjà une session native persistante', async () => {
    const preferences = await notificationsClientApi.getPreferences()
    vi.spyOn(notificationsClientApi, 'getPreferences').mockResolvedValue({
      ...preferences,
      drive_auto_connect: true,
    })
    act(() => {
      useAppStore.getState().setSession({
        user_email: 'persisted@gsi.fr',
        display_name: 'Session persistée',
        device_registered: true,
      })
    })
    render(<GestionPwaApp />)
    const frame = getFrame()
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')

    fireEvent.load(frame)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      postMessage.mock.calls.filter(
        ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
      )
    ).toHaveLength(0)
  })

  it('connecte Drive automatiquement depuis la session Gestion vérifiée après opt-in', async () => {
    const preferences = await notificationsClientApi.getPreferences()
    vi.spyOn(notificationsClientApi, 'getPreferences').mockResolvedValue({
      ...preferences,
      drive_auto_connect: true,
    })
    render(<GestionPwaApp />)
    const frame = getFrame()
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')

    fireEvent.load(frame)
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'gestion-desktop-drive-auth-request' }),
        pwaTargetOrigin(frame.src)
      )
    })
    const request = postMessage.mock.calls.find(
      ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
    )?.[0] as { nonce: string }

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: pwaTargetOrigin(frame.src),
        source: frame.contentWindow,
        data: {
          type: 'gestion-desktop-drive-auth-state',
          nonce: request.nonce,
          authenticated: true,
          ...driveAuthPayload(),
        },
      })
    )

    await waitFor(() => {
      expect(useAppStore.getState().session?.display_name).toBe('Session Gestion')
    })
  })

  it('demande un TOTP et reprend exactement le challenge serveur corrélé', async () => {
    const timeoutSpy = vi.spyOn(window, 'setTimeout')
    const preferences = await notificationsClientApi.getPreferences()
    vi.spyOn(notificationsClientApi, 'getPreferences').mockResolvedValue({
      ...preferences,
      drive_auto_connect: true,
    })
    render(<GestionPwaApp />)
    const frame = getFrame()
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
    fireEvent.load(frame)
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'gestion-desktop-drive-auth-request' }),
        pwaTargetOrigin(frame.src)
      )
    )
    const request = postMessage.mock.calls.find(
      ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
    )?.[0] as { nonce: string }
    const challenge = 'server-handoff-challenge-opaque-long-enough'

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: pwaTargetOrigin(frame.src),
        source: frame.contentWindow,
        data: {
          type: 'gestion-desktop-drive-auth-state',
          nonce: request.nonce,
          authStatus: 'mfa-required',
          authenticated: false,
          handoffChallenge: challenge,
        },
      })
    )

    const input = await screen.findByLabelText('Code à 6 chiffres')
    expect(timeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 1_500)
    expect(timeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 5_000)
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider et connecter' }))

    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        {
          type: 'gestion-desktop-drive-auth-request',
          nonce: request.nonce,
          mfaCode: '123456',
          handoffChallenge: challenge,
        },
        pwaTargetOrigin(frame.src)
      )
    )
    timeoutSpy.mockRestore()
  })

  it('n’envoie qu’une seule rédemption MFA quand le formulaire est soumis deux fois dans le même rendu', async () => {
    const preferences = await notificationsClientApi.getPreferences()
    vi.spyOn(notificationsClientApi, 'getPreferences').mockResolvedValue({
      ...preferences,
      drive_auto_connect: true,
    })
    render(<GestionPwaApp />)
    const frame = getFrame()
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
    fireEvent.load(frame)
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'gestion-desktop-drive-auth-request' }),
        pwaTargetOrigin(frame.src)
      )
    )
    const request = postMessage.mock.calls.find(
      ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
    )?.[0] as { nonce: string }
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: pwaTargetOrigin(frame.src),
        source: frame.contentWindow,
        data: {
          type: 'gestion-desktop-drive-auth-state',
          nonce: request.nonce,
          authStatus: 'mfa-required',
          authenticated: false,
          handoffChallenge: 'server-handoff-challenge-opaque-long-enough',
        },
      })
    )

    const input = await screen.findByLabelText('Code à 6 chiffres')
    fireEvent.change(input, { target: { value: '123456' } })
    const form = input.closest('form')
    expect(form).not.toBeNull()
    fireEvent.submit(form!)
    fireEvent.submit(form!)

    const redemptions = postMessage.mock.calls.filter(
      ([payload]) => (payload as { mfaCode?: string }).mfaCode === '123456'
    )
    expect(redemptions).toHaveLength(1)
  })

  it('ignore un snapshot mfa-required dupliqué pendant la rédemption en cours', async () => {
    const preferences = await notificationsClientApi.getPreferences()
    vi.spyOn(notificationsClientApi, 'getPreferences').mockResolvedValue({
      ...preferences,
      drive_auto_connect: true,
    })
    render(<GestionPwaApp />)
    const frame = getFrame()
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
    fireEvent.load(frame)
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'gestion-desktop-drive-auth-request' }),
        pwaTargetOrigin(frame.src)
      )
    )
    const request = postMessage.mock.calls.find(
      ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
    )?.[0] as { nonce: string }
    const challenge = 'server-handoff-challenge-opaque-long-enough'
    const mfaRequired = new MessageEvent('message', {
      origin: pwaTargetOrigin(frame.src),
      source: frame.contentWindow,
      data: {
        type: 'gestion-desktop-drive-auth-state',
        nonce: request.nonce,
        authStatus: 'mfa-required',
        authenticated: false,
        handoffChallenge: challenge,
      },
    })
    window.dispatchEvent(mfaRequired)

    const input = await screen.findByLabelText('Code à 6 chiffres')
    const form = input.closest('form')
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.submit(form!)
    window.dispatchEvent(mfaRequired)
    await act(async () => Promise.resolve())
    fireEvent.change(input, { target: { value: '654321' } })
    fireEvent.submit(form!)

    expect(
      postMessage.mock.calls.filter(
        ([payload]) => typeof (payload as { mfaCode?: unknown }).mfaCode === 'string'
      )
    ).toHaveLength(1)
  })

  it('réactive le formulaire quand le statut unauthenticated précède le snapshot corrélé', async () => {
    const preferences = await notificationsClientApi.getPreferences()
    vi.spyOn(notificationsClientApi, 'getPreferences').mockResolvedValue({
      ...preferences,
      drive_auto_connect: true,
    })
    render(<GestionPwaApp />)
    const frame = getFrame()
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
    fireEvent.load(frame)
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'gestion-desktop-drive-auth-request' }),
        pwaTargetOrigin(frame.src)
      )
    )
    const request = postMessage.mock.calls.find(
      ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
    )?.[0] as { nonce: string }
    const message = (data: object) =>
      new MessageEvent('message', {
        origin: pwaTargetOrigin(frame.src),
        source: frame.contentWindow,
        data,
      })
    window.dispatchEvent(
      message({
        type: 'gestion-desktop-drive-auth-state',
        nonce: request.nonce,
        authStatus: 'mfa-required',
        authenticated: false,
        handoffChallenge: 'server-handoff-challenge-opaque-long-enough',
      })
    )
    const input = await screen.findByLabelText('Code à 6 chiffres')
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.submit(input.closest('form')!)
    expect(
      (screen.getByRole('button', { name: 'Validation…' }) as HTMLButtonElement).disabled
    ).toBe(true)

    window.dispatchEvent(
      message({ type: 'gestion-desktop-drive-auth-status', status: 'unauthenticated' })
    )
    window.dispatchEvent(
      message({
        type: 'gestion-desktop-drive-auth-state',
        nonce: request.nonce,
        authStatus: 'unauthenticated',
        authenticated: false,
      })
    )
    await act(async () => Promise.resolve())

    expect(
      (screen.getByRole('button', { name: 'Valider et connecter' }) as HTMLButtonElement).disabled
    ).toBe(false)
    expect(screen.getByRole('alert').textContent).toMatch(/Code invalide|challenge expiré/)
  })
})

describe('GestionPwaApp — retour OTA visible', () => {
  it('affiche une confirmation explicite après redémarrage sur la nouvelle version', () => {
    render(<GestionPwaApp />)
    act(() => {
      publishUpdateUiState({
        stage: 'completed',
        version: '0.1.8',
        completedAt: new Date().toISOString(),
        message: 'Gestion Desktop a été mise à jour avec succès vers la version 0.1.8.',
      })
    })
    expect(screen.getByText('Mise à jour terminée')).toBeTruthy()
    expect(screen.getByText(/succès vers la version 0\.1\.8/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Masquer l’état de mise à jour' })).toBeTruthy()
  })

  it('affiche la progression de téléchargement', () => {
    render(<GestionPwaApp />)
    act(() => {
      publishUpdateUiState({
        stage: 'downloading',
        version: '0.1.8',
        percent: 64,
        message: 'Téléchargement de la mise à jour 0.1.8 : 64 %',
      })
    })
    expect(screen.getByText(/64 %/)).toBeTruthy()
    expect(screen.getByRole('progressbar')).toHaveProperty('value', 64)
  })
})

describe('GestionPwaApp — frontière postMessage sécurisée', () => {
  const origin = 'https://gestion.example.test'
  const source = {} as Window
  const frame = { contentWindow: source } as HTMLIFrameElement

  it('accepte uniquement un message provenant de l’iframe PWA et de son origine exacte', () => {
    expect(isTrustedPwaMessage({ origin, source } as MessageEvent, frame, origin)).toBe(true)
    expect(
      isTrustedPwaMessage({ origin: 'https://evil.example', source } as MessageEvent, frame, origin)
    ).toBe(false)
    expect(isTrustedPwaMessage({ origin, source: {} } as MessageEvent, frame, origin)).toBe(false)
  })

  it('dérive une origine cible stricte depuis l’URL PWA', () => {
    expect(pwaTargetOrigin('https://gestion.example.test/emails?desktopWindow=1')).toBe(origin)
  })

  it('valide strictement le nonce et le jeton de la réponse auth PWA', () => {
    expect(
      isValidDriveAuthState(
        {
          type: 'gestion-desktop-drive-auth-state',
          nonce: 'nonce-exact-1234',
          authenticated: true,
          ...driveAuthPayload(),
        },
        new Set(['nonce-exact-1234'])
      )
    ).toBe(true)
    expect(
      isValidDriveAuthState(
        {
          type: 'gestion-desktop-drive-auth-state',
          nonce: 'nonce-exact-1234',
          authenticated: true,
          driveAccessToken: 'drive-access-token-long-enough',
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          userEmail: 'session@gsi.fr',
          displayName: 'Session Gestion',
        },
        new Set(['nonce-exact-1234'])
      )
    ).toBe(false)
    expect(
      isValidDriveAuthState(
        {
          type: 'gestion-desktop-drive-auth-state',
          nonce: 'nonce-inconnu-999',
          authenticated: true,
          ...driveAuthPayload(),
        },
        new Set(['nonce-exact-1234'])
      )
    ).toBe(false)
    expect(
      isValidDriveAuthState(
        {
          type: 'gestion-desktop-drive-auth-state',
          nonce: 'nonce-exact-1234',
          authenticated: true,
          accessToken: 'provider-token-must-never-cross',
        },
        new Set(['nonce-exact-1234'])
      )
    ).toBe(false)
  })

  it('accepte une demande MFA fraîche uniquement avec un challenge serveur corrélé', () => {
    expect(
      isValidDriveAuthState(
        {
          type: 'gestion-desktop-drive-auth-state',
          nonce: 'nonce-mfa-required-1234',
          authStatus: 'mfa-required',
          authenticated: false,
          handoffChallenge: 'server-handoff-challenge-opaque-long-enough',
        },
        new Set(['nonce-mfa-required-1234'])
      )
    ).toBe(true)
    expect(
      isValidDriveAuthState(
        {
          type: 'gestion-desktop-drive-auth-state',
          nonce: 'nonce-mfa-required-1234',
          authStatus: 'mfa-required',
          authenticated: false,
        },
        new Set(['nonce-mfa-required-1234'])
      )
    ).toBe(false)
  })

  it('valide uniquement les états de cycle auth PWA explicites', () => {
    expect(
      isValidPwaAuthStatus({
        type: 'gestion-desktop-drive-auth-status',
        status: 'unauthenticated',
      })
    ).toBe(true)
    expect(
      isValidPwaAuthStatus({ type: 'gestion-desktop-drive-auth-status', status: 'unknown' })
    ).toBe(false)
  })

  it('préserve la session native si la PWA est seulement indisponible ou non authentifiée', async () => {
    render(<GestionPwaApp />)
    const mountedFrame = getFrame()
    act(() => {
      useAppStore.getState().setSession({
        user_email: 'offline@example.test',
        display_name: 'Session hors ligne',
        device_registered: true,
      })
      useAppStore.getState().setScreen('status')
    })
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: pwaTargetOrigin(mountedFrame.src),
        source: mountedFrame.contentWindow,
        data: { type: 'gestion-desktop-drive-auth-status', status: 'unauthenticated' },
      })
    )
    await act(async () => Promise.resolve())
    expect(useAppStore.getState().session?.user_email).toBe('offline@example.test')
    expect(useAppStore.getState().screen).toBe('status')
  })

  it('purge le Drive sur logout PWA explicite et ignore une réponse auth retardée', async () => {
    const preferences = await notificationsClientApi.getPreferences()
    vi.spyOn(notificationsClientApi, 'getPreferences').mockResolvedValue({
      ...preferences,
      drive_auto_connect: true,
    })
    render(<GestionPwaApp />)
    const mountedFrame = getFrame()
    const postMessage = vi.spyOn(mountedFrame.contentWindow!, 'postMessage')
    fireEvent.load(mountedFrame)
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'gestion-desktop-drive-auth-request' }),
        pwaTargetOrigin(mountedFrame.src)
      )
    })
    const request = postMessage.mock.calls.find(
      ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
    )?.[0] as { nonce: string }

    act(() => {
      useAppStore.getState().setSession({
        user_email: 'ancien@example.test',
        display_name: 'Ancien utilisateur',
        device_registered: true,
      })
      useAppStore.getState().setScreen('status')
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: pwaTargetOrigin(mountedFrame.src),
          source: mountedFrame.contentWindow,
          data: { type: 'gestion-desktop-drive-auth-logout' },
        })
      )
    })
    await waitFor(() => {
      expect(useAppStore.getState().session).toBeNull()
      expect(useAppStore.getState().screen).toBe('login')
    })

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: pwaTargetOrigin(mountedFrame.src),
        source: mountedFrame.contentWindow,
        data: {
          type: 'gestion-desktop-drive-auth-state',
          nonce: request.nonce,
          authStatus: 'authenticated',
          authenticated: true,
          ...driveAuthPayload('old-drive-access-token-long-enough'),
        },
      })
    )
    await act(async () => Promise.resolve())
    expect(useAppStore.getState().session).toBeNull()
  })

  it('ne laisse pas un statut authenticated retardé annuler le logout explicite', async () => {
    render(<GestionPwaApp />)
    const mountedFrame = getFrame()
    const postMessage = vi.spyOn(mountedFrame.contentWindow!, 'postMessage')

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: pwaTargetOrigin(mountedFrame.src),
          source: mountedFrame.contentWindow,
          data: { type: 'gestion-desktop-drive-auth-logout' },
        })
      )
    })
    await act(async () => Promise.resolve())
    const requestsAfterLogout = postMessage.mock.calls.filter(
      ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
    ).length

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: pwaTargetOrigin(mountedFrame.src),
          source: mountedFrame.contentWindow,
          data: { type: 'gestion-desktop-drive-auth-status', status: 'authenticated' },
        })
      )
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const requestsAfterDelayedStatus = postMessage.mock.calls.filter(
      ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
    ).length
    expect(requestsAfterDelayedStatus).toBe(requestsAfterLogout)
    expect(useAppStore.getState().session).toBeNull()
  })

  it('reconnecte uniquement après l’action utilisateur et une réponse corrélée', async () => {
    render(<GestionPwaApp />)
    const mountedFrame = getFrame()
    const postMessage = vi.spyOn(mountedFrame.contentWindow!, 'postMessage')
    openPanel('drive')

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: pwaTargetOrigin(mountedFrame.src),
          source: mountedFrame.contentWindow,
          data: { type: 'gestion-desktop-drive-auth-logout' },
        })
      )
    })
    await act(async () => Promise.resolve())

    fireEvent.click(screen.getByRole('button', { name: 'Utiliser la session Gestion' }))
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'gestion-desktop-drive-auth-request' }),
        pwaTargetOrigin(mountedFrame.src)
      )
    })
    const requests = postMessage.mock.calls
      .map(([payload]) => payload as { type?: string; nonce?: string })
      .filter((payload) => payload.type === 'gestion-desktop-drive-auth-request')
    const request = requests.at(-1)
    expect(request?.nonce).toBeTruthy()

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: pwaTargetOrigin(mountedFrame.src),
          source: mountedFrame.contentWindow,
          data: {
            type: 'gestion-desktop-drive-auth-state',
            nonce: request?.nonce,
            authenticated: true,
            ...driveAuthPayload('fresh-drive-access-token-long-enough'),
          },
        })
      )
    })

    await waitFor(() => {
      expect(useAppStore.getState().session?.user_email).toBe('session@gsi.fr')
    })
  })

  it('rétablit le tombstone si la reconnexion ne peut pas joindre la PWA', async () => {
    const setAutoConnect = vi
      .spyOn(driveClientApi, 'setDriveAutoConnect')
      .mockResolvedValue(undefined)
    render(<GestionPwaApp />)
    const frame = getFrame()
    Object.defineProperty(frame, 'contentWindow', { value: null, configurable: true })
    openPanel('drive')

    fireEvent.click(screen.getByRole('button', { name: 'Utiliser la session Gestion' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/pas encore disponible/i)
    })
    expect(setAutoConnect.mock.calls).toEqual([[true], [false]])
  })

  it('adresse la demande de session uniquement à l’origine PWA exacte', () => {
    const postMessage = vi.fn()
    const frame = { contentWindow: { postMessage } } as unknown as HTMLIFrameElement
    expect(postDriveAuthRequest(frame, origin, 'nonce-request-123')).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'gestion-desktop-drive-auth-request', nonce: 'nonce-request-123' },
      origin
    )
  })

  it('renvoie le code MFA uniquement au challenge serveur et au nonce d’origine', () => {
    const postMessage = vi.fn()
    const frame = { contentWindow: { postMessage } } as unknown as HTMLIFrameElement
    expect(
      postDriveAuthRequest(frame, origin, 'nonce-request-mfa-123', {
        mfaCode: '123456',
        handoffChallenge: 'server-handoff-challenge-opaque-long-enough',
      })
    ).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'gestion-desktop-drive-auth-request',
        nonce: 'nonce-request-mfa-123',
        mfaCode: '123456',
        handoffChallenge: 'server-handoff-challenge-opaque-long-enough',
      },
      origin
    )
  })
})

describe('GestionPwaApp — panneau natif (Drive / Préférences)', () => {
  it("ouvre le panneau Préférences via l'état piloté par le menu natif", () => {
    render(<GestionPwaApp />)
    openPanel('preferences')
    expect(useAppStore.getState().panelOpen).toBe(true)
    expect(screen.getByRole('dialog', { name: 'Préférences' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Préférences' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Réinitialiser session PWA' })).toBeTruthy()
  })

  it('ouvre le panneau Drive (onboarding : écran de connexion)', () => {
    render(<GestionPwaApp />)
    openPanel('drive')
    expect(screen.getByRole('dialog', { name: 'Drive' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeTruthy()
  })

  it("ouvre le centre de notifications via l'état piloté par le menu natif/tray", async () => {
    render(<GestionPwaApp />)
    openPanel('notifications')
    expect(useAppStore.getState().panelOpen).toBe(true)
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('Aucune notification.')).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: 'Tout marquer comme lu' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Vider' })).toBeTruthy()
  })

  it('ferme le panneau via le bouton ✕', () => {
    render(<GestionPwaApp />)
    openPanel('drive')
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau' }))
    expect(useAppStore.getState().panelOpen).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ferme le panneau au clic sur le backdrop', () => {
    render(<GestionPwaApp />)
    openPanel('preferences')
    fireEvent.click(screen.getByTestId('pwa-panel-backdrop'))
    expect(useAppStore.getState().panelOpen).toBe(false)
  })

  it('ferme le panneau à la touche Échap', () => {
    render(<GestionPwaApp />)
    openPanel('preferences')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(useAppStore.getState().panelOpen).toBe(false)
  })

  it("préserve l'étape Drive entre deux ouvertures du panneau", () => {
    render(<GestionPwaApp />)
    openPanel('drive')
    act(() => {
      useAppStore.getState().setScreen('status')
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    openPanel('drive')
    expect(useAppStore.getState().screen).toBe('status')
    expect(screen.getByRole('heading', { name: 'Synchronisation' })).toBeTruthy()
  })

  it("expose le diagnostic sync et l'export de logs dans le panneau Drive", async () => {
    render(<GestionPwaApp />)
    openPanel('drive')
    act(() => {
      useAppStore.getState().setScreen('status')
    })

    expect(screen.getByRole('heading', { name: 'Diagnostic sync' })).toBeTruthy()
    expect(screen.getByText(/Aucun événement récent/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Synchroniser maintenant' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Derniers événements de synchronisation')).toBeTruthy()
      expect(screen.getByText(/Cycle de réception mock terminé/)).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Exporter le journal' }))
    await waitFor(() => {
      expect(screen.getByText(/journal-mock:\/\/gestion-drive-sync\.log/)).toBeTruthy()
    })
  })
})

describe('GestionPwaApp — échec de chargement', () => {
  it("bascule sur l'écran d'échec si la PWA ne répond pas à temps", async () => {
    vi.useFakeTimers()
    render(<GestionPwaApp />)
    await act(async () => {
      vi.advanceTimersByTime(FRAME_LOAD_TIMEOUT_MS + 1)
    })
    expect(screen.getByRole('heading', { name: "Impossible d'afficher Gestion" })).toBeTruthy()
    expect(screen.getByText(/Drive local reste consultable/)).toBeTruthy()
    expect(screen.getByLabelText('État Drive hors ligne')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Diagnostic Drive' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ouvrir dans le navigateur' })).toBeTruthy()
    expect(screen.getByTitle('Gestion')).toBeTruthy()
  })

  it('ouvre le diagnostic Drive depuis l’écran hors ligne', async () => {
    vi.useFakeTimers()
    render(<GestionPwaApp />)
    await act(async () => {
      vi.advanceTimersByTime(FRAME_LOAD_TIMEOUT_MS + 1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Diagnostic Drive' }))

    expect(useAppStore.getState().panelOpen).toBe(true)
    expect(screen.getByRole('dialog', { name: 'Drive' })).toBeTruthy()
  })

  it('Réessayer relance le chargement (nouvelle iframe)', () => {
    vi.useFakeTimers()
    render(<GestionPwaApp />)
    act(() => {
      vi.advanceTimersByTime(FRAME_LOAD_TIMEOUT_MS + 1)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(screen.getByTitle('Gestion')).toBeTruthy()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it("ne bascule pas en échec si l'iframe a chargé avant le délai", () => {
    vi.useFakeTimers()
    render(<GestionPwaApp />)
    fireEvent.load(getFrame())
    act(() => {
      vi.advanceTimersByTime(FRAME_LOAD_TIMEOUT_MS + 1)
    })
    expect(screen.queryByRole('heading', { name: "Impossible d'afficher Gestion" })).toBeNull()
    expect(screen.getByTitle('Gestion')).toBeTruthy()
  })
})

describe('offlineCopy — message hors ligne selon le statut Drive', () => {
  function status(partial: Partial<SyncStatus>): SyncStatus {
    return {
      state: 'idle',
      pending_uploads: 0,
      pending_downloads: 0,
      conflicts: 0,
      errors: 0,
      last_sync_at: null,
      ...partial,
    }
  }

  it('sans statut : message générique + diagnostic disponible', () => {
    expect(offlineCopy(null)).toMatch(/diagnostic Drive local reste disponible/)
  })

  it('Drive hors ligne : reprise annoncée au retour réseau', () => {
    expect(offlineCopy(status({ state: 'offline' }))).toMatch(/hors ligne/)
    expect(offlineCopy(status({ state: 'offline' }))).toMatch(/reprises au retour réseau/)
  })

  it('queue en attente : compte les envois et réceptions', () => {
    const copy = offlineCopy(status({ pending_uploads: 3, pending_downloads: 1 }))
    expect(copy).toMatch(/3 envoi\(s\)/)
    expect(copy).toMatch(/1 réception\(s\)/)
  })

  it('conflits/erreurs : invite à les traiter', () => {
    const copy = offlineCopy(status({ conflicts: 2, errors: 1 }))
    expect(copy).toMatch(/2 conflit\(s\)/)
    expect(copy).toMatch(/1 erreur\(s\)/)
  })

  it('Drive sain : message rassurant', () => {
    expect(offlineCopy(status({}))).toMatch(/Drive local reste consultable/)
  })
})
