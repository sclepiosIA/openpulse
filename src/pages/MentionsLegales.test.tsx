import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { MENTIONS_LEGALES_MD, mockFrom, userAuthState, mockNavigate, toastMock } = vi.hoisted(() => {
  const md = [
    '# Mentions légales',
    '',
    'Responsable de publication : **OpenPulse**',
    '',
    '- Point A',
    '- Point B',
    '',
    '| Champ | Valeur |',
    '| --- | --- |',
    '| A | B |',
  ].join('\n')

  const user = { id: 'u1', email: 't@t.co' }
  const session = { user: { id: 'u1' } }

  return {
    MENTIONS_LEGALES_MD: md,
    mockFrom: vi.fn(),
    userAuthState: { user, session, isLoading: false },
    mockNavigate: vi.fn(),
    toastMock: { success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }
})

vi.mock('@/content/legal', () => ({
  MENTIONS_LEGALES_MD,
}))

function createThenableBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    in: vi.fn(() => builder),
    contains: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    like: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: vi.fn((onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
    ),
    catch: vi.fn((onRejected: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected)),
  }
  return builder
}

vi.mock('@/integrations/supabase/client', () => {
  const builder = createThenableBuilder()
  mockFrom.mockReturnValue(builder)
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: userAuthState.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: userAuthState.user }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signOut: vi.fn(async () => ({ error: null })),
      },
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ data: null, error: null })),
          remove: vi.fn(async () => ({ data: null, error: null })),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://localhost/file' } })),
        })),
      },
      rpc: vi.fn(async () => ({ data: null, error: null })),
    },
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => userAuthState,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => userAuthState,
  useSession: () => userAuthState.session,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => userAuthState,
}))

vi.mock('@/hooks/useAdminRole', () => ({
  useAdminRole: () => true,
}))

vi.mock('sonner', () => ({
  toast: toastMock,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/mentions-legales', search: '', hash: '', state: null, key: 'k1' }),
    useParams: () => ({}),
  }
})

import MentionsLegales from './MentionsLegales'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => createQueryClient())
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('MentionsLegales', () => {
  it('met à jour le titre du document et affiche le contenu markdown', async () => {
    document.title = 'Avant'

    render(<MentionsLegales />, { wrapper: Providers })

    await waitFor(() => {
      expect(document.title).toBe('Mentions légales — OpenPulse')
    })

    expect(screen.getByRole('heading', { level: 1, name: 'Mentions légales' })).toBeTruthy()
    expect(screen.getByText('Responsable de publication :', { exact: false })).toBeTruthy()
    expect(screen.getByText('OpenPulse')).toBeTruthy()

    const list = screen.getByRole('list')
    expect(list.textContent).toContain('Point A')
    expect(list.textContent).toContain('Point B')

    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByText('Champ')).toBeTruthy()
    expect(screen.getByText('Valeur')).toBeTruthy()
    expect(screen.getByText('A')).toBeTruthy()
    expect(screen.getByText('B')).toBeTruthy()
  })
})