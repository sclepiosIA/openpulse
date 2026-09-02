import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import type { ForecastPhaseGroup } from '@/hooks/crm/useSalesForecast';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

const PHASE_LABELS: Record<string, string> = {
  commercial: 'Commercial',
  deploiement: 'Déploiement',
  production: 'Production',
};

const PHASE_COLORS: Record<string, string> = {
  commercial: 'hsl(var(--chart-1))',
  deploiement: 'hsl(var(--chart-3))',
  production: 'hsl(var(--success))',
};

interface Props {
  data: ForecastPhaseGroup[];
}

export function ForecastPhaseDonut({ data }: Props) {
  const filtered = (data || []).filter((d) => (d.weighted || 0) > 0);
  const total = filtered.reduce((s, d) => s + (d.weighted || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Répartition pondérée par phase métier</CardTitle>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aucune donnée pondérée.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_auto] items-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={filtered}
                  dataKey="weighted"
                  nameKey="phase_group"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {filtered.map((entry) => (
                    <Cell
                      key={entry.phase_group}
                      fill={PHASE_COLORS[entry.phase_group] || 'hsl(var(--muted))'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, n: string) => [fmt(v), PHASE_LABELS[n] || n]}
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                  }}
                />
                <Legend formatter={(v: string) => PHASE_LABELS[v] || v} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 min-w-[180px]">
              {filtered.map((d) => {
                const pct = total > 0 ? Math.round((d.weighted / total) * 100) : 0;
                return (
                  <div key={d.phase_group} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{ background: PHASE_COLORS[d.phase_group] || 'hsl(var(--muted))' }}
                      />
                      <span className="font-medium">{PHASE_LABELS[d.phase_group] || d.phase_group}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">{fmt(d.weighted)}</div>
                      <div className="text-xs text-muted-foreground">{pct}% · {d.count}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
