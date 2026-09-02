// @vitest-environment jsdom
import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import UserProfile from './UserProfile'

const {
  AUTH_STATE,
  PROFILE_ROW,
  ROLE_ROW,
  mockFrom,
  mockToast,
  mockCheck2FAEnabled,
  mockDebugError,
  mockDebugLog,
  getSessionMock,
  passthroughFactory,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.dev' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  PROFILE_ROW: {
    id: 'p1',
    user_id: 'u1',
    nom: 'Doe',
    prenom: 'Jane',
    email: 'jane.doe@test.dev',
    two_factor_enabled: false,
    created_at: '2024-01-15T00:00:00.000Z',
    updated_at: '2024-02-20T00:00:00.000Z',
    email_signature: 'Cordialement',
    avatar_url: 'https://img.dev/a.png',
    linkedin_url: 'https://linkedin.dev/in/jane',
  },
  ROLE_ROW: { role: 'admin_user' },
  mockFrom: vi.fn(),
  mockToast: vi.fn(),
  mockCheck2FAEnabled: vi.fn(),
  mockDebugError: vi.fn(),
  mockDebugLog: vi.fn(),
  getSessionMock: vi.fn(),
  passthroughFactory: (tag: string) => {
    return ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) =>
      React.createElement(tag, props, children)
  },
}))

type QueryResponse = { data: unknown; error: { message: string } | null }

function createThenableBuilder(response: QueryResponse) {
  const promise = Promise.resolve(response)
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
    single: vi.fn(() => promise),
    maybeSingle: vi.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  }
  return builder
}

vi.mock('@/components/ui/card', () => ({
  Card: passthroughFactory('div'),
  CardContent: passthroughFactory('div'),
  CardDescription: passthroughFactory('div'),
  CardHeader: passthroughFactory('div'),
  CardTitle: passthroughFactory('div'),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.PropsWithChildren<
    React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }
  >) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    ...props
  }: React.PropsWithChildren<React.LabelHTMLAttributes<HTMLLabelElement>>) => (
    <label {...props}>{children}</label>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: passthroughFactory('span'),
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: passthroughFactory('div'),
  AlertDescription: passthroughFactory('div'),
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span aria-hidden="true" />
  return {
    Shield: Icon,
    User: Icon,
    Mail: Icon,
    Calendar: Icon,
    CheckCircle: Icon,
    XCircle: Icon,
    Settings2: Icon,
    Linkedin: Icon,
    ExternalLink: Icon,
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/hooks/auth/use2FA', () => ({
  use2FA: () => ({ check2FAEnabled: mockCheck2FAEnabled }),
}))

vi.mock('@/components/auth/TwoFactorSetup', () => ({
  TwoFactorSetup: ({
    onComplete,
    onCancel,
  }: {
    onComplete: () => void | Promise<void>
    onCancel: () => void
  }) => (
    <div>
      <button onClick={() => void onComplete()}>complete-2fa</button>
      <button onClick={onCancel}>cancel-2fa</button>
    </div>
  ),
}))

vi.mock('@/components/email/EmailSignatureEditor', () => ({
  EmailSignatureEditor: ({
    profileId,
    initialSignature,
  }: {
    profileId: string
    initialSignature: string
  }) => (
    <div data-testid="email-signature-editor">
      {profileId}:{initialSignature}
    </div>
  ),
}))

vi.mock('@/components/ui/UserAvatarUpload', () => ({
  UserAvatarUpload: ({
    currentAuthUserId,
    profileId,
    currentAvatarUrl,
    userName,
  }: {
    currentAuthUserId: string
    profileId: string
    currentAvatarUrl?: string | null
    userName: string
    onAvatarChange?: (url: string | null) => void
  }) => (
    <div data-testid="avatar-upload">
      {currentAuthUserId}|{profileId}|{currentAvatarUrl}|{userName}
    </div>
  ),
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    log: mockDebugLog,
  },
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: getSessionMock,
    },
  },
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

describe('UserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheck2FAEnabled.mockResolvedValue(false)
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return createThenableBuilder({ data: PROFILE_ROW, error: null })
      }
      if (table === 'user_roles') {
        return createThenableBuilder({ data: ROLE_ROW, error: null })
      }
      return createThenableBuilder({ data: null, error: null })
    })
  })

  it('affiche le chargement puis les informations du profil avec les valeurs métier attendues', async () => {
    renderHook(() => 1, { wrapper: createWrapper() })

    render(<UserProfile />, { wrapper: createWrapper() })

    expect(document.querySelector('.animate-spin')).toBeTruthy()

    await screen.findByDisplayValue('Jane')
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument()
    expect(screen.getByDisplayValue('jane.doe@test.dev')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://linkedin.dev/in/jane')).toBeInTheDocument()
    expect(screen.getByText('Admin user')).toBeInTheDocument()
    expect(screen.getByText('15/01/2024')).toBeInTheDocument()
    expect(screen.getByText('20/02/2024')).toBeInTheDocument()
    expect(screen.getByText('Désactivé')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configurer' })).toBeInTheDocument()
    expect(screen.getByTestId('email-signature-editor')).toHaveTextContent('p1:Cordialement')
    expect(screen.getByTestId('avatar-upload')).toHaveTextContent('u1|p1|https://img.dev/a.png|Jane Doe')
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://linkedin.dev/in/jane')

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockFrom).toHaveBeenCalledWith('user_roles')
    expect(mockCheck2FAEnabled).toHaveBeenCalledTimes(1)
  })

  it("met à jour l'URL LinkedIn et affiche un toast de succès", async () => {
    const updateBuilder = createThenableBuilder({ data: null, error: null })
    const profileBuilder = createThenableBuilder({ data: PROFILE_ROW, error: null })
    profileBuilder.update = vi.fn(() => updateBuilder)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileBuilder
      if (table === 'user_roles') return createThenableBuilder({ data: ROLE_ROW, error: null })
      return createThenableBuilder({ data: null, error: null })
    })

    render(<UserProfile />, { wrapper: createWrapper() })

    const input = await screen.findByDisplayValue('https://linkedin.dev/in/jane')
    fireEvent.change(input, { target: { value: 'https://linkedin.dev/in/jane-new' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    })

    expect(profileBuilder.update).toHaveBeenCalledWith({
      linkedin_url: 'https://linkedin.dev/in/jane-new',
    })

    await waitFor(() => {
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'p1')
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'URL LinkedIn mise à jour',
    })
    expect(screen.getByDisplayValue('https://linkedin.dev/in/jane-new')).toBeInTheDocument()
  })

  it("désactive le 2FA et appelle la mise à jour Supabase avec les bonnes données", async () => {
    mockCheck2FAEnabled.mockResolvedValue(true)

    const updateBuilder = createThenableBuilder({ data: null, error: null })
    const profileBuilder = createThenableBuilder({ data: PROFILE_ROW, error: null })
    profileBuilder.update = vi.fn(() => updateBuilder)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileBuilder
      if (table === 'user_roles') return createThenableBuilder({ data: ROLE_ROW, error: null })
      return createThenableBuilder({ data: null, error: null })
    })

    render(<UserProfile />, { wrapper: createWrapper() })

    const disableButton = await screen.findByRole('button', { name: 'Désactiver' })

    await act(async () => {
      fireEvent.click(disableButton)
    })

    expect(profileBuilder.update).toHaveBeenCalledWith({
      two_factor_enabled: false,
      two_factor_secret: null,
      temp_2fa_secret: null,
    })

    await waitFor(() => {
      expect(updateBuilder.eq).toHaveBeenCalledWith('user_id', 'u1')
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: '2FA désactivé',
      description: "L'authentification à deux facteurs a été désactivée",
    })

    await waitFor(() => {
      expect(screen.getByText('Désactivé')).toBeInTheDocument()
    })
  })

  it("affiche l'état d'erreur si le chargement du profil échoue", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return createThenableBuilder({ data: null, error: { message: 'x' } })
      }
      if (table === 'user_roles') {
        return createThenableBuilder({ data: ROLE_ROW, error: null })
      }
      return createThenableBuilder({ data: null, error: null })
    })

    render(<UserProfile />, { wrapper: createWrapper() })

    expect(
      await screen.findByText('Impossible de charger les informations du profil utilisateur.')
    ).toBeInTheDocument()

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger le profil utilisateur',
      variant: 'destructive',
    })
    expect(mockDebugError).toHaveBeenCalled()
  })
})