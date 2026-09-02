import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";

interface ExtractedEmailData {
  domain?: string;
  nom?: string;
  etablissement_nom?: string;
  ville?: string;
  matches?: Array<{ domain?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface EmailSuggestionPending {
  id: string;
  email_thread_id: string;
  suggested_etablissement_id: string | null;
  match_confidence: number;
  match_reason: string | null;
  suggestion_type: string;
  extracted_data: ExtractedEmailData | ExtractedEmailData[] | null;
  created_at: string;
  email_thread: {
    id: string;
    subject: string;
    ai_summary?: string;
    last_message_date: string;
    message_count: number;
    messages?: Array<{ from_address: string }>;
  };
  suggested_etablissement?: {
    id: string;
    nom: string;
    ville: string;
  };
  derived_domains?: string[];
  display_etab_name?: string;
  display_etab_ville?: string;
}

export function useEmailSuggestionsPending() {
  return useQuery({
    queryKey: ['email-suggestions-pending'],
    queryFn: async () => {
      // 1. Récupérer les suggestions pending avec requête simplifiée
      // Éviter la jointure profonde qui cause des erreurs 500
      const { data: suggestions, error } = await supabase
        .from('email_to_etablissement_suggestions')
        .select(`
          id,
          email_thread_id,
          suggested_etablissement_id,
          match_confidence,
          match_reason,
          suggestion_type,
          extracted_data,
          created_at,
          status
        `)
        .eq('status', 'pending')
        .gte('match_confidence', 0.6)
        .order('match_confidence', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50); // Limiter pour performance

      if (error) throw error;
      if (!suggestions || suggestions.length === 0) return [];
      
      // 2. Charger les relations en parallèle
      const threadIds = [...new Set(suggestions.map(s => s.email_thread_id))];
      const etabIds = [...new Set(suggestions.map(s => s.suggested_etablissement_id).filter(Boolean))] as string[];
      
      const [threadsResult, etabsResult, domainMappingsResult, allEtabsResult] = await Promise.all([
        // Threads avec messages
        supabase
          .from('email_threads')
          .select('id, subject, ai_summary, last_message_date, message_count')
          .in('id', threadIds),
        // Établissements suggérés
        etabIds.length > 0 
          ? supabase.from('etablissements').select('id, nom, ville').in('id', etabIds)
          : Promise.resolve({ data: [] }),
        // Domain mappings
        supabase.from('email_domain_mappings').select('domain'),
        // Tous les établissements pour leurs domaines
        supabase.from('etablissements').select('email_domains')
      ]);
      
      // Créer des maps pour lookup rapide
      const threadsMap = new Map(
        (threadsResult.data || []).map(t => [t.id, t])
      );
      const etabsMap = new Map(
        (etabsResult.data || []).map(e => [e.id, e])
      );
      
      // Enrichir les suggestions avec les relations
      const data = suggestions.map(s => ({
        ...s,
        email_thread: threadsMap.get(s.email_thread_id) || { 
          id: s.email_thread_id, 
          subject: '', 
          last_message_date: s.created_at,
          message_count: 0 
        },
        suggested_etablissement: s.suggested_etablissement_id 
          ? etabsMap.get(s.suggested_etablissement_id) 
          : undefined
      })) as EmailSuggestionPending[];
      
      // Créer un Set de tous les domaines déjà configurés (sans distinction)
      const allConfiguredDomains = new Set<string>();
      
      // Ajouter les domaines des mappings
      domainMappingsResult.data?.forEach(m => {
        if (m.domain) {
          allConfiguredDomains.add(m.domain.toLowerCase().trim());
        }
      });
      
      // Ajouter les domaines des établissements
      allEtabsResult.data?.forEach((etab: { email_domains: string[] | null }) => {
        if (Array.isArray(etab.email_domains)) {
          etab.email_domains.forEach((domain: string) => {
            if (domain) {
              allConfiguredDomains.add(domain.toLowerCase().trim());
            }
          });
        }
      });
      
      // 3. Filtrer les suggestions avec extraction de domaines
      const filtered = (data as EmailSuggestionPending[]).filter(s => {
        // Vérifier sujet valide
        if (!s.email_thread?.subject || 
            s.email_thread.subject.trim() === '' ||
            s.email_thread.subject.toLowerCase() === '(sans objet)') {
          return false;
        }
        
        // Extraire TOUS les domaines liés à cette suggestion
        const suggestionDomains = new Set<string>();
        
        // 1. Domaines des messages du thread
        if (s.email_thread.messages && Array.isArray(s.email_thread.messages)) {
          s.email_thread.messages.forEach((msg) => {
            if (msg.from_address && typeof msg.from_address === 'string') {
              const domain = msg.from_address.split('@')[1]?.toLowerCase().trim();
              if (domain) suggestionDomains.add(domain);
            }
          });
        }
        
        // 2. Domaine dans extracted_data (format simple)
        if (!Array.isArray(s.extracted_data) && s.extracted_data?.domain) {
          suggestionDomains.add(s.extracted_data.domain.toLowerCase().trim());
        }
        
        // 3. Domaines dans extracted_data (format tableau)
        if (Array.isArray(s.extracted_data)) {
          s.extracted_data.forEach((item) => {
            if (item?.domain) {
              suggestionDomains.add(item.domain.toLowerCase().trim());
            }
          });
        }
        
        // 4. Domaines dans extracted_data.matches
        if (!Array.isArray(s.extracted_data) && s.extracted_data?.matches && Array.isArray(s.extracted_data.matches)) {
          s.extracted_data.matches.forEach((item) => {
            if (item?.domain) {
              suggestionDomains.add(item.domain.toLowerCase().trim());
            }
          });
        }
        
        // 5. Extraire depuis match_reason avec plusieurs patterns
        if (s.match_reason) {
          const patterns = [
            /(domaine|domain)\s*[:=]?\s*([a-z0-9.-]+\.[a-z]{2,})/i,
            /@([a-z0-9.-]+\.[a-z]{2,})/i,
            /(?:depuis|provenant de)\s+([a-z0-9.-]+\.[a-z]{2,})/i,
          ];
          
          patterns.forEach(pattern => {
            const match = s.match_reason?.match(pattern);
            if (match) {
              const domain = (match[2] || match[1])?.toLowerCase().trim();
              if (domain && domain.includes('.')) {
                suggestionDomains.add(domain);
              }
            }
          });
        }
        
        // Enrichir avec données d'affichage
        const extractedData = Array.isArray(s.extracted_data) ? s.extracted_data[0] : s.extracted_data;
        s.derived_domains = Array.from(suggestionDomains);
        s.display_etab_name = s.suggested_etablissement?.nom ??
                                       extractedData?.nom ??
                                       extractedData?.etablissement_nom ?? undefined;
        s.display_etab_ville = s.suggested_etablissement?.ville ??
                                        extractedData?.ville ?? undefined;
        
        // Règle de filtrage
        if (suggestionDomains.size === 0) {
          // Pas de domaine trouvé = potentiellement nouveau établissement
          debug.log(`✅ Gardée ${s.id}: aucun domaine (nouveau établissement)`);
          return true;
        }
        
        // Vérifier si au moins un domaine n'est pas configuré
        const hasUnconfiguredDomain = Array.from(suggestionDomains).some(
          domain => !allConfiguredDomains.has(domain)
        );
        
        if (hasUnconfiguredDomain) {
          const unconfigured = Array.from(suggestionDomains).filter(d => !allConfiguredDomains.has(d));
          debug.log(`✅ Gardée ${s.id}: domaines non configurés [${unconfigured.join(', ')}]`);
          return true;
        }
        
        // Tous les domaines sont déjà configurés
        debug.log(`❌ Filtrée ${s.id}: tous domaines configurés [${Array.from(suggestionDomains).join(', ')}]`);
        return false;
      });
      
      return filtered;
    },
    refetchInterval: 2 * 60 * 1000, // 2 minutes
  });
}