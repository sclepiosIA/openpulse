import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useReportData } from '@/hooks/analytics/useReportData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WidgetConfig, DashboardFilters } from '@/types/report';
import { NoSourceState, NoDataState } from './WidgetEmptyState';

interface Props { widget: WidgetConfig; filters: DashboardFilters; }

export function TableBlock({ widget, filters }: Props) {
  const { data, isLoading, error } = useReportData({ source: widget.source, filters });
  const rows = (data?.rows || []) as Array<Record<string, any>>;
  const cols = rows[0] ? Object.keys(rows[0]).filter(k => k !== 'id') : [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium truncate">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto">
        {!widget.source ? <NoSourceState /> : isLoading ? <Skeleton className="h-full w-full" /> : error ? (
          <span
            className="text-xs text-destructive"
            title={error instanceof Error ? error.message : 'Erreur inconnue'}
            role="alert"
          >
            Erreur de chargement
          </span>
        ) : rows.length === 0 ? <NoDataState /> : (
          <Table>
            <TableHeader>
              <TableRow>
                {cols.map(c => <TableHead key={c} className="text-xs">{c}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 100).map((r, i) => (
                <TableRow key={`table-block-row-${i}`}>
                  {cols.map(c => (
                    <TableCell key={c} className="text-xs py-1.5">
                      {typeof r[c] === 'number' ? new Intl.NumberFormat('fr-FR').format(r[c]) : String(r[c] ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
