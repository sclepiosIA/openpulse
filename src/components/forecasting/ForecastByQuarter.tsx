import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import type { ForecastQuarterRow } from '@/hooks/crm/useSalesForecast';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

interface Props {
  data: ForecastQuarterRow[];
}

export function ForecastByQuarter({ data }: Props) {
  const hasTargets = data.some((d) => d.target > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecast par trimestre</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune donnée sur la période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="quarter" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => fmt(v)}
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
              />
              <Legend />
              <Bar dataKey="raw" name="Pipeline brut" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="weighted" name="Pipeline pondéré" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="won" name="Gagné" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              {hasTargets && (
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Objectif"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
