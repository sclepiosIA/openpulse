/* @vitest-environment jsdom */

import React, { PropsWithChildren } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useVirtualBreadcrumb } from './useVirtualBreadcrumb'
import { useNavigationHistory } from './useNavigationHistory'

const {
  mockPushVirtualEntry,
  mockPopVirtualEntry,
  mockReplaceCurrentLabel,
  mockUseNavigationHistory,
} = vi.hoisted(() => ({
  mockPushVirtualEntry: vi.fn(),
  mockPopVirtualEntry: vi.fn(),
  mockReplaceCurrentLabel: vi.fn(),
  mockUseNavigationHistory: vi.fn(),
}))

vi.mock('./useNavigationHistory', () => ({
  useNavigationHistory: mockUseNavigationHistory,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useVirtualBreadcrumb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseNavigationHistory.mockReturnValue({
      pushVirtualEntry: mockPushVirtualEntry,
      popVirtualEntry: mockPopVirtualEntry,
      replaceCurrentLabel: mockReplaceCurrentLabel,
    })
  })

  it('expose les actions métier issues de useNavigationHistory', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useVirtualBreadcrumb(), { wrapper })

    expect(useNavigationHistory).toHaveBeenCalledTimes(1)
    expect(typeof result.current.pushEntry).toBe('function')
    expect(typeof result.current.popEntry).toBe('function')
    expect(typeof result.current.updateLabel).toBe('function')
  })

  it('pushEntry délègue à pushVirtualEntry avec label, callback, parentPath et entryType', async () => {
    const wrapper = createWrapper()
    const onBack = vi.fn()
    const { result } = renderHook(() => useVirtualBreadcrumb(), { wrapper })

    await act(async () => {
      result.current.pushEntry('Détails facture', onBack, '/factures', 'subsection')
    })

    expect(mockPushVirtualEntry).toHaveBeenCalledTimes(1)
    expect(mockPushVirtualEntry).toHaveBeenCalledWith(
      'Détails facture',
      onBack,
      '/factures',
      'subsection',
    )
  })

  it('pushEntry fonctionne aussi sans parentPath ni entryType', async () => {
    const wrapper = createWrapper()
    const onBack = vi.fn()
    const { result } = renderHook(() => useVirtualBreadcrumb(), { wrapper })

    await act(async () => {
      result.current.pushEntry('Nouvelle action', onBack)
    })

    expect(mockPushVirtualEntry).toHaveBeenCalledTimes(1)
    expect(mockPushVirtualEntry).toHaveBeenCalledWith(
      'Nouvelle action',
      onBack,
      undefined,
      undefined,
    )
  })

  it('popEntry délègue à popVirtualEntry sans argument', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useVirtualBreadcrumb(), { wrapper })

    await act(async () => {
      result.current.popEntry()
    })

    expect(mockPopVirtualEntry).toHaveBeenCalledTimes(1)
    expect(mockPopVirtualEntry).toHaveBeenCalledWith()
  })

  it('updateLabel délègue à replaceCurrentLabel avec le libellé fourni', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useVirtualBreadcrumb(), { wrapper })

    await act(async () => {
      result.current.updateLabel('Client modifié')
    })

    expect(mockReplaceCurrentLabel).toHaveBeenCalledTimes(1)
    expect(mockReplaceCurrentLabel).toHaveBeenCalledWith('Client modifié')
  })

  it('propage les erreurs métier provenant de pushVirtualEntry', async () => {
    const wrapper = createWrapper()
    const onBack = vi.fn()
    const error = new Error('push failed')
    mockPushVirtualEntry.mockImplementationOnce(() => {
      throw error
    })

    const { result } = renderHook(() => useVirtualBreadcrumb(), { wrapper })

    expect(() => {
      result.current.pushEntry('Erreur navigation', onBack, '/retour', 'action')
    }).toThrow('push failed')
  })

  it('propage les erreurs métier provenant de popVirtualEntry', async () => {
    const wrapper = createWrapper()
    const error = new Error('pop failed')
    mockPopVirtualEntry.mockImplementationOnce(() => {
      throw error
    })

    const { result } = renderHook(() => useVirtualBreadcrumb(), { wrapper })

    expect(() => {
      result.current.popEntry()
    }).toThrow('pop failed')
  })

  it('propage les erreurs métier provenant de replaceCurrentLabel', async () => {
    const wrapper = createWrapper()
    const error = new Error('replace failed')
    mockReplaceCurrentLabel.mockImplementationOnce(() => {
      throw error
    })

    const { result } = renderHook(() => useVirtualBreadcrumb(), { wrapper })

    expect(() => {
      result.current.updateLabel('Libellé impossible')
    }).toThrow('replace failed')
  })
})