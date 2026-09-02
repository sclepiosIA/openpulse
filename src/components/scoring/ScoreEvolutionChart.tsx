import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useScoreHistory } from '@/hooks/crm/useBehavioralScore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  etablissementId: string;
  days?: number;
}

export function ScoreEvolutionChart({ etablissementId, days = 90 }: Props) {
  const { data: history, isLoading } = useScoreHistory(etablissementId, days);

  const chartData = (history ?? []).map(h => ({
    date: format(new Date(h.computed_at), 'dd/MM', { locale: fr }),
    Total: h.score,
    Statique: h.static_score,
    Comportemental: h.behavioral_score,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Évolution du score ({days}j)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            Pas d'historique disponible (snapshots quotidiens à partir de demain).
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Statique" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" dot={false} />
              <Line type="monotone" dataKey="Comportemental" stroke="hsl(142 76% 36%)" strokeWidth={1} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
