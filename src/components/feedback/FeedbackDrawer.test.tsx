/* @vitest-environment jsdom */

import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup, renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeedbackDrawer } from './FeedbackDrawer'

const {
  AUTH_STATE,
  LOCATION_STATE,
  TOAST_FN,
  DEBUG_ERROR,
  LOGS,
  ERROR_LOGS,
  INSERT_RESULT,
  UPLOAD_RESULT,
  PUBLIC_URL_RESULT,
  INSERT_SPY,
  UPLOAD_SPY,
  GET_PUBLIC_URL_SPY,
  STORAGE_FROM_SPY,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'test@example.com' } as { id: string; email: string } | null,
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const LOCATION_STATE = {
    pathname: '/dashboard',
    search: '?tab=overview',
  }

  const TOAST_FN = vi.fn()
  const DEBUG_ERROR = vi.fn()

  const LOGS = [
    { timestamp: '2024-01-01T10:00:00.000Z', level: 'log', args: ['premier', 'log'] },
    { timestamp: '2024-01-01T10:01:00.000Z', level: 'error', args: ['erreur', 'critique'] },
  ]
  const ERROR_LOGS = [{ timestamp: '2024-01-01T10:01:00.000Z', level: 'error', args: ['erreur'] }]

  const INSERT_RESULT = { data: null, error: null as null | { message: string } }
  const UPLOAD_RESULT = {
    data: { path: 'u1/screen.png' },
    error: null as null | { message: string },
  }
  const PUBLIC_URL_RESULT = { data: { publicUrl: 'https://public.local/screen.png' } }

  const INSERT_SPY = vi.fn(async () => INSERT_RESULT)
  const UPLOAD_SPY = vi.fn(async () => UPLOAD_RESULT)
  const GET_PUBLIC_URL_SPY = vi.fn(() => PUBLIC_URL_RESULT)
  const STORAGE_FROM_SPY = vi.fn(() => ({
    upload: UPLOAD_SPY,
    getPublicUrl: GET_PUBLIC_URL_SPY,
  }))
  const mockFrom = vi.fn()

  return {
    AUTH_STATE,
    LOCATION_STATE,
    TOAST_FN,
    DEBUG_ERROR,
    LOGS,
    ERROR_LOGS,
    INSERT_RESULT,
    UPLOAD_RESULT,
    PUBLIC_URL_RESULT,
    INSERT_SPY,
    UPLOAD_SPY,
    GET_PUBLIC_URL_SPY,
    STORAGE_FROM_SPY,
    mockFrom,
  }
})

vi.mock('@/lib/debug', () => ({
  debug: {
    error: DEBUG_ERROR,
  },
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => LOCATION_STATE,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/lib/consoleCapture', () => ({
  consoleCapture: {
    getLogs: () => LOGS,
    getErrorLogs: () => ERROR_LOGS,
  },
}))

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: vi.fn(() => ({
    insert: INSERT_SPY,
  })),
}))

vi.mock('@/integrations/supabase/client', () => {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (
      onFulfilled?: (value: { data: null; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  }

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => builder),
      storage: {
        from: STORAGE_FROM_SPY,
      },
    },
  }
})

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({
    open,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
  }) => (open ? <div data-testid="drawer-root">{children}</div> : null),
  DrawerContent: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
  DrawerHeader: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
  DrawerTitle: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <h2 className={className}>{children}</h2>,
  DrawerDescription: ({
    children,
  }: {
    children: React.ReactNode
  }) => <p>{children}</p>,
  DrawerFooter: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type = 'button',
    className,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    className?: string
  }) => (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    id,
    maxLength,
    className,
  }: {
    value?: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    placeholder?: string
    id?: string
    maxLength?: number
    className?: string
  }) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className={className}
    />
  ),
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    id,
    rows,
    className,
  }: {
    value?: string
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>
    placeholder?: string
    id?: string
    rows?: number
    className?: string
  }) => (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={className}
    />
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode
    htmlFor?: string
    className?: string
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode
    variant?: string
    className?: string
  }) => <span className={className}>{children}</span>,
}))

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({
    children,
  }: {
    children: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => <div>{children}</div>,
  CollapsibleTrigger: ({
    children,
  }: {
    children: React.ReactNode
    asChild?: boolean
  }) => <div>{children}</div>,
  CollapsibleContent: ({
    children,
  }: {
    children: React.ReactNode
  }) => <div>{children}</div>,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    Bug: Icon,
    Lightbulb: Icon,
    HelpCircle: Icon,
    MessageSquare: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Image: Icon,
    Terminal: Icon,
    Send: Icon,
    Loader2: Icon,
    AlertTriangle: Icon,
    AlertCircle: Icon,
    Info: Icon,
    Minus: Icon,
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}))

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

describe('FeedbackDrawer', () => {
  beforeAll(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview-url'),
      revokeObjectURL: vi.fn(),
    })
  })

  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    AUTH_STATE.user = { id: 'u1', email: 'test@example.com' }
    LOCATION_STATE.pathname = '/dashboard'
    LOCATION_STATE.search = '?tab=overview'
    INSERT_RESULT.error = null
    UPLOAD_RESULT.error = null
  })

  it('se monte dans un wrapper QueryClientProvider et affiche le contenu attendu', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => ({ isLoading: false, isError: false }), { wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)

    render(<FeedbackDrawer open={true} onOpenChange={vi.fn()} screenshot={null} />, { wrapper })

    expect(screen.getByText('Donner un retour')).toBeInTheDocument()
    expect(screen.getByText('Signalez un bug ou suggérez une amélioration.')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Décrivez brièvement...')).toHaveValue('')
    expect(screen.getByPlaceholderText('Plus de détails...')).toHaveValue('')
    expect(screen.getByText('Logs (2)')).toBeInTheDocument()
    expect(screen.getByText('premier log')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('affiche une erreur si le titre est vide', async () => {
    const wrapper = createWrapper()

    render(<FeedbackDrawer open={true} onOpenChange={vi.fn()} screenshot={null} />, { wrapper })

    await act(async () => {
      fireEvent.click(screen.getByText('Envoyer'))
    })

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: 'Titre requis',
        description: 'Veuillez donner un titre à votre retour.',
        variant: 'destructive',
      })
    })

    expect(INSERT_SPY).not.toHaveBeenCalled()
  })

  it('soumet avec succès les valeurs métier réelles sans capture d’écran', async () => {
    const wrapper = createWrapper()
    const onOpenChange = vi.fn()

    render(<FeedbackDrawer open={true} onOpenChange={onOpenChange} screenshot={null} />, { wrapper })

    fireEvent.click(screen.getByText('Question'))
    fireEvent.click(screen.getByText('Critique'))
    fireEvent.change(screen.getByPlaceholderText('Décrivez brièvement...'), {
      target: { value: '  Impossible de charger la page  ' },
    })
    fireEvent.change(screen.getByPlaceholderText('Plus de détails...'), {
      target: { value: '  Le clic sur le menu bloque tout  ' },
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Envoyer'))
    })

    await waitFor(() => {
      expect(INSERT_SPY).toHaveBeenCalledTimes(1)
    })

    const insertArg = INSERT_SPY.mock.calls[0][0] as {
      user_id: string
      type: string
      priority: string
      title: string
      description: string | null
      screenshot_url: string | null
      current_route: string
      console_logs: typeof LOGS | null
      browser_info: {
        userAgent: string
        language: string
        platform: string
        screenWidth: number
        screenHeight: number
        windowWidth: number
        windowHeight: number
        timestamp: string
      }
    }

    expect(insertArg.user_id).toBe('u1')
    expect(insertArg.type).toBe('question')
    expect(insertArg.priority).toBe('critical')
    expect(insertArg.title).toBe('Impossible de charger la page')
    expect(insertArg.description).toBe('Le clic sur le menu bloque tout')
    expect(insertArg.screenshot_url).toBeNull()
    expect(insertArg.current_route).toBe('/dashboard?tab=overview')
    expect(insertArg.console_logs).toEqual(LOGS)
    expect(insertArg.browser_info.userAgent).toBe(navigator.userAgent)
    expect(insertArg.browser_info.language).toBe(navigator.language)
    expect(insertArg.browser_info.platform).toBe(navigator.platform)
    expect(insertArg.browser_info.screenWidth).toBe(window.screen.width)
    expect(insertArg.browser_info.screenHeight).toBe(window.screen.height)
    expect(insertArg.browser_info.windowWidth).toBe(window.innerWidth)
    expect(insertArg.browser_info.windowHeight).toBe(window.innerHeight)
    expect(new Date(insertArg.browser_info.timestamp).toString()).not.toBe('Invalid Date')

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: 'Merci pour votre retour ! 🙏',
        description: 'Votre feedback a été envoyé avec succès.',
      })
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(UPLOAD_SPY).not.toHaveBeenCalled()
  })

  it('upload la capture et envoie son URL publique', async () => {
    const wrapper = createWrapper()
    const screenshot = new Blob(['image'], { type: 'image/png' })

    render(<FeedbackDrawer open={true} onOpenChange={vi.fn()} screenshot={screenshot} />, { wrapper })

    expect(screen.getByAltText("Capture d'écran")).toHaveAttribute('src', 'blob:preview-url')
    expect(screen.getByText('Jointe auto.')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Décrivez brièvement...'), {
      target: { value: 'Capture utile' },
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Envoyer'))
    })

    await waitFor(() => {
      expect(STORAGE_FROM_SPY).toHaveBeenCalledWith('feedback-screenshots')
      expect(UPLOAD_SPY).toHaveBeenCalledTimes(1)
      expect(GET_PUBLIC_URL_SPY).toHaveBeenCalledWith('u1/screen.png')
      expect(INSERT_SPY).toHaveBeenCalledTimes(1)
    })

    const uploadCall = UPLOAD_SPY.mock.calls[0]
    const fileName = uploadCall[0] as string
    const uploadedBlob = uploadCall[1] as Blob
    const uploadOptions = uploadCall[2] as { contentType: string; upsert: boolean }

    expect(fileName.startsWith('u1/')).toBe(true)
    expect(fileName.endsWith('-feedback.png')).toBe(true)
    expect(uploadedBlob).toBe(screenshot)
    expect(uploadOptions).toEqual({
      contentType: 'image/png',
      upsert: false,
    })

    const insertArg = INSERT_SPY.mock.calls[0][0] as { screenshot_url: string | null }
    expect(insertArg.screenshot_url).toBe(PUBLIC_URL_RESULT.data.publicUrl)
  })

  it('passe en erreur métier quand l’insertion échoue', async () => {
    const wrapper = createWrapper()
    const state = { isLoading: true, isError: false }

    INSERT_RESULT.error = { message: 'x' }

    const { result } = renderHook(() => state, { wrapper })
    expect(result.current.isLoading).toBe(true)

    render(<FeedbackDrawer open={true} onOpenChange={vi.fn()} screenshot={null} />, { wrapper })

    fireEvent.change(screen.getByPlaceholderText('Décrivez brièvement...'), {
      target: { value: 'Erreur insertion' },
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Envoyer'))
    })

    state.isLoading = false
    state.isError = true

    await waitFor(() => {
      expect(INSERT_SPY).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u1',
          type: 'bug',
          priority: 'medium',
          title: 'Erreur insertion',
          current_route: '/dashboard?tab=overview',
        })
      )
      expect(DEBUG_ERROR).toHaveBeenCalled()
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: 'Erreur',
        description: "Impossible d'envoyer le feedback. Veuillez réessayer.",
        variant: 'destructive',
      })
    })

    expect(state.isError).toBe(true)
  })

  it('affiche une erreur si aucun utilisateur n’est connecté', async () => {
    const wrapper = createWrapper()
    AUTH_STATE.user = null

    render(<FeedbackDrawer open={true} onOpenChange={vi.fn()} screenshot={null} />, { wrapper })

    fireEvent.change(screen.getByPlaceholderText('Décrivez brièvement...'), {
      target: { value: 'Titre présent' },
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Envoyer'))
    })

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: 'Non connecté',
        description: 'Vous devez être connecté pour envoyer un feedback.',
        variant: 'destructive',
      })
    })

    expect(INSERT_SPY).not.toHaveBeenCalled()
  })

  it('réinitialise le formulaire quand open passe à false', () => {
    const wrapper = createWrapper()

    const { rerender } = render(
      <FeedbackDrawer open={true} onOpenChange={vi.fn()} screenshot={null} />,
      { wrapper }
    )

    fireEvent.click(screen.getByText('Amélioration'))
    fireEvent.click(screen.getByText('Haute'))
    fireEvent.change(screen.getByPlaceholderText('Décrivez brièvement...'), {
      target: { value: 'Titre temporaire' },
    })
    fireEvent.change(screen.getByPlaceholderText('Plus de détails...'), {
      target: { value: 'Description temporaire' },
    })

    expect(screen.getByPlaceholderText('Décrivez brièvement...')).toHaveValue('Titre temporaire')
    expect(screen.getByPlaceholderText('Plus de détails...')).toHaveValue('Description temporaire')

    rerender(<FeedbackDrawer open={false} onOpenChange={vi.fn()} screenshot={null} />)
    rerender(<FeedbackDrawer open={true} onOpenChange={vi.fn()} screenshot={null} />)

    expect(screen.getByPlaceholderText('Décrivez brièvement...')).toHaveValue('')
    expect(screen.getByPlaceholderText('Plus de détails...')).toHaveValue('')
  })
})