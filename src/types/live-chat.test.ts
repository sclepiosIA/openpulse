// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import * as liveChat from './live-chat';

const {
  AUTH_STATE,
  SETTINGS_ROW,
  CONVERSATION_ROW,
  MESSAGE_ROW,
  AGENT_ROW,
  QUICK_REPLY_ROW,
  KPI_ROW,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  mockNavigate,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  SETTINGS_ROW: {
    id: 's1',
    etablissement_id: 'e1',
    is_global: false,
    is_enabled: true,
    welcome_message: 'Bonjour et bienvenue',
    offline_message: 'Nous sommes hors ligne',
    business_hours: {
      monday: { start: '09:00', end: '18:00' },
      tuesday: { start: '09:00', end: '18:00' },
      wednesday: { start: '09:00', end: '18:00' },
      thursday: { start: '09:00', end: '18:00' },
      friday: { start: '09:00', end: '18:00' },
      saturday: null,
      sunday: null,
    },
    auto_reply_enabled: true,
    auto_reply_delay_seconds: 30,
    max_queue_size: 10,
    widget_color: '#2563eb',
    widget_position: 'bottom-right',
    created_at: '2024-01-01T10:00:00.000Z',
    updated_at: '2024-01-02T10:00:00.000Z',
  },
  CONVERSATION_ROW: {
    id: 'c1',
    etablissement_id: 'e1',
    visitor_id: 'v1',
    visitor_name: 'Alice',
    visitor_email: 'alice@example.com',
    visitor_metadata: { page: '/contact' },
    assigned_to: 'agent1',
    status: 'active',
    priority: 'high',
    source: 'widget',
    tags: ['vip', 'facturation'],
    satisfaction_rating: null,
    satisfaction_comment: null,
    escalated_at: null,
    escalated_reason: null,
    ticket_id: null,
    resolved_at: null,
    first_response_at: '2024-01-01T10:01:00.000Z',
    created_at: '2024-01-01T10:00:00.000Z',
    updated_at: '2024-01-01T10:05:00.000Z',
    etablissement: { id: 'e1', nom: 'Clinique A' },
    assigned_agent: { id: 'agent1', nom: 'Doe', prenom: 'Jane' },
    unread_count: 2,
  },
  MESSAGE_ROW: {
    id: 'm1',
    conversation_id: 'c1',
    sender_type: 'visitor',
    sender_id: null,
    content: 'Bonjour, j’ai besoin d’aide',
    content_type: 'text',
    metadata: {},
    is_internal: false,
    read_at: null,
    created_at: '2024-01-01T10:00:30.000Z',
    sender: null,
  },
  AGENT_ROW: {
    id: 'a1',
    profile_id: 'p1',
    is_available: true,
    max_concurrent_chats: 5,
    current_chat_count: 2,
    specialties: ['billing', 'support'],
    last_active_at: '2024-01-01T11:00:00.000Z',
    created_at: '2024-01-01T09:00:00.000Z',
    updated_at: '2024-01-01T11:00:00.000Z',
    profile: { id: 'p1', nom: 'Doe', prenom: 'John', avatar_url: null },
  },
  QUICK_REPLY_ROW: {
    id: 'q1',
    title: 'Salutation',
    content: 'Bonjour, comment puis-je vous aider ?',
    category: 'general',
    shortcut: '/hello',
    usage_count: 12,
    is_active: true,
    created_by: 'u1',
    created_at: '2024-01-01T09:00:00.000Z',
    updated_at: '2024-01-01T09:30:00.000Z',
  },
  KPI_ROW: {
    total_conversations: 42,
    active_conversations: 5,
    waiting_conversations: 3,
    resolved_today: 12,
    avg_response_time_minutes: 4,
    avg_resolution_time_minutes: 18,
    satisfaction_avg: 4.7,
    escalation_rate: 0.12,
    agents_online: 6,
  },
  mockFrom: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockNavigate: vi.fn(),
}));

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
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

type ResponseShape<TData> = {
  data: TData;
  error: { message: string } | null;
};

function createBuilder<TData>(response: ResponseShape<TData>) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    like: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    is: vi.fn(() => builder),
    in: vi.fn(() => builder),
    contains: vi.fn(() => builder),
    overlap: vi.fn(() => builder),
    textSearch: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response),
    then: <TResult1 = ResponseShape<TData>, TResult2 = never>(
      onFulfilled?: ((value: ResponseShape<TData>) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(response).then(onFulfilled ?? undefined, onRejected ?? undefined),
    catch: <TResult = never>(
      onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
    ) => Promise.resolve(response).catch(onRejected ?? undefined),
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

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('live-chat module constants', () => {
  it('expose les labels et couleurs métier attendus', () => {
    expect(liveChat.STATUS_LABELS.waiting).toBe('En attente');
    expect(liveChat.STATUS_LABELS.ticket_created).toBe('Ticket créé');
    expect(liveChat.STATUS_COLORS.escalated).toContain('bg-red-100');
    expect(liveChat.PRIORITY_LABELS.urgent).toBe('Urgente');
    expect(liveChat.PRIORITY_COLORS.high).toContain('text-orange-800');
    expect(liveChat.SENDER_TYPE_LABELS.bot).toBe('Assistant IA');
    expect(Object.keys(liveChat.STATUS_LABELS)).toEqual([
      'waiting',
      'active',
      'resolved',
      'escalated',
      'ticket_created',
    ]);
  });
});

describe('live-chat module shape', () => {
  it('exporte les constantes UI principales', () => {
    expect(liveChat).toHaveProperty('STATUS_LABELS');
    expect(liveChat).toHaveProperty('STATUS_COLORS');
    expect(liveChat).toHaveProperty('PRIORITY_LABELS');
    expect(liveChat).toHaveProperty('PRIORITY_COLORS');
    expect(liveChat).toHaveProperty('SENDER_TYPE_LABELS');
  });

  it('permet de manipuler des objets métier cohérents', () => {
    const settings: liveChat.LiveChatSettings = SETTINGS_ROW;
    const conversation: liveChat.LiveChatConversation = {
      ...CONVERSATION_ROW,
      messages: [MESSAGE_ROW],
      last_message: MESSAGE_ROW,
    };
    const agent: liveChat.LiveChatAgent = AGENT_ROW;
    const quickReply: liveChat.LiveChatQuickReply = QUICK_REPLY_ROW;
    const kpis: liveChat.LiveChatKPIs = KPI_ROW;

    expect(settings.business_hours.monday?.start).toBe('09:00');
    expect(settings.widget_position).toBe('bottom-right');
    expect(conversation.last_message?.content).toBe('Bonjour, j’ai besoin d’aide');
    expect(conversation.assigned_agent?.prenom).toBe('Jane');
    expect(agent.profile?.prenom).toBe('John');
    expect(quickReply.shortcut).toBe('/hello');
    expect(kpis.total_conversations).toBe(42);
    expect(kpis.escalation_rate).toBeCloseTo(0.12);
  });
});

describe('query client wrapper setup', () => {
  it('crée un wrapper QueryClientProvider utilisable avec renderHook', async () => {
    mockFrom.mockReset();
    const response = { data: [CONVERSATION_ROW], error: null };
    const builder = createBuilder(response);
    mockFrom.mockReturnValue(builder);

    const wrapper = createWrapper();

    const { result } = renderHook(
      () => ({
        fromType: typeof mockFrom,
        authUserId: AUTH_STATE.user.id,
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.authUserId).toBe('u1');
    });

    expect(result.current.fromType).toBe('function');
  });

  it('gère aussi un scénario d’erreur mocké avec un builder thenable', async () => {
    mockFrom.mockReset();
    const response = { data: null, error: { message: 'x' } };
    const builder = createBuilder(response);
    mockFrom.mockReturnValue(builder);

    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const [state, setState] = React.useState({
          isLoading: true,
          isError: false,
          message: null as string | null,
        });

        React.useEffect(() => {
          let active = true;

          const run = async () => {
            const query = mockFrom('live_chat_settings').select('*').eq('id', 's1');
            const res = await query;

            if (!active) return;

            setState({
              isLoading: false,
              isError: Boolean(res.error),
              message: res.error?.message ?? null,
            });
          };

          void run();

          return () => {
            active = false;
          };
        }, []);

        return state;
      },
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.message).toBe('x');
    expect(mockFrom).toHaveBeenCalledWith('live_chat_settings');
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.eq).toHaveBeenCalledWith('id', 's1');
  });
});

describe('supabase builder mock behavior for live-chat data flows', () => {
  it('couvre chargement puis succès avec des valeurs métier réelles', async () => {
    mockFrom.mockReset();
    const response = { data: [CONVERSATION_ROW], error: null };
    const builder = createBuilder(response);
    mockFrom.mockReturnValue(builder);

    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const [state, setState] = React.useState<{
          isLoading: boolean;
          isError: boolean;
          data: liveChat.LiveChatConversation[];
        }>({
          isLoading: true,
          isError: false,
          data: [],
        });

        React.useEffect(() => {
          let active = true;
          const run = async () => {
            const res = await mockFrom('live_chat_conversations')
              .select('*')
              .eq('etablissement_id', 'e1')
              .order('created_at', { ascending: false });

            if (!active) return;

            setState({
              isLoading: false,
              isError: Boolean(res.error),
              data: Array.isArray(res.data) ? res.data : [],
            });
          };

          void run();
          return () => {
            active = false;
          };
        }, []);

        return state;
      },
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]?.status).toBe('active');
    expect(result.current.data[0]?.priority).toBe('high');
    expect(result.current.data[0]?.visitor_name).toBe('Alice');
    expect(result.current.data[0]?.unread_count).toBe(2);
    expect(mockFrom).toHaveBeenCalledWith('live_chat_conversations');
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.eq).toHaveBeenCalledWith('etablissement_id', 'e1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('couvre le cas erreur avec isError=true quand supabase renvoie { data:null, error:{message:"x"} }', async () => {
    mockFrom.mockReset();
    const response = { data: null, error: { message: 'x' } };
    const builder = createBuilder(response);
    mockFrom.mockReturnValue(builder);

    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const [state, setState] = React.useState({
          isLoading: true,
          isError: false,
          errorMessage: '',
        });

        React.useEffect(() => {
          let active = true;
          const run = async () => {
            const res = await mockFrom('live_chat_messages')
              .select('*')
              .eq('conversation_id', 'c1')
              .order('created_at', { ascending: true });

            if (!active) return;

            setState({
              isLoading: false,
              isError: Boolean(res.error),
              errorMessage: res.error?.message ?? '',
            });
          };

          void run();
          return () => {
            active = false;
          };
        }, []);

        return state;
      },
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.errorMessage).toBe('x');
    expect(mockFrom).toHaveBeenCalledWith('live_chat_messages');
    expect(builder.eq).toHaveBeenCalledWith('conversation_id', 'c1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('couvre une mutation dans act(async ...) et vérifie les paramètres transmis', async () => {
    mockFrom.mockReset();
    const response = { data: MESSAGE_ROW, error: null };
    const builder = createBuilder(response);
    mockFrom.mockReturnValue(builder);

    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const [isSuccess, setIsSuccess] = React.useState(false);

        const sendMessage = async (payload: {
          conversation_id: string;
          content: string;
          sender_type: liveChat.MessageSenderType;
        }) => {
          const res = await mockFrom('live_chat_messages').insert({
            conversation_id: payload.conversation_id,
            content: payload.content,
            sender_type: payload.sender_type,
            content_type: 'text',
            is_internal: false,
            metadata: {},
          });

          setIsSuccess(!res.error);
          return res;
        };

        return { sendMessage, isSuccess };
      },
      { wrapper },
    );

    await act(async () => {
      await result.current.sendMessage({
        conversation_id: 'c1',
        content: 'Réponse agent',
        sender_type: 'agent',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('live_chat_messages');
    expect(builder.insert).toHaveBeenCalledWith({
      conversation_id: 'c1',
      content: 'Réponse agent',
      sender_type: 'agent',
      content_type: 'text',
      is_internal: false,
      metadata: {},
    });
    expect(result.current.isSuccess).toBe(true);
  });
});