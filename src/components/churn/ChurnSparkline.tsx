import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { useChurnHistory } from '@/hooks/csm/useChurnPredictions';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props { etablissementId: string; days?: number; height?: number }

export function ChurnSparkline({ etablissementId, days = 90, height = 80 }: Props) {
  const { data, isLoading } = useChurnHistory(etablissementId, days);

  if (isLoading) return <Skeleton style={{ height }} className="w-full" />;
  if (!data || data.length === 0) {
    return <div style={{ height }} className="w-full flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded">Pas d'historique</div>;
  }

  const chart = data.map(d => ({
    label: format(parseISO(d.day), 'dd MMM', { locale: fr }),
    score: Number(d.score),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chart} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="churn-spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(0 84% 60%)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(0 84% 60%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11, padding: '4px 8px' }}
          formatter={(v: any) => [`${v}/100`, 'Score']}
        />
        <Area type="monotone" dataKey="score" stroke="hsl(0 84% 60%)" strokeWidth={2} fill="url(#churn-spark)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
