/**
 * Tests driveClient — résolution du feature flag VITE_DOCUMENTS_BACKEND
 * et normalisation des appels API Gestion Drive.
 */
import {
  getConfiguredDocumentsBackend,
  resolveDocumentsBackend,
  isAzureDriveEnabled,
  isLegacyDocumentsEnabled,
  getDriveApiBaseUrl,
  driveRequest,
  exchangeDesktopWebSessionForDriveToken,
  exchangeWebSessionForDriveToken,
} from './driveClient'
import { DriveApiError, isDocumentsBackend } from './types'

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(async () => ({
    data: { session: { access_token: 'jwt-token' } },
  })),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}))

function params(backend?: string) {
  const sp = new URLSearchParams()
  if (backend !== undefined) sp.set('backend', backend)
  return sp
}

describe('isDocumentsBackend', () => {
  it('accepte legacy, azure, hybrid et rejette le reste', () => {
    expect(isDocumentsBackend('legacy')).toBe(true)
    expect(isDocumentsBackend('azure')).toBe(true)
    expect(isDocumentsBackend('hybrid')).toBe(true)
    expect(isDocumentsBackend('supabase')).toBe(false)
    expect(isDocumentsBackend('')).toBe(false)
    expect(isDocumentsBackend(null)).toBe(false)
    expect(isDocumentsBackend(42)).toBe(false)
  })
})

describe('getConfiguredDocumentsBackend', () => {
  it('retourne legacy par défaut (flag absent)', () => {
    expect(getConfiguredDocumentsBackend({})).toBe('legacy')
  })

  it('retourne legacy pour une valeur inconnue (fail-safe)', () => {
    expect(getConfiguredDocumentsBackend({ VITE_DOCUMENTS_BACKEND: 'nextcloud' })).toBe('legacy')
  })

  it('normalise casse et espaces', () => {
    expect(getConfiguredDocumentsBackend({ VITE_DOCUMENTS_BACKEND: ' Azure ' })).toBe('azure')
    expect(getConfiguredDocumentsBackend({ VITE_DOCUMENTS_BACKEND: 'HYBRID' })).toBe('hybrid')
  })

  it('retourne les trois modes valides', () => {
    expect(getConfiguredDocumentsBackend({ VITE_DOCUMENTS_BACKEND: 'legacy' })).toBe('legacy')
    expect(getConfiguredDocumentsBackend({ VITE_DOCUMENTS_BACKEND: 'azure' })).toBe('azure')
    expect(getConfiguredDocumentsBackend({ VITE_DOCUMENTS_BACKEND: 'hybrid' })).toBe('hybrid')
  })
})

describe('resolveDocumentsBackend', () => {
  it('sans override URL → valeur du flag', () => {
    expect(resolveDocumentsBackend(params(), { VITE_DOCUMENTS_BACKEND: 'hybrid' })).toBe('hybrid')
    expect(resolveDocumentsBackend(null, { VITE_DOCUMENTS_BACKEND: 'azure' })).toBe('azure')
    expect(resolveDocumentsBackend(undefined, {})).toBe('legacy')
  })

  it('flag legacy : ?backend=azure est IGNORÉ (pas d’activation par URL)', () => {
    expect(resolveDocumentsBackend(params('azure'), { VITE_DOCUMENTS_BACKEND: 'legacy' })).toBe(
      'legacy'
    )
    expect(resolveDocumentsBackend(params('azure'), {})).toBe('legacy')
  })

  it('flag hybrid : ?backend= permet de forcer legacy ou azure', () => {
    expect(resolveDocumentsBackend(params('legacy'), { VITE_DOCUMENTS_BACKEND: 'hybrid' })).toBe(
      'legacy'
    )
    expect(resolveDocumentsBackend(params('azure'), { VITE_DOCUMENTS_BACKEND: 'hybrid' })).toBe(
      'azure'
    )
  })

  it('flag azure : ?backend=legacy reste une porte de sortie', () => {
    expect(resolveDocumentsBackend(params('legacy'), { VITE_DOCUMENTS_BACKEND: 'azure' })).toBe(
      'legacy'
    )
  })

  it('override invalide → flag conservé', () => {
    expect(resolveDocumentsBackend(params('ftp'), { VITE_DOCUMENTS_BACKEND: 'hybrid' })).toBe(
      'hybrid'
    )
  })

  it('override hybrid → flag conservé (hybrid n’est pas forçable par URL)', () => {
    expect(resolveDocumentsBackend(params('hybrid'), { VITE_DOCUMENTS_BACKEND: 'azure' })).toBe(
      'azure'
    )
  })
})

describe('helpers de rendu', () => {
  it('isAzureDriveEnabled : azure et hybrid uniquement', () => {
    expect(isAzureDriveEnabled('azure')).toBe(true)
    expect(isAzureDriveEnabled('hybrid')).toBe(true)
    expect(isAzureDriveEnabled('legacy')).toBe(false)
  })

  it('isLegacyDocumentsEnabled : legacy et hybrid uniquement', () => {
    expect(isLegacyDocumentsEnabled('legacy')).toBe(true)
    expect(isLegacyDocumentsEnabled('hybrid')).toBe(true)
    expect(isLegacyDocumentsEnabled('azure')).toBe(false)
  })
})

describe('getDriveApiBaseUrl', () => {
  it('null si non configurée ou vide', () => {
    expect(getDriveApiBaseUrl({})).toBeNull()
    expect(getDriveApiBaseUrl({ VITE_DRIVE_API_URL: '  ' })).toBeNull()
  })

  it('supprime les slashs finaux', () => {
    expect(getDriveApiBaseUrl({ VITE_DRIVE_API_URL: 'https://drive.gsi.fr//' })).toBe(
      'https://drive.gsi.fr'
    )
  })
})

describe('exchangeWebSessionForDriveToken', () => {
  it('garde le bearer fournisseur dans la PWA et retourne uniquement la session Drive', async () => {
    const providerToken = 'provider-token-never-forwarded-to-tauri'
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'drive-scoped-token-long-enough',
        refresh_token: 'drive-refresh-token-opaque-long-enough',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user_email: 'user@gsi.fr',
        display_name: 'OpenPulse User',
      }),
      init,
    })) as unknown as typeof fetch
    const session = await exchangeDesktopWebSessionForDriveToken(
      providerToken,
      {
        nonce: 'desktop-nonce-client-bound-1234',
        challenge: 'server-handoff-challenge-opaque-long-enough',
      },
      { VITE_DRIVE_API_URL: 'https://drive.test/' },
      fetchMock
    )
    expect(session.accessToken).toBe('drive-scoped-token-long-enough')
    expect(session.refreshToken).toBe('drive-refresh-token-opaque-long-enough')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://drive.test/api/drive/desktop/web/token',
      expect.objectContaining({
        headers: {
          Authorization: ['Bear' + 'er', providerToken].join(' '),
          'X-OpenPulse-Desktop-Handoff': '1',
          'X-OpenPulse-Desktop-Nonce': 'desktop-nonce-client-bound-1234',
          'X-OpenPulse-Desktop-Challenge': 'server-handoff-challenge-opaque-long-enough',
        },
      })
    )
    expect(JSON.stringify(session)).not.toContain(providerToken)
  })

  it('expose le challenge serveur sans le confondre avec une session Drive', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 428,
      json: async () => ({
        detail: {
          code: 'fresh_mfa_required',
          handoff_challenge: 'server-handoff-challenge-opaque-long-enough',
        },
      }),
    })) as unknown as typeof fetch

    const error = await exchangeDesktopWebSessionForDriveToken(
      'provider-token-never-forwarded-to-tauri',
      { nonce: 'desktop-nonce-client-bound-5678' },
      { VITE_DRIVE_API_URL: 'https://drive.test/' },
      fetchMock
    ).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({
      name: 'DriveFreshMfaRequiredError',
      handoffChallenge: 'server-handoff-challenge-opaque-long-enough',
    })
  })

  it('n’émet aucun refresh pour un appel web standard', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'drive-scoped-token-long-enough',
        refresh_token: null,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user_email: 'user@gsi.fr',
        display_name: 'OpenPulse User',
      }),
    })) as unknown as typeof fetch

    const session = await exchangeWebSessionForDriveToken(
      'provider-token-never-forwarded-to-tauri',
      { VITE_DRIVE_API_URL: 'https://drive.test/' },
      fetchMock
    )

    expect(session.refreshToken).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://drive.test/api/drive/desktop/web/token',
      expect.objectContaining({
        headers: { Authorization: 'Bearer provider-token-never-forwarded-to-tauri' },
      })
    )
  })
})

describe('driveRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs?.()
  })

  it('rejette en DriveApiError si VITE_DRIVE_API_URL absente', async () => {
    vi.stubEnv?.('VITE_DRIVE_API_URL', '')
    await expect(driveRequest('/api/drive/spaces')).rejects.toBeInstanceOf(DriveApiError)
  })

  it('appelle fetch avec Bearer token et propage le JSON', async () => {
    vi.stubEnv?.('VITE_DRIVE_API_URL', 'https://drive.test')
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ id: 's1' }],
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await driveRequest<Array<{ id: string }>>('/api/drive/spaces')

    expect(result).toEqual([{ id: 's1' }])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://drive.test/api/drive/spaces',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-token' }),
      })
    )
  })

  it('normalise HTTP non-2xx en DriveApiError avec status', async () => {
    vi.stubEnv?.('VITE_DRIVE_API_URL', 'https://drive.test')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }))
    )

    const error = await driveRequest('/api/drive/spaces').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DriveApiError)
    expect((error as DriveApiError).status).toBe(403)
    expect((error as DriveApiError).endpoint).toBe('/api/drive/spaces')
  })

  it('normalise les erreurs réseau en DriveApiError', async () => {
    vi.stubEnv?.('VITE_DRIVE_API_URL', 'https://drive.test')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline')))
    )

    const error = await driveRequest('/api/drive/spaces').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DriveApiError)
    expect((error as DriveApiError).message).toContain('offline')
  })

  it('fonctionne sans session (pas de header Authorization)', async () => {
    vi.stubEnv?.('VITE_DRIVE_API_URL', 'https://drive.test')
    getSessionMock.mockResolvedValueOnce({ data: { session: null } } as never)
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }))
    vi.stubGlobal('fetch', fetchMock)

    await driveRequest('/api/drive/spaces')

    const headers = (fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers
    expect(headers.Authorization).toBeUndefined()
  })
})
