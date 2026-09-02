import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';

interface Props {
  data?: Array<{ statut: string; count: number }>;
  loading?: boolean;
}

const COLORS = [
  'hsl(217 91% 60%)', 'hsl(142 76% 36%)', 'hsl(38 92% 50%)', 'hsl(25 95% 53%)',
  'hsl(280 65% 60%)', 'hsl(199 89% 48%)', 'hsl(340 82% 52%)', 'hsl(160 60% 45%)',
  'hsl(0 84% 60%)', 'hsl(45 93% 47%)',
];

export function ScoringPhaseDistribution({ data, loading }: Props) {
  const chartData = (data ?? []).filter(d => d.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PieIcon className="h-4 w-4 text-primary" />
          Répartition par statut
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">Aucun prospect.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="statut"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
              >
                {chartData.map((d, i) => <Cell key={`scoring-phase-cell-${d.statut ?? i}`} fill={COLORS[i % COLORS.length]} />)}
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
