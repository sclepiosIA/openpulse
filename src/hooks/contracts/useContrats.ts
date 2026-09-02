import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { debug } from '@/lib/debug';
import type { Contrat, ContratStatut, ContratType, ContratAvenant, ContratAlerte } from "@/types/contrats";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/components/AuthProvider";
import { sanitizePostgrestValue } from '@/lib/sanitize';

type ContratInsert = Database['public']['Tables']['contrats']['Insert'];
type ContratUpdate = Database['public']['Tables']['contrats']['Update'];

// Hook principal pour les contrats
export function useContrats(filters?: {
  statut?: ContratStatut;
  type?: ContratType;
  etablissement_id?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["contrats", filters],
    queryFn: async () => {
      let query = supabase
        .from("contrats")
        .select(`
          *,
          etablissement:etablissements!fk_contrats_etablissement(id, nom, ville),
          contact:contacts!fk_contrats_contact(id, nom, prenom),
          commercial:profiles!fk_contrats_commercial(id, prenom, nom)
        `)
        .order("created_at", { ascending: false });

      if (filters?.statut) {
        query = query.eq("statut", filters.statut);
      }
      if (filters?.type) {
        query = query.eq("type", filters.type);
      }
      if (filters?.etablissement_id) {
        query = query.eq("etablissement_id", filters.etablissement_id);
      }
      if (filters?.search) {
        query = query.or(`titre.ilike.%${sanitizePostgrestValue(filters.search)}%,numero.ilike.%${sanitizePostgrestValue(filters.search)}%,client_nom.ilike.%${sanitizePostgrestValue(filters.search)}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Contrat[];
    },
  });
}

// Hook pour un contrat spécifique
export function useContrat(id: string | undefined) {
  return useQuery({
    queryKey: ["contrat", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("contrats")
        .select(`
          *,
          etablissement:etablissements!fk_contrats_etablissement(id, nom, ville),
          contact:contacts!fk_contrats_contact(id, nom, prenom, email),
          commercial:profiles!fk_contrats_commercial(id, prenom, nom)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as Contrat | null;
    },
    enabled: !!id,
  });
}

// Hook pour les avenants d'un contrat
export function useContratAvenants(contratId: string | undefined) {
  return useQuery({
    queryKey: ["contrat-avenants", contratId],
    queryFn: async () => {
      if (!contratId) return [];
      
      const { data, error } = await supabase
        .from("contrat_avenants")
        .select("id, contrat_id, numero, titre, description, modifications, contenu_html, date_effet, date_signature, signature_url, signe_par, statut, created_by, created_at, updated_at")
        .eq("contrat_id", contratId)
        .order("numero", { ascending: false });

      if (error) throw error;
      return data as ContratAvenant[];
    },
    enabled: !!contratId,
  });
}

// Hook pour les alertes
export function useContratAlertes(options?: { nonTraiteesOnly?: boolean }) {
  return useQuery({
    queryKey: ["contrat-alertes", options],
    queryFn: async () => {
      let query = supabase
        .from("contrat_alertes")
        .select(`
          *,
          contrat:contrats(id, numero, titre, client_nom, statut)
        `)
        .order("date_alerte", { ascending: true });

      if (options?.nonTraiteesOnly) {
        query = query.eq("est_traitee", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ContratAlerte[];
    },
  });
}

// Mutations
export function useCreateContrat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Contrat>) => {
      
      
      // Build insert data with defaults - caller must provide required fields
      const insertData = {
        ...data,
        created_by: user?.id,
        clauses_selectionnees: data.clauses_selectionnees || [],
        tags: data.tags || [],
        metadata: (data.metadata || {}) as Database['public']['Tables']['contrats']['Insert']['metadata'],
      } as ContratInsert;

      const { data: result, error } = await supabase
        .from("contrats")
        .insert(insertData)
        .select()
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contrats"] });
      toast.success("Contrat créé avec succès");
    },
    onError: (error) => {
      debug.error("Erreur création contrat:", error);
      toast.error("Erreur lors de la création du contrat");
    },
  });
}

export function useUpdateContrat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Contrat> & { id: string }) => {
      const updateData: ContratUpdate = {
        ...data,
        metadata: data.metadata as Database['public']['Tables']['contrats']['Update']['metadata'],
      };
      
      const { data: result, error } = await supabase
        .from("contrats")
        .update(updateData)
        .eq("id", id)
        .select()
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contrats"] });
      queryClient.invalidateQueries({ queryKey: ["contrat", variables.id] });
      toast.success("Contrat mis à jour");
    },
    onError: (error) => {
      debug.error("Erreur mise à jour contrat:", error);
      toast.error("Erreur lors de la mise à jour");
    },
  });
}

export function useDeleteContrat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contrats")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contrats"] });
      toast.success("Contrat supprimé");
    },
    onError: (error) => {
      debug.error("Erreur suppression contrat:", error);
      toast.error("Erreur lors de la suppression");
    },
  });
}

// Créer un avenant
export function useCreateAvenant() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<ContratAvenant> & { contrat_id: string }) => {
      
      
      // Récupérer le prochain numéro d'avenant
      const { data: existingAvenants } = await supabase
        .from("contrat_avenants")
        .select("numero")
        .eq("contrat_id", data.contrat_id)
        .order("numero", { ascending: false })
        .limit(1);

      const nextNumero = (existingAvenants?.[0]?.numero || 0) + 1;

      const { data: result, error } = await supabase
        .from("contrat_avenants")
        .insert({
          ...data,
          numero: nextNumero,
          created_by: user?.id,
          modifications: data.modifications || {},
        } as never)
        .select()
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contrat-avenants", variables.contrat_id] });
      toast.success("Avenant créé avec succès");
    },
    onError: (error) => {
      debug.error("Erreur création avenant:", error);
      toast.error("Erreur lors de la création de l'avenant");
    },
  });
}

// Marquer une alerte comme traitée
export function useTraiterAlerte() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alerteId: string) => {
      
      
      const { error } = await supabase
        .from("contrat_alertes")
        .update({
          est_traitee: true,
          traitee_par: user?.id,
          traitee_le: new Date().toISOString(),
        })
        .eq("id", alerteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contrat-alertes"] });
      toast.success("Alerte marquée comme traitée");
    },
    onError: (error) => {
      debug.error("Erreur traitement alerte:", error);
      toast.error("Erreur lors du traitement de l'alerte");
    },
  });
}

// KPIs des contrats
export function useContratsKPIs() {
  return useQuery({
    queryKey: ["contrats-kpis"],
    queryFn: async () => {
      const { data: contrats, error } = await supabase
        .from("contrats")
        .select("statut, montant_annuel_ht, date_fin");

      if (error) throw error;

      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const actifs = contrats?.filter(c => c.statut === 'actif') || [];
      const enAttente = contrats?.filter(c => c.statut === 'en_attente_signature') || [];
      const expirantBientot = contrats?.filter(c => {
        if (!c.date_fin) return false;
        const dateFin = new Date(c.date_fin);
        return dateFin >= now && dateFin <= in30Days && c.statut === 'actif';
      }) || [];

      return {
        totalActifs: actifs.length,
        caAnnuelActif: actifs.reduce((sum, c) => sum + (c.montant_annuel_ht || 0), 0),
        enAttenteSignature: enAttente.length,
        expirantDans30Jours: expirantBientot.length,
      };
    },
  });
}
