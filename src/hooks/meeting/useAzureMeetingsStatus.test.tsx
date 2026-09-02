// @vitest-environment jsdom

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockFetchHealth } = vi.hoisted(() => ({
  mockFetchHealth: vi.fn(),
}))

vi.mock('@/services/meetings/azureMeetingsApi', () => ({
  fetchAzureMeetingsHealth: mockFetchHealth,
}))

import { useAzureMeetingsStatus } from './useAzureMeetingsStatus'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useAzureMeetingsStatus (lot 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('mode défaut supabase : inerte, aucun health check (non-régression)', () => {
    const { result } = renderHook(() => useAzureMeetingsStatus(), { wrapper })

    expect(result.current.visioBackend).toBe('supabase')
    expect(result.current.transcriptionBackend).toBe('supabase')
    expect(result.current.azureEnabled).toBe(false)
    expect(result.current.apiConfigured).toBe(false)
    expect(result.current.health).toBeUndefined()
    expect(mockFetchHealth).not.toHaveBeenCalled()
  })

  it('flag hybrid sans base URL : activé mais pas de sonde réseau', () => {
    vi.stubEnv('VITE_TRANSCRIPTION_BACKEND', 'hybrid')

    const { result } = renderHook(() => useAzureMeetingsStatus(), { wrapper })

    expect(result.current.azureEnabled).toBe(true)
    expect(result.current.apiConfigured).toBe(false)
    expect(mockFetchHealth).not.toHaveBeenCalled()
  })

  it('flag azure + base URL : sonde le health et expose le résultat', async () => {
    vi.stubEnv('VITE_TRANSCRIPTION_BACKEND', 'azure')
    vi.stubEnv('VITE_MEETINGS_API_BASE_URL', 'https://meetings-api.test')
    mockFetchHealth.mockResolvedValue({ status: 'ok', version: '1.0.0' })

    const { result } = renderHook(() => useAzureMeetingsStatus(), { wrapper })

    expect(result.current.apiConfigured).toBe(true)
    expect(result.current.apiBaseUrl).toBe('https://meetings-api.test')

    await waitFor(() => {
      expect(result.current.health?.status).toBe('ok')
    })
    expect(mockFetchHealth).toHaveBeenCalledTimes(1)
  })

  it('expose down quand la sonde renvoie down', async () => {
    vi.stubEnv('VITE_VISIO_BACKEND', 'hybrid')
    vi.stubEnv('VITE_MEETINGS_API_BASE_URL', 'https://meetings-api.test')
    mockFetchHealth.mockResolvedValue({ status: 'down' })

    const { result } = renderHook(() => useAzureMeetingsStatus(), { wrapper })

    await waitFor(() => {
      expect(result.current.health?.status).toBe('down')
    })
    expect(result.current.visioBackend).toBe('hybrid')
    expect(result.current.transcriptionBackend).toBe('supabase')
  })
})
