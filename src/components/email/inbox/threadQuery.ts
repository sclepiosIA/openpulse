/**
 * Shared select clause for email_threads queries.
 * Kept identical to the original inline string to preserve runtime behavior.
 */
export const EMAIL_THREAD_SELECT = `
  id, thread_id, user_email_account_id, subject, participants,
  last_message_date, message_count, unread_count,
  last_message_from_email, last_message_from_name, last_message_is_sent,
  last_inbound_from_email, last_inbound_from_name, last_inbound_date,
  is_archived, is_spam, is_deleted, is_hors_etablissement, is_processed,
  has_sent_messages, category, priority, tags,
  etablissement_id, groupe_id, partenaire_id,
  ai_summary, ai_generated_title, ai_confidence_score, needs_manual_review,
  created_at, updated_at,
  account:user_email_accounts(email_address),
  etablissement:etablissements(
    id,
    nom,
    ville,
    statut,
    progression,
    relationship_status,
    engagement_score
  ),
  groupe:groupes_etablissements(id, nom, type),
  partenaire:partenaires(id, nom, type_partenaire, ville, statut_relation)
`;

export interface EmailThreadFilters {
  category?: string | null;
  priority?: string | null;
  unreadOnly?: boolean;
  unprocessedOnly?: boolean;
  mailbox?: string | null;
  etablissementId?: string | null;
  groupeId?: string | null;
  partenaireId?: string | null;
}

/**
 * Applies search + category + mailbox + entity filters to a Supabase query
 * targeting email_threads. Mirrors the original logic from EmailInbox.
 * Typed permissively because Supabase's PostgrestFilterBuilder mutates its
 * generic on each call, which would otherwise force callers to re-cast.
 */
export function applyThreadFilters<Q>(
  query: Q,
  opts: { search: string; filters: EmailThreadFilters }
): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = query;
  const { search, filters } = opts;

  if (search) {
    q = q.or(
      `subject.ilike.%${search}%,ai_summary.ilike.%${search}%,ai_generated_title.ilike.%${search}%`
    );
  }
  if (filters.category) q = q.eq('category', filters.category);
  if (filters.priority) q = q.eq('priority', filters.priority);
  if (filters.unreadOnly) q = q.gt('unread_count', 0);
  if (filters.unprocessedOnly) {
    q = q.or('is_processed.eq.false,is_processed.is.null');
  }

  if (filters.mailbox === 'sent') {
    q = q.eq('has_sent_messages', true);
  } else if (filters.mailbox === 'inbox') {
    q = q.or('is_outbound.eq.false,is_outbound.is.null');
  }

  if (filters.etablissementId === 'internal') {
    q = q.eq('category', 'Interne OpenPulse');
  } else if (filters.etablissementId === 'unclassified') {
    q = q
      .is('etablissement_id', null)
      .is('groupe_id', null)
      .is('partenaire_id', null)
      .neq('category', 'Interne OpenPulse');
  } else if (filters.etablissementId) {
    q = q.eq('etablissement_id', filters.etablissementId);
  }

  if (filters.groupeId) q = q.eq('groupe_id', filters.groupeId);
  if (filters.partenaireId) q = q.eq('partenaire_id', filters.partenaireId);

  return q as Q;
}
