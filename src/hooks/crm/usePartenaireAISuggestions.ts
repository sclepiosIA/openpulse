import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseBrowser";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import type { AISuggestion } from "../ai/useAISuggestions";

export function usePartenaireAISuggestions(partenaireId?: string) {
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['partenaire-ai-suggestions', partenaireId],
    queryFn: async () => {
      let query = supabase
        .from('ai_suggested_actions')
        .select('id, action_type, action_data, confidence_score, reason, status, etablissement_id, partenaire_id, email_thread_id, reviewed_by, reviewed_at, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(100);

      if (partenaireId) {
        query = query.eq('partenaire_id', partenaireId);
      } else {
        query = query.not('partenaire_id', 'is', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AISuggestion[];
    },
    enabled: true,
  });

  const approveSuggestion = useMutation({
    mutationFn: async (suggestionId: string) => {
      const { data, error } = await supabase.functions.invoke('apply-ai-suggestion', {
        body: { suggestion_id: suggestionId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Suggestion appliquée avec succès");
      queryClient.invalidateQueries({ queryKey: ['partenaire-ai-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['partenaires'] });
      queryClient.invalidateQueries({ queryKey: ['partenaire-activities'] });
      queryClient.invalidateQueries({ queryKey: ['email-drafts'] });
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  const rejectSuggestion = useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabase
        .from('ai_suggested_actions')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Suggestion rejetée");
      queryClient.invalidateQueries({ queryKey: ['partenaire-ai-suggestions'] });
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  return {
    suggestions,
    isLoading,
    approveSuggestion: approveSuggestion.mutate,
    rejectSuggestion: rejectSuggestion.mutate,
    isApproving: approveSuggestion.isPending,
    isRejecting: rejectSuggestion.isPending,
  };
}
