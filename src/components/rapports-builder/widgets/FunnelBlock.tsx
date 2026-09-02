import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useReportData } from '@/hooks/analytics/useReportData';
import type { WidgetConfig, DashboardFilters } from '@/types/report';
import { NoSourceState, NoDataState } from './WidgetEmptyState';

interface Props { widget: WidgetConfig; filters: DashboardFilters; }

export function FunnelBlock({ widget, filters }: Props) {
  const { data, isLoading, error } = useReportData({ source: widget.source, filters });
  const rows = (data?.rows || []) as Array<{ etape?: string; count?: number; [k: string]: any }>;
  const dim = widget.dimension || 'etape';
  const meas = widget.measure || 'count';
  const max = Math.max(1, ...rows.map(r => Number(r[meas]) || 0));

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium truncate">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-2 justify-center">
        {!widget.source ? <NoSourceState /> : isLoading ? <Skeleton className="h-full w-full" /> : error ? (
          <span
            className="text-xs text-destructive"
            title={error instanceof Error ? error.message : 'Erreur inconnue'}
            role="alert"
          >
            Erreur de chargement
          </span>
        ) : !rows.length ? <NoDataState /> : (
          rows.map((r, i) => {
            const value = Number(r[meas]) || 0;
            const widthPct = (value / max) * 100;
            return (
              <div key={`funnel-row-${r[dim] ?? i}`} className="flex items-center gap-2 text-xs">
                <span className="w-24 truncate text-muted-foreground">{String(r[dim] ?? '—')}</span>
                <div className="flex-1 bg-muted rounded h-6 relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary rounded flex items-center justify-end px-2 text-primary-foreground font-medium"
                    style={{ width: `${widthPct}%` }}
                  >
                    {value}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
