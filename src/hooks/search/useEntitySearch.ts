import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';
import { Building2, CheckSquare, User, Users, Calendar, Handshake, type LucideIcon } from 'lucide-react';
import { useDebounce } from '@/hooks/shared/useDebounce';
import { sanitizePostgrestValue } from '@/lib/sanitize';

export type EntityType = 'etablissement' | 'tache' | 'contact' | 'groupe' | 'evenement' | 'partenaire';

export interface EntityResult {
  id: string;
  type: EntityType;
  name: string;
  subtitle?: string;
  icon: LucideIcon;
  url: string;
}

interface EntitySearchResults {
  etablissements: EntityResult[];
  taches: EntityResult[];
  contacts: EntityResult[];
  groupes: EntityResult[];
  evenements: EntityResult[];
  partenaires: EntityResult[];
}

const DEBOUNCE_MS = 300;
const RESULTS_PER_TYPE = 5;

export function useEntitySearch(query: string) {
  const [results, setResults] = useState<EntitySearchResults>({
    etablissements: [],
    taches: [],
    contacts: [],
    groupes: [],
    evenements: [],
    partenaires: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  const searchEntities = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults({
        etablissements: [],
        taches: [],
        contacts: [],
        groupes: [],
        evenements: [],
        partenaires: [],
      });
      return;
    }

    setIsSearching(true);

    try {
      // Parallel searches
      const [etablissementsRes, tachesRes, contactsRes, groupesRes, evenementsRes, partenairesRes] = await Promise.all([
        // Établissements
        supabase
          .from('etablissements')
          .select('id, nom, ville')
          .ilike('nom', `%${searchQuery}%`)
          .order('nom')
          .limit(RESULTS_PER_TYPE),
        
        // Tâches
        supabase
          .from('taches')
          .select('id, titre, statut')
          .ilike('titre', `%${searchQuery}%`)
          .order('created_at', { ascending: false })
          .limit(RESULTS_PER_TYPE),
        
        // Contacts
        supabase
          .from('contacts')
          .select('id, nom, prenom, fonction')
          .or(`nom.ilike.%${sanitizePostgrestValue(searchQuery)}%,prenom.ilike.%${sanitizePostgrestValue(searchQuery)}%`)
          .order('nom')
          .limit(RESULTS_PER_TYPE),
        
        // Groupes
        supabase
          .from('groupes_etablissements')
          .select('id, nom')
          .ilike('nom', `%${searchQuery}%`)
          .order('nom')
          .limit(RESULTS_PER_TYPE),

        // Événements calendrier
        supabase
          .from('calendar_events')
          .select('id, title, start_time')
          .ilike('title', `%${searchQuery}%`)
          .gte('start_time', new Date().toISOString())
          .order('start_time')
          .limit(RESULTS_PER_TYPE),

        // Partenaires
        supabase
          .from('partenaires')
          .select('id, nom, type_partenaire, ville')
          .ilike('nom', `%${searchQuery}%`)
          .order('nom')
          .limit(RESULTS_PER_TYPE),
      ]);

      setResults({
        etablissements: (etablissementsRes.data || []).map(e => ({
          id: e.id,
          type: 'etablissement' as EntityType,
          name: e.nom,
          subtitle: e.ville,
          icon: Building2,
          url: `/etablissements/${e.id}`,
        })),
        taches: (tachesRes.data || []).map(t => ({
          id: t.id,
          type: 'tache' as EntityType,
          name: t.titre,
          subtitle: t.statut,
          icon: CheckSquare,
          url: `/etablissements?tache=${t.id}`,
        })),
        contacts: (contactsRes.data || []).map(c => ({
          id: c.id,
          type: 'contact' as EntityType,
          name: `${c.prenom || ''} ${c.nom}`.trim(),
          subtitle: c.fonction,
          icon: User,
          url: `/contacts/${c.id}`,
        })),
        groupes: (groupesRes.data || []).map(g => ({
          id: g.id,
          type: 'groupe' as EntityType,
          name: g.nom,
          icon: Users,
          url: `/groupes/${g.id}`,
        })),
        evenements: (evenementsRes.data || []).map(ev => ({
          id: ev.id,
          type: 'evenement' as EntityType,
          name: ev.title,
          subtitle: new Date(ev.start_time).toLocaleDateString('fr-FR'),
          icon: Calendar,
          url: `/calendrier?event=${ev.id}`,
        })),
        partenaires: (partenairesRes.data || []).map(p => ({
          id: p.id,
          type: 'partenaire' as EntityType,
          name: p.nom,
          subtitle: p.type_partenaire || p.ville || undefined,
          icon: Handshake,
          url: `/partenaires/${p.id}`,
        })),
      });
    } catch (error) {
      debug.error('Entity search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    searchEntities(debouncedQuery);
  }, [debouncedQuery, searchEntities]);

  const allResults = [
    ...results.etablissements,
    ...results.taches,
    ...results.contacts,
    ...results.groupes,
    ...results.evenements,
    ...results.partenaires,
  ];

  const hasResults = allResults.length > 0;

  const clearResults = useCallback(() => {
    setResults({
      etablissements: [],
      taches: [],
      contacts: [],
      groupes: [],
      evenements: [],
      partenaires: [],
    });
  }, []);

  return {
    results,
    allResults,
    hasResults,
    isSearching,
    clearResults,
  };
}
