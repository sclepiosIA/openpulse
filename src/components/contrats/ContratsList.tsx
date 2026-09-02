import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/shared/useDebounce";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Plus, MoreHorizontal, Eye, Pencil, FileSignature, History, Trash2, Building2, FileEdit, Download, Tag, X } from "lucide-react";
import { useContrats, useDeleteContrat, useUpdateContrat } from "@/hooks/contracts/useContrats";
import { CONTRAT_STATUT_LABELS, CONTRAT_STATUT_COLORS, CONTRAT_TYPE_LABELS, ContratStatut, ContratType, Contrat } from "@/types/contrats";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface ContratsListProps {
  onCreateNew: () => void;
  onEdit?: (contrat: Contrat) => void;
  search?: string;
  onSearchChange?: (v: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

export default function ContratsList({ onCreateNew, onEdit, search: searchProp, onSearchChange, searchInputRef }: ContratsListProps) {
  const navigate = useNavigate();
  const [searchLocal, setSearchLocal] = useState("");
  const search = searchProp !== undefined ? searchProp : searchLocal;
  const setSearch = (v: string) => (onSearchChange ? onSearchChange(v) : setSearchLocal(v));
  const [statutFilter, setStatutFilter] = useState<ContratStatut | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ContratType | "all">("all");
  const [contratToDelete, setContratToDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 300);
  const { data: contrats, isLoading } = useContrats({
    search: debouncedSearch || undefined,
    statut: statutFilter !== "all" ? statutFilter : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
  });

  const { mutate: deleteContrat, isPending: isDeleting } = useDeleteContrat();
  const { mutateAsync: updateContrat } = useUpdateContrat();

  const allSelected = useMemo(
    () => !!contrats?.length && contrats.every((c) => selectedIds.has(c.id)),
    [contrats, selectedIds]
  );

  const toggleAll = () => {
    if (!contrats) return;
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(contrats.map((c) => c.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleDelete = () => {
    if (contratToDelete) {
      deleteContrat(contratToDelete);
      setContratToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    let ok = 0;
    for (const id of ids) {
      try {
        await new Promise<void>((resolve, reject) =>
          deleteContrat(id, { onSuccess: () => resolve(), onError: (e) => reject(e) })
        );
        ok++;
      } catch (e) {
        // continue
      }
    }
    toast.success(`${ok}/${ids.length} contrat(s) supprimé(s)`);
    clearSelection();
    setBulkDeleteOpen(false);
  };

  const handleBulkChangeStatut = async (statut: ContratStatut) => {
    const ids = Array.from(selectedIds);
    let ok = 0;
    for (const id of ids) {
      try {
        await updateContrat({ id, statut });
        ok++;
      } catch (e) {
        // continue
      }
    }
    toast.success(`${ok}/${ids.length} contrat(s) mis à jour`);
    clearSelection();
  };

  const handleExportCSV = () => {
    if (!contrats) return;
    const rows = contrats.filter((c) => selectedIds.has(c.id));
    if (!rows.length) return;
    const headers = ["Numéro", "Titre", "Client", "Type", "Statut", "Montant annuel HT", "Date début", "Date fin"];
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map((c) =>
        [
          c.numero,
          c.titre,
          c.client_nom,
          CONTRAT_TYPE_LABELS[c.type],
          CONTRAT_STATUT_LABELS[c.statut],
          c.montant_annuel_ht,
          c.date_debut,
          c.date_fin,
        ]
          .map(escape)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contrats_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} contrat(s) exporté(s)`);
  };

  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Liste des contrats</CardTitle>
        
        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Rechercher par numéro, titre, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statutFilter} onValueChange={(v) => setStatutFilter(v as ContratStatut | "all")}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(CONTRAT_STATUT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ContratType | "all")}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {Object.entries(CONTRAT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium">{selectedIds.size} sélectionné(s)</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" /> Exporter CSV
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Tag className="h-4 w-4 mr-2" /> Changer statut
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {Object.entries(CONTRAT_STATUT_LABELS).map(([value, label]) => (
                    <DropdownMenuItem key={value} onClick={() => handleBulkChangeStatut(value as ContratStatut)}>
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Supprimer
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection} aria-label="Annuler la sélection">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={`contrats-list-skeleton-${i}`} className="h-16 w-full" />
            ))}
          </div>
        ) : contrats && contrats.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Tout sélectionner"
                    />
                  </TableHead>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Montant annuel</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contrats.map((contrat) => (
                  <TableRow
                    key={contrat.id}
                    data-state={selectedIds.has(contrat.id) ? "selected" : undefined}
                    className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => navigate(`/contrats/${contrat.id}`)}
                    role="link"
                    tabIndex={0}
                    aria-label={`Ouvrir le contrat ${contrat.numero || contrat.titre}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/contrats/${contrat.id}`);
                      }
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(contrat.id)}
                        onCheckedChange={() => toggleOne(contrat.id)}
                        aria-label={`Sélectionner ${contrat.numero || contrat.titre}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{contrat.numero || '-'}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{contrat.titre}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {contrat.etablissement && (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{contrat.client_nom}</p>
                          {contrat.etablissement && (
                            <p className="text-xs text-muted-foreground">{contrat.etablissement.ville}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {CONTRAT_TYPE_LABELS[contrat.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatMontant(contrat.montant_annuel_ht)}
                    </TableCell>
                    <TableCell>
                      {contrat.date_fin ? (
                        <span className="text-sm">
                          {format(new Date(contrat.date_fin), 'dd/MM/yyyy', { locale: fr })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={CONTRAT_STATUT_COLORS[contrat.statut]}>
                        {CONTRAT_STATUT_LABELS[contrat.statut]}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Actions du contrat">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/contrats/${contrat.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Voir détails
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/contrats/builder/${contrat.id}`)}>
                            <FileEdit className="h-4 w-4 mr-2" />
                            Ouvrir dans le Builder
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit?.(contrat)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/contrats/${contrat.id}?tab=avenants`)}>
                            <History className="h-4 w-4 mr-2" />
                            Avenants
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/contrats/${contrat.id}?tab=signature`)}>
                            <FileSignature className="h-4 w-4 mr-2" />
                            Signature électronique
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => setContratToDelete(contrat.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileSignature className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Aucun contrat trouvé</p>
            <p className="text-sm text-muted-foreground mb-4">
              Créez votre premier contrat pour commencer
            </p>
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau contrat
            </Button>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!contratToDelete}
        onOpenChange={(open) => !open && setContratToDelete(null)}
        title="Supprimer ce contrat ?"
        description="Cette action est irréversible. Le contrat et tous ses avenants seront supprimés."
        onConfirm={handleDelete}
        loading={isDeleting}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Supprimer ${selectedIds.size} contrat(s) ?`}
        description="Cette action est irréversible. Les contrats sélectionnés et leurs avenants seront supprimés."
        onConfirm={handleBulkDelete}
        loading={isDeleting}
      />
    </Card>
  );
}
