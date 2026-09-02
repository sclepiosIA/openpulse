import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useReportData } from '@/hooks/analytics/useReportData';
import type { WidgetConfig, DashboardFilters } from '@/types/report';
import { cn } from '@/lib/utils';
import { NoSourceState } from './WidgetEmptyState';

interface KpiBlockProps {
  widget: WidgetConfig;
  filters: DashboardFilters;
}

function formatValue(v: number, format?: WidgetConfig['format']): string {
  if (format === 'currency') return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  if (format === 'percent') return new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 }).format(v / 100);
  return new Intl.NumberFormat('fr-FR').format(v);
}

export function KpiBlock({ widget, filters }: KpiBlockProps) {
  const { data, isLoading, error } = useReportData({ source: widget.source, filters });

  const value = (() => {
    if (!data?.rows?.length) return 0;
    const measure = widget.measure || 'count';
    return data.rows.reduce((sum, r: any) => sum + (Number(r[measure]) || 0), 0);
  })();

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground truncate">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        {!widget.source ? (
          <NoSourceState />
        ) : isLoading ? (
          <Skeleton className="h-10 w-24" />
        ) : error ? (
          <span
            className="text-xs text-destructive"
            title={error instanceof Error ? error.message : 'Erreur inconnue'}
            role="alert"
          >
            Erreur de chargement
          </span>
        ) : (
          <span className={cn('text-3xl font-bold', widget.color)}>
            {formatValue(value, widget.format)}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
