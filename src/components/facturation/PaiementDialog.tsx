import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFactures, useFactureDetail } from "@/hooks/billing/useFactures";
import { MODE_PAIEMENT_LABELS } from "@/types/facturation";
import { Loader2 } from "lucide-react";

interface PaiementDialogProps {
  factureId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaiementDialog({ factureId, open, onOpenChange }: PaiementDialogProps) {
  const { data: facture } = useFactureDetail(factureId ?? undefined);
  const { addPaiement, isAddingPaiement, updateFacture } = useFactures();

  const resteDu = facture ? (facture.montant_ttc || 0) - (facture.montant_paye || 0) : 0;

  const [montant, setMontant] = useState<string>("");
  const [datePaiement, setDatePaiement] = useState<string>(new Date().toISOString().slice(0, 10));
  const [modePaiement, setModePaiement] = useState<string>("virement");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (open && facture) {
      setMontant(resteDu > 0 ? resteDu.toFixed(2) : "");
      setDatePaiement(new Date().toISOString().slice(0, 10));
      setModePaiement(facture.mode_paiement || "virement");
      setReference("");
      setNotes("");
    }
  }, [open, facture?.id]);

  const handleSubmit = async () => {
    if (!factureId || !facture) return;
    const montantNum = parseFloat(montant);
    if (isNaN(montantNum) || montantNum <= 0) return;

    await addPaiement({
      facture_id: factureId,
      montant: montantNum,
      date_paiement: datePaiement,
      mode_paiement: modePaiement as 'virement' | 'cheque' | 'carte' | 'prelevement' | 'especes' | 'autre',
      reference_paiement: reference || null,
      notes: notes || null,
    });

    // Mettre à jour montant_paye + statut sur la facture
    const nouveauMontantPaye = (facture.montant_paye || 0) + montantNum;
    const nouveauStatut = nouveauMontantPaye >= facture.montant_ttc
      ? 'payee'
      : nouveauMontantPaye > 0
        ? 'partiellement_payee'
        : facture.statut;

    await updateFacture({
      id: factureId,
      montant_paye: nouveauMontantPaye,
      statut: nouveauStatut,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
        </DialogHeader>

        {facture && (
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Facture</span><span className="font-medium">{facture.numero}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Montant TTC</span><span>{facture.montant_ttc?.toFixed(2)} €</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Déjà payé</span><span>{(facture.montant_paye || 0).toFixed(2)} €</span></div>
            <div className="flex justify-between font-semibold"><span>Reste dû</span><span className="text-primary">{resteDu.toFixed(2)} €</span></div>
          </div>
        )}

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="montant">Montant (€) *</Label>
              <Input id="montant" type="number" step="0.01" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input id="date" type="date" value={datePaiement} onChange={(e) => setDatePaiement(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mode">Mode de paiement *</Label>
            <Select value={modePaiement} onValueChange={setModePaiement}>
              <SelectTrigger id="mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(MODE_PAIEMENT_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ref">Référence</Label>
            <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° chèque, transaction…" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAddingPaiement}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={isAddingPaiement || !montant || parseFloat(montant) <= 0}>
            {isAddingPaiement && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
