/**
 * Extensions de types pour les tables Supabase non encore générées
 *
 * Ces types permettent de typer les tables ajoutées après la dernière génération
 * des types Supabase. Ce fichier devrait être supprimé une fois les types régénérés.
 */

import type { DashboardLayout } from '@/hooks/dashboard/useDashboardLayout'

// ============= Dashboard Layouts =============

/** Interface pour la table dashboard_layouts */
export interface DashboardLayoutRow {
  id: string
  user_id: string
  team: string
  layout: DashboardLayout
  created_at: string
  updated_at: string
}

export interface DashboardLayoutInsert {
  user_id: string
  team: string
  layout: DashboardLayout
  updated_at?: string
}

export interface DashboardLayoutUpdate {
  layout?: DashboardLayout
  updated_at?: string
}

// ============= Dashboard Notes =============

/** Interface pour la table dashboard_notes */
export interface DrawingStroke {
  points: Array<{ x: number; y: number; p?: number }>
  color: string
  size: number
  tool?: 'pen' | 'highlighter' | 'eraser'
}

export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple' | 'gray'

export interface DashboardNoteRow {
  id: string
  user_id: string
  tab_name: string
  content: string
  tab_order: number
  created_at: string
  updated_at: string
  drawings?: DrawingStroke[] | null
  color?: NoteColor | null
}

export interface DashboardNoteInsert {
  user_id: string
  tab_name: string
  content?: string
  tab_order?: number
  drawings?: DrawingStroke[]
  color?: NoteColor
}

export interface DashboardNoteUpdate {
  tab_name?: string
  content?: string
  tab_order?: number
  drawings?: DrawingStroke[]
  color?: NoteColor
}

// ============= User Feedbacks =============

/** Interface pour la table user_feedbacks */
export interface UserFeedbackRow {
  id: string
  user_id: string
  type: 'bug' | 'feature' | 'feedback' | 'question'
  message: string
  status: 'pending' | 'reviewed' | 'resolved'
  response: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface UserFeedbackInsert {
  user_id: string
  type: 'bug' | 'feature' | 'feedback' | 'question'
  message: string
  status?: 'pending' | 'reviewed' | 'resolved'
}

// ============= Pulse Conversations =============

/** Interface pour la table pulse_conversations */
export interface PulseConversationRow {
  id: string
  name: string
  description: string | null
  visibility: 'private' | 'team' | 'public'
  etablissement_id: string | null
  created_by: string
  metadata: Record<string, unknown>
  is_archived: boolean
  archived_at: string | null
  archived_by: string | null
  created_at: string
  updated_at: string
}

export interface PulseConversationInsert {
  name: string
  description?: string | null
  visibility?: 'private' | 'team' | 'public'
  etablissement_id?: string | null
  created_by: string
  metadata?: Record<string, unknown>
}

export interface PulseConversationUpdate {
  name?: string
  description?: string | null
  visibility?: 'private' | 'team' | 'public'
  is_archived?: boolean
  archived_at?: string | null
  archived_by?: string | null
  metadata?: Record<string, unknown>
  updated_at?: string
}

// ============= Pulse Conversation Members =============

/** Interface pour la table pulse_conversation_members */
export interface PulseConversationMemberRow {
  id: string
  conversation_id: string
  user_id: string
  role: 'admin' | 'member' | 'guest'
  notification_level: string | null
  last_read_at: string | null
  invited_by: string | null
  joined_at: string
}

export interface PulseConversationMemberInsert {
  conversation_id: string
  user_id: string
  role?: 'admin' | 'member' | 'guest'
  invited_by?: string
}

// ============= Pulse Messages =============

/** Interface pour la table pulse_messages (insert) */
export interface PulseMessageInsert {
  conversation_id: string
  user_id: string
  content: string
  content_html?: string | null
  parent_message_id?: string | null
  mentions?: string[]
  message_type?: 'text' | 'system' | 'file'
}

export interface PulseMessageUpdate {
  content?: string
  content_html?: string | null
  edited_at?: string
  edited_by?: string
  deleted_at?: string | null
  deleted_by?: string | null
  deletion_reason?: string | null
}

// ============= Pulse Message Hides =============

/** Interface pour la table pulse_message_hides */
export interface PulseMessageHideRow {
  id: string
  message_id: string
  user_id: string
  hidden_at: string
}

export interface PulseMessageHideInsert {
  message_id: string
  user_id: string
  hidden_at?: string
}

// ============= Pulse Reactions =============

/** Interface pour la table pulse_reactions */
export interface PulseReactionRow {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface PulseReactionInsert {
  message_id: string
  user_id: string
  emoji: string
}

// ============= Pulse Message Archive =============

/** Interface pour la table pulse_message_archive */
export interface PulseMessageArchiveRow {
  id: string
  original_message_id: string
  conversation_id: string
  content_snapshot: {
    content: string
    content_html: string | null
    mentions: string[]
  }
  deleted_at: string
  deleted_by: string | null
  deletion_reason: string | null
  restored: boolean
  restored_at: string | null
  restored_by: string | null
}

export interface PulseMessageArchiveUpdate {
  restored?: boolean
  restored_at?: string | null
  restored_by?: string | null
}

// ============= Pulse Message Task Links =============

/** Interface pour la table pulse_message_task_links */
export interface PulseMessageTaskLinkRow {
  id: string
  message_id: string
  task_id: string
  conversation_id?: string
  link_type: 'reference' | 'created_from' | 'mentions'
  created_by: string
  created_at: string
}

export interface PulseMessageTaskLinkInsert {
  message_id: string
  task_id: string
  conversation_id?: string
  link_type: 'reference' | 'created_from' | 'mentions'
  created_by: string
}

// ============= User Email Accounts Safe (View) =============

/** Interface pour la vue user_email_accounts_safe */
export interface UserEmailAccountSafeRow {
  id: string
  email_address: string
  is_active: boolean
}

// ============= Etablissements Emargement Public (View) =============

/** Interface pour la vue etablissements_emargement_public - Données minimales pour émargement */
export interface EtablissementEmargementPublicRow {
  id: string
  nom: string
  ville: string
}

// ============= Contact Helpers =============

/** Type helper pour les insertions dynamiques de contacts */
export interface ContactInsertData {
  nom: string
  prenom?: string | null
  email?: string | null
  telephone?: string | null
  fonction?: string | null
  etablissement_id?: string | null
  partenaire_id?: string | null
  groupe_id?: string | null
  type_contact?: string
  niveau_contact?: string
  created_source?: 'email_ai' | 'manual' | 'import'
  created_metadata?: {
    email_thread_id?: string | null
    confidence?: number
    approved_at?: string
    reviewed_by?: string | null
  }
}

/** Type helper pour les insertions de contacts partenaires */
export interface PartenaireContactInsertData {
  nom: string
  prenom?: string | null
  email?: string | null
  telephone?: string | null
  fonction?: string | null
  partenaire_id: string
  created_source?: 'email_ai' | 'manual' | 'import'
  created_metadata?: {
    email_thread_id?: string | null
    confidence?: number
    approved_at?: string
    reviewed_by?: string | null
  }
}

// ============= JARVIS Tables =============

/** Interface pour la table jarvis_user_memory */
export interface JarvisUserMemoryRow {
  id: string
  user_id: string
  category: 'preference' | 'fact' | 'instruction' | 'context'
  key: string
  value: string
  metadata: Record<string, unknown>
  importance: number
  created_at: string
  updated_at: string
  expires_at: string | null
}

export interface JarvisUserMemoryInsert {
  user_id: string
  category: 'preference' | 'fact' | 'instruction' | 'context'
  key: string
  value: string
  importance?: number
  metadata?: Record<string, unknown>
  expires_at?: string | null
}

export interface JarvisUserMemoryUpdate {
  value?: string
  importance?: number
  metadata?: Record<string, unknown>
  expires_at?: string | null
  updated_at?: string
}

/** Interface pour la table jarvis_action_context */
export interface JarvisActionContextRow {
  id: string
  user_id: string
  action_type: string
  action_data: Record<string, unknown>
  status: 'in_progress' | 'paused' | 'completed' | 'failed' | 'cancelled'
  original_message: string | null
  conversation_id: string | null
  last_interaction_at: string
  created_at: string
}

export interface JarvisActionContextInsert {
  user_id: string
  action_type: string
  action_data: Record<string, unknown>
  status?: 'in_progress' | 'paused' | 'completed' | 'failed' | 'cancelled'
  original_message?: string | null
  conversation_id?: string | null
}

export interface JarvisActionContextUpdate {
  status?: 'in_progress' | 'paused' | 'completed' | 'failed' | 'cancelled'
  last_interaction_at?: string
}

/** Interface pour la table jarvis_background_jobs */
export interface JarvisBackgroundJobRow {
  id: string
  user_id: string
  action_type: string
  action_data: Record<string, unknown>
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  result: Record<string, unknown> | null
  error_message: string | null
  retry_count: number
  max_retries: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface JarvisBackgroundJobInsert {
  user_id: string
  action_type: string
  action_data: Record<string, unknown>
  status?: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  max_retries?: number
}

export interface JarvisBackgroundJobUpdate {
  status?: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  result?: Record<string, unknown> | null
  error_message?: string | null
  retry_count?: number
  started_at?: string | null
  completed_at?: string | null
}

/** Interface pour la table jarvis_proactive_alerts */
export interface JarvisProactiveAlertRow {
  id: string
  user_id: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  action_type: string
  action_data: Record<string, unknown>
  read: boolean
  dismissed: boolean
  created_at: string
}

/** Interface pour la table jarvis_action_templates */
export interface JarvisActionTemplateRow {
  id: string
  user_id: string | null
  name: string
  description: string | null
  action_type: string
  template_data: Record<string, string>
  variables: string[]
  usage_count: number
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface JarvisActionTemplateInsert {
  user_id?: string | null
  name: string
  description?: string | null
  action_type: string
  template_data: Record<string, string>
  variables?: string[]
  is_system?: boolean
}

export interface JarvisActionTemplateUpdate {
  name?: string
  description?: string | null
  template_data?: Record<string, string>
  variables?: string[]
  usage_count?: number
}

// ============= Extended Tables Type Map =============

/**
 * Type map pour toutes les tables étendues non générées
 * Utilisé par le helper fromExtended()
 */
export interface ExtendedTablesMap {
  dashboard_layouts: {
    Row: DashboardLayoutRow
    Insert: DashboardLayoutInsert
    Update: DashboardLayoutUpdate
  }
  dashboard_notes: {
    Row: DashboardNoteRow
    Insert: DashboardNoteInsert
    Update: DashboardNoteUpdate
  }
  user_feedbacks: {
    Row: UserFeedbackRow
    Insert: UserFeedbackInsert
  }
  pulse_conversations: {
    Row: PulseConversationRow
    Insert: PulseConversationInsert
    Update: PulseConversationUpdate
  }
  pulse_conversation_members: {
    Row: PulseConversationMemberRow
    Insert: PulseConversationMemberInsert
  }
  pulse_messages: {
    Insert: PulseMessageInsert
    Update: PulseMessageUpdate
  }
  pulse_message_hides: {
    Row: PulseMessageHideRow
    Insert: PulseMessageHideInsert
  }
  pulse_reactions: {
    Row: PulseReactionRow
    Insert: PulseReactionInsert
  }
  pulse_message_archive: {
    Row: PulseMessageArchiveRow
    Update: PulseMessageArchiveUpdate
  }
  pulse_message_task_links: {
    Row: PulseMessageTaskLinkRow
    Insert: PulseMessageTaskLinkInsert
  }
  user_email_accounts_safe: {
    Row: UserEmailAccountSafeRow
  }
  // JARVIS tables
  jarvis_user_memory: {
    Row: JarvisUserMemoryRow
    Insert: JarvisUserMemoryInsert
    Update: JarvisUserMemoryUpdate
  }
  jarvis_action_context: {
    Row: JarvisActionContextRow
    Insert: JarvisActionContextInsert
    Update: JarvisActionContextUpdate
  }
  jarvis_background_jobs: {
    Row: JarvisBackgroundJobRow
    Insert: JarvisBackgroundJobInsert
    Update: JarvisBackgroundJobUpdate
  }
  jarvis_proactive_alerts: {
    Row: JarvisProactiveAlertRow
  }
  jarvis_action_templates: {
    Row: JarvisActionTemplateRow
    Insert: JarvisActionTemplateInsert
    Update: JarvisActionTemplateUpdate
  }
  // Tables existantes dans Supabase mais avec typage étendu
  avoirs: {
    Row: unknown
    Insert: unknown
    Update: unknown
  }
  avoirs_lignes: {
    Row: unknown
    Insert: unknown
    Update: unknown
  }
  previsions_pipeline: {
    Row: unknown
    Insert: unknown
    Update: unknown
  }
  // Public views for emargement feature
  etablissements_emargement_public: {
    Row: EtablissementEmargementPublicRow
  }
  // View for documents page
  etablissements_with_documents: {
    Row: {
      id: string
      nom: string
      ville: string | null
      logo_url: string | null
      etablissement_logo_url: string | null
      groupe_logo_url: string | null
      groupe_nom: string | null
      statut: string | null
      document_count: number
    }
  }
  // Pulse media table
  pulse_media: {
    Row: {
      id: string
      message_id: string
      file_url: string
      thumbnail_url: string | null
      file_type: string
      file_name: string
      size_bytes: number
      mime_type: string
      storage_path: string
      created_at: string
    }
    Insert: {
      message_id: string
      file_url: string
      thumbnail_url?: string | null
      file_type: string
      file_name: string
      size_bytes: number
      mime_type: string
      storage_path: string
    }
  }
  // ============= CSM Tables =============
  csm_parcours_jalons: {
    Row: {
      id: string
      etablissement_id: string
      jalon_type: string
      statut: string | null
      date_jalon: string | null
      notes: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      etablissement_id: string
      jalon_type: string
      statut?: string | null
      date_jalon?: string | null
      notes?: string | null
    }
    Update: {
      statut?: string | null
      date_jalon?: string | null
      notes?: string | null
    }
  }
  csm_facturation_suivi: {
    Row: {
      id: string
      etablissement_id: string
      modele_facturation: string | null
      date_deploiement: string | null
      date_debut_periode: string | null
      date_fin_periode: string | null
      derniere_relance: string | null
      facturation_effectuee: string | null
      notes: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      etablissement_id: string
      modele_facturation?: string | null
      date_deploiement?: string | null
      date_debut_periode?: string | null
      date_fin_periode?: string | null
      derniere_relance?: string | null
      facturation_effectuee?: string | null
      notes?: string | null
    }
    Update: {
      modele_facturation?: string | null
      date_deploiement?: string | null
      date_debut_periode?: string | null
      date_fin_periode?: string | null
      derniere_relance?: string | null
      facturation_effectuee?: string | null
      notes?: string | null
    }
  }
  csm_kpis_mensuels: {
    Row: {
      id: string
      etablissement_id: string
      mois: string
      taux_uhcd_backend: number | null
      taux_uhcd_compte: number | null
      palier_eme: string | null
      objectif_eme: string | null
      taux_utilisation: number | null
      passages_total: number | null
      dossiers_traites: number | null
      eme: string | null
      sort_order: number | null
      created_at: string
      updated_at: string
    }
    Insert: {
      etablissement_id: string
      mois: string
      taux_uhcd_backend?: number | null
      taux_uhcd_compte?: number | null
      palier_eme?: string | null
      objectif_eme?: string | null
      taux_utilisation?: number | null
      passages_total?: number | null
      dossiers_traites?: number | null
      eme?: string | null
      sort_order?: number | null
    }
    Update: {
      mois?: string
      taux_uhcd_backend?: number | null
      taux_uhcd_compte?: number | null
      palier_eme?: string | null
      objectif_eme?: string | null
      taux_utilisation?: number | null
      passages_total?: number | null
      dossiers_traites?: number | null
      eme?: string | null
      sort_order?: number | null
    }
  }
  csm_kpis_trimestriels: {
    Row: {
      id: string
      etablissement_id: string
      periode: string
      taux_satisfaction: number | null
      dossiers_traites: number | null
      taux_utilisation_formatage: number | null
      taux_utilisation_ocr: number | null
      taux_utilisation_cotations: number | null
      taux_utilisation_courriers: number | null
      taux_utilisation_traduction: number | null
      taux_utilisation_examens: number | null
      taux_utilisation_chatbot: number | null
      taux_uhcd_marque: number | null
      taux_uhcd_compte: number | null
      ccm2_plus: number | null
      ccmu3_plus: number | null
      avis_specialise: number | null
      temps_passage_urgences: number | null
      sort_order: number | null
      created_at: string
      updated_at: string
    }
    Insert: {
      etablissement_id: string
      periode: string
      sort_order?: number | null
    }
    Update: {
      periode?: string
      taux_satisfaction?: number | null
      dossiers_traites?: number | null
      taux_utilisation_formatage?: number | null
      taux_utilisation_ocr?: number | null
      taux_utilisation_cotations?: number | null
      taux_utilisation_courriers?: number | null
      taux_utilisation_traduction?: number | null
      taux_utilisation_examens?: number | null
      taux_utilisation_chatbot?: number | null
      taux_uhcd_marque?: number | null
      taux_uhcd_compte?: number | null
      ccm2_plus?: number | null
      ccmu3_plus?: number | null
      avis_specialise?: number | null
      temps_passage_urgences?: number | null
      sort_order?: number | null
    }
  }
  csm_sante_comptes: {
    Row: {
      id: string
      etablissement_id: string
      weather: string | null
      taux_utilisation: number | null
      taux_utilisation_trend: string | null
      taux_uhcd: number | null
      taux_uhcd_trend: string | null
      objectif_eme: string | null
      dossiers_traites: number | null
      passages_total: number | null
      periode_reference: string | null
      resume_sante: string | null
      actions: unknown
      created_at: string
      updated_at: string
    }
    Insert: {
      etablissement_id: string
      weather?: string | null
      taux_utilisation?: number | null
      taux_utilisation_trend?: string | null
      taux_uhcd?: number | null
      taux_uhcd_trend?: string | null
      objectif_eme?: string | null
      dossiers_traites?: number | null
      passages_total?: number | null
      periode_reference?: string | null
      resume_sante?: string | null
      actions?: unknown
    }
    Update: {
      weather?: string | null
      taux_utilisation?: number | null
      taux_utilisation_trend?: string | null
      taux_uhcd?: number | null
      taux_uhcd_trend?: string | null
      objectif_eme?: string | null
      dossiers_traites?: number | null
      passages_total?: number | null
      periode_reference?: string | null
      resume_sante?: string | null
      actions?: unknown
    }
  }
}

export type ExtendedTableName = keyof ExtendedTablesMap
