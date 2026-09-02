import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTresorerieDepenses } from "@/hooks/tresorerie/useTresorerieDepenses";
import { SortableTableHead, useSortConfig } from "./SortableTableHead";
import { TresoreriePagination } from "./TresoreriePagination";
import { EditableCell } from "./EditableCell";
import { CategorySelect } from "./CategorySelect";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  Search,
  Trash2,
  Users,
  TrendingDown,
  AlertTriangle,
  Calendar as CalendarIcon,
  Download,
  Filter,
  List,
  PieChart as PieChartIcon,
  ArrowDownRight,
  Clock,
  Tag,
} from "lucide-react";
import { format, parseISO, differenceInDays, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";

const STATUT_CONFIG: Record<string, { label: string; bgClass: string }> = {
  en_attente: { label: "En attente", bgClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200" },
  valide: { label: "Validé", bgClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200" },
  paye: { label: "Payé", bgClass: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200" },
  payee: { label: "Payé", bgClass: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200" },
  en_retard: { label: "En retard", bgClass: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200" },
};

const STATUT_OPTIONS = [
  { value: "en_attente", label: "En attente" },
  { value: "valide", label: "Validé" },
];

const CATEGORY_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 76%, 36%)",
  "hsl(0, 84%, 60%)",
  "hsl(280, 87%, 65%)",
  "hsl(35, 91%, 50%)",
  "hsl(190, 90%, 50%)",
];

export function DepensesPrevisionnelles() {
  const {
    depenses, isLoading, marquerPayee, deleteDepense, updateDepense, isUpdating, isDeleting
  } = useTresorerieDepenses();

  const [search, setSearch] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");
  const [filtreCategorie, setFiltreCategorie] = useState<string>("tous");
  const [viewMode, setViewMode] = useState<"list" | "categories">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { sortConfig, handleSort } = useSortConfig("date_prevue", "desc");

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  const { data: categories } = useQuery({
    queryKey: ['tresorerie-categories-depense'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tresorerie_categories')
        .select('id, code, nom, couleur, parent_id, niveau')
        .eq('type', 'depense')
        .order('nom');
      if (error) throw error;
      return data || [];
    }
  });

  const categoriesMap = useMemo(() => {
    return Object.fromEntries((categories || []).map(c => [c.code, c]));
  }, [categories]);

  const depensesFiltrees = useMemo(() => {
    let filtered = depenses.filter((d) => {
      // Exclure les dépenses payées du prévisionnel
      if (d.statut === 'paye' || d.statut === 'payee') return false;
      const matchSearch = !search || d.nom.toLowerCase().includes(search.toLowerCase());
      const matchStatut = filtreStatut === "tous" || d.statut === filtreStatut;
      const matchCategorie = filtreCategorie === "tous" || d.categorie_code === filtreCategorie;
      let matchDate = true;
      if (dateRange.from && dateRange.to) {
        const depenseDate = parseISO(d.date_prevue);
        matchDate = isWithinInterval(depenseDate, { start: dateRange.from, end: dateRange.to });
      }
      return matchSearch && matchStatut && matchCategorie && matchDate;
    });

    if (sortConfig.field && sortConfig.direction) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number | null = null;
        let bVal: string | number | null = null;
        switch (sortConfig.field) {
          case "nom": aVal = a.nom; bVal = b.nom; break;
          case "date_prevue": aVal = a.date_prevue; bVal = b.date_prevue; break;
          case "montant": aVal = a.montant; bVal = b.montant; break;
          case "categorie": aVal = a.categorie_code || ""; bVal = b.categorie_code || ""; break;
          case "statut": aVal = a.statut || ""; bVal = b.statut || ""; break;
          default: return 0;
        }
        if (aVal === null || bVal === null) return 0;
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [depenses, search, filtreStatut, filtreCategorie, dateRange, sortConfig]);

  const totalItems = depensesFiltrees.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedDepenses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return depensesFiltrees.slice(start, start + pageSize);
  }, [depensesFiltrees, currentPage, pageSize]);

  useMemo(() => { setCurrentPage(1); }, [search, filtreStatut, filtreCategorie, dateRange, sortConfig]);

  const totaux = useMemo(() => {
    const result = depensesFiltrees.reduce((acc, d) => {
      acc.total += d.montant;
      if (d.statut === 'paye' || d.statut === 'payee') {
        acc.paye += d.montant;
      } else {
        acc.attente += d.montant;
        const datePrevue = parseISO(d.date_prevue);
        if (differenceInDays(new Date(), datePrevue) > 0) {
          acc.enRetard += d.montant;
          acc.nbRetard++;
        }
      }
      return acc;
    }, { total: 0, paye: 0, attente: 0, enRetard: 0, nbRetard: 0 });
    return result;
  }, [depensesFiltrees]);

  const pieData = useMemo(() => {
    const byCategory: Record<string, number> = {};
    depensesFiltrees.forEach(d => {
      const cat = d.categorie_code || 'AUTRE';
      byCategory[cat] = (byCategory[cat] || 0) + d.montant;
    });
    return Object.entries(byCategory).map(([code, value], index) => ({
      name: categoriesMap[code]?.nom || code.replace("DEP_", ""),
      value,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
    }));
  }, [depensesFiltrees, categoriesMap]);

  const formatMontant = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  const isRH = (source: string | null) => source?.startsWith("rh_");

  const getJoursRetard = (datePrevue: string, statut: string | null) => {
    if (statut === 'paye' || statut === 'payee') return null;
    const jours = differenceInDays(new Date(), parseISO(datePrevue));
    return jours > 0 ? jours : null;
  };

  const handleExport = () => {
    const csv = [
      ["Nom", "Date", "Montant", "Catégorie", "Statut", "Source"].join(";"),
      ...depensesFiltrees.map(d => [
        d.nom, d.date_prevue, d.montant, d.categorie_code || "", d.statut || "", d.source || "manuel"
      ].join(";"))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `depenses_previsionnelles_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-muted/50 rounded-lg animate-pulse" />
        <div className="h-64 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{formatMontant(totaux.total)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold text-orange-600">{formatMontant(totaux.attente)}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border-red-500/20", totaux.nbRetard > 0 ? "bg-red-500/10" : "bg-red-500/5")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En retard</p>
                <p className="text-2xl font-bold text-red-600">{formatMontant(totaux.enRetard)}</p>
                {totaux.nbRetard > 0 && (
                  <p className="text-xs text-red-600">{totaux.nbRetard} dépense{totaux.nbRetard > 1 ? 's' : ''}</p>
                )}
              </div>
              <AlertTriangle className={cn("h-8 w-8", totaux.nbRetard > 0 ? "text-red-500 animate-pulse" : "text-red-500/40")} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row justify-between gap-4">
            <div className="flex items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <ArrowDownRight className="h-5 w-5" />
                Dépenses prévisionnelles ({totalItems})
              </CardTitle>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "categories")}>
                <TabsList className="h-8">
                  <TabsTrigger value="list" className="h-7 px-2"><List className="h-4 w-4" /></TabsTrigger>
                  <TabsTrigger value="categories" className="h-7 px-2"><PieChartIcon className="h-4 w-4" /></TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-[180px]" />
              </div>
              <Select value={filtreStatut} onValueChange={setFiltreStatut}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous statuts</SelectItem>
                  <SelectItem value="en_attente">En attente</SelectItem>
                  
                </SelectContent>
              </Select>
              <Select value={filtreCategorie} onValueChange={setFiltreCategorie}>
                <SelectTrigger className="w-[150px]">
                  <Tag className="h-4 w-4 mr-2" /><SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Toutes catégories</SelectItem>
                  {categories?.map(cat => (
                    <SelectItem key={cat.code} value={cat.code}>{cat.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {dateRange.from && dateRange.to ? (
                      <span className="text-xs">
                        {format(dateRange.from, "dd/MM", { locale: fr })} - {format(dateRange.to, "dd/MM", { locale: fr })}
                      </span>
                    ) : "Période"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="range" selected={{ from: dateRange.from, to: dateRange.to }} onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })} locale={fr} numberOfMonths={2} />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" onClick={handleExport} aria-label="Exporter" title="Exporter">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "categories" ? (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatMontant(value)}
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {pieData.map((cat) => (
                  <div key={`cat-${cat.name}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="font-medium">{cat.name}</span>
                    </div>
                    <span className="font-bold">{formatMontant(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <SortableTableHead field="nom" sortConfig={sortConfig} onSort={handleSort}>Description</SortableTableHead>
                      <SortableTableHead field="montant" sortConfig={sortConfig} onSort={handleSort} align="right" className="w-[120px]">Montant</SortableTableHead>
                      <SortableTableHead field="date_prevue" sortConfig={sortConfig} onSort={handleSort} className="w-[130px]">Date</SortableTableHead>
                      <SortableTableHead field="categorie" sortConfig={sortConfig} onSort={handleSort} className="w-[280px]">Catégorie</SortableTableHead>
                      <SortableTableHead field="statut" sortConfig={sortConfig} onSort={handleSort} className="w-[120px]">Statut</SortableTableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDepenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <TrendingDown className="h-8 w-8" />
                            <p>Aucune dépense trouvée</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedDepenses.map((depense) => {
                        const joursRetard = getJoursRetard(depense.date_prevue, depense.statut);
                        const isRHSource = isRH(depense.source);
                        return (
                          <TableRow key={depense.id} className={cn("group hover:bg-muted/30 h-8", joursRetard && "bg-red-50/50 dark:bg-red-950/20")}>
                            <TableCell className="py-1">
                              <div className="flex items-center gap-2">
                                {isRHSource && (
                                  <Badge variant="outline" className="text-xs gap-1"><Users className="h-3 w-3" />RH</Badge>
                                )}
                                <span className="font-medium truncate max-w-[250px]">{depense.nom}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-1">
                              <EditableCell
                                value={depense.montant}
                                onSave={(val) => updateDepense({ id: depense.id, updates: { montant: Number(val) } })}
                                type="currency"
                                formatDisplay={(v) => formatMontant(Number(v))}
                                disabled={isRHSource}
                                className="font-bold justify-end"
                              />
                            </TableCell>
                            <TableCell className="text-muted-foreground py-1">
                              <div>
                                {format(parseISO(depense.date_prevue), "d MMM yyyy", { locale: fr })}
                                {joursRetard && <p className="text-xs text-destructive">+{joursRetard}j retard</p>}
                              </div>
                            </TableCell>
                            <TableCell className="py-1 w-[260px]">
                              <CategorySelect
                                value={depense.categorie_code || null}
                                onSelect={(code) => updateDepense({ id: depense.id, updates: { categorie_code: code } })}
                                categories={categories || []}
                                disabled={isRHSource}
                              />
                            </TableCell>
                            <TableCell className="py-1">
                              <EditableCell
                                value={depense.statut || "en_attente"}
                                onSave={(val) => updateDepense({ id: depense.id, updates: { statut: String(val) } })}
                                type="select"
                                options={STATUT_OPTIONS}
                                disabled={isRHSource}
                                formatDisplay={(v) => {
                                  const cfg = STATUT_CONFIG[String(v)] || { label: v };
                                  return cfg.label;
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right py-1">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {depense.statut === "en_attente" && (
                                  <Button size="sm" variant="default" onClick={() => marquerPayee(depense.id)} disabled={isUpdating} className="h-8">
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" />Payé
                                  </Button>
                                )}
                                {!isRHSource && (
                                  <Button size="sm" variant="ghost" onClick={() => deleteDepense(depense.id)} disabled={isDeleting} className="h-8 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <TresoreriePagination
                currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize}
                onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
