import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";
import { calculateEtablissementValue } from "@/lib/valueCalculations";

export function useEmailDashboardStats() {
  return useQuery({
    queryKey: ['email-dashboard-stats'],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();

      // Get new prospects from emails (created in last 7 days with email reference)
      const { data: newProspects, error: prospectsError } = await supabase
        .from('etablissements')
        .select('id, nom, ville, created_at, notes, modele_statique_succes, nombre_passages_urgences_annuel')
        .gte('created_at', sevenDaysAgo)
        .ilike('notes', '%email%')
        .order('created_at', { ascending: false });

      if (prospectsError) throw prospectsError;

      // Calculate potential CA avec fonction unifiée
      const totalCA = newProspects?.reduce((sum, e) => 
        sum + calculateEtablissementValue(e), 0
      ) || 0;

      // Get pending suggestions - only relevant ones with high confidence
      const { data: pendingSuggestions, error: suggestionsError } = await supabase
        .from('email_to_etablissement_suggestions')
        .select(`
          id,
          suggestion_type,
          match_confidence,
          created_at,
          extracted_data,
          email_threads!inner(
            id,
            subject,
            participants,
            last_message_date
          )
        `)
        .eq('status', 'pending')
        .gte('match_confidence', 0.6)
        .in('suggestion_type', ['create_new', 'link_existing', 'needs_review', 'domain_match'])
        .order('match_confidence', { ascending: false })
        .limit(50);

      if (suggestionsError) throw suggestionsError;

      // Calculate average confidence
      const avgConfidence = pendingSuggestions && pendingSuggestions.length > 0
        ? pendingSuggestions.reduce((sum, s) => sum + (s.match_confidence || 0), 0) / pendingSuggestions.length
        : 0;

      return {
        newProspects: {
          count: newProspects?.length || 0,
          total_ca: totalCA,
          prospects: newProspects?.slice(0, 3) || []
        },
        pendingSuggestions: {
          count: pendingSuggestions?.length || 0,
          avg_confidence: avgConfidence,
          suggestions: pendingSuggestions || []
        }
      };
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes - aggregated dashboard data
  });
}
