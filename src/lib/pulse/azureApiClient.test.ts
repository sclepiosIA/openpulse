import { describe, it, expect, vi } from 'vitest'
import {
  PulseAzureApiClient,
  PulseAzureApiError,
  PulseAzureNotConfiguredError,
} from './azureApiClient'
import { resolvePulseAzureConfig } from './azureBackend'

function makeConfig(env: Record<string, string>) {
  return resolvePulseAzureConfig(env)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('PulseAzureApiClient — garde de configuration', () => {
  it('mode supabase : rejette sans toucher au réseau', async () => {
    const fetchFn = vi.fn()
    const client = new PulseAzureApiClient({
      config: makeConfig({}),
      fetchFn,
    })

    expect(client.isEnabled).toBe(false)
    await expect(client.listConversations()).rejects.toBeInstanceOf(PulseAzureNotConfiguredError)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('mode azure sans URL API : rejette sans réseau', async () => {
    const fetchFn = vi.fn()
    const client = new PulseAzureApiClient({
      config: makeConfig({ VITE_PULSE_BACKEND: 'azure' }),
      fetchFn,
    })

    expect(client.isEnabled).toBe(false)
    await expect(client.health()).rejects.toBeInstanceOf(PulseAzureNotConfiguredError)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('PulseAzureApiClient — requêtes', () => {
  const azureEnv = {
    VITE_PULSE_BACKEND: 'azure',
    VITE_PULSE_AZURE_API_URL: 'https://pulse-api.example.com',
  }

  it('GET conversations sur la bonne URL avec bearer token', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse([{ id: 'c1' }]))
    const client = new PulseAzureApiClient({
      config: makeConfig(azureEnv),
      fetchFn,
      getAccessToken: async () => 'jwt-123',
    })

    const result = await client.listConversations()

    expect(result).toEqual([{ id: 'c1' }])
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://pulse-api.example.com/api/pulse/conversations')
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBe('Bearer jwt-123')
  })

  it('POST message : body JSON + content-type', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ id: 'm1' }))
    const client = new PulseAzureApiClient({ config: makeConfig(azureEnv), fetchFn })

    await client.sendMessage('c1', { body: 'Bonjour **Pulse**' })

    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://pulse-api.example.com/api/pulse/conversations/c1/messages')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ body: 'Bonjour **Pulse**' })
  })

  it('search : encode les query params', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse([]))
    const client = new PulseAzureApiClient({ config: makeConfig(azureEnv), fetchFn })

    await client.search({ q: 'audit RGPD', limit: 10 })

    const [url] = fetchFn.mock.calls[0]
    expect(url).toBe('https://pulse-api.example.com/api/pulse/search?q=audit+RGPD&limit=10')
  })

  it('erreur HTTP : lève PulseAzureApiError avec status et body', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ error: 'forbidden' }, 403))
    const client = new PulseAzureApiClient({ config: makeConfig(azureEnv), fetchFn })

    const promise = client.listConversations()
    await expect(promise).rejects.toBeInstanceOf(PulseAzureApiError)
    await promise.catch((err: PulseAzureApiError) => {
      expect(err.status).toBe(403)
      expect(err.body).toEqual({ error: 'forbidden' })
    })
  })

  it('DELETE 204 : résout sans corps', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const client = new PulseAzureApiClient({ config: makeConfig(azureEnv), fetchFn })

    await expect(client.deleteMessage('m1')).resolves.toBeUndefined()
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://pulse-api.example.com/api/pulse/messages/m1')
    expect(init.method).toBe('DELETE')
  })

  it('healthz : GET /healthz (hors préfixe /api/pulse)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }))
    const client = new PulseAzureApiClient({ config: makeConfig(azureEnv), fetchFn })

    const health = await client.health()

    expect(health.status).toBe('ok')
    expect(fetchFn.mock.calls[0][0]).toBe('https://pulse-api.example.com/healthz')
  })

  it('mode hybrid : client actif (IA/recherche Azure)', () => {
    const client = new PulseAzureApiClient({
      config: makeConfig({
        VITE_PULSE_BACKEND: 'hybrid',
        VITE_PULSE_AZURE_API_URL: 'https://pulse-api.example.com',
      }),
      fetchFn: vi.fn(),
    })
    expect(client.isEnabled).toBe(true)
  })
})
