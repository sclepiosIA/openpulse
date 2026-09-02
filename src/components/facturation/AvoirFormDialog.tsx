import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AVOIR_MOTIF_LABELS, AvoirMotif } from "@/types/avoir";

interface AvoirFormDialogProps {
  factureId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Facture {
  id: string;
  numero: string;
  client_nom: string;
  client_email: string | null;
  client_adresse: string | null;
  client_siret: string | null;
  etablissement_id: string | null;
  montant_ttc: number;
}

export function AvoirFormDialog({ factureId, open, onOpenChange }: AvoirFormDialogProps) {
  const queryClient = useQueryClient();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    facture_id: factureId || "",
    client_nom: "",
    client_email: "",
    client_adresse: "",
    client_siret: "",
    etablissement_id: "",
    montant_ht: 0,
    motif: "erreur_facturation" as AvoirMotif,
    motif_detail: "",
    notes_internes: "",
  });

  // READ: factures list stays as direct query (needed for select dropdown)
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("factures")
        .select("id, numero, client_nom, client_email, client_adresse, client_siret, etablissement_id, montant_ttc")
        .in("statut", ["envoyee", "payee", "partiellement_payee"])
        .order("date_emission", { ascending: false });
      setFactures((data as Facture[]) || []);
    };
    if (open) load();
  }, [open]);

  useEffect(() => {
    if (formData.facture_id) {
      const facture = factures.find(f => f.id === formData.facture_id);
      if (facture) {
        setFormData(prev => ({
          ...prev,
          client_nom: facture.client_nom || "",
          client_email: facture.client_email || "",
          client_adresse: facture.client_adresse || "",
          client_siret: facture.client_siret || "",
          etablissement_id: facture.etablissement_id || "",
          montant_ht: facture.montant_ttc / 1.2,
        }));
      }
    }
  }, [formData.facture_id, factures]);

  useEffect(() => {
    if (factureId && open) {
      setFormData(prev => ({ ...prev, facture_id: factureId }));
    }
  }, [factureId, open]);

  // WRITE: via Edge Function
  const handleSubmit = async () => {
    if (!formData.client_nom) {
      toast.error("Nom du client requis");
      return;
    }
    if (!formData.facture_id) {
      toast.error("Facture associée requise");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('facturation-actions', {
        body: {
          action: 'create_avoir',
          facture_id: formData.facture_id,
          etablissement_id: formData.etablissement_id || null,
          client_nom: formData.client_nom,
          client_email: formData.client_email || null,
          client_adresse: formData.client_adresse || null,
          client_siret: formData.client_siret || null,
          montant_ht: formData.montant_ht,
          motif: formData.motif,
          motif_detail: formData.motif_detail || null,
          notes_internes: formData.notes_internes || null,
        }
      });
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["avoirs"] });
      queryClient.invalidateQueries({ queryKey: ["factures"] });
      toast.success("Avoir créé avec succès");
      onOpenChange(false);
      resetForm();
    } catch (err) {
      debug.error(err);
      toast.error("Erreur lors de la création de l'avoir");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      facture_id: "",
      client_nom: "",
      client_email: "",
      client_adresse: "",
      client_siret: "",
      etablissement_id: "",
      montant_ht: 0,
      motif: "erreur_facturation",
      motif_detail: "",
      notes_internes: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvel avoir (note de crédit)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Facture associée *</Label>
            <Select 
              value={formData.facture_id} 
              onValueChange={(v) => setFormData(p => ({...p, facture_id: v}))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une facture" />
              </SelectTrigger>
              <SelectContent>
                {factures.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.numero} - {f.client_nom} ({f.montant_ttc.toLocaleString('fr-FR')} €)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nom du client *</Label>
              <Input 
                value={formData.client_nom} 
                onChange={(e) => setFormData(p => ({...p, client_nom: e.target.value}))} 
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input 
                type="email" 
                value={formData.client_email} 
                onChange={(e) => setFormData(p => ({...p, client_email: e.target.value}))} 
              />
            </div>
          </div>

          <div>
            <Label>Adresse</Label>
            <Input 
              value={formData.client_adresse} 
              onChange={(e) => setFormData(p => ({...p, client_adresse: e.target.value}))} 
            />
          </div>

          <div>
            <Label>SIRET</Label>
            <Input 
              value={formData.client_siret} 
              onChange={(e) => setFormData(p => ({...p, client_siret: e.target.value}))} 
            />
          </div>

          <div>
            <Label>Motif de l'avoir *</Label>
            <Select 
              value={formData.motif} 
              onValueChange={(v) => setFormData(p => ({...p, motif: v as AvoirMotif}))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AVOIR_MOTIF_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Détail du motif</Label>
            <Textarea 
              value={formData.motif_detail} 
              onChange={(e) => setFormData(p => ({...p, motif_detail: e.target.value}))}
              placeholder="Précisez la raison de l'avoir..."
              rows={2}
            />
          </div>

          <div>
            <Label>Montant HT (€) *</Label>
            <Input 
              type="number" 
              step="0.01"
              value={formData.montant_ht} 
              onChange={(e) => setFormData(p => ({...p, montant_ht: parseFloat(e.target.value) || 0}))} 
            />
            <p className="text-xs text-muted-foreground mt-1">
              TVA (20%): {(formData.montant_ht * 0.2).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € | 
              TTC: {(formData.montant_ht * 1.2).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </p>
          </div>

          <div>
            <Label>Notes internes</Label>
            <Textarea 
              value={formData.notes_internes} 
              onChange={(e) => setFormData(p => ({...p, notes_internes: e.target.value}))}
              placeholder="Notes visibles uniquement en interne..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Création..." : "Créer l'avoir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
