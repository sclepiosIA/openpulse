/// <reference types="vitest" />
/// <reference types="vite/client" />

import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useJarvisAutopilot from './useJarvisAutopilot'

const {
  USER,
  RULES,
  EXECUTIONS,
  toastMock,
  debugErrorMock,
  stableInsertRow,
  insertParamsSpy,
  updateParamsSpy,
  deleteSpy,
  eqSpy,
  orderSpy,
  limitSpy,
  selectSpy,
  singleSpy,
  mockFrom,
  state,
  resetState,
} = vi.hoisted(() => {
  const USER = { id: 'u1', email: 't@t.co' }

  const RULES = [
    {
      id: 'r1',
      user_id: 'u1',
      name: 'Rule 1',
      description: 'Desc 1',
      trigger_type: 'schedule' as const,
      trigger_config: { cron: '0 9 * * *', days: ['mon', 'tue'] },
      action_type: 'command',
      action_config: { command: 'echo hi', notify: true },
      is_active: true,
      last_executed_at: null,
      execution_count: 2,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'r2',
      user_id: 'u1',
      name: 'Rule 2',
      description: null,
      trigger_type: 'event' as const,
      trigger_config: { event_type: 'insert', table: 'notes', conditions: { important: true } },
      action_type: 'tool',
      action_config: { tool: 'summarize', parameters: { max: 5 } },
      is_active: false,
      last_executed_at: '2024-02-01T00:00:00.000Z',
      execution_count: 1,
      created_at: '2024-01-02T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
    },
  ]

  const EXECUTIONS = [
    {
      id: 'e1',
      rule_id: 'r1',
      user_id: 'u1',
      trigger_data: { cron: '0 9 * * *' },
      action_result: { ok: true },
      status: 'success' as const,
      error_message: null,
      duration_ms: 120,
      executed_at: '2024-03-01T10:00:00.000Z',
    },
    {
      id: 'e2',
      rule_id: 'r2',
      user_id: 'u1',
      trigger_data: { event: 'insert' },
      action_result: null,
      status: 'failure' as const,
      error_message: 'boom',
      duration_ms: 35,
      executed_at: '2024-03-02T10:00:00.000Z',
    },
  ]

  const toastMock = vi.fn()
  const debugErrorMock = vi.fn()

  const stableInsertRow = {
    id: 'r3',
    user_id: 'u1',
    name: 'Created',
    description: null,
    trigger_type: 'condition' as const,
    trigger_config: { metric: 'cpu', operator: 'gt' as const, threshold: 80 },
    action_type: 'command',
    action_config: { command: 'scale', notify: false },
    is_active: true,
    last_executed_at: null,
    execution_count: 0,
    created_at: '2024-04-01T00:00:00.000Z',
    updated_at: '2024-04-01T00:00:00.000Z',
  }

  const insertParamsSpy = vi.fn()
  const updateParamsSpy = vi.fn()
  const deleteSpy = vi.fn()
  const eqSpy = vi.fn()
  const orderSpy = vi.fn()
  const limitSpy = vi.fn()
  const selectSpy = vi.fn()
  const singleSpy = vi.fn()

  type TableName = 'jarvis_autopilot_rules' | 'jarvis_autopilot_executions' | string

  const state = {
    rulesError: null as null | { message: string },
    executionsError: null as null | { message: string },
    insertError: null as null | { message: string },
    updateError: null as null | { message: string },
    deleteError: null as null | { message: string },
    rulesData: RULES as unknown[],
    executionsData: EXECUTIONS as unknown[],
    insertData: stableInsertRow as unknown,
  }

  const makeThenableResolved = <T,>(value: T) => {
    const thenable: PromiseLike<T> & {
      catch: (onRejected?: (reason: unknown) => unknown) => PromiseLike<T>
    } = {
      then: (onFulfilled?: ((value: T) => unknown) | null) => {
        if (onFulfilled) {
          try {
            const res = onFulfilled(value)
            return Promise.resolve(res) as unknown as PromiseLike<T>
          } catch (e) {
            return Promise.reject(e) as unknown as PromiseLike<T>
          }
        }
        return Promise.resolve(value) as unknown as PromiseLike<T>
      },
      catch: (onRejected?: (reason: unknown) => unknown) => {
        return Promise.resolve(value).catch(onRejected) as unknown as PromiseLike<T>
      },
    }
    return thenable
  }

  const mockFrom = vi.fn((table: TableName) => {
    const builder: {
      _table: TableName
      select: (...args: unknown[]) => unknown
      insert: (params: unknown) => unknown
      update: (params: unknown) => unknown
      delete: () => unknown
      eq: (...args: unknown[]) => unknown
      gte: (...args: unknown[]) => unknown
      lte: (...args: unknown[]) => unknown
      in: (...args: unknown[]) => unknown
      order: (...args: unknown[]) => unknown
      limit: (...args: unknown[]) => unknown
      single: () => Promise<{ data: unknown; error: unknown }>
      maybeSingle: () => Promise<{ data: unknown; error: unknown }>
      then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => PromiseLike<unknown>
      catch: (onRejected?: (reason: unknown) => unknown) => PromiseLike<unknown>
    } = {
      _table: table,

      select: vi.fn((..._args: unknown[]) => {
        selectSpy(..._args)
        return builder
      }),

      insert: vi.fn((params: unknown) => {
        insertParamsSpy(params)
        return builder
      }),

      update: vi.fn((params: unknown) => {
        updateParamsSpy(params)
        return builder
      }),

      delete: vi.fn(() => {
        deleteSpy()
        return builder
      }),

      eq: vi.fn((...args: unknown[]) => {
        eqSpy(...args)
        return builder
      }),

      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),

      order: vi.fn((...args: unknown[]) => {
        orderSpy(...args)
        return builder
      }),

      limit: vi.fn((...args: unknown[]) => {
        limitSpy(...args)
        return builder
      }),

      single: vi.fn(async () => {
        singleSpy()
        if (state.insertError) return { data: null, error: state.insertError }
        return { data: state.insertData, error: null }
      }),

      maybeSingle: vi.fn(async () => {
        if (state.insertError) return { data: null, error: state.insertError }
        return { data: state.insertData, error: null }
      }),

      then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
        if (table === 'jarvis_autopilot_rules') {
          const payload = state.rulesError
            ? { data: null, error: state.rulesError }
            : { data: state.rulesData, error: null }
          return makeThenableResolved(payload).then(onFulfilled, onRejected)
        }
        if (table === 'jarvis_autopilot_executions') {
          const payload = state.executionsError
            ? { data: null, error: state.executionsError }
            : { data: state.executionsData, error: null }
          return makeThenableResolved(payload).then(onFulfilled, onRejected)
        }
        const payload = { data: null, error: null }
        return makeThenableResolved(payload).then(onFulfilled, onRejected)
      },

      catch: (onRejected?: (reason: unknown) => unknown) => {
        return Promise.resolve().catch(onRejected) as unknown as PromiseLike<unknown>
      },
    }

    return builder
  })

  const resetState = () => {
    state.rulesError = null
    state.executionsError = null
    state.insertError = null
    state.updateError = null
    state.deleteError = null
    state.rulesData = RULES
    state.executionsData = EXECUTIONS
    state.insertData = stableInsertRow

    toastMock.mockClear()
    debugErrorMock.mockClear()
    insertParamsSpy.mockClear()
    updateParamsSpy.mockClear()
    deleteSpy.mockClear()
    eqSpy.mockClear()
    orderSpy.mockClear()
    limitSpy.mockClear()
    selectSpy.mockClear()
    singleSpy.mockClear()
    mockFrom.mockClear()
  }

  return {
    USER,
    RULES,
    EXECUTIONS,
    toastMock,
    debugErrorMock,
    stableInsertRow,
    insertParamsSpy,
    updateParamsSpy,
    deleteSpy,
    eqSpy,
    orderSpy,
    limitSpy,
    selectSpy,
    singleSpy,
    mockFrom,
    state,
    resetState,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
    log: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({
    user: USER,
    session: { user: USER },
    isLoading: false,
  }),
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const Wrapper = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { Wrapper, queryClient }
}

describe('useJarvisAutopilot', () => {
  it('charge les règles + exécutions et expose les sélecteurs métier', async () => {
    resetState()
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useJarvisAutopilot(), { wrapper: Wrapper })

    expect(result.current.isLoadingRules).toBe(true)
    expect(result.current.isLoadingExecutions).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoadingRules).toBe(false)
      expect(result.current.isLoadingExecutions).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('jarvis_autopilot_rules')
    expect(mockFrom).toHaveBeenCalledWith('jarvis_autopilot_executions')

    expect(result.current.rules?.map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(result.current.executions?.map((e) => e.id)).toEqual(['e1', 'e2'])

    expect(result.current.activeRulesCount).toBe(1)

    expect(result.current.getRuleById('r1')?.name).toBe('Rule 1')
    expect(result.current.getRuleById('missing')).toBeUndefined()

    const r1Execs = result.current.getExecutionsForRule('r1')
    expect(r1Execs).toHaveLength(1)
    expect(r1Execs[0]?.status).toBe('success')

    const scheduleRules = result.current.getRulesByTriggerType('schedule')
    expect(scheduleRules).toHaveLength(1)
    expect(scheduleRules[0]?.id).toBe('r1')
  })

  it('quand Supabase renvoie une erreur sur les queries, retourne des listes vides', async () => {
    resetState()
    state.rulesError = { message: 'x' }
    state.executionsError = { message: 'x' }
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useJarvisAutopilot(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isLoadingRules).toBe(false)
      expect(result.current.isLoadingExecutions).toBe(false)
    })

    expect(result.current.rules).toEqual([])
    expect(result.current.executions).toEqual([])
    expect(debugErrorMock).toHaveBeenCalled()
  })

  it('crée une règle (mutation) et invalide + toast', async () => {
    resetState()
    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useJarvisAutopilot(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isLoadingRules).toBe(false)
      expect(result.current.isLoadingExecutions).toBe(false)
    })

    const params = {
      name: 'Created',
      trigger_type: 'condition' as const,
      trigger_config: { metric: 'cpu', operator: 'gt' as const, threshold: 80 },
      action_type: 'command',
      action_config: { command: 'scale', notify: false },
      description: undefined,
    }

    await act(async () => {
      const created = await result.current.createRule(params)
      expect(created).toEqual(stableInsertRow)
    })

    expect(mockFrom).toHaveBeenCalledWith('jarvis_autopilot_rules')

    expect(insertParamsSpy).toHaveBeenCalledTimes(1)
    const insertArg = insertParamsSpy.mock.calls[0]?.[0]
    expect(Array.isArray(insertArg)).toBe(true)
    if (Array.isArray(insertArg) && insertArg[0] && typeof insertArg[0] === 'object') {
      expect(insertArg[0]).toMatchObject({
        user_id: 'u1',
        name: 'Created',
        description: null,
        trigger_type: 'condition',
        trigger_config: { metric: 'cpu', operator: 'gt', threshold: 80 },
        action_type: 'command',
        action_config: { command: 'scale', notify: false },
        is_active: true,
      })
    }

    expect(singleSpy).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['jarvis-autopilot-rules', 'u1'] })
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Règle créée',
      description: "La règle d'automatisation a été créée avec succès",
    })
  })

  it('gère une erreur lors de la création (mutation) : rejet + toast destructive', async () => {
    resetState()
    state.insertError = { message: 'x' }
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useJarvisAutopilot(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isLoadingRules).toBe(false)
      expect(result.current.isLoadingExecutions).toBe(false)
    })

    const params = {
      name: 'Created',
      trigger_type: 'condition' as const,
      trigger_config: { metric: 'cpu', operator: 'gt' as const, threshold: 80 },
      action_type: 'command' as const,
      action_config: { command: 'scale', notify: false },
    }

    await act(async () => {
      await expect(result.current.createRule(params)).rejects.toMatchObject({ message: 'x' })
    })

    expect(debugErrorMock).toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur',
      description: "Impossible de créer la règle d'automatisation",
      variant: 'destructive',
    })
  })

  it("toggleRule appelle update avec is_active + updated_at, et filtre sur id + user_id", async () => {
    resetState()
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useJarvisAutopilot(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isLoadingRules).toBe(false)
    })

    await act(async () => {
      await result.current.toggleRule({ ruleId: 'r2', isActive: true })
    })

    expect(updateParamsSpy).toHaveBeenCalledTimes(1)
    const updateArg = updateParamsSpy.mock.calls[0]?.[0]
    expect(updateArg).toMatchObject({ is_active: true })
    if (typeof updateArg === 'object' && updateArg !== null && 'updated_at' in updateArg) {
      expect(typeof (updateArg as { updated_at: unknown }).updated_at).toBe('string')
    }

    const eqArgs = eqSpy.mock.calls.map((c) => c.slice(0, 2))
    expect(eqArgs).toContainEqual(['id', 'r2'])
    expect(eqArgs).toContainEqual(['user_id', 'u1'])
  })

  it('deleteRule appelle delete puis filtre sur id + user_id, et affiche un toast', async () => {
    resetState()
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useJarvisAutopilot(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isLoadingRules).toBe(false)
    })

    await act(async () => {
      await result.current.deleteRule('r1')
    })

    expect(deleteSpy).toHaveBeenCalledTimes(1)

    const eqArgs = eqSpy.mock.calls.map((c) => c.slice(0, 2))
    expect(eqArgs).toContainEqual(['id', 'r1'])
    expect(eqArgs).toContainEqual(['user_id', 'u1'])

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Règle supprimée',
      description: "La règle d'automatisation a été supprimée",
    })
  })
})