import { useState, useMemo } from 'react'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, addDays, addWeeks, addMonths, addQuarters, addYears, differenceInDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface TimelineConfig {
  start: Date
  end: Date
  totalDays: number
  pixelsPerDay: number
  headerLevels: Array<{
    label: string
    startDate: Date
    endDate: Date
    left: number
    width: number
  }>
}

export function useGanttZoom(tasks: any[]) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('week')
  const [viewStartDate, setViewStartDate] = useState<Date | null>(null)

  // Calculer la timeline selon le niveau de zoom
  const timeline = useMemo((): TimelineConfig | null => {
    if (!tasks || tasks.length === 0) return null

    const today = new Date()
    
    // Définir minimumEnd selon le niveau de zoom
    let minimumEnd: Date
    switch (zoomLevel) {
      case 'day':
      case 'week':
      case 'month':
        minimumEnd = new Date(2026, 5, 30) // 30 juin 2026 (mi-2026)
        break
      case 'quarter':
      case 'year':
        minimumEnd = new Date(2027, 11, 31) // 31 décembre 2027
        break
      default:
        minimumEnd = new Date(2026, 5, 30)
    }
    
    let visibleStart: Date
    let visibleEnd: Date
    
    // Calculer visibleStart selon le zoom
    switch (zoomLevel) {
      case 'day':
        visibleStart = viewStartDate ? startOfWeek(viewStartDate, { weekStartsOn: 1 }) : startOfWeek(today, { weekStartsOn: 1 })
        break
      case 'week':
        visibleStart = viewStartDate ? startOfWeek(viewStartDate, { weekStartsOn: 1 }) : startOfWeek(today, { weekStartsOn: 1 })
        break
      case 'month':
        visibleStart = viewStartDate ? startOfMonth(viewStartDate) : startOfMonth(today)
        break
      case 'quarter':
        visibleStart = viewStartDate ? startOfQuarter(viewStartDate) : startOfQuarter(today)
        break
      case 'year':
        visibleStart = viewStartDate ? startOfYear(viewStartDate) : startOfYear(today)
        break
    }
    
    // Calculer visibleEnd selon le zoom avec périodes étendues
    switch (zoomLevel) {
      case 'day': {
        const defaultEnd = addMonths(visibleStart, 6) // 6 mois de données
        visibleEnd = defaultEnd > minimumEnd ? defaultEnd : minimumEnd
        break
      }
      case 'week': {
        const defaultEnd = addMonths(visibleStart, 18) // 1.5 an minimum
        visibleEnd = defaultEnd > minimumEnd ? defaultEnd : minimumEnd
        break
      }
      case 'month': {
        const defaultEnd = addMonths(visibleStart, 24) // 2 ans
        visibleEnd = defaultEnd > minimumEnd ? defaultEnd : minimumEnd
        break
      }
      case 'quarter': {
        const defaultEnd = addQuarters(visibleStart, 12) // 3 ans
        visibleEnd = defaultEnd > minimumEnd ? defaultEnd : minimumEnd
        break
      }
      case 'year': {
        const defaultEnd = addYears(visibleStart, 4) // 4 ans
        visibleEnd = defaultEnd > minimumEnd ? defaultEnd : minimumEnd
        break
      }
    }
    
    return generateTimeline(visibleStart, visibleEnd, zoomLevel)
  }, [tasks, zoomLevel, viewStartDate])

  // Fonction helper pour générer la config de timeline
  function generateTimeline(visibleStart: Date, visibleEnd: Date, zoom: ZoomLevel): TimelineConfig {

    const totalDays = differenceInDays(visibleEnd, visibleStart)
    
    // Pixels par jour selon le zoom - valeurs augmentées pour meilleure lisibilité
    const pixelsPerDay = zoom === 'day' ? 50 : zoom === 'week' ? 20 : zoom === 'month' ? 8 : zoom === 'quarter' ? 3 : 1.5

    // Générer les niveaux de header
    const headerLevels: TimelineConfig['headerLevels'] = []
    
    if (zoom === 'day' || zoom === 'week') {
      // Générer les semaines
      let current = startOfWeek(visibleStart, { weekStartsOn: 1 })
      while (current <= visibleEnd) {
        const weekEnd = endOfWeek(current, { weekStartsOn: 1 })
        const startOffset = differenceInDays(current, visibleStart)
        const duration = differenceInDays(weekEnd < visibleEnd ? weekEnd : visibleEnd, current)
        
        headerLevels.push({
          label: format(current, "'Semaine' w - MMM yyyy", { locale: fr }),
          startDate: current,
          endDate: weekEnd,
          left: Math.round((startOffset / totalDays) * 100 * 100) / 100,
          width: Math.round((duration / totalDays) * 100 * 100) / 100
        })
        
        current = addWeeks(current, 1)
      }
    } else if (zoom === 'month') {
      // Générer les mois
      let current = startOfMonth(visibleStart)
      while (current <= visibleEnd) {
        const monthEnd = endOfMonth(current)
        const startOffset = differenceInDays(current, visibleStart)
        const duration = differenceInDays(monthEnd < visibleEnd ? monthEnd : visibleEnd, current)
        
        headerLevels.push({
          label: format(current, 'MMMM yyyy', { locale: fr }),
          startDate: current,
          endDate: monthEnd,
          left: Math.round((startOffset / totalDays) * 100 * 100) / 100,
          width: Math.round((duration / totalDays) * 100 * 100) / 100
        })
        
        current = addMonths(current, 1)
      }
    } else if (zoom === 'quarter') {
      // Générer les trimestres
      let current = startOfQuarter(visibleStart)
      while (current <= visibleEnd) {
        const quarterEnd = endOfQuarter(current)
        const startOffset = differenceInDays(current, visibleStart)
        const duration = differenceInDays(quarterEnd < visibleEnd ? quarterEnd : visibleEnd, current)
        
        const quarter = Math.floor(current.getMonth() / 3) + 1
        headerLevels.push({
          label: `T${quarter} ${format(current, 'yyyy', { locale: fr })}`,
          startDate: current,
          endDate: quarterEnd,
          left: Math.round((startOffset / totalDays) * 100 * 100) / 100,
          width: Math.round((duration / totalDays) * 100 * 100) / 100
        })
        
        current = addQuarters(current, 1)
      }
    } else {
      // Générer les années
      let current = startOfYear(visibleStart)
      while (current <= visibleEnd) {
        const yearEnd = endOfYear(current)
        const startOffset = differenceInDays(current, visibleStart)
        const duration = differenceInDays(yearEnd < visibleEnd ? yearEnd : visibleEnd, current)
        
        headerLevels.push({
          label: format(current, 'yyyy', { locale: fr }),
          startDate: current,
          endDate: yearEnd,
          left: Math.round((startOffset / totalDays) * 100 * 100) / 100,
          width: Math.round((duration / totalDays) * 100 * 100) / 100
        })
        
        current = addYears(current, 1)
      }
    }

    return {
      start: visibleStart,
      end: visibleEnd,
      totalDays,
      pixelsPerDay,
      headerLevels
    }
  }

  const goToPrevious = () => {
    if (!timeline) return
    const current = viewStartDate || timeline.start
    
    switch (zoomLevel) {
      case 'day':
        setViewStartDate(addWeeks(current, -1))
        break
      case 'week':
        setViewStartDate(addWeeks(current, -4)) // 1 mois
        break
      case 'month':
        setViewStartDate(addMonths(current, -1))
        break
      case 'quarter':
        setViewStartDate(addQuarters(current, -1))
        break
      case 'year':
        setViewStartDate(addYears(current, -1))
        break
    }
  }

  const goToNext = () => {
    if (!timeline) return
    const current = viewStartDate || timeline.start
    
    switch (zoomLevel) {
      case 'day':
        setViewStartDate(addWeeks(current, 1))
        break
      case 'week':
        setViewStartDate(addWeeks(current, 4)) // 1 mois
        break
      case 'month':
        setViewStartDate(addMonths(current, 1))
        break
      case 'quarter':
        setViewStartDate(addQuarters(current, 1))
        break
      case 'year':
        setViewStartDate(addYears(current, 1))
        break
    }
  }

  const goToToday = () => {
    navigateToDate(new Date())
  }

  const getTodayPosition = (): number => {
    if (!timeline) return -1
    const today = new Date()
    const offset = differenceInDays(today, timeline.start)
    return offset * timeline.pixelsPerDay // Retourner des pixels au lieu de pourcentages
  }

  // Naviguer vers une date spécifique (centrage fluide)
  const navigateToDate = (targetDate: Date) => {
    if (zoomLevel === 'day') {
      // Centrer sur la date : afficher 1.5 semaine avant, 1.5 après
      const newStart = startOfWeek(addDays(targetDate, -10), { weekStartsOn: 1 })
      setViewStartDate(newStart)
    } else if (zoomLevel === 'month') {
      // Centrer sur la date : afficher 2 mois avant, 2 après
      const newStart = startOfMonth(addMonths(targetDate, -2))
      setViewStartDate(newStart)
    } else {
      // Pour week/quarter/year, reset la vue (affichage complet)
      setViewStartDate(null)
    }
  }

  // Naviguer vers une tâche spécifique
  const navigateToTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task || !task.echeance) return
    
    const taskDate = new Date(task.echeance)
    navigateToDate(taskDate)
  }

  return {
    zoomLevel,
    setZoomLevel,
    timeline,
    goToPrevious,
    goToNext,
    goToToday,
    getTodayPosition,
    navigateToDate,
    navigateToTask
  }
}
