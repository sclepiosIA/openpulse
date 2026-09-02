import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, ThermometerSun, Snowflake, Users, Wallet, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ScoringOverviewKpis } from '@/hooks/crm/useBehavioralScore';

interface Props {
  kpis?: ScoringOverviewKpis;
  prev?: Partial<ScoringOverviewKpis>;
  loading?: boolean;
}

function delta(curr: number, prev?: number) {
  if (prev === undefined || prev === null) return null;
  const d = curr - prev;
  return { d, pct: prev > 0 ? Math.round((d / prev) * 100) : null };
}

function DeltaBadge({ d }: { d: ReturnType<typeof delta> }) {
  if (!d || d.d === 0) return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />0</span>;
  const Icon = d.d > 0 ? TrendingUp : TrendingDown;
  const color = d.d > 0 ? 'text-emerald-600' : 'text-red-500';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${color}`}>
      <Icon className="h-3 w-3" />
      {d.d > 0 ? '+' : ''}{d.d}{d.pct !== null ? ` (${d.pct > 0 ? '+' : ''}${d.pct}%)` : ''}
    </span>
  );
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
const fmtEur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export function ScoringKpiBar({ kpis, prev, loading }: Props) {
  const cards = [
    { icon: Users, label: 'Total prospects', value: kpis?.total ?? 0, prev: prev?.total, color: 'text-primary', fmt },
    { icon: Flame, label: '🔥 Chauds (≥80)', value: kpis?.hot ?? 0, prev: prev?.hot, color: 'text-emerald-600', fmt },
    { icon: ThermometerSun, label: '🌡️ Tièdes (60-79)', value: kpis?.warm ?? 0, prev: prev?.warm, color: 'text-amber-600', fmt },
    { icon: Snowflake, label: '❄️ Froids (<40)', value: kpis?.cold ?? 0, prev: prev?.cold, color: 'text-red-500', fmt },
    { icon: Wallet, label: '💰 MRR pondéré', value: kpis?.weighted_mrr_potential ?? 0, prev: undefined, color: 'text-violet-600', fmt: fmtEur },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c, i) => {
        const d = delta(c.value, c.prev);
        const Icon = c.icon;
        return (
          <Card key={`scoring-kpi-${c.label}`} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground truncate">{c.label}</p>
                  {loading ? <Skeleton className="h-7 w-16 mt-1" /> : (
                    <p className="text-2xl font-bold tabular-nums mt-1 leading-none">{c.fmt(c.value)}</p>
                  )}
                  {!loading && c.prev !== undefined && <div className="mt-1"><DeltaBadge d={d} /></div>}
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
