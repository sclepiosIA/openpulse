import React, { type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { TutorielPreviewWrapper, mockHeroMetricsProps, mockEmailThread, mockEmailThreads, mockEtablissement, mockProfiles, mockThreadEnrichedData } from './TutorielMockProviders'

const { stableUser, toast } = vi.hoisted(() => ({
  stableUser: { id: 'u1', email: 't@t.co' },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}))

vi.mock('@/integrations/supabase/client', () => {
  const builder: Record<string, unknown> = {
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
    then: vi.fn((onFulfilled?: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(onFulfilled)),
    catch: vi.fn((onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected)),
  }

  const mockFrom = vi.fn(() => builder)

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: stableUser } }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: stableUser }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signOut: vi.fn(async () => ({ error: null })),
      },
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ data: null, error: null })),
          download: vi.fn(async () => ({ data: null, error: null })),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
          remove: vi.fn(async () => ({ data: null, error: null })),
          list: vi.fn(async () => ({ data: [], error: null })),
        })),
      },
      rpc: vi.fn(async () => ({ data: null, error: null })),
      channel: vi.fn(() => ({
        on: vi.fn(() => ({ subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) })),
        subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
      })),
      removeChannel: vi.fn(),
    },
  }
})

vi.mock('sonner', () => ({ toast }))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'k1' }),
    useParams: () => ({}),
  }
})

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: stableUser,
    session: { user: stableUser },
    isLoading: false,
    isAuthenticated: true,
  }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: stableUser,
    session: { user: stableUser },
    isLoading: false,
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: PropsWithChildren) => React.createElement(React.Fragment, null, children),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: stableUser,
    session: { user: stableUser },
    isLoading: false,
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: PropsWithChildren) => React.createElement(React.Fragment, null, children),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return Wrapper
}

describe('TutorielMockProviders', () => {
  it('TutorielPreviewWrapper rend les enfants et applique le style de scale quand scale != 1', () => {
    render(
      <TutorielPreviewWrapper scale={0.8}>
        <button type="button">Clique</button>
      </TutorielPreviewWrapper>,
    )

    const btn = screen.getByRole('button', { name: 'Clique' })
    const container = btn.parentElement
    expect(container).not.toBeNull()
    if (!container) return

    expect(container.className).toContain('pointer-events-none')
    expect(container.className).toContain('select-none')
    expect(container.style.transform).toBe('scale(0.8)')
    expect(container.style.transformOrigin).toBe('top left')
  })

  it('TutorielPreviewWrapper ne définit pas transform quand scale == 1', () => {
    render(
      <TutorielPreviewWrapper scale={1}>
        <div>Contenu</div>
      </TutorielPreviewWrapper>,
    )

    const el = screen.getByText('Contenu')
    const container = el.parentElement
    expect(container).not.toBeNull()
    if (!container) return

    expect(container.style.transform).toBe('')
    expect(container.style.transformOrigin).toBe('top left')
  })

  it('expose des données mockées cohérentes (métier)', () => {
    expect(mockHeroMetricsProps.totalEtablissements).toBe(127)
    expect(mockHeroMetricsProps.totalValeur).toBe(2450000)
    expect(mockHeroMetricsProps.urgentTasksCount).toBe(8)
    expect(mockHeroMetricsProps.conversionRate).toBe(42)

    expect(mockEmailThread.id).toBe('demo-thread-1')
    expect(mockEmailThread.unread_count).toBe(2)
    expect(mockEmailThread.priority).toBe('haute')
    expect(mockEmailThread.participants.length).toBe(2)
    expect(mockEmailThread.participants[0]?.email).toBe('marie.dupont@cabinet-glycines.example.org')

    expect(mockEmailThreads).toHaveLength(3)
    expect(mockEmailThreads.map((t) => t.id)).toEqual(['demo-thread-1', 'demo-thread-2', 'demo-thread-3'])
    expect(mockEmailThreads[1]?.category).toBe('Support')
    expect(mockEmailThreads[1]?.unread_count).toBe(0)
    expect(mockEmailThreads[2]?.priority).toBe('basse')

    expect(mockEtablissement.id).toBe('demo-etab-1')
    expect(mockEtablissement.nom).toContain('Cabinet')
    expect(mockEtablissement.progression).toBe(75)
    expect(mockEtablissement.nombre_lits).toBe(120)
    expect(mockEtablissement.region).toBe("Provence-Alpes-Côte d'Azur")

    expect(mockProfiles).toHaveLength(3)
    expect(mockProfiles[0]?.email).toBe('s.bernard@marque.ai')
    expect(mockProfiles[2]?.prenom).toBe('Julie')

    expect(mockThreadEnrichedData.size).toBe(3)
    const enriched1 = mockThreadEnrichedData.get('demo-thread-1')
    expect(enriched1?.contact.nom).toBe('Marie Dupont')
    expect(enriched1?.contactRole).toBe('direction')
    expect(enriched1?.hasReply).toBe(true)
  })

  it('renderHook dans QueryClientProvider: état loading -> succès -> erreur (hook local de test)', async () => {
    const Wrapper = createWrapper()

    type ResultState = { isLoading: boolean; isError: boolean; data?: { value: number }; error?: string }

    function useLocalQuery(mode: 'success' | 'error') {
      const ReactActual = React
      const [state, setState] = ReactActual.useState<ResultState>({ isLoading: true, isError: false })

      ReactActual.useEffect(() => {
        let active = true
        const t = setTimeout(() => {
          if (!active) return
          if (mode === 'success') setState({ isLoading: false, isError: false, data: { value: 12 } })
          else setState({ isLoading: false, isError: true, error: 'x' })
        }, 0)
        return () => {
          active = false
          clearTimeout(t)
        }
      }, [mode])

      return state
    }

    const { result, rerender } = renderHook(({ mode }) => useLocalQuery(mode), {
      wrapper: Wrapper,
      initialProps: { mode: 'success' as const },
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isError).toBe(false)

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isError).toBe(false)
      expect(result.current.data?.value).toBe(12)
    })

    rerender({ mode: 'error' as const })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isError).toBe(true)
      expect(result.current.error).toBe('x')
    })
  })

  it('mutation: déclenchement dans act et vérification des paramètres (hook local de test)', async () => {
    const Wrapper = createWrapper()
    const mutateFn = vi.fn(async (payload: { id: string; value: number }) => ({ ok: true, payload }))

    function useLocalMutation() {
      const ReactActual = React
      const [status, setStatus] = ReactActual.useState<'idle' | 'pending' | 'success'>('idle')

      const mutate = async (payload: { id: string; value: number }) => {
        setStatus('pending')
        await mutateFn(payload)
        setStatus('success')
      }

      return { status, mutate }
    }

    const { result } = renderHook(() => useLocalMutation(), { wrapper: Wrapper })

    expect(result.current.status).toBe('idle')

    await React.act(async () => {
      await result.current.mutate({ id: 'a1', value: 3 })
    })

    expect(mutateFn).toHaveBeenCalledTimes(1)
    expect(mutateFn).toHaveBeenCalledWith({ id: 'a1', value: 3 })
    expect(result.current.status).toBe('success')
  })
})