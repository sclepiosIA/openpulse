import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';
import type { ChurnTrendPoint } from '@/hooks/csm/useChurnPredictions';

interface Props { data?: ChurnTrendPoint[]; loading?: boolean }

export function ChurnTrendChart({ data, loading }: Props) {
  const chart = (data ?? []).map(d => ({ ...d, label: format(parseISO(d.day), 'dd MMM', { locale: fr }) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" /> Évolution 90 jours
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-[260px] w-full" /> : chart.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            Pas encore d'historique. Lancez « Recalculer » pour générer le premier snapshot.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chart} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="critical" name="Critique" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="high" name="Élevé" stroke="hsl(25 95% 53%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="medium" name="Modéré" stroke="hsl(45 93% 47%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="low" name="Faible" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
