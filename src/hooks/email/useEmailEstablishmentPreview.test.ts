/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmailEstablishmentPreview } from './useEmailEstablishmentPreview';

const {
  PREVIEW_DATA,
  mockFrom,
  mockSelect,
  mockEq,
  mockOrder,
  mockLimit,
  mockMaybeSingle,
  builder,
} = vi.hoisted(() => {
  const PREVIEW_DATA = {
    nom: 'Etablissement Alpha',
    ville: 'Lyon',
    statut: 'Actif',
    progression: 72,
    relationship_status: 'engaged',
    engagement_score: 88,
    taches: [
      {
        id: 'task-1',
        titre: 'Relancer contact',
        echeance: '2026-06-10',
        statut: 'A faire',
        priorite: 'haute',
      },
    ],
  };

  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockFrom = vi.fn();

  const builder = {
    select: mockSelect,
    eq: mockEq,
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: mockOrder,
    limit: mockLimit,
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: mockMaybeSingle,
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: PREVIEW_DATA, error: null }).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: PREVIEW_DATA, error: null }).catch(onRejected),
  };

  mockSelect.mockReturnValue(builder);
  mockEq.mockReturnValue(builder);
  mockOrder.mockReturnValue(builder);
  mockLimit.mockReturnValue(builder);
  mockMaybeSingle.mockResolvedValue({ data: PREVIEW_DATA, error: null });
  mockFrom.mockReturnValue(builder);

  return {
    PREVIEW_DATA,
    mockFrom,
    mockSelect,
    mockEq,
    mockOrder,
    mockLimit,
    mockMaybeSingle,
    builder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useEmailEstablishmentPreview', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockEq.mockClear();
    mockOrder.mockClear();
    mockLimit.mockClear();
    mockMaybeSingle.mockClear();

    mockFrom.mockReturnValue(builder);
    mockSelect.mockReturnValue(builder);
    mockEq.mockReturnValue(builder);
    mockOrder.mockReturnValue(builder);
    mockLimit.mockReturnValue(builder);
    mockMaybeSingle.mockResolvedValue({ data: PREVIEW_DATA, error: null });
  });

  it('ne lance pas la requête si etablissementId est undefined', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailEstablishmentPreview(undefined), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('charge puis retourne les données métier de prévisualisation établissement', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailEstablishmentPreview('eta-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockSelect).toHaveBeenCalledWith(`
          nom,
          ville,
          statut,
          progression,
          relationship_status,
          engagement_score,
          taches!inner(
            id,
            titre,
            echeance,
            statut,
            priorite
          )
        `);
    expect(mockEq).toHaveBeenNthCalledWith(1, 'id', 'eta-1');
    expect(mockEq).toHaveBeenNthCalledWith(2, 'taches.statut', 'A faire');
    expect(mockOrder).toHaveBeenCalledWith('echeance', { ascending: true, foreignTable: 'taches' });
    expect(mockLimit).toHaveBeenCalledWith(1, { foreignTable: 'taches' });
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);

    expect(result.current.data).toEqual(PREVIEW_DATA);
    expect(result.current.data?.nom).toBe('Etablissement Alpha');
    expect(result.current.data?.ville).toBe('Lyon');
    expect(result.current.data?.statut).toBe('Actif');
    expect(result.current.data?.progression).toBe(72);
    expect(result.current.data?.relationship_status).toBe('engaged');
    expect(result.current.data?.engagement_score).toBe(88);
    expect(result.current.data?.taches).toHaveLength(1);
    expect(result.current.data?.taches[0]).toEqual({
      id: 'task-1',
      titre: 'Relancer contact',
      echeance: '2026-06-10',
      statut: 'A faire',
      priorite: 'haute',
    });
  });

  it('retourne null sans erreur quand supabase renvoie data null et error', async () => {
    const wrapper = createWrapper();

    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

    const { result } = renderHook(() => useEmailEstablishmentPreview('eta-error'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockEq).toHaveBeenNthCalledWith(1, 'id', 'eta-error');
    expect(mockEq).toHaveBeenNthCalledWith(2, 'taches.statut', 'A faire');
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });
});