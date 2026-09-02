/**
 * Live Previews pour le module R&D (Agile)
 */
import { memo, useEffect, useState } from 'react'
import { TutorielPreviewWrapper } from '../TutorielMockProviders'
import { TutorielCountUpAnimation, TutorielProgressBar, TutorielChartBar } from '../TutorielCountUpAnimation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Rocket,
  Target,
  TrendingUp,
  Clock,
  Sparkles,
  GripVertical,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock data
export const mockRDKPIs = {
  storiesTerminees: 12,
  storiesEnCours: 8,
  storiesTodo: 15,
  velociteMoyenne: 24,
  sprintProgress: 65
}

export const mockUserStories = [
  { id: '1', title: 'Intégration API Qonto', points: 5, epic: 'Trésorerie', status: 'done', assignee: 'MD' },
  { id: '2', title: 'Dashboard analytics avancé', points: 8, epic: 'Analytics', status: 'in_progress', assignee: 'TM' },
  { id: '3', title: 'Export PDF rapports', points: 3, epic: 'Rapports', status: 'in_progress', assignee: 'JP' },
  { id: '4', title: 'Notifications push iOS', points: 5, epic: 'Mobile', status: 'review', assignee: 'SB' },
  { id: '5', title: 'Cache Redis optimisé', points: 8, epic: 'Performance', status: 'todo', assignee: 'MD' },
]

export const mockSprintData = {
  name: 'Sprint 14',
  startDate: '2024-01-08',
  endDate: '2024-01-22',
  totalPoints: 35,
  completedPoints: 18,
  days: [
    { day: 1, ideal: 35, actual: 35 },
    { day: 2, ideal: 32.5, actual: 32 },
    { day: 3, ideal: 30, actual: 28 },
    { day: 4, ideal: 27.5, actual: 25 },
    { day: 5, ideal: 25, actual: 23 },
    { day: 6, ideal: 22.5, actual: 18 },
  ]
}

export const mockVelocity = [
  { sprint: 'S11', points: 21 },
  { sprint: 'S12', points: 26 },
  { sprint: 'S13', points: 24 },
  { sprint: 'S14', points: 18 },
]

const kanbanColumns = ['Backlog', 'To Do', 'En cours', 'Review', 'Done']

/**
 * Dashboard R&D avec KPIs
 */
export const RDDashboardPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <TutorielPreviewWrapper>
      <div className="space-y-4">
        {/* Sprint progress */}
        <Card className={cn(
          "transition-all duration-500",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{mockSprintData.name}</span>
              <Badge variant="outline" className="text-xs">
                {mockSprintData.completedPoints}/{mockSprintData.totalPoints} pts
              </Badge>
            </div>
            <TutorielProgressBar 
              value={mockSprintData.completedPoints} 
              maxValue={mockSprintData.totalPoints}
              delay={300}
              color="primary"
            />
            <p className="text-xs text-muted-foreground mt-2">
              <TutorielCountUpAnimation value={mockRDKPIs.sprintProgress} suffix="%" delay={500} /> du sprint complété
            </p>
          </CardContent>
        </Card>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Terminées', value: mockRDKPIs.storiesTerminees, color: 'text-success', icon: CheckCircle2 },
            { label: 'En cours', value: mockRDKPIs.storiesEnCours, color: 'text-primary', icon: Clock },
            { label: 'Vélocité', value: mockRDKPIs.velociteMoyenne, color: 'text-warning', icon: TrendingUp, suffix: ' pts' },
          ].map((kpi, index) => (
            <Card 
              key={kpi.label}
              className={cn(
                "transition-all duration-500",
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-90"
              )}
              style={{ transitionDelay: `${(index + 1) * 100}ms` }}
            >
              <CardContent className="p-3 text-center">
                <kpi.icon className={cn("h-5 w-5 mx-auto mb-1", kpi.color)} />
                <p className={cn("text-xl font-bold", kpi.color)}>
                  <TutorielCountUpAnimation value={kpi.value} suffix={kpi.suffix || ''} delay={index * 150 + 300} />
                </p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </TutorielPreviewWrapper>
  )
})
RDDashboardPreview.displayName = 'RDDashboardPreview'

/**
 * Sprint Board Kanban
 */
export const RDSprintBoardPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  const [draggedStory, setDraggedStory] = useState<string | null>(null)
  
  useEffect(() => {
    setIsVisible(true)
    
    // Simulate drag animation
    const interval = setInterval(() => {
      setDraggedStory(prev => {
        if (!prev) return 'story-2'
        return null
      })
    }, 3000)
    
    return () => clearInterval(interval)
  }, [])

  const getStoriesByStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'Backlog': 'backlog',
      'To Do': 'todo',
      'En cours': 'in_progress',
      'Review': 'review',
      'Done': 'done'
    }
    return mockUserStories.filter(s => s.status === statusMap[status])
  }

  const getEpicColor = (epic: string) => {
    const colors: Record<string, string> = {
      'Trésorerie': 'bg-emerald-100 text-emerald-700',
      'Analytics': 'bg-blue-100 text-blue-700',
      'Rapports': 'bg-purple-100 text-purple-700',
      'Mobile': 'bg-amber-100 text-amber-700',
      'Performance': 'bg-red-100 text-red-700',
    }
    return colors[epic] || 'bg-gray-100 text-gray-700'
  }

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Sprint Board
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {kanbanColumns.map((column, colIndex) => {
              const stories = getStoriesByStatus(column)
              return (
                <div 
                  key={column}
                  className={cn(
                    "min-w-[140px] flex-1 bg-muted/50 rounded-lg p-2 transition-all duration-500",
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  )}
                  style={{ transitionDelay: `${colIndex * 80}ms` }}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">{column}</span>
                    <Badge variant="secondary" className="text-xs h-5 w-5 p-0 flex items-center justify-center">
                      {stories.length}
                    </Badge>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2">
                    {stories.map((story, storyIndex) => (
                      <div
                        key={story.id}
                        className={cn(
                          "bg-background rounded-md p-2 shadow-sm border transition-all duration-300",
                          draggedStory === `story-${story.id}` && "ring-2 ring-primary scale-105 rotate-2"
                        )}
                        style={{ transitionDelay: `${(colIndex * 80) + (storyIndex * 50)}ms` }}
                      >
                        <div className="flex items-start gap-1.5 mb-1.5">
                          <GripVertical className="h-3 w-3 text-muted-foreground/50 mt-0.5" />
                          <p className="text-xs font-medium flex-1 line-clamp-2">{story.title}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge className={cn("text-xs", getEpicColor(story.epic))}>
                            {story.epic}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {story.assignee}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">{story.points}pts</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
RDSprintBoardPreview.displayName = 'RDSprintBoardPreview'

/**
 * Burndown Chart animé
 */
export const RDBurndownPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  const maxPoints = 35
  const chartHeight = 120

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Burndown Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative" style={{ height: chartHeight }}>
            {/* Y axis labels */}
            <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-muted-foreground">
              <span>35</span>
              <span>17</span>
              <span>0</span>
            </div>

            {/* Chart area */}
            <div className="ml-10 h-full relative">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[0, 1, 2].map(i => (
                  <div key={`burndown-grid-${i}`} className="border-b border-border/50" />
                ))}
              </div>

              {/* Ideal line (straight diagonal) */}
              <svg className="absolute inset-0 w-full h-full overflow-visible">
                <line
                  x1="0"
                  y1="0"
                  x2="100%"
                  y2="100%"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.5"
                />
              </svg>

              {/* Actual line (animated) */}
              <svg className="absolute inset-0 w-full h-full overflow-visible">
                <polyline
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={mockSprintData.days.map((d, i) => {
                    const x = (i / (mockSprintData.days.length - 1)) * 100
                    const y = ((maxPoints - d.actual) / maxPoints) * 100
                    return `${x}%,${y}%`
                  }).join(' ')}
                  className={cn(
                    "transition-all duration-1500",
                    isVisible ? "opacity-100" : "opacity-0"
                  )}
                  style={{
                    strokeDasharray: 1000,
                    strokeDashoffset: isVisible ? 0 : 1000,
                    transition: 'stroke-dashoffset 1.5s ease-out'
                  }}
                />
                
                {/* Data points */}
                {mockSprintData.days.map((d, i) => {
                  const x = (i / (mockSprintData.days.length - 1)) * 100
                  const y = ((maxPoints - d.actual) / maxPoints) * 100
                  return (
                    <circle
                      key={`burndown-day-${d.day}`}
                      cx={`${x}%`}
                      cy={`${y}%`}
                      r="4"
                      fill="hsl(var(--primary))"
                      className={cn(
                        "transition-all duration-500",
                        isVisible ? "opacity-100 scale-100" : "opacity-0 scale-0"
                      )}
                      style={{ transitionDelay: `${i * 200}ms` }}
                    />
                  )
                })}
              </svg>
            </div>
          </div>

          {/* X axis labels */}
          <div className="ml-10 flex justify-between mt-2 text-xs text-muted-foreground">
            {mockSprintData.days.map((d) => (
              <span key={`burndown-axis-${d.day}`}>J{d.day}</span>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-muted-foreground" style={{ borderTop: '2px dashed' }} />
              <span className="text-muted-foreground">Idéal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-primary" />
              <span className="text-muted-foreground">Réel</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
RDBurndownPreview.displayName = 'RDBurndownPreview'

/**
 * Velocité Chart animé
 */
export const RDVelocityPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  const maxPoints = Math.max(...mockVelocity.map(v => v.points))

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Vélocité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-center gap-4 h-32">
            {mockVelocity.map((sprint, index) => (
              <TutorielChartBar
                key={sprint.sprint}
                value={sprint.points}
                maxValue={maxPoints}
                label={sprint.sprint}
                delay={index * 150}
                className={cn(
                  "transition-opacity duration-500",
                  isVisible ? "opacity-100" : "opacity-0"
                )}
              />
            ))}
          </div>
          <div className="text-center mt-3">
            <p className="text-xs text-muted-foreground">
              Moyenne: <span className="font-semibold text-foreground">
                <TutorielCountUpAnimation value={mockRDKPIs.velociteMoyenne} delay={600} /> pts/sprint
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
RDVelocityPreview.displayName = 'RDVelocityPreview'

/**
 * AI Assist button animation
 */
export const RDAIAssistPreview = memo(() => {
  const [isTyping, setIsTyping] = useState(false)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTyping(prev => !prev)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Assistant IA R&D
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm">
              {isTyping ? (
                <span className="inline-flex items-center gap-1">
                  <span className="animate-pulse">Rédaction de la user story en cours</span>
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </span>
              ) : (
                "En tant qu'utilisateur, je veux pouvoir exporter mes données au format PDF afin de les partager facilement avec mes collègues."
              )}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                "cursor-pointer transition-all",
                !isTyping && "bg-primary/10 border-primary"
              )}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Reformuler
            </Badge>
            <Badge variant="outline" className="cursor-pointer">
              Ajouter critères
            </Badge>
            <Badge variant="outline" className="cursor-pointer">
              Générer tâches
            </Badge>
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
RDAIAssistPreview.displayName = 'RDAIAssistPreview'
