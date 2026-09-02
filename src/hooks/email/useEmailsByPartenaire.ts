import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmailThread {
  id: string;
  subject: string;
  last_message_date: string;
  message_count: number;
  ai_summary: string | null;
  participants: Array<{ name?: string; email?: string }> | null;
  is_read: boolean;
  category: string | null;
  priority: string | null;
}

export const useEmailsByPartenaire = (partenaireId: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['emails-by-partenaire', partenaireId],
    queryFn: async (): Promise<EmailThread[]> => {
      const { data, error } = await supabase
        .from('email_threads')
        .select(`
          id,
          subject,
          last_message_date,
          message_count,
          ai_summary,
          participants,
          category,
          priority
        `)
        .eq('partenaire_id', partenaireId)
        .eq('is_archived', false)
        .eq('is_spam', false)
        .order('last_message_date', { ascending: false });

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        is_read: false,
      })) as EmailThread[];
    },
    enabled: !!partenaireId,
  });

  return {
    emails: data || [],
    isLoading,
    error,
  };
};
