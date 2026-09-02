/**
 * @fileoverview Hooks pour la gestion des revenus de trésorerie.
 * 
 * Ce module fournit des hooks React Query pour les opérations CRUD
 * sur les revenus, avec support de la pagination côté serveur et
 * jointure avec les établissements.
 * 
 * @module hooks/useTresorerieRevenus
 * @see {@link docs/TRESORERIE_TECH_GUIDE.md} pour la documentation technique
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

/**
 * Représente un revenu de trésorerie avec son établissement associé.
 */
export interface Revenu {
  id: string;
  etablissement_id: string | null;
  mois: string;
  montant_prevu: number | null;
  montant_paye: number | null;
  statut: string | null;
  type_revenu: string | null;
  date_facture: string | null;
  date_paiement_reel: string | null;
  date_prevue: string | null;
  numero_facture: string | null;
  notes: string | null;
  source_modele: string | null;
  categorie_code: string | null;
  etablissements?: {
    id: string;
    nom: string;
  } | null;
}

/**
 * Données pour créer un nouveau revenu.
 */
export interface CreateRevenuData {
  etablissement_id: string;
  mois: string;
  montant_prevu: number;
  type_revenu?: string;
  notes?: string;
}

export interface RevenusPaginationParams {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: {
    search?: string;
    statut?: string;
    dateDebut?: string;
    dateFin?: string;
  };
}

export interface RevenusPaginatedResult {
  revenus: Revenu[];
  totalCount: number;
  totalPages: number;
}

/**
 * Hook principal pour récupérer tous les revenus de trésorerie.
 * 
 * Récupère les revenus avec leurs établissements associés,
 * triés par mois (décroissant). Limité à 500 enregistrements.
 * 
 * @returns {Object} Résultat du hook avec les revenus et mutations
 * @property {Revenu[]} revenus - Liste des revenus
 * @property {boolean} isLoading - État de chargement
 * @property {function} createRevenu - Fonction pour créer un revenu
 * @property {function} marquerFacture - Fonction pour marquer comme facturé
 * @property {function} marquerPaye - Fonction pour marquer comme payé
 * 
 * @example
 * ```tsx
 * function RevenusList() {
 *   const { revenus, isLoading, marquerPaye } = useTresorerieRevenus();
 *   
 *   return (
 *     <ul>
 *       {revenus.map(r => (
 *         <li key={r.id}>
 *           {r.etablissements?.nom}: {r.montant_prevu}€
 *           <button onClick={() => marquerPaye(r.id)}>Payé</button>
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useTresorerieRevenus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["tresorerie-revenus"],
    staleTime: 2 * 60 * 1000,
    retry: 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tresorerie_revenus")
        .select(`
          id, etablissement_id, mois, montant_prevu, montant_paye, statut, 
          type_revenu, date_facture, date_paiement_reel, date_prevue, numero_facture, notes, source_modele, categorie_code,
          etablissements:etablissement_id (id, nom)
        `)
        .order("mois", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as Revenu[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateRevenuData) => {
      const { error } = await supabase
        .from("tresorerie_revenus")
        .insert({
          etablissement_id: data.etablissement_id,
          mois: data.mois,
          montant_prevu: data.montant_prevu,
          type_revenu: data.type_revenu || "abonnement",
          statut: "contractualise",
          notes: data.notes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tresorerie-revenus"] });
      toast({ title: "Revenu créé avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("tresorerie_revenus")
        .update(updates as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tresorerie-revenus"] });
      toast({ title: "Revenu mis à jour" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  const marquerFacture = (id: string) => {
    updateMutation.mutate({
      id,
      updates: {
        statut: "facture",
        date_facture: new Date().toISOString().split("T")[0],
      },
    });
  };

  const marquerPaye = (id: string, montant?: number) => {
    updateMutation.mutate({
      id,
      updates: {
        statut: "paye",
        date_paiement_reel: new Date().toISOString().split("T")[0],
        montant_paye: montant,
      },
    });
  };

  return {
    revenus: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    createRevenu: createMutation.mutate,
    marquerFacture,
    marquerPaye,
    updateRevenu: updateMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}

// Hook avec pagination côté serveur
export function useTresorerieRevenusPaginated(params: RevenusPaginationParams = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const {
    page = 1,
    pageSize = 25,
    sortField = "mois",
    sortDirection = "desc",
    filters = {}
  } = params;

  const query = useQuery({
    queryKey: ["tresorerie-revenus-paginated", page, pageSize, sortField, sortDirection, filters],
    queryFn: async (): Promise<RevenusPaginatedResult> => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let queryBuilder = supabase
        .from("tresorerie_revenus")
        .select(`
          *,
          etablissements:etablissement_id (id, nom)
        `, { count: 'exact' });

      // Filtres
      if (filters.statut && filters.statut !== "tous") {
        queryBuilder = queryBuilder.eq('statut', filters.statut);
      }
      if (filters.dateDebut) {
        queryBuilder = queryBuilder.gte('mois', filters.dateDebut.slice(0, 7));
      }
      if (filters.dateFin) {
        queryBuilder = queryBuilder.lte('mois', filters.dateFin.slice(0, 7));
      }

      // Tri - map field names for relations
      const effectiveSortField = sortField === "etablissement" ? "etablissement_id" : sortField;
      queryBuilder = queryBuilder.order(effectiveSortField, { ascending: sortDirection === 'asc' });

      // Pagination
      queryBuilder = queryBuilder.range(from, to);

      const { data, error, count } = await queryBuilder;

      if (error) throw error;

      // Filter search client-side for etablissement name (can't filter on relation in supabase directly)
      let filteredData = data as Revenu[];
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter(r => 
          r.etablissements?.nom.toLowerCase().includes(searchLower) ||
          r.numero_facture?.toLowerCase().includes(searchLower)
        );
      }

      return {
        revenus: filteredData,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("tresorerie_revenus")
        .update(updates as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tresorerie-revenus-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["tresorerie-revenus"] });
      toast({ title: "Revenu mis à jour" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: sanitizeSupabaseError(error), variant: "destructive" });
    },
  });

  const marquerFacture = (id: string) => {
    updateMutation.mutate({
      id,
      updates: {
        statut: "facture",
        date_facture: new Date().toISOString().split("T")[0],
      },
    });
  };

  const marquerPaye = (id: string, montant?: number) => {
    updateMutation.mutate({
      id,
      updates: {
        statut: "paye",
        date_paiement_reel: new Date().toISOString().split("T")[0],
        montant_paye: montant,
      },
    });
  };

  return {
    revenus: query.data?.revenus || [],
    totalCount: query.data?.totalCount || 0,
    totalPages: query.data?.totalPages || 0,
    isLoading: query.isLoading,
    updateRevenu: updateMutation.mutate,
    marquerFacture,
    marquerPaye,
    isUpdating: updateMutation.isPending,
  };
}
