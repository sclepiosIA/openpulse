import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';
import { Building2, Users, Handshake } from 'lucide-react';
import { useDebounce } from '../shared/useDebounce';
import { sanitizePostgrestValue } from '@/lib/sanitize';

export type EntityType = 'etablissement' | 'groupe' | 'partenaire';

export interface SearchResult {
  id: string;
  type: EntityType;
  name: string;
  subtitle?: string;
  icon: typeof Building2;
}

export interface MultiEntitySearchResults {
  etablissements: SearchResult[];
  groupes: SearchResult[];
  partenaires: SearchResult[];
}

interface UseMultiEntitySearchReturn {
  results: MultiEntitySearchResults;
  allResults: SearchResult[];
  isSearching: boolean;
  hasResults: boolean;
}

/**
 * Hook optimisé pour la recherche multimodale dans établissements, groupes et partenaires
 * Utilise un debounce de 300ms pour éviter le stuttering
 */
export function useMultiEntitySearch(query: string): UseMultiEntitySearchReturn {
  const [results, setResults] = useState<MultiEntitySearchResults>({
    etablissements: [],
    groupes: [],
    partenaires: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  
  // Debounce 300ms
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const searchEntities = async () => {
      const trimmedQuery = debouncedQuery.trim().toLowerCase();
      
      if (!trimmedQuery || trimmedQuery.length < 2) {
        setResults({ etablissements: [], groupes: [], partenaires: [] });
        return;
      }

      setIsSearching(true);

      try {
        const safeQuery = sanitizePostgrestValue(trimmedQuery);
        // Recherche parallèle dans les 3 tables
        const [etablissementsRes, groupesRes, partenairesRes] = await Promise.all([
          supabase
            .from('etablissements')
            .select('id, nom, ville, region')
            .or(`nom.ilike.%${safeQuery}%,ville.ilike.%${safeQuery}%`)
            .limit(10),
          supabase
            .from('groupes_etablissements')
            .select('id, nom, type')
            .ilike('nom', `%${safeQuery}%`)
            .limit(10),
          supabase
            .from('partenaires')
            .select('id, nom, ville, type_partenaire')
            .or(`nom.ilike.%${safeQuery}%,ville.ilike.%${safeQuery}%`)
            .limit(10),
        ]);

        const etablissements: SearchResult[] = (etablissementsRes.data || []).map(e => ({
          id: e.id,
          type: 'etablissement' as EntityType,
          name: e.nom,
          subtitle: [e.ville, e.region].filter(Boolean).join(', '),
          icon: Building2,
        }));

        const groupes: SearchResult[] = (groupesRes.data || []).map(g => ({
          id: g.id,
          type: 'groupe' as EntityType,
          name: g.nom,
          subtitle: g.type || undefined,
          icon: Users,
        }));

        const partenaires: SearchResult[] = (partenairesRes.data || []).map(p => ({
          id: p.id,
          type: 'partenaire' as EntityType,
          name: p.nom,
          subtitle: [p.ville, p.type_partenaire].filter(Boolean).join(' • '),
          icon: Handshake,
        }));

        setResults({ etablissements, groupes, partenaires });
      } catch (error) {
        debug.error('Error searching entities:', error);
        setResults({ etablissements: [], groupes: [], partenaires: [] });
      } finally {
        setIsSearching(false);
      }
    };

    searchEntities();
  }, [debouncedQuery]);

  const allResults = useMemo(() => [
    ...results.etablissements,
    ...results.groupes,
    ...results.partenaires,
  ], [results]);

  const hasResults = allResults.length > 0;

  return { results, allResults, isSearching, hasResults };
}
