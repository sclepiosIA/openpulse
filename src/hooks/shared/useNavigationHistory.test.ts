/* @vitest-environment jsdom */

import React, { type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useNavigationHistory } from './useNavigationHistory'
import { NavigationHistoryContext } from '@/contexts/NavigationHistoryContext'

const { AUTH_STATE, STABLE_CONTEXT_VALUE, mockNavigate, mockFrom } = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  STABLE_CONTEXT_VALUE: {
    history: ['/home', '/profile'],
    currentIndex: 1,
    canGoBack: true,
    canGoForward: false,
    navigateBack: vi.fn(),
    navigateForward: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    clear: vi.fn(),
  },
  mockNavigate: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/integrations/supabase/client', () => {
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

  mockFrom.mockReturnValue(builder)

  return {
    supabase: {
      from: mockFrom,
    },
  }
})

function createWrapper(contextValue?: React.ContextType<typeof NavigationHistoryContext>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        NavigationHistoryContext.Provider,
        { value: contextValue },
        children,
      ),
    )
  }
}

describe('useNavigationHistory', () => {
  it('throws a clear error when used outside NavigationHistoryProvider', () => {
    const wrapper = createWrapper(undefined)

    expect(() => renderHook(() => useNavigationHistory(), { wrapper })).toThrowError(
      'useNavigationHistory must be used within NavigationHistoryProvider',
    )
  })

  it('returns the navigation history context value when used inside provider', async () => {
    const wrapper = createWrapper(STABLE_CONTEXT_VALUE)

    const { result } = renderHook(() => useNavigationHistory(), { wrapper })

    await waitFor(() => {
      expect(result.current).toBe(STABLE_CONTEXT_VALUE)
    })

    expect(result.current.history).toEqual(['/home', '/profile'])
    expect(result.current.currentIndex).toBe(1)
    expect(result.current.canGoBack).toBe(true)
    expect(result.current.canGoForward).toBe(false)
    expect(result.current.navigateBack).toBe(STABLE_CONTEXT_VALUE.navigateBack)
    expect(result.current.navigateForward).toBe(STABLE_CONTEXT_VALUE.navigateForward)
    expect(result.current.push).toBe(STABLE_CONTEXT_VALUE.push)
    expect(result.current.replace).toBe(STABLE_CONTEXT_VALUE.replace)
    expect(result.current.clear).toBe(STABLE_CONTEXT_VALUE.clear)
  })
})