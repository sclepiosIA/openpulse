/**
 * Live Previews pour le module Gantt
 */
import { memo, useEffect, useState } from 'react'
import { TutorielPreviewWrapper } from '../TutorielMockProviders'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  BarChart3,
  Calendar,
  Filter,
  ZoomIn,
  ZoomOut,
  Download,
  ChevronRight,
  GripVertical,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock data
export const mockGanttTasks = [
  {
    id: '1',
    title: 'Configuration environnement',
    start: 0,
    duration: 3,
    progress: 100,
    assignee: 'TM',
    status: 'done',
    priority: 'haute',
  },
  {
    id: '2',
    title: 'Formation utilisateurs',
    start: 3,
    duration: 5,
    progress: 60,
    assignee: 'JP',
    status: 'in_progress',
    priority: 'haute',
  },
  {
    id: '3',
    title: 'Import données historiques',
    start: 5,
    duration: 4,
    progress: 30,
    assignee: 'SB',
    status: 'in_progress',
    priority: 'moyenne',
  },
  {
    id: '4',
    title: 'Tests et validation',
    start: 8,
    duration: 3,
    progress: 0,
    assignee: 'TM',
    status: 'todo',
    priority: 'haute',
  },
  {
    id: '5',
    title: 'Go-live',
    start: 11,
    duration: 1,
    progress: 0,
    assignee: 'Équipe',
    status: 'todo',
    priority: 'critique',
  },
]

const totalDays = 14
const dayLabels = Array.from({ length: totalDays }, (_, i) => `J${i + 1}`)

/**
 * Diagramme Gantt animé
 */
export const GanttChartPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  const [hoveredTask, setHoveredTask] = useState<string | null>(null)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-success'
      case 'in_progress':
        return 'bg-primary'
      case 'todo':
        return 'bg-muted-foreground/50'
      default:
        return 'bg-muted-foreground/30'
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critique':
        return (
          <Badge variant="destructive" className="text-xs">
            Critique
          </Badge>
        )
      case 'haute':
        return <Badge className="bg-warning/20 text-warning text-xs">Haute</Badge>
      default:
        return null
    }
  }

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Gantt - Déploiement Cabinet Les Tilleuls
            </CardTitle>
            <div className="flex items-center gap-2">
              <ZoomOut className="h-4 w-4 text-muted-foreground cursor-pointer" />
              <ZoomIn className="h-4 w-4 text-muted-foreground cursor-pointer" />
              <Filter className="h-4 w-4 text-muted-foreground cursor-pointer" />
              <Download className="h-4 w-4 text-muted-foreground cursor-pointer" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Timeline header */}
          <div className="flex mb-2">
            <div className="w-40 shrink-0" />
            <div className="flex-1 flex">
              {dayLabels.map((day, i) => (
                <div
                  key={`day-${day}-${i}`}
                  className="flex-1 text-center text-xs text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Tasks */}
          <div className="space-y-2">
            {mockGanttTasks.map((task, index) => (
              <div
                key={task.id}
                className={cn(
                  'flex items-center gap-2 h-10 transition-all duration-500',
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                )}
                style={{ transitionDelay: `${index * 100}ms` }}
                onMouseEnter={() => setHoveredTask(task.id)}
                onMouseLeave={() => setHoveredTask(null)}
              >
                {/* Task info */}
                <div className="w-40 shrink-0 flex items-center gap-2">
                  <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {task.assignee}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium truncate flex-1">{task.title}</span>
                </div>

                {/* Gantt bar */}
                <div className="flex-1 relative h-8">
                  <div
                    className={cn(
                      'absolute h-full rounded-md transition-all duration-700 flex items-center px-2',
                      getStatusColor(task.status),
                      hoveredTask === task.id && 'ring-2 ring-primary ring-offset-2'
                    )}
                    style={{
                      left: `${(task.start / totalDays) * 100}%`,
                      width: isVisible ? `${(task.duration / totalDays) * 100}%` : '0%',
                      transitionDelay: `${index * 100}ms`,
                    }}
                  >
                    {/* Progress overlay */}
                    {task.progress < 100 && task.progress > 0 && (
                      <div
                        className="absolute inset-y-0 left-0 bg-card/30 rounded-l-md"
                        style={{ width: `${task.progress}%` }}
                      />
                    )}

                    {/* Status icon */}
                    {task.status === 'done' && <CheckCircle2 className="h-3 w-3 text-white" />}

                    {/* Progress text */}
                    <span className="text-xs text-white font-medium ml-1">{task.progress}%</span>
                  </div>
                </div>

                {/* Priority badge */}
                <div className="w-16 shrink-0">{getPriorityBadge(task.priority)}</div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-success" />
              <span className="text-muted-foreground">Terminé</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-primary" />
              <span className="text-muted-foreground">En cours</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-muted-foreground/50" />
              <span className="text-muted-foreground">À faire</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
GanttChartPreview.displayName = 'GanttChartPreview'

/**
 * Barre de tâche Gantt individuelle (pour démonstration drag/resize)
 */
export const GanttTaskBarPreview = memo(() => {
  const [width, setWidth] = useState(30)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    if (!isResizing) return

    const interval = setInterval(() => {
      setWidth((prev) => {
        if (prev >= 60) {
          setIsResizing(false)
          return 30
        }
        return prev + 2
      })
    }, 100)

    return () => clearInterval(interval)
  }, [isResizing])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsResizing(true)
    }, 1000)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Redimensionnement de tâche</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-12 bg-muted rounded-lg relative overflow-hidden">
            <div
              className="absolute h-full bg-primary rounded-lg flex items-center justify-between px-3 transition-all duration-100"
              style={{ left: '10%', width: `${width}%` }}
            >
              <span className="text-xs text-white font-medium">Formation utilisateurs</span>
              <div
                className={cn(
                  'w-2 h-full bg-card/30 cursor-ew-resize',
                  isResizing && 'animate-pulse'
                )}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {isResizing
              ? 'Redimensionnement en cours...'
              : 'Glissez les bords pour ajuster la durée'}
          </p>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
GanttTaskBarPreview.displayName = 'GanttTaskBarPreview'

/**
 * Contrôles de filtrage Gantt
 */
export const GanttFiltersPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  const [activeFilters, setActiveFilters] = useState(['status', 'priority'])

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const filters = [
    { id: 'status', label: 'Par statut', icon: CheckCircle2 },
    { id: 'priority', label: 'Par priorité', icon: Filter },
    { id: 'assignee', label: 'Par responsable', icon: Avatar },
    { id: 'date', label: 'Par date', icon: Calendar },
  ]

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtres et groupement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter, index) => {
              const isActive = activeFilters.includes(filter.id)
              return (
                <Badge
                  key={filter.id}
                  variant={isActive ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-all duration-300',
                    isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                  )}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  {filter.label}
                  {isActive && <ChevronRight className="h-3 w-3 ml-1" />}
                </Badge>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
GanttFiltersPreview.displayName = 'GanttFiltersPreview'
