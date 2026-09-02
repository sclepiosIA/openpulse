/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useRDUserStoriesSelect } from './useRDUserStoriesSelect';

const {
  AUTH_STATE,
  ROWS_SUCCESS,
  SUCCESS_RESULT,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const ROWS_SUCCESS = [
    {
      id: 'us-1',
      titre: 'Créer une fiche client',
      projet_id: 'p-1',
      statut: 'en_cours',
      projet: { nom: 'CRM' },
    },
    {
      id: 'us-2',
      titre: 'Ajouter recherche',
      projet_id: 'p-2',
      statut: 'a_faire',
      projet: null,
    },
  ];

  const SUCCESS_RESULT = { data: ROWS_SUCCESS, error: null as { message: string } | null };

  const builder: {
    select: ReturnType<typeof vi.fn>;
    not: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (onFulfilled?: (value: typeof SUCCESS_RESULT) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
    catch: (onRejected?: (reason: unknown) => unknown) => Promise<typeof SUCCESS_RESULT>;
    __result: typeof SUCCESS_RESULT;
  } = {
    select: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then(onFulfilled, onRejected) {
      return Promise.resolve(this.__result).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return Promise.resolve(this.__result).catch(onRejected);
    },
    __result: SUCCESS_RESULT,
  };

  const mockFrom = vi.fn();

  return {
    AUTH_STATE,
    ROWS_SUCCESS,
    SUCCESS_RESULT,
    mockFrom,
    builder,
  };
});

builder.select.mockImplementation(() => builder);
builder.not.mockImplementation(() => builder);
builder.order.mockImplementation(() => builder);
builder.limit.mockImplementation(() => builder);
builder.eq.mockImplementation(() => builder);
builder.gte.mockImplementation(() => builder);
builder.lte.mockImplementation(() => builder);
builder.in.mockImplementation(() => builder);
builder.insert.mockImplementation(() => builder);
builder.update.mockImplementation(() => builder);
builder.delete.mockImplementation(() => builder);
builder.single.mockResolvedValue(SUCCESS_RESULT);
builder.maybeSingle.mockResolvedValue(SUCCESS_RESULT);
mockFrom.mockImplementation(() => builder);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
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

describe('useRDUserStoriesSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    builder.__result = SUCCESS_RESULT;
    mockFrom.mockImplementation(() => builder);
    builder.select.mockImplementation(() => builder);
    builder.not.mockImplementation(() => builder);
    builder.order.mockImplementation(() => builder);
    builder.limit.mockImplementation(() => builder);
  });

  it('démarre en chargement puis retourne les user stories actives transformées pour le select', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useRDUserStoriesSelect(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('rd_user_stories');
    expect(builder.select).toHaveBeenCalledWith(`
          id,
          titre,
          projet_id,
          statut,
          projet:rd_projets(nom)
        `);
    expect(builder.not).toHaveBeenCalledWith('statut', 'eq', 'termine');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(100);

    expect(result.current.data).toEqual([
      {
        id: 'us-1',
        titre: 'Créer une fiche client',
        projet_id: 'p-1',
        projet_nom: 'CRM',
        statut: 'en_cours',
      },
      {
        id: 'us-2',
        titre: 'Ajouter recherche',
        projet_id: 'p-2',
        projet_nom: 'Projet',
        statut: 'a_faire',
      },
    ]);
  });

  it('retourne une erreur quand supabase renvoie error', async () => {
    const wrapper = createWrapper();
    builder.__result = {
      data: null,
      error: { message: 'x' },
    };

    const { result } = renderHook(() => useRDUserStoriesSelect(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe('x');
    expect(mockFrom).toHaveBeenCalledWith('rd_user_stories');
    expect(builder.not).toHaveBeenCalledWith('statut', 'eq', 'termine');
  });

  it('retourne un tableau vide quand data vaut null sans erreur', async () => {
    const wrapper = createWrapper();
    builder.__result = {
      data: null,
      error: null,
    };

    const { result } = renderHook(() => useRDUserStoriesSelect(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
    expect(builder.limit).toHaveBeenCalledWith(100);
  });
});