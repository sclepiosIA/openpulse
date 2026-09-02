import { supabase } from '@/integrations/supabase/client';

export interface SetupTeamResult {
  email: string;
  status: string;
  profileId?: string;
}

export interface SetupTeamResponse {
  success: boolean;
  results: SetupTeamResult[];
}

/**
 * Chantier #4 (audit 2026-06-02) — couche services/ : encapsulation de
 * l'appel à l'edge function `setup-team-members` pour découpler l'UI
 * du client Supabase.
 */
export async function setupTeamMembers(): Promise<SetupTeamResponse> {
  const { data, error } = await supabase.functions.invoke('setup-team-members', { body: {} });
  if (error) throw error;
  return data as SetupTeamResponse;
}
