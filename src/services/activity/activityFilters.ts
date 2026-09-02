import { supabase } from '@/integrations/supabase/client';

/**
 * Services activité — filtres du fil d'activité (audit Fable 5).
 */

export interface ActivityFilterPerson {
  id: string;
  name: string;
}

export const fetchActivityTeam = async (): Promise<ActivityFilterPerson[]> => {
  const { data } = await supabase
    .from('profiles')
    .select('user_id, prenom, nom')
    .order('prenom');
  return (data || []).map((p: any) => ({
    id: p.user_id,
    name: `${p.prenom || ''} ${p.nom || ''}`.trim() || 'Sans nom',
  }));
};

export const fetchActivityEtablissements = async (): Promise<ActivityFilterPerson[]> => {
  const { data } = await supabase
    .from('etablissements')
    .select('id, nom')
    .order('nom')
    .limit(500);
  return (data || []).map((e: any) => ({ id: e.id, name: e.nom }));
};
