import React from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { JarvisKeyboardShortcuts, useJarvisKeyboardShortcuts } from './JarvisKeyboardShortcuts'

vi.mock('framer-motion', () => {
  const ReactActual = require('react')
  return {
    motion: new Proxy(
      {},
      {
        get: (_, prop: string) => {
          const Component: React.FC<React.HTMLAttributes<HTMLElement>> = (props) =>
            ReactActual.createElement(prop === 'div' ? 'div' : 'span', props)
          return Component
        },
      }
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock('lucide-react', () => {
  const Icon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <svg {...props} />
  return {
    Keyboard: Icon,
    Command: Icon,
    CornerDownLeft: Icon,
    Mic: Icon,
    History: Icon,
    Plus: Icon,
    X: Icon,
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) =>
    classes.filter(Boolean).join(' '),
}))

const { createQueryClient } = vi.hoisted(() => ({
  createQueryClient: () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    }),
}))

function createWrapper() {
  const queryClient = createQueryClient()
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return Wrapper
}

describe('JarvisKeyboardShortcuts component', () => {
  it('renders nothing when isOpen is false', () => {
    const onClose = vi.fn()
    const { queryByText } = render(
      <JarvisKeyboardShortcuts isOpen={false} onClose={onClose} />
    )
    expect(queryByText('Raccourcis clavier')).toBeNull()
  })

  it('renders modal when isOpen is true with all shortcuts', () => {
    const onClose = vi.fn()
    render(<JarvisKeyboardShortcuts isOpen={true} onClose={onClose} />)

    expect(screen.getByText('Raccourcis clavier')).toBeInTheDocument()
    expect(screen.getByText('Navigation rapide')).toBeInTheDocument()

    expect(screen.getByText('Ouvrir/Fermer Jarvis')).toBeInTheDocument()
    expect(screen.getByText('Nouvelle conversation')).toBeInTheDocument()
    expect(screen.getByText('Envoyer')).toBeInTheDocument()
    expect(screen.getByText('Nouvelle ligne')).toBeInTheDocument()
    expect(screen.getByText('Voice input')).toBeInTheDocument()
    expect(screen.getByText('Historique')).toBeInTheDocument()
    expect(screen.getByText('Fermer')).toBeInTheDocument()

    expect(
      screen.getByText(
        'Appuyez sur',
        { exact: false }
      )
    ).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <JarvisKeyboardShortcuts isOpen={true} onClose={onClose} />
    )

    const backdrop = container.querySelector('.fixed.inset-0')
    expect(backdrop).not.toBeNull()
    if (!backdrop) throw new Error('Backdrop not found')
    fireEvent.click(backdrop)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <JarvisKeyboardShortcuts isOpen={true} onClose={onClose} />
    )

    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    const closeButton = buttons[buttons.length - 1]
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed and isOpen is true', () => {
    const onClose = vi.fn()
    render(<JarvisKeyboardShortcuts isOpen={true} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when Escape is pressed and isOpen is false', () => {
    const onClose = vi.fn()
    render(<JarvisKeyboardShortcuts isOpen={false} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('useJarvisKeyboardShortcuts hook', () => {
  const originalPlatform = navigator.platform

  afterEach(() => {
    Object.defineProperty(window.navigator, 'platform', {
      value: originalPlatform,
      configurable: true,
    })
  })

  it('initializes with showShortcuts=false and exposes ShortcutsModal component', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          enabled: true,
        }),
      { wrapper }
    )

    expect(result.current.showShortcuts).toBe(false)

    const TestComponent: React.FC = () => {
      return <result.current.ShortcutsModal />
    }

    const { queryByText } = render(
      <QueryClientProvider client={createQueryClient()}>
        <TestComponent />
      </QueryClientProvider>
    )

    expect(queryByText('Raccourcis clavier')).toBeNull()
  })

  it('opens shortcuts modal when "?" is pressed without modifiers', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          enabled: true,
        }),
      { wrapper }
    )

    expect(result.current.showShortcuts).toBe(false)

    act(() => {
      fireEvent.keyDown(window, { key: '?' })
    })

    expect(result.current.showShortcuts).toBe(true)
  })

  it('does not open shortcuts modal when "?" is pressed with ctrl or meta', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          enabled: true,
        }),
      { wrapper }
    )

    act(() => {
      fireEvent.keyDown(window, { key: '?', ctrlKey: true })
    })
    expect(result.current.showShortcuts).toBe(false)

    act(() => {
      fireEvent.keyDown(window, { key: '?', metaKey: true })
    })
    expect(result.current.showShortcuts).toBe(false)
  })

  it('closes shortcuts modal via ShortcutsModal onClose', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          enabled: true,
        }),
      { wrapper }
    )

    act(() => {
      result.current.setShowShortcuts(true)
    })
    expect(result.current.showShortcuts).toBe(true)

    const ModalHost: React.FC = () => <result.current.ShortcutsModal />

    const { container } = render(
      <QueryClientProvider client={createQueryClient()}>
        <ModalHost />
      </QueryClientProvider>
    )

    const buttons = container.querySelectorAll('button')
    const closeButton = buttons[buttons.length - 1]
    act(() => {
      fireEvent.click(closeButton)
    })

    expect(result.current.showShortcuts).toBe(false)
  })

  it('triggers onOpenJarvis with Cmd/Ctrl+K depending on platform', () => {
    const wrapper = createWrapper()
    const onOpenJarvisMac = vi.fn()
    const onOpenJarvisWindows = vi.fn()

    Object.defineProperty(window.navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    })

    renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          onOpenJarvis: onOpenJarvisMac,
          enabled: true,
        }),
      { wrapper }
    )

    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true })
    })
    expect(onOpenJarvisMac).toHaveBeenCalledTimes(1)

    Object.defineProperty(window.navigator, 'platform', {
      value: 'Win32',
      configurable: true,
    })

    renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          onOpenJarvis: onOpenJarvisWindows,
          enabled: true,
        }),
      { wrapper }
    )

    act(() => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })
    expect(onOpenJarvisWindows).toHaveBeenCalledTimes(1)
  })

  it('triggers onNewConversation with Cmd/Ctrl+Shift+N', () => {
    const wrapper = createWrapper()
    const onNewConversation = vi.fn()

    Object.defineProperty(window.navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    })

    renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          onNewConversation,
          enabled: true,
        }),
      { wrapper }
    )

    act(() => {
      fireEvent.keyDown(window, { key: 'n', metaKey: true, shiftKey: true })
    })
    expect(onNewConversation).toHaveBeenCalledTimes(1)
  })

  it('triggers onToggleVoice with Cmd/Ctrl+M', () => {
    const wrapper = createWrapper()
    const onToggleVoice = vi.fn()

    Object.defineProperty(window.navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    })

    renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          onToggleVoice,
          enabled: true,
        }),
      { wrapper }
    )

    act(() => {
      fireEvent.keyDown(window, { key: 'm', metaKey: true })
    })
    expect(onToggleVoice).toHaveBeenCalledTimes(1)
  })

  it('triggers onOpenHistory with Cmd/Ctrl+H', () => {
    const wrapper = createWrapper()
    const onOpenHistory = vi.fn()

    Object.defineProperty(window.navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    })

    renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          onOpenHistory,
          enabled: true,
        }),
      { wrapper }
    )

    act(() => {
      fireEvent.keyDown(window, { key: 'h', metaKey: true })
    })
    expect(onOpenHistory).toHaveBeenCalledTimes(1)
  })

  it('triggers onCloseJarvis on Escape', () => {
    const wrapper = createWrapper()
    const onCloseJarvis = vi.fn()

    renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          onCloseJarvis,
          enabled: true,
        }),
      { wrapper }
    )

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(onCloseJarvis).toHaveBeenCalledTimes(1)
  })

  it('does nothing when disabled', () => {
    const wrapper = createWrapper()
    const handlers = {
      onOpenJarvis: vi.fn(),
      onNewConversation: vi.fn(),
      onOpenHistory: vi.fn(),
      onToggleVoice: vi.fn(),
      onCloseJarvis: vi.fn(),
    }

    renderHook(
      () =>
        useJarvisKeyboardShortcuts({
          ...handlers,
          enabled: false,
        }),
      { wrapper }
    )

    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true })
      fireEvent.keyDown(window, { key: 'n', metaKey: true, shiftKey: true })
      fireEvent.keyDown(window, { key: 'm', metaKey: true })
      fireEvent.keyDown(window, { key: 'h', metaKey: true })
      fireEvent.keyDown(window, { key: 'Escape' })
      fireEvent.keyDown(window, { key: '?' })
    })

    expect(handlers.onOpenJarvis).not.toHaveBeenCalled()
    expect(handlers.onNewConversation).not.toHaveBeenCalled()
    expect(handlers.onOpenHistory).not.toHaveBeenCalled()
    expect(handlers.onToggleVoice).not.toHaveBeenCalled()
    expect(handlers.onCloseJarvis).not.toHaveBeenCalled()
  })
})