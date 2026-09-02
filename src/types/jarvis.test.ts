// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import React from 'react';
import * as jarvis from './jarvis';

const {
  AUTH_STATE,
  TOAST,
  ROWS,
  ERROR_RESPONSE,
  mockFrom,
  mockNavigate,
  mockServiceFn,
  mockCapacitorFn,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  TOAST: {
    success: vi.fn(),
    error: vi.fn(),
  },
  ROWS: [{ id: '1', name: 'Jarvis' }],
  ERROR_RESPONSE: { data: null, error: { message: 'x' } },
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
  mockServiceFn: vi.fn(),
  mockCapacitorFn: vi.fn(),
}));

function createBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    match: vi.fn(() => builder),
    contains: vi.fn(() => builder),
    overlaps: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    like: vi.fn(() => builder),
    is: vi.fn(() => builder),
    not: vi.fn(() => builder),
    or: vi.fn(() => builder),
    filter: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: ROWS[0], error: null })),
    maybeSingle: vi.fn(async () => ({ data: ROWS[0], error: null })),
    then: (onFulfilled: (value: { data: typeof ROWS; error: null }) => unknown) =>
      Promise.resolve({ data: ROWS, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: ROWS, error: null }).catch(onRejected),
  };
  return builder;
}

mockFrom.mockImplementation(() => createBuilder());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: vi.fn(async () => ({ data: null, error: null })),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
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

vi.mock('@/hooks/useAdminRole', () => ({
  useAdminRole: () => true,
}));

vi.mock('sonner', () => ({
  toast: TOAST,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/jarvis', search: '', hash: '', state: null, key: 'k1' }),
  useParams: () => ({}),
}));

vi.mock('@/lib', () => ({
  default: {},
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/services', () => ({
  default: {},
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    requestPermissions: mockCapacitorFn,
    register: mockCapacitorFn,
    addListener: vi.fn(),
    removeAllListeners: mockCapacitorFn,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('jarvis.ts', () => {
  it('expose les capacités métier JARVIS avec des valeurs cohérentes', () => {
    expect(Array.isArray(jarvis.JARVIS_CAPABILITIES)).toBe(true);
    expect(jarvis.JARVIS_CAPABILITIES).toHaveLength(7);

    const names = jarvis.JARVIS_CAPABILITIES.map((c) => c.name);
    expect(names).toEqual([
      'query_database',
      'send_email',
      'create_task',
      'schedule_meeting',
      'search_knowledge_base',
      'calculate_metrics',
      'get_user_context',
    ]);

    const sendEmail = jarvis.JARVIS_CAPABILITIES.find((c) => c.name === 'send_email');
    expect(sendEmail).toEqual({
      name: 'send_email',
      description: 'Envoyer des emails',
      category: 'action',
      requires_confirmation: true,
      examples: ['Envoie un email de relance à X', 'Réponds à ce thread'],
    });

    const queryDb = jarvis.JARVIS_CAPABILITIES.find((c) => c.name === 'query_database');
    expect(queryDb?.category).toBe('query');
    expect(queryDb?.requires_confirmation).toBe(false);
    expect(queryDb?.examples[0]).toContain('établissements');

    const searchKb = jarvis.JARVIS_CAPABILITIES.find((c) => c.name === 'search_knowledge_base');
    expect(searchKb?.category).toBe('search');
    expect(searchKb?.examples).toContain('Comment configurer le module X ?');

    const actionCapabilities = jarvis.JARVIS_CAPABILITIES.filter((c) => c.category === 'action');
    expect(actionCapabilities.map((c) => c.name)).toEqual([
      'send_email',
      'create_task',
      'schedule_meeting',
    ]);
  });

  it('permet de manipuler des objets métier conformes aux types exportés', () => {
    const trigger: jarvis.JarvisTrigger = {
      type: 'new_email',
      user_id: 'u1',
      context: {
        thread_id: 'th1',
        priority: 'high',
        quick_action: 'summarize_emails',
        custom_prompt: 'Résume ce thread',
        conversation_history: [
          { role: 'user', content: 'Bonjour' },
          { role: 'assistant', content: 'Salut' },
        ],
      },
    };

    const proposedAction: jarvis.JarvisProposedAction = {
      type: 'send_email',
      data: {
        to: 'client@example.test',
        subject: 'Relance',
        body: 'Bonjour, je reviens vers vous.',
        thread_id: 'th1',
      },
      preview_text: 'Envoyer un email de relance au client',
      confidence_score: 0.91,
      reasoning: 'Le client attend une réponse depuis 2 jours',
    };

    const pendingAction: jarvis.JarvisPendingAction = {
      id: 'pa1',
      user_id: 'u1',
      trigger_type: 'new_email',
      trigger_entity_id: 'th1',
      trigger_entity_type: 'email_thread',
      context: {
        email_thread: {
          id: 'th1',
          subject: 'Demande de devis',
          messages: [
            {
              id: 'm1',
              from_address: 'client@example.test',
              content_preview: 'Pouvez-vous me rappeler ?',
              sent_at: '2024-01-10T09:00:00Z',
            },
          ],
        },
        contacts: [
          {
            id: 'c1',
            nom: 'Doe',
            prenom: 'Jane',
            email: 'client@example.test',
            fonction: 'Acheteuse',
          },
        ],
      },
      proposed_action: proposedAction,
      kb_sources: [
        {
          article_id: 'kb1',
          titre: 'Procédure de relance',
          base_type: 'internal',
          excerpt: 'Relancer sous 48h',
          relevance: 0.88,
          module: 'CRM',
        },
      ],
      status: 'pending',
      ai_response: 'Je propose une relance',
      user_modification: null,
      execution_result: null,
      error_message: null,
      created_at: '2024-01-10T10:00:00Z',
      expires_at: '2024-01-11T10:00:00Z',
      reviewed_at: null,
      executed_at: null,
      user_feedback: null,
      feedback_rating: null,
    };

    const brainResponse: jarvis.JarvisBrainResponse = {
      success: true,
      content: 'Voici le résumé et l’action proposée.',
      tool_calls: [
        {
          id: 'tc1',
          name: 'query_database',
          arguments: { entity: 'tasks', overdue: true },
        },
      ],
      tool_results: [
        {
          tool_call_id: 'tc1',
          name: 'query_database',
          result: {
            success: true,
            data: { count: 3 },
            execution_time_ms: 42,
          },
        },
      ],
      processing_time_ms: 120,
    };

    expect(trigger.context.quick_action).toBe('summarize_emails');
    expect(pendingAction.proposed_action.type).toBe('send_email');
    expect(pendingAction.context.email_thread?.subject).toBe('Demande de devis');
    expect(pendingAction.kb_sources[0]).toMatchObject({
      article_id: 'kb1',
      base_type: 'internal',
      relevance: 0.88,
    });
    expect(brainResponse.tool_results?.[0].result.execution_time_ms).toBe(42);
    expect(brainResponse.tool_calls?.[0].arguments).toEqual({ entity: 'tasks', overdue: true });
  });

  it('rend correctement un hook de test dans le wrapper React Query requis: chargement puis succès', async () => {
    const wrapper = createWrapper();

    function useLoadingToSuccess() {
      return useQuery({
        queryKey: ['jarvis-success'],
        queryFn: async () => {
          await Promise.resolve();
          return ROWS;
        },
      });
    }

    const { result } = renderHook(() => useLoadingToSuccess(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual(ROWS);
    expect(result.current.data?.[0]).toEqual({ id: '1', name: 'Jarvis' });
  });

  it('rend correctement un hook de test dans le wrapper React Query requis: erreur', async () => {
    const wrapper = createWrapper();

    function useErrorState() {
      return useQuery({
        queryKey: ['jarvis-error'],
        queryFn: async () => {
          await Promise.resolve();
          if (ERROR_RESPONSE.error) {
            throw new Error(ERROR_RESPONSE.error.message);
          }
          return ERROR_RESPONSE.data;
        },
      });
    }

    const { result } = renderHook(() => useErrorState(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error?.message).toBe('x');
    expect(result.current.data).toBeUndefined();
  });

  it('déclenche une mutation dans act et appelle la fonction métier avec les bons paramètres', async () => {
    mockServiceFn.mockClear();

    const wrapper = createWrapper();

    function useJarvisMutation() {
      return useMutation({
        mutationFn: async (input: { actionId: string; rating: number; comment?: string }) => {
          mockServiceFn(input);
          return { ok: true, actionId: input.actionId, rating: input.rating };
        },
      });
    }

    const { result } = renderHook(() => useJarvisMutation(), { wrapper });

    await React.act(async () => {
      await result.current.mutateAsync({
        actionId: 'pa1',
        rating: 5,
        comment: 'Très utile',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockServiceFn).toHaveBeenCalledTimes(1);
    expect(mockServiceFn).toHaveBeenCalledWith({
      actionId: 'pa1',
      rating: 5,
      comment: 'Très utile',
    });
    expect(result.current.data).toEqual({ ok: true, actionId: 'pa1', rating: 5 });
  });
});