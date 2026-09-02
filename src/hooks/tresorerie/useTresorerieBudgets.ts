import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useMemo } from "react";
import { endOfMonth, format } from "date-fns";

export interface Budget {
  id: string;
  categorie_code: string;
  mois: string;
  montant_prevu: number;
  montant_alerte: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BudgetWithReel extends Budget {
  montant_reel: number;
  pourcentage_utilise: number;
  est_depasse: boolean;
  est_alerte: boolean;
  categorie?: {
    id: string;
    code: string;
    nom: string;
    couleur: string | null;
  };
}

export interface CreateBudgetData {
  categorie_code: string;
  mois: string;
  montant_prevu: number;
  montant_alerte?: number;
  notes?: string;
}

export function useTresorerieBudgets(mois?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const moisCourant = mois || new Date().toISOString().slice(0, 7);

  // Query budgets
  const budgetsQuery = useQuery({
    queryKey: ["tresorerie-budgets", moisCourant],
    staleTime: 2 * 60 * 1000,
    retry: 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tresorerie_budgets")
        .select("id, categorie_code, mois, montant_prevu, montant_alerte, notes, created_at, updated_at, created_by")
        .eq("mois", moisCourant)
        .order("categorie_code");

      if (error) throw error;
      return data as Budget[];
    },
  });

  // Query catégories de dépenses
  const categoriesQuery = useQuery({
    queryKey: ["tresorerie-categories-depenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tresorerie_categories")
        .select("id, code, nom, couleur")
        .eq("type", "depense")
        .order("ordre");

      if (error) throw error;
      return data || [];
    },
  });

  // Query dépenses du mois pour calculer le réel
  const depensesQuery = useQuery({
    queryKey: ["tresorerie-depenses-mois", moisCourant],
    queryFn: async () => {
      const startDate = `${moisCourant}-01`;
      const endDate = format(endOfMonth(new Date(`${moisCourant}-01`)), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from("tresorerie_depenses")
        .select("categorie_code, montant, statut")
        .gte("date_prevue", startDate)
        .lte("date_prevue", endDate);

      if (error) throw error;
      return data || [];
    },
  });

  // Combiner budgets avec montants réels
  const budgetsWithReel = useMemo<BudgetWithReel[]>(() => {
    const budgets = budgetsQuery.data || [];
    const depenses = depensesQuery.data || [];
    const categories = categoriesQuery.data || [];

    const categoriesMap = Object.fromEntries(categories.map(c => [c.code, c]));

    // Calculer les dépenses réelles par catégorie
    const depensesByCategorie: Record<string, number> = {};
    depenses.forEach(d => {
      const cat = d.categorie_code || "AUTRE";
      depensesByCategorie[cat] = (depensesByCategorie[cat] || 0) + (d.montant || 0);
    });

    return budgets.map(budget => {
      const montant_reel = depensesByCategorie[budget.categorie_code] || 0;
      const pourcentage_utilise = budget.montant_prevu > 0 
        ? (montant_reel / budget.montant_prevu) * 100 
        : 0;
      const est_depasse = montant_reel > budget.montant_prevu;
      const est_alerte = budget.montant_alerte 
        ? montant_reel >= budget.montant_alerte 
        : pourcentage_utilise >= 80;

      return {
        ...budget,
        montant_reel,
        pourcentage_utilise,
        est_depasse,
        est_alerte,
        categorie: categoriesMap[budget.categorie_code],
      };
    });
  }, [budgetsQuery.data, depensesQuery.data, categoriesQuery.data]);

  // Totaux globaux
  const totaux = useMemo(() => {
    return budgetsWithReel.reduce((acc, b) => {
      acc.prevu += b.montant_prevu;
      acc.reel += b.montant_reel;
      if (b.est_depasse) acc.nbDepasse++;
      if (b.est_alerte && !b.est_depasse) acc.nbAlerte++;
      return acc;
    }, { prevu: 0, reel: 0, nbDepasse: 0, nbAlerte: 0 });
  }, [budgetsWithReel]);

  // Create budget
  const createMutation = useMutation({
    mutationFn: async (data: CreateBudgetData) => {
      const { error } = await supabase
        .from("tresorerie_budgets")
        .insert({
          categorie_code: data.categorie_code,
          mois: data.mois,
          montant_prevu: data.montant_prevu,
          montant_alerte: data.montant_alerte || null,
          notes: data.notes || null,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tresorerie-budgets"] });
      toast({ title: "Budget créé avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  // Update budget
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Budget> }) => {
      const { error } = await supabase
        .from("tresorerie_budgets")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tresorerie-budgets"] });
      toast({ title: "Budget mis à jour" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  // Delete budget
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tresorerie_budgets")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tresorerie-budgets"] });
      toast({ title: "Budget supprimé" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  // Dupliquer depuis le mois précédent
  const duplicateMutation = useMutation({
    mutationFn: async (moisPrecedent: string) => {
      // Récupérer les budgets du mois précédent
      const { data: budgetsPrecedent, error: fetchError } = await supabase
        .from("tresorerie_budgets")
        .select("categorie_code, montant_prevu, montant_alerte, notes")
        .eq("mois", moisPrecedent);

      if (fetchError) throw fetchError;
      if (!budgetsPrecedent || budgetsPrecedent.length === 0) {
        throw new Error("Aucun budget trouvé pour le mois précédent");
      }

      // Insérer pour le mois courant
      const newBudgets = budgetsPrecedent.map(b => ({
        categorie_code: b.categorie_code,
        mois: moisCourant,
        montant_prevu: b.montant_prevu,
        montant_alerte: b.montant_alerte,
        notes: b.notes,
        created_by: user?.id,
      }));

      const { error: insertError } = await supabase
        .from("tresorerie_budgets")
        .upsert(newBudgets, { onConflict: "categorie_code,mois" });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tresorerie-budgets"] });
      toast({ title: "Budgets dupliqués avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  return {
    budgets: budgetsWithReel,
    categories: categoriesQuery.data || [],
    totaux,
    isLoading: budgetsQuery.isLoading || depensesQuery.isLoading || categoriesQuery.isLoading,
    isError: budgetsQuery.isError || depensesQuery.isError || categoriesQuery.isError,
    refetch: () => { budgetsQuery.refetch(); depensesQuery.refetch(); categoriesQuery.refetch(); },
    createBudget: createMutation.mutate,
    updateBudget: updateMutation.mutate,
    deleteBudget: deleteMutation.mutate,
    duplicateBudgets: duplicateMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
  };
}
