import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { debug } from '@/lib/debug';
import type { ColorTagId } from "@/components/documents/finder/ColorTagsBar";
import { useAuth } from "@/components/AuthProvider";

const DOCUMENTS_QUERY_KEY = "documents";

export function useUpdateColorTags() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, colorTags }: { documentId: string; colorTags: string[] }) => {
      if (!user) throw new Error("Non authentifié");

      const { error } = await supabase
        .from("documents")
        .update({ color_tags: colorTags })
        .eq("id", documentId);

      if (error) throw error;

      // Log audit
      await supabase.from("document_audit_log").insert({
        document_id: documentId,
        action: "tagged",
        performed_by: user.id,
        new_value: { color_tags: colorTags },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] });
    },
    onError: (error) => {
      debug.error("Erreur mise à jour tags colorés:", error);
      toast.error("Erreur lors de la mise à jour des tags");
    },
  });
}

export function useToggleColorTag() {
  const updateColorTags = useUpdateColorTags();

  return {
    toggleTag: (documentId: string, currentTags: string[], tagId: ColorTagId) => {
      const newTags = currentTags.includes(tagId)
        ? currentTags.filter(t => t !== tagId)
        : [...currentTags, tagId];
      
      updateColorTags.mutate({ documentId, colorTags: newTags });
    },
    isPending: updateColorTags.isPending,
  };
}
