import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { debug } from "@/lib/debug";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { ProduitSelector } from "@/components/catalogue/ProduitSelector";

interface DevisFormDialogProps {
  devisId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DevisFormDialog({ devisId, open, onOpenChange }: DevisFormDialogProps) {
  const isEditing = !!devisId;
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    etablissement_id: "",
    client_nom: "",
    client_email: "",
    montant_ht: 0,
    date_validite: "",
  });

  const { data: etablissements = [] } = useQuery({
    queryKey: ['etablissements-select-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from("etablissements").select("id, nom, ville").order("nom");
      if (error) throw error;
      return (data || []) as Array<{ id: string; nom: string; ville: string | null }>;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (formData.etablissement_id) {
      const etab = etablissements.find(e => e.id === formData.etablissement_id);
      if (etab) setFormData(prev => ({ ...prev, client_nom: etab.nom }));
    }
  }, [formData.etablissement_id, etablissements]);

  const handleSubmit = async () => {
    if (!formData.client_nom) {
      toast.error("Nom du client requis");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('facturation-actions', {
        body: {
          action: 'create_devis',
          etablissement_id: formData.etablissement_id || null,
          client_nom: formData.client_nom,
          client_email: formData.client_email || null,
          montant_ht: formData.montant_ht,
          date_validite: formData.date_validite || null,
        }
      });
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      toast.success("Devis créé");
      onOpenChange(false);
      setFormData({ etablissement_id: "", client_nom: "", client_email: "", montant_ht: 0, date_validite: "" });
    } catch (err) {
      debug.error(err);
      toast.error("Erreur lors de la création");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifier le devis" : "Nouveau devis"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Établissement</Label>
            <Select value={formData.etablissement_id} onValueChange={(v) => setFormData(p => ({...p, etablissement_id: v}))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {etablissements.map(e => <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nom du client *</Label>
            <Input value={formData.client_nom} onChange={(e) => setFormData(p => ({...p, client_nom: e.target.value}))} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={formData.client_email} onChange={(e) => setFormData(p => ({...p, client_email: e.target.value}))} />
          </div>
          <div>
            <Label>Produit du catalogue (pré-remplit le montant)</Label>
            <ProduitSelector
              onSelect={(p) => p && setFormData(prev => ({ ...prev, montant_ht: p.prix_unitaire_ht }))}
            />
          </div>
          <div>
            <Label>Montant HT (€)</Label>
            <Input type="number" value={formData.montant_ht} onChange={(e) => setFormData(p => ({...p, montant_ht: parseFloat(e.target.value) || 0}))} />
          </div>
          <div>
            <Label>Date de validité</Label>
            <Input type="date" value={formData.date_validite} onChange={(e) => setFormData(p => ({...p, date_validite: e.target.value}))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{isEditing ? "Mettre à jour" : "Créer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
