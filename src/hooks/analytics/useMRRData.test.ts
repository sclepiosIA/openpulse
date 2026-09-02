/* @vitest-environment jsdom */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMRRData } from './useMRRData';

const {
  AUTH_STATE,
  PERIODS_SUCCESS,
  ETABS_SUCCESS,
  FACTURATION_ERROR,
  ETABS_ERROR,
  STATUS_LIST,
  mockFrom,
} = vi.hoisted(() => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const prevMonthIndex = (currentMonthIndex + 11) % 12;
  const prevYear = currentMonthIndex === 0 ? currentYear - 1 : currentYear;

  const currentMonthStart = new Date(currentYear, currentMonthIndex, 1);
  const currentMonthEnd = new Date(currentYear, currentMonthIndex + 1, 0);
  const previousMonthStart = new Date(prevYear, prevMonthIndex, 1);
  const previousMonthEnd = new Date(prevYear, prevMonthIndex + 1, 0);

  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const fmt = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  return {
    AUTH_STATE: {
      loading: false,
      user: { id: 'u1', email: 't@t.co' },
    },
    PERIODS_SUCCESS: [
      {
        id: 'p1',
        etablissement_id: 'e1',
        date_debut: fmt(currentMonthStart),
        date_fin: fmt(currentMonthEnd),
        montant_prevu: 120,
        montant_percu: 120,
        statut: 'active',
        type_periode: 'recurrent',
      },
      {
        id: 'p2',
        etablissement_id: 'e2',
        date_debut: fmt(previousMonthStart),
        date_fin: fmt(currentMonthEnd),
        montant_prevu: 400,
        montant_percu: 200,
        statut: 'active',
        type_periode: 'recurrent',
      },
      {
        id: 'p3',
        etablissement_id: 'e3',
        date_debut: fmt(previousMonthStart),
        date_fin: fmt(previousMonthEnd),
        montant_prevu: 90,
        montant_percu: 90,
        statut: 'active',
        type_periode: 'recurrent',
      },
      {
        id: 'p4',
        etablissement_id: 'e999',
        date_debut: fmt(currentMonthStart),
        date_fin: fmt(currentMonthEnd),
        montant_prevu: 999,
        montant_percu: null,
        statut: 'active',
        type_periode: 'recurrent',
      },
    ],
    ETABS_SUCCESS: [
      {
        id: 'e1',
        nom: 'Alpha',
        statut: 'Production',
        type_offre: 'Premium',
        periodicite_paiement: 'mensuel',
      },
      {
        id: 'e2',
        nom: 'Beta',
        statut: 'Go-Live',
        type_offre: 'Standard',
        periodicite_paiement: 'mensuel',
      },
      {
        id: 'e3',
        nom: 'Gamma',
        statut: 'Déploiement',
        type_offre: null,
        periodicite_paiement: 'trimestriel',
      },
    ],
    FACTURATION_ERROR: { message: 'facturation failed' },
    ETABS_ERROR: { message: 'etabs failed' },
    STATUS_LIST: ['Contractuel', 'Conformité', 'Déploiement', 'Formation', 'Go-Live', 'Production'],
    mockFrom: vi.fn(),
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createThenableBuilder(result: { data: unknown; error: { message: string } | null }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (onFulfilled?: (value: { data: unknown; error: { message: string } | null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

describe('useMRRData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expose isLoading puis calcule les métriques MRR réelles au succès', async () => {
    const facturationBuilder = createThenableBuilder({ data: PERIODS_SUCCESS, error: null });
    const etabsBuilder = createThenableBuilder({ data: ETABS_SUCCESS, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'facturation_periodes') return facturationBuilder;
      if (table === 'etablissements') return etabsBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const { result } = renderHook(() => useMRRData(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('facturation_periodes');
    expect(mockFrom).toHaveBeenCalledWith('etablissements');

    expect(facturationBuilder.select).toHaveBeenCalledWith('id, etablissement_id, date_debut, date_fin, montant_prevu, montant_percu, statut, type_periode');
    expect(facturationBuilder.eq).toHaveBeenCalledWith('supprime', false);
    expect(facturationBuilder.eq).toHaveBeenCalledWith('type_periode', 'recurrent');
    expect(etabsBuilder.select).toHaveBeenCalledWith('id, nom, statut, type_offre, periodicite_paiement');
    expect(etabsBuilder.in).toHaveBeenCalledWith('statut', STATUS_LIST);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentMRR).toBe(320);
    expect(result.current.previousMRR).toBe(290);
    expect(result.current.arr).toBe(3840);
    expect(result.current.payingClients).toBe(2);
    expect(result.current.mrrVariation).toBeCloseTo(((320 - 290) / 290) * 100, 5);

    expect(result.current.topClients).toEqual([
      { id: 'e2', nom: 'Beta', type_offre: 'Standard', mrr: 200 },
      { id: 'e1', nom: 'Alpha', type_offre: 'Premium', mrr: 120 },
    ]);

    expect(result.current.breakdown).toEqual(
      expect.arrayContaining([
        { type: 'Premium', mrr: 120, count: 1 },
        { type: 'Standard', mrr: 200, count: 1 },
      ]),
    );
    expect(result.current.breakdown).toHaveLength(2);

    expect(result.current.monthlyHistory).toHaveLength(12);
    const currentMonthKey = format(new Date(), 'yyyy-MM');
    const previousMonthKey = format(subMonths(new Date(), 1), 'yyyy-MM');
    const currentLabel = format(new Date(), 'MMM yyyy', { locale: fr });
    const previousLabel = format(subMonths(new Date(), 1), 'MMM yyyy', { locale: fr });

    expect(result.current.monthlyHistory[result.current.monthlyHistory.length - 1]).toEqual({
      month: currentMonthKey,
      label: currentLabel,
      mrr: 320,
      clientCount: 2,
    });
    expect(
      result.current.monthlyHistory.find((m) => m.month === previousMonthKey),
    ).toEqual({
      month: previousMonthKey,
      label: previousLabel,
      mrr: 290,
      clientCount: 2,
    });

    const zeroMonths = result.current.monthlyHistory.filter(
      (m) => m.month !== currentMonthKey && m.month !== previousMonthKey,
    );
    expect(zeroMonths.every((m) => m.mrr === 0 && m.clientCount === 0)).toBe(true);
  });

  it('retourne des métriques neutres si la requête facturation échoue', async () => {
    const facturationBuilder = createThenableBuilder({ data: null, error: FACTURATION_ERROR });
    const etabsBuilder = createThenableBuilder({ data: ETABS_SUCCESS, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'facturation_periodes') return facturationBuilder;
      if (table === 'etablissements') return etabsBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const { result } = renderHook(() => useMRRData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentMRR).toBe(0);
    expect(result.current.previousMRR).toBe(0);
    expect(result.current.arr).toBe(0);
    expect(result.current.payingClients).toBe(0);
    expect(result.current.topClients).toEqual([]);
    expect(result.current.breakdown).toEqual([]);
    expect(result.current.monthlyHistory).toHaveLength(12);
    expect(result.current.monthlyHistory.every((m) => m.mrr === 0 && m.clientCount === 0)).toBe(true);
  });

  it('retourne des métriques neutres si la requête établissements échoue', async () => {
    const facturationBuilder = createThenableBuilder({ data: PERIODS_SUCCESS, error: null });
    const etabsBuilder = createThenableBuilder({ data: null, error: ETABS_ERROR });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'facturation_periodes') return facturationBuilder;
      if (table === 'etablissements') return etabsBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const { result } = renderHook(() => useMRRData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentMRR).toBe(0);
    expect(result.current.previousMRR).toBe(0);
    expect(result.current.arr).toBe(0);
    expect(result.current.payingClients).toBe(0);
    expect(result.current.topClients).toEqual([]);
    expect(result.current.breakdown).toEqual([]);
    expect(result.current.monthlyHistory).toHaveLength(12);
    expect(result.current.monthlyHistory.every((m) => m.mrr === 0 && m.clientCount === 0)).toBe(true);
  });
})