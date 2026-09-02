import { supabase } from '@/integrations/supabase/client';

/**
 * Services `src/services/email/*` — audit Fable 5 · action 90.3.
 *
 * Centralise les accès Supabase des composants email (hover cards, contextes,
 * transferts, invitations calendrier) pour respecter ADR-001 (les composants
 * ne parlent pas au client Supabase en direct).
 */

// Le hover card consomme de nombreux champs dynamiques de `etablissements` ;
// on renvoie un type large pour ne pas dupliquer la surface DB côté service.
// Le typage strict reste au niveau du composant.
export type EtablissementHoverRow = Record<string, any> & {
  id: string;
  taches?: Array<{
    id: string;
    titre: string | null;
    statut: string | null;
    echeance: string | null;
    priorite: string | null;
  }>;
};

export async function fetchEtablissementForHover(etabId: string): Promise<EtablissementHoverRow | null> {
  const { data, error } = await supabase
    .from('etablissements')
    .select('*, taches ( id, titre, statut, echeance, priorite )')
    .eq('id', etabId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as EtablissementHoverRow) ?? null;
}

export type EtabContextTacheRow = {
  id: string;
  titre: string | null;
  statut: string | null;
  echeance: string | null;
  priorite: string | null;
};

export async function fetchActiveTachesForEtablissement(
  etabId: string,
  opts?: { limit?: number },
): Promise<EtabContextTacheRow[]> {
  const { data } = await supabase
    .from('taches')
    .select('id, titre, statut, echeance, priorite')
    .eq('etablissement_id', etabId)
    .in('statut', ['A faire', 'En cours'])
    .order('echeance', { ascending: true, nullsFirst: false })
    .limit(opts?.limit ?? 10);
  return (data ?? []) as EtabContextTacheRow[];
}

export type ThreadSiblingMessage = {
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
};

export async function fetchSiblingMessagesForInvitation(
  threadId: string,
  excludeMessageId: string,
  opts?: { limit?: number },
): Promise<ThreadSiblingMessage[]> {
  const { data } = await supabase
    .from('email_messages')
    .select('subject, body_text, body_html')
    .eq('thread_id', threadId)
    .neq('id', excludeMessageId)
    .order('sent_date', { ascending: false })
    .limit(opts?.limit ?? 10);
  return (data ?? []) as ThreadSiblingMessage[];
}
