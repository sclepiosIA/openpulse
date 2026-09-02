import { supabase } from '@/integrations/supabase/client';

/**
 * Chantier #4 (audit 2026-06-02) — mutations sur le profil utilisateur.
 */
export async function updateProfileEmailSignature(
  profileId: string,
  signature: string,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ email_signature: signature })
    .eq('id', profileId);
  if (error) throw error;
}

export async function updateProfileContactInfo(
  profileId: string,
  patch: { fonction?: string | null; telephone?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', profileId);
  if (error) throw error;
}
