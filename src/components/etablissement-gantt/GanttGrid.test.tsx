/* @vitest-environment jsdom */
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { GanttGrid } from './GanttGrid'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: Array<string | false | null | undefined>) => inputs.filter(Boolean).join(' ')
}))

describe('GanttGrid', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders one vertical line per day and highlights weekend days in day zoom', () => {
    const timeline = {
      start: new Date('2024-01-05T00:00:00.000Z'),
      end: new Date('2024-01-08T00:00:00.000Z'),
      pixelsPerDay: 10
    }

    const { container } = render(
      <GanttGrid timeline={timeline} zoomLevel="day" height={120} />
    )

    const root = container.firstElementChild
    expect(root).not.toBeNull()
    expect(root?.className).toContain('absolute inset-0 pointer-events-none')

    const verticalLines = container.querySelectorAll('.absolute.top-0.w-px')
    expect(verticalLines).toHaveLength(4)

    expect(verticalLines[0]?.className).toContain('bg-border/40')
    expect(verticalLines[0]?.getAttribute('style')).toContain('left: 0px')
    expect(verticalLines[0]?.getAttribute('style')).toContain('height: 120px')

    expect(verticalLines[1]?.getAttribute('style')).toContain('left: 10px')
    expect(verticalLines[2]?.getAttribute('style')).toContain('left: 20px')
    expect(verticalLines[3]?.getAttribute('style')).toContain('left: 30px')

    const weekendZones = container.querySelectorAll('.absolute.top-0.bg-muted\\/10')
    expect(weekendZones).toHaveLength(2)

    expect(weekendZones[0]?.getAttribute('style')).toContain('left: 10px')
    expect(weekendZones[0]?.getAttribute('style')).toContain('width: 10px')
    expect(weekendZones[0]?.getAttribute('style')).toContain('height: 120px')

    expect(weekendZones[1]?.getAttribute('style')).toContain('left: 20px')
    expect(weekendZones[1]?.getAttribute('style')).toContain('width: 10px')
    expect(weekendZones[1]?.getAttribute('style')).toContain('height: 120px')
  })

  it('renders month boundaries and subdivision lines in month zoom using the actual day-difference math from the component', () => {
    const timeline = {
      start: new Date('2024-01-01T00:00:00.000Z'),
      end: new Date('2024-02-29T00:00:00.000Z'),
      pixelsPerDay: 8
    }

    const { container } = render(
      <GanttGrid timeline={timeline} zoomLevel="month" height={200} />
    )

    const verticalLines = Array.from(container.querySelectorAll('.absolute.top-0.w-px'))
    expect(verticalLines).toHaveLength(8)

    const subdivisionLines = verticalLines.filter((line) => line.className.includes('bg-border/20'))
    const mainLines = verticalLines.filter((line) => line.className.includes('bg-border/40'))

    expect(subdivisionLines).toHaveLength(6)
    expect(mainLines).toHaveLength(2)

    expect(mainLines[0]?.getAttribute('style')).toContain('left: 0px')
    expect(mainLines[0]?.getAttribute('style')).toContain('height: 200px')
    expect(mainLines[1]?.getAttribute('style')).toContain('left: 248px')
    expect(mainLines[1]?.getAttribute('style')).toContain('height: 200px')

    expect(subdivisionLines[0]?.getAttribute('style')).toContain('left: 56px')
    expect(subdivisionLines[1]?.getAttribute('style')).toContain('left: 120px')
    expect(subdivisionLines[2]?.getAttribute('style')).toContain('left: 176px')

    expect(subdivisionLines[3]?.getAttribute('style')).toContain('left: 304px')
    expect(subdivisionLines[4]?.getAttribute('style')).toContain('left: 360px')
    expect(subdivisionLines[5]?.getAttribute('style')).toContain('left: 416px')

    const weekendZones = container.querySelectorAll('.absolute.top-0.bg-muted\\/10')
    expect(weekendZones).toHaveLength(0)
  })

  it('renders one vertical line per week for non-day and non-month zoom levels, including dates before timeline start', () => {
    const timeline = {
      start: new Date('2024-01-03T00:00:00.000Z'),
      end: new Date('2024-01-24T00:00:00.000Z'),
      pixelsPerDay: 5
    }

    const { container, rerender } = render(
      <GanttGrid timeline={timeline} zoomLevel="week" height={90} />
    )

    let verticalLines = container.querySelectorAll('.absolute.top-0.w-px')
    expect(verticalLines).toHaveLength(4)

    expect(verticalLines[0]?.className).toContain('bg-border/40')
    expect(verticalLines[0]?.getAttribute('style')).toContain('left: -10px')
    expect(verticalLines[1]?.getAttribute('style')).toContain('left: 25px')
    expect(verticalLines[2]?.getAttribute('style')).toContain('left: 60px')
    expect(verticalLines[3]?.getAttribute('style')).toContain('left: 95px')

    rerender(<GanttGrid timeline={timeline} zoomLevel="year" height={90} />)

    verticalLines = container.querySelectorAll('.absolute.top-0.w-px')
    expect(verticalLines).toHaveLength(4)
    expect(verticalLines[0]?.getAttribute('style')).toContain('left: -10px')
    expect(container.querySelectorAll('.absolute.top-0.bg-muted\\/10')).toHaveLength(0)
  })

  it('sets the display name for the memoized component', () => {
    expect(GanttGrid.displayName).toBe('GanttGrid')
  })
})