import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";

export type ClientPortalTaskAssignee = "marque" | "etablissement";
export type ClientPortalTaskStatus = "todo" | "in_progress" | "done";
export type ClientPortalTaskPhase = "deploiement" | "production" | null;

export interface ClientPortalTask {
  id: string;
  etablissement_id: string;
  titre: string;
  description: string | null;
  assignee: ClientPortalTaskAssignee;
  created_by: ClientPortalTaskAssignee;
  created_by_user_id: string | null;
  statut: ClientPortalTaskStatus;
  phase: Exclude<ClientPortalTaskPhase, null> | null;
  due_date: string | null;
  done_at: string | null;
  done_by: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientPortalTaskInput {
  etablissement_id: string;
  titre: string;
  description?: string | null;
  assignee: ClientPortalTaskAssignee;
  phase?: Exclude<ClientPortalTaskPhase, null> | null;
  due_date?: string | null;
  comment?: string | null;
  statut?: ClientPortalTaskStatus;
}

const TABLE = "client_portal_tasks" as const;

export function useClientPortalTasks(etablissementId: string | undefined) {
  return useQuery({
    queryKey: ["client_portal_tasks", etablissementId],
    enabled: !!etablissementId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("etablissement_id", etablissementId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientPortalTask[];
    },
  });
}

export function useClientPortalTasksPendingCount(etablissementId: string | undefined) {
  return useQuery({
    queryKey: ["client_portal_tasks_pending_count", etablissementId],
    enabled: !!etablissementId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from(TABLE)
        .select("id", { count: "exact", head: true })
        .eq("etablissement_id", etablissementId!)
        .eq("assignee", "marque")
        .neq("statut", "done");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useCreateClientPortalTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: ClientPortalTaskInput) => {
      const payload = {
        ...input,
        created_by: "marque" as const,
        created_by_user_id: user?.id ?? null,
        statut: input.statut ?? "todo",
      };
      const { data, error } = await supabase.from(TABLE).insert(payload).select().single(); // safe: guaranteed-row
      if (error) throw error;
      return data as ClientPortalTask;
    },
    onSuccess: (row) => {
      toast.success("Tâche créée");
      qc.invalidateQueries({ queryKey: ["client_portal_tasks", row.etablissement_id] });
      qc.invalidateQueries({ queryKey: ["client_portal_tasks_pending_count", row.etablissement_id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur création tâche"),
  });
}

export function useUpdateClientPortalTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ClientPortalTask> }) => {
      const { data, error } = await supabase
        .from(TABLE)
        .update(patch)
        .eq("id", id)
        .select()
        .single(); // safe: guaranteed-row
      if (error) throw error;
      return data as ClientPortalTask;
    },
    onSuccess: (row) => {
      toast.success("Tâche mise à jour");
      qc.invalidateQueries({ queryKey: ["client_portal_tasks", row.etablissement_id] });
      qc.invalidateQueries({ queryKey: ["client_portal_tasks_pending_count", row.etablissement_id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur mise à jour"),
  });
}

export function useDeleteClientPortalTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, etablissement_id }: { id: string; etablissement_id: string }) => {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
      return { id, etablissement_id };
    },
    onSuccess: ({ etablissement_id }) => {
      toast.success("Tâche supprimée");
      qc.invalidateQueries({ queryKey: ["client_portal_tasks", etablissement_id] });
      qc.invalidateQueries({ queryKey: ["client_portal_tasks_pending_count", etablissement_id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur suppression"),
  });
}
