import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useQontoCredits } from "@/hooks/tresorerie/useQontoCredits";
import { SortableTableHead, useSortConfig } from "./SortableTableHead";
import { TresoreriePagination } from "./TresoreriePagination";
import { CategorySelect } from "./CategorySelect";
import { LinkToForecastRevenue } from "./LinkToForecastRevenue";
import {
  FileText,
  Search,
  TrendingUp,
  Calendar as CalendarIcon,
  ArrowUpRight,
  Download,
  Hash,
} from "lucide-react";
import { format, parseISO, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function RevenusRealises() {
  const { credits, isLoading, forecastRevenus, linkToForecast, unlinkForecast, updateCategorie, isLinking } = useQontoCredits();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { sortConfig, handleSort } = useSortConfig("date", "desc");
  
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["tresorerie-categories-recette"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tresorerie_categories")
        .select("id, code, nom, parent_id, niveau, type")
        .eq("type", "recette")
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

  const creditsFiltres = useMemo(() => {
    let filtered = credits.filter((c) => {
      const matchSearch = !search || 
        c.libelle?.toLowerCase().includes(search.toLowerCase()) ||
        getCategorieLabel(c.categorie_code).toLowerCase().includes(search.toLowerCase()) ||
        c.recette_previsionnelle?.etablissement_nom?.toLowerCase().includes(search.toLowerCase());
      
      let matchDate = true;
      if (dateRange.from && dateRange.to) {
        const dateObj = parseISO(c.date_operation);
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
          case "montant": aVal = a.montant || 0; bVal = b.montant || 0; break;
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
  }, [credits, search, dateRange, sortConfig, categorieOptions]);

  const totalItems = creditsFiltres.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedCredits = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return creditsFiltres.slice(start, start + pageSize);
  }, [creditsFiltres, currentPage, pageSize]);

  useMemo(() => { setCurrentPage(1); }, [search, dateRange, sortConfig]);

  const totaux = useMemo(() => {
    const now = new Date();
    const currentMonth = format(now, "yyyy-MM");
    const totalRecus = creditsFiltres.reduce((acc, c) => acc + (c.montant || 0), 0);
    const totalMoisEnCours = creditsFiltres
      .filter(c => c.date_operation.startsWith(currentMonth))
      .reduce((acc, c) => acc + (c.montant || 0), 0);
    return { total: totalRecus, count: creditsFiltres.length, moisEnCours: totalMoisEnCours };
  }, [creditsFiltres]);

  const formatMontant = (value: number | null) =>
    value ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) : "-";

  const handleExport = () => {
    const csv = [
      ["Date", "Libellé", "Montant", "Catégorie", "Recette liée"].join(";"),
      ...creditsFiltres.map(c => [
        format(parseISO(c.date_operation), "dd/MM/yyyy"),
        c.libelle,
        c.montant || 0,
        getCategorieLabel(c.categorie_code),
        c.recette_previsionnelle?.etablissement_nom || ""
      ].join(";"))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `revenus_realises_${format(new Date(), "yyyy-MM-dd")}.csv`;
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
                <p className="text-sm font-medium text-muted-foreground">Total virements reçus</p>
                <p className="text-2xl font-bold">{formatMontant(totaux.total)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-secondary/5 border-secondary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nombre de virements</p>
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
              <ArrowUpRight className="h-5 w-5" />
              Virements reçus ({totalItems})
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
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[200px]">Libellé</TableHead>
                  <SortableTableHead field="montant" sortConfig={sortConfig} onSort={handleSort} align="right" className="w-[120px]">Montant</SortableTableHead>
                  <SortableTableHead field="date" sortConfig={sortConfig} onSort={handleSort} className="w-[120px]">Date</SortableTableHead>
                  <SortableTableHead field="categorie" sortConfig={sortConfig} onSort={handleSort} className="min-w-[320px]">Catégorie</SortableTableHead>
                  <TableHead className="w-[240px]">Recette prévisionnelle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCredits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileText className="h-8 w-8" />
                        <p>Aucun virement trouvé</p>
                        <p className="text-xs">Modifiez vos filtres ou la période</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCredits.map((credit) => (
                    <TableRow key={credit.id} className="group hover:bg-muted/30 h-8">
                      <TableCell className="py-1">
                        <span className="text-sm truncate block" title={credit.libelle}>{credit.libelle || "-"}</span>
                      </TableCell>
                      <TableCell className="text-right py-1">
                        <span className="font-bold text-sm">{formatMontant(credit.montant)}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground py-1 text-sm">
                        {format(parseISO(credit.date_operation), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="py-1 min-w-[320px]">
                        <CategorySelect
                          value={credit.categorie_code || null}
                          onSelect={(code) => updateCategorie({ id: credit.id, categorie_code: code })}
                          categories={categories}
                          placeholder="Non catégorisé"
                        />
                      </TableCell>
                      <TableCell className="py-1">
                        <LinkToForecastRevenue
                          credit={credit}
                          forecastRevenus={forecastRevenus}
                          onLink={(opId, recId) => linkToForecast({ operationId: opId, recetteId: recId })}
                          onUnlink={(opId, recId) => unlinkForecast({ operationId: opId, recetteId: recId })}
                          isLinking={isLinking}
                        />
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
