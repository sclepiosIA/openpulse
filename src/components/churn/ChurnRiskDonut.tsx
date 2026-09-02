import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import type { ChurnOverviewKpis } from '@/hooks/csm/useChurnPredictions';

interface Props { kpis?: ChurnOverviewKpis; loading?: boolean }

export function ChurnRiskDonut({ kpis, loading }: Props) {
  const data = kpis ? [
    { name: 'Critique', value: kpis.critical, color: 'hsl(0 84% 60%)' },
    { name: 'Élevé', value: kpis.high, color: 'hsl(25 95% 53%)' },
    { name: 'Modéré', value: kpis.medium, color: 'hsl(45 93% 47%)' },
    { name: 'Faible', value: kpis.low, color: 'hsl(142 76% 36%)' },
  ].filter(d => d.value > 0) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PieIcon className="h-4 w-4 text-primary" /> Répartition des risques
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : data.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Aucune donnée.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {data.map((d) => <Cell key={`churn-risk-cell-${d.name}`} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
