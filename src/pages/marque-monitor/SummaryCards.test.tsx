import React from 'react'
import { render, waitFor, renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  FrontendSummary,
  HotspotsCard,
  AiSummary,
  ApiSummary,
  EmailSyncSummary,
  FeedbackSummary,
  SecuritySummary,
} from './SummaryCards'
import { supabase } from '@/integrations/supabase/client'

const { mockFrom, setNextResolve, mockInsert } = vi.hoisted(() => {
  let nextResolve: unknown = { data: null, error: null }
  const mockInsert = vi.fn()
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: (p: unknown) => {
      mockInsert(p)
      return builder
    },
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: (onFulfilled: unknown, onRejected: unknown) => {
      return Promise.resolve(nextResolve).then(onFulfilled as any, onRejected as any)
    },
    catch: (onRejected: unknown) => {
      return Promise.resolve(nextResolve).catch(onRejected as any)
    },
  }
  const mockFrom = vi.fn(() => builder)
  const setNextResolve = (v: unknown) => {
    nextResolve = v
  }
  return { mockFrom, setNextResolve, mockInsert }
})

const { getProcessingTypeLabel } = vi.hoisted(() => {
  const mapping: Record<string, string> = {
    type1: 'Type One',
    type2: 'Type Two',
    classification: 'Classification',
  }
  const getProcessingTypeLabel = (t: string) => mapping[t] ?? t
  return { getProcessingTypeLabel }
})

const { authReturn } = vi.hoisted(() => {
  return {
    authReturn: {
      user: { id: 'u1', email: 'test@example.com' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
  }
})

const { toastSuccess, toastError } = vi.hoisted(() => {
  return { toastSuccess: vi.fn(), toastError: vi.fn() }
})

const { navigateMock } = vi.hoisted(() => {
  return { navigateMock: vi.fn() }
})

// Mocks (use the hoisted stable references above)
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
    },
  }
})

vi.mock('@/hooks/ai/useAIUsageStats', () => {
  return { getProcessingTypeLabel }
})

vi.mock('@/lib/utils', () => {
  return {
    cn: (...parts: Array<string | false | null | undefined>) =>
      parts.filter(Boolean).join(' '),
  }
})

vi.mock('@/components/ui/badge', () => {
  const Badge: React.FC<any> = ({ children, ...rest }) => {
    return <span data-testid="badge" {...rest}>{children}</span>
  }
  return { Badge }
})

vi.mock('@/components/ui/card', () => {
  const Card: React.FC<any> = ({ children }) => <div data-testid="card">{children}</div>
  const CardHeader: React.FC<any> = ({ children, ...props }) => <div data-testid="card-header" {...props}>{children}</div>
  const CardTitle: React.FC<any> = ({ children }) => <div data-testid="card-title">{children}</div>
  const CardContent: React.FC<any> = ({ children }) => <div data-testid="card-content">{children}</div>
  return { Card, CardHeader, CardTitle, CardContent }
})

vi.mock('@/hooks/useAuth', () => {
  return {
    useAuth: () => authReturn,
  }
})

vi.mock('sonner', () => {
  return {
    toast: {
      success: toastSuccess,
      error: toastError,
    },
  }
})

vi.mock('react-router', () => {
  return {
    useNavigate: () => navigateMock,
  }
})

describe('SummaryCards components', () => {
  const makeWrapper = (client?: QueryClient) => {
    const qc = client ?? new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } })
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
  }

  it('FrontendSummary renders aggregated types and counts', () => {
    const errors = [
      { error_type: 'runtime', error_message: 'A', current_route: '/home', created_at: '2024-01-01T00:00:00Z' },
      { error_type: 'network', error_message: 'B', current_route: '/about', created_at: '2024-01-02T00:00:00Z' },
      { error_type: null, error_message: 'C', current_route: '/home', created_at: '2024-01-03T00:00:00Z' },
    ]
    const { container } = render(<FrontendSummary errors={errors as any} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Runtime')
    expect(text).toContain('Réseau')
    // runtime appears twice
    expect(text).toContain('2')
    // network appears once
    expect(text).toContain('1')
  })

  it('FrontendSummary returns null on empty input', () => {
    const { container } = render(<FrontendSummary errors={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('HotspotsCard groups messages by message+route and shows last date and counts', () => {
    const errors = [
      { error_message: 'boom happened', current_route: '/r', created_at: '2024-01-01T00:00:00Z' },
      { error_message: 'boom happened', current_route: '/r', created_at: '2024-01-03T00:00:00Z' },
      { error_message: 'minor', current_route: '/s', created_at: '2024-01-02T00:00:00Z' },
    ]
    const { container } = render(<HotspotsCard errors={errors as any} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Hotspots frontend (3 erreurs)')
    expect(text).toContain('2')
    expect(text).toContain('boom happened')
    expect(text).toContain('/r')
    const last = new Date('2024-01-03T00:00:00Z').toLocaleString('fr-FR')
    expect(text).toContain(last)
  })

  it('HotspotsCard shows fallback message when no rows', () => {
    const { container } = render(<HotspotsCard errors={[]} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Aucune erreur frontend sur la période.')
  })

  it('AiSummary uses getProcessingTypeLabel and shows counts', () => {
    const errors = [
      { processing_type: 'type1' },
      { processing_type: 'type1' },
      { processing_type: 'type2' },
    ]
    const { container } = render(<AiSummary errors={errors as any} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Type One')
    expect(text).toContain('Type Two')
    expect(text).toContain('2')
    expect(text).toContain('1')
  })

  it('AiSummary returns null on empty input', () => {
    const { container } = render(<AiSummary errors={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('ApiSummary aggregates endpoints and shows statuses and counts', () => {
    const errors = [
      { method: 'GET', endpoint: '/api/x', status_code: 500 },
      { method: 'GET', endpoint: '/api/x', status_code: 500 },
      { method: 'POST', endpoint: '/api/y', status_code: 404 },
      { method: 'GET', endpoint: '/api/x', status_code: 200 },
    ]
    const { container } = render(<ApiSummary errors={errors as any} />)
    const text = container.textContent ?? ''
    expect(text).toContain('GET /api/x')
    expect(text).toContain('POST /api/y')
    expect(text).toContain('500')
    expect(text).toContain('404')
    expect(text).toContain('3x')
  })

  it('EmailSyncSummary shows number of sync errors and total unsynced emails', () => {
    const errors = [
      { emails_fetched: 2 },
      { emails_fetched: 5 },
      { emails_fetched: null },
    ]
    const { container } = render(<EmailSyncSummary errors={errors as any} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Syncs en erreur :')
    expect(text).toContain(String(errors.length))
    expect(text).toContain('7')
  })

  it('EmailSyncSummary returns null when empty', () => {
    const { container } = render(<EmailSyncSummary errors={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('FeedbackSummary aggregates priorities including default label', () => {
    const feedbacks = [
      { priority: 'critical' },
      { priority: 'high' },
      { priority: null },
      { priority: 'critical' },
    ]
    const { container } = render(<FeedbackSummary feedbacks={feedbacks as any} />)
    const text = container.textContent ?? ''
    expect(text).toContain('critical')
    expect(text).toContain('high')
    expect(text).toContain('non définie')
    expect(text).toContain('2')
  })

  it('FeedbackSummary returns null when empty', () => {
    const { container } = render(<FeedbackSummary feedbacks={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('SecuritySummary aggregates risk levels and counts', () => {
    const logs = [
      { risk_level: 'high' },
      { risk_level: 'medium' },
      { risk_level: null },
      { risk_level: 'high' },
    ]
    const { container } = render(<SecuritySummary logs={logs as any} />)
    const text = container.textContent ?? ''
    expect(text).toContain('high')
    expect(text).toContain('medium')
    expect(text).toContain('inconnu')
    expect(text).toContain('2')
  })

  it('SecuritySummary returns null when empty', () => {
    const { container } = render(<SecuritySummary logs={[]} />)
    expect(container.firstChild).toBeNull()
  })

  describe('supabase hook + mutation integration (renderHook)', () => {
    const wrapper = makeWrapper()

    function useFetchThing() {
      const [state, setState] = React.useState({ isLoading: true, data: null as any, error: null as any })
      React.useEffect(() => {
        let mounted = true
        supabase
          .from('things')
          .select('*')
          .then((res: any) => {
            if (!mounted) return
            setState({ isLoading: false, data: res.data, error: res.error })
          })
          .catch((err: any) => {
            if (!mounted) return
            setState({ isLoading: false, data: null, error: err })
          })
        return () => {
          mounted = false
        }
      }, [])
      return state
    }

    function useInsertThing() {
      const [state, setState] = React.useState({ isLoading: false, data: null as any, error: null as any })
      const mutate = async (payload: unknown) => {
        setState(s => ({ ...s, isLoading: true }))
        try {
          const res = await supabase.from('things').insert(payload)
          setState({ isLoading: false, data: (res as any).data, error: (res as any).error })
        } catch (err) {
          setState({ isLoading: false, data: null, error: err })
        }
      }
      return { ...state, mutate }
    }

    it('hook starts loading then resolves to data (success)', async () => {
      const sampleData = { id: 'abc', name: 'ok' }
      setNextResolve({ data: sampleData, error: null })
      const { result } = renderHook(() => useFetchThing(), { wrapper })
      expect(result.current.isLoading).toBe(true)
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.data).toEqual(sampleData)
      expect(result.current.error).toBeNull()
    })

    it('hook resolves to error when supabase returns error', async () => {
      setNextResolve({ data: null, error: { message: 'boom' } })
      const { result } = renderHook(() => useFetchThing(), { wrapper })
      expect(result.current.isLoading).toBe(true)
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.data).toBeNull()
      expect(result.current.error).toEqual({ message: 'boom' })
    })

    it('mutation calls supabase.insert with payload and updates state', async () => {
      const returned = { id: 'new', ok: true }
      setNextResolve({ data: returned, error: null })
      const { result } = renderHook(() => useInsertThing(), { wrapper })
      await act(async () => {
        await result.current.mutate({ name: 'created' })
      })
      expect(mockInsert).toHaveBeenCalledWith({ name: 'created' })
      expect(result.current.data).toEqual(returned)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })
})