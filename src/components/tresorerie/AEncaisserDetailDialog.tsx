import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead, useSortConfig } from "./SortableTableHead";
import { TresoreriePagination } from "./TresoreriePagination";
import { Download, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { STATUT_FACTURE_LABELS, STATUT_FACTURE_COLORS } from "@/lib/tresorerie-labels";

interface Revenu {
  id: string;
  mois: string;
  montant_prevu: number | null;
  montant_paye: number | null;
  statut: string | null;
  date_facture: string | null;
  numero_facture: string | null;
  etablissements?: { nom: string } | null;
}

interface AEncaisserDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revenus: Revenu[];
  marquerPaye?: (id: string, montant?: number) => void;
  isUpdating?: boolean;
}

export function AEncaisserDetailDialog({
  open,
  onOpenChange,
  revenus,
  marquerPaye,
  isUpdating,
}: AEncaisserDetailDialogProps) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { sortConfig, handleSort } = useSortConfig("mois", "desc");

  const formatMontant = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  const total = revenus.reduce((sum, r) => sum + (r.montant_prevu || 0), 0);

  // Filtrage par recherche
  const filteredRevenus = useMemo(() => {
    if (!search.trim()) return revenus;
    const searchLower = search.toLowerCase();
    return revenus.filter((r) => {
      const nom = r.etablissements?.nom?.toLowerCase() || "";
      const numero = r.numero_facture?.toLowerCase() || "";
      return nom.includes(searchLower) || numero.includes(searchLower);
    });
  }, [revenus, search]);

  // Calcul des jours de retard
  const getJoursRetard = (dateFacture: string | null): number | null => {
    if (!dateFacture) return null;
    const jours = differenceInDays(new Date(), parseISO(dateFacture));
    return jours > 0 ? jours : null;
  };

  // Tri
  const sortedRevenus = useMemo(() => {
    if (!sortConfig.field || !sortConfig.direction) return filteredRevenus;

    return [...filteredRevenus].sort((a, b) => {
      let comparison = 0;

      switch (sortConfig.field) {
        case "etablissement":
          comparison = (a.etablissements?.nom || "").localeCompare(b.etablissements?.nom || "");
          break;
        case "mois":
          comparison = a.mois.localeCompare(b.mois);
          break;
        case "montant":
          comparison = (a.montant_prevu || 0) - (b.montant_prevu || 0);
          break;
        case "retard":
          const retardA = getJoursRetard(a.date_facture) || 0;
          const retardB = getJoursRetard(b.date_facture) || 0;
          comparison = retardA - retardB;
          break;
        default:
          comparison = 0;
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredRevenus, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(sortedRevenus.length / pageSize);
  const paginatedRevenus = sortedRevenus.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Export CSV
  const exportCSV = () => {
    const headers = ["Établissement", "Mois", "Montant prévu", "N° Facture", "Statut", "Jours retard"];
    const rows = sortedRevenus.map((r) => [
      r.etablissements?.nom || "Non défini",
      format(parseISO(r.mois.length === 7 ? `${r.mois}-01` : r.mois), "MMM yyyy", { locale: fr }),
      r.montant_prevu || 0,
      r.numero_facture || "",
      STATUT_FACTURE_LABELS[r.statut || ""] || r.statut || "",
      getJoursRetard(r.date_facture) || "",
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.join(";")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `factures-a-encaisser-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const formatMois = (mois: string) => {
    try {
      const dateStr = mois.length === 7 ? `${mois}-01` : mois;
      return format(parseISO(dateStr), "MMM yyyy", { locale: fr });
    } catch {
      return mois;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-orange-500/10 ring-1 ring-orange-500/20">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            Factures à encaisser
          </DialogTitle>
          <DialogDescription>
            Détail des revenus en attente de paiement
          </DialogDescription>
        </DialogHeader>

        {/* Total + Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 border-b">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Total :</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-orange-600/70 bg-clip-text text-transparent">
              {formatMontant(total)}
            </span>
            <Badge variant="outline" className="ml-2">
              {filteredRevenus.length} facture{filteredRevenus.length > 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-9 rounded-xl"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              className="rounded-xl gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <SortableTableHead
                  field="etablissement"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                >
                  Établissement
                </SortableTableHead>
                <SortableTableHead
                  field="mois"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                >
                  Mois
                </SortableTableHead>
                <SortableTableHead
                  field="montant"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  align="right"
                >
                  Montant
                </SortableTableHead>
                <TableHead>Statut</TableHead>
                <SortableTableHead
                  field="retard"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  align="center"
                >
                  Retard
                </SortableTableHead>
                {marquerPaye && <TableHead className="text-center">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRevenus.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={marquerPaye ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    Aucune facture à encaisser
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRevenus.map((revenu) => {
                  const joursRetard = getJoursRetard(revenu.date_facture);
                  const isEnRetard = joursRetard !== null && joursRetard > 30;

                  return (
                    <TableRow key={revenu.id} className={cn(isEnRetard && "bg-orange-50/50")}>
                      <TableCell className="font-medium">
                        {revenu.etablissements?.nom || (
                          <span className="text-muted-foreground italic">Non défini</span>
                        )}
                      </TableCell>
                      <TableCell>{formatMois(revenu.mois)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMontant(revenu.montant_prevu || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "text-xs",
                            STATUT_FACTURE_COLORS[revenu.statut || ""] || "bg-gray-100 text-foreground"
                          )}
                        >
                          {STATUT_FACTURE_LABELS[revenu.statut || ""] || revenu.statut || "Non défini"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {joursRetard !== null ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1",
                              isEnRetard
                                ? "text-orange-600 border-orange-500/30 bg-orange-500/5"
                                : "text-muted-foreground"
                            )}
                          >
                            +{joursRetard}j
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {marquerPaye && (
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => marquerPaye(revenu.id, revenu.montant_prevu || 0)}
                            disabled={isUpdating}
                            className="h-8 gap-1 text-success hover:text-success hover:bg-success/10"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Payé</span>
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {sortedRevenus.length > pageSize && (
          <TresoreriePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sortedRevenus.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
