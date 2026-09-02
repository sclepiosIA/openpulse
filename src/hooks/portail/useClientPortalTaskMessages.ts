/**
 * Hooks pour le fil de conversation des tâches du portail client.
 * Utilisé dans le modal "Modifier la tâche" lorsqu'il s'agit d'une tâche portail.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

export interface ClientPortalTaskMessage {
  id: string;
  task_id: string;
  author_type: "marque" | "etablissement";
  author_user_id: string | null;
  author_name: string | null;
  content: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

const TABLE = "client_portal_task_messages" as const;

export function useClientPortalTaskMessages(taskId: string | undefined) {
  return useQuery({
    queryKey: ["client_portal_task_messages", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientPortalTaskMessage[];
    },
  });
}

export interface CreateClientPortalTaskMessageInput {
  task_id: string;
  content: string;
  is_internal?: boolean;
}

export function useCreateClientPortalTaskMessage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateClientPortalTaskMessageInput) => {

      // Récupérer le nom du staff depuis le profil
      let authorName: string | null = user?.email ?? null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("prenom, nom")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.prenom || profile?.nom) {
          authorName = `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim();
        }
      }

      const payload = {
        task_id: input.task_id,
        author_type: "marque" as const,
        author_user_id: user?.id ?? null,
        author_name: authorName,
        content: input.content,
        is_internal: input.is_internal ?? false,
      };

      const { data, error } = await supabase
        .from(TABLE)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as ClientPortalTaskMessage;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["client_portal_task_messages", row.task_id] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Impossible d'envoyer le message"),
  });
}

export function useDeleteClientPortalTaskMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, task_id }: { id: string; task_id: string }) => {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
      return { id, task_id };
    },
    onSuccess: ({ task_id }) => {
      toast.success("Message supprimé");
      qc.invalidateQueries({ queryKey: ["client_portal_task_messages", task_id] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Suppression impossible"),
  });
}
