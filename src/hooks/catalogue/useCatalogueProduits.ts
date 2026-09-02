import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import type { CatalogueProduit } from "@/types/facturation";

const SELECT_COLS = "id, code, nom, description, type, prix_unitaire_ht, taux_tva, unite, est_actif, categorie, recurrence, prix_min_ht, prix_max_ht, remise_max_pct, notes_internes, ordre_affichage, created_at, updated_at";

export function useCatalogueProduits(showInactive = false) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: produits = [], isLoading, error, refetch } = useQuery({
    queryKey: ["catalogue_produits", showInactive],
    queryFn: async () => {
      let query = supabase
        .from("catalogue_produits")
        .select(SELECT_COLS)
        .order("ordre_affichage", { ascending: true })
        .order("type")
        .order("nom");

      if (!showInactive) {
        query = query.eq("est_actif", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CatalogueProduit[];
    }
  });

  const createProduitMutation = useMutation({
    mutationFn: async (produit: Omit<CatalogueProduit, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from("catalogue_produits")
        .insert(produit)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogue_produits"] });
      toast({ title: "Produit créé avec succès" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la création", 
        description: sanitizeSupabaseError(error),
        variant: "destructive" 
      });
    }
  });

  const updateProduitMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CatalogueProduit> & { id: string }) => {
      const { data, error } = await supabase
        .from("catalogue_produits")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogue_produits"] });
      toast({ title: "Produit mis à jour" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la mise à jour", 
        description: sanitizeSupabaseError(error),
        variant: "destructive" 
      });
    }
  });

  const deleteProduitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("catalogue_produits")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogue_produits"] });
      toast({ title: "Produit supprimé" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la suppression", 
        description: sanitizeSupabaseError(error),
        variant: "destructive" 
      });
    }
  });

  const duplicateProduitMutation = useMutation({
    mutationFn: async (id: string) => {
      const source = produits.find(p => p.id === id);
      if (!source) throw new Error("Produit introuvable");
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = source;
      const copy = {
        ...rest,
        code: `${source.code}-COPY`,
        nom: `${source.nom} (copie)`,
      };
      const { data, error } = await supabase
        .from("catalogue_produits")
        .insert(copy)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogue_produits"] });
      toast({ title: "Produit dupliqué" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur duplication", description: sanitizeSupabaseError(error), variant: "destructive" });
    }
  });

  const archiveProduitMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase
        .from("catalogue_produits")
        .update({ est_actif: !archive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["catalogue_produits"] });
      toast({ title: vars.archive ? "Produit archivé" : "Produit réactivé" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    }
  });

  const reorderProduitsMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, idx) =>
        supabase.from("catalogue_produits").update({ ordre_affichage: idx }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const firstErr = results.find(r => r.error);
      if (firstErr?.error) throw firstErr.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogue_produits"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur réordonnancement", description: sanitizeSupabaseError(error), variant: "destructive" });
    }
  });

  // Group by type
  const produitsByType = produits.reduce((acc, p) => {
    if (!acc[p.type]) acc[p.type] = [];
    acc[p.type].push(p);
    return acc;
  }, {} as Record<string, CatalogueProduit[]>);

  return {
    produits,
    produitsByType,
    isLoading,
    error,
    refetch,
    createProduit: createProduitMutation.mutateAsync,
    updateProduit: updateProduitMutation.mutateAsync,
    deleteProduit: deleteProduitMutation.mutateAsync,
    duplicateProduit: duplicateProduitMutation.mutateAsync,
    archiveProduit: archiveProduitMutation.mutateAsync,
    reorderProduits: reorderProduitsMutation.mutateAsync,
    isCreating: createProduitMutation.isPending,
    isUpdating: updateProduitMutation.isPending,
    isDeleting: deleteProduitMutation.isPending,
    isDuplicating: duplicateProduitMutation.isPending,
  };
}
