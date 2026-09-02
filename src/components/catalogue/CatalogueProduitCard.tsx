import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Copy, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { PRODUIT_TYPE_LABELS, RECURRENCE_LABELS, type CatalogueProduit } from "@/types/facturation";
import type { CatalogueStat } from "@/hooks/catalogue/useCatalogueStats";

interface Props {
  produit: CatalogueProduit;
  stat?: CatalogueStat;
  onEdit: (p: CatalogueProduit) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string, archive: boolean) => void;
  onDelete: (p: CatalogueProduit) => void;
}

const fmtCur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

export function CatalogueProduitCard({ produit, stat, onEdit, onDuplicate, onArchive, onDelete }: Props) {
  const used = (stat?.nb_devis ?? 0) + (stat?.nb_factures ?? 0);
  return (
    <Card className={!produit.est_actif ? "opacity-60" : undefined}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-muted-foreground">{produit.code}</p>
            <p className="font-semibold truncate">{produit.nom}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Plus d'options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(produit)}>
                <Pencil className="h-4 w-4 mr-2" /> Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(produit.id)}>
                <Copy className="h-4 w-4 mr-2" /> Dupliquer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchive(produit.id, produit.est_actif)}>
                {produit.est_actif
                  ? <><Archive className="h-4 w-4 mr-2" /> Archiver</>
                  : <><ArchiveRestore className="h-4 w-4 mr-2" /> Réactiver</>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(produit)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {produit.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{produit.description}</p>
        )}

        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{PRODUIT_TYPE_LABELS[produit.type]}</Badge>
          {produit.categorie && <Badge variant="secondary">{produit.categorie}</Badge>}
          {produit.recurrence && produit.recurrence !== 'none' && (
            <Badge variant="outline">{RECURRENCE_LABELS[produit.recurrence]}</Badge>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-base font-semibold">{fmtCur(produit.prix_unitaire_ht)}</p>
            <p className="text-xs text-muted-foreground">/ {produit.unite} · TVA {produit.taux_tva}%</p>
          </div>
          {used > 0 && <Badge variant="secondary">{used} util.</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
