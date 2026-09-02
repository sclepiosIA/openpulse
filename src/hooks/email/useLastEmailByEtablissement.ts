import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryPresets } from "@/lib/queryPresets";

interface LastEmail {
  id: string;
  subject: string;
  last_message_date: string;
  ai_generated_title: string | null;
  etablissement_id: string;
}

export function useLastEmailByEtablissement(etablissementIds: string[]) {
  return useQuery({
    queryKey: ['last-email-by-etablissement', etablissementIds],
    queryFn: async () => {
      if (!etablissementIds.length) return new Map<string, LastEmail>();

      const { data, error } = await supabase
        .from('email_threads')
        .select('id, subject, last_message_date, ai_generated_title, etablissement_id')
        .in('etablissement_id', etablissementIds)
        .eq('is_deleted', false)
        .order('last_message_date', { ascending: false });

      if (error) throw error;

      // Keep only the latest thread per établissement
      const map = new Map<string, LastEmail>();
      data?.forEach((thread) => {
        if (thread.etablissement_id && !map.has(thread.etablissement_id)) {
          map.set(thread.etablissement_id, thread as LastEmail);
        }
      });
      return map;
    },
    enabled: etablissementIds.length > 0,
    ...queryPresets.standard,
  });
}
