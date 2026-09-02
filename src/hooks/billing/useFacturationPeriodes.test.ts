import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { ROWS, mockFrom, state } = vi.hoisted(() => {
  const ROWS = [
    {
      id: 'p1',
      etablissement_id: 'etab-1',
      date_debut: '2024-01-01',
      date_fin: '2024-01-31',
      montant_prevu: 1500,
      montant_percu: null,
      statut: 'prevue',
      modele_snapshot: null,
      est_modifie_manuellement: false,
      notes: null,
      date_facture: null,
      date_virement_estimee: null,
      type_periode: 'recurrent',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'p2',
      etablissement_id: 'etab-1',
      date_debut: '2024-02-01',
      date_fin: '2024-02-29',
      montant_prevu: 1500,
      montant_percu: 1500,
      statut: 'encaissee',
      modele_snapshot: null,
      est_modifie_manuellement: false,
      notes: 'payé',
      date_facture: '2024-02-05',
      date_virement_estimee: null,
      type_periode: 'recurrent',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const state = {
    result: { data: ROWS as unknown, error: null as unknown },
    updateCalls: [] as unknown[][],
    eqCalls: [] as unknown[][],
  };

  function makeBuilder() {
    const builder: Record<string, unknown> = {};
    const chainMethods = [
      'select',
      'neq',
      'gte',
      'lte',
      'in',
      'order',
      'limit',
      'insert',
      'delete',
      'upsert',
    ];
    for (const m of chainMethods) {
      builder[m] = vi.fn(() => builder);
    }
    builder.eq = vi.fn((...args: unknown[]) => {
      state.eqCalls.push(args);
      return builder;
    });
    builder.update = vi.fn((...args: unknown[]) => {
      state.updateCalls.push(args);
      return builder;
    });
    builder.single = vi.fn(() => Promise.resolve(state.result));
    builder.maybeSingle = vi.fn(() => Promise.resolve(state.result));
    builder.then = (
      onFulfilled?: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(state.result).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(state.result).catch(onRejected);
    return builder;
  }

  const mockFrom = vi.fn(() => makeBuilder());

  return { ROWS, mockFrom, state };
});

const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/tresorerie/calculateRevenues', () => ({
  calculatePeriodicPaymentAmount: vi.fn(() => 1000),
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

import { useFacturationPeriodes } from './useFacturationPeriodes';

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

describe('useFacturationPeriodes', () => {
  beforeEach(() => {
    state.result = { data: ROWS, error: null };
    state.updateCalls.length = 0;
    state.eqCalls.length = 0;
    mockFrom.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it('charge puis retourne les périodes de facturation depuis supabase', async () => {
    const { result } = renderHook(
      () => useFacturationPeriodes('etab-1'),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFrom).toHaveBeenCalledWith('facturation_periodes');
    expect(result.current.periodes).toHaveLength(2);
    expect(result.current.periodes?.[0].id).toBe('p1');
    expect(result.current.periodes?.[0].montant_prevu).toBe(1500);
    expect(result.current.periodes?.[0].statut).toBe('prevue');
    expect(result.current.periodes?.[1].statut).toBe('encaissee');
    expect(result.current.periodes?.[1].montant_percu).toBe(1500);
    expect(
      state.eqCalls.some((c) => c[0] === 'etablissement_id' && c[1] === 'etab-1'),
    ).toBe(true);
    expect(
      state.eqCalls.some((c) => c[0] === 'supprime' && c[1] === false),
    ).toBe(true);
  });

  it('en cas d’erreur supabase, ne retourne aucune période et termine le chargement', async () => {
    state.result = { data: null, error: { message: 'x' } };

    const { result } = renderHook(
      () => useFacturationPeriodes('etab-1'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Le hook peut retourner undefined ou un tableau vide en cas d'erreur,
    // mais jamais des lignes métier réelles.
    const periodes = result.current.periodes ?? [];
    expect(periodes).toHaveLength(0);
  });

  it('updatePeriode envoie un update avec est_modifie_manuellement=true et supprime=false', async () => {
    const { result } = renderHook(
      () => useFacturationPeriodes('etab-1'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updatePeriode.mutateAsync({
        id: 'p1',
        updates: { montant_percu: 500, statut: 'encaissee' },
      });
    });

    expect(state.updateCalls.length).toBeGreaterThan(0);
    const lastUpdatePayload = state.updateCalls[state.updateCalls.length - 1][0] as Record<string, unknown>;
    expect(lastUpdatePayload.montant_percu).toBe(500);
    expect(lastUpdatePayload.statut).toBe('encaissee');
    expect(lastUpdatePayload.est_modifie_manuellement).toBe(true);
    expect(lastUpdatePayload.supprime).toBe(false);
    expect(
      state.eqCalls.some((c) => c[0] === 'id' && c[1] === 'p1'),
    ).toBe(true);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('updatePeriode normalise les dates au format yyyy-MM-dd et nettoie les tombstones', async () => {
    const { result } = renderHook(
      () => useFacturationPeriodes('etab-1'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    state.result = {
      data: { etablissement_id: 'etab-1', type_periode: 'recurrent' },
      error: null,
    };

    await act(async () => {
      await result.current.updatePeriode.mutateAsync({
        id: 'p1',
        updates: { date_debut: '2024-03-01T10:30:00.000Z' },
      });
    });

    expect(state.updateCalls.length).toBeGreaterThan(0);
    const lastUpdatePayload = state.updateCalls[state.updateCalls.length - 1][0] as Record<string, unknown>;
    expect(lastUpdatePayload.date_debut).toBe('2024-03-01');
    expect(lastUpdatePayload.est_modifie_manuellement).toBe(true);
  });

  it('updatePeriode appelle toast.error quand supabase renvoie une erreur', async () => {
    const { result } = renderHook(
      () => useFacturationPeriodes('etab-1'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    state.result = { data: null, error: { message: 'boom' } };

    await act(async () => {
      await result.current.updatePeriode
        .mutateAsync({ id: 'p1', updates: { statut: 'encaissee' } })
        .catch(() => undefined);
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
  });
});