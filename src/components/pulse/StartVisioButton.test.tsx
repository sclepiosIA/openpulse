/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  stableAuth,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockCreateVisioLink,
  pulseVisioState,
  dropdownState,
  mockFrom,
} = vi.hoisted(() => {
  const result = { data: null as null, error: null as null }

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: typeof result) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  }

  return {
    stableAuth: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockCreateVisioLink: vi.fn(),
    pulseVisioState: {
      isCreating: false,
      error: null as null | { message: string },
      isError: false,
    },
    dropdownState: { open: false },
    mockFrom: vi.fn(() => builder),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableAuth,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableAuth,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableAuth,
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/hooks/pulse/usePulseVisio', () => ({
  usePulseVisio: () => ({
    isCreating: pulseVisioState.isCreating,
    isError: pulseVisioState.isError,
    error: pulseVisioState.error,
    createVisioLink: mockCreateVisioLink,
  }),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => ({
  Video: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="video-icon" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement> & { children: React.ReactNode }) => (
    <span {...props}>{children}</span>
  ),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactElement; asChild?: boolean }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode; align?: string }) => (
    <div {...props}>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button type="button" {...props} onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: (props: React.HTMLAttributes<HTMLHRElement>) => <hr {...props} />,
}))

import { StartVisioButton } from './StartVisioButton'
import { usePulseVisio } from '@/hooks/pulse/usePulseVisio'

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

describe('StartVisioButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dropdownState.open = false
    pulseVisioState.isCreating = false
    pulseVisioState.error = null
    pulseVisioState.isError = false
  })

  it('expose un hook stable via renderHook et affiche l’état de chargement', () => {
    pulseVisioState.isCreating = true

    const { result } = renderHook(() => usePulseVisio(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isCreating).toBe(true)
    expect(result.current.isError).toBe(false)
    expect(result.current.error).toBeNull()

    render(
      <StartVisioButton
        conversationId="conv-1"
        conversationName="Réunion équipe"
        onLinkCreated={vi.fn()}
        isMobileView={true}
      />,
      { wrapper: createWrapper() }
    )

    const button = screen.getByLabelText('Création de la visio en cours')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Démarrer une visio')
    expect(button.className).toContain('bg-card/10')
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('video-icon')).not.toBeInTheDocument()
  })

  it('crée un lien Google Meet avec les bonnes valeurs métier et appelle onLinkCreated', async () => {
    mockCreateVisioLink.mockResolvedValue({
      link: 'https://meet.local/google-room',
      provider: 'google_meet',
    })

    const onLinkCreated = vi.fn()

    render(
      <StartVisioButton
        conversationId="conv-42"
        conversationName="Staff médical"
        onLinkCreated={onLinkCreated}
        isMobileView={false}
      />,
      { wrapper: createWrapper() }
    )

    const trigger = screen.getByLabelText('Démarrer une visio')
    expect(trigger).not.toBeDisabled()
    expect(trigger.className).toContain('bg-blue-50/80')
    expect(screen.getByTestId('video-icon')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Google Meet/i }))

    await waitFor(() => {
      expect(mockCreateVisioLink).toHaveBeenCalledWith(
        'google_meet',
        'Pulse: Staff médical',
        'conv-42'
      )
    })

    expect(onLinkCreated).toHaveBeenCalledWith('https://meet.local/google-room', 'google_meet')
    expect(onLinkCreated).toHaveBeenCalledTimes(1)
  })

  it('crée un lien OpenPulse Meet, affiche le badge Interne et passe la conversation au service', async () => {
    mockCreateVisioLink.mockResolvedValue({
      link: 'https://visio.local/marque-room',
      provider: 'marque_meet',
    })

    const onLinkCreated = vi.fn()

    render(
      <StartVisioButton
        conversationId="conv-77"
        conversationName="Consultation"
        onLinkCreated={onLinkCreated}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('OpenPulse Meet')).toBeInTheDocument()
    expect(screen.getByText('Interne')).toBeInTheDocument()
    expect(screen.getByText('Google Meet')).toBeInTheDocument()
    expect(screen.getByText('Nextcloud Talk')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /OpenPulse Meet/i }))

    await waitFor(() => {
      expect(mockCreateVisioLink).toHaveBeenCalledWith(
        'marque_meet',
        'Pulse: Consultation',
        'conv-77'
      )
    })

    expect(onLinkCreated).toHaveBeenCalledWith('https://visio.local/marque-room', 'marque_meet')
  })

  it('ne déclenche pas onLinkCreated quand la création retourne null', async () => {
    mockCreateVisioLink.mockResolvedValue(null)

    const onLinkCreated = vi.fn()

    render(
      <StartVisioButton
        conversationId="conv-99"
        conversationName="Urgences"
        onLinkCreated={onLinkCreated}
      />,
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByRole('button', { name: /Nextcloud Talk/i }))

    await waitFor(() => {
      expect(mockCreateVisioLink).toHaveBeenCalledWith(
        'nextcloud_talk',
        'Pulse: Urgences',
        'conv-99'
      )
    })

    expect(onLinkCreated).not.toHaveBeenCalled()
  })

  it('reflète un état d’erreur du hook avec des valeurs métier explicites', () => {
    pulseVisioState.isError = true
    pulseVisioState.error = { message: 'x' }

    const { result } = renderHook(() => usePulseVisio(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toEqual({ message: 'x' })
    expect(result.current.isCreating).toBe(false)

    render(
      <StartVisioButton
        conversationId="conv-13"
        conversationName="Visite"
        onLinkCreated={vi.fn()}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByLabelText('Démarrer une visio')).toBeInTheDocument()
    expect(screen.getByText('Google Meet')).toBeInTheDocument()
  })
})
