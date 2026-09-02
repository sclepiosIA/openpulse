import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCalendarStats } from '@/hooks/calendar/useCalendarStats';
import { AlertCircle, CheckCircle2, Clock, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Task } from '@/types/gantt';

interface CalendarStatsProps {
  tasks: Task[];
  startDate: Date;
  endDate: Date;
}

export function CalendarStats({ tasks, startDate, endDate }: CalendarStatsProps) {
  const stats = useCalendarStats(tasks, startDate, endDate);

  return (
    <div className="space-y-4">
      {/* Métriques principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des tâches</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.avgTasksPerDay.toFixed(1)} par jour en moyenne
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de complétion</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedTasks} / {stats.totalTasks} terminées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tâches en retard</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdueTasks}</div>
            <p className="text-xs text-muted-foreground">
              Nécessitent une attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">À venir (7j)</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingTasks.next7Days}</div>
            <p className="text-xs text-muted-foreground">
              {stats.upcomingTasks.next30Days} sur 30 jours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Répartition par catégorie */}
        {stats.tasksByCategory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Répartition par catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={stats.tasksByCategory}
                    dataKey="count"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.categoryName} (${entry.count})`}
                  >
                    {stats.tasksByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Charge par responsable */}
        {stats.tasksByAssignee.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Charge par responsable</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.tasksByAssignee}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="assigneeName"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    fontSize={12}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))">
                    {stats.tasksByAssignee.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.workload === 'high'
                            ? 'hsl(var(--destructive))'
                            : entry.workload === 'medium'
                            ? 'hsl(var(--warning))'
                            : 'hsl(var(--success))'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Distribution temporelle */}
      {stats.timeDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribution temporelle</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.timeDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Nombre de tâches" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}