import type { ReactElement, ReactNode } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OfflineBanner } from './OfflineBanner'

const {
  onlineState,
  loadingPendingPromise,
  mockUseOnlineStatus,
  mockCountPending,
  mockOnOutboxChange,
  mockUnsubscribe,
  outboxHandlers,
} = vi.hoisted(() => {
  const onlineState = { value: true }
  const loadingPendingPromise = new Promise<number>(() => undefined)
  const outboxHandlers = new Set<() => void>()
  const mockUnsubscribe = vi.fn()

  const mockUseOnlineStatus = vi.fn(() => onlineState.value)
  const mockCountPending = vi.fn<() => Promise<number>>()
  const mockOnOutboxChange = vi.fn((handler: () => void) => {
    outboxHandlers.add(handler)

    return () => {
      mockUnsubscribe()
      outboxHandlers.delete(handler)
    }
  })

  return {
    onlineState,
    loadingPendingPromise,
    mockUseOnlineStatus,
    mockCountPending,
    mockOnOutboxChange,
    mockUnsubscribe,
    outboxHandlers,
  }
})

vi.mock('@/hooks/shared/useOnlineStatus', () => ({
  useOnlineStatus: mockUseOnlineStatus,
}))

vi.mock('@/lib/offlineOutbox', () => ({
  countPending: mockCountPending,
  onOutboxChange: mockOnOutboxChange,
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function TestProviders({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
}

function renderWithProviders(ui: ReactElement) {
  return render(ui, { wrapper: TestProviders })
}

beforeEach(() => {
  onlineState.value = true
  outboxHandlers.clear()
  mockUseOnlineStatus.mockClear()
  mockCountPending.mockReset()
  mockOnOutboxChange.mockClear()
  mockUnsubscribe.mockClear()
})

afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('OfflineBanner', () => {
  it('ne rend rien en ligne pendant le chargement du compteur', async () => {
    onlineState.value = true
    mockCountPending.mockReturnValue(loadingPendingPromise)

    renderWithProviders(<OfflineBanner />)

    expect(screen.queryByRole('status')).toBeNull()

    await waitFor(() => {
      expect(mockCountPending).toHaveBeenCalledTimes(1)
    })

    expect(screen.queryByRole('status')).toBeNull()
    expect(mockOnOutboxChange).toHaveBeenCalledTimes(1)
  })

  it('ne rend rien quand l’application est en ligne et sans élément en attente', async () => {
    onlineState.value = true
    mockCountPending.mockResolvedValue(0)

    renderWithProviders(<OfflineBanner />)

    await waitFor(() => {
      expect(mockCountPending).toHaveBeenCalledTimes(1)
    })

    expect(screen.queryByRole('status')).toBeNull()
    expect(mockOnOutboxChange).toHaveBeenCalledTimes(1)
  })

  it('affiche le message hors ligne sans compteur quand aucun élément n’est en attente', async () => {
    onlineState.value = false
    mockCountPending.mockResolvedValue(0)

    renderWithProviders(<OfflineBanner />)

    await waitFor(() => {
      expect(mockCountPending).toHaveBeenCalledTimes(1)
    })

    const status = screen.getByRole('status')

    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.className).toContain('bg-amber-600')
    expect(status.textContent).toBe('Hors ligne — vous pouvez consulter les pages déjà visitées')
  })

  it('affiche le message hors ligne avec le nombre d’éléments en file d’attente', async () => {
    onlineState.value = false
    mockCountPending.mockResolvedValue(3)

    renderWithProviders(<OfflineBanner />)

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(
        "Hors ligne — vous pouvez consulter les pages déjà visitées, 3 en file d'attente"
      )
    })

    expect(screen.getByRole('status').className).toContain('bg-amber-600')
  })

  it('affiche le bandeau de synchronisation en ligne avec le libellé singulier', async () => {
    onlineState.value = true
    mockCountPending.mockResolvedValue(1)

    renderWithProviders(<OfflineBanner />)

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(
        "1 élément en file d'attente — envoi en cours…"
      )
    })

    expect(screen.getByRole('status').className).toContain('bg-blue-600')
  })

  it('rafraîchit le compteur quand la file hors ligne signale un changement', async () => {
    onlineState.value = true
    mockCountPending.mockResolvedValueOnce(2).mockResolvedValueOnce(5).mockResolvedValue(5)

    const { unmount } = renderWithProviders(<OfflineBanner />)

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(
        "2 éléments en file d'attente — envoi en cours…"
      )
    })

    expect(mockOnOutboxChange).toHaveBeenCalledTimes(1)

    const handlers = Array.from(outboxHandlers)
    expect(handlers).toHaveLength(1)

    await act(async () => {
      for (const handler of handlers) {
        handler()
      }
    })

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(
        "5 éléments en file d'attente — envoi en cours…"
      )
    })

    expect(mockCountPending).toHaveBeenCalledTimes(2)

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    expect(outboxHandlers.size).toBe(0)
  })

  it('reste fonctionnel quand le comptage échoue et retombe à zéro élément', async () => {
    onlineState.value = false
    mockCountPending.mockRejectedValueOnce(new Error('x'))

    renderWithProviders(<OfflineBanner />)

    await waitFor(() => {
      expect(mockCountPending).toHaveBeenCalledTimes(1)
    })

    const status = screen.getByRole('status')

    expect(status.className).toContain('bg-amber-600')
    expect(status.textContent).toBe('Hors ligne — vous pouvez consulter les pages déjà visitées')
  })
})
