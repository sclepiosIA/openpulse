import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Calendar, Users, TrendingUp } from 'lucide-react'
interface KPIMiniCardsProps {
  tasksCompleted: number
  tasksTotal: number
  progression: number
  upcomingDeadlines: number
  teamMembers: number
  documentsCount: number
  onCardClick?: (section: string) => void
}

export function KPIMiniCards({
  tasksCompleted,
  tasksTotal,
  progression,
  upcomingDeadlines,
  teamMembers,
  documentsCount,
  onCardClick,
}: KPIMiniCardsProps) {
  const cards = [
    {
      icon: CheckCircle2,
      label: 'Tâches',
      value: `${tasksCompleted}/${tasksTotal}`,
      subtext: 'terminées',
      progress: tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 0,
      color: 'text-success',
      glowColor: 'bg-success/20',
      borderColor: 'border-t-success',
      section: 'taches',
    },
    {
      icon: TrendingUp,
      label: 'Progression',
      value: `${progression}%`,
      subtext: 'complété',
      progress: progression,
      color: 'text-primary',
      glowColor: 'bg-primary/20',
      borderColor: 'border-t-primary',
      section: 'infos',
    },
    {
      icon: Calendar,
      label: 'Échéances',
      value: upcomingDeadlines.toString(),
      subtext: 'cette semaine',
      color: upcomingDeadlines > 3 ? 'text-warning' : 'text-muted-foreground',
      glowColor: upcomingDeadlines > 3 ? 'bg-warning/20' : 'bg-muted/20',
      borderColor: upcomingDeadlines > 3 ? 'border-t-warning' : 'border-t-muted',
      section: 'agenda',
    },
    {
      icon: Users,
      label: 'Équipe',
      value: teamMembers.toString(),
      subtext: 'membres',
      color: 'text-accent',
      glowColor: 'bg-accent/20',
      borderColor: 'border-t-accent',
      section: 'equipe',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => (
        <Card
          key={`kpi-${card.section}`}
          className={`cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-card/80 backdrop-blur-sm border-primary/10 shadow-lg border-t-4 ${card.borderColor}`}
          onClick={() => onCardClick?.(card.section)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              {/* Icon avec glow */}
              <div className="relative">
                <div
                  className={`absolute inset-0 ${card.glowColor} rounded-xl blur-md opacity-60`}
                />
                <div
                  className={`relative p-2.5 rounded-xl bg-gradient-to-br from-white to-white/50 ring-2 ${card.color.replace('text-', 'ring-')}/20 shadow-sm`}
                >
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              {card.progress !== undefined && (
                <Badge variant="secondary" className="text-xs font-bold backdrop-blur-sm">
                  {Math.round(card.progress)}%
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                {card.value}
              </p>
              <p className="text-sm font-medium text-foreground/80">{card.label}</p>
              <p className="text-xs text-muted-foreground">{card.subtext}</p>
            </div>
            {card.progress !== undefined && (
              <div className="mt-3 bg-secondary/50 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${card.color.replace('text-', 'from-')} to-transparent transition-all duration-500`}
                  style={{ width: `${card.progress}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
