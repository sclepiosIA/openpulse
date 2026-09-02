import { supabase } from '@/integrations/supabase/client';

/**
 * Chantier #4 (audit 2026-06-02) — helper signed URL pour les
 * documents de contrats stockés dans le bucket `contrats`.
 */
export async function createContratSignedUrl(path: string, expiresInSec = 300): Promise<string> {
  const { data, error } = await supabase.storage
    .from('contrats')
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}
