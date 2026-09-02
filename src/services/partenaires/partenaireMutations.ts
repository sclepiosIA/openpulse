import { supabase } from '@/integrations/supabase/client';

/**
 * Services partenaires — mutations rapides (audit Fable 5).
 */
export const savePartenaireNote = async (
  partenaireId: string,
  note: string,
): Promise<void> => {
  const { error } = await supabase
    .from('partenaires')
    .update({
      notes: note,
      dernier_contact: new Date().toISOString(),
    })
    .eq('id', partenaireId);
  if (error) throw error;
};
