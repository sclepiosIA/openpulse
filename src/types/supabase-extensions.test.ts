 

const { DASHBOARD_LAYOUT_SAMPLE } = vi.hoisted(() => ({
  DASHBOARD_LAYOUT_SAMPLE: { version: 1, items: [] },
}));

vi.mock('@/hooks/dashboard/useDashboardLayout', () => ({
  DashboardLayout: DASHBOARD_LAYOUT_SAMPLE,
}));


import type {
  UserFeedbackInsert,
  PulseMessageInsert,
  PulseMessageUpdate,
  PulseReactionInsert,
  UserEmailAccountSafeRow,
  JarvisUserMemoryInsert,
  JarvisBackgroundJobUpdate,
  ExtendedTablesMap,
} from './supabase-extensions';

describe('supabase-extensions (types only module)', () => {
  it('n’expose pas d’export runtime (interfaces uniquement)', async () => {
    const mod = await import('./supabase-extensions');
    expect(Object.keys(mod)).toEqual([]);
  });

  it('UserFeedbackInsert: structure et unions attendues', () => {
    expectTypeOf<UserFeedbackInsert>().toMatchTypeOf<{
      user_id: string;
      type: 'bug' | 'feature' | 'feedback' | 'question';
      message: string;
      status?: 'pending' | 'reviewed' | 'resolved';
    }>();

    // Négatif: type invalide pour "type"
    expectTypeOf<{ user_id: string; type: 'other'; message: string }>().not.toMatchTypeOf<UserFeedbackInsert>();
    // Négatif: status invalide
    expectTypeOf<{ user_id: string; type: 'bug'; message: string; status: 'done' }>().not.toMatchTypeOf<UserFeedbackInsert>();
  });

  it('PulseMessageInsert: champs requis/optionnels', () => {
    // Minimal requis
    expectTypeOf<{ conversation_id: string; user_id: string; content: string }>().toMatchTypeOf<PulseMessageInsert>();
    // Optionnels (mentions, parent_message_id, content_html, message_type)
    expectTypeOf<{
      conversation_id: string;
      user_id: string;
      content: string;
      content_html: string | null;
      parent_message_id: string | null;
      mentions: string[];
      message_type: 'text' | 'system' | 'file';
    }>().toMatchTypeOf<PulseMessageInsert>();

    // Négatif: mauvais type pour mentions
    expectTypeOf<{
      conversation_id: string;
      user_id: string;
      content: string;
      mentions: number[];
    }>().not.toMatchTypeOf<PulseMessageInsert>();
  });

  it('PulseMessageUpdate: champs optionnels pour edit/delete', () => {
    expectTypeOf<{
      content?: string;
      content_html?: string | null;
      edited_at?: string;
      edited_by?: string;
      deleted_at?: string | null;
      deleted_by?: string | null;
      deletion_reason?: string | null;
    }>().toMatchTypeOf<PulseMessageUpdate>();

    // Négatif: edited_at incorrect
    expectTypeOf<{ edited_at: number }>().not.toMatchTypeOf<PulseMessageUpdate>();
  });

  it('PulseReactionInsert: structure simple', () => {
    expectTypeOf<{
      message_id: string;
      user_id: string;
      emoji: string;
    }>().toMatchTypeOf<PulseReactionInsert>();
  });

  it('UserEmailAccountSafeRow: champs attendus', () => {
    expectTypeOf<{
      id: string;
      email_address: string;
      is_active: boolean;
    }>().toMatchTypeOf<UserEmailAccountSafeRow>();

    expectTypeOf<{ id: string; email_address: string; is_active: string }>().not.toMatchTypeOf<UserEmailAccountSafeRow>();
  });

  it('JarvisUserMemoryInsert: unions et optionnels', () => {
    // Minimal
    expectTypeOf<{
      user_id: string;
      category: 'preference' | 'fact' | 'instruction' | 'context';
      key: string;
      value: string;
    }>().toMatchTypeOf<JarvisUserMemoryInsert>();

    // Avec optionnels
    expectTypeOf<{
      user_id: string;
      category: 'context';
      key: string;
      value: string;
      importance?: number;
      metadata?: Record<string, unknown>;
      expires_at?: string | null;
    }>().toMatchTypeOf<JarvisUserMemoryInsert>();

    // Négatif: catégorie invalide
    expectTypeOf<{
      user_id: string;
      category: 'unknown';
      key: string;
      value: string;
    }>().not.toMatchTypeOf<JarvisUserMemoryInsert>();
  });

  it('JarvisBackgroundJobUpdate: unions correctes', () => {
    expectTypeOf<{
      status?: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
      progress?: number;
      result?: Record<string, unknown> | null;
      error_message?: string | null;
      retry_count?: number;
      started_at?: string | null;
      completed_at?: string | null;
    }>().toMatchTypeOf<JarvisBackgroundJobUpdate>();

    expectTypeOf<{ status: 'done' }>().not.toMatchTypeOf<JarvisBackgroundJobUpdate>();
  });

  it('ExtendedTablesMap: contient les clés et sous-types critiques', () => {
    type Map = ExtendedTablesMap;

    // Présence de quelques clés principales
    expectTypeOf<keyof Map>().toMatchTypeOf<
      | 'dashboard_layouts'
      | 'dashboard_notes'
      | 'user_feedbacks'
      | 'pulse_conversations'
      | 'pulse_conversation_members'
      | 'pulse_messages'
      | 'pulse_message_hides'
      | 'pulse_reactions'
      | 'pulse_message_archive'
      | 'pulse_message_task_links'
      | 'user_email_accounts_safe'
      | 'jarvis_user_memory'
      | 'jarvis_action_context'
      | 'jarvis_background_jobs'
      | 'jarvis_proactive_alerts'
      | 'jarvis_action_templates'
      | 'avoirs'
      | 'avoirs_lignes'
      | 'previsions_pipeline'
      | 'etablissements_emargement_public'
      | 'etablissements_with_documents'
      | 'pulse_media'
      | 'csm_parcours_jalons'
      | 'csm_facturation_suivi'
    >();

    // Type Insert de pulse_media
    expectTypeOf<Map['pulse_media']['Insert']>().toMatchTypeOf<{
      message_id: string;
      file_url: string;
      thumbnail_url?: string | null;
      file_type: string;
      file_name: string;
      size_bytes: number;
      mime_type: string;
      storage_path: string;
    }>();

    // Type Row de etablissements_with_documents
    expectTypeOf<Map['etablissements_with_documents']['Row']>().toMatchTypeOf<{
      id: string;
      nom: string;
      ville: string | null;
      logo_url: string | null;
      etablissement_logo_url: string | null;
      groupe_logo_url: string | null;
      groupe_nom: string | null;
      statut: string | null;
      document_count: number;
    }>();

    // pulse_messages: présence de Insert et Update
    expectTypeOf<Map['pulse_messages']>().toMatchTypeOf<{
      Insert: PulseMessageInsert;
      Update: PulseMessageUpdate;
    }>();
  });
});