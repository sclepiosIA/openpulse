import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Save } from "lucide-react";
import { useTresorerieDepenses, type Depense } from "@/hooks/tresorerie/useTresorerieDepenses";
import { useToast } from "@/hooks/shared/use-toast";
import { format } from "date-fns";

interface EditDepenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depense: Depense | null;
  allDepenses: Depense[];
}

const CATEGORIES = [
  { value: "loyer", label: "Loyer & Charges" },
  { value: "salaires", label: "Salaires & Charges" },
  { value: "logiciels", label: "Logiciels & SaaS" },
  { value: "marketing", label: "Marketing & Pub" },
  { value: "fournitures", label: "Fournitures" },
  { value: "deplacements", label: "Déplacements" },
  { value: "telecom", label: "Télécom & Internet" },
  { value: "assurances", label: "Assurances" },
  { value: "impots", label: "Impôts & Taxes" },
  { value: "divers", label: "Divers" },
];

/**
 * Extrait le nom de base d'une dépense en retirant le suffixe de date
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

export function EditDepenseDialog({
  open,
  onOpenChange,
  depense,
  allDepenses,
}: EditDepenseDialogProps) {
  const { toast } = useToast();
  const { updateDepense, isUpdating } = useTresorerieDepenses();

  // Form state
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [datePrevue, setDatePrevue] = useState("");
  const [categorie, setCategorie] = useState("");
  const [notes, setNotes] = useState("");
  const [applyMontantToAll, setApplyMontantToAll] = useState(false);

  // Groupe de récurrence
  const recurrenceGroup = useMemo(() => {
    if (!depense) return [];
    return findRecurrenceGroup(depense, allDepenses);
  }, [depense, allDepenses]);

  const isRecurrent = recurrenceGroup.length > 1;

  // Dépenses futures pour mise à jour groupée
  const futureGroupItems = useMemo(() => {
    if (!depense) return [];
    const today = new Date().toISOString().split("T")[0];
    return recurrenceGroup.filter(
      (d) => d.date_prevue >= today || d.date_prevue === "1900-01-01"
    );
  }, [depense, recurrenceGroup]);

  // Initialize form when depense changes
  useEffect(() => {
    if (depense) {
      setLibelle(depense.nom || "");
      setMontant(depense.montant?.toString() || "");
      setDatePrevue(
        depense.date_prevue && depense.date_prevue !== "1900-01-01"
          ? depense.date_prevue
          : format(new Date(), "yyyy-MM-dd")
      );
      setCategorie(depense.categorie_code || "");
      setNotes(depense.notes || "");
      setApplyMontantToAll(false);
    }
  }, [depense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depense) return;

    const montantValue = parseFloat(montant) || 0;
    if (montantValue <= 0) {
      toast({
        title: "Erreur",
        description: "Le montant doit être supérieur à 0",
        variant: "destructive",
      });
      return;
    }

    try {
      // Mettre à jour la dépense actuelle
      await new Promise<void>((resolve, reject) => {
        updateDepense(
          {
            id: depense.id,
            updates: {
              nom: libelle,
              montant: montantValue,
              date_prevue: datePrevue,
              categorie_code: categorie || null,
              notes: notes || null,
            },
          },
          { onSuccess: () => resolve(), onError: reject }
        );
      });

      // Si option cochée, mettre à jour le montant des autres occurrences
      if (applyMontantToAll && futureGroupItems.length > 1) {
        const otherItems = futureGroupItems.filter((d) => d.id !== depense.id);
        for (const item of otherItems) {
          await new Promise<void>((resolve, reject) => {
            updateDepense(
              { id: item.id, updates: { montant: montantValue } },
              { onSuccess: () => resolve(), onError: reject }
            );
          });
        }
      }

      toast({
        title: "Dépense mise à jour",
        description:
          applyMontantToAll && futureGroupItems.length > 1
            ? `${futureGroupItems.length} dépenses mises à jour`
            : "La dépense a été modifiée",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la dépense",
        variant: "destructive",
      });
    }
  };

  if (!depense) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier la dépense</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Libellé */}
          <div className="space-y-2">
            <Label htmlFor="libelle">Libellé *</Label>
            <Input
              id="libelle"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Ex: Abonnement Cloud"
              required
            />
          </div>

          {/* Montant */}
          <div className="space-y-2">
            <Label htmlFor="montant">Montant (€) *</Label>
            <Input
              id="montant"
              type="number"
              step="0.01"
              min="0"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="99.00"
              required
            />
          </div>

          {/* Date prévue */}
          <div className="space-y-2">
            <Label htmlFor="date">Date prévue</Label>
            <Input
              id="date"
              type="date"
              value={datePrevue}
              onChange={(e) => setDatePrevue(e.target.value)}
            />
          </div>

          {/* Catégorie */}
          <div className="space-y-2">
            <Label htmlFor="categorie">Catégorie</Label>
            <Select value={categorie} onValueChange={setCategorie}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes optionnelles..."
              rows={2}
            />
          </div>

          {/* Option récurrence */}
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
                  id="apply-montant"
                  checked={applyMontantToAll}
                  onCheckedChange={(checked) => setApplyMontantToAll(!!checked)}
                />
                <label htmlFor="apply-montant" className="text-sm cursor-pointer">
                  Appliquer le nouveau montant à toutes les occurrences futures ({futureGroupItems.length})
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isUpdating}>
              <Save className="h-4 w-4 mr-2" />
              {isUpdating ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
