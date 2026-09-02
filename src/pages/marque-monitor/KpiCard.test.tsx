const { SUCCESS, ERROR, current, mockFrom, mockInsert, USER } = vi.hoisted(() => {
  const SUCCESS = { data: { value: 99 }, error: null }
  const ERROR = { data: null, error: { message: 'boom' } }
  const current = { res: SUCCESS }

  const mockInsert = vi.fn()

  function createBuilder(_table: string) {
    const builder: any = {}

    builder.select = (..._args: unknown[]) => builder
    builder.eq = (..._args: unknown[]) => builder
    builder.gte = (..._args: unknown[]) => builder
    builder.lte = (..._args: unknown[]) => builder
    builder.in = (..._args: unknown[]) => builder
    builder.order = (..._args: unknown[]) => builder
    builder.limit = (..._args: unknown[]) => builder

    builder.maybeSingle = () => Promise.resolve(current.res)
    builder.single = () => Promise.resolve(current.res)

    builder.insert = (payload: unknown) => {
      mockInsert(payload)
      return Promise.resolve({ data: payload, error: null })
    }
    builder.update = (payload: unknown) => Promise.resolve({ data: payload, error: null })
    builder.delete = () => Promise.resolve({ data: null, error: null })

    // THENABLE support: some callers may await the builder itself
    builder.then = (onFulfilled: unknown, onRejected: unknown) =>
      Promise.resolve(current.res).then(onFulfilled as any, onRejected as any)
    builder.catch = (onRejected: unknown) => Promise.resolve(current.res).catch(onRejected as any)

    return builder
  }

  const mockFrom = vi.fn((table: string) => createBuilder(table))

  const USER = {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  return { SUCCESS, ERROR, current, mockFrom, mockInsert, USER }
})

vi.mock('@/integrations/supabase/client', () => {
  return { supabase: { from: mockFrom } }
})

vi.mock('@/components/ui/card', () => {
  const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  )
  const CardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  )
  return { Card, CardContent }
})

vi.mock('@/lib/utils', () => {
  return { cn: (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ') }
})

vi.mock('@/hooks/useAuth', () => {
  return { useAuth: () => USER }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

vi.mock('react-router', () => {
  return { useNavigate: () => vi.fn() }
})

import React from 'react'
import { render, screen, renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query'
import { supabase as mockedSupabase } from '@/integrations/supabase/client'
import { KpiCard } from './KpiCard'

describe('KpiCard component and hooks integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    current.res = SUCCESS
  })

  it('renders title, value, icon and applies classNames correctly', () => {
    const TestIcon = ({ className }: { className?: string }) => <svg data-testid="kpi-icon" className={className} />

    render(
      <KpiCard
        title="Active Users"
        value={123}
        icon={TestIcon}
        color="text-blue-500"
        bgColor="bg-blue-100"
        className="custom-class"
      />
    )

    const card = screen.getByTestId('card')
    expect(card).toBeTruthy()
    const cardClass = card.getAttribute('class') ?? ''
    expect(cardClass).toContain('relative overflow-hidden')
    expect(cardClass).toContain('custom-class')

    const title = screen.getByText('Active Users')
    expect(title).toBeTruthy()
    expect(title.className).toContain('text-[10px]')

    const value = screen.getByText('123')
    expect(value).toBeTruthy()
    expect(value.className).toContain('text-lg')
    expect(value.className).toContain('text-blue-500')

    const icon = screen.getByTestId('kpi-icon')
    expect(icon).toBeTruthy()
    const iconClass = icon.getAttribute('class') ?? ''
    expect(iconClass).toContain('text-blue-500')

    const cardContent = screen.getByTestId('card-content')
    expect(cardContent).toBeTruthy()
    expect(cardContent.getAttribute('class') ?? '').toContain('p-3')
  })

  it('hook: loading -> success when supabase returns data', async () => {
    const useKpi = () =>
      useQuery({
        queryKey: ['kpi'],
        queryFn: async () => {
          const res = await mockedSupabase.from('metrics').select('value').maybeSingle()
          if (res.error) {
            throw new Error(res.error.message)
          }
          return res.data.value
        },
      })

    const createClient = () =>
      new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={createClient()}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useKpi(), { wrapper })

    // initial loading state should be true
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
      expect(result.current.data).toBe(99)
    })

    expect(mockFrom).toHaveBeenCalled()
    expect(mockFrom).toHaveBeenCalledWith('metrics')
  })

  it('hook: error when supabase returns an error object', async () => {
    current.res = ERROR

    const useKpi = () =>
      useQuery({
        queryKey: ['kpi-error'],
        queryFn: async () => {
          const res = await mockedSupabase.from('metrics').select('value').maybeSingle()
          if (res.error) {
            throw new Error(res.error.message)
          }
          return res.data.value
        },
      })

    const createClient = () =>
      new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={createClient()}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useKpi(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
      const err = result.current.error as Error
      expect(err.message).toBe('boom')
    })
  })

  it('mutation: calls supabase.insert with the correct payload', async () => {
    const useUpdateKpi = () =>
      useMutation({
        mutationFn: async (newValue: number) => {
          const res = await mockedSupabase.from('metrics').insert({ value: newValue })
          if (res.error) {
            throw new Error((res.error as { message?: string }).message ?? 'insert error')
          }
          return res.data
        },
      })

    const createClient = () =>
      new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={createClient()}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useUpdateKpi(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(123)
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockInsert).toHaveBeenCalledWith({ value: 123 })
  })
})