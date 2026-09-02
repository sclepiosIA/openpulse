import { useState, useMemo, useRef, useEffect } from "react";
import { useTresorerieDepensesParCategorie, CategoryNode, Transaction } from "@/hooks/tresorerie/useTresorerieDepensesParCategorie";
import { ChevronRight, ChevronDown, Loader2, ChevronsRight, ChevronsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Color palette for expense categories
const CATEGORY_COLORS = [
  "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
  "#e11d48", "#84cc16",
];

// Color palette for revenue categories (green/blue tones)
const REVENUE_COLORS = [
  "#10b981", "#059669", "#0d9488", "#0891b2", "#06b6d4",
  "#22d3ee", "#34d399", "#6ee7b7", "#2dd4bf", "#14b8a6",
  "#047857", "#065f46",
];

// Custom tooltip for stacked category charts
function CustomCategoryTooltip({ active, payload, label, categories, prefix, title }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; name: string }>;
  label?: string;
  categories: CategoryNode[];
  prefix: string;
  title: string;
}) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => (p.value as number) > 0).sort((a, b) => (b.value as number) - (a.value as number));
  const total = items.reduce((s, p) => s + (p.value as number), 0);
  if (total === 0) return null;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[200px] max-w-[300px]">
      <div className="font-semibold text-sm mb-2 capitalize">{label} — {title}</div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="truncate max-w-[150px]">{item.name}</span>
            </div>
            <span className="tabular-nums font-medium">{formatEuro(item.value)}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-border/50 mt-2 pt-1.5 flex justify-between text-xs font-bold">
        <span>Total</span>
        <span className="tabular-nums">{formatEuro(total)}</span>
      </div>
    </div>
  );
}

function formatCompact(value: number): string {
  if (value === 0) return "-";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString("fr-FR");
}

function formatEuro(value: number): string {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatMonthLabel(m: string): string {
  const d = parse(m + "-01", "yyyy-MM-dd", new Date());
  return format(d, "MMM yy", { locale: fr });
}

function formatMonthFull(m: string): string {
  const d = parse(m + "-01", "yyyy-MM-dd", new Date());
  return format(d, "MMMM yyyy", { locale: fr });
}

function formatMonthShort(m: string): string {
  const d = parse(m + "-01", "yyyy-MM-dd", new Date());
  return format(d, "MMM yy", { locale: fr });
}

const STATUT_STYLES: Record<string, string> = {
  paye: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  realise: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  en_attente: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  prevu: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  en_retard: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  contractualise: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  a_facturer: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const STATUT_LABELS: Record<string, string> = {
  paye: "Payé",
  realise: "Réalisé",
  en_attente: "Prévu",
  prevu: "Prévu",
  en_retard: "En retard",
  contractualise: "Contractualisé",
  a_facturer: "À facturer",
};

interface YearGroup {
  year: string;
  months: string[];
}

function groupMonthsByYear(months: string[]): YearGroup[] {
  const map = new Map<string, string[]>();
  for (const m of months) {
    const year = m.substring(0, 4);
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(m);
  }
  return Array.from(map.entries()).map(([year, ms]) => ({ year, months: ms }));
}

function getYearTotal(monthlyData: Record<string, number>, yearMonths: string[]): number {
  return yearMonths.reduce((s, m) => s + (monthlyData[m] || 0), 0);
}

// ==================== CELL TOOLTIP ====================
const MAX_TOOLTIP_ITEMS = 10;

function CellTooltipContent({ transactions, month }: { transactions: Transaction[]; month: string }) {
  const sorted = [...transactions].sort((a, b) => b.montant - a.montant);
  const displayed = sorted.slice(0, MAX_TOOLTIP_ITEMS);
  const remaining = sorted.length - displayed.length;
  const total = transactions.reduce((s, t) => s + t.montant, 0);

  return (
    <div className="max-h-[300px] overflow-auto min-w-[220px]">
      <div className="font-semibold text-xs mb-1.5 capitalize">{formatMonthFull(month)}</div>
      <div className="border-t border-border/50 pt-1 space-y-0.5">
        {displayed.map((tx, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate max-w-[140px]">{tx.nom}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="tabular-nums">{formatEuro(tx.montant)}</span>
              <span className={cn("px-1 py-0.5 rounded text-[10px] leading-none", STATUT_STYLES[tx.statut] || STATUT_STYLES.prevu)}>
                {STATUT_LABELS[tx.statut] || tx.statut}
              </span>
            </div>
          </div>
        ))}
        {remaining > 0 && (
          <div className="text-[10px] text-muted-foreground italic">+{remaining} autres</div>
        )}
      </div>
      <div className="border-t border-border/50 mt-1.5 pt-1 flex justify-between text-xs font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatEuro(total)}</span>
      </div>
      <div className="text-[10px] text-muted-foreground">({transactions.length} transaction{transactions.length > 1 ? "s" : ""})</div>
    </div>
  );
}

function CellWithTooltip({
  value,
  transactions,
  month,
  className,
  children,
}: {
  value: number;
  transactions?: Transaction[];
  month: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!transactions || transactions.length === 0 || value === 0) {
    return <td className={className}>{children}</td>;
  }

  return (
    <td className={className}>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className="block w-full h-full cursor-default">{children}</span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="p-2">
          <CellTooltipContent transactions={transactions} month={month} />
        </TooltipContent>
      </Tooltip>
    </td>
  );
}

// ==================== SPREADSHEET ROW ====================
function CategoryRow({
  node,
  yearGroups,
  collapsedYears,
  currentMonth,
  depth = 0,
  expanded,
  onToggle,
}: {
  node: CategoryNode;
  yearGroups: YearGroup[];
  collapsedYears: Record<string, boolean>;
  currentMonth: string;
  depth?: number;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded[node.id] ?? (depth === 0);
  const isLevel1 = depth === 0;

  return (
    <>
      <tr className={cn(
        "group transition-colors",
        isLevel1 ? "bg-muted/50 font-semibold" : "hover:bg-muted/30",
      )}>
        <td
          className={cn("sticky left-0 z-20 border-r border-border px-2 py-1.5 whitespace-nowrap text-sm", isLevel1 ? "bg-muted" : "bg-background")}
          style={{ paddingLeft: `${8 + depth * 20}px` }}
        >
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <button onClick={() => onToggle(node.id)} className="p-0.5 rounded hover:bg-accent">
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className="truncate max-w-[180px]">{node.nom}</span>
          </div>
        </td>

        {yearGroups.map((yg) => {
          const isCollapsed = collapsedYears[yg.year] ?? false;
          const yearTotal = getYearTotal(node.monthlyData, yg.months);
          return (
            <YearCells
              key={yg.year}
              yearGroup={yg}
              isCollapsed={isCollapsed}
              currentMonth={currentMonth}
              monthlyData={node.monthlyData}
              transactions={node.transactions}
              yearTotal={yearTotal}
            />
          );
        })}
      </tr>

      {hasChildren && isExpanded && node.children.map((child) => (
        <CategoryRow
          key={child.id}
          node={child}
          yearGroups={yearGroups}
          collapsedYears={collapsedYears}
          currentMonth={currentMonth}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}

// Year cells fragment
function YearCells({
  yearGroup,
  isCollapsed,
  currentMonth,
  monthlyData,
  transactions,
  yearTotal,
  valueClassName,
}: {
  yearGroup: YearGroup;
  isCollapsed: boolean;
  currentMonth: string;
  monthlyData: Record<string, number>;
  transactions?: Record<string, Transaction[]>;
  yearTotal: number;
  valueClassName?: string;
}) {
  return (
    <>
      {!isCollapsed && yearGroup.months.map((m) => {
        const val = monthlyData[m] || 0;
        const isCurrent = m === currentMonth;
        const isForecast = m > currentMonth;
        const tx = transactions?.[m];
        return (
          <CellWithTooltip
            key={m}
            value={val}
            transactions={tx}
            month={m}
            className={cn(
              "px-2 py-1.5 text-right text-xs tabular-nums border-r border-border/50",
              isCurrent && "bg-primary/10 font-medium",
              isForecast && !isCurrent && "bg-blue-50/60 dark:bg-blue-950/20",
              valueClassName,
            )}
          >
            {formatCompact(val)}
          </CellWithTooltip>
        );
      })}
      <td className={cn("px-2 py-1.5 text-right text-xs font-bold tabular-nums border-l-2 border-r border-border bg-muted", valueClassName)}>
        {formatCompact(yearTotal)}
      </td>
    </>
  );
}

// Simple value row (no tooltip, no tree) for solde lines
function SimpleValueRow({
  label,
  monthlyData,
  yearGroups,
  collapsedYears,
  currentMonth,
  bgClass,
  labelClass,
  dynamicColor,
}: {
  label: string;
  monthlyData: Record<string, number>;
  yearGroups: YearGroup[];
  collapsedYears: Record<string, boolean>;
  currentMonth: string;
  bgClass?: string;
  labelClass?: string;
  dynamicColor?: boolean;
}) {
  return (
    <tr className={cn("font-bold border-t-2 border-border", bgClass)}>
      <td className={cn("sticky left-0 z-20 border-r border-border px-2 py-2 text-sm", bgClass, labelClass)}>
        {label}
      </td>
      {yearGroups.map((yg) => {
        const isCollapsed = collapsedYears[yg.year] ?? false;
        const yearTotal = yg.months.reduce((s, m) => s + (monthlyData[m] || 0), 0);
        return (
          <SimpleYearCells
            key={yg.year}
            yearGroup={yg}
            isCollapsed={isCollapsed}
            currentMonth={currentMonth}
            monthlyData={monthlyData}
            yearTotal={yearTotal}
            dynamicColor={dynamicColor}
          />
        );
      })}
    </tr>
  );
}

function SimpleYearCells({
  yearGroup,
  isCollapsed,
  currentMonth,
  monthlyData,
  yearTotal,
  dynamicColor,
}: {
  yearGroup: YearGroup;
  isCollapsed: boolean;
  currentMonth: string;
  monthlyData: Record<string, number>;
  yearTotal: number;
  dynamicColor?: boolean;
}) {
  const colorForValue = (v: number) =>
    dynamicColor ? (v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : "";

  return (
    <>
      {!isCollapsed && yearGroup.months.map((m) => {
        const val = monthlyData[m] || 0;
        const isCurrent = m === currentMonth;
        const isForecast = m > currentMonth;
        return (
          <td
            key={m}
            className={cn(
              "px-2 py-1.5 text-right text-xs tabular-nums border-r border-border/50 font-bold",
              isCurrent && "bg-primary/10",
              isForecast && !isCurrent && "bg-blue-50/60 dark:bg-blue-950/20",
              colorForValue(val),
            )}
          >
            {formatCompact(val)}
          </td>
        );
      })}
      <td className={cn("px-2 py-1.5 text-right text-xs font-bold tabular-nums border-l-2 border-r border-border bg-muted", colorForValue(yearTotal))}>
        {formatCompact(yearTotal)}
      </td>
    </>
  );
}

// ==================== MAIN COMPONENT ====================
export function TresorerieAnalyseTab() {
  const {
    tree, months, currentMonth, grandTotal, grandTotalAll, grandTransactions,
    revenueTree, revenueGrandTotal, revenueGrandTotalAll, revenueGrandTransactions,
    solde, soldeCumule, isLoading,
  } = useTresorerieDepensesParCategorie();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [collapsedYears, setCollapsedYears] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const yearGroups = useMemo(() => groupMonthsByYear(months), [months]);

  // Auto-scroll to current month on mount
  useEffect(() => {
    if (scrollRef.current && months.length > 0) {
      const currentIdx = months.indexOf(currentMonth);
      if (currentIdx > 6) {
        const approxPixel = (currentIdx - 3) * 80;
        scrollRef.current.scrollLeft = approxPixel;
      }
    }
  }, [months, currentMonth]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleYear = (year: string) => {
    setCollapsedYears((prev) => ({ ...prev, [year]: !prev[year] }));
  };

  // Chart data
  const chartData = useMemo(() => {
    return months.map((m) => {
      const entry: Record<string, string | number> = {
        month: formatMonthLabel(m),
        monthKey: m,
      };
      for (const cat of tree) {
        entry[`dep_${cat.nom}`] = Math.round(cat.monthlyData[m] || 0);
      }
      for (const cat of revenueTree) {
        entry[`rev_${cat.nom}`] = Math.round(cat.monthlyData[m] || 0);
      }
      entry["Total Dépenses"] = Math.round(grandTotal[m] || 0);
      entry["Total Recettes"] = Math.round(revenueGrandTotal[m] || 0);
      entry["Solde cumulé"] = Math.round(soldeCumule[m] || 0);
      return entry;
    });
  }, [months, tree, revenueTree, grandTotal, revenueGrandTotal, soldeCumule]);

  const currentMonthLabel = formatMonthLabel(currentMonth);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 p-2 sm:p-4">
        {/* ==================== SPREADSHEET ==================== */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trésorerie prévisionnelle par catégorie</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div ref={scrollRef} className="overflow-auto max-h-[70vh] border rounded-b-lg">
              <table className="w-max min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-20 bg-background">
                  <tr>
                    <th className="sticky left-0 z-30 bg-background border-r border-b border-border px-2 py-2 text-left text-xs font-medium text-muted-foreground min-w-[200px]">
                      Catégorie
                    </th>
                    {yearGroups.map((yg) => {
                      const isCollapsed = collapsedYears[yg.year] ?? false;
                      return (
                        <YearHeaderCells
                          key={yg.year}
                          yearGroup={yg}
                          isCollapsed={isCollapsed}
                          currentMonth={currentMonth}
                          onToggleYear={toggleYear}
                        />
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* ===== SECTION DÉPENSES ===== */}
                  <tr className="bg-red-50/50 dark:bg-red-950/20">
                    <td colSpan={999} className="sticky left-0 z-20 px-2 py-1 text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider border-b border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
                      Dépenses
                    </td>
                  </tr>
                  {tree.map((cat) => (
                    <CategoryRow
                      key={cat.id}
                      node={cat}
                      yearGroups={yearGroups}
                      collapsedYears={collapsedYears}
                      currentMonth={currentMonth}
                      expanded={expanded}
                      onToggle={toggleExpand}
                    />
                  ))}
                  {/* TOTAL DÉPENSES */}
                  <tr className="bg-red-50 dark:bg-red-950/30 font-bold border-t-2 border-red-200 dark:border-red-800">
                    <td className="sticky left-0 z-20 bg-red-50 dark:bg-red-950/30 border-r border-border px-2 py-2 text-sm text-red-700 dark:text-red-400">
                      TOTAL DÉPENSES
                    </td>
                    {yearGroups.map((yg) => {
                      const isCollapsed = collapsedYears[yg.year] ?? false;
                      const yearTotal = yg.months.reduce((s, m) => s + (grandTotal[m] || 0), 0);
                      return (
                        <YearCells
                          key={yg.year}
                          yearGroup={yg}
                          isCollapsed={isCollapsed}
                          currentMonth={currentMonth}
                          monthlyData={grandTotal}
                          transactions={grandTransactions}
                          yearTotal={yearTotal}
                          valueClassName="text-red-700 dark:text-red-400"
                        />
                      );
                    })}
                  </tr>

                  {/* ===== SECTION RECETTES ===== */}
                  <tr className="bg-emerald-50/50 dark:bg-emerald-950/20">
                    <td colSpan={999} className="sticky left-0 z-20 px-2 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider border-b border-t-4 border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
                      Recettes
                    </td>
                  </tr>
                  {revenueTree.map((cat) => (
                    <CategoryRow
                      key={cat.id}
                      node={cat}
                      yearGroups={yearGroups}
                      collapsedYears={collapsedYears}
                      currentMonth={currentMonth}
                      expanded={expanded}
                      onToggle={toggleExpand}
                    />
                  ))}
                  {/* TOTAL RECETTES */}
                  <tr className="bg-emerald-50 dark:bg-emerald-950/30 font-bold border-t-2 border-emerald-200 dark:border-emerald-800">
                    <td className="sticky left-0 z-20 bg-emerald-50 dark:bg-emerald-950/30 border-r border-border px-2 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                      TOTAL RECETTES
                    </td>
                    {yearGroups.map((yg) => {
                      const isCollapsed = collapsedYears[yg.year] ?? false;
                      const yearTotal = yg.months.reduce((s, m) => s + (revenueGrandTotal[m] || 0), 0);
                      return (
                        <YearCells
                          key={yg.year}
                          yearGroup={yg}
                          isCollapsed={isCollapsed}
                          currentMonth={currentMonth}
                          monthlyData={revenueGrandTotal}
                          transactions={revenueGrandTransactions}
                          yearTotal={yearTotal}
                          valueClassName="text-emerald-700 dark:text-emerald-400"
                        />
                      );
                    })}
                  </tr>

                  {/* ===== SOLDE MENSUEL ===== */}
                  <tr className="border-t-4 border-border">
                    <td colSpan={999} className="h-0" />
                  </tr>
                  <SimpleValueRow
                    label="SOLDE MENSUEL"
                    monthlyData={solde}
                    yearGroups={yearGroups}
                    collapsedYears={collapsedYears}
                    currentMonth={currentMonth}
                    bgClass="bg-muted/70"
                    dynamicColor
                  />
                  <SimpleValueRow
                    label="SOLDE CUMULÉ"
                    monthlyData={soldeCumule}
                    yearGroups={yearGroups}
                    collapsedYears={collapsedYears}
                    currentMonth={currentMonth}
                    bgClass="bg-muted"
                    dynamicColor
                  />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ==================== CHARTS ==================== */}
        <div className="space-y-6">
          {/* Histogramme dépenses par catégorie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Dépenses par catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompact(v)} />
                    <RechartsTooltip content={<CustomCategoryTooltip categories={tree} prefix="dep_" title="Dépenses" />} />
                    <ReferenceLine
                      x={currentMonthLabel}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="4 4"
                      label={{ value: "Actuel", position: "top", fontSize: 10 }}
                    />
                    {tree.map((cat, i) => (
                      <Bar key={cat.id} dataKey={`dep_${cat.nom}`} stackId="dep" fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} name={cat.nom} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Histogramme recettes par catégorie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recettes par catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompact(v)} />
                    <RechartsTooltip content={<CustomCategoryTooltip categories={revenueTree} prefix="rev_" title="Recettes" />} />
                    <ReferenceLine
                      x={currentMonthLabel}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="4 4"
                      label={{ value: "Actuel", position: "top", fontSize: 10 }}
                    />
                    {revenueTree.map((cat, i) => (
                      <Bar key={cat.id} dataKey={`rev_${cat.nom}`} stackId="rev" fill={REVENUE_COLORS[i % REVENUE_COLORS.length]} name={cat.nom} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Courbe solde cumulé */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Solde cumulé</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompact(v)} />
                    <RechartsTooltip formatter={(value: number) => value.toLocaleString("fr-FR") + " €"} labelStyle={{ fontWeight: "bold" }} />
                    <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />
                    <ReferenceLine
                      x={currentMonthLabel}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="4 4"
                      label={{ value: "Actuel", position: "top", fontSize: 10 }}
                    />
                    <Area type="monotone" dataKey="Solde cumulé" fill="#3b82f6" fillOpacity={0.15} stroke="#3b82f6" strokeWidth={2.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Year header cells
function YearHeaderCells({
  yearGroup,
  isCollapsed,
  currentMonth,
  onToggleYear,
}: {
  yearGroup: YearGroup;
  isCollapsed: boolean;
  currentMonth: string;
  onToggleYear: (year: string) => void;
}) {
  return (
    <>
      {!isCollapsed && yearGroup.months.map((m) => {
        const isCurrent = m === currentMonth;
        const isForecast = m > currentMonth;
        return (
          <th
            key={m}
            className={cn(
              "px-2 py-2 text-right text-xs font-medium text-muted-foreground border-b border-r border-border/50 min-w-[75px] whitespace-nowrap",
              isCurrent && "bg-primary/10 font-semibold text-primary",
              isForecast && !isCurrent && "bg-blue-50/60 dark:bg-blue-950/20",
            )}
          >
            {formatMonthShort(m)}
          </th>
        );
      })}
      <th className="px-2 py-2 text-right text-xs font-bold border-b border-r border-border border-l-2 bg-muted min-w-[80px] whitespace-nowrap">
        <button
          onClick={() => onToggleYear(yearGroup.year)}
          className="inline-flex items-center gap-1 hover:text-primary transition-colors w-full justify-end"
        >
          {isCollapsed ? (
            <ChevronsRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronsDown className="h-3.5 w-3.5" />
          )}
          {isCollapsed ? yearGroup.year : `Total ${yearGroup.year}`}
        </button>
      </th>
    </>
  );
}
