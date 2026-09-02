import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageDataState } from "@/components/common/PageDataState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  useTresorerieDepensesParCategorie,
  type CategoryNode,
} from "@/hooks/tresorerie/useTresorerieDepensesParCategorie";
import { ArrowDownRight, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export function FinancesDepenses() {
  const analyse = useTresorerieDepensesParCategorie();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const currentYear = new Date().getFullYear();
  const yearPrefix = String(currentYear);

  const yearMonths = useMemo(
    () => analyse.months.filter((m) => m.startsWith(yearPrefix)),
    [analyse.months, yearPrefix]
  );

  const yearTotal = (node: CategoryNode) =>
    yearMonths.reduce((s, m) => s + (node.monthlyData[m] || 0), 0);

  const grandYearTotal = yearMonths.reduce((s, m) => s + (analyse.grandTotal[m] || 0), 0);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (node: CategoryNode, depth: number): JSX.Element[] => {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);
    const annual = yearTotal(node);
    const monthly = yearMonths.length > 0 ? annual / yearMonths.length : 0;
    const share = grandYearTotal > 0 ? (annual / grandYearTotal) * 100 : 0;

    const row = (
      <TableRow
        key={node.id}
        className={cn(depth === 0 && "font-medium", hasChildren && "cursor-pointer hover:bg-muted/40")}
        onClick={hasChildren ? () => toggle(node.id) : undefined}
      >
        <TableCell>
          <div className="flex items-center gap-1.5" style={{ paddingLeft: `${depth * 20}px` }}>
            {hasChildren ? (
              isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <span className="truncate">{node.nom}</span>
          </div>
        </TableCell>
        <TableCell className="text-right tabular-nums whitespace-nowrap">{formatCurrency(annual)}</TableCell>
        <TableCell className="text-right tabular-nums whitespace-nowrap text-muted-foreground">
          {formatCurrency(monthly)}
        </TableCell>
        <TableCell className="text-right tabular-nums whitespace-nowrap text-muted-foreground">
          {share.toFixed(1)} %
        </TableCell>
        <TableCell className="text-right tabular-nums whitespace-nowrap text-muted-foreground">
          {formatCurrency(node.total)}
        </TableCell>
      </TableRow>
    );

    const childRows = hasChildren && isOpen ? node.children.flatMap((c) => renderNode(c, depth + 1)) : [];
    return [row, ...childRows];
  };

  const sortedTree = useMemo(
    () => [...analyse.tree].sort((a, b) => yearTotal(b) - yearTotal(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analyse.tree, yearMonths]
  );

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <PageDataState
        isLoading={analyse.isLoading}
        isError={false}
        isEmpty={!analyse.isLoading && analyse.tree.length === 0}
        emptyTitle="Aucune dépense"
        emptyDescription="Aucun poste de dépense catégorisé pour le moment."
      >
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
                Postes de dépenses
              </CardTitle>
              <Badge variant="secondary">
                Total {currentYear} : {formatCurrency(grandYearTotal)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Montants réels + prévus de l'année en cours, par catégorie. Cliquez sur une ligne pour déplier les sous-postes.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Poste</TableHead>
                    <TableHead className="text-right min-w-[120px]">Total {currentYear}</TableHead>
                    <TableHead className="text-right min-w-[120px]">Moyenne / mois</TableHead>
                    <TableHead className="text-right min-w-[80px]">Part</TableHead>
                    <TableHead className="text-right min-w-[130px]">Cumul (depuis 2025)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTree.flatMap((node) => renderNode(node, 0))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total dépenses</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(grandYearTotal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(yearMonths.length > 0 ? grandYearTotal / yearMonths.length : 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">100 %</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(analyse.grandTotalAll)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </PageDataState>
    </div>
  );
}
