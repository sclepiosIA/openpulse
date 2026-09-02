import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBehavioralScore } from '@/hooks/crm/useBehavioralScore';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { getScoreTier } from '@/types/scoring';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  etablissementId: string;
  staticScore?: number | null;
}

export function BehavioralScoreCard({ etablissementId, staticScore = 0 }: Props) {
  const { data, isLoading } = useBehavioralScore(etablissementId);

  const behavioral = data?.behavioral_score ?? 0;
  const stat = staticScore ?? 0;
  const total = Math.min(100, stat + behavioral);
  const velocity = data?.engagement_velocity ?? 0;
  const tier = getScoreTier(total);

  const pieData = [
    { name: 'Statique', value: stat, fill: 'hsl(var(--muted-foreground))' },
    { name: 'Comportemental', value: behavioral, fill: 'hsl(142 76% 36%)' },
    { name: 'Restant', value: Math.max(0, 100 - total), fill: 'hsl(var(--muted) / 0.3)' },
  ];

  const VelocityIcon = velocity > 0 ? TrendingUp : velocity < 0 ? TrendingDown : Minus;
  const velocityClass = velocity > 0 ? 'text-emerald-600' : velocity < 0 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          Score de conversion
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="relative h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {pieData.map((entry) => <Cell key={`behavioral-cell-${entry.name}`} fill={entry.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-3xl font-bold tabular-nums">{isLoading ? '…' : total}</div>
              <div className="text-xs text-muted-foreground">/ 100</div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Statut</div>
              <Badge variant="outline" className="font-medium">{tier.label}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Statique</div>
                <div className="font-mono font-semibold">{stat}/50</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Comportemental</div>
                <div className="font-mono font-semibold text-emerald-600">{behavioral}/50</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm pt-2 border-t">
              <VelocityIcon className={`h-4 w-4 ${velocityClass}`} />
              <span className={`font-mono ${velocityClass}`}>
                {velocity > 0 ? '+' : ''}{velocity} pts/sem
              </span>
            </div>

            {data?.last_event_at && (
              <div className="text-xs text-muted-foreground">
                Dernier signal : {formatDistanceToNow(new Date(data.last_event_at), { addSuffix: true, locale: fr })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
