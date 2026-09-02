import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

export interface ProfileMapEntry {
  id: string;
  prenom: string;
  nom: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  linkedin_url?: string | null;
}

/**
 * Returns a Map<string, ProfileMapEntry> for fast lookups by profile ID.
 * Also exposes isLoading so consumers can guard against undefined states.
 */
export const useProfilesMap = (): { map: Map<string, ProfileMapEntry>; isLoading: boolean } => {
  const { data, isPending } = useQuery({
    queryKey: ['profiles-map'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_profiles_public');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const map = useMemo(() => {
    const m = new Map<string, ProfileMapEntry>();
    (data || []).forEach((profile: { id: string; prenom: string; nom: string; email: string; avatar_url: string | null; linkedin_url: string | null }) => {
      if (profile.id) {
        const prenom = profile.prenom || '';
        const nom = profile.nom || '';
        m.set(profile.id, {
          id: profile.id,
          prenom,
          nom,
          full_name: `${prenom} ${nom}`.trim() || profile.email || '-',
          email: profile.email || '',
          avatar_url: profile.avatar_url,
          linkedin_url: profile.linkedin_url,
        });
      }
    });
    return m;
  }, [data]);

  return { map, isLoading: isPending };
};
