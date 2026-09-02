import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import type { ForecastCommercialRow } from '@/hooks/crm/useSalesForecast';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

interface Props {
  data: ForecastCommercialRow[];
}

export function ForecastByCommercial({ data }: Props) {
  const maxWeighted = Math.max(1, ...data.map((d) => d.weighted || 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecast par commercial</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun deal sur la période.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Commercial</TableHead>
                <TableHead className="text-right">Deals</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Pipeline brut</TableHead>
                <TableHead className="text-right">Pipeline pondéré</TableHead>
                <TableHead className="hidden lg:table-cell w-[180px]">Progression</TableHead>
                <TableHead className="text-right hidden md:table-cell">Gagné</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => {
                const pct = ((row.weighted || 0) / maxWeighted) * 100;
                return (
                  <TableRow key={row.user_id ?? `none-${idx}`}>
                    <TableCell className="font-medium">{row.display_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.deals_count}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums hidden sm:table-cell">{fmt(row.raw)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmt(row.weighted)}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Progress value={pct} className="h-2" />
                    </TableCell>
                    <TableCell className="text-right text-success tabular-nums hidden md:table-cell">{fmt(row.won)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
