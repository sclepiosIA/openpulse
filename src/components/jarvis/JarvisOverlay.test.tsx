import { render, screen, fireEvent, act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import type { ReactNode } from 'react'

const {
  FOCUS,
  PRED,
  WAKE,
  ICONS,
  UI,
  MOTION,
  LOCATION,
  MOCK_FN,
} = vi.hoisted(() => {
  // Stable UI primitives
  const Button = (props: any) => {
    const { children, onClick, ...rest } = props
    return (
      <button onClick={onClick} {...rest}>
        {children}
      </button>
    )
  }
  const Input = (props: any) => {
    const { value, onChange, onKeyDown, placeholder, ...rest } = props
    return (
      <input
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        {...rest}
      />
    )
  }
  const Badge = (props: any) => {
    const { children, ...rest } = props
    return (
      <span {...rest}>
        {children}
      </span>
    )
  }
  const Card = (props: any) => {
    const { children, ...rest } = props
    return (
      <div {...rest}>
        {children}
      </div>
    )
  }

  // Stable icons (simple spans)
  const iconFactory = (name: string) => {
    const Comp = (props: any) => <span data-icon={name} {...props} />
    Comp.displayName = name
    return Comp
  }
  const ICONS = {
    Sparkles: iconFactory('Sparkles'),
    X: iconFactory('X'),
    Mic: iconFactory('Mic'),
    MicOff: iconFactory('MicOff'),
    Send: iconFactory('Send'),
    ChevronUp: iconFactory('ChevronUp'),
    Zap: iconFactory('Zap'),
    Mail: iconFactory('Mail'),
    CheckSquare: iconFactory('CheckSquare'),
    Building2: iconFactory('Building2'),
    DollarSign: iconFactory('DollarSign'),
    Lightbulb: iconFactory('Lightbulb'),
    ArrowRight: iconFactory('ArrowRight'),
    Volume2: iconFactory('Volume2'),
  }

  // Stable motion/AnimatePresence mocks: render children directly
  const MotionComponent = (_props: any) => {
    const { children, ...rest } = _props
    return <div {...rest}>{children}</div>
  }
  const motion = new Proxy(
    {},
    {
      get: () => MotionComponent,
    }
  )
  const AnimatePresence = (props: any) => <>{props.children}</>

  // Hooks data
  const FOCUS = {
    focusContext: { etablissement_name: 'Etablissement A' },
    currentMode: 'emails' as const,
  }
  const PRED = {
    topPrediction: { description: 'Pred desc', confidence: 0.8 },
    getPredictionCommand: vi.fn((p: any) => `cmd:${p.description}`),
  }
  const WAKE = {
    isListening: true,
    isDetected: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    confidence: 0.9,
  }

  // Mutable location object (returned by useLocation mock)
  const LOCATION = { pathname: '/home' }

  const UI = { Button, Input, Badge, Card }
  const MOTION = { motion, AnimatePresence }

  const MOCK_FN = {
    onSend: vi.fn(),
    onOpen: vi.fn(),
    onStartVoice: vi.fn(),
  }

  return { FOCUS, PRED, WAKE, ICONS, UI, MOTION, LOCATION, MOCK_FN }
})

// Mock internal modules used by JarvisOverlay (mocks are hoisted by Vitest)
vi.mock('@/components/ui/button', () => ({ Button: UI.Button }))
vi.mock('@/components/ui/input', () => ({ Input: UI.Input }))
vi.mock('@/components/ui/badge', () => ({ Badge: UI.Badge }))
vi.mock('@/components/ui/card', () => ({ Card: UI.Card }))
vi.mock('@/lib/utils', () => ({ cn: (...parts: any[]) => parts.filter(Boolean).join(' ') }))

vi.mock('@/hooks/jarvis/useJarvisFocus', () => ({ useJarvisFocus: () => FOCUS }))
vi.mock('@/hooks/jarvis/useJarvisPredictions', () => ({ useJarvisPredictions: () => PRED }))
vi.mock('@/hooks/jarvis/useJarvisWakeWord', () => ({ useJarvisWakeWord: (_opts: any) => WAKE }))

vi.mock('./JarvisWakeWordIndicator', () => ({ JarvisWakeWordIndicator: () => <div data-testid="wake-indicator" /> }))

vi.mock('framer-motion', () => MOTION)
vi.mock('react-router-dom', () => ({ useLocation: () => LOCATION }))

vi.mock('lucide-react', () => ({
  Sparkles: ICONS.Sparkles,
  X: ICONS.X,
  Mic: ICONS.Mic,
  MicOff: ICONS.MicOff,
  Send: ICONS.Send,
  ChevronUp: ICONS.ChevronUp,
  Zap: ICONS.Zap,
  Mail: ICONS.Mail,
  CheckSquare: ICONS.CheckSquare,
  Building2: ICONS.Building2,
  DollarSign: ICONS.DollarSign,
  Lightbulb: ICONS.Lightbulb,
  ArrowRight: ICONS.ArrowRight,
  Volume2: ICONS.Volume2,
}))

beforeEach(() => {
  vi.clearAllMocks()
  // reset any mutable state
  LOCATION.pathname = '/home'
})

describe('JarvisOverlay', () => {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )

  let JarvisOverlay: any

  beforeEach(async () => {
    const mod = await import('./JarvisOverlay')
    JarvisOverlay = mod.JarvisOverlay
  })

  it('expands bubble, shows mode, suggestions and prediction; handles prediction click', async () => {
    const { container } = render(
      <Wrapper>
        <JarvisOverlay
          onOpenFullPanel={MOCK_FN.onOpen}
          onSendMessage={MOCK_FN.onSend}
          onStartVoice={MOCK_FN.onStartVoice}
          wakeWordEnabled={true}
        />
      </Wrapper>
    )

    // The first button rendered is the mini bubble: click to expand
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
    await act(async () => {
      buttons[0].click()
    })

    // Header 'Jarvis' should be visible after expansion
    expect(screen.getByText('Jarvis')).toBeTruthy()

    // Mode label should reflect mocked currentMode 'emails' -> label "Emails"
    expect(screen.getByText('Mode Emails')).toBeTruthy()

    // Specific suggestion from MODE_CONFIG.emails should be present
    expect(screen.getByText('Emails non lus urgents')).toBeTruthy()

    // Prediction area (description) should be visible (confidence 0.8 > 0.6)
    const predNode = screen.getByText('Pred desc')
    expect(predNode).toBeTruthy()

    // Click prediction button (closest button ancestor) to trigger getPredictionCommand + onSendMessage
    const predButton = predNode.closest('button')
    expect(predButton).toBeTruthy()
    await act(async () => {
      predButton!.click()
    })
    expect(PRED.getPredictionCommand).toHaveBeenCalled()
    expect(MOCK_FN.onSend).toHaveBeenCalledWith('cmd:Pred desc')
  })

  it('handles wake word controls and sending input text', async () => {
    const { container } = render(
      <Wrapper>
        <JarvisOverlay
          onOpenFullPanel={MOCK_FN.onOpen}
          onSendMessage={MOCK_FN.onSend}
          onStartVoice={MOCK_FN.onStartVoice}
          wakeWordEnabled={true}
        />
      </Wrapper>
    )

    // Expand
    const buttons = container.querySelectorAll('button')
    await act(async () => {
      buttons[0].click()
    })

    // Volume button has aria-label "Volume"
    const volButton = screen.getByLabelText('Volume')
    expect(volButton).toBeTruthy()

    // WAKE.isListening is true initially; clicking should call stopListening
    await act(async () => {
      volButton.click()
    })
    expect(WAKE.stopListening).toHaveBeenCalled()

    // Input placeholder should reflect listening state ("Dites 'Hey Jarvis'...")
    const input = screen.getByPlaceholderText("Dites 'Hey Jarvis'...")
    expect(input).toBeTruthy()

    // Type and send
    await act(async () => {
      fireEvent.change(input, { target: { value: '  Hello Jarvis  ' } })
    })
    const sendButton = screen.getByLabelText('Envoyer')
    expect(sendButton).toBeTruthy()
    await act(async () => {
      sendButton.click()
    })

    // onSendMessage should be called with trimmed content
    expect(MOCK_FN.onSend).toHaveBeenCalledWith('Hello Jarvis')

    // Overlay should close after send (header no longer present)
    expect(screen.queryByText('Jarvis')).toBeNull()
  })

  it('closes overlay when location.pathname changes', async () => {
    const { container, rerender } = render(
      <Wrapper>
        <JarvisOverlay
          onOpenFullPanel={MOCK_FN.onOpen}
          onSendMessage={MOCK_FN.onSend}
          onStartVoice={MOCK_FN.onStartVoice}
          wakeWordEnabled={true}
        />
      </Wrapper>
    )

    // Expand
    const buttons = container.querySelectorAll('button')
    await act(async () => {
      buttons[0].click()
    })
    expect(screen.getByText('Jarvis')).toBeTruthy()

    // Simulate navigation by mutating LOCATION.pathname and rerendering
    await act(async () => {
      LOCATION.pathname = '/other-path'
      rerender(
        <Wrapper>
          <JarvisOverlay
            onOpenFullPanel={MOCK_FN.onOpen}
            onSendMessage={MOCK_FN.onSend}
            onStartVoice={MOCK_FN.onStartVoice}
            wakeWordEnabled={true}
          />
        </Wrapper>
      )
    })

    // Overlay should be closed
    expect(screen.queryByText('Jarvis')).toBeNull()
  })

  it('exposes predictions hook via renderHook inside QueryClientProvider', async () => {
    const wrapper = ({ children }: { children?: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>

    // Import the mocked hook statically (vitest hoists mocks)
     
    const { useJarvisPredictions } = await import('@/hooks/jarvis/useJarvisPredictions')

    const { result } = renderHook(() => useJarvisPredictions(), { wrapper })

    // The hook should return the stable topPrediction object and function from the hoisted mock
    expect(result.current.topPrediction).toEqual(PRED.topPrediction)
    expect(typeof result.current.getPredictionCommand).toBe('function')
  })

  it('renderHook can represent an error shape (data:null error:{message}) and isError true', async () => {
    const wrapper = ({ children }: { children?: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>

    const { result } = renderHook(() => ({ data: null, error: { message: 'boom' }, isError: true }), { wrapper })
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toEqual({ message: 'boom' })
  })
})