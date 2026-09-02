import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { BarChart3 } from 'lucide-react';

interface Props {
  data?: { many_tickets: number; no_emails: number; many_unpaid: number; no_interaction: number };
  total?: number;
  loading?: boolean;
}

export function ChurnFactorsBreakdown({ data, total = 0, loading }: Props) {
  const items = [
    { label: '🎫 ≥5 tickets ouverts', value: data?.many_tickets ?? 0 },
    { label: '📧 0 email sur 30j', value: data?.no_emails ?? 0 },
    { label: '💸 ≥2 factures impayées', value: data?.many_unpaid ?? 0 },
    { label: '⏰ >60j sans interaction', value: data?.no_interaction ?? 0 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-primary" /> Facteurs déclencheurs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={`churn-factors-skeleton-${i}`} className="h-10 w-full" />)}</div>
        ) : (
          items.map((item, i) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div key={`churn-factor-${item.label ?? i}`}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="truncate">{item.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{item.value} ({pct}%)</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
