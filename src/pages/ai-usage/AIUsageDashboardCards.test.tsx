import React from 'react'
import { render, screen, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { InfoBlock, KpiCard, PeriodCard } from './AIUsageDashboardCards'

const { ROWS, mockFrom } = vi.hoisted(() => {
  const ROWS = [{ id: 'row-1', value: 10 }]
  const builder: any = {
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
    single: vi.fn(() => Promise.resolve({ data: ROWS, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: ROWS, error: null })),
  }
  const mockFrom = vi.fn(() => builder)
  return { ROWS, mockFrom }
})

// Mock internal UI components to avoid heavy rendering
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="Card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="CardContent">{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="CardHeader">{children}</div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="CardDescription">{children}</div>
  ),
}))

// Mock utility 'cn' to be deterministic
vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | false | undefined)[]) => args.filter(Boolean).join(' '),
}))

// Mock formatting hooks to return predictable outputs
vi.mock('@/hooks/ai/useAIUsageStats', () => ({
  formatCost: (n: number) => String(n),
  formatTokens: (n: number) => String(n),
}))

// Mock Supabase client with a chainable builder
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

describe('AIUsageDashboardCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('InfoBlock renders label and value', () => {
    render(<InfoBlock label="Total" value="42" />)
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('KpiCard renders title, value, sub and icon', () => {
    const Icon = () => <span data-testid="kpi-icon" />
    render(
      <KpiCard
        title="Revenue"
        value="123"
        sub="this quarter"
        icon={Icon}
        color="text-black"
        bgColor="bg-card"
      />
    )
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('123')).toBeInTheDocument()
    expect(screen.getByText('this quarter')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-icon')).toBeInTheDocument()
  })

  it('PeriodCard renders calls, tokens and cost with formatted values', () => {
    render(<PeriodCard title="Period" calls={5} tokens={100} cost={2} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    // Static labels
    expect(screen.getByText('appels')).toBeInTheDocument()
    expect(screen.getByText('tokens')).toBeInTheDocument()
    expect(screen.getByText('coût')).toBeInTheDocument()
  })

  it('renderHook wrapper works with QueryClientProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
          })
        }
      >
        {children}
      </QueryClientProvider>
    )
    const { result } = renderHook(() => [1, 2, 3], { wrapper })
    expect(result.current).toEqual([1, 2, 3])
  })
})
