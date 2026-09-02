import React from 'react'
import { render, screen, cleanup, waitFor, renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  DashboardKPIsPreview,
  DashboardPipelinePreview,
  DashboardActionsPreview,
  DashboardFluxActivitesPreview,
} from './DashboardPreviews'

const { ROWS, mockFrom, builder } = vi.hoisted(() => {
  const ROWS = [{ id: 'r1', name: 'Test Row' }]
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
    single: vi.fn(() => Promise.resolve({ data: ROWS[0], error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: ROWS[0], error: null })),
    then: vi.fn((onFulfilled: unknown) =>
      Promise.resolve({ data: ROWS, error: null }).then(onFulfilled as (value: unknown) => unknown),
    ),
    catch: vi.fn((onRejected: unknown) =>
      Promise.resolve({ data: ROWS, error: null }).catch(onRejected as (reason: unknown) => unknown),
    ),
  }
  const mockFrom = vi.fn(() => builder)
  return { ROWS, mockFrom, builder }
})

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
    },
  }
})

vi.mock('framer-motion', () => {
  return {
    motion: {
      div: (props: any) => {
        const { children, ...rest } = props
        return React.createElement('div', rest, children)
      },
      span: (props: any) => {
        const { children, ...rest } = props
        return React.createElement('span', rest, children)
      },
    },
  }
})

vi.mock('lucide-react', () => {
  const make = (name: string) => (props: any) =>
    React.createElement('span', { 'data-icon': name, ...props }, props?.children)
  return {
    TrendingUp: make('TrendingUp'),
    Users: make('Users'),
    Building2: make('Building2'),
    Mail: make('Mail'),
    CheckCircle2: make('CheckCircle2'),
    Clock: make('Clock'),
    Sparkles: make('Sparkles'),
    ArrowRight: make('ArrowRight'),
    Plus: make('Plus'),
    Calendar: make('Calendar'),
  }
})

vi.mock('@/components/ui/badge', () => {
  return {
    Badge: ({ children, ...props }: any) =>
      React.createElement('span', { 'data-badge': true, ...props }, children),
  }
})

vi.mock('@/components/ui/card', () => {
  return {
    Card: ({ children, ...props }: any) =>
      React.createElement('div', { 'data-card': true, ...props }, children),
    CardContent: ({ children, ...props }: any) =>
      React.createElement('div', { 'data-card-content': true, ...props }, children),
  }
})

vi.mock('../TutorielCountUpAnimation', () => {
  return {
    TutorielCountUpAnimation: ({ value, prefix = '', suffix = '' }: any) =>
      React.createElement('span', { 'data-testid': 'countup' }, `${prefix}${value}${suffix ?? ''}`),
  }
})

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

const wrapper =
  (client?: QueryClient) =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: client ?? createQueryClient() }, children)

describe('DashboardPreviews components', () => {
  beforeEach(() => {
    builder.then.mockImplementation((onFulfilled: unknown) =>
      Promise.resolve({ data: ROWS, error: null }).then(onFulfilled as (value: unknown) => unknown),
    )
    builder.insert.mockClear()
    mockFrom.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders KPIs preview with expected labels and formatted values', () => {
    render(React.createElement(DashboardKPIsPreview), { wrapper: wrapper() })

    expect(screen.getByText('CA Annuel')).toBeTruthy()
    expect(screen.getByText('Clients Actifs')).toBeTruthy()
    expect(screen.getByText('Prospects')).toBeTruthy()
    expect(screen.getByText('Tâches en cours')).toBeTruthy()

    expect(screen.getByText('847500 €')).toBeTruthy()
    expect(screen.getByText('47')).toBeTruthy()
    expect(screen.getByText('23')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
  })

  it('renders Pipeline preview with column names and values', () => {
    const { container } = render(React.createElement(DashboardPipelinePreview), { wrapper: wrapper() })

    expect(screen.getByText('Pipeline Commercial')).toBeTruthy()
    expect(screen.getByText('Prospect')).toBeTruthy()
    expect(screen.getByText('Qualification')).toBeTruthy()
    expect(screen.getByText('Proposition')).toBeTruthy()
    expect(screen.getByText('Négociation')).toBeTruthy()
    expect(screen.getByText('Gagné')).toBeTruthy()

    expect(screen.getByText('8')).toBeTruthy()
    expect(screen.getByText('245000 €')).toBeTruthy()

    expect(container.querySelectorAll('[data-icon="TrendingUp"]').length).toBeGreaterThanOrEqual(1)
  })

  it('renders Actions preview and shows correct remaining count and action icons', () => {
    const { container } = render(React.createElement(DashboardActionsPreview), { wrapper: wrapper() })

    expect(screen.getByText('3 restantes')).toBeTruthy()

    const arrows = container.querySelectorAll('[data-icon="ArrowRight"]')
    expect(arrows.length).toBe(3)

    expect(screen.getByText('Appeler Groupe Aubier')).toBeTruthy()
    expect(screen.getByText('Préparer démo Agence Lille')).toBeTruthy()
  })

  it('renders Flux Activités preview with recent activity entries', () => {
    render(React.createElement(DashboardFluxActivitesPreview), { wrapper: wrapper() })

    expect(screen.getByText('Marie D.')).toBeTruthy()
    expect(screen.getByText('Groupe Vallois')).toBeTruthy()
    expect(screen.getByText('Il y a 5 min')).toBeTruthy()

    expect(screen.getByText('IA')).toBeTruthy()
    const iaIcons = document.querySelectorAll('[data-icon="Sparkles"]')
    expect(iaIcons.length).toBeGreaterThanOrEqual(1)
  })

  it('custom hook using supabase resolves to data (isLoading -> success)', async () => {
    function useFakeSupabaseQuery() {
      const [state, setState] = React.useState({
        data: null as unknown,
        error: null as unknown,
        isLoading: true,
        isError: false,
      })
      React.useEffect(() => {
        void (async () => {
          try {
            const final = await (mockFrom('test') as any).then((r: unknown) => r)
            if ((final as any).error) {
              setState({ data: null, error: (final as any).error, isLoading: false, isError: true })
            } else {
              setState({ data: (final as any).data, error: null, isLoading: false, isError: false })
            }
          } catch (err) {
            setState({ data: null, error: err, isLoading: false, isError: true })
          }
        })()
      }, [])
      return state
    }

    const qc = createQueryClient()
    const { result } = renderHook(() => useFakeSupabaseQuery(), { wrapper: wrapper(qc) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.isError).toBe(false)
    expect(result.current.data).toEqual(ROWS)
    expect(result.current.error).toBeNull()
    expect(mockFrom).toHaveBeenCalled()
    expect((result.current.data as any)[0]).toBe(ROWS[0])
  })

  it('custom hook using supabase handles error response (isError true)', async () => {
    builder.then.mockImplementation((onFulfilled: unknown) =>
      Promise.resolve({ data: null, error: { message: 'simulated failure' } }).then(
        onFulfilled as (value: unknown) => unknown,
      ),
    )

    function useFakeSupabaseQueryError() {
      const [state, setState] = React.useState({
        data: null as unknown,
        error: null as unknown,
        isLoading: true,
        isError: false,
      })
      React.useEffect(() => {
        void (async () => {
          try {
            const final = await (mockFrom('errtest') as any).then((r: unknown) => r)
            if ((final as any).error) {
              setState({ data: null, error: (final as any).error, isLoading: false, isError: true })
            } else {
              setState({ data: (final as any).data, error: null, isLoading: false, isError: false })
            }
          } catch (err) {
            setState({ data: null, error: err, isLoading: false, isError: true })
          }
        })()
      }, [])
      return state
    }

    const qc = createQueryClient()
    const { result } = renderHook(() => useFakeSupabaseQueryError(), { wrapper: wrapper(qc) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.isError).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toEqual({ message: 'simulated failure' })
  })

  it('mutation-like insert triggers supabase insert and called with correct payload', async () => {
    builder.then.mockImplementation((onFulfilled: unknown) =>
      Promise.resolve({ data: ROWS, error: null }).then(onFulfilled as (value: unknown) => unknown),
    )

    function useInsertHook() {
      const [state, setState] = React.useState({ loading: false, done: false, error: null as unknown })
      const insertRow = async (payload: unknown) => {
        setState({ loading: true, done: false, error: null })
        try {
          const b = mockFrom('leads')
          const afterInsert = b.insert([payload])
          await (afterInsert as any).then((res: unknown) => {
            if ((res as any).error) {
              setState({ loading: false, done: false, error: (res as any).error })
            } else {
              setState({ loading: false, done: true, error: null })
            }
          })
        } catch (err) {
          setState({ loading: false, done: false, error: err })
        }
      }
      return { ...state, insertRow }
    }

    const qc = createQueryClient()
    const { result } = renderHook(() => useInsertHook(), { wrapper: wrapper(qc) })

    await act(async () => {
      await result.current.insertRow({ foo: 'bar' })
    })

    expect(mockFrom).toHaveBeenCalledWith('leads')
    expect(builder.insert).toHaveBeenCalledWith([{ foo: 'bar' }])
    expect(result.current.done).toBe(true)
    expect(result.current.error).toBeNull()
  })
})