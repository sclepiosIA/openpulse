import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { debug } from "@/lib/debug";
import type { ContratTemplate, ContratClause } from "@/types/contrats";
import { useAuth } from "@/components/AuthProvider";

// Hook pour les templates
export function useContratTemplates() {
  return useQuery({
    queryKey: ["contrat-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrat_templates")
        .select("id, nom, description, type, contenu_html, variables, clauses_ids, est_actif, created_by, created_at, updated_at")
        .eq("est_actif", true)
        .order("nom")
        .limit(100);

      if (error) throw error;
      
      return (data || []).map(t => ({
        ...t,
        variables: Array.isArray(t.variables) ? t.variables : [],
        clauses_ids: Array.isArray(t.clauses_ids) ? t.clauses_ids : [],
      })) as ContratTemplate[];
    },
  });
}

// Hook pour les clauses
export function useContratClauses() {
  return useQuery({
    queryKey: ["contrat-clauses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrat_clauses")
        .select("id, titre, contenu_html, categorie, sous_categorie, preview_text, variables, ordre, est_actif, est_obligatoire, usage_count, created_at, updated_at")
        .eq("est_actif", true)
        .order("ordre")
        .limit(200);

      if (error) throw error;
      
      return (data || []).map(c => ({
        ...c,
        variables: Array.isArray(c.variables) ? c.variables : [],
      })) as ContratClause[];
    },
  });
}

// Mutations pour templates
export function useCreateTemplate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<ContratTemplate>) => {
      
      
      const { data: result, error } = await supabase
        .from("contrat_templates")
        .insert({
          ...data,
          created_by: user?.id,
          variables: data.variables || [],
          clauses_ids: data.clauses_ids || [],
        } as never)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contrat-templates"] });
      toast.success("Modèle créé avec succès");
    },
    onError: (error) => {
      debug.error("Erreur création template:", error);
      toast.error("Erreur lors de la création du modèle");
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ContratTemplate> & { id: string }) => {
      const { data: result, error } = await supabase
        .from("contrat_templates")
        .update(data as never)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contrat-templates"] });
      toast.success("Modèle mis à jour");
    },
    onError: (error) => {
      debug.error("Erreur mise à jour template:", error);
      toast.error("Erreur lors de la mise à jour");
    },
  });
}

// Mutations pour clauses
export function useCreateClause() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<ContratClause>) => {
      const { data: result, error } = await supabase
        .from("contrat_clauses")
        .insert({
          ...data,
          variables: data.variables || [],
        } as never)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contrat-clauses"] });
      toast.success("Clause créée avec succès");
    },
    onError: (error) => {
      debug.error("Erreur création clause:", error);
      toast.error("Erreur lors de la création de la clause");
    },
  });
}

export function useUpdateClause() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ContratClause> & { id: string }) => {
      const { data: result, error } = await supabase
        .from("contrat_clauses")
        .update(data as never)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contrat-clauses"] });
      toast.success("Clause mise à jour");
    },
    onError: (error) => {
      debug.error("Erreur mise à jour clause:", error);
      toast.error("Erreur lors de la mise à jour");
    },
  });
}

export function useDeleteClause() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contrat_clauses")
        .update({ est_actif: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contrat-clauses"] });
      toast.success("Clause supprimée");
    },
    onError: (error) => {
      debug.error("Erreur suppression clause:", error);
      toast.error("Erreur lors de la suppression");
    },
  });
}
