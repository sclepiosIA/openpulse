// @vitest-environment jsdom

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMobileDashboard } from './useMobileDashboard'

const { authState, mockUseIsMobile } = vi.hoisted(() => ({
  authState: {
    user: { id: 'u1', email: 'user@test.dev' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockUseIsMobile: vi.fn(),
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: mockUseIsMobile,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('useMobileDashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    mockUseIsMobile.mockReset()
    mockUseIsMobile.mockReturnValue(true)
  })

  it('expose l’état initial en mode compact avec isMobile et indices à 0', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useMobileDashboard(), { wrapper })

    await waitFor(() => {
      expect(result.current.mode).toBe('compact')
    })

    expect(result.current.isCompact).toBe(true)
    expect(result.current.isMobile).toBe(true)
    expect(result.current.carousel1Index).toBe(0)
    expect(result.current.carousel2Index).toBe(0)
    expect(result.current.currentWidgetIndex).toBe(0)
    expect(localStorage.getItem('dashboard_mobile_mode')).toBe('compact')
  })

  it('lit le mode depuis localStorage au chargement et reflète un device non mobile', async () => {
    localStorage.setItem('dashboard_mobile_mode', 'full')
    mockUseIsMobile.mockReturnValue(false)

    const wrapper = createWrapper()

    const { result } = renderHook(() => useMobileDashboard(), { wrapper })

    await waitFor(() => {
      expect(result.current.mode).toBe('full')
    })

    expect(result.current.isCompact).toBe(false)
    expect(result.current.isMobile).toBe(false)
    expect(result.current.carousel1Index).toBe(0)
    expect(result.current.carousel2Index).toBe(0)
    expect(result.current.currentWidgetIndex).toBe(0)
    expect(localStorage.getItem('dashboard_mobile_mode')).toBe('full')
  })

  it('met à jour les indices puis reset tout quand setMode est appelé, et persiste la valeur', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useMobileDashboard(), { wrapper })

    await waitFor(() => {
      expect(result.current.mode).toBe('compact')
    })

    await act(async () => {
      result.current.setCarousel1Index(2)
      result.current.setCarousel2Index(3)
      result.current.setCurrentWidgetIndex(4)
    })

    expect(result.current.carousel1Index).toBe(2)
    expect(result.current.carousel2Index).toBe(3)
    expect(result.current.currentWidgetIndex).toBe(4)

    await act(async () => {
      result.current.setMode('full')
    })

    expect(result.current.mode).toBe('full')
    expect(result.current.isCompact).toBe(false)
    expect(result.current.carousel1Index).toBe(0)
    expect(result.current.carousel2Index).toBe(0)
    expect(result.current.currentWidgetIndex).toBe(0)
    expect(localStorage.getItem('dashboard_mobile_mode')).toBe('full')
  })

  it('toggleMode bascule de compact vers full puis revient à compact en réinitialisant les indices', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useMobileDashboard(), { wrapper })

    await waitFor(() => {
      expect(result.current.mode).toBe('compact')
    })

    await act(async () => {
      result.current.setCarousel1Index(1)
      result.current.setCarousel2Index(2)
      result.current.setCurrentWidgetIndex(3)
    })

    await act(async () => {
      result.current.toggleMode()
    })

    expect(result.current.mode).toBe('full')
    expect(result.current.isCompact).toBe(false)
    expect(result.current.carousel1Index).toBe(0)
    expect(result.current.carousel2Index).toBe(0)
    expect(result.current.currentWidgetIndex).toBe(0)
    expect(localStorage.getItem('dashboard_mobile_mode')).toBe('full')

    await act(async () => {
      result.current.setCarousel1Index(5)
      result.current.setCarousel2Index(6)
      result.current.setCurrentWidgetIndex(7)
    })

    await act(async () => {
      result.current.toggleMode()
    })

    expect(result.current.mode).toBe('compact')
    expect(result.current.isCompact).toBe(true)
    expect(result.current.carousel1Index).toBe(0)
    expect(result.current.carousel2Index).toBe(0)
    expect(result.current.currentWidgetIndex).toBe(0)
    expect(localStorage.getItem('dashboard_mobile_mode')).toBe('compact')
  })

  it('considère une valeur invalide de localStorage comme mode brut non compact, sans planter', async () => {
    localStorage.setItem('dashboard_mobile_mode', 'unexpected')

    const wrapper = createWrapper()

    const { result } = renderHook(() => useMobileDashboard(), { wrapper })

    await waitFor(() => {
      expect(result.current.mode).toBe('unexpected' as 'compact' | 'full')
    })

    expect(result.current.isCompact).toBe(false)
    expect(result.current.isMobile).toBe(true)
    expect(result.current.carousel1Index).toBe(0)
    expect(result.current.carousel2Index).toBe(0)
    expect(result.current.currentWidgetIndex).toBe(0)
    expect(localStorage.getItem('dashboard_mobile_mode')).toBe('unexpected')
  })
})
