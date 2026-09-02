// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { useDrilldown } from './useDrilldown'
import { RapportsDrilldownContext } from '@/contexts/RapportsDrilldownContext'

const { CONTEXT_VALUE, ALT_CONTEXT_VALUE } = vi.hoisted(() => ({
  CONTEXT_VALUE: {
    selectedLevel: 'region',
    selectedValue: 'Nord',
    setSelectedLevel: vi.fn(),
    setSelectedValue: vi.fn(),
    resetDrilldown: vi.fn(),
  },
  ALT_CONTEXT_VALUE: {
    selectedLevel: 'site',
    selectedValue: 'Paris',
    setSelectedLevel: vi.fn(),
    setSelectedValue: vi.fn(),
    resetDrilldown: vi.fn(),
  },
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(contextValue: typeof CONTEXT_VALUE | null) {
  const queryClient = createQueryClient()

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        RapportsDrilldownContext.Provider,
        { value: contextValue },
        props.children
      )
    )
  }
}

describe('useDrilldown', () => {
  it('retourne la valeur métier du contexte quand le provider est présent', () => {
    const wrapper = createWrapper(CONTEXT_VALUE)

    const { result } = renderHook(() => useDrilldown(), { wrapper })

    expect(result.current).toBe(CONTEXT_VALUE)
    expect(result.current.selectedLevel).toBe('region')
    expect(result.current.selectedValue).toBe('Nord')
    expect(result.current.setSelectedLevel).toBe(CONTEXT_VALUE.setSelectedLevel)
    expect(result.current.setSelectedValue).toBe(CONTEXT_VALUE.setSelectedValue)
    expect(result.current.resetDrilldown).toBe(CONTEXT_VALUE.resetDrilldown)
  })

  it('reflète une autre valeur de contexte sans la transformer', () => {
    const wrapper = createWrapper(ALT_CONTEXT_VALUE)

    const { result } = renderHook(() => useDrilldown(), { wrapper })

    expect(result.current).toBe(ALT_CONTEXT_VALUE)
    expect(result.current.selectedLevel).toBe('site')
    expect(result.current.selectedValue).toBe('Paris')
    expect(result.current.setSelectedLevel).toBe(ALT_CONTEXT_VALUE.setSelectedLevel)
    expect(result.current.resetDrilldown).toBe(ALT_CONTEXT_VALUE.resetDrilldown)
  })

  it('lance une erreur explicite si utilisé hors du provider', () => {
    const wrapper = createWrapper(null)

    expect(() => renderHook(() => useDrilldown(), { wrapper })).toThrowError(
      'useDrilldown must be used within RapportsDrilldownProvider'
    )
  })
})
