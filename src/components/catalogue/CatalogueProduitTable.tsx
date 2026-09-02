import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil, Copy, Archive, ArchiveRestore, Trash2, GripVertical, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PRODUIT_TYPE_LABELS, RECURRENCE_LABELS, type CatalogueProduit } from "@/types/facturation";
import type { CatalogueStat } from "@/hooks/catalogue/useCatalogueStats";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useState, useEffect } from "react";

interface Props {
  produits: CatalogueProduit[];
  statsMap?: Map<string, CatalogueStat>;
  onEdit: (p: CatalogueProduit) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string, archive: boolean) => void;
  onDelete: (p: CatalogueProduit) => void;
  onReorder?: (orderedIds: string[]) => void;
  reorderEnabled?: boolean;
}

const fmtCur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

function SortableRow({
  produit, stat, onEdit, onDuplicate, onArchive, onDelete, reorderEnabled,
}: {
  produit: CatalogueProduit;
  stat?: CatalogueStat;
  onEdit: (p: CatalogueProduit) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string, archive: boolean) => void;
  onDelete: (p: CatalogueProduit) => void;
  reorderEnabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: produit.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const used = (stat?.nb_devis ?? 0) + (stat?.nb_factures ?? 0);

  return (
    <TableRow ref={setNodeRef} style={style} className={!produit.est_actif ? "opacity-60" : undefined}>
      <TableCell className="w-[32px] p-1">
        {reorderEnabled && (
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
            aria-label="Réorganiser"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </TableCell>
      <TableCell className="font-mono text-sm">{produit.code}</TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{produit.nom}</p>
          {produit.description && (
            <p className="text-xs text-muted-foreground truncate max-w-[260px]">
              {produit.description}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge variant="outline">{PRODUIT_TYPE_LABELS[produit.type]}</Badge>
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
        {produit.categorie || "—"}
      </TableCell>
      <TableCell className="font-medium">{fmtCur(produit.prix_unitaire_ht)}</TableCell>
      <TableCell className="hidden sm:table-cell">{produit.taux_tva}%</TableCell>
      <TableCell className="hidden xl:table-cell text-sm">
        {RECURRENCE_LABELS[produit.recurrence ?? 'none']}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {used > 0
          ? <Badge variant="secondary">{used}×</Badge>
          : <span className="text-xs text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>
        {produit.est_actif
          ? <Check className="h-4 w-4 text-primary" />
          : <X className="h-4 w-4 text-muted-foreground" />}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Plus d'options">
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
      </TableCell>
    </TableRow>
  );
}

export function CatalogueProduitTable({
  produits, statsMap, onEdit, onDuplicate, onArchive, onDelete, onReorder, reorderEnabled = false,
}: Props) {
  // Local order state pour drag & drop instantané
  const [items, setItems] = useState(produits);
  useEffect(() => { setItems(produits); }, [produits]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex(i => i.id === active.id);
    const newIdx = items.findIndex(i => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(items, oldIdx, newIdx);
    setItems(next);
    onReorder?.(next.map(i => i.id));
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[32px]"></TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden lg:table-cell">Catégorie</TableHead>
              <TableHead>Prix HT</TableHead>
              <TableHead className="hidden sm:table-cell">TVA</TableHead>
              <TableHead className="hidden xl:table-cell">Récurrence</TableHead>
              <TableHead className="hidden lg:table-cell">Utilisé</TableHead>
              <TableHead>Actif</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Aucun produit
                </TableCell>
              </TableRow>
            ) : (
              <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {items.map((p) => (
                  <SortableRow
                    key={p.id}
                    produit={p}
                    stat={statsMap?.get(p.id)}
                    onEdit={onEdit}
                    onDuplicate={onDuplicate}
                    onArchive={onArchive}
                    onDelete={onDelete}
                    reorderEnabled={reorderEnabled}
                  />
                ))}
              </SortableContext>
            )}
          </TableBody>
        </Table>
      </DndContext>
    </div>
  );
}
