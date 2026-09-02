import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

const {
  mockFlushOutbox,
  mockToastSuccess,
  mockToastError,
  INITIAL_EMPTY,
  SILENT_SENT_AND_FAILED,
  ONLINE_SINGLE_SENT_AND_FAILED,
  ONLINE_PLURAL_SENT_AND_FAILED,
  INTERVAL_BACKGROUND_RESULT,
  REJECTED_ERROR,
} = vi.hoisted(() => {
  const INITIAL_EMPTY = { sent: 0, failed: 0 }
  const SILENT_SENT_AND_FAILED = { sent: 2, failed: 1 }
  const ONLINE_SINGLE_SENT_AND_FAILED = { sent: 1, failed: 1 }
  const ONLINE_PLURAL_SENT_AND_FAILED = { sent: 3, failed: 2 }
  const INTERVAL_BACKGROUND_RESULT = { sent: 4, failed: 3 }
  const REJECTED_ERROR = new Error('x')

  return {
    mockFlushOutbox: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    INITIAL_EMPTY,
    SILENT_SENT_AND_FAILED,
    ONLINE_SINGLE_SENT_AND_FAILED,
    ONLINE_PLURAL_SENT_AND_FAILED,
    INTERVAL_BACKGROUND_RESULT,
    REJECTED_ERROR,
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/lib/offlineOutbox', () => ({
  flushOutbox: mockFlushOutbox,
}))

import { useOutboxFlusher } from './useOutboxFlusher'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useOutboxFlusher', () => {
  beforeEach(() => {
    vi.useRealTimers()
    mockFlushOutbox.mockReset()
    mockFlushOutbox.mockResolvedValue(INITIAL_EMPTY)
    mockToastSuccess.mockClear()
    mockToastError.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('lance un flush initial silencieux au montage sans afficher de toast même si des éléments sont envoyés ou échouent', async () => {
    mockFlushOutbox.mockResolvedValueOnce(SILENT_SENT_AND_FAILED)

    const { unmount } = renderHook(() => useOutboxFlusher(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockFlushOutbox).toHaveBeenCalledTimes(1))
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockToastError).not.toHaveBeenCalled()

    unmount()
  })

  it('affiche les messages singuliers au retour du réseau quand un élément est envoyé et un brouillon échoue', async () => {
    mockFlushOutbox
      .mockResolvedValueOnce(INITIAL_EMPTY)
      .mockResolvedValueOnce(ONLINE_SINGLE_SENT_AND_FAILED)

    const { unmount } = renderHook(() => useOutboxFlusher(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockFlushOutbox).toHaveBeenCalledTimes(1))

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
    })

    await waitFor(() => expect(mockFlushOutbox).toHaveBeenCalledTimes(2))

    expect(mockToastSuccess).toHaveBeenCalledWith("1 élément envoyé depuis la file d'attente")
    expect(mockToastError).toHaveBeenCalledWith(
      "Impossible d'envoyer un brouillon (réessai automatique)"
    )

    unmount()
  })

  it('affiche les messages pluriels au retour du réseau quand plusieurs éléments sont traités', async () => {
    mockFlushOutbox
      .mockResolvedValueOnce(INITIAL_EMPTY)
      .mockResolvedValueOnce(ONLINE_PLURAL_SENT_AND_FAILED)

    const { unmount } = renderHook(() => useOutboxFlusher(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockFlushOutbox).toHaveBeenCalledTimes(1))

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
    })

    await waitFor(() => expect(mockFlushOutbox).toHaveBeenCalledTimes(2))

    expect(mockToastSuccess).toHaveBeenCalledWith("3 éléments envoyés depuis la file d'attente")
    expect(mockToastError).toHaveBeenCalledWith(
      "Impossible d'envoyer 2 brouillons (réessai automatique)"
    )

    unmount()
  })

  it('réessaie toutes les 60 secondes en arrière-plan sans toast quand le navigateur est en ligne', async () => {
    vi.useFakeTimers()
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })

    mockFlushOutbox
      .mockResolvedValueOnce(INITIAL_EMPTY)
      .mockResolvedValueOnce(INTERVAL_BACKGROUND_RESULT)

    const { unmount } = renderHook(() => useOutboxFlusher(), {
      wrapper: createWrapper(),
    })

    expect(mockFlushOutbox).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(mockFlushOutbox).toHaveBeenCalledTimes(2)
    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockToastError).not.toHaveBeenCalled()

    unmount()
  })

  it('ignore les erreurs de flush sans afficher de toast', async () => {
    mockFlushOutbox.mockRejectedValueOnce(REJECTED_ERROR)

    const { unmount } = renderHook(() => useOutboxFlusher(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockFlushOutbox).toHaveBeenCalledTimes(1))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockToastError).not.toHaveBeenCalled()

    unmount()
  })

  it('ignore le résultat si le composant est démonté avant la résolution du flush', async () => {
    type FlushResult = { sent: number; failed: number }

    let resolvePending: (value: FlushResult) => void = () => {}
    const pendingFlush = new Promise<FlushResult>((resolve) => {
      resolvePending = resolve
    })

    mockFlushOutbox.mockReturnValueOnce(pendingFlush)

    const { unmount } = renderHook(() => useOutboxFlusher(), {
      wrapper: createWrapper(),
    })

    expect(mockFlushOutbox).toHaveBeenCalledTimes(1)

    unmount()

    await act(async () => {
      resolvePending(ONLINE_SINGLE_SENT_AND_FAILED)
      await pendingFlush
    })

    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('retire le listener online au démontage', async () => {
    mockFlushOutbox.mockResolvedValue(INITIAL_EMPTY)

    const { unmount } = renderHook(() => useOutboxFlusher(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockFlushOutbox).toHaveBeenCalledTimes(1))

    unmount()

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
    })

    expect(mockFlushOutbox).toHaveBeenCalledTimes(1)
  })
})
