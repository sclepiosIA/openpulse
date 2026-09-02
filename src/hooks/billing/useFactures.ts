import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import type { Facture, FactureLigne, FactureStatut, PaiementFacture } from "@/types/facturation";
import { debug } from "@/lib/debug";
import { useAuth } from "@/components/AuthProvider";

export function useFactures(filters?: { statut?: FactureStatut; etablissementId?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: factures = [], isLoading, error } = useQuery({
    queryKey: ["factures", filters],
    queryFn: async () => {
      let query = supabase
        .from("factures")
        .select(`
          *,
          etablissement:etablissements(id, nom, ville),
          contact:contacts(id, nom, prenom, email),
          commercial:profiles!factures_commercial_id_fkey(id, first_name, last_name),
          devis(id, numero)
        `)
        .order("created_at", { ascending: false });

      if (filters?.statut) {
        query = query.eq("statut", filters.statut);
      }
      if (filters?.etablissementId) {
        query = query.eq("etablissement_id", filters.etablissementId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Facture[];
    }
  });

  const createFactureMutation = useMutation({
    mutationFn: async (factureData: Partial<Facture> & { lignes?: Partial<FactureLigne>[] }) => {
      const { lignes, ...factureFields } = factureData;
      
      const insertData = {
        client_nom: factureFields.client_nom || '',
        client_adresse: factureFields.client_adresse,
        client_email: factureFields.client_email,
        client_telephone: factureFields.client_telephone,
        client_siret: factureFields.client_siret,
        etablissement_id: factureFields.etablissement_id,
        groupe_id: factureFields.groupe_id,
        partenaire_id: factureFields.partenaire_id,
        contact_id: factureFields.contact_id,
        date_emission: factureFields.date_emission,
        date_echeance: factureFields.date_echeance,
        conditions_paiement: factureFields.conditions_paiement,
        notes_internes: factureFields.notes_internes,
        notes_client: factureFields.notes_client,
        devis_id: factureFields.devis_id,
        numero_bon_commande: factureFields.numero_bon_commande,
        created_by: user?.id,
        commercial_id: factureFields.commercial_id || user?.id
      };
      
      const { data: newFacture, error: factureError } = await supabase
        .from("factures")
        .insert(insertData as never)
        .select()
        .single();

      if (factureError) throw factureError;

      if (lignes && lignes.length > 0) {
        const lignesWithFactureId = lignes.map((l, idx) => ({
          ...l,
          facture_id: newFacture.id,
          ordre: l.ordre ?? idx
        }));

        const { error: lignesError } = await supabase
          .from("factures_lignes")
          .insert(lignesWithFactureId as never);

        if (lignesError) throw lignesError;
      }

      // Sync with treasury
      try {
        await supabase.functions.invoke('sync-factures-tresorerie', {
          body: { factureId: newFacture.id, action: 'create' }
        });
      } catch (syncError) {
        // Sync failure is not critical - only log in dev
        if (import.meta.env.DEV) {
          debug.warn('[useFactures] Treasury sync failed:', syncError);
        }
      }

      return newFacture;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["factures"] });
      queryClient.invalidateQueries({ queryKey: ["tresorerie-revenus"] });
      toast({ title: "Facture créée avec succès" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la création de la facture", 
        description: sanitizeSupabaseError(error),
        variant: "destructive" 
      });
    }
  });

  const updateFactureMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Facture> & { id: string }) => {
      const { data, error } = await supabase
        .from("factures")
        .update(updates as never)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Sync with treasury on status changes
      try {
        await supabase.functions.invoke('sync-factures-tresorerie', {
          body: { factureId: id, action: 'update' }
        });
      } catch (syncError) {
        // Sync failure is not critical - only log in dev
        if (import.meta.env.DEV) {
          debug.warn('[useFactures] Treasury sync failed:', syncError);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["factures"] });
      queryClient.invalidateQueries({ queryKey: ["tresorerie-revenus"] });
      toast({ title: "Facture mise à jour" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la mise à jour", 
        description: sanitizeSupabaseError(error),
        variant: "destructive" 
      });
    }
  });

  const deleteFactureMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("factures")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["factures"] });
      toast({ title: "Facture supprimée" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la suppression", 
        description: sanitizeSupabaseError(error),
        variant: "destructive" 
      });
    }
  });

  const addPaiementMutation = useMutation({
    mutationFn: async (paiement: Omit<PaiementFacture, 'id' | 'created_at' | 'created_by'>) => {
      
      const { data, error } = await supabase
        .from("paiements_factures")
        .insert({
          ...paiement,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["factures"] });
      toast({ title: "Paiement enregistré" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de l'enregistrement du paiement", 
        description: sanitizeSupabaseError(error),
        variant: "destructive" 
      });
    }
  });

  // Calculate KPIs
  const kpis = {
    totalFacture: factures.reduce((sum, f) => sum + (f.montant_ttc || 0), 0),
    totalPaye: factures.reduce((sum, f) => sum + (f.montant_paye || 0), 0),
    totalEnAttente: factures
      .filter(f => !['payee', 'annulee'].includes(f.statut))
      .reduce((sum, f) => sum + ((f.montant_ttc || 0) - (f.montant_paye || 0)), 0),
    nbFacturesEnRetard: factures.filter(f => {
      if (['payee', 'annulee'].includes(f.statut)) return false;
      return new Date(f.date_echeance) < new Date();
    }).length,
    totalEnRetard: factures
      .filter(f => {
        if (['payee', 'annulee'].includes(f.statut)) return false;
        return new Date(f.date_echeance) < new Date();
      })
      .reduce((sum, f) => sum + ((f.montant_ttc || 0) - (f.montant_paye || 0)), 0)
  };

  return {
    factures,
    isLoading,
    error,
    kpis,
    createFacture: createFactureMutation.mutateAsync,
    updateFacture: updateFactureMutation.mutateAsync,
    deleteFacture: deleteFactureMutation.mutateAsync,
    addPaiement: addPaiementMutation.mutateAsync,
    isCreating: createFactureMutation.isPending,
    isUpdating: updateFactureMutation.isPending,
    isDeleting: deleteFactureMutation.isPending,
    isAddingPaiement: addPaiementMutation.isPending
  };
}

export function useFactureDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["factures", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("factures")
        .select(`
          *,
          etablissement:etablissements(id, nom, ville, adresse),
          contact:contacts(id, nom, prenom, email, telephone),
          commercial:profiles!factures_commercial_id_fkey(id, first_name, last_name),
          devis(id, numero),
          lignes:factures_lignes(
            *,
            produit:catalogue_produits(*)
          ),
          paiements:paiements_factures(*)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as Facture | null;
    },
    enabled: !!id
  });
}
