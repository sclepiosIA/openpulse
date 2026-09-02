import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { usePulseAIChat, type AIAction } from './usePulseAIChat';

const { mockGetSession, mockToast, mockSanitize, mockFrom, SESSION } = vi.hoisted(() => {
  const SESSION = { access_token: 'tok-abc', user: { id: 'u1' } };
  return {
    SESSION,
    mockGetSession: vi.fn(),
    mockToast: vi.fn(),
    mockSanitize: vi.fn(() => 'erreur nettoyée'),
    mockFrom: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: { getSession: mockGetSession },
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitize,
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const mockFetch = vi.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function jsonResponse(payload: Record<string, unknown>, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: { get: () => 'application/json' },
    json: async () => payload,
    body: null,
  };
}

function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream' },
    json: async () => ({}),
    body: {
      getReader: () => ({
        read: async () => {
          if (index < chunks.length) {
            const value = encoder.encode(chunks[index]);
            index += 1;
            return { done: false, value };
          }
          return { done: true, value: undefined };
        },
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  mockGetSession.mockResolvedValue({ data: { session: SESSION } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePulseAIChat', () => {
  it('démarre avec un état vide et non chargé', () => {
    const { result } = renderHook(() => usePulseAIChat(), { wrapper: createWrapper() });

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.sendMessage).toBe('function');
    expect(typeof result.current.cancelRequest).toBe('function');
    expect(typeof result.current.clearMessages).toBe('function');
    expect(typeof result.current.executeAction).toBe('function');
  });

  it('ignore les messages vides', async () => {
    const { result } = renderHook(() => usePulseAIChat(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('ajoute le message utilisateur et la réponse assistant (non-streaming)', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Bonjour, voici la réponse.' }));

    const { result } = renderHook(() => usePulseAIChat({ conversationId: 'conv-1' }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.sendMessage('Salut Pulse');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('Salut Pulse');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('Bonjour, voici la réponse.');
    expect(result.current.messages[1].isStreaming).toBe(false);
    expect(result.current.isLoading).toBe(false);

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/functions/v1/pulse-ai-chat');
    const parsedBody = JSON.parse((init as RequestInit).body as string);
    expect(parsedBody.conversation_id).toBe('conv-1');
    expect(parsedBody.global_mode).toBe(false);
    expect(parsedBody.stream).toBe(true);
    expect(parsedBody.messages).toEqual([{ role: 'user', content: 'Salut Pulse' }]);
  });

  it('gère une réponse streaming SSE et finalise le message avec actions/entityLinks', async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        'data: {"type":"content","content":"Analyse "}\n',
        'data: {"type":"content","content":"en cours"}\n',
        'data: {"type":"complete","message":"Résultat final","actions":[{"type":"open_task","data":{"id":"t1"}}],"entityLinks":[{"type":"tache","id":"t1","name":"Tâche 1"}]}\n',
        'data: [DONE]\n',
      ])
    );

    const { result } = renderHook(() => usePulseAIChat({ globalMode: true }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.sendMessage('Analyse mes données');
    });

    const assistant = result.current.messages[1];
    expect(assistant.content).toBe('Résultat final');
    expect(assistant.isStreaming).toBe(false);
    expect(assistant.actions).toEqual([{ type: 'open_task', data: { id: 't1' } }]);
    expect(assistant.entityLinks).toEqual([{ type: 'tache', id: 't1', name: 'Tâche 1' }]);

    const parsedBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(parsedBody.global_mode).toBe(true);
  });

  it('affiche un toast pour une action created_task (non-streaming) avec onAction', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        message: 'Tâche créée pour vous.',
        actions: [{ type: 'created_task', data: { titre: 'Relancer le client' } }],
      })
    );
    const onAction = vi.fn();

    const { result } = renderHook(() => usePulseAIChat({ onAction }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.sendMessage('Crée une tâche');
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Tâche créée',
      description: 'Relancer le client',
    });
    expect(result.current.messages[1].actions).toEqual([
      { type: 'created_task', data: { titre: 'Relancer le client' } },
    ]);
  });

  it('gère une erreur HTTP : message d erreur + toast destructive', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Serveur indisponible' }, false, 500));

    const { result } = renderHook(() => usePulseAIChat(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.messages[1].content).toBe('Erreur: Serveur indisponible');
    expect(result.current.messages[1].isStreaming).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur IA',
      description: 'erreur nettoyée',
      variant: 'destructive',
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('gère le code 429 avec un message dédié', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, false, 429));

    const { result } = renderHook(() => usePulseAIChat(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.sendMessage('Spam');
    });

    expect(result.current.messages[1].content).toBe(
      'Erreur: Trop de requêtes. Veuillez patienter quelques secondes.'
    );
  });

  it('échoue si non authentifié (pas de session)', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const { result } = renderHook(() => usePulseAIChat(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.sendMessage('Bonjour');
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.messages[1].content).toBe('Erreur: Non authentifié');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Erreur IA', variant: 'destructive' })
    );
  });

  it('clearMessages vide la conversation', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'OK' }));

    const { result } = renderHook(() => usePulseAIChat(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.sendMessage('Un message');
    });
    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
  });

  it('executeAction délègue à onAction', () => {
    const onAction = vi.fn();
    const { result } = renderHook(() => usePulseAIChat({ onAction }), {
      wrapper: createWrapper(),
    });

    const action: AIAction = { type: 'open_etablissement', data: { id: 'e1', nom: 'Lycée Test' } };
    act(() => {
      result.current.executeAction(action);
    });

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(action);
  });
});