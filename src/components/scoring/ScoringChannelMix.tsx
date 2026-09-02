import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { GitBranch } from 'lucide-react';
import { ATTRIBUTION_CHANNEL_LABELS, type AttributionChannel } from '@/types/scoring';

interface Props {
  data?: Array<{ channel: string; touchpoints: number; total_weight: number }>;
  loading?: boolean;
}

export function ScoringChannelMix({ data, loading }: Props) {
  const chartData = (data ?? []).map(d => ({
    label: ATTRIBUTION_CHANNEL_LABELS[d.channel as AttributionChannel] ?? d.channel,
    weight: Number(d.total_weight) || 0,
    touchpoints: d.touchpoints,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4 text-primary" />
          Mix d'attribution (90j)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
            Aucun touchpoint enregistré.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={90} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="weight" name="Poids" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
