import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart as LineChartIcon, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import type { QontoTransaction } from "@/hooks/tresorerie/useQontoTransactions";

const formatMontant = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatCompact = (value: number) => {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k€`;
  return `${Math.round(value)}€`;
};

const tooltipStyle = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--background))",
};

interface FinancesChartsSectionProps {
  transactions: QontoTransaction[];
  soldeActuel: number;
  hasQonto: boolean;
  months: string[];
  caParMois: Record<string, number>;
  coutsParMois: Record<string, number>;
}

export function FinancesChartsSection({
  transactions,
  soldeActuel,
  hasQonto,
  months,
  caParMois,
  coutsParMois,
}: FinancesChartsSectionProps) {
  const now = new Date();

  // 12 derniers mois (mois courant inclus)
  const last12Months = useMemo(() => {
    const result: { key: string; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(startOfMonth(now), i);
      result.push({
        key: format(d, "yyyy-MM"),
        label: format(d, "MMM yy", { locale: fr }),
      });
    }
    return result;
  }, []);

  // Évolution du solde de trésorerie : reconstruction rétroactive
  // depuis le solde actuel via les flux nets Qonto de chaque mois.
  const tresorerieData = useMemo(() => {
    const netByMonth: Record<string, number> = {};
    for (const t of transactions) {
      const month = (t.date_operation || "").substring(0, 7);
      if (!month) continue;
      const signed = t.type_operation === "credit" ? t.montant : -t.montant;
      netByMonth[month] = (netByMonth[month] || 0) + signed;
    }

    // Solde fin de mois : on part du solde actuel (fin du mois courant)
    // et on remonte : solde(M-1) = solde(M) − flux net de M.
    const balances: Record<string, number> = {};
    let balance = soldeActuel;
    for (let i = last12Months.length - 1; i >= 0; i--) {
      const { key } = last12Months[i];
      balances[key] = balance;
      balance -= netByMonth[key] || 0;
    }

    return last12Months.map(({ key, label }) => ({
      mois: label,
      solde: Math.round(balances[key] || 0),
    }));
  }, [transactions, soldeActuel, last12Months]);

  // CA vs coûts mensuels (données trésorerie revenus / dépenses)
  const caCoutsData = useMemo(() => {
    const monthSet = new Set(months);
    return last12Months.map(({ key, label }) => ({
      mois: label,
      ca: monthSet.has(key) ? Math.round(caParMois[key] || 0) : 0,
      couts: monthSet.has(key) ? Math.round(coutsParMois[key] || 0) : 0,
    }));
  }, [months, caParMois, coutsParMois, last12Months]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LineChartIcon className="h-4 w-4 text-muted-foreground" />
            Évolution de la trésorerie — 12 derniers mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasQonto ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucune connexion bancaire Qonto active.
            </p>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tresorerieData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mois" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={formatCompact} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip
                    formatter={(value: number) => [formatMontant(value), "Solde fin de mois"]}
                    contentStyle={tooltipStyle}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="solde"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            CA vs coûts mensuels — 12 derniers mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={caCoutsData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={formatCompact} tick={{ fontSize: 11 }} width={60} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatMontant(value),
                    name === "ca" ? "CA" : "Coûts",
                  ]}
                  contentStyle={tooltipStyle}
                />
                <Legend formatter={(value) => (value === "ca" ? "CA" : "Coûts")} />
                <Bar dataKey="ca" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="couts" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
