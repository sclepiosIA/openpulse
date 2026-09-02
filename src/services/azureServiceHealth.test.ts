import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeAzureServiceUrl,
  probeAllAzureServices,
  probeAzureServiceHealth,
  resolveAzureServiceTargets,
  type AzureServiceTarget,
} from './azureServiceHealth'

const TARGET: AzureServiceTarget = {
  id: 'drive',
  label: 'Drive API',
  description: 'Drive test',
  baseUrl: 'https://drive.example.test',
  healthPath: '/healthz',
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('azureServiceHealth', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('normalise les URLs et rejette les valeurs vides', () => {
    expect(normalizeAzureServiceUrl(' https://api.example.com/// ')).toBe('https://api.example.com')
    expect(normalizeAzureServiceUrl('   ')).toBeNull()
    expect(normalizeAzureServiceUrl(undefined)).toBeNull()
  })

  it('résout les 4 services depuis les variables Vite publiques', () => {
    const targets = resolveAzureServiceTargets({
      VITE_DRIVE_API_URL: 'https://drive.test/',
      VITE_EMAIL_AZURE_API_URL: 'https://mail.test',
      VITE_PULSE_AZURE_API_URL: 'https://pulse.test//',
      VITE_MEETINGS_API_BASE_URL: '',
    })

    expect(targets.map((t) => t.id)).toEqual(['drive', 'mail', 'pulse', 'meetings'])
    expect(targets.map((t) => t.baseUrl)).toEqual([
      'https://drive.test',
      'https://mail.test',
      'https://pulse.test',
      null,
    ])
  })

  it('retourne unconfigured sans fetch quand une URL manque', async () => {
    const fetchImpl = vi.fn()
    const result = await probeAzureServiceHealth({ ...TARGET, baseUrl: null }, { fetchImpl })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.status).toBe('unconfigured')
    expect(result.message).toBe('URL non configurée')
    expect(result.httpStatus).toBeNull()
  })

  it('sonde /healthz et extrait version + dépendances', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        status: 'ok',
        version: '1.2.3',
        dependencies: { database: 'ok' },
      })
    )

    const result = await probeAzureServiceHealth(TARGET, { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://drive.example.test/healthz',
      expect.objectContaining({ method: 'GET' })
    )
    expect(result.status).toBe('ok')
    expect(result.httpStatus).toBe(200)
    expect(result.version).toBe('1.2.3')
    expect(result.dependencies).toEqual({ database: 'ok' })
    expect(result.message).toBeNull()
  })

  it('classe un payload degraded et accepte le champ services des Meetings', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        status: 'degraded',
        version: '0.2.0',
        services: { database: 'ok', blob_storage: 'down' },
      })
    )

    const result = await probeAzureServiceHealth(TARGET, { fetchImpl })

    expect(result.status).toBe('degraded')
    expect(result.dependencies).toEqual({ database: 'ok', blob_storage: 'down' })
  })

  it('normalise les erreurs HTTP et réseau', async () => {
    const httpFetch = vi.fn(async () => jsonResponse(503, { status: 'down' }))
    await expect(probeAzureServiceHealth(TARGET, { fetchImpl: httpFetch })).resolves.toMatchObject({
      status: 'down',
      httpStatus: 503,
      message: 'HTTP 503',
    })

    const networkFetch = vi.fn(async () => {
      throw new Error('offline')
    })
    await expect(
      probeAzureServiceHealth(TARGET, { fetchImpl: networkFetch })
    ).resolves.toMatchObject({
      status: 'down',
      httpStatus: null,
      message: 'offline',
    })
  })

  it('probe tous les services résolus', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { status: 'ok' }))
    const results = await probeAllAzureServices(
      {
        VITE_DRIVE_API_URL: 'https://drive.test',
        VITE_EMAIL_AZURE_API_URL: 'https://mail.test',
        VITE_PULSE_AZURE_API_URL: '',
        VITE_MEETINGS_API_BASE_URL: 'https://meetings.test',
      },
      { fetchImpl }
    )

    expect(results.map((r) => r.status)).toEqual(['ok', 'ok', 'unconfigured', 'ok'])
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})
