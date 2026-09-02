import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFacturationEtablissements,
  useEcheancesFacturation,
  useEtablissementModeleEconomique,
  calculateMontantAnnuel,
  calculateMontantPeriodique,
} from './useFacturationEtablissement';

type QueryResult = { data: unknown; error: unknown };

const { mockFrom, makeBuilder, ETABS, FACTURES, ETAB_SINGLE } = vi.hoisted(() => {
  const makeBuilder = (result: { data: unknown; error: unknown }) => {
    const b: Record<string, unknown> = {};
    const methods = [
      'select', 'eq', 'neq', 'gte', 'lte', 'in', 'order', 'limit',
      'insert', 'update', 'delete', 'not', 'or', 'range',
    ];
    for (const m of methods) {
      b[m] = vi.fn(() => b);
    }
    b.single = vi.fn(() => Promise.resolve(result));
    b.maybeSingle = vi.fn(() => Promise.resolve(result));
    b.then = (
      onFulfilled?: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    b.catch = (onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected);
    return b;
  };

  const ETABS = [
    {
      id: 'e1',
      nom: 'Hôpital Alpha',
      ville: 'Paris',
      statut: 'Production',
      type_offre: 'SaaS',
      periodicite_paiement: 'mensuel',
      tarifs_palliers: null,
      pallier_vise: null,
      modele_statique_succes: '12000',
      nombre_passages_urgences_annuel: null,
      paiement_initial: null,
      date_signature: '2024-01-15',
      date_go_live: '2024-02-01',
    },
    {
      id: 'e2',
      nom: 'Clinique Beta',
      ville: 'Lyon',
      statut: 'Contractuel',
      type_offre: 'Succès',
      periodicite_paiement: 'trimestriel',
      tarifs_palliers: { palier2: 24000 },
      pallier_vise: 'Palier 2',
      modele_statique_succes: null,
      nombre_passages_urgences_annuel: null,
      paiement_initial: null,
      date_signature: '2024-01-10',
      date_go_live: '2024-01-10',
    },
  ];

  const FACTURES = [
    { etablissement_id: 'e1', created_at: '2024-05-01T10:00:00Z' },
    { etablissement_id: 'e1', created_at: '2024-04-01T10:00:00Z' },
  ];

  const ETAB_SINGLE = {
    id: 'e2',
    nom: 'Clinique Beta',
    ville: 'Lyon',
    statut: 'Contractuel',
    type_offre: 'Succès',
    periodicite_paiement: 'trimestriel',
    tarifs_palliers: { palier2: 24000 },
    pallier_vise: 'Palier 2',
    modele_statique_succes: null,
    nombre_passages_urgences_annuel: null,
    paiement_initial: null,
    date_signature: '2024-01-10',
    date_go_live: '2024-01-10',
  };

  return { mockFrom: vi.fn(), makeBuilder, ETABS, FACTURES, ETAB_SINGLE };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function setupSuccessMocks() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'etablissements') {
      return makeBuilder({ data: ETABS, error: null });
    }
    return makeBuilder({ data: FACTURES, error: null });
  });
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('calculateMontantAnnuel', () => {
  it('utilise les tarifs par paliers (modèle Succès)', () => {
    const res = calculateMontantAnnuel({
      tarifs_palliers: { palier2: 24000 },
      pallier_vise: 'Palier 2',
    });
    expect(res).toEqual({ montant: 24000, modele: 'Succès' });
  });

  it('utilise le modèle statique avec valeur string', () => {
    const res = calculateMontantAnnuel({ modele_statique_succes: '15000' });
    expect(res).toEqual({ montant: 15000, modele: 'Statique' });
  });

  it('utilise le modèle statique avec valeur number', () => {
    const res = calculateMontantAnnuel({ modele_statique_succes: 8000 });
    expect(res).toEqual({ montant: 8000, modele: 'Statique' });
  });

  it('estime à 2€/passage si pas de modèle', () => {
    const res = calculateMontantAnnuel({ nombre_passages_urgences_annuel: 30000 });
    expect(res).toEqual({ montant: 60000, modele: 'Estimation' });
  });

  it('retourne 0 / Non défini sans données', () => {
    const res = calculateMontantAnnuel({});
    expect(res).toEqual({ montant: 0, modele: 'Non défini' });
  });
});

describe('calculateMontantPeriodique', () => {
  it.each([
    ['mensuel', 12000, 1000],
    ['trimestriel', 12000, 3000],
    ['semestriel', 12000, 6000],
    ['annuel', 12000, 12000],
    ['inconnu', 12000, 1000],
  ])('périodicité %s : %d → %d', (periodicite, annuel, attendu) => {
    expect(calculateMontantPeriodique(annuel, periodicite)).toBe(attendu);
  });
});

describe('useFacturationEtablissements', () => {
  it('charge puis retourne les établissements enrichis', async () => {
    setupSuccessMocks();
    const { result } = renderHook(() => useFacturationEtablissements(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data).toHaveLength(2);

    const e1 = data?.[0];
    expect(e1?.etablissement_id).toBe('e1');
    expect(e1?.nom).toBe('Hôpital Alpha');
    expect(e1?.modele).toBe('Statique');
    expect(e1?.montant_annuel).toBe(12000);
    expect(e1?.montant_periodique).toBe(1000);
    expect(e1?.periodicite).toBe('mensuel');
    expect(e1?.factures_count).toBe(2);
    expect(e1?.derniere_facture_date).toBe('2024-05-01T10:00:00Z');
    expect(e1?.prochaine_echeance).toBeInstanceOf(Date);

    const e2 = data?.[1];
    expect(e2?.modele).toBe('Succès');
    expect(e2?.montant_annuel).toBe(24000);
    expect(e2?.montant_periodique).toBe(6000);
    expect(e2?.periodicite).toBe('trimestriel');
    expect(e2?.factures_count).toBe(0);
    expect(e2?.derniere_facture_date).toBeNull();

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockFrom).toHaveBeenCalledWith('factures');
  });

  it('passe en erreur si la requête établissements échoue', async () => {
    mockFrom.mockImplementation(() =>
      makeBuilder({ data: null, error: { message: 'x' } } as QueryResult),
    );
    const { result } = renderHook(() => useFacturationEtablissements(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useEcheancesFacturation', () => {
  it('calcule les échéances sur 3 mois et le total', async () => {
    setupSuccessMocks();
    const { result } = renderHook(() => useEcheancesFacturation(3), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // e1 mensuel → 3 échéances de 1000 ; e2 trimestriel → exactement 1 échéance de 6000 sur 3 mois
    const echeancesE1 = result.current.echeances.filter(
      (e) => e.etablissement.etablissement_id === 'e1',
    );
    const echeancesE2 = result.current.echeances.filter(
      (e) => e.etablissement.etablissement_id === 'e2',
    );

    expect(echeancesE1).toHaveLength(3);
    expect(echeancesE1.every((e) => e.montant === 1000)).toBe(true);
    expect(echeancesE1.every((e) => e.type === 'récurrent')).toBe(true);
    expect(echeancesE1[0].libelle).toMatch(/^Abonnement OpenPulse - /);

    expect(echeancesE2).toHaveLength(1);
    expect(echeancesE2[0].montant).toBe(6000);

    expect(result.current.echeances).toHaveLength(4);
    expect(result.current.totalMontant).toBe(9000);
    expect(Object.keys(result.current.echeancesParMois)).toHaveLength(3);
  });

  it('expose une erreur si la requête sous-jacente échoue', async () => {
    mockFrom.mockImplementation(() =>
      makeBuilder({ data: null, error: { message: 'x' } } as QueryResult),
    );
    const { result } = renderHook(() => useEcheancesFacturation(3), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.echeances).toHaveLength(0);
    expect(result.current.totalMontant).toBe(0);
  });
});

describe('useEtablissementModeleEconomique', () => {
  it('retourne le modèle économique calculé pour un établissement', async () => {
    mockFrom.mockImplementation(() =>
      makeBuilder({ data: ETAB_SINGLE, error: null }),
    );
    const { result } = renderHook(
      () => useEtablissementModeleEconomique('e2'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({
      etablissement_id: 'e2',
      nom: 'Clinique Beta',
      modele: 'Succès',
      periodicite: 'trimestriel',
      montant_annuel: 24000,
      montant_periodique: 6000,
      pallier_vise: 'Palier 2',
    });
    expect(mockFrom).toHaveBeenCalledWith('etablissements');
  });

  it('est désactivé quand etablissementId est null', async () => {
    const { result } = renderHook(
      () => useEtablissementModeleEconomique(null),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('passe en erreur si la requête échoue', async () => {
    mockFrom.mockImplementation(() =>
      makeBuilder({ data: null, error: { message: 'x' } } as QueryResult),
    );
    const { result } = renderHook(
      () => useEtablissementModeleEconomique('e2'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});