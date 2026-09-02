import React from 'react'
import { render, screen, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GlobalChart } from './GlobalChart'

const { DUMMY_ROWS, mockFrom, builder, AUTH_RET, tooltipPayload24h, tooltipPayload7d, tooltipNoDate } = vi.hoisted(() => {
  const DUMMY_ROWS = [{ id: 'row-1' }]
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: DUMMY_ROWS, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: DUMMY_ROWS, error: null }),
    then: vi.fn((onFulfilled) => Promise.resolve({ data: DUMMY_ROWS, error: null }).then(onFulfilled)),
    catch: vi.fn((onRejected) => Promise.resolve({ data: DUMMY_ROWS, error: null }).catch(onRejected)),
  }
  const mockFrom = vi.fn(() => builder)
  const AUTH_RET = { user: { id: 'u1', email: 't@t.co' }, session: { user: { id: 'u1' } }, isLoading: false }
  const tooltipPayload24h = [{ payload: { date: '2023-08-05T15:20:00.000Z' } }]
  const tooltipPayload7d = [{ payload: { date: '2023-08-05T15:20:00.000Z' } }]
  const tooltipNoDate = [{ payload: {} }]
  return { DUMMY_ROWS, mockFrom, builder, AUTH_RET, tooltipPayload24h, tooltipPayload7d, tooltipNoDate }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3 data-testid="card-title">{children}</h3>,
}))

vi.mock('lucide-react', () => ({
  TrendingUp: (props: any) => <svg role="img" aria-label="trending-up" {...props} />,
}))

vi.mock('recharts', () => {
  const ResponsiveContainer = ({ children }: any) => <div data-testid="responsive-container">{children}</div>
  const AreaChart = ({ children, data }: any) => (
    <div data-testid="area-chart" data-data-length={Array.isArray(data) ? data.length : 0}>
      {children}
    </div>
  )
  const CartesianGrid = (props: any) => <div data-testid="cartesian-grid" {...props} />
  const Legend = (props: any) => <div data-testid="legend" {...props} />
  const XAxis = (props: any) => <div data-testid="x-axis" {...props} />
  const YAxis = (props: any) => <div data-testid="y-axis" {...props} />
  const Area = (props: any) => <div data-testid={`area-${props.dataKey}`} data-name={props.name} {...props} />
  const Tooltip = ({ labelFormatter }: any) => {
    const payload = (globalThis as any).__TEST_TOOLTIP_PAYLOAD__ ?? []
    const label = 'LABEL'
    const out = labelFormatter ? labelFormatter(label, payload) : label
    return <div data-testid="tooltip-output">{String(out)}</div>
  }
  return { ResponsiveContainer, AreaChart, CartesianGrid, Legend, XAxis, YAxis, Area, Tooltip }
})

function WrapperProvider({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('GlobalChart', () => {
  afterEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).__TEST_TOOLTIP_PAYLOAD__ = undefined
  })

  it('wraps hooks with QueryClientProvider (renderHook smoke test)', () => {
    const { result } = renderHook(() => React.useMemo(() => 42, []), { wrapper: WrapperProvider })
    expect(result.current).toBe(42)
  })

  it('renders title and areas for 24h period and formats tooltip with time', () => {
    const chartData = [
      {
        label: 'pt-1',
        date: '2023-08-05T15:20:00.000Z',
        frontend: 5,
        ai: 2,
        api: 3,
        email: 1,
        security: 0,
        feedback: 0,
      },
    ]
    ;(globalThis as any).__TEST_TOOLTIP_PAYLOAD__ = tooltipPayload24h

    render(
      <WrapperProvider>
        <GlobalChart period="24h" chartData={chartData} />
      </WrapperProvider>
    )

    expect(screen.getByTestId('card-title').textContent).toContain('Évolution sur 24 heures')
    expect(screen.getByTestId('area-frontend')).toBeInTheDocument()
    expect(screen.getByTestId('area-ai')).toBeInTheDocument()
    expect(screen.getByTestId('area-api')).toBeInTheDocument()
    expect(screen.getByTestId('area-email')).toBeInTheDocument()
    expect(screen.getByTestId('area-security')).toBeInTheDocument()
    expect(screen.getByTestId('area-feedback')).toBeInTheDocument()

    const tooltipText = screen.getByTestId('tooltip-output').textContent || ''
    expect(tooltipText.includes(':')).toBe(true)
  })

  it('renders correct title for 7d period and formats tooltip without time', () => {
    const chartData = [
      {
        label: 'pt-2',
        date: '2023-08-05T15:20:00.000Z',
        frontend: 1,
      },
    ]
    ;(globalThis as any).__TEST_TOOLTIP_PAYLOAD__ = tooltipPayload7d

    render(
      <WrapperProvider>
        <GlobalChart period="7d" chartData={chartData} />
      </WrapperProvider>
    )

    expect(screen.getByTestId('card-title').textContent).toContain('Évolution sur 7 jours')
    const tooltipText = screen.getByTestId('tooltip-output').textContent || ''
    expect(tooltipText.includes(':')).toBe(false)
  })

  it('renders correct title for 30d period', () => {
    const chartData = [
      {
        label: 'pt-3',
        date: '2023-08-05T15:20:00.000Z',
        frontend: 0,
      },
    ]

    render(
      <WrapperProvider>
        <GlobalChart period="30d" chartData={chartData} />
      </WrapperProvider>
    )

    expect(screen.getByTestId('card-title').textContent).toContain('Évolution sur 30 jours')
  })

  it('tooltip falls back to original label when date payload is missing (error-like path)', () => {
    const chartData = [
      {
        label: 'pt-4',
        date: '2023-08-05T15:20:00.000Z',
        frontend: 3,
      },
    ]
    ;(globalThis as any).__TEST_TOOLTIP_PAYLOAD__ = tooltipNoDate

    render(
      <WrapperProvider>
        <GlobalChart period="24h" chartData={chartData} />
      </WrapperProvider>
    )

    expect(screen.getByTestId('tooltip-output').textContent).toBe('LABEL')
  })
})