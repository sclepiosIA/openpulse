import { useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, addDays, differenceInDays, startOfWeek, eachWeekOfInterval, eachMonthOfInterval, subWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ZoomIn,
  ZoomOut,
  Building2,
  Calendar,
} from 'lucide-react'
import { GanttDualLayout } from '@/components/etablissement-gantt/GanttDualLayout'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import { cn } from '@/lib/utils'
import type { Etablissement } from '@/hooks/crm/useEtablissements'

interface DeploymentGanttViewProps {
  etablissements: Etablissement[]
}

type ZoomLevel = 'week' | 'month' | 'quarter'

interface TimelineConfig {
  start: Date
  end: Date
  totalDays: number
  pixelsPerDay: number
}

const ZOOM_PIXELS: Record<ZoomLevel, number> = {
  week: 25,
  month: 10,
  quarter: 4,
}

const PHASE_DURATIONS = {
  'Contractuel': 8,
  'Conformité': 15,
  'Déploiement': 30,
  'Formation': 10,
  'Go-Live': 5,
} as const

const PHASE_COLORS: Record<string, string> = {
  'Prospect': 'bg-slate-400',
  'Contractuel': 'bg-blue-500',
  'Conformité': 'bg-yellow-500',
  'Déploiement': 'bg-purple-500',
  'Formation': 'bg-green-500',
  'Go-Live': 'bg-emerald-500',
  'Production': 'bg-teal-500',
}

export function DeploymentGanttView({ etablissements }: DeploymentGanttViewProps) {
  const navigate = useNavigate()
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month')
  const scrollableRef = useRef<HTMLDivElement>(null)

  // Calculate timeline bounds
  const timeline = useMemo<TimelineConfig | null>(() => {
    if (etablissements.length === 0) return null
    
    const now = new Date()
    const dates: Date[] = [subWeeks(now, 4)] // Start 4 weeks ago minimum
    
    etablissements.forEach(e => {
      // Use date_signature if available, otherwise use created_at
      const startDate = e.date_signature ? new Date(e.date_signature) : new Date(e.created_at)
      dates.push(startDate)
      if (e.date_fin_contrat) dates.push(new Date(e.date_fin_contrat))
    })

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
    
    // Add padding
    const start = startOfWeek(addDays(minDate, -14), { weekStartsOn: 1 })
    const end = addDays(maxDate, 90) // 3 months after last date
    const totalDays = differenceInDays(end, start)
    const pixelsPerDay = ZOOM_PIXELS[zoomLevel]

    return { start, end, totalDays, pixelsPerDay }
  }, [etablissements, zoomLevel])

  // Generate weeks for header
  const weeks = useMemo(() => {
    if (!timeline) return []
    return eachWeekOfInterval(
      { start: timeline.start, end: timeline.end },
      { weekStartsOn: 1 }
    )
  }, [timeline])

  // Generate months for header
  const months = useMemo(() => {
    if (!timeline) return []
    return eachMonthOfInterval({ start: timeline.start, end: timeline.end })
  }, [timeline])

  // Calculate bar position
  const getBarStyle = useCallback((startDate: string | Date, durationDays: number) => {
    if (!timeline) return { left: 0, width: 0 }
    
    const start = new Date(startDate)
    const daysFromStart = differenceInDays(start, timeline.start)
    
    return {
      left: daysFromStart * timeline.pixelsPerDay,
      width: Math.max(durationDays * timeline.pixelsPerDay, 40),
    }
  }, [timeline])

  // Today marker position
  const todayPosition = useMemo(() => {
    if (!timeline) return -1
    const daysFromStart = differenceInDays(new Date(), timeline.start)
    return daysFromStart * timeline.pixelsPerDay
  }, [timeline])

  // Navigation functions
  const scrollToToday = useCallback(() => {
    if (!scrollableRef.current || !timeline) return
    const todayOffset = differenceInDays(new Date(), timeline.start) * timeline.pixelsPerDay
    scrollableRef.current.scrollTo({
      left: todayOffset - 200,
      behavior: 'smooth'
    })
  }, [timeline])

  const navigatePeriod = useCallback((direction: number) => {
    if (!scrollableRef.current) return
    const scrollAmount = direction * 7 * ZOOM_PIXELS[zoomLevel]
    scrollableRef.current.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    })
  }, [zoomLevel])

  // Process etablissements data - include ALL establishments
  const ganttData = useMemo(() => {
    const now = new Date()
    
    return etablissements
      .map(etablissement => {
        // Use date_signature if available, otherwise use created_at as fallback
        const startDate = etablissement.date_signature 
          ? new Date(etablissement.date_signature) 
          : new Date(etablissement.created_at)
        const daysSinceStart = differenceInDays(now, startDate)
        
        // Calculate total duration based on phases
        const phases = Object.keys(PHASE_DURATIONS) as Array<keyof typeof PHASE_DURATIONS>
        let totalDuration = phases.reduce((sum, phase) => sum + PHASE_DURATIONS[phase], 0)
        
        // If date_fin_contrat exists, use actual duration
        if (etablissement.date_fin_contrat) {
          totalDuration = differenceInDays(new Date(etablissement.date_fin_contrat), startDate)
        }

        return {
          etablissement,
          startDate,
          totalDuration: Math.max(totalDuration, 30),
          daysSinceStart,
          progression: etablissement.progression || 0
        }
      })
      .sort((a, b) => a.daysSinceStart - b.daysSinceStart)
  }, [etablissements])

  if (!timeline) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            Aucun établissement avec date de signature
          </p>
        </CardContent>
      </Card>
    )
  }

  const ganttWidth = timeline.totalDays * timeline.pixelsPerDay

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" onClick={() => navigatePeriod(-1)} className="h-8 w-8" aria-label="Précédent">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={scrollToToday} className="h-8">
              <CalendarDays className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Aujourd'hui</span>
            </Button>
            <Button size="icon" variant="outline" onClick={() => navigatePeriod(1)} className="h-8 w-8" aria-label="Suivant">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1 border-l pl-3">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <ToggleGroup 
              type="single" 
              value={zoomLevel} 
              onValueChange={(v) => v && setZoomLevel(v as ZoomLevel)}
              className="bg-background rounded-md p-0.5 border"
            >
              {(['week', 'month', 'quarter'] as ZoomLevel[]).map(level => (
                <ToggleGroupItem
                  key={level}
                  value={level}
                  className="h-7 px-2.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {level === 'week' ? 'Sem' : level === 'month' ? 'Mois' : 'Trim'}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex-1" />

          {/* Legend */}
          <div className="hidden lg:flex items-center gap-3 text-xs">
            {Object.entries(PHASE_COLORS).slice(1, 6).map(([phase, color]) => (
              <div key={phase} className="flex items-center gap-1.5">
                <div className={cn("w-3 h-3 rounded", color)} />
                <span className="text-muted-foreground">{phase}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gantt Chart */}
      <Card className="overflow-hidden">
        <GanttDualLayout
          leftColumnWidth={280}
          scrollableRef={scrollableRef}
          className="h-[calc(100vh-340px)] min-h-[400px]"
          fixedContent={
            <div className="bg-background">
              {/* Header */}
              <div className="h-12 border-b border-border bg-muted/50 flex items-center px-3 gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Établissements</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {ganttData.length}
                </Badge>
              </div>
              
              {/* Etablissement rows - labels */}
              {ganttData.map(({ etablissement }) => (
                <div 
                  key={etablissement.id}
                  className="flex items-center gap-3 h-14 px-3 border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/etablissements/${etablissement.id}`)}
                >
                  <EntityAvatar
                    name={etablissement.nom}
                    logoUrl={etablissement.logo_url}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{etablissement.nom}</p>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn("text-[10px] px-1.5 py-0", PHASE_COLORS[etablissement.statut] ? 'border-transparent text-white' : '')}
                        style={{ 
                          backgroundColor: PHASE_COLORS[etablissement.statut] ? undefined : 'transparent'
                        }}
                      >
                        <span className={cn(
                          PHASE_COLORS[etablissement.statut] && "opacity-0"
                        )}>
                          {etablissement.statut}
                        </span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(etablissement.progression || 0)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {ganttData.length === 0 && (
                <div className="h-14 flex items-center justify-center text-muted-foreground text-sm">
                  Aucune donnée
                </div>
              )}
            </div>
          }
          scrollableContent={
            <div style={{ width: `${ganttWidth}px`, minWidth: '100%' }}>
              {/* Timeline header */}
              <div className="h-12 border-b border-border bg-muted/50 relative flex">
                {zoomLevel === 'week' ? (
                  // Show weeks
                  weeks.map((week, i) => {
                    const left = differenceInDays(week, timeline.start) * timeline.pixelsPerDay
                    const width = 7 * timeline.pixelsPerDay
                    return (
                      <div
                        key={`gantt-week-${week.toISOString()}`}
                        className="absolute flex items-center justify-center h-12 text-xs font-medium border-r border-border/50"
                        style={{ left: `${left}px`, width: `${width}px` }}
                      >
                        <span className="truncate px-1">
                          {format(week, "'S'w - d MMM", { locale: fr })}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  // Show months
                  months.map((month, i) => {
                    const left = differenceInDays(month, timeline.start) * timeline.pixelsPerDay
                    const monthEnd = i < months.length - 1 ? months[i + 1] : timeline.end
                    const width = differenceInDays(monthEnd, month) * timeline.pixelsPerDay
                    return (
                      <div
                        key={`gantt-month-${month.toISOString()}`}
                        className="absolute flex items-center justify-center h-12 text-xs font-medium border-r border-border/50"
                        style={{ left: `${left}px`, width: `${width}px` }}
                      >
                        <span className="truncate px-1 capitalize">
                          {format(month, 'MMMM yyyy', { locale: fr })}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Rows */}
              <div className="relative">
                {ganttData.map(({ etablissement, startDate, totalDuration, progression }) => {
                  const barStyle = getBarStyle(startDate, totalDuration)
                  const phaseColor = PHASE_COLORS[etablissement.statut] || 'bg-gray-500'
                  
                  return (
                    <div 
                      key={etablissement.id} 
                      className="relative h-14 border-b border-border hover:bg-muted/20"
                    >
                      {/* Progress bar */}
                      <div
                        className="absolute top-3 h-8 rounded cursor-pointer group transition-shadow hover:shadow-md"
                        style={{ 
                          left: `${barStyle.left}px`, 
                          width: `${barStyle.width}px` 
                        }}
                        onClick={() => navigate(`/etablissements/${etablissement.id}`)}
                      >
                        {/* Background (total duration) */}
                        <div className={cn("h-full rounded opacity-30", phaseColor)} />
                        
                        {/* Progress fill */}
                        <div
                          className={cn("absolute top-0 left-0 h-full rounded", phaseColor)}
                          style={{ width: `${progression}%` }}
                        />
                        
                        {/* Progress text */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-semibold text-white mix-blend-difference">
                            {Math.round(progression)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Today marker */}
                {todayPosition >= 0 && (
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10 pointer-events-none"
                    style={{ left: `${todayPosition}px` }}
                  >
                    <div className="absolute -top-3 -left-[22px] bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                      Aujourd'hui
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
        />
      </Card>

      {/* Legend mobile */}
      <div className="lg:hidden">
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(PHASE_COLORS).slice(1, 6).map(([phase, color]) => (
                <div key={phase} className="flex items-center gap-1.5">
                  <div className={cn("w-3 h-3 rounded", color)} />
                  <span className="text-muted-foreground">{phase}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
