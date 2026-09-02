import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ForecastPhaseDonut } from './ForecastPhaseDonut';
import type { ForecastPhaseRow, ForecastPhaseGroup } from '@/hooks/crm/useSalesForecast';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

interface Props {
  data: ForecastPhaseRow[];
  groups?: ForecastPhaseGroup[];
}

export function ForecastByPhase({ data, groups }: Props) {
  const maxRaw = Math.max(1, ...data.map((d) => d.raw));

  return (
    <div className="space-y-4">
      {groups && groups.length > 0 && <ForecastPhaseDonut data={groups} />}
      <Card>
        <CardHeader>
          <CardTitle>Funnel par phase pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnée.</p>
          ) : (
            data.map((row) => (
              <div key={row.statut} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium capitalize truncate">{row.label || row.statut.replace(/_/g, ' ')}</span>
                    <Badge variant="outline">{row.probability}%</Badge>
                    <span className="text-muted-foreground text-xs">· {row.count}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs hidden sm:inline">brut {fmt(row.raw)}</span>
                    <span className="font-semibold tabular-nums">{fmt(row.weighted)}</span>
                  </div>
                </div>
                <Progress value={(row.raw / maxRaw) * 100} className="h-2" />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
