import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisAgentNegotiation } from './useJarvisAgentNegotiation';
import type { AgentId } from '@/types/jarvis-agents';

const { authState, mockInvoke, mockFrom, NEGOTIATIONS } = vi.hoisted(() => {
  const NEGOTIATIONS = [
    {
      id: 'neg-1',
      requesting_agent: 'agent-a',
      conflicting_agent: 'agent-b',
      conflict_type: 'priority',
      resolution: 'deferred',
      winner_agent: 'agent-b',
      created_at: '2025-01-01T00:00:00Z',
    },
  ];

  const builder: Record<string, unknown> = {};
  const chainMethods = [
    'select', 'eq', 'gte', 'lte', 'in', 'order', 'limit',
    'insert', 'update', 'delete', 'upsert', 'neq', 'is', 'range',
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  builder.catch = () => builder;

  return {
    authState: { user: { id: 'u1', email: 't@t.co' } as { id: string; email: string } | null },
    mockInvoke: vi.fn(),
    mockFrom: vi.fn(() => builder),
    NEGOTIATIONS,
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const AGENT_A = 'agent-a' as AgentId;
const AGENT_B = 'agent-b' as AgentId;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useJarvisAgentNegotiation', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    authState.user = { id: 'u1', email: 't@t.co' };
  });

  it('expose un état initial cohérent', () => {
    const { result } = renderHook(() => useJarvisAgentNegotiation(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isChecking).toBe(false);
    expect(result.current.negotiations).toEqual([]);
    expect(typeof result.current.checkForConflict).toBe('function');
    expect(typeof result.current.negotiate).toBe('function');
    expect(typeof result.current.fetchHistory).toBe('function');
    expect(typeof result.current.resolveManually).toBe('function');
  });

  describe('checkForConflict', () => {
    it('retourne le résultat de conflit avec winner et resolution', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          has_conflict: true,
          can_proceed: true,
          winner: 'agent-b',
          resolution: 'priority-based',
          must_wait: false,
        },
        error: null,
      });

      const { result } = renderHook(() => useJarvisAgentNegotiation(), {
        wrapper: createWrapper(),
      });

      let outcome;
      await act(async () => {
        outcome = await result.current.checkForConflict(AGENT_A, 'ent-1', 'meal', 'update');
      });

      expect(outcome).toEqual({
        has_conflict: true,
        can_proceed: true,
        winner: 'agent-b',
        resolution: 'priority-based',
        must_wait: false,
        wait_reason: undefined,
      });

      expect(mockInvoke).toHaveBeenCalledWith('jarvis-agent-negotiation', {
        body: {
          action: 'check_conflict',
          user_id: 'u1',
          negotiation: {
            agent_id: AGENT_A,
            entity_id: 'ent-1',
            entity_type: 'meal',
            planned_action: 'update',
          },
        },
      });
      expect(result.current.isChecking).toBe(false);
    });

    it('autorise à continuer sans appel réseau si user absent', async () => {
      authState.user = null;
      const { result } = renderHook(() => useJarvisAgentNegotiation(), {
        wrapper: createWrapper(),
      });

      let outcome;
      await act(async () => {
        outcome = await result.current.checkForConflict(AGENT_A, 'ent-1', 'meal', 'update');
      });

      expect(outcome).toEqual({ has_conflict: false, can_proceed: true });
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('retourne can_proceed:true en cas d\'erreur de la fonction edge', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

      const { result } = renderHook(() => useJarvisAgentNegotiation(), {
        wrapper: createWrapper(),
      });

      let outcome;
      await act(async () => {
        outcome = await result.current.checkForConflict(AGENT_A, 'ent-1', 'meal', 'update');
      });

      expect(outcome).toEqual({ has_conflict: false, can_proceed: true });
      expect(result.current.isChecking).toBe(false);
    });
  });

  describe('negotiate', () => {
    it('permet de continuer quand l\'agent demandeur gagne', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          winner: 'agent-a',
          resolution: 'requester-wins',
          reason: undefined,
          deferred_action: undefined,
          defer_until: undefined,
        },
        error: null,
      });

      const { result } = renderHook(() => useJarvisAgentNegotiation(), {
        wrapper: createWrapper(),
      });

      let outcome;
      await act(async () => {
        outcome = await result.current.negotiate(AGENT_A, AGENT_B, 'priority', 'act-a', 'act-b');
      });

      expect(outcome).toMatchObject({
        has_conflict: true,
        can_proceed: true,
        winner: 'agent-a',
        resolution: 'requester-wins',
        must_wait: false,
      });

      expect(mockInvoke).toHaveBeenCalledWith('jarvis-agent-negotiation', {
        body: {
          action: 'negotiate',
          user_id: 'u1',
          negotiation: {
            requesting_agent: AGENT_A,
            conflicting_agent: AGENT_B,
            conflict_type: 'priority',
            requesting_action: 'act-a',
            conflicting_action: 'act-b',
          },
        },
      });
    });

    it('impose l\'attente quand l\'agent en conflit gagne', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          winner: 'agent-b',
          resolution: 'conflicting-wins',
          reason: 'occupé',
          deferred_action: 'retry-later',
          defer_until: '2025-06-01T00:00:00Z',
        },
        error: null,
      });

      const { result } = renderHook(() => useJarvisAgentNegotiation(), {
        wrapper: createWrapper(),
      });

      let outcome;
      await act(async () => {
        outcome = await result.current.negotiate(AGENT_A, AGENT_B, 'priority', 'act-a', 'act-b');
      });

      expect(outcome).toEqual({
        has_conflict: true,
        can_proceed: false,
        winner: 'agent-b',
        resolution: 'conflicting-wins',
        must_wait: true,
        wait_reason: 'occupé',
        deferred_action: 'retry-later',
        defer_until: '2025-06-01T00:00:00Z',
      });
    });

    it('bloque en cas d\'erreur de la fonction edge', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

      const { result } = renderHook(() => useJarvisAgentNegotiation(), {
        wrapper: createWrapper(),
      });

      let outcome;
      await act(async () => {
        outcome = await result.current.negotiate(AGENT_A, AGENT_B, 'priority', 'act-a', 'act-b');
      });

      expect(outcome).toEqual({ has_conflict: true, can_proceed: false });
    });

    it('bloque sans appel réseau si user absent', async () => {
      authState.user = null;
      const { result } = renderHook(() => useJarvisAgentNegotiation(), {
        wrapper: createWrapper(),
      });

      let outcome;
      await act(async () => {
        outcome = await result.current.negotiate(AGENT_A, AGENT_B, 'priority', 'act-a', 'act-b');
      });

      expect(outcome).toEqual({ has_conflict: true, can_proceed: false });
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('fetchHistory', () => {
    it('charge les négociations dans le state', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { negotiations: NEGOTIATIONS },
        error: null,
      });

      const { result } = renderHook(() => useJarvisAgentNegotiation(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.fetchHistory();
      });

      await waitFor(() => {
        expect(result.current.negotiations).toHaveLength(1);
      });
      expect(result.current.negotiations[0]).toMatchObject({
        id: 'neg-1',
        requesting_agent: 'agent-a',
        winner_agent: 'agent-b',
        conflict_type: 'priority',
      });

      expect(mockInvoke).toHaveBeenCalledWith('jarvis-agent-negotiation', {
        body: { action: 'get_history', user_id: 'u1' },
      });
    });

    it('conserve un tableau vide en cas d\'erreur', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

      const { result } = renderHook(() => useJarvisAgentNegotiation(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.fetchHistory();
      });

      expect(result.current.negotiations).toEqual([]);
    });
  });

  describe('resolveManually', () => {
    it('résout manuellement puis rafraîchit l\'historique', async () => {
      mockInvoke
        .mockResolvedValueOnce({ data: {}, error: null })
        .mockResolvedValueOnce({ data: { negotiations: NEGOTIATIONS }, error: null });

      const { result } = renderHook(() => useJarvisAgentNegotiation(), {
        wrapper: createWrapper(),
      });

      let success;
      await act(async () => {
        success = await result.current.resolveManually('neg-1', AGENT_A, 'choix utilisateur');
      });

      expect(success).toBe(true);
      expect(mockInvoke).toHaveBeenNthCalledWith(1, 'jarvis-agent-negotiation', {
        body: {
          action: 'resolve_manually',
          user_id: 'u1',
          negotiation: {
            negotiation_id: 'neg-1',
            winner_agent: AGENT_A,
            user_reason: 'choix utilisateur',
          },
        },
      });
      expect(mockInvoke).toHaveBeenNthCalledWith(2, 'jarvis-agent-negotiation', {
        body: { action: 'get_history', user_id: 'u1' },
      });
      await waitFor(() => {
        expect(result.current.negotiations).toHaveLength(1);
      });
    });

    it('retourne false en cas d\'erreur', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

      const { result } = renderHook(() => useJarvisAgentNegotiation(), {
        wrapper: createWrapper(),
      });

      let success;
      await act(async () => {
        success = await result.current.resolveManually('neg-1', AGENT_A, 'raison');
      });

      expect(success).toBe(false);
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('retourne false sans appel réseau si user absent', async () => {
      authState.user = null;
      const { result } = renderHook(() => useJarvisAgentNegotiation(), {
        wrapper: createWrapper(),
      });

      let success;
      await act(async () => {
        success = await result.current.resolveManually('neg-1', AGENT_A, 'raison');
      });

      expect(success).toBe(false);
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });
});