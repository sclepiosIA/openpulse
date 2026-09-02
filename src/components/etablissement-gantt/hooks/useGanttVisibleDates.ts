import { useState, useEffect, RefObject } from 'react'
import { addDays } from 'date-fns'
import { TimelineConfig } from './useGanttZoom'

export function useGanttVisibleDates(
  scrollContainerRef: RefObject<HTMLDivElement>,
  timeline: TimelineConfig | null
) {
  const [visibleStart, setVisibleStart] = useState<Date | null>(null)
  const [visibleEnd, setVisibleEnd] = useState<Date | null>(null)
  const timelineStartMs = timeline?.start.getTime() ?? null
  const pixelsPerDay = timeline?.pixelsPerDay ?? null

  useEffect(() => {
    if (
      !scrollContainerRef.current ||
      timelineStartMs === null ||
      !pixelsPerDay ||
      pixelsPerDay <= 0
    )
      return

    const updateVisibleDates = () => {
      const container = scrollContainerRef.current
      if (!container) return

      const scrollLeft = container.scrollLeft
      const containerWidth = container.clientWidth

      // Calculer les jours visibles basés sur le scroll
      const startDayOffset = Math.floor(scrollLeft / pixelsPerDay)
      const visibleDays = Math.ceil(containerWidth / pixelsPerDay)

      const newStart = addDays(new Date(timelineStartMs), startDayOffset)
      const newEnd = addDays(newStart, visibleDays)

      setVisibleStart(newStart)
      setVisibleEnd(newEnd)
    }

    // Mise à jour initiale
    updateVisibleDates()

    // Throttle avec requestAnimationFrame pour optimiser les performances
    let rafId: number | null = null
    const throttledUpdate = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        updateVisibleDates()
        rafId = null
      })
    }

    // Écouter le scroll
    const container = scrollContainerRef.current
    container.addEventListener('scroll', throttledUpdate)

    // Écouter le resize de la fenêtre
    window.addEventListener('resize', throttledUpdate)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      container.removeEventListener('scroll', throttledUpdate)
      window.removeEventListener('resize', throttledUpdate)
    }
  }, [scrollContainerRef, timelineStartMs, pixelsPerDay])

  return { visibleStart, visibleEnd }
}
