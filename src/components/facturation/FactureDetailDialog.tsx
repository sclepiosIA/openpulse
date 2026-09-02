import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useFactureDetail } from "@/hooks/billing/useFactures";
import { FACTURE_STATUT_LABELS, FACTURE_STATUT_COLORS, MODE_PAIEMENT_LABELS } from "@/types/facturation";
import { Loader2, FileText, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PaiementDialog } from "./PaiementDialog";

interface FactureDetailDialogProps {
  factureId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FactureDetailDialog({ factureId, open, onOpenChange }: FactureDetailDialogProps) {
  const { data: facture, isLoading } = useFactureDetail(factureId ?? undefined);
  const [paiementOpen, setPaiementOpen] = useState(false);

  const resteDu = facture ? (facture.montant_ttc || 0) - (facture.montant_paye || 0) : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Facture {facture?.numero ? `— ${facture.numero}` : ""}
            </DialogTitle>
          </DialogHeader>

          {isLoading && (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          )}

          {facture && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <Badge className={FACTURE_STATUT_COLORS[facture.statut]}>{FACTURE_STATUT_LABELS[facture.statut]}</Badge>
                <span className="text-sm text-muted-foreground">
                  Émise le {format(new Date(facture.date_emission), "dd MMM yyyy", { locale: fr })} · Échéance {format(new Date(facture.date_echeance), "dd MMM yyyy", { locale: fr })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Client</p>
                  <p className="font-medium">{facture.client_nom}</p>
                  {facture.client_email && <p className="text-xs">{facture.client_email}</p>}
                  {facture.client_siret && <p className="text-xs text-muted-foreground">SIRET : {facture.client_siret}</p>}
                </div>
                <div>
                  <p className="text-muted-foreground">Établissement</p>
                  <p className="font-medium">{facture.etablissement?.nom || "—"}</p>
                  {facture.devis && <p className="text-xs">Devis : {facture.devis.numero}</p>}
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
                      {facture.lignes?.length ? facture.lignes.map((l) => (
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
                  <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span>{facture.montant_ht.toFixed(2)} €</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span>{facture.montant_tva.toFixed(2)} €</span></div>
                  <Separator />
                  <div className="flex justify-between font-semibold"><span>Total TTC</span><span>{facture.montant_ttc.toFixed(2)} €</span></div>
                  <div className="flex justify-between text-success"><span>Payé</span><span>{(facture.montant_paye || 0).toFixed(2)} €</span></div>
                  <div className="flex justify-between font-semibold text-base"><span>Reste dû</span><span className="text-primary">{resteDu.toFixed(2)} €</span></div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2 text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" /> Paiements</h3>
                {facture.paiements?.length ? (
                  <div className="rounded-md border divide-y">
                    {facture.paiements.map((p) => (
                      <div key={p.id} className="flex justify-between p-2 text-sm">
                        <div>
                          <div className="font-medium">{p.montant.toFixed(2)} € — {MODE_PAIEMENT_LABELS[p.mode_paiement] || p.mode_paiement}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(p.date_paiement), "dd MMM yyyy", { locale: fr })}
                            {p.reference_paiement && ` · Réf : ${p.reference_paiement}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Aucun paiement enregistré</p>
                )}
              </div>

              {facture.notes_client && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Notes client</p>
                  <p className="whitespace-pre-line">{facture.notes_client}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
            {facture && resteDu > 0 && facture.statut !== 'annulee' && (
              <Button onClick={() => setPaiementOpen(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                Enregistrer un paiement
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaiementDialog factureId={factureId} open={paiementOpen} onOpenChange={setPaiementOpen} />
    </>
  );
}
