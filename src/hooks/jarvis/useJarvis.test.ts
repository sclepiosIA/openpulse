import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const {
  AUTH,
  mockUseAuth,
  mockToast,
  mockInvoke,
  mockFrom,
  mockRecordActivity,
  PENDING_ACTIONS,
  PREFERENCES,
  LEARNING,
  FOCUS,
} = vi.hoisted(() => {
  const mockRecordActivity = vi.fn();
  const AUTH = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };
  const mockUseAuth = vi.fn(() => AUTH);
  const mockToast = vi.fn();
  const mockInvoke = vi.fn();

  const builder: Record<string, unknown> = {};
  const chainMethods = [
    'select', 'eq', 'neq', 'gte', 'lte', 'in', 'order', 'limit',
    'insert', 'update', 'delete', 'upsert', 'range', 'or', 'ilike',
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  builder.catch = () => Promise.resolve({ data: [], error: null });
  const mockFrom = vi.fn(() => builder);

  const PENDING_ACTIONS = {
    pendingActions: [],
    isLoading: false,
    addPendingAction: vi.fn(),
    removePendingAction: vi.fn(),
    clearPendingActions: vi.fn(),
  };
  const PREFERENCES = {
    preferences: { proactivity_level: 'medium' },
    isLoading: false,
    updatePreferences: vi.fn(),
  };
  const LEARNING = {
    insights: null,
    isLoading: false,
    recordFeedback: vi.fn(),
  };
  const FOCUS = {
    focusMode: 'idle',
    recordActivity: mockRecordActivity,
    setFocusMode: vi.fn(),
    recentActivities: [],
  };

  return {
    AUTH,
    mockUseAuth,
    mockToast,
    mockInvoke,
    mockFrom,
    mockRecordActivity,
    PENDING_ACTIONS,
    PREFERENCES,
    LEARNING,
    FOCUS,
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'u1' } }, error: null })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
  },
}));

vi.mock('./useJarvisPendingActions', () => ({
  useJarvisPendingActions: vi.fn(() => PENDING_ACTIONS),
}));

vi.mock('./useJarvisPreferences', () => ({
  useJarvisPreferences: vi.fn(() => PREFERENCES),
}));

vi.mock('./useJarvisLearning', () => ({
  useJarvisLearning: vi.fn(() => LEARNING),
}));

vi.mock('./useJarvisFocus', () => ({
  useJarvisFocus: vi.fn(() => FOCUS),
}));

vi.mock('./useJarvisProactiveAlerts', () => ({
  useJarvisProactiveAlerts: vi.fn(() => ({ unreadCount: 2 })),
}));

vi.mock('@/contexts/JarvisConversationContext', () => ({
  useJarvisConversationOptional: vi.fn(() => null),
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: vi.fn(() => 'erreur nettoyée'),
}));

vi.mock('@/types/jarvis', () => ({
  JARVIS_CAPABILITIES: [],
}));

import { useJarvis } from './useJarvis';

// Shim crypto.randomUUID si absent dans jsdom
const cryptoRef = globalThis.crypto as Crypto & { randomUUID?: () => string };
let uuidCounter = 0;
if (typeof cryptoRef.randomUUID !== 'function') {
  cryptoRef.randomUUID = () => {
    uuidCounter += 1;
    return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
  };
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

describe('useJarvis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(AUTH);
    mockInvoke.mockResolvedValue({
      data: { content: 'Bonjour, je suis Jarvis', tool_calls: [], tool_results: [] },
      error: null,
    });
  });

  it('initialise un état vide et expose l’API de chat', () => {
    const { result } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    expect(result.current.messages).toEqual([]);
    expect(result.current.isTyping).toBe(false);
    expect(typeof result.current.chat).toBe('function');
    expect(typeof result.current.clearChat).toBe('function');
    expect(typeof result.current.confirmToolCall).toBe('function');
    expect(typeof result.current.rejectToolCall).toBe('function');
  });

  it('chat envoie le message enrichi à jarvis-brain et ajoute les messages user + assistant', async () => {
    const { result } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    let response: unknown = null;
    await act(async () => {
      response = await result.current.chat('Salut Jarvis');
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      'jarvis-brain',
      expect.objectContaining({
        body: expect.objectContaining({
          user_id: 'u1',
          autonomous_mode: true,
          message: expect.stringContaining('Salut Jarvis'),
        }),
      })
    );
    // Contexte page injecté (jsdom pathname = '/' → DASHBOARD)
    const invokeBody = mockInvoke.mock.calls[0][1].body as { message: string };
    expect(invokeBody.message).toContain('[CONTEXTE PAGE AUTOMATIQUE]');
    expect(invokeBody.message).toContain('[MODULE: DASHBOARD]');

    expect(response).toEqual(
      expect.objectContaining({ content: 'Bonjour, je suis Jarvis' })
    );

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('Salut Jarvis');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('Bonjour, je suis Jarvis');
    expect(result.current.isTyping).toBe(false);

    expect(mockRecordActivity).toHaveBeenCalledWith(
      'jarvis_chat',
      expect.any(String),
      'Salut Jarvis'
    );
  });

  it('chat throttle : un second appel immédiat retourne null sans appeler jarvis-brain', async () => {
    const { result } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.chat('Premier message');
    });
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    let second: unknown = 'sentinelle';
    await act(async () => {
      second = await result.current.chat('Deuxième message trop rapide');
    });

    expect(second).toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('chat retourne null sans appeler jarvis-brain quand non connecté', async () => {
    mockUseAuth.mockReturnValue({ user: null, session: null, isLoading: false });
    const { result } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    let response: unknown = 'sentinelle';
    await act(async () => {
      response = await result.current.chat('Salut');
    });

    expect(response).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Non connecté', variant: 'destructive' })
    );
  });

  it('chat gère l’erreur de jarvis-brain : retourne null et affiche un toast destructif', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    const { result } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    let response: unknown = 'sentinelle';
    await act(async () => {
      response = await result.current.chat('Message qui échoue');
    });

    expect(response).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur',
        description: 'Impossible de contacter Jarvis',
        variant: 'destructive',
      })
    );
    expect(result.current.isTyping).toBe(false);
    // Le message utilisateur reste affiché malgré l'erreur
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Message qui échoue');
  });

  it('chat marque les tool calls REQUIRES_CONFIRMATION dans le message assistant', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        content: 'Je dois confirmer cette action',
        tool_calls: [{ id: 'tc1', name: 'send_email', arguments: { subject: 'Hello' } }],
        tool_results: [
          {
            tool_call_id: 'tc1',
            name: 'send_email',
            result: {
              error: 'REQUIRES_CONFIRMATION',
              data: { arguments: { to: 'a@b.c' } },
            },
          },
        ],
      },
      error: null,
    });
    const { result } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.chat('Envoie un email');
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });
    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.role).toBe('assistant');
    expect(assistantMsg.content).toBe('Je dois confirmer cette action');
    expect(assistantMsg.toolCalls).toHaveLength(1);
    expect(assistantMsg.toolCalls?.[0]).toEqual(
      expect.objectContaining({
        id: 'tc1',
        name: 'send_email',
        status: 'requires_confirmation',
        arguments: { subject: 'Hello' },
      })
    );
  });

  it('chat marque les tool calls réussis comme completed', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        content: 'Tâche créée',
        tool_calls: [{ id: 'tc2', name: 'create_task', arguments: { title: 'Test' } }],
        tool_results: [
          {
            tool_call_id: 'tc2',
            name: 'create_task',
            result: { data: { id: 'task-1' } },
          },
        ],
      },
      error: null,
    });
    const { result } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.chat('Crée une tâche');
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });
    expect(result.current.messages[1].toolCalls?.[0]).toEqual(
      expect.objectContaining({ id: 'tc2', name: 'create_task', status: 'completed' })
    );
  });

  it('confirmToolCall envoie "oui" à jarvis-brain et ajoute la confirmation + la réponse au chat', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, direct_execution: true, content: 'Email envoyé' },
      error: null,
    });
    const { result } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.confirmToolCall('tc1');
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      'jarvis-brain',
      expect.objectContaining({
        body: expect.objectContaining({
          user_id: 'u1',
          message: 'oui',
          autonomous_mode: true,
        }),
      })
    );

    await waitFor(() => {
      const contents = result.current.messages.map((m) => m.content);
      expect(contents).toContain('✅ Confirmé');
      expect(contents).toContain('Email envoyé');
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '✅ Action exécutée !' })
    );
  });

  it('confirmToolCall affiche un toast d’échec si jarvis-brain renvoie success=false', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: false, content: 'Action refusée par le serveur' },
      error: null,
    });
    const { result } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.confirmToolCall('tc1');
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "❌ Échec de l'action",
        variant: 'destructive',
      })
    );
  });

  it('confirmToolCall gère une erreur de jarvis-brain via sanitizeSupabaseError', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const { result } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.confirmToolCall('tc-inconnu');
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "❌ Erreur d'exécution",
        description: 'erreur nettoyée',
        variant: 'destructive',
      })
    );
  });

  it('confirmToolCall sans utilisateur connecté affiche un toast et n’appelle pas jarvis-brain', async () => {
    mockUseAuth.mockReturnValue({ user: null, session: null, isLoading: false });
    const { result } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.confirmToolCall('tc1');
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur',
        description: 'Non connecté',
        variant: 'destructive',
      })
    );
  });

  it('rejectToolCall affiche un toast d’annulation sans appeler jarvis-brain', async () => {
    const { result } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.rejectToolCall('tc1');
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Action annulée' })
    );
  });

  it('clearChat vide les messages de la conversation', async () => {
    const { result } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.chat('Salut');
    });
    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.clearChat();
    });

    expect(result.current.messages).toEqual([]);
  });
});