import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => true,
}))

import { useMobileDashboard } from '../analytics/useMobileDashboard'

describe('useMobileDashboard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('initializes with compact mode', () => {
    const { result } = renderHook(() => useMobileDashboard())
    expect(result.current.mode).toBe('compact')
    expect(result.current.isCompact).toBe(true)
    expect(result.current.isMobile).toBe(true)
  })

  it('toggles mode', () => {
    const { result } = renderHook(() => useMobileDashboard())
    act(() => result.current.toggleMode())
    expect(result.current.mode).toBe('full')
    expect(result.current.isCompact).toBe(false)
    act(() => result.current.toggleMode())
    expect(result.current.mode).toBe('compact')
  })

  it('persists mode to localStorage', () => {
    const { result } = renderHook(() => useMobileDashboard())
    act(() => result.current.setMode('full'))
    expect(localStorage.getItem('dashboard_mobile_mode')).toBe('full')
  })

  it('restores mode from localStorage', () => {
    localStorage.setItem('dashboard_mobile_mode', 'full')
    const { result } = renderHook(() => useMobileDashboard())
    expect(result.current.mode).toBe('full')
  })

  it('resets carousel indices on mode change', () => {
    const { result } = renderHook(() => useMobileDashboard())
    act(() => result.current.setCarousel1Index(3))
    act(() => result.current.setCarousel2Index(2))
    act(() => result.current.setMode('full'))
    expect(result.current.carousel1Index).toBe(0)
    expect(result.current.carousel2Index).toBe(0)
  })

  it('manages carousel indices', () => {
    const { result } = renderHook(() => useMobileDashboard())
    act(() => result.current.setCarousel1Index(2))
    act(() => result.current.setCarousel2Index(5))
    act(() => result.current.setCurrentWidgetIndex(1))
    expect(result.current.carousel1Index).toBe(2)
    expect(result.current.carousel2Index).toBe(5)
    expect(result.current.currentWidgetIndex).toBe(1)
  })
})
