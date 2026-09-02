// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
}))

import {
  AzureMeetingsApiError,
  AzureMeetingsDisabledError,
  completeTranscriptionUpload,
  fetchAzureMeetingsHealth,
  getAzureTranscriptionSession,
  listAzureTranscriptionSessions,
  requestTranscriptionUploadIntent,
  uploadFileToAzureBlob,
} from './azureMeetingsApi'

const BASE_URL = 'https://meetings-api.test.azure'

function enableAzure() {
  vi.stubEnv('VITE_TRANSCRIPTION_BACKEND', 'hybrid')
  vi.stubEnv('VITE_MEETINGS_API_BASE_URL', BASE_URL)
}

describe('azureMeetingsApi (lot 1)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'jwt-test-token' } },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('garde-fou backend supabase (défaut)', () => {
    it('refuse tout appel quand les flags sont absents (non-régression)', async () => {
      await expect(
        requestTranscriptionUploadIntent({
          file_name: 'a.mp3',
          content_type: 'audio/mpeg',
          size_bytes: 10,
          title: 'Réunion',
        })
      ).rejects.toBeInstanceOf(AzureMeetingsDisabledError)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('refuse quand le flag est actif mais sans base URL', async () => {
      vi.stubEnv('VITE_TRANSCRIPTION_BACKEND', 'azure')
      await expect(listAzureTranscriptionSessions()).rejects.toBeInstanceOf(
        AzureMeetingsDisabledError
      )
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('fetchAzureMeetingsHealth', () => {
    it('appelle GET /api/meetings/health sans Authorization', async () => {
      enableAzure()
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', version: '1.0.0' }),
      })

      const health = await fetchAzureMeetingsHealth()

      expect(health.status).toBe('ok')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe(`${BASE_URL}/api/meetings/health`)
      expect(init.method).toBe('GET')
      expect(init.headers.Authorization).toBeUndefined()
    })

    it('renvoie down (sans lever) sur erreur réseau', async () => {
      enableAzure()
      fetchMock.mockRejectedValueOnce(new TypeError('network error'))

      const health = await fetchAzureMeetingsHealth()
      expect(health.status).toBe('down')
    })

    it('renvoie down sur réponse HTTP non-ok', async () => {
      enableAzure()
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'maintenance' }),
      })

      const health = await fetchAzureMeetingsHealth()
      expect(health.status).toBe('down')
    })
  })

  describe('upload-intent / upload-complete', () => {
    it('poste l’intent avec le JWT Supabase en Bearer', async () => {
      enableAzure()
      const intentResponse = {
        session_id: 'sess-1',
        upload_url: `${BASE_URL}/blob/sas`,
        blob_container: 'gestion-meeting-audio',
        blob_name: 'sessions/sess-1/raw.mp3',
        expires_at: '2026-07-07T13:00:00Z',
      }
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => intentResponse })

      const result = await requestTranscriptionUploadIntent({
        file_name: 'réunion.mp3',
        content_type: 'audio/mpeg',
        size_bytes: 1024,
        title: 'Comité hebdo',
        language: 'fr-FR',
      })

      expect(result).toEqual(intentResponse)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe(`${BASE_URL}/api/transcriptions/upload-intent`)
      expect(init.method).toBe('POST')
      expect(init.headers.Authorization).toBe('Bearer jwt-test-token')
      expect(JSON.parse(init.body)).toMatchObject({
        file_name: 'réunion.mp3',
        title: 'Comité hebdo',
      })
    })

    it('confirme l’upload et renvoie le statut queued', async () => {
      enableAzure()
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'sess-1', status: 'queued' }),
      })

      const result = await completeTranscriptionUpload({ session_id: 'sess-1' })
      expect(result.status).toBe('queued')
      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe(`${BASE_URL}/api/transcriptions/upload-complete`)
    })

    it('propage AzureMeetingsApiError avec le message serveur', async () => {
      enableAzure()
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 413,
        json: async () => ({ error: 'Fichier trop volumineux' }),
      })

      await expect(completeTranscriptionUpload({ session_id: 'sess-1' })).rejects.toMatchObject({
        name: 'AzureMeetingsApiError',
        message: 'Fichier trop volumineux',
        status: 413,
      })
    })
  })

  describe('uploadFileToAzureBlob', () => {
    it('PUT BlockBlob sur l’URL SAS avec le bon content-type', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true })
      const file = new File(['audio'], 'a.mp3', { type: 'audio/mpeg' })

      await uploadFileToAzureBlob('https://blob.test/sas-url', file)

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://blob.test/sas-url')
      expect(init.method).toBe('PUT')
      expect(init.headers['x-ms-blob-type']).toBe('BlockBlob')
      expect(init.headers['Content-Type']).toBe('audio/mpeg')
    })

    it('lève AzureMeetingsApiError si le PUT échoue', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 403 })
      const file = new File(['x'], 'a.mp3', { type: 'audio/mpeg' })

      await expect(uploadFileToAzureBlob('https://blob.test/sas-url', file)).rejects.toBeInstanceOf(
        AzureMeetingsApiError
      )
    })
  })

  describe('lecture sessions / statut pipeline', () => {
    it('liste les sessions avec query params', async () => {
      enableAzure()
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 's1', status: 'processing' }], total: 1 }),
      })

      const page = await listAzureTranscriptionSessions({ status: 'processing', limit: 20 })
      expect(page.total).toBe(1)
      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe(`${BASE_URL}/api/transcriptions/sessions?status=processing&limit=20`)
    })

    it('récupère le détail d’une session (id encodé)', async () => {
      enableAzure()
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'sess 1', status: 'completed', segments: [] }),
      })

      const session = await getAzureTranscriptionSession('sess 1')
      expect(session.status).toBe('completed')
      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe(`${BASE_URL}/api/transcriptions/sessions/sess%201`)
    })
  })
})
