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
import { Download, Search, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { QontoClientInvoice } from "@/hooks/tresorerie/useQontoClientInvoices";

interface QontoAEncaisserDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: QontoClientInvoice[];
  totalAEncaisser: number;
  isLoading?: boolean;
}

export function QontoAEncaisserDetailDialog({
  open,
  onOpenChange,
  invoices,
  totalAEncaisser,
  isLoading,
}: QontoAEncaisserDetailDialogProps) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { sortConfig, handleSort } = useSortConfig("date_echeance", "asc");

  const formatMontant = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  // Filtrage par recherche
  const filteredInvoices = useMemo(() => {
    if (!search.trim()) return invoices;
    const searchLower = search.toLowerCase();
    return invoices.filter((inv) => {
      const client = inv.client_name?.toLowerCase() || "";
      const numero = inv.numero?.toLowerCase() || "";
      return client.includes(searchLower) || numero.includes(searchLower);
    });
  }, [invoices, search]);

  // Calcul des jours de retard
  const getJoursRetard = (dateEcheance: string | null): number | null => {
    if (!dateEcheance) return null;
    const jours = differenceInDays(new Date(), parseISO(dateEcheance));
    return jours > 0 ? jours : null;
  };

  // Tri
  const sortedInvoices = useMemo(() => {
    if (!sortConfig.field || !sortConfig.direction) return filteredInvoices;

    return [...filteredInvoices].sort((a, b) => {
      let comparison = 0;

      switch (sortConfig.field) {
        case "client":
          comparison = (a.client_name || "").localeCompare(b.client_name || "");
          break;
        case "numero":
          comparison = (a.numero || "").localeCompare(b.numero || "");
          break;
        case "date_echeance":
          comparison = (a.date_echeance || "9999").localeCompare(b.date_echeance || "9999");
          break;
        case "montant":
          comparison = (a.montant_ttc || 0) - (b.montant_ttc || 0);
          break;
        case "retard":
          const retardA = getJoursRetard(a.date_echeance) || 0;
          const retardB = getJoursRetard(b.date_echeance) || 0;
          comparison = retardA - retardB;
          break;
        default:
          comparison = 0;
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredInvoices, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(sortedInvoices.length / pageSize);
  const paginatedInvoices = sortedInvoices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Export CSV
  const exportCSV = () => {
    const headers = ["N° Facture", "Client", "Montant TTC", "Date émission", "Date échéance", "Jours retard"];
    const rows = sortedInvoices.map((inv) => [
      inv.numero || "",
      inv.client_name || "Client inconnu",
      inv.montant_ttc || 0,
      inv.date_emission ? format(parseISO(inv.date_emission), "dd/MM/yyyy", { locale: fr }) : "",
      inv.date_echeance ? format(parseISO(inv.date_echeance), "dd/MM/yyyy", { locale: fr }) : "",
      getJoursRetard(inv.date_echeance) || "",
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.join(";")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `factures-qonto-a-encaisser-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-orange-500/10 ring-1 ring-orange-500/20">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            Factures Qonto à encaisser
          </DialogTitle>
          <DialogDescription>
            Factures clients émises et en attente de paiement (source: Qonto)
          </DialogDescription>
        </DialogHeader>

        {/* Total + Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 border-b">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Total :</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-orange-600/70 bg-clip-text text-transparent">
              {formatMontant(totalAEncaisser)}
            </span>
            <Badge variant="outline" className="ml-2">
              {filteredInvoices.length} facture{filteredInvoices.length > 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher client ou n° facture..."
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
              disabled={sortedInvoices.length === 0}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Chargement des factures Qonto...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <SortableTableHead
                    field="numero"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  >
                    N° Facture
                  </SortableTableHead>
                  <SortableTableHead
                    field="client"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  >
                    Client
                  </SortableTableHead>
                  <SortableTableHead
                    field="montant"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    align="right"
                  >
                    Montant TTC
                  </SortableTableHead>
                  <TableHead>Émise le</TableHead>
                  <SortableTableHead
                    field="date_echeance"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  >
                    Échéance
                  </SortableTableHead>
                  <SortableTableHead
                    field="retard"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    align="center"
                  >
                    Retard
                  </SortableTableHead>
                  <TableHead className="text-center">Lien</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucune facture à encaisser dans Qonto
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedInvoices.map((invoice) => {
                    const joursRetard = getJoursRetard(invoice.date_echeance);
                    const isEnRetard = joursRetard !== null && joursRetard > 0;

                    return (
                      <TableRow key={invoice.id} className={cn(isEnRetard && "bg-orange-50/50")}>
                        <TableCell className="font-mono text-sm">
                          {invoice.numero || "-"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {invoice.client_name || (
                            <span className="text-muted-foreground italic">Client inconnu</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatMontant(invoice.montant_ttc || 0)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {invoice.date_emission
                            ? format(parseISO(invoice.date_emission), "dd/MM/yyyy", { locale: fr })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {invoice.date_echeance
                            ? format(parseISO(invoice.date_echeance), "dd/MM/yyyy", { locale: fr })
                            : "-"}
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
                        <TableCell className="text-center">
                          {invoice.file_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="h-8 gap-1"
                            >
                              <a href={invoice.file_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {sortedInvoices.length > pageSize && (
          <TresoreriePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sortedInvoices.length}
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
