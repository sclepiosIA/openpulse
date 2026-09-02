import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseBrowser";

export interface ClassificationStats {
  autoMatchedCount: number;
  totalThreadsCount: number;
  autoMatchRate: number;
  manuallyClassifiedCount: number;
  totalClassifiedCount: number;
  totalClassificationRate: number;
  unclassifiedCount: number;
  horsEtablissementCount: number;
  etablissementCount: number;
  partenaireCount: number;
  groupeCount: number;
  interneCount: number;
  suggestionsPending: number;
  suggestionsAccepted: number;
  suggestionsRejected: number;
  avgConfidence: number;
  topDomains: {
    domain: string;
    etablissement_nom: string;
    thread_count: number;
    confidence_level: string;
  }[];
  recentActivity: {
    date: string;
    auto_matched: number;
    suggestions_created: number;
  }[];
}

export function useEmailClassificationStats() {
  return useQuery({
    queryKey: ['email-classification-stats'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Use count queries to avoid the 1000-row Supabase limit
      const [
        totalRes,
        etabRes,
        partRes,
        groupeRes,
        horsRes,
        interneRes,
        classifiedRes,
      ] = await Promise.all([
        supabase.from('email_threads').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('email_threads').select('id', { count: 'exact', head: true }).eq('is_deleted', false).not('etablissement_id', 'is', null),
        supabase.from('email_threads').select('id', { count: 'exact', head: true }).eq('is_deleted', false).not('partenaire_id', 'is', null),
        supabase.from('email_threads').select('id', { count: 'exact', head: true }).eq('is_deleted', false).not('groupe_id', 'is', null),
        supabase.from('email_threads').select('id', { count: 'exact', head: true }).eq('is_deleted', false).eq('is_hors_etablissement', true),
        supabase.from('email_threads').select('id', { count: 'exact', head: true }).eq('is_deleted', false).eq('category', 'Interne OpenPulse'),
        // Unique classified count (no double-counting)
        supabase.from('email_threads').select('id', { count: 'exact', head: true }).eq('is_deleted', false).or('etablissement_id.not.is.null,partenaire_id.not.is.null,groupe_id.not.is.null,is_hors_etablissement.eq.true,category.eq.Interne OpenPulse'),
      ]);

      if (totalRes.error) throw totalRes.error;

      const totalThreadsCount = totalRes.count || 0;
      const etablissementCount = etabRes.count || 0;
      const partenaireCount = partRes.count || 0;
      const groupeCount = groupeRes.count || 0;
      const horsEtablissementCount = horsRes.count || 0;
      const interneCount = interneRes.count || 0;
      const classifiedCount = classifiedRes.count || 0;

      const unclassifiedCount = totalThreadsCount - classifiedCount;

      const autoMatchedCount = etablissementCount;
      const manuallyClassifiedCount = 0;
      const totalClassifiedCount = classifiedCount;

      const totalClassificationRate = totalThreadsCount > 0
        ? Math.round((classifiedCount / totalThreadsCount) * 100)
        : 0;

      const autoMatchRate = totalThreadsCount > 0
        ? Math.round((etablissementCount / totalThreadsCount) * 100)
        : 0;

      // Fetch suggestions stats
      const { data: suggestions, error: suggestionsError } = await supabase
        .from('email_to_etablissement_suggestions')
        .select('status, match_confidence, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .limit(1000);

      if (suggestionsError) throw suggestionsError;

      const suggestionsPending = suggestions?.filter(s => s.status === 'pending').length || 0;
      const suggestionsAccepted = suggestions?.filter(s => s.status === 'accepted').length || 0;
      const suggestionsRejected = suggestions?.filter(s => s.status === 'rejected').length || 0;

      const avgConfidence = suggestions && suggestions.length > 0
        ? Math.round(suggestions.reduce((sum, s) => sum + (s.match_confidence || 0), 0) / suggestions.length)
        : 0;

      // Fetch top domains
      const { data: domains, error: domainsError } = await supabase
        .from('email_domain_mappings')
        .select(`
          domain,
          confidence_level,
          etablissement_id,
          etablissement:etablissements(id, nom)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (domainsError) throw domainsError;

      type EtabRef = { id: string; nom: string } | { id: string; nom: string }[] | null;
      const getEtab = (e: EtabRef): { id: string; nom: string } | null =>
        Array.isArray(e) ? (e[0] ?? null) : e;

      // Count threads per domain with a single query
      const etablissementIds = (domains || [])
        .map(d => getEtab(d.etablissement as EtabRef)?.id)
        .filter((id): id is string => Boolean(id));

      const { data: threadCounts } = await supabase
        .from('email_threads')
        .select('etablissement_id')
        .in('etablissement_id', etablissementIds)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const threadCountMap = new Map<string, number>();
      threadCounts?.forEach(t => {
        if (t.etablissement_id) {
          const count = threadCountMap.get(t.etablissement_id) || 0;
          threadCountMap.set(t.etablissement_id, count + 1);
        }
      });

      const topDomains = (domains || []).map(d => {
        const etab = getEtab(d.etablissement as EtabRef);
        return {
          domain: d.domain,
          etablissement_nom: etab?.nom || 'N/A',
          thread_count: etab?.id ? (threadCountMap.get(etab.id) || 0) : 0,
          confidence_level: d.confidence_level || 'low',
        };
      });

      topDomains.sort((a, b) => b.thread_count - a.thread_count);

      // Recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: allRecentThreads } = await supabase
        .from('email_threads')
        .select('etablissement_id, created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      const { data: allRecentSuggestions } = await supabase
        .from('email_to_etablissement_suggestions')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      const recentActivity: ClassificationStats['recentActivity'] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const dayThreads = allRecentThreads?.filter(t => {
          const tDate = t.created_at.split('T')[0];
          return tDate === dateStr && t.etablissement_id !== null;
        }) || [];

        const daySuggestions = allRecentSuggestions?.filter(s => {
          const sDate = s.created_at.split('T')[0];
          return sDate === dateStr;
        }) || [];

        recentActivity.push({
          date: dateStr,
          auto_matched: dayThreads.length,
          suggestions_created: daySuggestions.length,
        });
      }

      return {
        autoMatchedCount,
        totalThreadsCount,
        autoMatchRate,
        manuallyClassifiedCount,
        totalClassifiedCount,
        totalClassificationRate,
        unclassifiedCount,
        horsEtablissementCount,
        etablissementCount,
        partenaireCount,
        groupeCount,
        interneCount,
        suggestionsPending,
        suggestionsAccepted,
        suggestionsRejected,
        avgConfidence,
        topDomains,
        recentActivity,
      };
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes - aggregated analytics data
  });
}
