import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PulseAzureStatusBadge } from './PulseAzureStatusBadge'
import { resolvePulseAzureConfig } from '@/lib/pulse/azureBackend'
import { PulseAzureApiClient } from '@/lib/pulse/azureApiClient'
import type { AzurePulseHealth } from '@/types/pulse-azure'

function renderBadge(env: Record<string, string>, health?: AzurePulseHealth) {
  const config = resolvePulseAzureConfig(env)
  const fetchFn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(health ?? { status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
  const client = new PulseAzureApiClient({ config, fetchFn })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const result = render(
    <QueryClientProvider client={queryClient}>
      <PulseAzureStatusBadge statusOptions={{ config, client }} />
    </QueryClientProvider>
  )

  return { ...result, fetchFn, queryClient }
}

afterEach(() => {
  cleanup()
})

describe('PulseAzureStatusBadge', () => {
  it('mode supabase (défaut) : ne rend rien et n’appelle pas l’API', () => {
    const { fetchFn, container } = renderBadge({})

    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('pulse-azure-status-badge')).toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('mode azure : affiche le badge avec le mode et interroge /healthz', async () => {
    const { fetchFn } = renderBadge({
      VITE_PULSE_BACKEND: 'azure',
      VITE_PULSE_AZURE_API_URL: 'https://pulse-api.example.com',
    })

    const badge = await screen.findByTestId('pulse-azure-status-badge')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toContain('azure')

    // La query santé est déclenchée (URL /healthz)
    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalled()
    })
    expect(fetchFn.mock.calls[0][0]).toBe('https://pulse-api.example.com/healthz')
  })

  it('mode hybrid sans URL API : badge visible, aucun appel réseau', () => {
    const { fetchFn } = renderBadge({ VITE_PULSE_BACKEND: 'hybrid' })

    const badge = screen.getByTestId('pulse-azure-status-badge')
    expect(badge.textContent).toContain('hybrid')
    expect(badge.getAttribute('aria-label')).toContain('API non configurée')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('flag invalide : repli supabase → composant invisible', () => {
    const { container } = renderBadge({ VITE_PULSE_BACKEND: 'plateforme-edition' })
    expect(container.firstChild).toBeNull()
  })
})
