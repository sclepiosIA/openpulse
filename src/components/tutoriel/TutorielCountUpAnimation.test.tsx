import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TutorielCountUpAnimation, TutorielProgressBar, TutorielChartBar } from './TutorielCountUpAnimation'

const { stableUser, mockCn } = vi.hoisted(() => ({
  stableUser: { user: { id: 'u1', email: 't@t.co' }, session: { user: { id: 'u1' } }, isLoading: false },
  mockCn: vi.fn((...args: Array<unknown>) => args.filter(Boolean).join(' '))
}))

vi.mock('@/lib/utils', () => ({
  cn: mockCn
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected)
  }

  const mockFrom = vi.fn(() => builder)

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signOut: vi.fn(async () => ({ error: null }))
      },
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ data: null, error: null })),
          remove: vi.fn(async () => ({ data: null, error: null })),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } }))
        }))
      }
    }
  }
})

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableUser
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableUser,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableUser,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'k' }),
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), vi.fn()]
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  }
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  })
}

function getWrapper() {
  const queryClient = createQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('TutorielCountUpAnimation', () => {
  it('affiche la valeur initiale à 0 avec opacité 0 tant que le délai n’est pas passé, puis affiche préfixe/suffixe et format fr-FR', async () => {
    vi.useFakeTimers()
    const rafQueue: Array<FrameRequestCallback> = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })

    const dateSpy = vi.spyOn(Date, 'now')
    dateSpy.mockReturnValue(1000)

    const { container } = render(
      <TutorielCountUpAnimation value={1234} prefix="€" suffix=" TTC" duration={2000} delay={500} />
    )

    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span?.textContent).toBe('€0 TTC')
    expect(span?.className).toContain('opacity-0')

    await act(async () => {
      vi.advanceTimersByTime(499)
    })
    expect(span?.textContent).toBe('€0 TTC')
    expect(span?.className).toContain('opacity-0')
    expect(rafSpy).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })

    expect(rafSpy).toHaveBeenCalledTimes(1)
    expect(span?.className).not.toContain('opacity-0')

    await act(async () => {
      dateSpy.mockReturnValue(3000) // progress = 1
      const cb = rafQueue.shift()
      cb?.(0)
    })

    expect(span?.textContent).toBe('€1\u202f234 TTC')

    rafSpy.mockRestore()
    dateSpy.mockRestore()
    vi.useRealTimers()
  })

  it('gère les décimales avec toFixed', async () => {
    vi.useFakeTimers()
    const rafQueue: Array<FrameRequestCallback> = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const dateSpy = vi.spyOn(Date, 'now')

    dateSpy.mockReturnValue(0)
    const { container } = render(
      <TutorielCountUpAnimation value={12.345} decimals={2} duration={1000} delay={0} />
    )

    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span?.textContent).toBe('0.00')

    await act(async () => {
      // start immediately: timeout(0)
      vi.advanceTimersByTime(0)
    })
    expect(rafSpy).toHaveBeenCalledTimes(1)

    await act(async () => {
      dateSpy.mockReturnValue(1000)
      const cb = rafQueue.shift()
      cb?.(0)
    })

    expect(span?.textContent).toBe('12.35')

    rafSpy.mockRestore()
    dateSpy.mockRestore()
    vi.useRealTimers()
  })
})

describe('TutorielProgressBar', () => {
  it('applique une largeur initiale à 0% puis calcule (value/maxValue)*100 après délai', async () => {
    vi.useFakeTimers()

    const { container } = render(
      <TutorielProgressBar value={25} maxValue={200} delay={300} duration={1500} color="success" />
    )

    const outer = container.querySelector('div')
    expect(outer).not.toBeNull()
    const inner = outer?.querySelector('div')
    expect(inner).not.toBeNull()

    expect((inner as HTMLDivElement).style.width).toBe('0%')

    await act(async () => {
      vi.advanceTimersByTime(299)
    })
    expect((inner as HTMLDivElement).style.width).toBe('0%')

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect((inner as HTMLDivElement).style.width).toBe('12.5%')
    expect((inner as HTMLDivElement).style.transitionDuration).toBe('1500ms')
    expect((inner as HTMLDivElement).className).toContain('bg-success')

    vi.useRealTimers()
  })
})

describe('TutorielChartBar', () => {
  it('affiche le label et anime la hauteur vers (value/maxValue)*100 après délai', async () => {
    vi.useFakeTimers()

    const { container } = render(
      <TutorielChartBar value={30} maxValue={60} label="Jan" delay={200} />
    )

    expect(screen.getByText('Jan')).toBeTruthy()

    const root = container.querySelector('div')
    expect(root).not.toBeNull()
    const barContainer = root?.querySelector('.h-32.w-8')
    expect(barContainer).not.toBeNull()
    const bar = barContainer?.querySelector('div')
    expect(bar).not.toBeNull()

    expect((bar as HTMLDivElement).style.height).toBe('0%')

    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect((bar as HTMLDivElement).style.height).toBe('50%')

    vi.useRealTimers()
  })
})

describe('renderHook wrapper QueryClientProvider (contrainte infra)', () => {
  it('crée un wrapper QueryClientProvider compatible renderHook', async () => {
    const { renderHook } = await import('@testing-library/react')

    const wrapper = getWrapper()
    const { result } = renderHook(() => ({ ok: true }), { wrapper })
    expect(result.current.ok).toBe(true)
  })
})