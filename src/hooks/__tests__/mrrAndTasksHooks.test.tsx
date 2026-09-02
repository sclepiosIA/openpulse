import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tableResults: new Map<string, { data: unknown; error: unknown }>(),
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  debugLog: vi.fn(),
  authState: { loading: false, user: { id: 'user-1' } as null | { id: string } },
}));

const chainFor = (result: { data: unknown; error: unknown }): any => {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then') return (resolve: any) => Promise.resolve(result).then(resolve);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
};

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mocks.from,
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => mocks.authState,
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: mocks.debugLog, error: vi.fn(), warn: vi.fn() },
}));

import { useMRRData } from '../analytics/useMRRData';
import { useTasksBreakdown } from '../analytics/useTasksBreakdown';

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
};

describe('useMRRData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tableResults.clear();
    mocks.from.mockImplementation((table: string) =>
      chainFor(mocks.tableResults.get(table) ?? { data: [], error: null }),
    );
    mocks.authState.loading = false;
    mocks.authState.user = { id: 'user-1' };
  });

  it('calcule MRR, ARR, historique, top clients et breakdown depuis les périodes récurrentes actives', async () => {
    mocks.tableResults.set('facturation_periodes', {
      error: null,
      data: [
        { id: 'p1', etablissement_id: 'eta-1', date_debut: '2026-01-01', date_fin: '2026-12-31', montant_prevu: 12_000, montant_percu: null, statut: 'prevu', type_periode: 'recurrent' },
        { id: 'p2', etablissement_id: 'eta-2', date_debut: '2026-06-01', date_fin: '2026-12-31', montant_prevu: 21_000, montant_percu: null, statut: 'prevu', type_periode: 'recurrent' },
        { id: 'p3', etablissement_id: 'eta-inactive', date_debut: '2026-06-01', date_fin: '2026-06-30', montant_prevu: 99_000, montant_percu: null, statut: 'prevu', type_periode: 'recurrent' },
      ],
    });
    mocks.tableResults.set('etablissements', {
      error: null,
      data: [
        { id: 'eta-1', nom: 'Clinique Alpha', statut: 'Production', type_offre: 'Premium', periodicite_paiement: 'annuelle' },
        { id: 'eta-2', nom: 'CH Beta', statut: 'Déploiement', type_offre: 'Standard', periodicite_paiement: 'trimestrielle' },
      ],
    });

    const { result } = renderHook(() => useMRRData(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentMRR).toBe(4_000);
    expect(result.current.previousMRR).toBe(4_000);
    expect(result.current.mrrVariation).toBe(0);
    expect(result.current.arr).toBe(48_000);
    expect(result.current.payingClients).toBe(2);
    expect(result.current.monthlyHistory).toHaveLength(12);
    expect(result.current.monthlyHistory.at(-1)).toMatchObject({ mrr: 4_000, clientCount: 2 });
    expect(result.current.topClients).toEqual([
      { id: 'eta-2', nom: 'CH Beta', type_offre: 'Standard', mrr: 3_000 },
      { id: 'eta-1', nom: 'Clinique Alpha', type_offre: 'Premium', mrr: 1_000 },
    ]);
    expect(result.current.breakdown).toEqual(
      expect.arrayContaining([
        { type: 'Premium', mrr: 1_000, count: 1 },
        { type: 'Standard', mrr: 3_000, count: 1 },
      ]),
    );
  });

  it('reste à zéro quand l’utilisateur n’est pas authentifié', async () => {
    mocks.authState.user = null;

    const { result } = renderHook(() => useMRRData(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentMRR).toBe(0);
    expect(result.current.arr).toBe(0);
    expect(result.current.payingClients).toBe(0);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe('useTasksBreakdown', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.tableResults.clear();
    mocks.from.mockImplementation((table: string) =>
      chainFor(mocks.tableResults.get(table) ?? { data: [], error: null }),
    );
    const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
    mocks.channel.mockReturnValue(channel);
    mocks.removeChannel.mockClear();
  });

  it('compte les tâches totales et terminées par phase métier', async () => {
    mocks.tableResults.set('taches', {
      error: null,
      data: [
        { id: 't1', statut: 'Terminé', archive: false, categorie: { nom: 'Commercial' } },
        { id: 't2', statut: 'À faire', archive: false, categorie: { nom: 'Commercial' } },
        { id: 't3', statut: 'Terminé', archive: true, categorie: { nom: 'Configuration' } },
        { id: 't4', statut: 'Terminé', archive: false, categorie: { nom: 'Support' } },
        { id: 't5', statut: 'À faire', archive: false, categorie: { nom: 'Inconnue' } },
      ],
    });

    const { result, unmount } = renderHook(() => useTasksBreakdown('eta-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      commercial: { total: 2, completed: 1 },
      deploiement: { total: 1, completed: 1 },
      production: { total: 1, completed: 1 },
      formation: { total: 0, completed: 0 },
    });

    act(() => unmount());
    expect(mocks.removeChannel).toHaveBeenCalled();
  });
});