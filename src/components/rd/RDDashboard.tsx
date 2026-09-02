import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Target, TrendingUp, Clock, Zap, Calendar } from 'lucide-react'
import {
  useProjetStats,
  useActiveSprint,
  useSprintStats,
  useRDEpics,
  useRDUserStories,
} from '@/hooks/rd/useRD'
import { useSprintBurndown } from '@/hooks/rd/useSprintHistory'
import { differenceInDays } from 'date-fns'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { PRIORITE_CONFIG } from '@/types/rd'

interface RDDashboardProps {
  projetId: string
}

export function RDDashboard({ projetId }: RDDashboardProps) {
  const { data: stats, isLoading: statsLoading } = useProjetStats(projetId)
  const { data: activeSprint } = useActiveSprint(projetId)
  const { data: sprintStats } = useSprintStats(activeSprint?.id)
  const { data: epics } = useRDEpics(projetId)
  const { data: stories } = useRDUserStories(projetId)

  // Use real burndown data from hook
  const { data: burndownData } = useSprintBurndown(activeSprint, stories)

  // Calculate sprint days remaining
  const sprintDaysRemaining = activeSprint
    ? Math.max(0, differenceInDays(new Date(activeSprint.date_fin), new Date()))
    : 0

  // Story points by priority
  const pointsByPriority =
    stories?.reduce(
      (acc, story) => {
        if (story.points) {
          acc[story.priorite] = (acc[story.priorite] || 0) + story.points
        }
        return acc
      },
      {} as Record<string, number>
    ) || {}

  const priorityChartData = Object.entries(pointsByPriority).map(([priority, points]) => ({
    name: PRIORITE_CONFIG[priority as keyof typeof PRIORITE_CONFIG]?.label || priority,
    points,
    color: PRIORITE_CONFIG[priority as keyof typeof PRIORITE_CONFIG]?.color || 'hsl(var(--muted))',
  }))

  // Burndown data is now from the useSprintBurndown hook (real data)

  if (statsLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={`rd-dashboard-skeleton-${i}`} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards - Premium Glassmorphism Style */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 border-t-primary border-primary/10 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">User Stories</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {stats?.totalStories || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.doneStories || 0} terminées
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg opacity-50" />
                <div className="relative p-3 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-2 ring-primary/20">
                  <Target className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 border-t-success border-success/10 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Story Points</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-success to-success/70 bg-clip-text text-transparent">
                  {stats?.totalPoints || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vélocité moy: {stats?.avgVelocity || 0}
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-success/20 rounded-full blur-lg opacity-50" />
                <div className="relative p-3 rounded-full bg-gradient-to-br from-success/20 to-success/5 ring-2 ring-success/20">
                  <Zap className="h-6 w-6 text-success" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 border-t-warning border-warning/10 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Epics</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-warning to-warning/70 bg-clip-text text-transparent">
                  {stats?.totalEpics || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.doneEpics || 0} terminés
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-warning/20 rounded-full blur-lg opacity-50" />
                <div className="relative p-3 rounded-full bg-gradient-to-br from-warning/20 to-warning/5 ring-2 ring-warning/20">
                  <TrendingUp className="h-6 w-6 text-warning" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 border-t-secondary border-secondary/10 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sprints</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-secondary-foreground to-secondary-foreground/70 bg-clip-text text-transparent">
                  {stats?.totalSprints || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.activeSprints || 0} actif
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-secondary/30 rounded-full blur-lg opacity-50" />
                <div className="relative p-3 rounded-full bg-gradient-to-br from-secondary/30 to-secondary/10 ring-2 ring-secondary/30">
                  <Calendar className="h-6 w-6 text-secondary-foreground" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Sprint Card - Premium Style */}
      {activeSprint && (
        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-l-4 border-l-primary border-primary/10 shadow-lg">
          {/* Gradient decorative background */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/5 to-transparent pointer-events-none" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <span>Sprint Actif: {activeSprint.nom}</span>
              </CardTitle>
              <Badge className="bg-gradient-to-r from-primary to-primary/80 text-white border-0 shadow-md">
                {sprintDaysRemaining} jours restants
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeSprint.objectif && (
                <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                  <strong className="text-foreground">Objectif:</strong> {activeSprint.objectif}
                </p>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Progression</span>
                <span className="font-bold text-primary">
                  {sprintStats?.donePoints || 0} / {sprintStats?.totalPoints || 0} points
                </span>
              </div>
              <Progress value={sprintStats?.progress || 0} className="h-3 bg-muted/50" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-center">
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-colors">
                  <p className="text-2xl font-bold text-primary">
                    {sprintStats?.totalStories || 0}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">Stories</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-success/5 to-transparent border border-success/10 hover:border-success/20 transition-colors">
                  <p className="text-2xl font-bold text-success">{sprintStats?.doneStories || 0}</p>
                  <p className="text-xs text-muted-foreground font-medium">Terminées</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-warning/5 to-transparent border border-warning/10 hover:border-warning/20 transition-colors">
                  <p className="text-2xl font-bold text-warning">{sprintStats?.totalPoints || 0}</p>
                  <p className="text-xs text-muted-foreground font-medium">Points total</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/10 to-transparent border border-secondary/20 hover:border-secondary/30 transition-colors">
                  <p className="text-2xl font-bold">{sprintStats?.progress || 0}%</p>
                  <p className="text-xs text-muted-foreground font-medium">Complétion</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Burndown Chart */}
        {activeSprint && burndownData && burndownData.length > 0 && (
          <Card className="bg-card/80 backdrop-blur-sm border-primary/10 shadow-lg">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary to-primary/50" />
                Burndown Chart
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={burndownData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        borderRadius: '12px',
                        border: '1px solid hsl(var(--border))',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ideal"
                      stroke="hsl(var(--muted-foreground))"
                      fill="hsl(var(--muted))"
                      strokeDasharray="5 5"
                      name="Idéal"
                    />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary)/0.2)"
                      name="Réel"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Points by Priority */}
        <Card className="bg-card/80 backdrop-blur-sm border-primary/10 shadow-lg">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-warning to-warning/50" />
              Points par Priorité
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      borderRadius: '12px',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar dataKey="points" radius={[0, 6, 6, 0]}>
                    {priorityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Epics Progress */}
      {epics && epics.length > 0 && (
        <Card className="bg-card/80 backdrop-blur-sm border-primary/10 shadow-lg">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-success to-success/50" />
              Progression des Epics
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-5">
              {epics.map((epic) => {
                const epicStories = stories?.filter((s) => s.epic_id === epic.id) || []
                const doneStories = epicStories.filter((s) => s.statut === 'done').length
                const progress =
                  epicStories.length > 0 ? Math.round((doneStories / epicStories.length) * 100) : 0

                return (
                  <div
                    key={epic.id}
                    className="p-4 rounded-xl bg-gradient-to-r from-muted/30 to-transparent border border-border/50 hover:border-primary/20 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full ring-2 ring-offset-2 ring-offset-background shadow-sm"
                          style={{
                            backgroundColor: epic.couleur,
                            boxShadow: `0 0 8px ${epic.couleur}40`,
                          }}
                        />
                        <span className="font-semibold">{epic.titre}</span>
                        <Badge variant="outline" className="text-xs bg-card/50">
                          {doneStories}/{epicStories.length} stories
                        </Badge>
                      </div>
                      <span className="text-sm font-bold" style={{ color: epic.couleur }}>
                        {progress}%
                      </span>
                    </div>
                    <Progress value={progress} className="h-2.5 bg-muted/50" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
