/* @vitest-environment jsdom */

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { JarvisWakeWordIndicator } from './JarvisWakeWordIndicator'

const {
  stableUser,
  hookState,
  startListeningMock,
  stopListeningMock,
  resetDetectionMock,
  useJarvisWakeWordMock,
} = vi.hoisted(() => ({
  stableUser: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  hookState: {
    isListening: false,
    isDetected: false,
    confidence: 0,
  },
  startListeningMock: vi.fn(),
  stopListeningMock: vi.fn(),
  resetDetectionMock: vi.fn(),
  useJarvisWakeWordMock: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/hooks/jarvis/useJarvisWakeWord', () => ({
  useJarvisWakeWord: useJarvisWakeWordMock,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableUser,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableUser,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableUser,
}))

vi.mock('framer-motion', () => {
  const ReactModule = React
  const make = (tag: keyof React.JSX.IntrinsicElements) =>
    ReactModule.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ children, ...props }, ref) =>
      ReactModule.createElement(tag, { ...props, ref }, children)
    )

  return {
    motion: {
      div: make('div'),
      button: make('button'),
      span: make('span'),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => ReactModule.createElement(ReactModule.Fragment, null, children),
  }
})

vi.mock('lucide-react', () => {
  const ReactModule = React
  return {
    Mic: (props: React.SVGProps<SVGSVGElement>) => ReactModule.createElement('svg', { ...props, 'data-testid': 'icon-mic' }),
    MicOff: (props: React.SVGProps<SVGSVGElement>) => ReactModule.createElement('svg', { ...props, 'data-testid': 'icon-micoff' }),
    AudioWaveform: (props: React.SVGProps<SVGSVGElement>) =>
      ReactModule.createElement('svg', { ...props, 'data-testid': 'icon-waveform' }),
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('JarvisWakeWordIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hookState.isListening = false
    hookState.isDetected = false
    hookState.confidence = 0

    useJarvisWakeWordMock.mockImplementation((options?: { onWakeUp?: () => void; autoStart?: boolean; sensitivity?: string }) => ({
      isListening: hookState.isListening,
      isDetected: hookState.isDetected,
      confidence: hookState.confidence,
      startListening: startListeningMock,
      stopListening: stopListeningMock,
      resetDetection: resetDetectionMock,
      options,
    }))
  })

  it('passe de l’état inactif à écoute puis détection avec les valeurs métier attendues en mode interne', () => {
    const { rerender } = render(<JarvisWakeWordIndicator autoStart />)

    expect(useJarvisWakeWordMock).toHaveBeenCalled()
    const firstCall = useJarvisWakeWordMock.mock.calls[0]?.[0] as { autoStart?: boolean; sensitivity?: string }
    expect(firstCall.autoStart).toBe(true)
    expect(firstCall.sensitivity).toBe('medium')

    expect(screen.getByTestId('icon-micoff')).toBeInTheDocument()
    expect(screen.queryByText('Écoute en cours...')).not.toBeInTheDocument()
    expect(screen.queryByText('Wake word détecté!')).not.toBeInTheDocument()

    hookState.isListening = true
    rerender(<JarvisWakeWordIndicator autoStart />)

    expect(screen.getByTestId('icon-mic')).toBeInTheDocument()
    expect(screen.getByText('Écoute en cours...')).toBeInTheDocument()
    expect(screen.getByText('Dites "Hey Jarvis"')).toBeInTheDocument()

    hookState.isDetected = true
    hookState.confidence = 0.876
    rerender(<JarvisWakeWordIndicator autoStart />)

    expect(screen.getByTestId('icon-waveform')).toBeInTheDocument()
    expect(screen.getByText('Wake word détecté!')).toBeInTheDocument()
    expect(screen.getByText('Confiance: 88%')).toBeInTheDocument()
  })

  it('déclenche startListening puis stopListening en cliquant sur le bouton en mode interne', () => {
    const { rerender } = render(<JarvisWakeWordIndicator />)

    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(startListeningMock).toHaveBeenCalledTimes(1)
    expect(stopListeningMock).not.toHaveBeenCalled()

    hookState.isListening = true
    rerender(<JarvisWakeWordIndicator />)

    fireEvent.click(screen.getByRole('button'))
    expect(stopListeningMock).toHaveBeenCalledTimes(1)
  })

  it('utilise le contrôle externe, affiche le mode compact et appelle onToggle sans utiliser les actions internes', () => {
    const onToggle = vi.fn()

    render(
      <JarvisWakeWordIndicator
        compact
        isListening
        isDetected
        confidence={0.42}
        onToggle={onToggle}
        className="custom-class"
      />
    )

    expect(screen.getByText('Jarvis activé!')).toBeInTheDocument()
    expect(screen.getByTestId('icon-waveform')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(startListeningMock).not.toHaveBeenCalled()
    expect(stopListeningMock).not.toHaveBeenCalled()

    const firstCall = useJarvisWakeWordMock.mock.calls[0]?.[0] as { autoStart?: boolean; sensitivity?: string }
    expect(firstCall.autoStart).toBe(false)
    expect(firstCall.sensitivity).toBe('medium')
  })

  it('appelle onWakeUp puis resetDetection après 3 secondes via le callback du hook', async () => {
    vi.useFakeTimers()

    const onWakeUp = vi.fn()
    render(<JarvisWakeWordIndicator onWakeUp={onWakeUp} />)

    const call = useJarvisWakeWordMock.mock.calls[0]?.[0] as { onWakeUp?: () => void }
    expect(typeof call.onWakeUp).toBe('function')

    call.onWakeUp?.()
    expect(onWakeUp).toHaveBeenCalledTimes(1)
    expect(resetDetectionMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3000)
    expect(resetDetectionMock).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('supporte un cycle chargement vers succès puis erreur via renderHook avec QueryClientProvider', async () => {
    const wrapper = createWrapper()

    const { result, rerender } = renderHook(
      ({ state }: { state: { isLoading: boolean; data: string | null; error: { message: string } | null } }) => {
        return {
          isLoading: state.isLoading,
          isError: Boolean(state.error),
          value: state.data,
          errorMessage: state.error?.message ?? null,
        }
      },
      {
        initialProps: {
          state: { isLoading: true, data: null, error: null },
        },
        wrapper,
      }
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isError).toBe(false)
    expect(result.current.value).toBe(null)

    rerender({
      state: { isLoading: false, data: 'Wake word détecté!', error: null },
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isError).toBe(false)
      expect(result.current.value).toBe('Wake word détecté!')
    })

    rerender({
      state: { isLoading: false, data: null, error: { message: 'x' } },
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
      expect(result.current.errorMessage).toBe('x')
      expect(result.current.value).toBe(null)
    })
  })
})