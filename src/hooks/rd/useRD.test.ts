import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import {
  useRDProjets,
  useRDProjet,
  useRDEpics,
  useCreateRDProjet,
  useDeleteRDProjet,
  useMoveStoryToSprint,
  useUpdateStoryStatus,
} from './useRD';

const { state, mockFrom, mockToast, mockDebug, PROJET_ROWS, PROFILE_ROWS, EPIC_ROWS } = vi.hoisted(() => {
  const PROJET_ROWS = [
    {
      id: 'p1',
      nom: 'Projet Alpha',
      description: 'desc',
      statut: 'actif',
      couleur: '#3b82f6',
      responsable_id: 'u1',
      date_debut: null,
      date_fin_prevue: null,
      dpi: 'hm',
      visible_portail: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
  ];
  const PROFILE_ROWS = [{ id: 'u1', prenom: 'Ana', nom: 'Martin' }];
  const EPIC_ROWS = [
    {
      id: 'e1',
      projet_id: 'p1',
      titre: 'Epic Auth',
      description: null,
      couleur: '#000000',
      statut: 'todo',
      ordre: 1,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  ];

  const state = {
    results: {} as Record<string, { data: unknown; error: { message: string } | null }>,
    lastInsert: undefined as unknown,
    lastUpdate: undefined as unknown,
    eqCalls: [] as Array<[unknown, unknown]>,
    deletedTables: [] as string[],
  };

  const makeBuilder = (table: string) => {
    const result = () => state.results[table] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'gte', 'lte', 'in', 'is', 'order', 'limit']) {
      builder[m] = vi.fn(() => builder);
    }
    builder.eq = vi.fn((col: unknown, val: unknown) => {
      state.eqCalls.push([col, val]);
      return builder;
    });
    builder.insert = vi.fn((payload: unknown) => {
      state.lastInsert = payload;
      return builder;
    });
    builder.update = vi.fn((payload: unknown) => {
      state.lastUpdate = payload;
      return builder;
    });
    builder.delete = vi.fn(() => {
      state.deletedTables.push(table);
      return builder;
    });
    builder.single = vi.fn(() => Promise.resolve(result()));
    builder.maybeSingle = vi.fn(() => Promise.resolve(result()));
    builder.then = (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result()).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result()).catch(onRejected);
    return builder;
  };

  const mockFrom = vi.fn((table: string) => makeBuilder(table));
  const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  const mockDebug = { error: vi.fn(), log: vi.fn(), warn: vi.fn(), info: vi.fn() };

  return { state, mockFrom, mockToast, mockDebug, PROJET_ROWS, PROFILE_ROWS, EPIC_ROWS };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mockFrom } }));
vi.mock('@/lib/debug', () => ({ debug: mockDebug }));
vi.mock('sonner', () => ({ toast: mockToast }));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.results = {};
  state.lastInsert = undefined;
  state.lastUpdate = undefined;
  state.eqCalls.length = 0;
  state.deletedTables.length = 0;
});

describe('useRDProjets', () => {
  it('passe par isLoading puis renvoie les projets enrichis avec le responsable', async () => {
    state.results['rd_projets'] = { data: PROJET_ROWS, error: null };
    state.results['profiles'] = { data: PROFILE_ROWS, error: null };

    const { result } = renderHook(() => useRDProjets(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(result.current.data).toHaveLength(1);
    const projet = result.current.data?.[0];
    expect(projet?.nom).toBe('Projet Alpha');
    expect(projet?.statut).toBe('actif');
    expect(projet?.responsable).toEqual({ id: 'u1', prenom: 'Ana', nom: 'Martin' });
    expect(mockFrom).toHaveBeenCalledWith('rd_projets');
    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });

  it('passe en erreur quand supabase renvoie une erreur', async () => {
    state.results['rd_projets'] = { data: null, error: { message: 'x' } };

    const { result } = renderHook(() => useRDProjets(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 });
    expect((result.current.error as { message: string }).message).toBe('x');
  });
});

describe('useRDProjet', () => {
  it('charge un projet par id et y attache le responsable', async () => {
    state.results['rd_projets'] = { data: PROJET_ROWS[0], error: null };
    state.results['profiles'] = { data: PROFILE_ROWS, error: null };

    const { result } = renderHook(() => useRDProjet('p1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(result.current.data?.id).toBe('p1');
    expect(result.current.data?.responsable?.nom).toBe('Martin');
    expect(state.eqCalls).toContainEqual(['id', 'p1']);
  });

  it('est désactivé sans id et ne déclenche aucun appel supabase', async () => {
    const { result } = renderHook(() => useRDProjet(undefined), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('useRDEpics', () => {
  it('renvoie les epics du projet triés', async () => {
    state.results['rd_epics'] = { data: EPIC_ROWS, error: null };

    const { result } = renderHook(() => useRDEpics('p1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].titre).toBe('Epic Auth');
    expect(state.eqCalls).toContainEqual(['projet_id', 'p1']);
  });
});

describe('useCreateRDProjet', () => {
  it('insère le projet puis affiche le toast de succès', async () => {
    state.results['rd_projets'] = { data: { ...PROJET_ROWS[0], id: 'p2' }, error: null };

    const { result } = renderHook(() => useCreateRDProjet(), { wrapper: createWrapper() });

    const formData = { nom: 'Nouveau projet', statut: 'actif', dpi: 'hm' };
    await act(async () => {
      await result.current.mutateAsync(formData as never);
    });

    expect(mockFrom).toHaveBeenCalledWith('rd_projets');
    expect(state.lastInsert).toEqual(formData);
    expect(mockToast.success).toHaveBeenCalledWith('Projet créé');
  });

  it('affiche le toast d erreur et logge via debug.error en cas d échec', async () => {
    state.results['rd_projets'] = { data: null, error: { message: 'boom' } };

    const { result } = renderHook(() => useCreateRDProjet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current
        .mutateAsync({ nom: 'KO', statut: 'actif', dpi: 'hm' } as never)
        .catch(() => undefined);
    });

    expect(mockToast.error).toHaveBeenCalledWith('Erreur lors de la création du projet');
    expect(mockDebug.error).toHaveBeenCalledWith({ message: 'boom' });
    expect(mockToast.success).not.toHaveBeenCalled();
  });
});

describe('useDeleteRDProjet', () => {
  it('supprime le projet par id et affiche le toast de succès', async () => {
    state.results['rd_projets'] = { data: null, error: null };

    const { result } = renderHook(() => useDeleteRDProjet(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync('p1');
    });

    expect(state.deletedTables).toContain('rd_projets');
    expect(state.eqCalls).toContainEqual(['id', 'p1']);
    expect(mockToast.success).toHaveBeenCalledWith('Projet supprimé');
  });
});

describe('useMoveStoryToSprint', () => {
  it('met à jour le sprint_id de la story ciblée (y compris vers null)', async () => {
    state.results['rd_user_stories'] = { data: null, error: null };

    const { result } = renderHook(() => useMoveStoryToSprint(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ storyId: 's1', sprintId: null, projetId: 'p1' });
    });

    expect(mockFrom).toHaveBeenCalledWith('rd_user_stories');
    expect(state.lastUpdate).toEqual({ sprint_id: null });
    expect(state.eqCalls).toContainEqual(['id', 's1']);
  });
});

describe('useUpdateStoryStatus', () => {
  it('met à jour le statut de la story', async () => {
    state.results['rd_user_stories'] = { data: null, error: null };

    const { result } = renderHook(() => useUpdateStoryStatus(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ storyId: 's2', statut: 'done', projetId: 'p1' });
    });

    expect(state.lastUpdate).toEqual({ statut: 'done' });
    expect(state.eqCalls).toContainEqual(['id', 's2']);
  });

  it('rejette quand la mise à jour échoue côté supabase', async () => {
    state.results['rd_user_stories'] = { data: null, error: { message: 'x' } };

    const { result } = renderHook(() => useUpdateStoryStatus(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ storyId: 's2', statut: 'done', projetId: 'p1' }),
      ).rejects.toEqual({ message: 'x' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});