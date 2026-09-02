import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Target, CalendarRange, Trophy, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ForecastKpis, ForecastPreviousPeriod } from '@/hooks/crm/useSalesForecast';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

interface Props {
  kpis: ForecastKpis;
  previous?: ForecastPreviousPeriod;
}

function Delta({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined || previous === null) return null;
  if (previous === 0 && current === 0) return null;
  if (previous === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <TrendingUp className="h-3 w-3" /> Nouveau
      </span>
    );
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(pct);
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> stable
      </span>
    );
  }
  const positive = rounded > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', positive ? 'text-success' : 'text-destructive')}>
      <Icon className="h-3 w-3" />
      {positive ? '+' : ''}{rounded}%
    </span>
  );
}

export function ForecastKPIs({ kpis, previous }: Props) {
  const quarterAttainment = kpis.current_quarter_target > 0
    ? Math.min(100, (kpis.current_quarter / kpis.current_quarter_target) * 100)
    : null;

  const cards = [
    {
      label: 'Pipeline brut',
      value: kpis.pipeline_raw,
      icon: TrendingUp,
      hint: 'Somme des opportunités non gagnées',
      delta: <Delta current={kpis.pipeline_raw} previous={previous?.pipeline_raw} />,
    },
    {
      label: 'Pipeline pondéré',
      value: kpis.pipeline_weighted,
      icon: Target,
      hint: 'Valeur × probabilité de closing',
      delta: <Delta current={kpis.pipeline_weighted} previous={previous?.pipeline_weighted} />,
    },
    {
      label: 'Forecast trimestre courant',
      value: kpis.current_quarter,
      icon: CalendarRange,
      hint: kpis.current_quarter_target > 0
        ? `Objectif ${fmt(kpis.current_quarter_target)}`
        : 'Pondéré, closing prévu Q en cours',
      progress: quarterAttainment,
    },
    {
      label: 'Gagné (cumulé)',
      value: kpis.won_total,
      icon: Trophy,
      hint: 'Deals 100% (production / vendu)',
      delta: <Delta current={kpis.won_total} previous={previous?.won_total} />,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, hint, progress, delta }) => (
        <Card key={label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-2xl font-bold tabular-nums">{fmt(value)}</div>
              {delta}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{hint}</p>
            {typeof progress === 'number' && (
              <Progress value={progress} className="h-1.5 mt-2" />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
