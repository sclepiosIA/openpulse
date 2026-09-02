import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useReportData } from '@/hooks/analytics/useReportData';
import type { WidgetConfig, DashboardFilters } from '@/types/report';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NoSourceState, NoDataState } from './WidgetEmptyState';

interface Props { widget: WidgetConfig; filters: DashboardFilters; }

export function BarChartBlock({ widget, filters }: Props) {
  const { data, isLoading, error } = useReportData({ source: widget.source, filters });
  const dim = widget.dimension || 'name';
  const meas = widget.measure || 'count';

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
        ) : !data?.rows?.length ? <NoDataState /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.rows as any[]} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey={dim} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6 }} />
              <Bar dataKey={meas} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
