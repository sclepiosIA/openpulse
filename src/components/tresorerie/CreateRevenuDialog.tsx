import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { format, addMonths } from "date-fns";
import { Loader2, Plus } from "lucide-react";
import { CreateRevenuData } from "@/hooks/tresorerie/useTresorerieRevenus";
import { supabase } from "@/integrations/supabase/client";

interface CreateRevenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateRevenuData) => void;
  isCreating: boolean;
}

const TYPE_REVENU_OPTIONS = [
  { value: "abonnement", label: "Abonnement" },
  { value: "licence", label: "Licence" },
  { value: "formation", label: "Formation" },
  { value: "consulting", label: "Consulting" },
  { value: "autre", label: "Autre" },
];

export function CreateRevenuDialog({ open, onOpenChange, onSubmit, isCreating }: CreateRevenuDialogProps) {
  const [etablissementId, setEtablissementId] = useState("");
  const [mois, setMois] = useState(format(new Date(), "yyyy-MM"));
  const [montantPrevu, setMontantPrevu] = useState("");
  const [typeRevenu, setTypeRevenu] = useState("abonnement");
  const [notes, setNotes] = useState("");

  const { data: etablissements } = useQuery({
    queryKey: ["etablissements-for-revenu"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etablissements")
        .select("id, nom")
        .in("statut", ["Contractuel", "Production", "Déploiement", "Formation", "Go-Live"])
        .order("nom");
      if (error) throw error;
      return data || [];
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!etablissementId || !montantPrevu) return;

    onSubmit({
      etablissement_id: etablissementId,
      mois,
      montant_prevu: parseFloat(montantPrevu),
      type_revenu: typeRevenu,
      notes: notes || undefined,
    });

    // Reset form
    setEtablissementId("");
    setMontantPrevu("");
    setTypeRevenu("abonnement");
    setNotes("");
    onOpenChange(false);
  };

  // Generate next 12 months options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = addMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy"),
    };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nouveau revenu
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="etablissement">Établissement *</Label>
            <Select value={etablissementId} onValueChange={setEtablissementId}>
              <SelectTrigger id="etablissement">
                <SelectValue placeholder="Sélectionner un établissement" />
              </SelectTrigger>
              <SelectContent>
                {etablissements?.map((etab) => (
                  <SelectItem key={etab.id} value={etab.id}>
                    {etab.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mois">Mois *</Label>
            <Select value={mois} onValueChange={setMois}>
              <SelectTrigger id="mois">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="montant">Montant prévu (€) *</Label>
            <Input
              id="montant"
              type="number"
              step="0.01"
              min="0"
              value={montantPrevu}
              onChange={(e) => setMontantPrevu(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type de revenu</Label>
            <Select value={typeRevenu} onValueChange={setTypeRevenu}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_REVENU_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isCreating || !etablissementId || !montantPrevu}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}