import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useQontoDebits } from "@/hooks/tresorerie/useQontoDebits";
import { SortableTableHead, useSortConfig } from "./SortableTableHead";
import { TresoreriePagination } from "./TresoreriePagination";
import { CategorySelect } from "./CategorySelect";
import {
  FileText,
  Search,
  TrendingDown,
  Calendar as CalendarIcon,
  ArrowDownRight,
  Download,
  Hash,
} from "lucide-react";
import { format, parseISO, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function DepensesRealisees() {
  const { debits, isLoading, updateCategorie } = useQontoDebits();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { sortConfig, handleSort } = useSortConfig("date", "desc");

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["tresorerie-categories-depense"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tresorerie_categories")
        .select("id, code, nom, parent_id, niveau, type")
        .eq("type", "depense")
        .order("nom");
      if (error) throw error;
      return data || [];
    },
  });

  const categorieOptions = useMemo(() => {
    const parents = categories.filter(c => c.niveau === 1);
    const children = categories.filter(c => c.niveau === 2);
    const opts: { value: string; label: string }[] = [];
    for (const parent of parents) {
      const subs = children.filter(c => c.parent_id === parent.id);
      if (subs.length > 0) {
        for (const sub of subs) {
          opts.push({ value: sub.code, label: `${parent.nom} > ${sub.nom}` });
        }
      } else {
        opts.push({ value: parent.code, label: parent.nom });
      }
    }
    const parentIds = parents.map(p => p.id);
    const orphans = children.filter(c => !c.parent_id || !parentIds.includes(c.parent_id));
    for (const o of orphans) {
      opts.push({ value: o.code, label: o.nom });
    }
    return opts;
  }, [categories]);

  const getCategorieLabel = (code: string | null) => {
    if (!code) return "-";
    const opt = categorieOptions.find(o => o.value === code);
    return opt?.label || code;
  };

  const debitsFiltres = useMemo(() => {
    let filtered = debits.filter((d) => {
      const matchSearch = !search ||
        d.libelle?.toLowerCase().includes(search.toLowerCase()) ||
        getCategorieLabel(d.categorie_code).toLowerCase().includes(search.toLowerCase()) ||
        d.depense_liee?.nom?.toLowerCase().includes(search.toLowerCase());

      let matchDate = true;
      if (dateRange.from && dateRange.to) {
        const dateObj = parseISO(d.date_operation);
        matchDate = isWithinInterval(dateObj, { start: dateRange.from, end: dateRange.to });
      }

      return matchSearch && matchDate;
    });

    if (sortConfig.field && sortConfig.direction) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number | null = null;
        let bVal: string | number | null = null;
        switch (sortConfig.field) {
          case "date": aVal = a.date_operation; bVal = b.date_operation; break;
          case "montant": aVal = Math.abs(a.montant || 0); bVal = Math.abs(b.montant || 0); break;
          case "categorie": aVal = getCategorieLabel(a.categorie_code); bVal = getCategorieLabel(b.categorie_code); break;
          default: return 0;
        }
        if (aVal === null || bVal === null) return 0;
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [debits, search, dateRange, sortConfig, categorieOptions]);

  const totalItems = debitsFiltres.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedDebits = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return debitsFiltres.slice(start, start + pageSize);
  }, [debitsFiltres, currentPage, pageSize]);

  useMemo(() => { setCurrentPage(1); }, [search, dateRange, sortConfig]);

  const totaux = useMemo(() => {
    const now = new Date();
    const currentMonth = format(now, "yyyy-MM");
    const totalDebits = debitsFiltres.reduce((acc, d) => acc + Math.abs(d.montant || 0), 0);
    const totalMoisEnCours = debitsFiltres
      .filter(d => d.date_operation.startsWith(currentMonth))
      .reduce((acc, d) => acc + Math.abs(d.montant || 0), 0);
    return { total: totalDebits, count: debitsFiltres.length, moisEnCours: totalMoisEnCours };
  }, [debitsFiltres]);

  const formatMontant = (value: number | null) =>
    value ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Math.abs(value)) : "-";

  const handleExport = () => {
    const csv = [
      ["Date", "Libellé", "Montant", "Catégorie", "Dépense liée"].join(";"),
      ...debitsFiltres.map(d => [
        format(parseISO(d.date_operation), "dd/MM/yyyy"),
        d.libelle,
        Math.abs(d.montant || 0),
        getCategorieLabel(d.categorie_code),
        d.depense_liee?.nom || ""
      ].join(";"))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `depenses_realisees_${format(new Date(), "yyyy-MM-dd")}.csv`;
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
                <p className="text-sm font-medium text-muted-foreground">Total débits</p>
                <p className="text-2xl font-bold">{formatMontant(totaux.total)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-secondary/5 border-secondary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nombre de débits</p>
                <p className="text-2xl font-bold">{totaux.count}</p>
              </div>
              <Hash className="h-8 w-8 text-muted-foreground/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-accent/5 border-accent/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total mois en cours</p>
                <p className="text-2xl font-bold">{formatMontant(totaux.moisEnCours)}</p>
              </div>
              <CalendarIcon className="h-8 w-8 text-muted-foreground/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <ArrowDownRight className="h-5 w-5" />
              Débits Qonto ({totalItems})
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-[200px]" />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {dateRange.from && dateRange.to ? (
                      <span className="text-xs">
                        {format(dateRange.from, "dd MMM", { locale: fr })} - {format(dateRange.to, "dd MMM yy", { locale: fr })}
                      </span>
                    ) : "Période"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="range" selected={{ from: dateRange.from, to: dateRange.to }} onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })} locale={fr} numberOfMonths={2} />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[200px]">Libellé</TableHead>
                  <SortableTableHead field="montant" sortConfig={sortConfig} onSort={handleSort} align="right" className="w-[120px]">Montant</SortableTableHead>
                  <SortableTableHead field="date" sortConfig={sortConfig} onSort={handleSort} className="w-[120px]">Date</SortableTableHead>
                  <SortableTableHead field="categorie" sortConfig={sortConfig} onSort={handleSort} className="w-[260px]">Catégorie</SortableTableHead>
                  <TableHead className="w-[200px]">Dépense liée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDebits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileText className="h-8 w-8" />
                        <p>Aucun débit trouvé</p>
                        <p className="text-xs">Modifiez vos filtres ou la période</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDebits.map((debit) => (
                    <TableRow key={debit.id} className="group hover:bg-muted/30 h-8">
                      <TableCell className="py-1">
                        <span className="text-sm truncate block" title={debit.libelle}>{debit.libelle || "-"}</span>
                      </TableCell>
                      <TableCell className="text-right py-1">
                        <span className="font-bold text-sm text-destructive">{formatMontant(debit.montant)}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground py-1 text-sm">
                        {format(parseISO(debit.date_operation), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="py-1 w-[260px]">
                        <CategorySelect
                          value={debit.categorie_code || null}
                          onSelect={(code) => updateCategorie({ id: debit.id, categorie_code: code })}
                          categories={categories}
                          placeholder="Non catégorisé"
                        />
                      </TableCell>
                      <TableCell className="py-1 text-sm text-muted-foreground">
                        {debit.depense_liee?.nom || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <TresoreriePagination
            currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize}
            onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
