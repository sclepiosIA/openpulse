import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useEtablissementModeleEconomique } from "@/hooks/billing/useFacturationEtablissement";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Euro, TrendingUp, Calendar, Loader2, Info } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { ProduitSelector } from "@/components/catalogue/ProduitSelector";
import { useAuth } from "@/components/AuthProvider";

interface FactureFormDialogProps {
  factureId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledData?: {
    etablissementId: string;
    montant: number;
    libelle: string;
    echeanceMois?: Date;
    periodicite?: string;
  } | null;
}

interface EtablissementOption {
  id: string;
  nom: string;
  ville: string | null;
  email_facturation?: string | null;
  adresse_facturation?: string | null;
  siret_facturation?: string | null;
  conditions_paiement_defaut?: string | null;
}

export function FactureFormDialog({ factureId, open, onOpenChange, prefilledData }: FactureFormDialogProps) {
  const isEditing = !!factureId;
  const queryClient = useQueryClient();
  const [etablissements, setEtablissements] = useState<EtablissementOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useAutoFill, setUseAutoFill] = useState(true);
  
  const [formData, setFormData] = useState({
    etablissement_id: "",
    client_nom: "",
    client_email: "",
    client_adresse: "",
    client_siret: "",
    montant_ht: 0,
    date_echeance: "",
    designation: "",
    echeance_mois: "",
    periodicite_source: "",
  });
  const { user } = useAuth();

  // Hook pour récupérer le modèle économique de l'établissement sélectionné
  const { data: modeleEco, isLoading: isLoadingModele } = useEtablissementModeleEconomique(
    formData.etablissement_id || null
  );

  // Charger la liste des établissements
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("etablissements")
        .select("id, nom, ville, email_facturation, adresse_facturation, siret_facturation, conditions_paiement_defaut")
        .order("nom");
      setEtablissements((data || []) as EtablissementOption[]);
    };
    if (open) load();
  }, [open]);

  // Préremplir depuis les données d'échéance
  useEffect(() => {
    if (prefilledData && open) {
      const echeanceDate = prefilledData.echeanceMois 
        ? format(prefilledData.echeanceMois, 'yyyy-MM-dd')
        : "";
      
      setFormData(prev => ({
        ...prev,
        etablissement_id: prefilledData.etablissementId,
        montant_ht: prefilledData.montant,
        designation: prefilledData.libelle,
        echeance_mois: echeanceDate,
        periodicite_source: prefilledData.periodicite || "",
      }));
      setUseAutoFill(false); // Données déjà pré-remplies
    }
  }, [prefilledData, open]);

  // Auto-fill depuis le modèle économique quand l'établissement change
  useEffect(() => {
    if (modeleEco && useAutoFill && !prefilledData) {
      const moisActuel = format(new Date(), 'MMMM yyyy', { locale: fr });
      
      setFormData(prev => ({
        ...prev,
        montant_ht: modeleEco.montant_periodique,
        designation: `Abonnement OpenPulse - ${moisActuel}`,
        periodicite_source: modeleEco.periodicite,
      }));
    }
  }, [modeleEco, useAutoFill, prefilledData]);

  // Remplir les infos client depuis l'établissement
  useEffect(() => {
    if (formData.etablissement_id) {
      const etab = etablissements.find(e => e.id === formData.etablissement_id);
      if (etab) {
        setFormData(prev => ({ 
          ...prev, 
          client_nom: etab.nom,
          client_email: etab.email_facturation || prev.client_email,
          client_adresse: etab.adresse_facturation || prev.client_adresse,
          client_siret: etab.siret_facturation || prev.client_siret,
        }));

        // Calculer la date d'échéance selon les conditions de paiement
        if (etab.conditions_paiement_defaut) {
          const today = new Date();
          let echeance = today;
          
          if (etab.conditions_paiement_defaut.includes("30")) {
            echeance = addDays(today, 30);
          } else if (etab.conditions_paiement_defaut.includes("45")) {
            echeance = addDays(today, 45);
          } else if (etab.conditions_paiement_defaut.includes("60")) {
            echeance = addDays(today, 60);
          }
          
          setFormData(prev => ({
            ...prev,
            date_echeance: format(echeance, 'yyyy-MM-dd'),
          }));
        }
      }
    }
  }, [formData.etablissement_id, etablissements]);

  const handleSubmit = async () => {
    if (!formData.client_nom) {
      toast.error("Nom du client requis");
      return;
    }
    setIsSubmitting(true);
    try {
      
      const insertData = {
        client_nom: formData.client_nom,
        client_email: formData.client_email || null,
        client_adresse: formData.client_adresse || null,
        client_siret: formData.client_siret || null,
        etablissement_id: formData.etablissement_id || null,
        montant_ht: formData.montant_ht,
        montant_tva: formData.montant_ht * 0.2,
        montant_ttc: formData.montant_ht * 1.2,
        date_echeance: formData.date_echeance || format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        created_by: user?.id,
        statut: 'brouillon',
        echeance_mois: formData.echeance_mois || null,
        periodicite_source: formData.periodicite_source || null,
      };
      
      const { data: newFacture, error } = await supabase
        .from("factures")
        .insert(insertData as any)
        .select()
        .single(); // safe: guaranteed-row
        
      if (error) throw error;

      // Sync avec la trésorerie
      try {
        await supabase.functions.invoke('sync-factures-tresorerie', {
          body: { factureId: newFacture.id, action: 'create' }
        });
      } catch (syncError) {
        debug.warn('[FactureFormDialog] Treasury sync failed:', syncError);
      }
      
      queryClient.invalidateQueries({ queryKey: ["factures"] });
      queryClient.invalidateQueries({ queryKey: ["tresorerie-revenus"] });
      toast.success("Facture créée avec succès");
      onOpenChange(false);
      resetForm();
    } catch (err) {
      debug.error(err);
      toast.error("Erreur lors de la création");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ 
      etablissement_id: "", 
      client_nom: "", 
      client_email: "", 
      client_adresse: "",
      client_siret: "",
      montant_ht: 0, 
      date_echeance: "", 
      designation: "",
      echeance_mois: "",
      periodicite_source: "",
    });
    setUseAutoFill(true);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifier la facture" : "Nouvelle facture"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Sélection de l'établissement */}
          <div className="space-y-2">
            <Label>Établissement</Label>
            <Select 
              value={formData.etablissement_id} 
              onValueChange={(v) => setFormData(p => ({...p, etablissement_id: v}))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un établissement" />
              </SelectTrigger>
              <SelectContent>
                {etablissements.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom} {e.ville && `(${e.ville})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview du modèle économique */}
          {formData.etablissement_id && (
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="pt-4">
                {isLoadingModele ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement du modèle économique...
                  </div>
                ) : modeleEco ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Modèle économique détecté
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Modèle</p>
                        <Badge variant={modeleEco.modele === "Succès" ? "default" : "secondary"}>
                          {modeleEco.modele}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Périodicité</p>
                        <p className="font-medium capitalize">{modeleEco.periodicite}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Montant annuel</p>
                        <p className="font-medium">{formatCurrency(modeleEco.montant_annuel)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Montant période</p>
                        <p className="font-semibold text-primary">
                          {formatCurrency(modeleEco.montant_periodique)}
                        </p>
                      </div>
                    </div>
                    {modeleEco.pallier_vise && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Info className="h-3 w-3" />
                        Palier visé : {modeleEco.pallier_vise}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4" />
                    Aucun modèle économique configuré pour cet établissement
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Informations client */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom du client *</Label>
              <Input 
                value={formData.client_nom} 
                onChange={(e) => setFormData(p => ({...p, client_nom: e.target.value}))} 
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email" 
                value={formData.client_email} 
                onChange={(e) => setFormData(p => ({...p, client_email: e.target.value}))} 
              />
            </div>
            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input 
                value={formData.client_adresse} 
                onChange={(e) => setFormData(p => ({...p, client_adresse: e.target.value}))} 
              />
            </div>
            <div className="space-y-2">
              <Label>SIRET</Label>
              <Input 
                value={formData.client_siret} 
                onChange={(e) => setFormData(p => ({...p, client_siret: e.target.value}))} 
              />
            </div>
          </div>

          <Separator />

          {/* Montant et désignation */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Pré-remplir depuis le catalogue (optionnel)</Label>
              <ProduitSelector
                onSelect={(p) => {
                  if (!p) return;
                  setUseAutoFill(false);
                  setFormData(prev => ({
                    ...prev,
                    designation: p.nom,
                    montant_ht: p.prix_unitaire_ht,
                  }));
                }}
                placeholder="Choisir un produit du catalogue…"
              />
            </div>
            <div className="space-y-2">
              <Label>Désignation</Label>
              <Input 
                value={formData.designation} 
                onChange={(e) => setFormData(p => ({...p, designation: e.target.value}))}
                placeholder="Abonnement OpenPulse - Janvier 2026"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Euro className="h-4 w-4" />
                  Montant HT (€)
                </Label>
                <Input 
                  type="number" 
                  value={formData.montant_ht} 
                  onChange={(e) => setFormData(p => ({...p, montant_ht: parseFloat(e.target.value) || 0}))} 
                />
                {formData.montant_ht > 0 && (
                  <p className="text-xs text-muted-foreground">
                    TTC : {formatCurrency(formData.montant_ht * 1.2)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date d'échéance
                </Label>
                <Input 
                  type="date" 
                  value={formData.date_echeance} 
                  onChange={(e) => setFormData(p => ({...p, date_echeance: e.target.value}))} 
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEditing ? "Mettre à jour" : "Créer la facture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
