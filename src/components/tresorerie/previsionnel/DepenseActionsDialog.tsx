import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Pencil, Pause, Trash2, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useTresorerieDepenses, type Depense } from "@/hooks/tresorerie/useTresorerieDepenses";
import { useToast } from "@/hooks/shared/use-toast";

interface DepenseActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depense: Depense | null;
  allDepenses: Depense[];
  onEdit: () => void;
}

/**
 * Extrait le nom de base d'une dépense en retirant le suffixe de date (ex: " (fév. 25)")
 */
function extractBaseName(nom: string): string {
  return nom.replace(/\s*\([a-zéûùàâêîôèë]+\.?\s+\d{2}\)$/i, "").trim();
}

/**
 * Trouve toutes les dépenses du même groupe récurrent
 */
function findRecurrenceGroup(
  depense: Depense,
  allDepenses: Depense[]
): Depense[] {
  const baseName = extractBaseName(depense.nom);
  return allDepenses.filter(
    (d) =>
      d.source === "manuel_previsionnel" &&
      extractBaseName(d.nom) === baseName
  );
}

export function DepenseActionsDialog({
  open,
  onOpenChange,
  depense,
  allDepenses,
  onEdit,
}: DepenseActionsDialogProps) {
  const { toast } = useToast();
  const { updateDepense, deleteDepense, isUpdating, isDeleting } = useTresorerieDepenses();
  
  const [applyToAll, setApplyToAll] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Groupe de récurrence
  const recurrenceGroup = useMemo(() => {
    if (!depense) return [];
    return findRecurrenceGroup(depense, allDepenses);
  }, [depense, allDepenses]);

  const isRecurrent = recurrenceGroup.length > 1;

  // Dépenses futures seulement pour les actions groupées
  const futureGroupItems = useMemo(() => {
    if (!depense) return [];
    const today = new Date().toISOString().split("T")[0];
    return recurrenceGroup.filter(
      (d) => d.date_prevue >= today || d.date_prevue === "1900-01-01"
    );
  }, [depense, recurrenceGroup]);

  const handleSuspend = async () => {
    if (!depense) return;

    const itemsToSuspend = applyToAll ? futureGroupItems : [depense];
    
    try {
      for (const item of itemsToSuspend) {
        await new Promise<void>((resolve, reject) => {
          updateDepense(
            { id: item.id, updates: { date_prevue: "1900-01-01" } },
            { onSuccess: () => resolve(), onError: reject }
          );
        });
      }
      
      toast({
        title: "Dépense(s) suspendue(s)",
        description: `${itemsToSuspend.length} dépense(s) déplacée(s) vers "À payer plus tard"`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de suspendre la dépense",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!depense) return;

    const itemsToDelete = applyToAll ? futureGroupItems : [depense];
    
    try {
      for (const item of itemsToDelete) {
        await new Promise<void>((resolve, reject) => {
          deleteDepense(item.id, { onSuccess: () => resolve(), onError: reject });
        });
      }
      
      toast({
        title: "Dépense(s) supprimée(s)",
        description: `${itemsToDelete.length} dépense(s) supprimée(s)`,
      });
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la dépense",
        variant: "destructive",
      });
    }
  };

  const handleModify = () => {
    onEdit();
  };

  if (!depense) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="truncate">{depense.nom}</span>
              <span className="text-destructive font-semibold shrink-0">
                -{formatCurrency(depense.montant)}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Bouton Modifier */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3"
              onClick={handleModify}
            >
              <Pencil className="h-4 w-4 mr-3 text-blue-600" />
              <div className="text-left">
                <div className="font-medium">Modifier</div>
                <div className="text-xs text-muted-foreground">
                  Changer le libellé, montant ou date
                </div>
              </div>
            </Button>

            {/* Bouton Suspendre */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3"
              onClick={handleSuspend}
              disabled={isUpdating}
            >
              <Pause className="h-4 w-4 mr-3 text-orange-600" />
              <div className="text-left">
                <div className="font-medium">Suspendre</div>
                <div className="text-xs text-muted-foreground">
                  Déplacer vers "À payer plus tard"
                </div>
              </div>
            </Button>

            {/* Bouton Supprimer */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3 border-destructive/30 hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-3 text-destructive" />
              <div className="text-left">
                <div className="font-medium text-destructive">Supprimer</div>
                <div className="text-xs text-muted-foreground">
                  Retirer cette dépense
                </div>
              </div>
            </Button>

            {/* Récurrence détectée */}
            {isRecurrent && (
              <div className="pt-3 border-t space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                  Cette dépense fait partie d'une récurrence
                  <Badge variant="secondary" className="text-xs">
                    {recurrenceGroup.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="apply-to-all"
                    checked={applyToAll}
                    onCheckedChange={(checked) => setApplyToAll(!!checked)}
                  />
                  <label htmlFor="apply-to-all" className="text-sm cursor-pointer">
                    Appliquer à toutes les occurrences futures ({futureGroupItems.length})
                  </label>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              {applyToAll && futureGroupItems.length > 1 ? (
                <>
                  Vous allez supprimer <strong>{futureGroupItems.length}</strong> dépenses 
                  (toutes les occurrences futures de cette récurrence).
                </>
              ) : (
                <>
                  Vous allez supprimer la dépense "{depense.nom}".
                </>
              )}
              <br />
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
