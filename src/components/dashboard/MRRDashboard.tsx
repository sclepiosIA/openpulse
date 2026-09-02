import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, Users, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useMRRData } from "@/hooks/analytics/useMRRData";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

export function MRRDashboard() {
  const {
    currentMRR, arr, mrrVariation, payingClients,
    monthlyHistory, topClients, breakdown, isLoading,
  } = useMRRData();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Chargement des données MRR…
        </CardContent>
      </Card>
    );
  }

  const variationPositive = mrrVariation >= 0;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="MRR"
          value={formatEuro(currentMRR)}
          icon={DollarSign}
          subtitle="Revenu mensuel récurrent"
        />
        <KPICard
          title="ARR"
          value={formatEuro(arr)}
          icon={TrendingUp}
          subtitle="Revenu annuel récurrent"
        />
        <KPICard
          title="Variation M-1"
          value={`${variationPositive ? '+' : ''}${mrrVariation.toFixed(1)}%`}
          icon={variationPositive ? ArrowUpRight : ArrowDownRight}
          subtitle="vs mois précédent"
          valueClassName={variationPositive ? "text-emerald-600" : "text-red-500"}
        />
        <KPICard
          title="Clients payants"
          value={String(payingClients)}
          icon={Users}
          subtitle="Établissements actifs"
        />
      </div>

      {/* MRR Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Évolution MRR — 12 mois glissants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyHistory} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tickFormatter={(v) => formatNumber(v) + '€'} tick={{ fontSize: 11 }} className="text-muted-foreground" width={60} />
                <Tooltip
                  formatter={(value: number) => [formatEuro(value), 'MRR']}
                  labelClassName="font-medium"
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#mrrGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Bottom section: Top clients + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 10 clients */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top 10 clients par MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun client actif</p>
            ) : (
              <div className="space-y-2">
                {topClients.map((client, i) => (
                  <div key={client.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                      <span className="truncate">{client.nom}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {client.type_offre && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {client.type_offre}
                        </span>
                      )}
                      <span className="font-medium tabular-nums">{formatEuro(client.mrr)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Breakdown par type d'offre */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Répartition par type d'offre
            </CardTitle>
          </CardHeader>
          <CardContent>
            {breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>
            ) : (
              <div className="space-y-3">
                {breakdown.map((item) => {
                  const pct = currentMRR > 0 ? (item.mrr / currentMRR) * 100 : 0;
                  return (
                    <div key={item.type} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{item.type}</span>
                        <span className="font-medium">{formatEuro(item.mrr)} <span className="text-muted-foreground text-xs">({item.count} clients)</span></span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  subtitle: string;
  valueClassName?: string;
}

function KPICard({ title, value, icon: Icon, subtitle, valueClassName }: KPICardProps) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className={cn("text-xl sm:text-2xl font-bold tracking-tight", valueClassName)}>
          {value}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

export default MRRDashboard;
