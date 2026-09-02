import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageDataState } from "@/components/common/PageDataState";
import { useTresorerieDepensesParCategorie } from "@/hooks/tresorerie/useTresorerieDepensesParCategorie";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sigma } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const formatCompact = (value: number) => {
  if (!value) return "–";
  const abs = Math.abs(value);
  const formatted =
    abs >= 100000
      ? `${Math.round(value / 1000)} k€`
      : abs >= 10000
        ? `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€`
        : `${Math.round(value).toLocaleString("fr-FR")} €`;
  return formatted;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);

// Classification des catégories racines (niveau 1) vers les blocs du P&L
const CONSOMMATIONS_CODES = [
  "DEP_CHARGES_DE_PRODUCTION",
  "DEP_CHARGES_EXT",
  "DEP_MATERIEL",
  "DEP_LICENCES",
  "DEP_COMMERCIAL",
  "DEP_FREELANCES",
  "DEP_AUTRES",
];
const PERSONNEL_CODES = ["DEP_SALAIRES"];
const IMPOTS_CODES = ["DEP_IMPOTS"];
const FINANCIER_CODES = ["DEP_CHARGES_FINANCIERES"];
const DIVIDENDES_CODES = ["DEP_DIVIDENDES"];

interface PnLRow {
  label: string;
  values: number[]; // 12 valeurs mensuelles
  total: number;
  kind: "produit" | "charge" | "solde";
}

export function FinancesPnL() {
  const analyse = useTresorerieDepensesParCategorie();
  const currentYear = new Date().getFullYear();

  const years = useMemo(
    () =>
      Array.from(new Set(analyse.months.map((m) => Number(m.slice(0, 4)))))
        .filter((y) => y <= currentYear)
        .sort((a, b) => b - a),
    [analyse.months, currentYear]
  );

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const year = selectedYear ?? (years.includes(currentYear) ? currentYear : years[0] ?? currentYear);

  const rows = useMemo(() => {
    const monthKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

    const sumTreeByCodes = (codes: string[], monthKey: string) =>
      analyse.tree
        .filter((n) => codes.includes(n.code))
        .reduce((sum, n) => sum + (n.monthlyData[monthKey] || 0), 0);

    const build = (fn: (monthKey: string) => number): number[] => monthKeys.map(fn);

    const ca = build((m) => analyse.revenueGrandTotal[m] || 0);
    const consommations = build((m) => sumTreeByCodes(CONSOMMATIONS_CODES, m));
    const personnel = build((m) => sumTreeByCodes(PERSONNEL_CODES, m));
    const impots = build((m) => sumTreeByCodes(IMPOTS_CODES, m));
    const financier = build((m) => sumTreeByCodes(FINANCIER_CODES, m));
    const dividendes = build((m) => sumTreeByCodes(DIVIDENDES_CODES, m));

    const va = ca.map((v, i) => v - consommations[i]);
    const ebe = va.map((v, i) => v - personnel[i] - impots[i]);
    const resultatCourant = ebe.map((v, i) => v - financier[i]);
    const fluxNet = resultatCourant.map((v, i) => v - dividendes[i]);

    const total = (arr: number[]) => arr.reduce((s, v) => s + v, 0);

    const rowsList: PnLRow[] = [
      { label: "Chiffre d'affaires", values: ca, total: total(ca), kind: "produit" },
      { label: "Consommations et charges externes", values: consommations, total: total(consommations), kind: "charge" },
      { label: "Valeur ajoutée", values: va, total: total(va), kind: "solde" },
      { label: "Charges de personnel", values: personnel, total: total(personnel), kind: "charge" },
      { label: "Impôts et taxes", values: impots, total: total(impots), kind: "charge" },
      { label: "Excédent brut d'exploitation (EBE)", values: ebe, total: total(ebe), kind: "solde" },
      { label: "Charges financières", values: financier, total: total(financier), kind: "charge" },
      { label: "Résultat courant", values: resultatCourant, total: total(resultatCourant), kind: "solde" },
      { label: "Prélèvements et dividendes", values: dividendes, total: total(dividendes), kind: "charge" },
      { label: "Flux net de l'exercice", values: fluxNet, total: total(fluxNet), kind: "solde" },
    ];

    return rowsList;
  }, [analyse.tree, analyse.revenueGrandTotal, year]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <PageDataState isLoading={analyse.isLoading} isError={false}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sigma className="h-4 w-4 text-muted-foreground" />
                Soldes intermédiaires de gestion
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="hidden sm:inline-flex">Vue mensualisée · réel + prévu</Badge>
                <Select value={String(year)} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="h-8 w-[110px] text-sm">
                    <SelectValue placeholder="Année" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}{y === currentYear ? " (en cours)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Construit à partir des flux de trésorerie catégorisés (revenus et dépenses). Cette vue sera détaillée ultérieurement.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="w-full table-fixed text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[190px] px-2">Poste</TableHead>
                    {MONTH_LABELS.map((m) => (
                      <TableHead key={m} className="text-right px-1.5">
                        {m}
                      </TableHead>
                    ))}
                    <TableHead className="text-right px-2 w-[92px] font-semibold text-foreground">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.label}
                      className={cn(row.kind === "solde" && "bg-muted/50 font-semibold")}
                    >
                      <TableCell
                        className={cn(
                          "px-2 py-2 truncate",
                          row.kind === "charge" && "pl-5 text-muted-foreground"
                        )}
                        title={row.label}
                      >
                        {row.kind === "charge" ? `– ${row.label}` : row.label}
                      </TableCell>
                      {row.values.map((value, i) => {
                        const negative = row.kind === "solde" && value < 0;
                        return (
                          <TableCell
                            key={i}
                            className={cn(
                              "text-right tabular-nums px-1.5 py-2 whitespace-nowrap",
                              row.kind === "charge" && "text-muted-foreground",
                              negative && "text-destructive"
                            )}
                          >
                            {formatCompact(row.kind === "charge" ? -value : value)}
                          </TableCell>
                        );
                      })}
                      <TableCell
                        className={cn(
                          "text-right tabular-nums px-2 py-2 whitespace-nowrap font-semibold",
                          row.kind === "charge" && "text-muted-foreground",
                          row.kind === "solde" && row.total < 0 && "text-destructive"
                        )}
                        title={formatCurrency(row.kind === "charge" ? -row.total : row.total)}
                      >
                        {formatCompact(row.kind === "charge" ? -row.total : row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </PageDataState>
    </div>
  );
}
