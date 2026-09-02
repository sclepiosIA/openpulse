import { Card, CardContent } from '@/components/ui/card'
import { useSupportStats } from '@/hooks/support/useSupportTickets'
import { Ticket, Clock, AlertTriangle, CheckCircle, Timer, AlertOctagon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export function SupportKPIs() {
  const { data: stats, isLoading } = useSupportStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={`support-kpi-skeleton-${i}`}>
            <CardContent className="p-4">
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const kpis = [
    {
      label: 'Total tickets',
      value: stats?.total || 0,
      icon: Ticket,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Nouveaux',
      value: stats?.nouveau || 0,
      icon: Clock,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'En cours',
      value: stats?.en_cours || 0,
      icon: Timer,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'En attente',
      value: stats?.en_attente || 0,
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      label: 'Critiques',
      value: stats?.critique || 0,
      icon: AlertTriangle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      label: 'Résolus',
      value: stats?.resolu || 0,
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className="border-t-4 border-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-card/80 backdrop-blur-sm"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${kpi.bgColor}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {stats?.sla_breached ? (
          <div className="flex items-center gap-2 text-red-500">
            <AlertOctagon className="h-4 w-4" />
            <span>{stats.sla_breached} SLA dépassé(s)</span>
          </div>
        ) : null}
        {stats?.avg_resolution_hours !== null && (
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4" />
            <span>Temps moyen de résolution : {stats?.avg_resolution_hours}h</span>
          </div>
        )}
      </div>
    </div>
  )
}
