import { supabase } from '@/integrations/supabase/client';

export type ProfileLite = { id: string; nom: string | null; prenom: string | null; email?: string | null };

export async function fetchProfilesLite(): Promise<ProfileLite[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nom, prenom')
    .order('nom');
  if (error) throw error;
  return (data ?? []) as ProfileLite[];
}

export async function fetchProfilesLiteWithEmail(): Promise<ProfileLite[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nom, prenom, email')
    .order('nom');
  if (error) throw error;
  return (data ?? []) as ProfileLite[];
}
