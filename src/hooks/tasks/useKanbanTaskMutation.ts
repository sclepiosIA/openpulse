import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from "@/lib/supabaseErrorSanitizer";

export function useKanbanTaskMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("taches")
        .update(data as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taches"] });
      toast({ title: "Tâche déplacée avec succès" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });
}
