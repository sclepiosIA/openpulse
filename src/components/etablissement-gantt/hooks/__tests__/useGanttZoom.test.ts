import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGanttZoom } from '../useGanttZoom'

const baseTask = (overrides: any = {}) => ({
  id: 't1',
  echeance: '2026-06-15',
  ...overrides,
})

describe('useGanttZoom', () => {
  it('returns null timeline when no tasks', () => {
    const { result } = renderHook(() => useGanttZoom([]))
    expect(result.current.timeline).toBeNull()
    expect(result.current.zoomLevel).toBe('week')
  })

  it('builds a timeline for week zoom with header levels', () => {
    const { result } = renderHook(() => useGanttZoom([baseTask()]))
    expect(result.current.timeline).not.toBeNull()
    expect(result.current.timeline!.pixelsPerDay).toBe(20)
    expect(result.current.timeline!.headerLevels.length).toBeGreaterThan(0)
  })

  it('changes pixelsPerDay when switching to day zoom', () => {
    const { result } = renderHook(() => useGanttZoom([baseTask()]))
    act(() => result.current.setZoomLevel('day'))
    expect(result.current.timeline!.pixelsPerDay).toBe(50)
  })

  it('quarter zoom produces quarter-labelled headers', () => {
    const { result } = renderHook(() => useGanttZoom([baseTask()]))
    act(() => result.current.setZoomLevel('quarter'))
    expect(result.current.timeline!.pixelsPerDay).toBe(3)
    expect(result.current.timeline!.headerLevels[0].label).toMatch(/^T[1-4]\s\d{4}$/)
  })

  it('year zoom produces year-labelled headers', () => {
    const { result } = renderHook(() => useGanttZoom([baseTask()]))
    act(() => result.current.setZoomLevel('year'))
    expect(result.current.timeline!.pixelsPerDay).toBe(1.5)
    expect(result.current.timeline!.headerLevels[0].label).toMatch(/^\d{4}$/)
  })

  it('month zoom produces month labels', () => {
    const { result } = renderHook(() => useGanttZoom([baseTask()]))
    act(() => result.current.setZoomLevel('month'))
    expect(result.current.timeline!.pixelsPerDay).toBe(8)
    expect(result.current.timeline!.headerLevels[0].label).toMatch(/\d{4}/)
  })

  it('goToPrevious and goToNext move the view', () => {
    const { result } = renderHook(() => useGanttZoom([baseTask()]))
    const initialStart = result.current.timeline!.start.getTime()
    act(() => result.current.goToNext())
    const afterNext = result.current.timeline!.start.getTime()
    expect(afterNext).toBeGreaterThan(initialStart)
    act(() => result.current.goToPrevious())
    act(() => result.current.goToPrevious())
    expect(result.current.timeline!.start.getTime()).toBeLessThan(afterNext)
  })

  it('goToToday resets viewStartDate based on zoom', () => {
    const { result } = renderHook(() => useGanttZoom([baseTask()]))
    act(() => result.current.goToNext())
    act(() => result.current.goToToday())
    expect(result.current.timeline).not.toBeNull()
  })

  it('getTodayPosition returns a numeric pixel offset', () => {
    const { result } = renderHook(() => useGanttZoom([baseTask()]))
    expect(typeof result.current.getTodayPosition()).toBe('number')
  })

  it('navigateToTask is a no-op for unknown task', () => {
    const { result } = renderHook(() => useGanttZoom([baseTask()]))
    expect(() => result.current.navigateToTask('unknown')).not.toThrow()
  })

  it('navigateToTask works on existing task', () => {
    const { result } = renderHook(() => useGanttZoom([baseTask({ id: 'abc', echeance: '2027-01-15' })]))
    act(() => result.current.navigateToTask('abc'))
    expect(result.current.timeline).not.toBeNull()
  })
})
