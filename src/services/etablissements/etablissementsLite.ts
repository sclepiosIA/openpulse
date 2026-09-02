import { supabase } from '@/integrations/supabase/client';

export type EtablissementLite = { id: string; nom: string };
export type EtablissementLiteVille = { id: string; nom: string; ville: string | null };

export async function fetchEtablissementsLite(): Promise<EtablissementLite[]> {
  const { data } = await supabase
    .from('etablissements')
    .select('id, nom')
    .order('nom');
  return (data ?? []) as EtablissementLite[];
}

export async function fetchEtablissementsLiteWithVille(): Promise<EtablissementLiteVille[]> {
  const { data, error } = await supabase
    .from('etablissements')
    .select('id, nom, ville')
    .order('nom');
  if (error) throw error;
  return (data ?? []) as EtablissementLiteVille[];
}
