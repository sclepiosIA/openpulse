import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRDSprints, useRDUserStories, useProjetStats, useActiveSprint } from '@/hooks/rd/useRD';
import { useSprintBurndown, useCumulativeFlowData } from '@/hooks/rd/useSprintHistory';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { TrendingUp, Target, Clock, BarChart3, Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RDAnalyticsProps {
  projetId: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--secondary))'];

export function RDAnalytics({ projetId }: RDAnalyticsProps) {
  const { data: sprints } = useRDSprints(projetId);
  const { data: stories } = useRDUserStories(projetId);
  const { data: stats } = useProjetStats(projetId);
  const { data: activeSprint } = useActiveSprint(projetId);
  
  // Get stories for active sprint
  const activeSprintStories = useMemo(() => {
    if (!activeSprint || !stories) return [];
    return stories.filter(s => s.sprint_id === activeSprint.id);
  }, [activeSprint, stories]);

  // Real burndown data
  const { data: burndownData } = useSprintBurndown(activeSprint, activeSprintStories);
  
  // Real CFD data
  const { data: cfdData } = useCumulativeFlowData(projetId, stories);

  // Velocity chart data (real data from completed sprints)
  const velocityData = useMemo(() => {
    return sprints
      ?.filter(s => s.statut === 'termine')
      .sort((a, b) => a.numero - b.numero)
      .map(sprint => ({
        name: `Sprint ${sprint.numero}`,
        planifié: sprint.velocity_prevue || 0,
        réalisé: sprint.velocity_reelle || 0,
      })) || [];
  }, [sprints]);

  // Story status distribution (real data)
  const statusDistribution = useMemo(() => {
    const counts = {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };
    
    stories?.forEach(story => {
      counts[story.statut]++;
    });
    
    return [
      { name: 'Backlog', value: counts.backlog, color: 'hsl(var(--muted-foreground))' },
      { name: 'À faire', value: counts.todo, color: 'hsl(var(--primary))' },
      { name: 'En cours', value: counts.in_progress, color: 'hsl(var(--warning))' },
      { name: 'Review', value: counts.review, color: 'hsl(var(--secondary))' },
      { name: 'Terminé', value: counts.done, color: 'hsl(var(--success))' },
    ].filter(d => d.value > 0);
  }, [stories]);

  // Points by priority (real data)
  const pointsByPriority = useMemo(() => {
    const data = { low: 0, medium: 0, high: 0, critical: 0 };
    stories?.forEach(story => {
      if (story.points) {
        data[story.priorite] += story.points;
      }
    });
    return [
      { name: 'Basse', points: data.low, fill: 'hsl(var(--muted-foreground))' },
      { name: 'Moyenne', points: data.medium, fill: 'hsl(var(--primary))' },
      { name: 'Haute', points: data.high, fill: 'hsl(var(--warning))' },
      { name: 'Critique', points: data.critical, fill: 'hsl(var(--destructive))' },
    ];
  }, [stories]);

  // Calculate lead time (average days from creation to done)
  const leadTimeMetrics = useMemo(() => {
    const doneStories = stories?.filter(s => s.statut === 'done') || [];
    if (doneStories.length === 0) return { avgLeadTime: 0, count: 0 };

    const leadTimes = doneStories.map(s => {
      const created = new Date(s.created_at);
      const updated = new Date(s.updated_at);
      return Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    });

    return {
      avgLeadTime: Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length),
      count: doneStories.length,
    };
  }, [stories]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPI Summary */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vélocité Moyenne</p>
                <p className="text-2xl font-bold">{stats?.avgVelocity || 0}</p>
                <p className="text-xs text-muted-foreground">points/sprint</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-success/10">
                <Target className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taux Complétion</p>
                <p className="text-2xl font-bold">
                  {stats?.totalStories 
                    ? Math.round((stats.doneStories / stats.totalStories) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground">{stats?.doneStories || 0}/{stats?.totalStories || 0} stories</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En Cours</p>
                <p className="text-2xl font-bold">{stats?.inProgressStories || 0}</p>
                <p className="text-xs text-muted-foreground">stories actives</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-secondary/10">
                <BarChart3 className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Points</p>
                <p className="text-2xl font-bold">{stats?.totalPoints || 0}</p>
                <p className="text-xs text-muted-foreground">estimés</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-500/10">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lead Time Moyen</p>
                <p className="text-2xl font-bold">{leadTimeMetrics.avgLeadTime}</p>
                <p className="text-xs text-muted-foreground">jours</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Sprint Burndown */}
      {activeSprint && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Burndown - Sprint {activeSprint.numero}
            </CardTitle>
            <Badge variant="outline">
              {activeSprintStories.reduce((sum, s) => sum + (s.points || 0), 0)} points
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] sm:h-[300px] overflow-x-auto">
              <div className="min-w-[400px] h-full">
                {burndownData && burndownData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={burndownData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="ideal" 
                        stroke="hsl(var(--muted-foreground))" 
                        strokeDasharray="5 5"
                        name="Idéal"
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="actual" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        name="Réel"
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    Ajoutez des stories avec des points pour voir le burndown
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Grid */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Velocity Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vélocité par Sprint</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] sm:h-[300px] overflow-x-auto">
              <div className="min-w-[350px] h-full">
              {velocityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={velocityData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="planifié" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="réalisé" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Complétez des sprints pour voir la vélocité
                </div>
              )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribution des Stories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {statusDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Créez des stories pour voir la distribution
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cumulative Flow Diagram */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Flux Cumulatif (CFD) - 14 derniers jours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {cfdData && cfdData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cfdData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="done" stackId="1" stroke="hsl(var(--success))" fill="hsl(var(--success))" name="Terminé" />
                    <Area type="monotone" dataKey="review" stackId="1" stroke="hsl(var(--secondary))" fill="hsl(var(--secondary))" name="Review" />
                    <Area type="monotone" dataKey="in_progress" stackId="1" stroke="hsl(var(--warning))" fill="hsl(var(--warning))" name="En cours" />
                    <Area type="monotone" dataKey="todo" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" name="À faire" />
                    <Area type="monotone" dataKey="backlog" stackId="1" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" name="Backlog" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Créez des stories pour voir le flux cumulatif
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Points by Priority */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Points par Priorité</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pointsByPriority} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={80} />
                  <Tooltip />
                  <Bar dataKey="points" radius={[0, 4, 4, 0]}>
                    {pointsByPriority.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
