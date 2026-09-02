import { supabase } from '@/integrations/supabase/client';

/**
 * Chantier #4 (audit 2026-06-02) — mutations atomiques sur `email_threads`.
 */
export async function updateThreadPriority(
  threadId: string,
  priority: 'high' | 'medium' | 'low' | null,
): Promise<void> {
  const { error } = await supabase.from('email_threads').update({ priority }).eq('id', threadId);
  if (error) throw error;
}
