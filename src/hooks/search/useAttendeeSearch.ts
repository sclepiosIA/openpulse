import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sanitizePostgrestValue, buildIlikeOrFilter } from '@/lib/sanitize';

export interface AttendeeSearchResult {
  id: string;
  email: string;
  displayName: string;
  type: 'profile' | 'contact';
  userId?: string;
  fonction?: string;
  etablissement?: string;
  groupe?: string;
}

export function useAttendeeSearch(searchQuery: string) {
  return useQuery({
    queryKey: ['attendee-search', searchQuery],
    queryFn: async (): Promise<AttendeeSearchResult[]> => {
      if (!searchQuery || searchQuery.length < 2) return [];

      const sanitized = sanitizePostgrestValue(searchQuery);
      if (!sanitized) return [];

      // Parallel queries for profiles and contacts
      const [profilesResult, contactsResult] = await Promise.all([
        // 1. Profiles (équipe interne)
        supabase
          .from('profiles')
          .select('id, prenom, nom, email, fonction')
          .eq('actif', true)
          .or(buildIlikeOrFilter(['prenom', 'nom', 'email'], sanitized))
          .limit(10),

        // 2. Contacts (établissements et groupes)
        supabase
          .from('contacts')
          .select(`
            id, 
            prenom, 
            nom, 
            email, 
            fonction,
            etablissement_id,
            groupe_id
          `)
          .not('email', 'is', null)
          .or(buildIlikeOrFilter(['prenom', 'nom', 'email'], sanitized))
          .limit(20),
      ]);

      const results: AttendeeSearchResult[] = [];
      const seenEmails = new Set<string>();

      // Add profiles (highest priority)
      if (profilesResult.data) {
        for (const p of profilesResult.data) {
          if (p.email && !seenEmails.has(p.email.toLowerCase())) {
            seenEmails.add(p.email.toLowerCase());
            results.push({
              id: p.id,
              email: p.email,
              displayName: [p.prenom, p.nom].filter(Boolean).join(' ') || p.email,
              type: 'profile',
              userId: p.id,
              fonction: p.fonction || undefined,
            });
          }
        }
      }

      // Add contacts
      if (contactsResult.data) {
        // Fetch etablissements and groupes names in batch
        const etablissementIds = [...new Set(contactsResult.data.filter(c => c.etablissement_id).map(c => c.etablissement_id as string))];
        const groupeIds = [...new Set(contactsResult.data.filter(c => c.groupe_id).map(c => c.groupe_id as string))];

        const [etablissementsRes, groupesRes] = await Promise.all([
          etablissementIds.length > 0 
            ? supabase.from('etablissements').select('id, nom').in('id', etablissementIds)
            : Promise.resolve({ data: [] }),
          groupeIds.length > 0
            ? supabase.from('groupes_etablissements').select('id, nom').in('id', groupeIds)
            : Promise.resolve({ data: [] }),
        ]);

        const etablissementsMap = new Map((etablissementsRes.data || []).map(e => [e.id, e.nom]));
        const groupesMap = new Map((groupesRes.data || []).map(g => [g.id, g.nom]));

        for (const c of contactsResult.data) {
          if (c.email && !seenEmails.has(c.email.toLowerCase())) {
            seenEmails.add(c.email.toLowerCase());
            results.push({
              id: c.id,
              email: c.email,
              displayName: [c.prenom, c.nom].filter(Boolean).join(' ') || c.email,
              type: 'contact',
              fonction: c.fonction || undefined,
              etablissement: c.etablissement_id ? etablissementsMap.get(c.etablissement_id) : undefined,
              groupe: c.groupe_id ? groupesMap.get(c.groupe_id) : undefined,
            });
          }
        }
      }

      return results;
    },
    enabled: searchQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}
