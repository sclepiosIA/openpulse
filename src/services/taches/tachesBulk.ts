import { supabase } from '@/integrations/supabase/client';

/**
 * Services taches — mutations bulk (audit Fable 5).
 */
export const bulkAssignTaches = async (
  ids: string[],
  responsableId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('taches')
    .update({ responsable_id: responsableId })
    .in('id', ids);
  if (error) throw error;
};

export const bulkUpdateTacheStatus = async (
  ids: string[],
  status: string,
  extra: Record<string, unknown> = {},
): Promise<void> => {
  const patch: Record<string, unknown> = { statut: status, ...extra };
  const { error } = await supabase
    .from('taches')
    .update(patch as never)
    .in('id', ids);
  if (error) throw error;
};

export const bulkArchiveTaches = async (ids: string[]): Promise<void> => {
  const { error } = await supabase
    .from('taches')
    .update({ archive: true } as never)
    .in('id', ids);
  if (error) throw error;
};
