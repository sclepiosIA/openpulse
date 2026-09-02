/* @vitest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GanttTimeline } from './GanttTimeline'

const { mockFrom, AUTH_STATE, mockNavigate, mockToastSuccess, mockToastError } = vi.hoisted(() => {
  const createBuilder = () => {
    const result = { data: null, error: null }
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
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    }
    return builder
  }

  return {
    mockFrom: vi.fn(() => createBuilder()),
    AUTH_STATE: {
      user: { id: 'u1', email: 'test@example.org' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
    },
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
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

describe('GanttTimeline', () => {
  it('rendered with day zoom shows header levels, daily cells, width and week indicators', () => {
    const Wrapper = createWrapper()
    const start = new Date(2024, 0, 1)
    const end = new Date(2024, 0, 7)

    render(
      <GanttTimeline
        timeline={{
          start,
          end,
          totalDays: 7,
          headerLevels: [
            { label: 'Janvier 2024', left: 0, width: 100 },
            { label: 'Semaine 1', left: 0, width: 100 },
          ],
        }}
        zoomLevel="day"
        todayPosition={50}
        width={700}
      />,
      { wrapper: Wrapper }
    )

    expect(screen.getByText('Janvier 2024')).toBeInTheDocument()
    expect(screen.getByText('Semaine 1')).toBeInTheDocument()

    expect(screen.getByText('lu')).toBeInTheDocument()
    expect(screen.getByText('ma')).toBeInTheDocument()
    expect(screen.getByText('me')).toBeInTheDocument()
    expect(screen.getByText('je')).toBeInTheDocument()
    expect(screen.getByText('ve')).toBeInTheDocument()
    expect(screen.getByText('sa')).toBeInTheDocument()
    expect(screen.getByText('di')).toBeInTheDocument()

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()

    expect(screen.getByText('S1')).toBeInTheDocument()

    const root = screen.getByText('Janvier 2024').closest('div')?.parentElement?.parentElement
    expect(root).toHaveStyle({ width: '700px' })
  })

  it('does not render day cells or week overlays when zoom is not day', () => {
    const Wrapper = createWrapper()
    const start = new Date(2024, 0, 1)
    const end = new Date(2024, 0, 31)

    render(
      <GanttTimeline
        timeline={{
          start,
          end,
          totalDays: 31,
          headerLevels: [
            { label: 'Janvier 2024', left: 0, width: 100 },
          ],
        }}
        zoomLevel="week"
        todayPosition={10}
      />,
      { wrapper: Wrapper }
    )

    expect(screen.getByText('Janvier 2024')).toBeInTheDocument()
    expect(screen.queryByText('lu')).not.toBeInTheDocument()
    expect(screen.queryByText('S1')).not.toBeInTheDocument()
  })

  it('applies percent-based positioning when width is not provided', () => {
    const Wrapper = createWrapper()
    const start = new Date(2024, 0, 1)
    const end = new Date(2024, 0, 2)

    render(
      <GanttTimeline
        timeline={{
          start,
          end,
          totalDays: 2,
          headerLevels: [
            { label: 'Bloc A', left: 25, width: 50 },
          ],
        }}
        zoomLevel="month"
        todayPosition={0}
      />,
      { wrapper: Wrapper }
    )

    const header = screen.getByText('Bloc A').closest('div')
    expect(header).toHaveStyle({ left: '25%', width: '50%' })
  })
})