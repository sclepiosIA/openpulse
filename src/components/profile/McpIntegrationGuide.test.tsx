import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public_key')

const {
  getSessionMock,
  mockFrom,
  toastSuccessMock,
  toastErrorMock,
  FETCH_MOCK,
  FETCH_OK_JSON,
  FETCH_EMPTY_JSON,
  SESSION_OK_RESULT,
  SESSION_ERR_RESULT,
  ERROR_OBJ,
  CLIPBOARD_WRITE_TEXT
} = vi.hoisted(() => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason?: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected),
  }
  const getSessionMock = vi.fn()
  const mockFrom = vi.fn(() => builder)
  const toastSuccessMock = vi.fn()
  const toastErrorMock = vi.fn()
  const FETCH_MOCK = vi.fn()
  const FETCH_OK_JSON = { tools_count: 42 }
  const FETCH_EMPTY_JSON = { tools_count: 0 }
  const SESSION_OK_RESULT = { data: { session: { access_token: 'tok' } }, error: null }
  const SESSION_ERR_RESULT = { data: { session: null }, error: { message: 'no' } }
  const ERROR_OBJ = new Error('fail')
  const CLIPBOARD_WRITE_TEXT = vi.fn(() => Promise.resolve())
  return {
    getSessionMock,
    mockFrom,
    toastSuccessMock,
    toastErrorMock,
    FETCH_MOCK,
    FETCH_OK_JSON,
    FETCH_EMPTY_JSON,
    SESSION_OK_RESULT,
    SESSION_ERR_RESULT,
    ERROR_OBJ,
    CLIPBOARD_WRITE_TEXT
  }
})

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: getSessionMock
    }
  }
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock
  }
}))

vi.mock('lucide-react', () => {
  const Comp = ({ children }: { children?: unknown }) => (Array.isArray(children) ? children as unknown as null : null)
  const icon = (name: string) => (props: Record<string, unknown>) => {
    const Tag = 'span' as unknown as 'span'
    return <Tag data-icon={name} {...props} />
  }
  return {
    Plug: icon('Plug'),
    Key: icon('Key'),
    Terminal: icon('Terminal'),
    Wrench: icon('Wrench'),
    Copy: icon('Copy'),
    Check: icon('Check'),
    AlertTriangle: icon('AlertTriangle'),
    Zap: icon('Zap'),
    Users: icon('Users'),
    DollarSign: icon('DollarSign'),
    BookOpen: icon('BookOpen'),
    Headphones: icon('Headphones'),
    BarChart3: icon('BarChart3'),
    FileText: icon('FileText'),
    Mail: icon('Mail'),
    Calendar: icon('Calendar'),
    HeartPulse: icon('HeartPulse'),
    Monitor: icon('Monitor'),
    CheckCircle2: icon('CheckCircle2'),
    XCircle: icon('XCircle'),
    Loader2: icon('Loader2'),
    Info: icon('Info'),
    default: Comp
  }
})

vi.mock('@/components/ui/card', () => {
  const Card = ({ children, ...rest }: { children?: unknown } & Record<string, unknown>) => <div data-testid="card" {...rest}>{children}</div>
  const CardHeader = ({ children, ...rest }: { children?: unknown } & Record<string, unknown>) => <div data-testid="card-header" {...rest}>{children}</div>
  const CardContent = ({ children, ...rest }: { children?: unknown } & Record<string, unknown>) => <div data-testid="card-content" {...rest}>{children}</div>
  const CardDescription = ({ children, ...rest }: { children?: unknown } & Record<string, unknown>) => <div data-testid="card-description" {...rest}>{children}</div>
  const CardTitle = ({ children, ...rest }: { children?: unknown } & Record<string, unknown>) => <h2 data-testid="card-title" {...rest}>{children}</h2>
  return { Card, CardContent, CardDescription, CardHeader, CardTitle }
})

vi.mock('@/components/ui/button', () => {
  const Button = ({ children, onClick, disabled, ...rest }: { children?: unknown; onClick?: () => void; disabled?: boolean } & Record<string, unknown>) => (
    <button onClick={onClick} disabled={disabled} {...rest}>{children}</button>
  )
  return { Button }
})

vi.mock('@/components/ui/alert', () => {
  const Alert = ({ children, ...rest }: { children?: unknown } & Record<string, unknown>) => <div role="alert" {...rest}>{children}</div>
  const AlertTitle = ({ children, ...rest }: { children?: unknown } & Record<string, unknown>) => <div data-testid="alert-title" {...rest}>{children}</div>
  const AlertDescription = ({ children, ...rest }: { children?: unknown } & Record<string, unknown>) => <div data-testid="alert-description" {...rest}>{children}</div>
  return { Alert, AlertTitle, AlertDescription }
})

vi.mock('@/components/ui/badge', () => {
  const Badge = ({ children, ...rest }: { children?: unknown } & Record<string, unknown>) => <span data-testid="badge" {...rest}>{children}</span>
  return { Badge }
})

vi.mock('@/components/ui/accordion', () => {
  const Accordion = ({ children, ...rest }: { children?: unknown } & Record<string, unknown>) => <div data-testid="accordion" {...rest}>{children}</div>
  const AccordionItem = ({ children, ...rest }: { children?: unknown } & Record<string, unknown>) => <div data-testid="accordion-item" {...rest}>{children}</div>
  const AccordionTrigger = ({ children, ...rest }: { children?: unknown } & Record<string, unknown>) => <button data-testid="accordion-trigger" {...rest}>{children}</button>
  const AccordionContent = ({ children, ...rest }: { children?: unknown } & Record<string, unknown>) => <div data-testid="accordion-content" {...rest}>{children}</div>
  return { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
})

interface FetchInit {
  method?: string
  headers?: Record<string, string | undefined>
}

describe('McpIntegrationGuide component', () => {
  let McpIntegrationGuide: React.ComponentType

  const renderWithProviders = (ui: React.ReactElement) => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 }
      }
    })
    return render(
      <QueryClientProvider client={client}>
        {ui}
      </QueryClientProvider>
    )
  }

  beforeAll(async () => {
    const nav = window.navigator as unknown as Navigator & { clipboard?: { writeText: (text: string) => Promise<void> } }
    nav.clipboard = { writeText: CLIPBOARD_WRITE_TEXT }
  })

  beforeEach(async () => {
    cleanup()
    getSessionMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    FETCH_MOCK.mockReset()
    CLIPBOARD_WRITE_TEXT.mockReset()
    ;(globalThis as unknown as { fetch: typeof fetch }).fetch = FETCH_MOCK as unknown as typeof fetch
    const mod = await import('./McpIntegrationGuide')
    McpIntegrationGuide = mod.McpIntegrationGuide
  })

  it('renders key sections and CTA texts', async () => {
    renderWithProviders(<McpIntegrationGuide />)
    expect(screen.getByText('Protocole MCP — Model Context Protocol')).toBeInTheDocument()
    expect(screen.getByText('Diagnostic rapide')).toBeInTheDocument()
    expect(screen.getByText('Compatibilité par client Claude')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Générer mon token/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tester la connexion MCP/i })).toBeInTheDocument()
  })

  it('generates token successfully and displays it', async () => {
    getSessionMock.mockResolvedValueOnce(SESSION_OK_RESULT)
    renderWithProviders(<McpIntegrationGuide />)
    const btn = screen.getByRole('button', { name: /Générer mon token/i })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Token généré avec succès')
    })
    expect(screen.getByText('tok')).toBeInTheDocument()
  })

  it('handles token generation error when session missing', async () => {
    getSessionMock.mockResolvedValueOnce(SESSION_ERR_RESULT)
    renderWithProviders(<McpIntegrationGuide />)
    const btn = screen.getByRole('button', { name: /Générer mon token/i })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Impossible de récupérer la session. Reconnectez-vous.')
    })
    expect(screen.queryByText('tok')).not.toBeInTheDocument()
  })

  it('copies token to clipboard and shows toast', async () => {
    getSessionMock.mockResolvedValueOnce(SESSION_OK_RESULT)
    renderWithProviders(<McpIntegrationGuide />)
    fireEvent.click(screen.getByRole('button', { name: /Générer mon token/i }))

    await screen.findByText('tok')
    const copyBtn = screen.getByRole('button', { name: 'Valider' })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(CLIPBOARD_WRITE_TEXT).toHaveBeenCalledWith('tok')
      expect(toastSuccessMock).toHaveBeenCalledWith('Copié !')
    })
  })

  it('health check success shows tools count and latency, and sends apikey header', async () => {
    FETCH_MOCK.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(FETCH_OK_JSON)
    })
    renderWithProviders(<McpIntegrationGuide />)

    const btn = screen.getByRole('button', { name: /Tester la connexion MCP/i })
    fireEvent.click(btn)

    await screen.findByText('Serveur MCP accessible')
    expect(screen.getByText(/Outils disponibles :/)).toHaveTextContent('Outils disponibles : 42')
    expect(screen.getByText(/Latence :/)).toBeInTheDocument()

    const call = FETCH_MOCK.mock.calls[0]
    expect(call).toBeTruthy()
    const url = call[0] as string
    const init = call[1] as FetchInit
    expect(url.includes('?health=1')).toBe(true)
    expect(init.headers?.apikey).toBe('public_key')
    expect(init.method).toBe('GET')
  })

  it('health check handles HTTP error status', async () => {
    FETCH_MOCK.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve(FETCH_EMPTY_JSON)
    })
    renderWithProviders(<McpIntegrationGuide />)

    fireEvent.click(screen.getByRole('button', { name: /Tester la connexion MCP/i }))

    await screen.findByText('Serveur MCP inaccessible')
    expect(screen.getByText(/Erreur :/)).toHaveTextContent('Erreur : HTTP 503')
  })

  it('health check handles network error', async () => {
    FETCH_MOCK.mockRejectedValueOnce(ERROR_OBJ)
    renderWithProviders(<McpIntegrationGuide />)

    fireEvent.click(screen.getByRole('button', { name: /Tester la connexion MCP/i }))

    await screen.findByText('Serveur MCP inaccessible')
    expect(screen.getByText(/Erreur :/)).toHaveTextContent('Erreur : fail')
  })
})