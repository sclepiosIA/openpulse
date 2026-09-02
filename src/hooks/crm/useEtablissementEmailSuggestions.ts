import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { debug } from '@/lib/debug';

export interface EmailSuggestion {
  id: string;
  email_thread_id: string;
  suggested_etablissement_id: string | null;
  suggestion_type: 'create_new' | 'link_existing';
  match_confidence: number | null;
  match_reason: string | null;
  extracted_data: {
    nom?: string;
    nom_hint?: string;
    ville?: string;
    ville_hint?: string;
    type?: string;
    type_hint?: string;
    domain?: string;
    email?: string;
    commercial?: string;
    contact_hint?: { name?: string; email?: string };
    [key: string]: unknown;
  };
  status: 'pending' | 'accepted' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  email_thread?: {
    id: string;
    subject: string;
    ai_summary: string | null;
    last_message_date: string;
    participants: Array<{ name?: string; email?: string }> | null;
    message_count?: number;
  };
  suggested_etablissement?: {
    id: string;
    nom: string;
    ville: string;
  };
}

export const useEtablissementEmailSuggestions = (etablissementId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['etablissement-email-suggestions', etablissementId],
    queryFn: async (): Promise<EmailSuggestion[]> => {
      let query = supabase
        .from('email_to_etablissement_suggestions')
        .select(`
          *,
          email_thread:email_threads(
            id,
            subject,
            ai_summary,
            last_message_date,
            participants,
            message_count
          ),
          suggested_etablissement:etablissements(
            id,
            nom,
            ville
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (etablissementId) {
        query = query.eq('suggested_etablissement_id', etablissementId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as EmailSuggestion[];
    },
    // Enable the query even without etablissementId to fetch all suggestions
    enabled: true,
  });

  const acceptSuggestion = useMutation({
    mutationFn: async ({ suggestionId, createNew }: { suggestionId: string; createNew?: boolean }) => {
      const suggestion = suggestions?.find(s => s.id === suggestionId);
      if (!suggestion) throw new Error('Suggestion not found');

      // Marquer comme acceptée
      const { error: updateError } = await supabase
        .from('email_to_etablissement_suggestions')
        .update({
          status: 'accepted',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);

      if (updateError) throw updateError;

      // Si c'est une création, appeler l'edge function auto-create-etablissement
      if (createNew) {
        const { data, error: functionError } = await supabase.functions.invoke(
          'auto-create-etablissement',
          {
            body: { suggestion_id: suggestionId },
          }
        );

        if (functionError) throw functionError;
        
        debug.log('Establishment created:', data);
      } else if (suggestion.suggested_etablissement_id) {
        // Sinon, lier le thread à l'établissement suggéré
        const { error: linkError } = await supabase
          .from('email_threads')
          .update({ etablissement_id: suggestion.suggested_etablissement_id })
          .eq('id', suggestion.email_thread_id);

        if (linkError) throw linkError;
      }

      return suggestionId;
    },
    onSuccess: () => {
      toast({
        title: "Suggestion acceptée",
        description: "La suggestion a été traitée avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ['etablissement-email-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['email-suggestions-pending'] });
      queryClient.invalidateQueries({ queryKey: ['etablissements'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });

  const rejectSuggestion = useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabase
        .from('email_to_etablissement_suggestions')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);

      if (error) throw error;
      return suggestionId;
    },
    onSuccess: () => {
      toast({
        title: "Suggestion refusée",
        description: "La suggestion a été rejetée.",
      });
      queryClient.invalidateQueries({ queryKey: ['etablissement-email-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['email-suggestions-pending'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });

  return {
    suggestions: suggestions?.filter(s => s.status === 'pending') || [],
    isLoading,
    acceptSuggestion: acceptSuggestion.mutate,
    rejectSuggestion: rejectSuggestion.mutate,
    isAccepting: acceptSuggestion.isPending,
    isRejecting: rejectSuggestion.isPending,
  };
};
