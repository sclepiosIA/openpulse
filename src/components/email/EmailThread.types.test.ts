/* @vitest-environment jsdom */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { EMAIL_THREAD_DETAIL_SELECT } from './EmailThread.types';
import type { ThreadData } from './EmailThread.types';
import type { EmailMessage } from '@/types/email';

const {
  THREAD,
  SELECT_SNIPPETS,
  mockFrom,
  mockSelect,
  mockEq,
  mockGte,
  mockLte,
  mockIn,
  mockOrder,
  mockLimit,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockSingle,
  mockMaybeSingle,
  mockThen,
  mockCatch,
  mockNavigate,
  AUTH_STATE,
  toastSuccess,
  toastError,
} = vi.hoisted(() => {
  const messages: EmailMessage[] = [
    {
      id: 'm1',
      thread_id: 'th_1',
      message_id: 'msg_1',
      from_address: 'alice@example.test',
      from_name: 'Alice',
      to_addresses: ['bob@example.test'],
      cc_addresses: [],
      bcc_addresses: [],
      subject: 'Sujet test',
      body_html: '<p>Bonjour</p>',
      body_text: 'Bonjour',
      sent_date: '2024-01-02T10:00:00.000Z',
      received_date: '2024-01-02T10:01:00.000Z',
      has_attachments: false,
      is_sent: false,
      is_read: true,
      source_mailbox: 'inbox',
      created_at: '2024-01-02T10:01:00.000Z',
    },
    {
      id: 'm2',
      thread_id: 'th_1',
      message_id: 'msg_2',
      from_address: 'bob@example.test',
      from_name: 'Bob',
      to_addresses: ['alice@example.test'],
      cc_addresses: [],
      bcc_addresses: [],
      subject: 'Re: Sujet test',
      body_html: '<p>Réponse</p>',
      body_text: 'Réponse',
      sent_date: '2024-01-03T09:00:00.000Z',
      received_date: '2024-01-03T09:00:30.000Z',
      has_attachments: true,
      is_sent: true,
      is_read: false,
      source_mailbox: 'sent',
      created_at: '2024-01-03T09:00:30.000Z',
    },
  ];

  const thread: ThreadData = {
    id: 't1',
    thread_id: 'th_1',
    user_email_account_id: 'acc_1',
    subject: 'Conversation client',
    participants: { emails: ['alice@example.test', 'bob@example.test'] },
    last_message_date: '2024-01-03T09:00:30.000Z',
    message_count: 2,
    unread_count: 1,
    is_archived: false,
    is_spam: false,
    is_deleted: false,
    is_processed: true,
    category: 'support',
    priority: 'high',
    tags: ['urgent', 'vip'],
    etablissement_id: 'e1',
    groupe_id: 'g1',
    partenaire_id: 'p1',
    ai_summary: 'Résumé IA',
    ai_generated_title: 'Titre IA',
    ai_extracted_data: { sentiment: 'positive' },
    ai_confidence_score: 0.91,
    needs_manual_review: false,
    account: { email_address: 'sales@example.test', display_name: 'Sales' },
    etablissement: { id: 'e1', nom: 'Clinique A', ville: 'Paris', region: 'IDF', statut: 'active' },
    groupe: { id: 'g1', nom: 'Groupe A' },
    partenaire: { id: 'p1', nom: 'Partenaire A', logo_url: null },
    messages,
    created_at: '2024-01-01T08:00:00.000Z',
    updated_at: '2024-01-03T09:00:30.000Z',
  };

  return {
    THREAD: thread,
    SELECT_SNIPPETS: [
      'messages:email_messages(',
      'account:user_email_accounts(id, email_address)',
      'etablissement:etablissements(',
      'partenaire:partenaires(',
      'ai_confidence_score',
      'needs_manual_review',
    ],
    mockFrom: vi.fn(),
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockGte: vi.fn(),
    mockLte: vi.fn(),
    mockIn: vi.fn(),
    mockOrder: vi.fn(),
    mockLimit: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockSingle: vi.fn(),
    mockMaybeSingle: vi.fn(),
    mockThen: vi.fn(),
    mockCatch: vi.fn(),
    mockNavigate: vi.fn(),
    AUTH_STATE: {
      user: { id: 'u1', email: 'tester@example.test' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

function createBuilder(result: { data: unknown; error: { message: string } | null }) {
  const builder = {
    select: mockSelect.mockImplementation(() => builder),
    eq: mockEq.mockImplementation(() => builder),
    gte: mockGte.mockImplementation(() => builder),
    lte: mockLte.mockImplementation(() => builder),
    in: mockIn.mockImplementation(() => builder),
    order: mockOrder.mockImplementation(() => builder),
    limit: mockLimit.mockImplementation(() => builder),
    insert: mockInsert.mockImplementation(() => builder),
    update: mockUpdate.mockImplementation(() => builder),
    delete: mockDelete.mockImplementation(() => builder),
    single: mockSingle.mockImplementation(() => Promise.resolve(result)),
    maybeSingle: mockMaybeSingle.mockImplementation(() => Promise.resolve(result)),
    then: mockThen.mockImplementation(
      (
        onFulfilled?: (value: typeof result) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(result).then(onFulfilled, onRejected),
    ),
    catch: mockCatch.mockImplementation((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected),
    ),
  };

  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return QueryClientProvider({ client: queryClient, children: props.children });
  };
}

describe('EmailThread.types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exporte un select détaillé complet et stable', () => {
    expect(typeof EMAIL_THREAD_DETAIL_SELECT).toBe('string');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('id, thread_id, user_email_account_id, subject, participants');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('last_message_date, message_count, unread_count');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('is_archived, is_spam, is_deleted, is_processed');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('category, priority, tags');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('etablissement_id, groupe_id, partenaire_id');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('ai_summary, ai_generated_title, ai_extracted_data, ai_confidence_score');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('needs_manual_review, created_at, updated_at');

    for (const snippet of SELECT_SNIPPETS) {
      expect(EMAIL_THREAD_DETAIL_SELECT).toContain(snippet);
    }

    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('from_address');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('to_addresses');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('body_html');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('body_text');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('source_mailbox');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('logo_url');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('engagement_score');
    expect(EMAIL_THREAD_DETAIL_SELECT).toContain('valeur_partenariat');
  });

  it('charge un thread avec succès via React Query en utilisant le select exporté', async () => {
    const builder = createBuilder({ data: THREAD, error: null });
    mockFrom.mockReturnValue(builder);

    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['email-thread', THREAD.id],
          queryFn: async () => {
            const response = await mockFrom('email_threads')
              .select(EMAIL_THREAD_DETAIL_SELECT)
              .eq('id', THREAD.id)
              .maybeSingle();

            if (response.error) {
              throw new Error(response.error.message);
            }

            return response.data as ThreadData;
          },
        }),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockSelect).toHaveBeenCalledWith(EMAIL_THREAD_DETAIL_SELECT);
    expect(mockEq).toHaveBeenCalledWith('id', 't1');

    expect(result.current.data?.subject).toBe('Conversation client');
    expect(result.current.data?.message_count).toBe(2);
    expect(result.current.data?.unread_count).toBe(1);
    expect(result.current.data?.priority).toBe('high');
    expect(result.current.data?.tags).toEqual(['urgent', 'vip']);
    expect(result.current.data?.account?.email_address).toBe('sales@example.test');
    expect(result.current.data?.etablissement?.nom).toBe('Clinique A');
    expect(result.current.data?.groupe?.nom).toBe('Groupe A');
    expect(result.current.data?.partenaire?.nom).toBe('Partenaire A');
    expect(result.current.data?.messages?.length).toBe(2);
    expect(result.current.data?.messages?.[0]?.from_name).toBe('Alice');
    expect(result.current.data?.messages?.[1]?.has_attachments).toBe(true);
    expect(result.current.data?.ai_confidence_score).toBe(0.91);
    expect(result.current.data?.needs_manual_review).toBe(false);
  });

  it('remonte une erreur React Query quand la récupération échoue', async () => {
    const builder = createBuilder({ data: null, error: { message: 'x' } });
    mockFrom.mockReturnValue(builder);

    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['email-thread-error', 't1'],
          queryFn: async () => {
            const response = await mockFrom('email_threads')
              .select(EMAIL_THREAD_DETAIL_SELECT)
              .eq('id', 't1')
              .maybeSingle();

            if (response.error) {
              throw new Error(response.error.message);
            }

            return response.data as ThreadData;
          },
        }),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockSelect).toHaveBeenCalledWith(EMAIL_THREAD_DETAIL_SELECT);
    expect(mockEq).toHaveBeenCalledWith('id', 't1');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('x');
  });

  it('utilise ThreadData dans une mutation de mise à jour avec assertions métier', async () => {
    const builder = createBuilder({ data: THREAD, error: null });
    mockFrom.mockReturnValue(builder);

    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (payload: Pick<ThreadData, 'id' | 'is_archived' | 'tags'>) => {
            const response = await mockFrom('email_threads')
              .update({
                is_archived: payload.is_archived,
                tags: payload.tags,
              })
              .eq('id', payload.id)
              .select(EMAIL_THREAD_DETAIL_SELECT)
              .single();

            if (response.error) {
              throw new Error(response.error.message);
            }

            return response.data as ThreadData;
          },
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        id: 't1',
        is_archived: true,
        tags: ['urgent', 'follow-up'],
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockUpdate).toHaveBeenCalledWith({
      is_archived: true,
      tags: ['urgent', 'follow-up'],
    });
    expect(mockEq).toHaveBeenCalledWith('id', 't1');
    expect(mockSelect).toHaveBeenCalledWith(EMAIL_THREAD_DETAIL_SELECT);
    expect(mockSingle).toHaveBeenCalled();
  });
});