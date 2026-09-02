import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import { debug } from '@/lib/debug';
import type { Json } from '@/integrations/supabase/types';

/**
 * Hook centralisé pour le feedback Jarvis (messages + suggestions proactives)
 */
export function useJarvisFeedback() {
  const { user } = useAuth();

  /** Feedback sur un message Jarvis (thumbs up/down/report) */
  const submitMessageFeedback = useCallback(async (
    messageId: string, 
    type: 'positive' | 'negative' | 'report'
  ) => {
    if (!user?.id) return;

    try {
      await supabase.from('user_feedbacks').insert({
        user_id: user.id,
        type: type === 'report' ? 'bug' : 'suggestion',
        title: `Jarvis ${type} feedback`,
        description: `Message ID: ${messageId} | Feedback: ${type}`,
        current_route: window.location.pathname,
      });
    } catch (error) {
      debug.error('[JarvisFeedback] Error saving feedback:', error);
    }
  }, [user?.id]);

  /** Feedback sur une suggestion proactive */
  const submitSuggestionFeedback = useCallback(async (
    suggestionType: string,
    suggestionId: string,
    action: 'accepted' | 'rejected' | 'dismissed' | 'executed',
    context?: Record<string, unknown>
  ) => {
    if (!user?.id) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile) {
        await supabase.from('jarvis_suggestion_feedback').insert([{
          user_id: profile.id,
          suggestion_type: suggestionType,
          suggestion_id: suggestionId,
          suggestion_context: (context || {}) as Json,
          action,
        }]);
      }
    } catch (e) {
      debug.error('[JarvisFeedback] Suggestion feedback error:', e);
    }
  }, [user?.id]);

  return { submitMessageFeedback, submitSuggestionFeedback };
}
