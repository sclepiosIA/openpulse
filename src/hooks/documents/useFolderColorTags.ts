import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { debug } from '@/lib/debug';
import type { ColorTagId } from "@/components/documents/finder/ColorTagsBar";

const FOLDERS_QUERY_KEY = "document-folders";

export function useUpdateFolderColorTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ folderId, colorTags }: { folderId: string; colorTags: string[] }) => {
      const { error } = await supabase
        .from("document_folders")
        .update({ color_tags: colorTags })
        .eq("id", folderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FOLDERS_QUERY_KEY] });
    },
    onError: (error) => {
      debug.error("Erreur mise à jour tags colorés dossier:", error);
      toast.error("Erreur lors de la mise à jour des tags");
    },
  });
}

export function useToggleFolderColorTag() {
  const updateColorTags = useUpdateFolderColorTags();

  return {
    toggleTag: (folderId: string, currentTags: string[], tagId: ColorTagId) => {
      const newTags = currentTags.includes(tagId)
        ? currentTags.filter(t => t !== tagId)
        : [...currentTags, tagId];
      
      updateColorTags.mutate({ folderId, colorTags: newTags });
    },
    isPending: updateColorTags.isPending,
  };
}
