// @vitest-environment jsdom

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockUseAzureMeetingsStatus } = vi.hoisted(() => ({
  mockUseAzureMeetingsStatus: vi.fn(),
}))

vi.mock('@/hooks/meeting/useAzureMeetingsStatus', () => ({
  useAzureMeetingsStatus: mockUseAzureMeetingsStatus,
}))

import { AzureMeetingsStatusPanel } from './AzureMeetingsStatusPanel'

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    visioBackend: 'supabase',
    transcriptionBackend: 'supabase',
    azureEnabled: false,
    apiConfigured: false,
    apiBaseUrl: '',
    health: undefined,
    isChecking: false,
    ...overrides,
  }
}

describe('AzureMeetingsStatusPanel (lot 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rend null en mode 100 % Supabase (non-régression /meeting-notes)', () => {
    mockUseAzureMeetingsStatus.mockReturnValue(makeStatus())
    const { container } = render(<AzureMeetingsStatusPanel />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('azure-meetings-status-panel')).toBeNull()
  })

  it('affiche les badges de backend en mode hybrid', () => {
    mockUseAzureMeetingsStatus.mockReturnValue(
      makeStatus({
        azureEnabled: true,
        transcriptionBackend: 'hybrid',
        apiConfigured: false,
      })
    )

    render(<AzureMeetingsStatusPanel />)

    expect(screen.getByTestId('azure-meetings-status-panel')).toBeInTheDocument()
    expect(screen.getByText('Socle Meetings Azure')).toBeInTheDocument()
    expect(screen.getByText('Supabase')).toBeInTheDocument()
    expect(screen.getByText('Hybride')).toBeInTheDocument()
    // API non configurée → message d'aide, pas de statut santé
    expect(screen.getByText(/API Meetings non configurée/i)).toBeInTheDocument()
  })

  it('affiche le statut santé quand l’API est configurée et opérationnelle', () => {
    mockUseAzureMeetingsStatus.mockReturnValue(
      makeStatus({
        azureEnabled: true,
        visioBackend: 'azure',
        transcriptionBackend: 'azure',
        apiConfigured: true,
        apiBaseUrl: 'https://meetings-api.test',
        health: { status: 'ok' },
      })
    )

    render(<AzureMeetingsStatusPanel />)

    expect(screen.getByText('API Azure opérationnelle')).toBeInTheDocument()
    expect(screen.getAllByText('Azure')).toHaveLength(2)
  })

  it('signale une API injoignable (health down)', () => {
    mockUseAzureMeetingsStatus.mockReturnValue(
      makeStatus({
        azureEnabled: true,
        transcriptionBackend: 'hybrid',
        apiConfigured: true,
        apiBaseUrl: 'https://meetings-api.test',
        health: { status: 'down' },
      })
    )

    render(<AzureMeetingsStatusPanel />)
    expect(screen.getByText('API Azure injoignable')).toBeInTheDocument()
  })

  it('signale une API dégradée', () => {
    mockUseAzureMeetingsStatus.mockReturnValue(
      makeStatus({
        azureEnabled: true,
        transcriptionBackend: 'azure',
        apiConfigured: true,
        apiBaseUrl: 'https://meetings-api.test',
        health: { status: 'degraded' },
      })
    )

    render(<AzureMeetingsStatusPanel />)
    expect(screen.getByText('API Azure dégradée')).toBeInTheDocument()
  })
})
