import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Flame, AlertTriangle, Trophy } from 'lucide-react';
import type { ForecastTopDeal, ForecastRiskDeal } from '@/hooks/crm/useSalesForecast';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

interface Props {
  data: ForecastTopDeal[];
  hot?: ForecastRiskDeal[];
  atRisk?: ForecastRiskDeal[];
}

function DealsTable({
  rows,
  emptyLabel,
  highlightOverdue = false,
}: {
  rows: ForecastTopDeal[];
  emptyLabel: string;
  highlightOverdue?: boolean;
}) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-3">{emptyLabel}</p>;
  }
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Établissement</TableHead>
            <TableHead className="hidden sm:table-cell">Statut</TableHead>
            <TableHead className="text-right">Probabilité</TableHead>
            <TableHead className="text-right hidden md:table-cell">Valeur brute</TableHead>
            <TableHead className="text-right">Pondéré</TableHead>
            <TableHead className="text-right hidden lg:table-cell">Closing</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((deal) => {
            const overdue = highlightOverdue && deal.closing_date < today;
            return (
              <TableRow key={deal.id}>
                <TableCell className="font-medium">
                  <Link to={`/etablissements/${deal.id}`} className="hover:underline">
                    {deal.nom}
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="text-xs text-muted-foreground capitalize">{deal.statut.replace(/_/g, ' ')}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline">{deal.probability}%</Badge>
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums hidden md:table-cell">{fmt(deal.deal_value)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{fmt(deal.weighted_value)}</TableCell>
                <TableCell className={`text-right text-xs hidden lg:table-cell ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  {fmtDate(deal.closing_date)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ForecastTopDeals({ data, hot, atRisk }: Props) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-warning" /> Deals chauds (probabilité ≥ 65 %)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DealsTable rows={hot || []} emptyLabel="Aucun deal chaud sur la période." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Deals à risque (closing dépassé)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DealsTable rows={atRisk || []} emptyLabel="Aucun deal en retard 🎉" highlightOverdue />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-primary" /> Top 10 deals (pondéré)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DealsTable rows={data} emptyLabel="Aucun deal sur la période." />
        </CardContent>
      </Card>
    </div>
  );
}
