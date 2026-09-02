import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  desktopParentOrigin,
  installDesktopAuthResponder,
  isTrustedDesktopAuthRequest,
  isTrustedDesktopParentContext,
  notifyDesktopDriveAuthStatus,
  notifyDesktopDriveLogout,
  notifyDesktopShell,
  replyToDesktopAuthRequest,
} from './desktopBridge'

describe('desktopBridge', () => {
  afterEach(() => vi.restoreAllMocks())

  it('dérive strictement l’origine du shell depuis le referrer', () => {
    expect(desktopParentOrigin('tauri://localhost/app')).toBe('tauri://localhost')
    expect(desktopParentOrigin('tauri://evil.example/app')).toBeNull()
    expect(desktopParentOrigin('https://desktop.example/app')).toBe('https://desktop.example')
    expect(desktopParentOrigin('')).toBeNull()
  })

  it('ne reconnaît le contexte Desktop que pour un parent Tauri distinct', () => {
    const current = {} as Window
    expect(isTrustedDesktopParentContext(current, current, 'http://tauri.localhost/')).toBe(false)
    expect(isTrustedDesktopParentContext({} as Window, current, 'https://evil.example/frame')).toBe(
      false
    )
    expect(
      isTrustedDesktopParentContext({} as Window, current, 'http://tauri.localhost/frame')
    ).toBe(true)
  })

  it('ne diffuse jamais sans iframe/referrer exploitable', () => {
    expect(notifyDesktopShell({ module: 'mail', title: 'Titre', body: 'Corps' })).toBe(false)
  })

  it('envoie les notifications uniquement au parent Tauri exact', () => {
    const postMessage = vi.fn()
    const parent = { postMessage } as unknown as Window
    const payload = { module: 'mail' as const, title: 'Nouveau message', body: 'Contenu sensible' }

    expect(notifyDesktopShell(payload, parent, 'https://evil.example/app')).toBe(false)
    expect(postMessage).not.toHaveBeenCalled()

    expect(notifyDesktopShell(payload, parent, 'http://tauri.localhost/app')).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'gestion-desktop-native-notification', ...payload },
      'http://tauri.localhost'
    )
  })

  it('accepte une demande auth uniquement depuis le parent Tauri exact', () => {
    const parent = {} as Window
    expect(
      isTrustedDesktopAuthRequest(
        { origin: 'http://tauri.localhost', source: parent } as MessageEvent,
        parent
      )
    ).toBe(true)
    expect(
      isTrustedDesktopAuthRequest(
        { origin: 'https://evil.example', source: parent } as MessageEvent,
        parent
      )
    ).toBe(false)
    expect(
      isTrustedDesktopAuthRequest(
        { origin: 'http://tauri.localhost', source: {} } as MessageEvent,
        parent
      )
    ).toBe(false)
  })

  it('répond au shell exact avec le jeton Drive dédié et le nonce demandé', () => {
    const postMessage = vi.fn()
    const parent = { postMessage } as unknown as Window
    const event = {
      origin: 'http://tauri.localhost',
      source: parent,
      data: { type: 'gestion-desktop-drive-auth-request', nonce: 'nonce-1234567890' },
    } as unknown as MessageEvent

    expect(
      replyToDesktopAuthRequest(event, parent, {
        status: 'authenticated',
        driveSession: {
          accessToken: 'drive-scoped-token',
          refreshToken: 'drive-refresh-token-opaque',
          expiresAt: 4_000_000_000,
          userEmail: 'user@gsi.fr',
          displayName: 'OpenPulse User',
        },
      })
    ).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'gestion-desktop-drive-auth-state',
        nonce: 'nonce-1234567890',
        authStatus: 'authenticated',
        authenticated: true,
        driveAccessToken: 'drive-scoped-token',
        driveRefreshToken: 'drive-refresh-token-opaque',
        expiresAt: 4_000_000_000,
        userEmail: 'user@gsi.fr',
        displayName: 'OpenPulse User',
      },
      'http://tauri.localhost'
    )
  })

  it('répond sans secret quand la session Gestion est absente', () => {
    const postMessage = vi.fn()
    const parent = { postMessage } as unknown as Window
    const event = {
      origin: 'https://tauri.localhost',
      source: parent,
      data: { type: 'gestion-desktop-drive-auth-request', nonce: 'nonce-abcdefghij' },
    } as unknown as MessageEvent

    expect(
      replyToDesktopAuthRequest(event, parent, {
        status: 'unauthenticated',
        driveSession: null,
      })
    ).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'gestion-desktop-drive-auth-state',
        nonce: 'nonce-abcdefghij',
        authStatus: 'unauthenticated',
        authenticated: false,
      },
      'https://tauri.localhost'
    )
  })

  it('distingue l’état unauthenticated du logout utilisateur explicite', () => {
    const postMessage = vi.fn()
    const parent = { postMessage } as unknown as Window

    expect(notifyDesktopDriveAuthStatus('unauthenticated', parent, 'tauri://localhost/app')).toBe(
      true
    )
    expect(notifyDesktopDriveLogout(parent, 'tauri://localhost/app')).toBe(true)
    expect(postMessage).toHaveBeenNthCalledWith(
      1,
      { type: 'gestion-desktop-drive-auth-status', status: 'unauthenticated' },
      'tauri://localhost'
    )
    expect(postMessage).toHaveBeenNthCalledWith(
      2,
      { type: 'gestion-desktop-drive-auth-logout' },
      'tauri://localhost'
    )
    expect(notifyDesktopDriveLogout(parent, 'https://evil.example/app')).toBe(false)
  })

  it('distingue un auth encore en chargement d’un logout confirmé', () => {
    const postMessage = vi.fn()
    const parent = { postMessage } as unknown as Window
    const event = {
      origin: 'http://tauri.localhost',
      source: parent,
      data: { type: 'gestion-desktop-drive-auth-request', nonce: 'nonce-loading-1234' },
    } as unknown as MessageEvent

    expect(
      replyToDesktopAuthRequest(event, parent, { status: 'loading', driveSession: null })
    ).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'gestion-desktop-drive-auth-state',
        nonce: 'nonce-loading-1234',
        authStatus: 'loading',
        authenticated: false,
      },
      'http://tauri.localhost'
    )
  })

  it('corrèle une demande de MFA fraîche sans exposer de token provider', () => {
    const postMessage = vi.fn()
    const parent = { postMessage } as unknown as Window
    const event = {
      origin: 'http://tauri.localhost',
      source: parent,
      data: { type: 'gestion-desktop-drive-auth-request', nonce: 'nonce-mfa-fresh-1234' },
    } as MessageEvent

    expect(
      replyToDesktopAuthRequest(event, parent, {
        status: 'mfa-required',
        driveSession: null,
        handoffChallenge: 'server-handoff-challenge-opaque-long-enough',
      } as never)
    ).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'gestion-desktop-drive-auth-state',
        nonce: 'nonce-mfa-fresh-1234',
        authStatus: 'mfa-required',
        authenticated: false,
        handoffChallenge: 'server-handoff-challenge-opaque-long-enough',
      },
      'http://tauri.localhost'
    )
  })

  it('installe puis retire le responder de session desktop', () => {
    const postMessage = vi.fn()
    const parent = { postMessage } as unknown as Window
    const target = new EventTarget()
    const stop = installDesktopAuthResponder(
      () => ({
        status: 'authenticated',
        driveSession: {
          accessToken: 'drive-scoped-token',
          refreshToken: 'drive-refresh-token-opaque',
          expiresAt: 4_000_000_000,
          userEmail: 'user@gsi.fr',
          displayName: 'OpenPulse User',
        },
      }),
      target,
      parent
    )

    target.dispatchEvent(
      new MessageEvent('message', {
        origin: 'http://tauri.localhost',
        source: parent,
        data: { type: 'gestion-desktop-drive-auth-request', nonce: 'nonce-install-1234' },
      })
    )
    expect(postMessage).toHaveBeenCalledTimes(1)

    stop()
    target.dispatchEvent(
      new MessageEvent('message', {
        origin: 'http://tauri.localhost',
        source: parent,
        data: { type: 'gestion-desktop-drive-auth-request', nonce: 'nonce-install-5678' },
      })
    )
    expect(postMessage).toHaveBeenCalledTimes(1)
  })

  it('ne déclenche aucun échange avant validation origine/source/nonce', () => {
    const getSnapshot = vi.fn(() => ({ status: 'unauthenticated' as const, driveSession: null }))
    const parent = { postMessage: vi.fn() } as unknown as Window
    const target = new EventTarget()
    installDesktopAuthResponder(getSnapshot, target, parent)

    target.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example',
        source: {} as Window,
        data: { type: 'gestion-desktop-drive-auth-request', nonce: 'nonce-untrusted-1234' },
      })
    )

    expect(getSnapshot).not.toHaveBeenCalled()
  })

  it('résout le grant asynchrone uniquement après une requête nonce-corrélée', async () => {
    const postMessage = vi.fn()
    const parent = { postMessage } as unknown as Window
    const target = new EventTarget()
    installDesktopAuthResponder(
      async () => ({ status: 'unauthenticated', driveSession: null }),
      target,
      parent
    )

    target.dispatchEvent(
      new MessageEvent('message', {
        origin: 'http://tauri.localhost',
        source: parent,
        data: { type: 'gestion-desktop-drive-auth-request', nonce: 'nonce-async-1234' },
      })
    )
    expect(postMessage).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1))
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: 'nonce-async-1234', authenticated: false }),
      'http://tauri.localhost'
    )
  })
})
