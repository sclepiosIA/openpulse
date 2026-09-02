import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisTeam } from './useJarvisTeam';

const { MOCK_INVOKE, MOCK_FROM, USER, TOAST_FN } = vi.hoisted(() => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    lte: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
    catch: (reject: (e: unknown) => unknown) => Promise.resolve({ data: [], error: null }).catch(reject),
  };
  const MOCK_FROM = vi.fn(() => chain);
  const MOCK_INVOKE = vi.fn();
  const USER = { id: 'u1', email: 'u1@example.com' };
  const TOAST_FN = vi.fn();
  return { MOCK_INVOKE, MOCK_FROM, USER, TOAST_FN };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: MOCK_FROM,
    functions: {
      invoke: MOCK_INVOKE,
    },
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({
    user: USER,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: vi.fn(),
  },
}));

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return React.createElement(QueryClientProvider, { client }, children);
};

describe('useJarvisTeam', () => {
  beforeEach(() => {
    MOCK_INVOKE.mockReset();
    TOAST_FN.mockReset();
  });

  it('état initial: agents activés par défaut, agent par défaut, pas de traitement', () => {
    const { result } = renderHook(() => useJarvisTeam(), { wrapper });
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.enabledAgents.length).toBeGreaterThan(0);
    expect(result.current.defaultAgent).toBe('sophia');
    expect(result.current.teamState.conversationHistory).toEqual([]);
    expect(Object.keys(result.current.agents).length).toBeGreaterThan(0);
    expect(result.current.allAgents.length).toBeGreaterThan(0);
  });

  it('chemin succès: sendToTeam envoie le message, reçoit réponses, met à jour l’historique, et appelle invoke avec le bon payload', async () => {
    const apiResponse = {
      success: true,
      query: 'Hello Jarvis',
      conversation_id: 'c1',
      selected_agents: ['sophia'],
      results: [
        {
          agent_id: 'sophia',
          agent_name: 'Sophia',
          emoji: '👩‍💼',
          success: true,
          response: 'Hello from Sophia',
          data: { info: 'ok' },
          execution_time_ms: 10,
        },
      ],
      synthesis: '',
      total_execution_time_ms: 20,
    };
    MOCK_INVOKE.mockResolvedValue({ data: apiResponse, error: null });

    const { result } = renderHook(() => useJarvisTeam(), { wrapper });

    await act(async () => {
      const res = await result.current.sendToTeam('Hello Jarvis');
      expect(res).not.toBeNull();
    });

    expect(MOCK_INVOKE).toHaveBeenCalledTimes(1);
    const call = MOCK_INVOKE.mock.calls[0];
    expect(call[0]).toBe('jarvis-prime');
    expect(call[1]).toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          query: 'Hello Jarvis',
          user_id: USER.id,
        }),
      })
    );

    expect(result.current.teamState.conversationHistory.length).toBe(2);
    const [userMsg, agentMsg] = result.current.teamState.conversationHistory;
    expect(userMsg.agentId).toBe('user');
    expect(userMsg.content).toBe('Hello Jarvis');
    expect(agentMsg.agentId).toBe('sophia');
    expect(agentMsg.content).toBe('Hello from Sophia');
    expect(result.current.teamState.activeAgents).toEqual([]);
    expect(result.current.isProcessing).toBe(false);
  });

  it('chemin erreur: sendToTeam gère une erreur, affiche un toast, conserve seulement le message utilisateur', async () => {
    MOCK_INVOKE.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const { result } = renderHook(() => useJarvisTeam(), { wrapper });

    await act(async () => {
      const res = await result.current.sendToTeam('Test error');
      expect(res).toBeNull();
    });

    // Le message utilisateur est ajouté avant l'appel API
    expect(result.current.teamState.conversationHistory.length).toBe(1);
    expect(result.current.teamState.conversationHistory[0].agentId).toBe('user');
    expect(result.current.teamState.conversationHistory[0].content).toBe('Test error');
    expect(TOAST_FN).toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erreur' }));
    expect(result.current.isProcessing).toBe(false);
  });

  it('sendToAgent force l’agent spécifié', async () => {
    const apiResponse = {
      success: true,
      query: 'Hi',
      conversation_id: 'c2',
      selected_agents: ['alex'],
      results: [
        {
          agent_id: 'alex',
          agent_name: 'Alex',
          emoji: '📊',
          success: true,
          response: 'Alex response',
          data: {},
          execution_time_ms: 5,
        },
      ],
      synthesis: '',
      total_execution_time_ms: 6,
    };
    MOCK_INVOKE.mockResolvedValue({ data: apiResponse, error: null });

    const { result } = renderHook(() => useJarvisTeam(), { wrapper });

    await act(async () => {
      const res = await result.current.sendToAgent('alex', 'Hi');
      expect(res).not.toBeNull();
    });

    expect(MOCK_INVOKE).toHaveBeenCalledTimes(1);
    const payload = MOCK_INVOKE.mock.calls[0][1];
    expect(payload).toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          force_agents: ['alex'],
          query: 'Hi',
          user_id: USER.id,
        }),
      })
    );
    expect(result.current.teamState.conversationHistory.length).toBe(2);
    expect(result.current.teamState.conversationHistory[1].agentId).toBe('alex');
    expect(result.current.teamState.conversationHistory[1].content).toBe('Alex response');
  });

  it('requestStandup succès: ajoute un message de briefing et réinitialise les agents actifs', async () => {
    const standupData = {
      briefing_text: 'Daily standup briefing',
      sections: [{ agent_id: 'sophia', summary: 'CRM update' }],
    };
    MOCK_INVOKE.mockResolvedValue({ data: standupData, error: null });

    const { result } = renderHook(() => useJarvisTeam(), { wrapper });

    await act(async () => {
      const res = await result.current.requestStandup();
      expect(res).toEqual(standupData);
    });

    expect(MOCK_INVOKE).toHaveBeenCalledTimes(1);
    const call = MOCK_INVOKE.mock.calls[0];
    expect(call[0]).toBe('jarvis-team-standup');
    expect(call[1]).toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          user_id: USER.id,
          include_agents: result.current.enabledAgents,
        }),
      })
    );

    expect(result.current.teamState.conversationHistory.length).toBe(1);
    const msg = result.current.teamState.conversationHistory[0];
    expect(msg.agentId).toBe('prime');
    expect(msg.content).toBe('Daily standup briefing');
    expect(result.current.teamState.activeAgents).toEqual([]);
    expect(result.current.isProcessing).toBe(false);
  });

  it('requestStandup erreur: affiche un toast et ne renvoie rien', async () => {
    MOCK_INVOKE.mockResolvedValue({ data: null, error: { message: 'fail' } });

    const { result } = renderHook(() => useJarvisTeam(), { wrapper });

    await act(async () => {
      const res = await result.current.requestStandup();
      expect(res).toBeNull();
    });

    expect(TOAST_FN).toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erreur' }));
    expect(result.current.isProcessing).toBe(false);
  });

  it('clearConversation, toggleTeamMode et setCurrentSpeaker fonctionnent correctement', async () => {
    const apiResponse = {
      success: true,
      query: 'Hello',
      conversation_id: 'c3',
      selected_agents: ['emma'],
      results: [
        {
          agent_id: 'emma',
          agent_name: 'Emma',
          emoji: '👩‍🎨',
          success: true,
          response: 'Emma here',
          data: {},
          execution_time_ms: 7,
        },
      ],
      synthesis: '',
      total_execution_time_ms: 8,
    };
    MOCK_INVOKE.mockResolvedValue({ data: apiResponse, error: null });

    const { result } = renderHook(() => useJarvisTeam(), { wrapper });

    await act(async () => {
      await result.current.sendToTeam('Hello');
    });

    expect(result.current.teamState.conversationHistory.length).toBe(2);

    act(() => {
      result.current.setCurrentSpeaker('emma');
    });
    expect(result.current.teamState.currentSpeaker).toBe('emma');

    act(() => {
      result.current.toggleTeamMode();
    });
    expect(result.current.teamState.isTeamMode).toBe(false);

    act(() => {
      result.current.clearConversation();
    });
    expect(result.current.teamState.conversationHistory).toEqual([]);
    expect(result.current.teamState.activeAgents).toEqual([]);
  });
});