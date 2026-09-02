import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

export interface ClientPortalUser {
  id: string;
  email: string;
  full_name: string | null;
  nom: string | null;
  prenom: string | null;
  etablissement_id: string;
  etablissement_nom: string | null;
  /** Nouvelle colonne canonique. */
  actif: boolean;
  /** Alias historique (synchronisé via trigger). */
  is_active?: boolean;
  /** Nouvelle colonne canonique. */
  last_login: string | null;
  /** Alias historique (synchronisé via trigger). */
  last_login_at?: string | null;
  created_at: string;
}

export interface ClientPortalRequest {
  id: string;
  /** Nouvelle colonne canonique côté portail. */
  user_id: string | null;
  /** Alias historique (synchronisé via trigger). */
  client_portal_user_id?: string | null;
  etablissement_id: string;
  email: string | null;
  type: "contact" | "formation" | "deploiement" | "facture" | "autre";
  /** Nouvelle colonne canonique. */
  sujet: string;
  /** Alias historique. */
  subject?: string;
  message: string;
  /** Nouvelle colonne canonique. */
  statut: "nouveau" | "en_cours" | "traite" | "ferme";
  /** Alias historique mappé. */
  status?: "open" | "handled" | "closed";
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
}

export function useClientPortalUsers() {
  return useQuery({
    queryKey: ["client_portal_users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_client_portal_users");
      if (error) throw error;
      return (data ?? []) as ClientPortalUser[];
    },
  });
}

export function useClientPortalUsersByEtablissement(etablissementId?: string) {
  return useQuery({
    queryKey: ["client_portal_users", "etab", etablissementId],
    enabled: !!etablissementId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_client_portal_users");
      if (error) throw error;
      return ((data ?? []) as ClientPortalUser[]).filter(
        (u) => u.etablissement_id === etablissementId,
      );
    },
  });
}

export function useCreateClientPortalUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      full_name: string;
      etablissement_id: string;
    }) => {
      const { data, error } = await supabase.rpc("create_client_portal_user", {
        p_email: input.email,
        p_full_name: input.full_name,
        p_etablissement_id: input.etablissement_id,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { user_id: string; temp_password: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_portal_users"] });
      toast.success("Compte portail créé");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResetClientPortalPassword() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc("reset_client_portal_password", {
        p_user_id: userId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { temp_password: string };
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleClientPortalUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; active: boolean }) => {
      const { error } = await supabase.rpc("toggle_client_portal_user_active", {
        p_user_id: input.userId,
        p_active: input.active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_portal_users"] });
      toast.success("Statut mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type PortalRequestStatut = "nouveau" | "en_cours" | "traite" | "ferme";

export function useClientPortalRequests(filters?: {
  etablissementId?: string;
  statut?: PortalRequestStatut;
}) {
  return useQuery({
    queryKey: ["client_portal_requests", filters],
    queryFn: async () => {
      let q = supabase
        .from("client_portal_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (filters?.etablissementId) q = q.eq("etablissement_id", filters.etablissementId);
      if (filters?.statut) q = q.eq("statut", filters.statut);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ClientPortalRequest[];
    },
  });
}

export function useUpdateClientPortalRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { id: string; statut: PortalRequestStatut }) => {
      const isClosed = input.statut === "traite" || input.statut === "ferme";
      const { error } = await supabase
        .from("client_portal_requests")
        .update({
          statut: input.statut,
          handled_at: isClosed ? new Date().toISOString() : null,
          handled_by: isClosed ? (user?.id ?? null) : null,
        } as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_portal_requests"] });
      toast.success("Demande mise à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
