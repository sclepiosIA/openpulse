import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { useGanttVisibleDates } from '../useGanttVisibleDates'
import type { TimelineConfig } from '../useGanttZoom'

const makeTimeline = (): TimelineConfig => ({
  start: new Date(2026, 0, 1),
  end: new Date(2026, 11, 31),
  totalDays: 365,
  pixelsPerDay: 20,
  headerLevels: [],
})

describe('useGanttVisibleDates', () => {
  it('returns null dates when ref has no current', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null)
      return useGanttVisibleDates(ref, makeTimeline())
    })
    expect(result.current.visibleStart).toBeNull()
    expect(result.current.visibleEnd).toBeNull()
  })

  it('returns null dates when timeline is null', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(document.createElement('div'))
      return useGanttVisibleDates(ref, null)
    })
    expect(result.current.visibleStart).toBeNull()
  })

  it('computes visible dates from scrolled container', () => {
    const div = document.createElement('div')
    Object.defineProperty(div, 'scrollLeft', { value: 400, writable: true })
    Object.defineProperty(div, 'clientWidth', { value: 800, writable: true })

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(div)
      return useGanttVisibleDates(ref, makeTimeline())
    })

    expect(result.current.visibleStart).toBeInstanceOf(Date)
    expect(result.current.visibleEnd).toBeInstanceOf(Date)
    expect(result.current.visibleEnd!.getTime()).toBeGreaterThan(result.current.visibleStart!.getTime())
  })
})
