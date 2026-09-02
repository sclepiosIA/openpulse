import { describe, it, expect } from 'vitest';
import type {
  EmailAccount,
  EmailAccountSafe,
  Etablissement,
  GroupeEtablissement,
  Partenaire,
  Contact,
  EmailAttachment,
  EmailMessage,
  EmailThread,
  EmailThreadWithRelations,
  EmailDraft,
  EmailFilters,
  EmailSyncStatus,
  EmailClassification,
  PaginatedResult,
  EmailAddress,
  EmailParticipant,
  EmailCategory,
  EmailPriority,
  EmailMailbox,
  ParticipantType,
} from './email';

describe('email.ts types contract', () => {
  it('accepts valid literal unions for categories, priorities, mailbox and participant types', () => {
    const category: EmailCategory = 'support';
    const priority: EmailPriority = 'high';
    const mailbox: EmailMailbox = 'inbox';
    const participantType: ParticipantType = 'cc';

    expect(category).toBe('support');
    expect(priority).toBe('high');
    expect(mailbox).toBe('inbox');
    expect(participantType).toBe('cc');
  });

  it('models EmailAddress and EmailParticipant with business fields', () => {
    const address: EmailAddress = {
      email: 'alice@example.test',
      name: 'Alice',
    };

    const participant: EmailParticipant = {
      email: 'bob@example.test',
      name: null,
      type: 'to',
    };

    expect(address.email).toBe('alice@example.test');
    expect(address.name).toBe('Alice');
    expect(participant.type).toBe('to');
    expect(participant.name).toBeNull();
  });

  it('models EmailAccount and EmailAccountSafe with distinct sync/share fields', () => {
    const account: EmailAccount = {
      id: 'acc-1',
      email_address: 'sales@example.test',
      display_name: 'Sales',
      is_active: true,
      smtp_host: 'smtp.example.test',
      smtp_port: 587,
      imap_host: 'imap.example.test',
      imap_port: 993,
      created_at: '2024-01-01T00:00:00Z',
      last_sync_at: null,
      profile_id: 'profile-1',
    };

    const safeAccount: EmailAccountSafe = {
      id: 'acc-1',
      email_address: 'sales@example.test',
      display_name: 'Sales',
      is_active: true,
      sync_enabled: true,
      is_shared: false,
      last_sync_at: '2024-01-02T10:00:00Z',
      imap_host: 'imap.example.test',
      imap_port: 993,
      smtp_host: 'smtp.example.test',
      smtp_port: 587,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
    };

    expect(account.profile_id).toBe('profile-1');
    expect(account.last_sync_at).toBeNull();
    expect(safeAccount.sync_enabled).toBe(true);
    expect(safeAccount.is_shared).toBe(false);
    expect(safeAccount.updated_at).toBe('2024-01-03T00:00:00Z');
  });

  it('models related business entities for establishments, groups, partners and contacts', () => {
    const etablissement: Etablissement = {
      id: 'eta-1',
      nom: 'Lycée Horizon',
      ville: 'Lyon',
      code_postal: '69000',
      region: 'Auvergne-Rhône-Alpes',
      statut: 'actif',
      type: 'lycee',
      logo_url: null,
    };

    const groupe: GroupeEtablissement = {
      id: 'grp-1',
      nom: 'Réseau Horizon',
      type: 'association',
    };

    const partenaire: Partenaire = {
      id: 'par-1',
      nom: 'Tech Partner',
      ville: 'Paris',
      logo_url: null,
      type_partenaire: 'integration',
    };

    const contact: Contact = {
      id: 'ct-1',
      nom: 'Durand',
      prenom: 'Camille',
      email: 'camille.durand@example.test',
      fonction: 'Directrice',
      etablissement_id: 'eta-1',
      groupe_id: 'grp-1',
    };

    expect(etablissement.nom).toBe('Lycée Horizon');
    expect(groupe.type).toBe('association');
    expect(partenaire.type_partenaire).toBe('integration');
    expect(contact.fonction).toBe('Directrice');
  });

  it('models attachments and messages with mail metadata', () => {
    const attachment: EmailAttachment = {
      id: 'att-1',
      message_id: 'msg-1',
      filename: 'planning.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1024,
      storage_path: 'emails/att-1',
      storage_bucket: 'documents',
      downloaded: true,
      created_at: '2024-03-01T10:00:00Z',
      imap_part_id: '2',
    };

    const message: EmailMessage = {
      id: 'msg-1',
      thread_id: 'thr-1',
      message_id: '<msg-1@example.test>',
      imap_uid: '1001',
      from_address: 'sender@example.test',
      from_name: 'Sender',
      to_addresses: ['dest@example.test'],
      cc_addresses: ['copy@example.test'],
      bcc_addresses: null,
      reply_to: null,
      subject: 'Demande de support',
      body_text: 'Bonjour',
      body_html: '<p>Bonjour</p>',
      sent_date: '2024-03-01T09:59:00Z',
      received_date: '2024-03-01T10:00:00Z',
      is_read: false,
      is_draft: false,
      is_sent: false,
      has_attachments: true,
      attachments_count: 1,
      flags: ['unseen'],
      reference_headers: ['<root@example.test>'],
      in_reply_to: null,
      created_at: '2024-03-01T10:00:01Z',
      attachments: [attachment],
    };

    expect(message.subject).toBe('Demande de support');
    expect(message.has_attachments).toBe(true);
    expect(message.attachments_count).toBe(1);
    expect(message.attachments?.[0]?.filename).toBe('planning.pdf');
  });

  it('models EmailThread with relations and computed fields', () => {
    const thread: EmailThread = {
      id: 'thr-1',
      thread_id: 'conv-1',
      user_email_account_id: 'acc-1',
      subject: 'Réunion de rentrée',
      participants: { from: ['sender@example.test'], to: ['dest@example.test'] },
      last_message_date: '2024-04-01T12:00:00Z',
      message_count: 3,
      unread_count: 2,
      last_message_from_email: 'sender@example.test',
      last_message_from_name: 'Sender',
      last_message_is_sent: false,
      last_inbound_from_email: 'sender@example.test',
      last_inbound_from_name: 'Sender',
      last_inbound_date: '2024-04-01T12:00:00Z',
      is_archived: false,
      is_spam: false,
      is_deleted: false,
      is_hors_etablissement: false,
      is_processed: true,
      processed_at: '2024-04-01T13:00:00Z',
      processed_by: 'user-1',
      category: 'formation',
      priority: 'medium',
      tags: ['urgent', 'parents'],
      etablissement_id: 'eta-1',
      groupe_id: 'grp-1',
      partenaire_id: 'par-1',
      ai_summary: 'Résumé IA',
      ai_generated_title: 'Sujet enrichi',
      ai_extracted_data: { level: 'terminale' },
      ai_confidence_score: 0.92,
      ai_last_processed_at: '2024-04-01T12:30:00Z',
      needs_manual_review: false,
      auto_created_etablissement: false,
      reviewed_by: 'user-2',
      reviewed_at: '2024-04-01T13:30:00Z',
      created_at: '2024-04-01T11:00:00Z',
      updated_at: '2024-04-01T13:30:00Z',
      account: {
        email_address: 'school@example.test',
        display_name: 'Boîte établissement',
      },
      etablissement: {
        id: 'eta-1',
        nom: 'Lycée Horizon',
        ville: 'Lyon',
        region: 'Auvergne-Rhône-Alpes',
      },
      groupe: {
        id: 'grp-1',
        nom: 'Réseau Horizon',
      },
      partenaire: {
        id: 'par-1',
        nom: 'Tech Partner',
      },
      messages: [],
      hasReply: true,
    };

    expect(thread.category).toBe('formation');
    expect(thread.priority).toBe('medium');
    expect(thread.tags).toEqual(['urgent', 'parents']);
    expect(thread.account?.email_address).toBe('school@example.test');
    expect(thread.etablissement?.ville).toBe('Lyon');
    expect(thread.hasReply).toBe(true);
  });

  it('models EmailThreadWithRelations with required account and messages', () => {
    const message: EmailMessage = {
      id: 'msg-2',
      thread_id: 'thr-2',
      message_id: '<msg-2@example.test>',
      imap_uid: '1002',
      from_address: 'teacher@example.test',
      from_name: 'Teacher',
      to_addresses: ['parent@example.test'],
      cc_addresses: null,
      bcc_addresses: null,
      reply_to: null,
      subject: 'Compte-rendu',
      body_text: 'Texte',
      body_html: null,
      sent_date: '2024-05-02T08:00:00Z',
      received_date: '2024-05-02T08:00:00Z',
      is_read: true,
      is_draft: false,
      is_sent: true,
      has_attachments: false,
      attachments_count: 0,
      flags: null,
      reference_headers: null,
      in_reply_to: null,
      created_at: '2024-05-02T08:00:01Z',
    };

    const threadWithRelations: EmailThreadWithRelations = {
      id: 'thr-2',
      thread_id: 'conv-2',
      user_email_account_id: 'acc-1',
      subject: 'Compte-rendu',
      participants: { to: ['parent@example.test'] },
      last_message_date: '2024-05-02T08:00:00Z',
      message_count: 1,
      unread_count: 0,
      is_archived: false,
      is_spam: false,
      is_deleted: false,
      category: 'administratif',
      priority: 'low',
      tags: [],
      etablissement_id: null,
      groupe_id: null,
      partenaire_id: null,
      ai_summary: null,
      ai_generated_title: null,
      ai_extracted_data: null,
      ai_confidence_score: null,
      ai_last_processed_at: null,
      needs_manual_review: false,
      auto_created_etablissement: false,
      reviewed_by: null,
      reviewed_at: null,
      created_at: '2024-05-02T08:00:01Z',
      updated_at: '2024-05-02T08:00:01Z',
      account: {
        email_address: 'admin@example.test',
        display_name: 'Administration',
      },
      messages: [message],
      contacts: [
        {
          id: 'ct-2',
          nom: 'Martin',
          prenom: 'Julie',
          email: 'julie.martin@example.test',
          fonction: 'Parent',
          etablissement_id: 'eta-2',
          groupe_id: null,
        },
      ],
    };

    expect(threadWithRelations.account.display_name).toBe('Administration');
    expect(threadWithRelations.messages[0].is_sent).toBe(true);
    expect(threadWithRelations.contacts?.[0]?.prenom).toBe('Julie');
  });

  it('models drafts, filters, sync status, classification and paginated results', () => {
    const draft: EmailDraft = {
      id: 'dr-1',
      user_id: 'user-1',
      account_id: 'acc-1',
      to_addresses: 'one@example.test,two@example.test',
      cc_addresses: null,
      bcc_addresses: null,
      subject: 'Brouillon',
      body: 'Contenu',
      attachments: [{ id: 'tmp-att-1', name: 'note.txt' }],
      created_at: '2024-06-01T10:00:00Z',
      updated_at: '2024-06-01T10:05:00Z',
    };

    const filters: EmailFilters = {
      search: 'rentrée',
      category: 'commercial',
      priority: 'high',
      unreadOnly: true,
      unprocessedOnly: false,
      hasAttachments: true,
      etablissementId: 'eta-3',
      groupeId: null,
      partenaireId: 'par-9',
      dateFrom: new Date('2024-01-01T00:00:00Z'),
      dateTo: new Date('2024-12-31T23:59:59Z'),
      mailbox: 'all',
    };

    const syncStatus: EmailSyncStatus = {
      is_syncing: true,
      last_sync_at: '2024-06-01T09:00:00Z',
      emails_synced: 42,
      errors_count: 1,
      current_account: 'sales@example.test',
    };

    const classification: EmailClassification = {
      thread_id: 'thr-9',
      category: 'technique',
      priority: 'medium',
      tags: ['incident', 'wifi'],
      confidence_score: 0.88,
      suggested_etablissement_id: 'eta-9',
      suggested_groupe_id: 'grp-9',
      suggested_partenaire_id: 'par-9',
    };

    const paginated: PaginatedResult<EmailThread> = {
      data: [
        {
          id: 'thr-9',
          thread_id: 'conv-9',
          user_email_account_id: 'acc-1',
          subject: 'Panne wifi',
          participants: {},
          last_message_date: '2024-06-01T08:00:00Z',
          message_count: 2,
          unread_count: 1,
          is_archived: false,
          is_spam: false,
          is_deleted: false,
          category: 'technique',
          priority: 'high',
          tags: ['wifi'],
          etablissement_id: null,
          groupe_id: null,
          partenaire_id: null,
          ai_summary: null,
          ai_generated_title: null,
          ai_extracted_data: null,
          ai_confidence_score: null,
          ai_last_processed_at: null,
          needs_manual_review: true,
          auto_created_etablissement: false,
          reviewed_by: null,
          reviewed_at: null,
          created_at: '2024-06-01T08:00:00Z',
          updated_at: '2024-06-01T08:00:00Z',
        },
      ],
      total: 1,
      hasMore: false,
      nextCursor: undefined,
    };

    expect(draft.subject).toBe('Brouillon');
    expect(filters.mailbox).toBe('all');
    expect(filters.unreadOnly).toBe(true);
    expect(syncStatus.emails_synced).toBe(42);
    expect(syncStatus.current_account).toBe('sales@example.test');
    expect(classification.tags).toContain('wifi');
    expect(paginated.total).toBe(1);
    expect(paginated.data[0].subject).toBe('Panne wifi');
    expect(paginated.hasMore).toBe(false);
  });
});