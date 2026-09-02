import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ParametresSocial from './ParametresSocial'

const {
  MOCK_PERMS,
  MOCK_BRANDS_LOADING,
  MOCK_BRANDS_SUCCESS,
  MOCK_BRANDS_ERROR,
  MOCK_CONNS_LOADING,
  MOCK_CONNS_SUCCESS,
  MOCK_CONNS_ERROR,
  mockUseRolePermissions,
  mockUseSocialBrands,
  mockUseSocialConnections,
  mockInvoke,
  mockToastError,
} = vi.hoisted(() => {
  const MOCK_PERMS = {
    role: 'admin',
    isLoading: false,
  }

  const MOCK_BRANDS_LOADING = {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }

  const MOCK_BRANDS_SUCCESS = {
    data: [
      {
        id: 'b1',
        name: 'Marque A',
        slug: 'brand-a',
        color_hex: '#123456',
        is_anonymous: false,
      },
      {
        id: 'b2',
        name: 'Marque B',
        slug: 'brand-b',
        color_hex: null,
        is_anonymous: true,
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }

  const MOCK_BRANDS_ERROR = {
    data: undefined,
    isLoading: false,
    isError: true,
    error: new Error('brands error'),
    refetch: vi.fn(),
  }

  const MOCK_CONNS_LOADING = {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }

  const MOCK_CONNS_SUCCESS = {
    data: [
      {
        id: 'c1',
        brand_id: 'b1',
        platform: 'facebook',
        status: 'active',
        external_user_name: 'Page FB A',
      },
      {
        id: 'c2',
        brand_id: 'b2',
        platform: 'instagram',
        status: 'expired',
        external_user_name: 'Insta B',
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }

  const MOCK_CONNS_ERROR = {
    data: undefined,
    isLoading: false,
    isError: true,
    error: new Error('conns error'),
    refetch: vi.fn(),
  }

  const mockUseRolePermissions = vi.fn(() => MOCK_PERMS)
  const mockUseSocialBrands = vi.fn(() => MOCK_BRANDS_SUCCESS)
  const mockUseSocialConnections = vi.fn(() => MOCK_CONNS_SUCCESS)

  const mockInvoke = vi.fn()

  const mockToastError = vi.fn()

  return {
    MOCK_PERMS,
    MOCK_BRANDS_LOADING,
    MOCK_BRANDS_SUCCESS,
    MOCK_BRANDS_ERROR,
    MOCK_CONNS_LOADING,
    MOCK_CONNS_SUCCESS,
    MOCK_CONNS_ERROR,
    mockUseRolePermissions,
    mockUseSocialBrands,
    mockUseSocialConnections,
    mockInvoke,
    mockToastError,
  }
})

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{props.children}</button>
  ),
}))

vi.mock('@/components/ui/card', () => ({
  Card: (props: { children: React.ReactNode }) => <div data-testid="card">{props.children}</div>,
  CardContent: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
  CardHeader: (props: { children: React.ReactNode; className?: string }) => (
    <div className={props.className}>{props.children}</div>
  ),
  CardTitle: (props: { children: React.ReactNode; className?: string }) => (
    <div className={props.className}>{props.children}</div>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: (props: { children: React.ReactNode; variant?: string; className?: string }) => (
    <span data-variant={props.variant} className={props.className}>
      {props.children}
    </span>
  ),
}))

vi.mock('@/components/shared/PageDataState', () => ({
  PageDataState: (props: {
    isLoading: boolean
    isError: boolean
    error: Error | null
    loadingLabel?: string
    onRetry?: () => void
    children: React.ReactNode
  }) => {
    if (props.isLoading) {
      return <div>{props.loadingLabel ?? 'Loading'}</div>
    }
    if (props.isError) {
      return (
        <div>
          <div>Erreur</div>
          <div>{props.error?.message}</div>
          {props.onRetry && (
            <button onClick={props.onRetry}>Réessayer</button>
          )}
        </div>
      )
    }
    return <div>{props.children}</div>
  },
}))

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => mockUseRolePermissions(),
}))

vi.mock('@/hooks/social/useSocialBrands', () => ({
  useSocialBrands: () => mockUseSocialBrands(),
}))

vi.mock('@/hooks/social/useSocialConnections', () => ({
  useSocialConnections: () => mockUseSocialConnections(),
}))

vi.mock('@/components/social/PlatformBadge', () => ({
  PlatformBadge: (props: { platform: string }) => (
    <span data-testid={`platform-${props.platform}`}>{props.platform}</span>
  ),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: vi.fn(() => {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      const thenable: unknown = {
        select: chain,
        eq: chain,
        gte: chain,
        lte: chain,
        in: chain,
        order: chain,
        limit: chain,
        insert: chain,
        update: chain,
        delete: chain,
        single: () => Promise.resolve({ data: null, error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
        catch: (onRejected: (e: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).catch(onRejected),
      }
      return thenable
    }),
  },
}))

vi.mock('@/types/social', () => ({
  PLATFORM_LABELS: {
    facebook: 'Facebook',
    instagram: 'Instagram',
  },
  BRAND_DEFAULT_PLATFORMS: {
    'brand-a': ['facebook', 'instagram'],
    'brand-b': ['instagram'],
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return render(
    <QueryClientProvider client={client}>
      {ui}
    </QueryClientProvider>,
  )
}

describe('ParametresSocial', () => {
  beforeEach(() => {
    mockUseRolePermissions.mockReturnValue(MOCK_PERMS)
    mockUseSocialBrands.mockReturnValue(MOCK_BRANDS_SUCCESS)
    mockUseSocialConnections.mockReturnValue(MOCK_CONNS_SUCCESS)
    mockInvoke.mockReset()
    mockToastError.mockReset()
  })

  it('affiche l’état de chargement combiné', () => {
    mockUseSocialBrands.mockReturnValue(MOCK_BRANDS_LOADING)
    mockUseSocialConnections.mockReturnValue(MOCK_CONNS_LOADING)

    renderWithClient(<ParametresSocial />)

    expect(screen.getByText('Chargement des connexions…')).toBeInTheDocument()
  })

  it('affiche un message réservé si le rôle est non autorisé', () => {
    mockUseRolePermissions.mockReturnValue({
      role: 'user',
      isLoading: false,
    })
    mockUseSocialBrands.mockReturnValue(MOCK_BRANDS_SUCCESS)
    mockUseSocialConnections.mockReturnValue(MOCK_CONNS_SUCCESS)

    renderWithClient(<ParametresSocial />)

    expect(screen.getByText('Erreur')).toBeInTheDocument()
    expect(
      screen.getByText("Réservé à l'administration / direction."),
    ).toBeInTheDocument()
  })

  it('affiche une erreur quand la requête marques échoue', () => {
    mockUseSocialBrands.mockReturnValue(MOCK_BRANDS_ERROR)
    mockUseSocialConnections.mockReturnValue(MOCK_CONNS_SUCCESS)

    renderWithClient(<ParametresSocial />)

    expect(screen.getByText('Erreur')).toBeInTheDocument()
    expect(screen.getByText('brands error')).toBeInTheDocument()
  })

  it('affiche une erreur quand la requête connexions échoue', () => {
    mockUseSocialBrands.mockReturnValue(MOCK_BRANDS_SUCCESS)
    mockUseSocialConnections.mockReturnValue(MOCK_CONNS_ERROR)

    renderWithClient(<ParametresSocial />)

    expect(screen.getByText('Erreur')).toBeInTheDocument()
    expect(screen.getByText('conns error')).toBeInTheDocument()
  })

  it('permet de relancer les requêtes en cas d’erreur', () => {
    const brandsError = { ...MOCK_BRANDS_ERROR, refetch: vi.fn() }
    const connsError = { ...MOCK_CONNS_ERROR, refetch: vi.fn() }
    mockUseSocialBrands.mockReturnValue(brandsError)
    mockUseSocialConnections.mockReturnValue(connsError)

    renderWithClient(<ParametresSocial />)

    const retryButton = screen.getByText('Réessayer')
    fireEvent.click(retryButton)

    expect(brandsError.refetch).toHaveBeenCalledTimes(1)
    expect(connsError.refetch).toHaveBeenCalledTimes(1)
  })

  it('affiche les marques, plateformes et états des connexions', () => {
    renderWithClient(<ParametresSocial />)

    expect(screen.getByText('Marque A')).toBeInTheDocument()
    expect(screen.getByText('Marque B')).toBeInTheDocument()

    expect(screen.getByText('Facebook')).toBeInTheDocument()
    expect(screen.getAllByText('Instagram').length).toBeGreaterThanOrEqual(1)

    expect(screen.getByText('Page FB A')).toBeInTheDocument()
    expect(screen.getByText('Insta B')).toBeInTheDocument()

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('expired')).toBeInTheDocument()

    expect(screen.getByText('Reconnecter')).toBeInTheDocument()
    expect(screen.getAllByText('Connecter').length).toBeGreaterThanOrEqual(1)
  })

  it('appelle la fonction supabase et redirige quand la connexion réussit', async () => {
    const originalLocation = window.location
    // @ts-expect-error test override
    delete (window as unknown as { location: unknown }).location
    // @ts-expect-error test override
    window.location = { href: '' }

    mockInvoke.mockResolvedValue({
      data: { auth_url: '/oauth/mock' },
      error: null,
    })

    renderWithClient(<ParametresSocial />)

    const connectButtons = screen.getAllByText(/Connecter|Reconnecter/)
    const targetButton = connectButtons[0]

    await act(async () => {
      fireEvent.click(targetButton)
    })

    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockInvoke).toHaveBeenCalledWith('social-oauth-start', {
      body: {
        brand_id: 'b1',
        platform: 'facebook',
        return_to: '/parametres/social',
      },
    })
    expect(window.location.href).toBe('/oauth/mock')

    window.location = originalLocation
  })

  it('affiche une erreur toast et ne redirige pas quand supabase renvoie une erreur', async () => {
    const originalLocation = window.location
    // @ts-expect-error test override
    delete (window as unknown as { location: unknown }).location
    // @ts-expect-error test override
    window.location = { href: '' }

    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'invoke error' },
    })

    renderWithClient(<ParametresSocial />)

    const connectButtons = screen.getAllByText(/Connecter|Reconnecter/)
    const targetButton = connectButtons[0]

    await act(async () => {
      fireEvent.click(targetButton)
    })

    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockToastError).toHaveBeenCalledWith('invoke error')
    expect(window.location.href).toBe('')

    window.location = originalLocation
  })

  it("affiche une erreur toast si l’URL d’auth manquante", async () => {
    const originalLocation = window.location
    // @ts-expect-error test override
    delete (window as unknown as { location: unknown }).location
    // @ts-expect-error test override
    window.location = { href: '' }

    mockInvoke.mockResolvedValue({
      data: {},
      error: null,
    })

    renderWithClient(<ParametresSocial />)

    const connectButtons = screen.getAllByText(/Connecter|Reconnecter/)
    const targetButton = connectButtons[0]

    await act(async () => {
      fireEvent.click(targetButton)
    })

    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockToastError).toHaveBeenCalledWith("URL d'autorisation manquante")
    expect(window.location.href).toBe('')

    window.location = originalLocation
  })
})