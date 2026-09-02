import type { EmailMessage } from "@/types/email";

// Type local plus flexible pour gérer les données Supabase avec relations dynamiques
export interface ThreadData {
  id: string;
  thread_id: string;
  user_email_account_id: string;
  subject: string;
  participants: Record<string, unknown> | null;
  last_message_date: string;
  message_count: number;
  unread_count: number;
  is_archived: boolean;
  is_spam: boolean;
  is_deleted: boolean;
  is_processed?: boolean;
  category: string | null;
  priority: string | null;
  tags: string[];
  etablissement_id: string | null;
  groupe_id: string | null;
  partenaire_id: string | null;
  ai_summary: string | null;
  ai_generated_title: string | null;
  ai_extracted_data: Record<string, unknown> | null;
  ai_confidence_score: number | null;
  needs_manual_review: boolean;
  account?: { email_address: string; display_name?: string | null } | null;
  etablissement?: { id: string; nom: string; ville?: string | null; region?: string | null; statut?: string | null } | null;
  groupe?: { id: string; nom: string } | null;
  partenaire?: { id: string; nom: string; logo_url?: string | null } | null;
  messages?: EmailMessage[];
  [key: string]: unknown; // Allow additional properties from Supabase
}

/** Select string used by EmailThread.fetchThread (kept verbatim, do not edit casually). */
export const EMAIL_THREAD_DETAIL_SELECT = `
  id, thread_id, user_email_account_id, subject, participants,
  last_message_date, message_count, unread_count,
  is_archived, is_spam, is_deleted, is_processed,
  category, priority, tags,
  etablissement_id, groupe_id, partenaire_id,
  ai_summary, ai_generated_title, ai_extracted_data, ai_confidence_score,
  needs_manual_review, created_at, updated_at,
  messages:email_messages(
    id,
    thread_id,
    message_id,
    from_address,
    from_name,
    to_addresses,
    cc_addresses,
    bcc_addresses,
    subject,
    body_html,
    body_text,
    sent_date,
    received_date,
    has_attachments,
    is_sent,
    is_read,
    source_mailbox,
    created_at
  ),
  account:user_email_accounts(id, email_address),
  etablissement:etablissements(
    id,
    nom,
    ville,
    region,
    type,
    statut,
    logo_url,
    progression,
    engagement_score
  ),
  partenaire:partenaires(
    id,
    nom,
    ville,
    logo_url,
    type_partenaire,
    sous_type,
    statut_relation,
    engagement_score,
    dernier_contact,
    prochaine_action,
    valeur_partenariat
  )
` as const;
