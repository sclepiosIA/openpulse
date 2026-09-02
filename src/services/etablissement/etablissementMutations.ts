import { supabase } from '@/integrations/supabase/client';

/**
 * Chantier #4 (audit 2026-06-02) — mutations légères côté établissement
 * extraites des composants.
 */
export async function updateEtablissementBackendUrl(
  etablissementId: string,
  backendUrl: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('etablissements')
    .update({ backend_url: backendUrl })
    .eq('id', etablissementId);
  if (error) throw error;
}

export async function updateEtablissementNotes(
  etablissementId: string,
  notes: string,
): Promise<void> {
  const { error } = await supabase
    .from('etablissements')
    .update({ notes })
    .eq('id', etablissementId);
  if (error) throw error;
}

export async function assignCsmToEtablissements(
  etablissementIds: string[],
  csmId: string,
): Promise<void> {
  const { error } = await supabase
    .from('etablissements')
    .update({ csm_id: csmId })
    .in('id', etablissementIds);
  if (error) throw error;
}

export interface BulkTacheInput {
  etablissement_id: string;
  titre: string;
  description?: string | null;
  categorie_id?: string | null;
  responsable_id?: string | null;
  priorite: 'high' | 'medium' | 'low';
  echeance?: string | null;
  statut?: string;
}

export async function bulkInsertTaches(rows: BulkTacheInput[]): Promise<void> {
  const { error } = await supabase.from('taches').insert(rows as never);
  if (error) throw error;
}

export async function fetchEtablissementPendingTasks(
  etablissementId: string,
  limit = 5,
): Promise<any[]> {
  const { data, error } = await supabase
    .from('taches')
    .select('id, titre, priorite, echeance')
    .eq('etablissement_id', etablissementId)
    .eq('statut', 'A faire')
    .order('echeance', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchEtablissementActiveTasksWithCategories(
  etablissementId: string,
  limit = 10,
): Promise<any[]> {
  const { data, error } = await supabase
    .from('taches')
    .select('*, categories_taches (nom, couleur)')
    .eq('etablissement_id', etablissementId)
    .neq('statut', 'Terminé')
    .order('echeance', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchEtablissementRecentActivities(
  etablissementId: string,
  limit = 5,
): Promise<any[]> {
  const { data, error } = await supabase
    .from('customer_activities')
    .select('id, title, activity_type, activity_date')
    .eq('etablissement_id', etablissementId)
    .order('activity_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
