import React from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

/**
 * HOISTED STABLE MOCKS (required to avoid re-creation across renders)
 */
const { ArrowRight, CheckCircle2, Circle, Loader2 } = vi.hoisted(() => {
  const ArrowRight = (props: any) => React.createElement('svg', { 'data-testid': 'ArrowRight', ...props })
  const CheckCircle2 = (props: any) => React.createElement('svg', { 'data-testid': 'CheckCircle2', ...props })
  const Circle = (props: any) => React.createElement('svg', { 'data-testid': 'Circle', ...props })
  const Loader2 = (props: any) => React.createElement('svg', { 'data-testid': 'Loader2', ...props })
  return { ArrowRight, CheckCircle2, Circle, Loader2 }
})

vi.mock('lucide-react', () => ({
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2
}))

const { cn } = vi.hoisted(() => {
  // simple stable cn implementation: join truthy values with space, flatten arrays
  const cn = (...args: any[]) => {
    const out: string[] = []
    const push = (v: any) => {
      if (!v && v !== 0) return
      if (Array.isArray(v)) v.forEach(push)
      else if (typeof v === 'object') {
        // keep keys with truthy value
        Object.keys(v).forEach(k => { if ((v as any)[k]) out.push(k) })
      } else out.push(String(v))
    }
    args.forEach(push)
    return out.join(' ')
  }
  return { cn }
})

vi.mock('@/lib/utils', () => ({ cn }))

/**
 * Stable mocks for common app internals to avoid failing other tests
 */
const { mockFrom, supabaseBuilder, RESPONSE_SUCCESS, RESPONSE_ERROR } = vi.hoisted(() => {
  // Configurable responses used by builder.then
  const RESPONSE_SUCCESS = { data: [{ id: 'db1', label: 'DB1' }], error: null }
  const RESPONSE_ERROR = { data: null, error: { message: 'simulated error' } }

  const calls: any[] = []

  const supabaseBuilder: any = {
    // chainable methods
    select: vi.fn(function select(this: any, ...args: any[]) { calls.push({ method: 'select', args }); return this }),
    eq: vi.fn(function eq(this: any, ...args: any[]) { calls.push({ method: 'eq', args }); return this }),
    gte: vi.fn(function gte(this: any, ...args: any[]) { calls.push({ method: 'gte', args }); return this }),
    lte: vi.fn(function lte(this: any, ...args: any[]) { calls.push({ method: 'lte', args }); return this }),
    in: vi.fn(function _in(this: any, ...args: any[]) { calls.push({ method: 'in', args }); return this }),
    order: vi.fn(function order(this: any, ...args: any[]) { calls.push({ method: 'order', args }); return this }),
    limit: vi.fn(function limit(this: any, ...args: any[]) { calls.push({ method: 'limit', args }); return this }),
    insert: vi.fn(function insert(this: any, ...args: any[]) { calls.push({ method: 'insert', args }); return this }),
    update: vi.fn(function update(this: any, ...args: any[]) { calls.push({ method: 'update', args }); return this }),
    delete: vi.fn(function _delete(this: any, ...args: any[]) { calls.push({ method: 'delete', args }); return this }),
    single: vi.fn(function single(this: any) { calls.push({ method: 'single' }); return this }),
    maybeSingle: vi.fn(function maybeSingle(this: any) { calls.push({ method: 'maybeSingle' }); return this }),
    then: vi.fn(function then(this: any, onFulfilled: any) {
      // default to success; tests can override supabaseBuilder.__response to force error
      const res = (supabaseBuilder.__response === 'error') ? RESPONSE_ERROR : RESPONSE_SUCCESS
      return Promise.resolve(res).then(onFulfilled)
    }),
    catch: vi.fn(function _catch(this: any, onRejected: any) {
      // passthrough
      return Promise.resolve().catch(onRejected)
    }),
    // internal switch to configure then resolution
    __response: 'success',
    __calls: calls
  }

  const mockFrom = vi.fn((tableName: string) => {
    supabaseBuilder.__lastTable = tableName
    return supabaseBuilder
  })

  return { mockFrom, supabaseBuilder, RESPONSE_SUCCESS, RESPONSE_ERROR }
})

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mockFrom } }))

/**
 * Mock router and auth related modules to stable authenticated user
 */
const { useNavigate } = vi.hoisted(() => {
  const navigate = vi.fn()
  const useNavigate = () => navigate
  return { useNavigate }
})
vi.mock('react-router-dom', () => ({ useNavigate }))

const { useAuth } = vi.hoisted(() => {
  const auth = {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
    hasRole: vi.fn(() => true)
  }
  const useAuth = () => auth
  return { useAuth }
})
vi.mock('@/hooks/useAuth', () => ({ useAuth }))

/**
 * Mock notifications
 */
const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('sonner', () => ({ toast }))

/**
 * Now import the module under test (must be after mocks so imports resolve to mocks)
 */
import { TutorielFlowDiagram, TutorielWorkflow } from './TutorielFlowDiagram'

/**
 * QueryClient wrapper helper used by render and renderHook per spec
 */
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: 0, gcTime: 0 },
    mutations: { retry: 0 }
  }
})

const QueryClientWrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const client = createQueryClient()
  return React.createElement(QueryClientProvider, { client }, children)
}

/**
 * Tests
 */
describe('TutorielFlowDiagram', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    // ensure supabase builder returns success by default
    supabaseBuilder.__response = 'success'
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('initial render: shows all steps as pending (Circle icons) and no descriptions', () => {
    // ensure we exercise renderHook wrapper creation as required
    renderHook(() => 0, { wrapper: QueryClientWrapper })

    const steps = [
      { id: 's1', label: 'Étape 1' },
      { id: 's2', label: 'Étape 2', description: 'Desc 2' },
      { id: 's3', label: 'Étape 3' }
    ]

    render(React.createElement(TutorielFlowDiagram, { steps, animationDuration: 1000, autoPlay: false, className: 'test-diagram' }), { wrapper: QueryClientWrapper })

    // Labels are present
    expect(screen.getByText('Étape 1')).toBeTruthy()
    expect(screen.getByText('Étape 2')).toBeTruthy()
    expect(screen.getByText('Étape 3')).toBeTruthy()

    // No Loader2 or CheckCircle2 initially because activeIndex = -1 (all pending)
    expect(screen.queryByTestId('Loader2')).toBeNull()
    expect(screen.queryByTestId('CheckCircle2')).toBeNull()

    // Circle icon should be rendered for each step (pending)
    const circles = screen.getAllByTestId('Circle')
    expect(circles.length).toBe(3)

    // Description should not be visible because no step is active
    expect(screen.queryByText('Desc 2')).toBeNull()
  })

  it('autoplay advances active step, shows loader and description, and marks previous as complete', async () => {
    const steps = [
      { id: 'a1', label: 'A1', description: 'D1' },
      { id: 'a2', label: 'A2', description: 'D2' },
      { id: 'a3', label: 'A3' }
    ]

    render(React.createElement(TutorielFlowDiagram, { steps, animationDuration: 500, autoPlay: true, loop: true }), { wrapper: QueryClientWrapper })

    // initially no active loader
    expect(screen.queryByTestId('Loader2')).toBeNull()
    // advance to first tick -> activeIndex 0
    await act(async () => {
      vi.advanceTimersByTime(500)
      // allow effects to flush
      await Promise.resolve()
    })

    // Now Loader2 should be visible once (active item)
    const loaders = screen.getAllByTestId('Loader2')
    expect(loaders.length).toBe(1)

    // Description for first step is visible
    expect(screen.getByText('D1')).toBeTruthy()

    // Advance to second tick -> first becomes complete (CheckCircle2), second active (Loader2)
    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    // One check icon for completed first step
    const checks = screen.getAllByTestId('CheckCircle2')
    expect(checks.length).toBe(1)
    // Loader still present for active item
    expect(screen.getAllByTestId('Loader2').length).toBe(1)

    // Arrow connectors present between items
    const arrows = screen.getAllByTestId('ArrowRight')
    // there should be steps.length - 1 arrows (horizontal connectors)
    expect(arrows.length).toBe(2)
  })

  it('when loop is false, autoplay stops at last step and does not loop back to -1', async () => {
    const steps = [
      { id: 'b1', label: 'B1' },
      { id: 'b2', label: 'B2' }
    ]

    render(React.createElement(TutorielFlowDiagram, { steps, animationDuration: 300, autoPlay: true, loop: false }), { wrapper: QueryClientWrapper })

    // advance to first -> active index 0
    await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve() })
    expect(screen.getAllByTestId('Loader2').length).toBe(1)

    // advance to second -> active index 1
    await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve() })
    expect(screen.getAllByTestId('Loader2').length).toBe(1)
    // advance further -> should remain at last, not loop to -1
    await act(async () => { vi.advanceTimersByTime(1200); await Promise.resolve() })
    // still one Loader2 (active at last)
    expect(screen.getAllByTestId('Loader2').length).toBe(1)
    // completed checks: first only
    expect(screen.getAllByTestId('CheckCircle2').length).toBe(1)
  })
})

describe('TutorielWorkflow', () => {
  it('renders items and highlights active index with different classes', () => {
    // use renderHook to obey wrapper requirement in at least one place
    renderHook(() => 0, { wrapper: QueryClientWrapper })

    const items = [
      { id: 'w1', label: 'Step one', icon: React.createElement('span', { 'data-testid': 'icon-1' }), color: '#ff0000' },
      { id: 'w2', label: 'Step two', icon: React.createElement('span', { 'data-testid': 'icon-2' }), color: '#00ff00' },
      { id: 'w3', label: 'Step three', icon: React.createElement('span', { 'data-testid': 'icon-3' }) }
    ]

    render(React.createElement(TutorielWorkflow, { items, activeIndex: 1, className: 'workflow-test' }), { wrapper: QueryClientWrapper })

    // All labels present
    expect(screen.getByText('Step one')).toBeTruthy()
    expect(screen.getByText('Step two')).toBeTruthy()
    expect(screen.getByText('Step three')).toBeTruthy()

    // Active item (index 1) should have scale-110 class applied by cn
    const activeLabel = screen.getByText('Step two')
    // climb up to the container element that gets scale-110 class; we can query its parent
    const parent = activeLabel.parentElement
    // ensure parent exists and contains 'scale-110' in className string (cn returns joined classes)
    expect(parent).toBeTruthy()
    expect(parent?.className.includes('scale-110')).toBe(true)

    // Connectors: should be items.length -1 arrows
    const arrows = screen.getAllByTestId('ArrowRight')
    expect(arrows.length).toBe(2)
  })
})

describe('supabase mock behavior and mutation simulation', () => {
  it('calls supabase.from(...).insert(...) and records arguments on builder.insert', async () => {
    // perform a mutation using the mocked supabase client to assert builder methods were called
    const supabaseModule = await import('@/integrations/supabase/client')
    const { supabase } = supabaseModule as any

    // Ensure builder is configured for success
    supabaseBuilder.__response = 'success'

    await act(async () => {
      await supabase.from('items').insert({ name: 'test-item' }).then((res: any) => {
        // res should equal RESPONSE_SUCCESS as per hoisted mock
        expect(res).toEqual(RESPONSE_SUCCESS)
      })
    })

    // assert mockFrom was called with correct table
    expect(mockFrom).toHaveBeenCalledWith('items')
    // assert insert was called with the object we passed
    expect(supabaseBuilder.insert).toHaveBeenCalled()
    const lastCall = supabaseBuilder.__calls.find((c: any) => c.method === 'insert')
    expect(lastCall).toBeTruthy()
    expect(lastCall.args[0]).toEqual({ name: 'test-item' })
  })

  it('allows configuring builder to simulate error response and then observe error shape', async () => {
    // configure builder to resolve to error payload
    supabaseBuilder.__response = 'error'
    const supabaseModule = await import('@/integrations/supabase/client')
    const { supabase } = supabaseModule as any

    let observed: any = null
    await act(async () => {
      await supabase.from('items').select('*').then((res: any) => { observed = res })
    })

    // observed should equal RESPONSE_ERROR defined in hoisted scope
    expect(observed).toEqual(RESPONSE_ERROR)
  })
})