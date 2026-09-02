import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TrendingUp, CalendarDays, CalendarRange, Sparkles } from 'lucide-react';
import type { ActivityFeedStats } from '@/types/activity';
import { cn } from '@/lib/utils';

interface Props {
  stats?: ActivityFeedStats;
  isLoading?: boolean;
}

export function ActivityStatsHeader({ stats, isLoading }: Props) {
  const kpis = [
    { icon: Sparkles, label: "Aujourd'hui", value: stats?.today ?? 0, color: 'text-amber-500' },
    { icon: CalendarDays, label: 'Cette semaine', value: stats?.week ?? 0, color: 'text-blue-500' },
    { icon: CalendarRange, label: 'Ce mois', value: stats?.month ?? 0, color: 'text-purple-500' },
    { icon: TrendingUp, label: 'Top 5 contributeurs', value: stats?.by_user.length ?? 0, color: 'text-green-500' },
  ];

  const maxContrib = stats?.by_user[0]?.count || 1;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {kpis.slice(0, 3).map((k) => (
        <Card key={k.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn('h-10 w-10 rounded-lg bg-muted flex items-center justify-center', k.color)}>
              <k.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              {isLoading ? (
                <Skeleton className="h-7 w-12 mt-1" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">{k.value}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Top contributeurs (semaine)
          </p>
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : stats?.by_user.length ? (
            <div className="space-y-1.5">
              {stats.by_user.slice(0, 3).map((u) => {
                const initials = (u.name || '?').split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                const pct = Math.round((u.count / maxContrib) * 100);
                return (
                  <div key={u.user_id} className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="truncate">{u.name}</span>
                        <span className="font-semibold tabular-nums">{u.count}</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Aucune activité cette semaine</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
