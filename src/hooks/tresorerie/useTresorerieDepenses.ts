/**
 * @fileoverview Hooks pour la gestion des dépenses de trésorerie.
 * 
 * Ce module fournit des hooks React Query pour les opérations CRUD
 * sur les dépenses, avec support de la pagination côté serveur.
 * 
 * @module hooks/useTresorerieDepenses
 * @see {@link docs/TRESORERIE_TECH_GUIDE.md} pour la documentation technique
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

/**
 * Représente une dépense de trésorerie.
 */
export interface Depense {
  id: string;
  nom: string;
  montant: number;
  date_prevue: string;
  date_paiement_reel: string | null;
  statut: string | null;
  categorie_code: string | null;
  source: string | null;
  notes: string | null;
}

/**
 * Données pour créer une nouvelle dépense.
 */
export interface CreateDepenseData {
  nom: string;
  montant: number;
  date_prevue: string;
  categorie_code?: string;
  notes?: string;
   statut?: string;
}

export interface DepensesPaginationParams {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: {
    search?: string;
    statut?: string;
    categorie?: string;
    dateDebut?: string;
    dateFin?: string;
  };
}

export interface DepensesPaginatedResult {
  depenses: Depense[];
  totalCount: number;
  totalPages: number;
}

/**
 * Hook principal pour récupérer toutes les dépenses de trésorerie.
 * 
 * Récupère les dépenses triées par date prévue (décroissante).
 * Limité à 500 enregistrements pour la performance.
 * 
 * @returns {Object} Résultat du hook avec les dépenses et mutations
 * @property {Depense[]} depenses - Liste des dépenses
 * @property {boolean} isLoading - État de chargement
 * @property {function} createDepense - Fonction pour créer une dépense
 * @property {function} updateDepense - Fonction pour mettre à jour une dépense
 * @property {function} deleteDepense - Fonction pour supprimer une dépense
 * @property {function} marquerPayee - Fonction pour marquer une dépense comme payée
 * 
 * @example
 * ```tsx
 * function DepensesList() {
 *   const { depenses, isLoading, createDepense } = useTresorerieDepenses();
 *   
 *   if (isLoading) return <Spinner />;
 *   
 *   return (
 *     <ul>
 *       {depenses.map(d => <li key={d.id}>{d.nom}: {d.montant}€</li>)}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useTresorerieDepenses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["tresorerie-depenses"],
    staleTime: 2 * 60 * 1000,
    retry: 2,
    queryFn: async () => {
      // Récupérer les dépenses récentes (triées par date décroissante)
      const { data: recentData, error: recentError } = await supabase
        .from("tresorerie_depenses")
        .select("id, nom, montant, date_prevue, date_paiement_reel, statut, categorie_code, source, notes")
        .neq("date_prevue", "1900-01-01")
        .order("date_prevue", { ascending: false })
        .limit(500);

      if (recentError) throw recentError;

      // Récupérer les dépenses "à payer plus tard" (date marqueur 1900-01-01)
      const { data: aPayerData, error: aPayerError } = await supabase
        .from("tresorerie_depenses")
        .select("id, nom, montant, date_prevue, date_paiement_reel, statut, categorie_code, source, notes")
        .eq("date_prevue", "1900-01-01");

      if (aPayerError) throw aPayerError;

      // Combiner les deux résultats en dédupliquant par ID
      const allData = [...(recentData || []), ...(aPayerData || [])];
      const uniqueData = Array.from(new Map(allData.map(d => [d.id, d])).values());
      
      return uniqueData as Depense[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateDepenseData) => {
      const { error } = await supabase
        .from("tresorerie_depenses")
        .insert({
          nom: data.nom,
          montant: data.montant,
          date_prevue: data.date_prevue,
          categorie_code: data.categorie_code || null,
          notes: data.notes || null,
         statut: data.statut || "en_attente",
         // Générer source unique pour éviter la contrainte unique_source_id
         source: "manuel_previsionnel",
         source_id: crypto.randomUUID(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tresorerie-depenses"] });
      toast({ title: "Dépense créée" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Depense> }) => {
      const { error } = await supabase
        .from("tresorerie_depenses")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tresorerie-depenses"] });
      toast({ title: "Dépense mise à jour" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tresorerie_depenses")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tresorerie-depenses"] });
      toast({ title: "Dépense supprimée" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  const marquerPayee = (id: string) => {
    updateMutation.mutate({
      id,
      updates: {
        statut: "paye",
        date_paiement_reel: new Date().toISOString().split("T")[0],
      },
    });
  };

  return {
    depenses: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    createDepense: createMutation.mutate,
    updateDepense: updateMutation.mutate,
    deleteDepense: deleteMutation.mutate,
    marquerPayee,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Hook avec pagination côté serveur
export function useTresorerieDepensesPaginated(params: DepensesPaginationParams = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const {
    page = 1,
    pageSize = 25,
    sortField = "date_prevue",
    sortDirection = "desc",
    filters = {}
  } = params;

  const query = useQuery({
    queryKey: ["tresorerie-depenses-paginated", page, pageSize, sortField, sortDirection, filters],
    queryFn: async (): Promise<DepensesPaginatedResult> => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let queryBuilder = supabase
        .from("tresorerie_depenses")
        .select("*", { count: 'exact' });

      // Filtres
      if (filters.search) {
        queryBuilder = queryBuilder.ilike('nom', `%${filters.search}%`);
      }
      if (filters.statut && filters.statut !== "tous") {
        queryBuilder = queryBuilder.eq('statut', filters.statut);
      }
      if (filters.categorie && filters.categorie !== "tous") {
        queryBuilder = queryBuilder.eq('categorie_code', filters.categorie);
      }
      if (filters.dateDebut) {
        queryBuilder = queryBuilder.gte('date_prevue', filters.dateDebut);
      }
      if (filters.dateFin) {
        queryBuilder = queryBuilder.lte('date_prevue', filters.dateFin);
      }

      // Tri
      queryBuilder = queryBuilder.order(sortField, { ascending: sortDirection === 'asc' });

      // Pagination
      queryBuilder = queryBuilder.range(from, to);

      const { data, error, count } = await queryBuilder;

      if (error) throw error;

      return {
        depenses: data as Depense[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Depense> }) => {
      const { error } = await supabase
        .from("tresorerie_depenses")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tresorerie-depenses-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["tresorerie-depenses"] });
      toast({ title: "Dépense mise à jour" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tresorerie_depenses")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tresorerie-depenses-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["tresorerie-depenses"] });
      toast({ title: "Dépense supprimée" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  const marquerPayee = (id: string) => {
    updateMutation.mutate({
      id,
      updates: {
        statut: "paye",
        date_paiement_reel: new Date().toISOString().split("T")[0],
      },
    });
  };

  return {
    depenses: query.data?.depenses || [],
    totalCount: query.data?.totalCount || 0,
    totalPages: query.data?.totalPages || 0,
    isLoading: query.isLoading,
    updateDepense: updateMutation.mutate,
    deleteDepense: deleteMutation.mutate,
    marquerPayee,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
