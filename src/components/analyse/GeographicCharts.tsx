import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGeographicStats } from '@/hooks/geography/useGeographicStats';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getPhaseColor } from '@/lib/geoUtils';

interface GeographicChartsProps {
  onFilterByRegion?: (region: string) => void;
  onFilterByPhase?: (phase: string) => void;
}

export function GeographicCharts({ onFilterByRegion, onFilterByPhase }: GeographicChartsProps) {
  const { stats, loading } = useGeographicStats();

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={`geographic-charts-skeleton-${i}`}>
            <CardHeader>
              <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Données pour le graphique en camembert (Phases)
  const phaseData = Object.entries(stats.byPhase).map(([name, value]) => ({
    name,
    value,
    color: getPhaseColor(name),
  }));

  // Données pour le graphique en barres (Top régions)
  const regionData = stats.topRegions.slice(0, 8).map((region) => ({
    region: region.region.length > 15 ? region.region.substring(0, 15) + '...' : region.region,
    total: region.count,
    ...region.byStatus,
  }));

  const allStatuses = Array.from(
    new Set(stats.topRegions.flatMap((r) => Object.keys(r.byStatus)))
  );

  const statusColors: Record<string, string> = {
    Contractuel: 'hsl(var(--chart-1))',
    Déploiement: 'hsl(var(--chart-3))',
    Formation: 'hsl(var(--chart-4))',
    Production: 'hsl(var(--chart-2))',
    Prospect: 'hsl(var(--muted))',
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Graphique en camembert - Distribution par phase */}
      <Card>
        <CardHeader>
          <CardTitle>Distribution par Phase</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={phaseData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                onClick={(data) => onFilterByPhase?.(data.name)}
                className="cursor-pointer"
              >
                {phaseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Graphique en barres - Top régions par statut */}
      <Card>
        <CardHeader>
          <CardTitle>Top Régions par Statut</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={regionData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="region"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis className="text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              {allStatuses.map((status) => (
                <Bar
                  key={status}
                  dataKey={status}
                  stackId="a"
                  fill={statusColors[status] || 'hsl(var(--muted))'}
                  onClick={(data) => onFilterByRegion?.(data.region)}
                  className="cursor-pointer"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
