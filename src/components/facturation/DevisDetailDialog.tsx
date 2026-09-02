import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useDevisDetail } from "@/hooks/contracts/useDevis";
import { useFactures } from "@/hooks/billing/useFactures";
import { DEVIS_STATUT_LABELS, DEVIS_STATUT_COLORS } from "@/types/facturation";
import { Loader2, FileText, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface DevisDetailDialogProps {
  devisId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DevisDetailDialog({ devisId, open, onOpenChange }: DevisDetailDialogProps) {
  const { data: devis, isLoading } = useDevisDetail(devisId ?? undefined);
  const { createFacture, isCreating } = useFactures();

  const handleConvertToFacture = async () => {
    if (!devis) return;
    try {
      await createFacture({
        client_nom: devis.client_nom,
        client_adresse: devis.client_adresse,
        client_email: devis.client_email,
        client_siret: devis.client_siret,
        etablissement_id: devis.etablissement_id,
        groupe_id: devis.groupe_id,
        partenaire_id: devis.partenaire_id,
        contact_id: devis.contact_id,
        date_emission: new Date().toISOString().slice(0, 10),
        date_echeance: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        conditions_paiement: devis.conditions_paiement,
        notes_internes: devis.notes_internes,
        notes_client: devis.notes_client,
        devis_id: devis.id,
        commercial_id: devis.commercial_id,
        lignes: (devis.lignes?.map((l, i) => ({
          ordre: i,
          designation: l.designation,
          description: l.description,
          quantite: l.quantite,
          unite: l.unite,
          prix_unitaire_ht: l.prix_unitaire_ht,
          taux_tva: l.taux_tva,
          remise_pourcent: l.remise_pourcent,
          montant_ht: l.montant_ht,
          montant_tva: l.montant_tva,
          montant_ttc: l.montant_ttc,
          produit_id: l.produit_id,
          devis_ligne_id: l.id,
        })) as any),
      });
      onOpenChange(false);
    } catch (e) {
      toast.error("Erreur lors de la conversion en facture");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Détail du devis {devis?.numero ? `— ${devis.numero}` : ""}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        )}

        {devis && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <Badge className={DEVIS_STATUT_COLORS[devis.statut]}>{DEVIS_STATUT_LABELS[devis.statut]}</Badge>
              <span className="text-sm text-muted-foreground">
                Émis le {format(new Date(devis.date_emission), "dd MMM yyyy", { locale: fr })} · Validité {format(new Date(devis.date_validite), "dd MMM yyyy", { locale: fr })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Client</p>
                <p className="font-medium">{devis.client_nom}</p>
                {devis.client_email && <p className="text-xs">{devis.client_email}</p>}
                {devis.client_siret && <p className="text-xs text-muted-foreground">SIRET : {devis.client_siret}</p>}
              </div>
              <div>
                <p className="text-muted-foreground">Établissement</p>
                <p className="font-medium">{devis.etablissement?.nom || "—"}</p>
                {devis.commercial && <p className="text-xs">Commercial : {devis.commercial.first_name} {devis.commercial.last_name}</p>}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2 text-sm">Lignes</h3>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">Désignation</th>
                      <th className="text-right p-2">Qté</th>
                      <th className="text-right p-2">PU HT</th>
                      <th className="text-right p-2">TVA</th>
                      <th className="text-right p-2">Total TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devis.lignes?.length ? devis.lignes.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="p-2">
                          <div className="font-medium">{l.designation}</div>
                          {l.description && <div className="text-xs text-muted-foreground">{l.description}</div>}
                        </td>
                        <td className="text-right p-2">{l.quantite} {l.unite}</td>
                        <td className="text-right p-2">{l.prix_unitaire_ht.toFixed(2)} €</td>
                        <td className="text-right p-2">{l.taux_tva}%</td>
                        <td className="text-right p-2 font-medium">{l.montant_ttc.toFixed(2)} €</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="text-center p-4 text-muted-foreground">Aucune ligne</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="space-y-1 text-sm w-64">
                <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span>{devis.montant_ht.toFixed(2)} €</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span>{devis.montant_tva.toFixed(2)} €</span></div>
                <Separator />
                <div className="flex justify-between font-semibold text-base"><span>Total TTC</span><span className="text-primary">{devis.montant_ttc.toFixed(2)} €</span></div>
              </div>
            </div>

            {devis.notes_client && (
              <div className="text-sm">
                <p className="text-muted-foreground">Notes client</p>
                <p className="whitespace-pre-line">{devis.notes_client}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          {devis && devis.statut === 'accepte' && !devis.facture_id && (
            <Button onClick={handleConvertToFacture} disabled={isCreating}>
              {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
              Convertir en facture
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
