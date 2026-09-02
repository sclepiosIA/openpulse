import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, AlertTriangle, TrendingDown, Activity, Wallet, TrendingUp, Minus } from 'lucide-react';
import type { ChurnOverviewKpis } from '@/hooks/csm/useChurnPredictions';

interface Props {
  kpis?: ChurnOverviewKpis;
  prev?: Partial<ChurnOverviewKpis>;
  mrrAtRisk?: number;
  loading?: boolean;
}

function delta(curr: number, prev?: number) {
  if (prev === undefined || prev === null) return null;
  return curr - prev;
}

function DeltaBadge({ d, invert }: { d: number | null; invert?: boolean }) {
  if (d === null || d === 0) return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />0</span>;
  const isGood = invert ? d < 0 : d > 0;
  const Icon = d > 0 ? TrendingUp : TrendingDown;
  const color = isGood ? 'text-emerald-600' : 'text-red-500';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${color}`}>
      <Icon className="h-3 w-3" />{d > 0 ? '+' : ''}{d}
    </span>
  );
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
const fmtEur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export function ChurnKpiBar({ kpis, prev, mrrAtRisk = 0, loading }: Props) {
  const cards = [
    { icon: Activity, label: 'Total analysé', value: kpis?.total ?? 0, prev: prev?.total, color: 'text-primary', fmt, invert: false },
    { icon: ShieldAlert, label: '🔴 Critique (75+)', value: kpis?.critical ?? 0, prev: prev?.critical, color: 'text-destructive', fmt, invert: true },
    { icon: AlertTriangle, label: '🟠 Élevé (50-74)', value: kpis?.high ?? 0, prev: prev?.high, color: 'text-amber-600', fmt, invert: true },
    { icon: TrendingDown, label: '🟡 Modéré (25-49)', value: kpis?.medium ?? 0, prev: prev?.medium, color: 'text-yellow-600', fmt, invert: true },
    { icon: Wallet, label: '💰 MRR à risque', value: mrrAtRisk, prev: undefined, color: 'text-violet-600', fmt: fmtEur, invert: false },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c, i) => {
        const d = delta(c.value, c.prev);
        const Icon = c.icon;
        return (
          <Card key={`churn-kpi-${c.label}`} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground truncate">{c.label}</p>
                  {loading ? <Skeleton className="h-7 w-16 mt-1" /> : (
                    <p className="text-2xl font-bold tabular-nums mt-1 leading-none">{c.fmt(c.value)}</p>
                  )}
                  {!loading && c.prev !== undefined && <div className="mt-1"><DeltaBadge d={d} invert={c.invert} /></div>}
                </div>
                <Icon className={`h-5 w-5 shrink-0 ${c.color}`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
