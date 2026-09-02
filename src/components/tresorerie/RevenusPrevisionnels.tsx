import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTresorerieRevenus } from "@/hooks/tresorerie/useTresorerieRevenus";
import { SortableTableHead, useSortConfig } from "./SortableTableHead";
import { TresoreriePagination } from "./TresoreriePagination";
import { EditableCell } from "./EditableCell";
import { CreateRevenuDialog } from "./CreateRevenuDialog";
import {
  FileText,
  Search,
  TrendingUp,
  Plus,
  Download,
  Filter,
  Clock,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUT_CONFIG: Record<string, { label: string; bgClass: string }> = {
  contractualise: { label: "Contractualisé", bgClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200" },
  a_facturer: { label: "À facturer", bgClass: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200" },
  facture: { label: "Facturé", bgClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200" },
  paye: { label: "Payé", bgClass: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200" },
};

const STATUT_OPTIONS = [
  { value: "contractualise", label: "Contractualisé" },
  { value: "a_facturer", label: "À facturer" },
  { value: "facture", label: "Facturé" },
];

export function RevenusPrevisionnels() {
  const { revenus, isLoading, createRevenu, updateRevenu, marquerFacture, marquerPaye, isCreating, isUpdating } = useTresorerieRevenus();
  const [search, setSearch] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showCreate, setShowCreate] = useState(false);
  const { sortConfig, handleSort } = useSortConfig("mois", "desc");

  const revenusFiltres = useMemo(() => {
    let filtered = revenus.filter((r) => {
      // Exclure les revenus payés du prévisionnel
      if (r.statut === 'paye') return false;
      const matchSearch = !search ||
        r.etablissements?.nom?.toLowerCase().includes(search.toLowerCase()) ||
        r.numero_facture?.toLowerCase().includes(search.toLowerCase()) ||
        r.notes?.toLowerCase().includes(search.toLowerCase());
      const matchStatut = filtreStatut === "tous" || r.statut === filtreStatut;
      return matchSearch && matchStatut;
    });

    if (sortConfig.field && sortConfig.direction) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number | null = null;
        let bVal: string | number | null = null;
        switch (sortConfig.field) {
          case "mois": aVal = a.mois; bVal = b.mois; break;
          case "montant": aVal = a.montant_prevu || 0; bVal = b.montant_prevu || 0; break;
          case "etablissement": aVal = a.etablissements?.nom || ""; bVal = b.etablissements?.nom || ""; break;
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
  }, [revenus, search, filtreStatut, sortConfig]);

  const totalItems = revenusFiltres.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedRevenus = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return revenusFiltres.slice(start, start + pageSize);
  }, [revenusFiltres, currentPage, pageSize]);

  useMemo(() => { setCurrentPage(1); }, [search, filtreStatut, sortConfig]);

  const totaux = useMemo(() => {
    const totalPrevu = revenusFiltres.reduce((acc, r) => acc + (r.montant_prevu || 0), 0);
    const totalPaye = revenusFiltres.reduce((acc, r) => acc + (r.montant_paye || 0), 0);
    const nbAFacturer = revenusFiltres.filter(r => r.statut === "a_facturer" || r.statut === "contractualise").length;
    return { totalPrevu, totalPaye, nbAFacturer };
  }, [revenusFiltres]);

  const formatMontant = (value: number | null) =>
    value ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) : "-";

  const handleExport = () => {
    const csv = [
      ["Mois", "Établissement", "Montant prévu", "Montant payé", "Statut", "Type", "N° facture"].join(";"),
      ...revenusFiltres.map(r => [
        r.mois, r.etablissements?.nom || "", r.montant_prevu || 0, r.montant_paye || 0,
        STATUT_CONFIG[r.statut || ""]?.label || r.statut, r.type_revenu || "", r.numero_facture || ""
      ].join(";"))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `revenus_previsionnels_${format(new Date(), "yyyy-MM-dd")}.csv`;
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total prévu</p>
                <p className="text-2xl font-bold">{formatMontant(totaux.totalPrevu)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">À facturer</p>
                <p className="text-2xl font-bold text-orange-600">{totaux.nbAFacturer}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Revenus prévisionnels ({totalItems})
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-[180px]" />
              </div>
              <Select value={filtreStatut} onValueChange={setFiltreStatut}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous statuts</SelectItem>
                  {STATUT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleExport} aria-label="Exporter" title="Exporter">
                <Download className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" />Ajouter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <SortableTableHead field="etablissement" sortConfig={sortConfig} onSort={handleSort} className="min-w-[180px]">Établissement</SortableTableHead>
                  <SortableTableHead field="mois" sortConfig={sortConfig} onSort={handleSort} className="w-[120px]">Mois</SortableTableHead>
                  <SortableTableHead field="montant" sortConfig={sortConfig} onSort={handleSort} align="right" className="w-[130px]">Montant prévu</SortableTableHead>
                  <TableHead className="text-right w-[130px]">Montant payé</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <SortableTableHead field="statut" sortConfig={sortConfig} onSort={handleSort} className="w-[140px]">Statut</SortableTableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRevenus.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileText className="h-8 w-8" />
                        <p>Aucun revenu prévisionnel trouvé</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRevenus.map((rev) => {
                    const config = STATUT_CONFIG[rev.statut || ""] || { label: rev.statut, bgClass: "bg-muted" };
                    return (
                      <TableRow key={rev.id} className="group hover:bg-muted/30 h-8">
                        <TableCell className="py-1">
                          <span className="font-medium text-sm truncate block">{rev.etablissements?.nom || "-"}</span>
                        </TableCell>
                        <TableCell className="py-1 text-sm text-muted-foreground">
                          {rev.mois}
                        </TableCell>
                        <TableCell className="text-right py-1">
                          <EditableCell
                            value={rev.montant_prevu}
                            onSave={(val) => updateRevenu({ id: rev.id, updates: { montant_prevu: Number(val) } })}
                            type="currency"
                            formatDisplay={(v) => formatMontant(Number(v))}
                            className="font-bold justify-end"
                          />
                        </TableCell>
                        <TableCell className="text-right py-1 text-sm">
                          {formatMontant(rev.montant_paye)}
                        </TableCell>
                        <TableCell className="py-1">
                          <Badge variant="outline" className="text-xs">{rev.type_revenu || "-"}</Badge>
                        </TableCell>
                        <TableCell className="py-1">
                          <EditableCell
                            value={rev.statut || "contractualise"}
                            onSave={(val) => updateRevenu({ id: rev.id, updates: { statut: String(val) } })}
                            type="select"
                            options={STATUT_OPTIONS}
                            formatDisplay={(v) => STATUT_CONFIG[String(v)]?.label || String(v)}
                          />
                        </TableCell>
                        <TableCell className="py-1">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {rev.statut === "contractualise" && (
                              <Button size="sm" variant="outline" onClick={() => marquerFacture(rev.id)} disabled={isUpdating} className="h-7 text-xs">
                                Facturer
                              </Button>
                            )}
                            {rev.statut === "facture" && (
                              <Button size="sm" variant="default" onClick={() => marquerPaye(rev.id, rev.montant_prevu || undefined)} disabled={isUpdating} className="h-7 text-xs">
                                Payé
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
        </CardContent>
      </Card>

      <CreateRevenuDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSubmit={createRevenu}
        isCreating={isCreating}
      />
    </div>
  );
}
