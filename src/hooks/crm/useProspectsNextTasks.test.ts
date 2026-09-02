import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useProspectsNextTasks, PROSPECTS_NEXT_TASKS_KEY } from './useProspectsNextTasks';

const { ROWS, mockFrom, state } = vi.hoisted(() => {
  const ROWS = [
    { id: 't1', etablissement_id: 'e1', titre: 'Appeler le directeur', echeance: '2025-01-10', statut: 'À faire', archive: false },
    { id: 't2', etablissement_id: 'e1', titre: 'Relance email', echeance: '2025-02-01', statut: 'À faire', archive: false },
    { id: 't3', etablissement_id: 'e2', titre: 'Envoyer devis', echeance: null, statut: 'En cours', archive: false },
    { id: 't4', etablissement_id: null, titre: 'Tâche orpheline', echeance: null, statut: 'À faire', archive: false },
  ];
  const state: { result: { data: unknown; error: unknown } } = {
    result: { data: ROWS, error: null },
  };
  const mockFrom = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    const methods = ['select', 'not', 'neq', 'eq', 'order', 'limit', 'gte', 'lte', 'in'];
    for (const m of methods) {
      builder[m] = vi.fn(() => builder);
    }
    builder.then = (
      resolve: (v: { data: unknown; error: unknown }) => unknown,
      reject?: (e: unknown) => unknown
    ) => Promise.resolve(state.result).then(resolve, reject);
    builder.catch = (reject: (e: unknown) => unknown) =>
      Promise.resolve(state.result).catch(reject);
    return builder;
  });
  return { ROWS, mockFrom, state };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: { from: mockFrom },
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

describe('useProspectsNextTasks', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    state.result = { data: ROWS, error: null };
  });

  it('expose la clé de query attendue', () => {
    expect(PROSPECTS_NEXT_TASKS_KEY).toEqual(['prospects-next-tasks']);
  });

  it('démarre en isLoading puis retourne une Map avec la première tâche par établissement', async () => {
    const { result } = renderHook(() => useProspectsNextTasks(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const map = result.current.data as Map<string, { id: string; etablissement_id: string; titre: string; echeance: string | null }>;
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(2);

    const e1 = map.get('e1');
    expect(e1).toEqual({
      id: 't1',
      etablissement_id: 'e1',
      titre: 'Appeler le directeur',
      echeance: '2025-01-10',
    });

    const e2 = map.get('e2');
    expect(e2).toEqual({
      id: 't3',
      etablissement_id: 'e2',
      titre: 'Envoyer devis',
      echeance: null,
    });

    expect(mockFrom).toHaveBeenCalledWith('taches');
  });

  it("ignore les tâches sans etablissement_id (t4 absente de la Map)", async () => {
    const { result } = renderHook(() => useProspectsNextTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const map = result.current.data as Map<string, unknown>;
    const allIds = Array.from(map.values()).map(
      (v) => (v as { id: string }).id
    );
    expect(allIds).not.toContain('t4');
    expect(allIds).not.toContain('t2');
  });

  it('retourne une Map vide quand data est null sans erreur', async () => {
    state.result = { data: null, error: null };
    const { result } = renderHook(() => useProspectsNextTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const map = result.current.data as Map<string, unknown>;
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(0);
  });

  it('passe en isError quand supabase renvoie une erreur', async () => {
    state.result = { data: null, error: { message: 'x' } };
    const { result } = renderHook(() => useProspectsNextTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual({ message: 'x' });
    expect(result.current.data).toBeUndefined();
  });
});