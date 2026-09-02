import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ActiveEmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  category: string | null;
}

/**
 * Chantier #4 (audit 2026-06-02) — fetch des templates email actifs.
 */
export function useActiveEmailTemplates() {
  return useQuery({
    queryKey: ['email_templates', 'active'],
    queryFn: async (): Promise<ActiveEmailTemplate[]> => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, subject, content, category, is_active, created_at')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as ActiveEmailTemplate[];
    },
    staleTime: 5 * 60_000,
  });
}
