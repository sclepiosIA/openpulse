import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useReportData } from '@/hooks/analytics/useReportData';
import type { WidgetConfig, DashboardFilters } from '@/types/report';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { NoSourceState, NoDataState } from './WidgetEmptyState';

interface Props { widget: WidgetConfig; filters: DashboardFilters; }

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(197 64% 60%)', 'hsl(40 90% 60%)', 'hsl(160 60% 50%)', 'hsl(280 60% 60%)'];

export function DonutChartBlock({ widget, filters }: Props) {
  const { data, isLoading, error } = useReportData({ source: widget.source, filters });
  const dim = widget.dimension || 'name';
  const meas = widget.measure || 'count';
  const rows = (data?.rows || []) as any[];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium truncate">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        {!widget.source ? <NoSourceState /> : isLoading ? <Skeleton className="h-full w-full" /> : error ? (
          <span
            className="text-xs text-destructive"
            title={error instanceof Error ? error.message : 'Erreur inconnue'}
            role="alert"
          >
            Erreur de chargement
          </span>
        ) : !rows.length ? <NoDataState /> : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey={meas} nameKey={dim} innerRadius="50%" outerRadius="80%" paddingAngle={2}>
                {rows.map((row, i) => <Cell key={`donut-cell-${row?.[dim] ?? i}`} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
