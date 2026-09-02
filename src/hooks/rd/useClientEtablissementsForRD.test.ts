/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useClientEtablissementsForRD } from './useClientEtablissementsForRD';

const {
  ROWS,
  ERROR_RESULT,
  mockFrom,
  mockSelect,
  mockIn,
  mockOrder,
  mockLimit,
  builder,
} = vi.hoisted(() => {
  const ROWS = [
    { id: 'e2', nom: 'Beta Clinic', statut: 'Production' },
    { id: 'e1', nom: 'Alpha Center', statut: 'Déploiement' },
  ];

  const ERROR_RESULT = { data: null, error: { message: 'x' } };

  const builderState = {
    result: { data: ROWS, error: null as { message: string } | null },
  };

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  const mockFrom = vi.fn();
  const mockSelect = builder.select;
  const mockIn = builder.in;
  const mockOrder = builder.order;
  const mockLimit = builder.limit;

  builder.select.mockImplementation(() => builder);
  builder.eq.mockImplementation(() => builder);
  builder.gte.mockImplementation(() => builder);
  builder.lte.mockImplementation(() => builder);
  builder.in.mockImplementation(() => builder);
  builder.order.mockImplementation(() => builder);
  builder.limit.mockImplementation(() => builder);
  builder.insert.mockImplementation(() => builder);
  builder.update.mockImplementation(() => builder);
  builder.delete.mockImplementation(() => builder);
  builder.single.mockImplementation(() => Promise.resolve(builderState.result));
  builder.maybeSingle.mockImplementation(() => Promise.resolve(builderState.result));
  builder.then.mockImplementation((onFulfilled: (value: typeof builderState.result) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(builderState.result).then(onFulfilled, onRejected),
  );
  builder.catch.mockImplementation((onRejected: (reason: unknown) => unknown) =>
    Promise.resolve(builderState.result).catch(onRejected),
  );

  mockFrom.mockImplementation(() => builder);

  return {
    ROWS,
    ERROR_RESULT,
    builderState,
    mockFrom,
    mockSelect,
    mockIn,
    mockOrder,
    mockLimit,
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

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useClientEtablissementsForRD', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockIn.mockClear();
    mockOrder.mockClear();
    mockLimit.mockClear();

    builder.then.mockClear();
    builder.catch.mockClear();

    mockFrom.mockImplementation(() => builder);
    builder.select.mockImplementation(() => builder);
    builder.in.mockImplementation(() => builder);
    builder.order.mockImplementation(() => builder);
    builder.limit.mockImplementation(() => builder);

    builder.then.mockImplementation((onFulfilled: (value: { data: typeof ROWS | null; error: { message: string } | null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: ROWS, error: null }).then(onFulfilled, onRejected),
    );
    builder.catch.mockImplementation((onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: ROWS, error: null }).catch(onRejected),
    );
  });

  it('expose un état de chargement puis retourne les établissements R&D autorisés', async () => {
    const { result } = renderHook(() => useClientEtablissementsForRD(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockSelect).toHaveBeenCalledWith('id, nom, statut');
    expect(mockIn).toHaveBeenCalledWith('statut', [
      'Contractuel',
      'Contractualisation',
      'Vendu',
      'Conformité',
      'Déploiement',
      'Formation',
      'Go-Live',
      'Production',
    ]);
    expect(mockOrder).toHaveBeenCalledWith('nom', { ascending: true });
    expect(mockLimit).toHaveBeenCalledWith(500);

    expect(result.current.data).toEqual(ROWS);
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]).toEqual({
      id: 'e2',
      nom: 'Beta Clinic',
      statut: 'Production',
    });
    expect(result.current.data?.[1]).toEqual({
      id: 'e1',
      nom: 'Alpha Center',
      statut: 'Déploiement',
    });
  });

  it('passe en erreur quand Supabase renvoie une erreur', async () => {
    builder.then.mockReset();
    builder.catch.mockReset();

    builder.then.mockImplementation((onFulfilled: (value: typeof ERROR_RESULT) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(ERROR_RESULT).then(onFulfilled, onRejected),
    );
    builder.catch.mockImplementation((onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(ERROR_RESULT).catch(onRejected),
    );

    const { result } = renderHook(() => useClientEtablissementsForRD(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('x');
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockIn).toHaveBeenCalledWith('statut', [
      'Contractuel',
      'Contractualisation',
      'Vendu',
      'Conformité',
      'Déploiement',
      'Formation',
      'Go-Live',
      'Production',
    ]);
  });
});