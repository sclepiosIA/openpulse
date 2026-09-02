import { supabase } from '@/integrations/supabase/client';

export type EtablissementWithVilleType = {
  id: string;
  nom: string;
  ville: string | null;
  type: string | null;
};

export type GroupeLite = { id: string; nom: string; type?: string | null };

export type PartenaireLite = {
  id: string;
  nom: string;
  ville: string | null;
  type_partenaire: string | null;
};

export async function fetchEtablissementsWithVilleType(): Promise<EtablissementWithVilleType[]> {
  const { data } = await supabase
    .from('etablissements')
    .select('id, nom, ville, type')
    .order('nom');
  return (data ?? []) as EtablissementWithVilleType[];
}

export async function fetchEtablissementsWithVille(): Promise<Array<{ id: string; nom: string; ville: string | null }>> {
  const { data } = await supabase
    .from('etablissements')
    .select('id, nom, ville')
    .order('nom');
  return (data ?? []) as Array<{ id: string; nom: string; ville: string | null }>;
}

export async function fetchGroupesLite(opts?: { withType?: boolean }): Promise<GroupeLite[]> {
  const cols = opts?.withType ? 'id, nom, type' : 'id, nom';
  const { data } = await supabase
    .from('groupes_etablissements')
    .select(cols)
    .order('nom');
  return (data ?? []) as unknown as GroupeLite[];
}

export async function fetchPartenairesLite(): Promise<PartenaireLite[]> {
  const { data } = await supabase
    .from('partenaires')
    .select('id, nom, ville, type_partenaire')
    .order('nom');
  return (data ?? []) as PartenaireLite[];
}
